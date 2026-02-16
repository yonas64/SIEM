import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log } from '../logs/log.schema';
import { AlertsService } from '../alerts/alerts.service';
import {
  FAILED_LOGIN_EVENT_NAMES,
  IMPOSSIBLE_TRAVELER_MAX_LOOKBACK_HOURS,
  IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM,
  IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH,
  LOGIN_SUCCESS_EVENT_NAMES,
  RULE_ID_FAILED_LOGINS,
  RULE_ID_IMPOSSIBLE_TRAVELER,
} from './rules.constants';

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    private readonly alertsService: AlertsService,
  ) {}

  // Evaluate rules for a newly ingested log
  async evaluate(newLog: Log): Promise<void> {
    await Promise.all([this.evaluateFailedLogins(newLog), this.evaluateImpossibleTraveler(newLog)]);
  }

  private async evaluateFailedLogins(newLog: Log): Promise<void> {
    // Only run the failed-login rule if the incoming log matches the event name
    if (!newLog.ip || !FAILED_LOGIN_EVENT_NAMES.includes(newLog.event)) {
      return;
    }

    const fiveMinutesAgo = new Date(newLog.timestamp.getTime() - 5 * 60 * 1000);

    const count = await this.logModel.countDocuments({
      ip: newLog.ip,
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
      timestamp: { $gte: fiveMinutesAgo, $lte: newLog.timestamp },
    });

    if (count >= 5) {
      // Create alert; include context for investigation
      await this.alertsService.create({
        ruleId: RULE_ID_FAILED_LOGINS,
        message: `Detected ${count} failed logins from IP ${newLog.ip} within 5 minutes`,
        severity: 'high',
        ip: newLog.ip,
        triggeredAt: new Date(),
        context: {
          count,
          windowMinutes: 5,
          ip: newLog.ip,
          lastEventAt: newLog.timestamp,
        },
      });
    }
  }

  private async evaluateImpossibleTraveler(newLog: Log): Promise<void> {
    if (!newLog.user || !LOGIN_SUCCESS_EVENT_NAMES.includes(newLog.event)) {
      return;
    }

    const currentLocation = this.extractGeoPoint(newLog);
    if (!currentLocation) {
      return;
    }

    const lookbackStart = new Date(
      newLog.timestamp.getTime() - IMPOSSIBLE_TRAVELER_MAX_LOOKBACK_HOURS * 60 * 60 * 1000,
    );

    const previousLog = await this.logModel
      .findOne({
        _id: { $ne: newLog._id },
        user: newLog.user,
        event: { $in: LOGIN_SUCCESS_EVENT_NAMES },
        timestamp: { $gte: lookbackStart, $lt: newLog.timestamp },
      })
      .sort({ timestamp: -1 })
      .exec();

    if (!previousLog) {
      return;
    }

    const previousLocation = this.extractGeoPoint(previousLog);
    if (!previousLocation) {
      return;
    }

    const elapsedHours = (newLog.timestamp.getTime() - previousLog.timestamp.getTime()) / (60 * 60 * 1000);
    if (elapsedHours <= 0) {
      return;
    }

    const distanceKm = this.haversineKm(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude,
    );
    const speedKmh = distanceKm / elapsedHours;

    if (distanceKm < IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM || speedKmh < IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH) {
      return;
    }

    await this.alertsService.create({
      ruleId: RULE_ID_IMPOSSIBLE_TRAVELER,
      message: `Impossible traveler detected for user ${newLog.user}: ${distanceKm.toFixed(0)} km in ${elapsedHours.toFixed(2)} hours`,
      severity: 'critical',
      ip: newLog.ip,
      triggeredAt: new Date(),
      context: {
        user: newLog.user,
        from: {
          timestamp: previousLog.timestamp,
          ip: previousLog.ip,
          latitude: previousLocation.latitude,
          longitude: previousLocation.longitude,
        },
        to: {
          timestamp: newLog.timestamp,
          ip: newLog.ip,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        distanceKm,
        elapsedHours,
        speedKmh,
        thresholds: {
          minDistanceKm: IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM,
          minSpeedKmh: IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH,
        },
      },
    });

    this.logger.warn(`Impossible traveler alert created for user=${newLog.user}, speed=${speedKmh.toFixed(1)} km/h`);
  }

  private extractGeoPoint(log: Log): { latitude: number; longitude: number } | undefined {
    const raw = this.readRecord(log.raw);
    const topLevelLat = this.readNumber(log.latitude);
    const topLevelLon = this.readNumber(log.longitude);

    if (
      topLevelLat !== undefined &&
      topLevelLon !== undefined &&
      topLevelLat >= -90 &&
      topLevelLat <= 90 &&
      topLevelLon >= -180 &&
      topLevelLon <= 180
    ) {
      return { latitude: topLevelLat, longitude: topLevelLon };
    }

    const lat =
      this.readNumber(raw?.latitude) ??
      this.readNumber(raw?.lat) ??
      this.readNumber(this.readRecord(raw?.geo)?.latitude) ??
      this.readNumber(this.readRecord(raw?.geo)?.lat) ??
      this.readNumber(this.readRecord(raw?.location)?.latitude) ??
      this.readNumber(this.readRecord(raw?.location)?.lat) ??
      this.readNumber(this.readRecord(this.readRecord(raw?.parsed)?.geo)?.latitude) ??
      this.readNumber(this.readRecord(this.readRecord(raw?.parsed)?.geo)?.lat);

    const lon =
      this.readNumber(raw?.longitude) ??
      this.readNumber(raw?.lon) ??
      this.readNumber(this.readRecord(raw?.geo)?.longitude) ??
      this.readNumber(this.readRecord(raw?.geo)?.lon) ??
      this.readNumber(this.readRecord(raw?.location)?.longitude) ??
      this.readNumber(this.readRecord(raw?.location)?.lon) ??
      this.readNumber(this.readRecord(this.readRecord(raw?.parsed)?.geo)?.longitude) ??
      this.readNumber(this.readRecord(this.readRecord(raw?.parsed)?.geo)?.lon);

    if (lat === undefined || lon === undefined) {
      return undefined;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return undefined;
    }

    return { latitude: lat, longitude: lon };
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}

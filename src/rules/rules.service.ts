import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log } from '../logs/log.schema';
import { AlertsService } from '../alerts/alerts.service';
import { FAILED_LOGIN_EVENT_NAMES, RULE_ID_FAILED_LOGINS } from './rules.constants';

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    private readonly alertsService: AlertsService,
  ) {}

  // Evaluate rules for a newly ingested log
  async evaluate(newLog: Log): Promise<void> {
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
}

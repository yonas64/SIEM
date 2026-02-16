import { Injectable } from '@nestjs/common';
import { CreateLogDto } from '../log.dto';
import { NormalizedLog, Severity } from '../log.types';
import { LogParser } from './log-parser.interface';

@Injectable()
export class NginxLogParser implements LogParser {
  private readonly combinedRegex =
    /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"]+?)\s+HTTP\/[\d.]+"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"$/;

  private readonly commonRegex =
    /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"]+?)\s+HTTP\/[\d.]+"\s+(\d{3})\s+(\d+|-)$/;

  canParse(dto: CreateLogDto): boolean {
    const source = this.readString(dto.source)?.toLowerCase();
    if (source?.includes('nginx')) return true;

    const line = this.readLine(dto);
    if (!line) return false;

    return this.combinedRegex.test(line) || this.commonRegex.test(line);
  }

  parse(dto: CreateLogDto): NormalizedLog[] {
    const line = this.readLine(dto);
    if (!line) return [];

    const match = line.match(this.combinedRegex) ?? line.match(this.commonRegex);
    if (!match) return [];

    const ip = match[1];
    const timestamp = this.parseNginxTimestamp(match[2]) ?? this.parseDate(dto.timestamp) ?? new Date();
    const method = match[3];
    const path = match[4];
    const statusCode = Number(match[5]);
    const bytesRaw = match[6];
    const referer = match[7];
    const userAgent = match[8];

    const severity = this.mapSeverity(statusCode);
    const source = this.readString(dto.source) ?? 'nginx';
    const event = `nginx_access_${Math.floor(statusCode / 100)}xx`;
    const user = this.readString(dto.user);
    const geo = this.extractGeoFromDto(dto);

    const raw: Record<string, unknown> = {
      ...dto,
      parsed: {
        format: 'nginx_access',
        method,
        path,
        statusCode,
        bytes: bytesRaw === '-' ? undefined : Number(bytesRaw),
        referer: referer || undefined,
        userAgent: userAgent || undefined,
      },
    };

    return [{ timestamp, source, severity, event, user, ip, latitude: geo?.latitude, longitude: geo?.longitude, raw }];
  }

  private mapSeverity(statusCode: number): Severity {
    if (!Number.isFinite(statusCode)) return 'low';
    if (statusCode >= 500) return 'high';
    if (statusCode >= 400) return 'medium';
    return 'low';
  }

  private parseNginxTimestamp(value: string): Date | undefined {
    // Example: 10/Oct/2000:13:55:36 -0700
    const m = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+\-]\d{4})$/);
    if (!m) return undefined;

    const [, day, month, year, hour, minute, second, zone] = m;
    const parsed = new Date(`${day} ${month} ${year} ${hour}:${minute}:${second} ${zone}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseDate(value: unknown): Date | undefined {
    const str = this.readString(value);
    if (!str) return undefined;
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private readLine(dto: CreateLogDto): string | undefined {
    const dtoAny = dto as Record<string, unknown>;
    return (
      this.readString(dtoAny.message) ??
      this.readString(dtoAny.log) ??
      this.readString(dtoAny.line) ??
      this.readString(dtoAny.rawLine)
    );
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private extractGeoFromDto(dto: CreateLogDto): { latitude: number; longitude: number } | undefined {
    const dtoAny = dto as Record<string, unknown>;
    const geo = this.readRecord(dtoAny.geo);
    const location = this.readRecord(dtoAny.location);

    const latitude =
      this.readNumber(dtoAny.latitude) ??
      this.readNumber(dtoAny.lat) ??
      this.readNumber(geo?.latitude) ??
      this.readNumber(geo?.lat) ??
      this.readNumber(location?.latitude) ??
      this.readNumber(location?.lat);

    const longitude =
      this.readNumber(dtoAny.longitude) ??
      this.readNumber(dtoAny.lon) ??
      this.readNumber(geo?.longitude) ??
      this.readNumber(geo?.lon) ??
      this.readNumber(location?.longitude) ??
      this.readNumber(location?.lon);

    if (latitude === undefined || longitude === undefined) {
      return undefined;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return undefined;
    }

    return { latitude, longitude };
  }
}

import { Injectable } from '@nestjs/common';
import { CreateLogDto } from '../log.dto';
import { NormalizedLog, Severity } from '../log.types';
import { LogParser } from './log-parser.interface';

@Injectable()
export class SyslogLogParser implements LogParser {
  private readonly rfc5424Regex =
    /^<(\d{1,3})>(\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+((?:\[[^\]]*])+|-)\s*(.*)$/;

  private readonly rfc3164Regex =
    /^(?:<(\d{1,3})>)?([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^\s:\[]+)(?:\[(\d+)\])?:\s*(.*)$/;

  canParse(dto: CreateLogDto): boolean {
    const source = this.readString(dto.source)?.toLowerCase();
    if (source?.includes('syslog')) return true;

    const line = this.readLine(dto);
    if (!line) return false;
    if (line.startsWith('<') && line.includes('>')) return true;

    return this.rfc3164Regex.test(line);
  }

  parse(dto: CreateLogDto): NormalizedLog[] {
    const line = this.readLine(dto);
    if (!line) return [];

    const parsed5424 = this.parseRfc5424(line);
    if (parsed5424) return [this.toNormalized(dto, parsed5424)];

    const parsed3164 = this.parseRfc3164(line);
    if (parsed3164) return [this.toNormalized(dto, parsed3164)];

    const fallback = this.parsePriOnly(line);
    return [this.toNormalized(dto, fallback)];
  }

  private toNormalized(dto: CreateLogDto, parsed: ParsedSyslog): NormalizedLog {
    const source = this.readString(dto.source) ?? 'syslog';
    const timestamp = parsed.timestamp ?? this.parseDate(dto.timestamp) ?? new Date();
    const severity = this.priorityToSeverity(parsed.priority);
    const event = parsed.app ? `syslog_${this.normalizeToken(parsed.app)}` : 'syslog_message';
    const user = this.readString(dto.user);
    const ip = this.readString(dto.ip) ?? (this.isIp(parsed.host) ? parsed.host : undefined);
    const geo = this.extractGeoFromDto(dto);

    const raw: Record<string, unknown> = {
      ...dto,
      parsed: {
        format: parsed.format,
        priority: parsed.priority,
        facility: parsed.facility,
        severityCode: parsed.severityCode,
        version: parsed.version,
        host: parsed.host,
        app: parsed.app,
        processId: parsed.processId,
        messageId: parsed.messageId,
        message: parsed.message,
      },
    };

    return { timestamp, source, severity, event, user, ip, latitude: geo?.latitude, longitude: geo?.longitude, raw };
  }

  private parseRfc5424(line: string): ParsedSyslog | undefined {
    const m = line.match(this.rfc5424Regex);
    if (!m) return undefined;

    const priority = Number(m[1]);
    const version = m[2];
    const timestamp = m[3] === '-' ? undefined : this.parseDate(m[3]);
    const host = m[4] === '-' ? undefined : m[4];
    const app = m[5] === '-' ? undefined : m[5];
    const processId = m[6] === '-' ? undefined : m[6];
    const messageId = m[7] === '-' ? undefined : m[7];
    const structuredData = m[8];
    const message = m[9] || undefined;

    return this.buildParsed({
      format: 'syslog_rfc5424',
      priority,
      version,
      timestamp,
      host,
      app,
      processId,
      messageId,
      message: this.stripStructuredDataPrefix(structuredData, message),
    });
  }

  private parseRfc3164(line: string): ParsedSyslog | undefined {
    const m = line.match(this.rfc3164Regex);
    if (!m) return undefined;

    const priority = m[1] ? Number(m[1]) : 13;
    const tsWithoutYear = m[2];
    const host = m[3];
    const app = m[4];
    const processId = m[5];
    const message = m[6] || undefined;

    const timestamp = this.parseDateWithCurrentYear(tsWithoutYear);

    return this.buildParsed({
      format: 'syslog_rfc3164',
      priority,
      timestamp,
      host,
      app,
      processId,
      message,
    });
  }

  private parsePriOnly(line: string): ParsedSyslog {
    const m = line.match(/^<(\d{1,3})>(.*)$/);
    const priority = m ? Number(m[1]) : 13;
    const message = (m ? m[2] : line).trim();

    return this.buildParsed({
      format: 'syslog_unknown',
      priority,
      message: message || undefined,
    });
  }

  private buildParsed(input: {
    format: string;
    priority: number;
    version?: string;
    timestamp?: Date;
    host?: string;
    app?: string;
    processId?: string;
    messageId?: string;
    message?: string;
  }): ParsedSyslog {
    const priority = Number.isFinite(input.priority) ? input.priority : 13;
    return {
      ...input,
      priority,
      facility: Math.floor(priority / 8),
      severityCode: priority % 8,
    };
  }

  private priorityToSeverity(priority: number): Severity {
    const severityCode = Number.isFinite(priority) ? priority % 8 : 6;
    if (severityCode <= 1) return 'critical';
    if (severityCode <= 3) return 'high';
    if (severityCode <= 5) return 'medium';
    return 'low';
  }

  private parseDate(value: unknown): Date | undefined {
    const str = this.readString(value);
    if (!str) return undefined;
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseDateWithCurrentYear(value: string): Date | undefined {
    const now = new Date();
    const parsed = new Date(`${value} ${now.getFullYear()}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private normalizeToken(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'message';
  }

  private isIp(value?: string): boolean {
    if (!value) return false;
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /:/;
    return ipv4.test(value) || ipv6.test(value);
  }

  private stripStructuredDataPrefix(structuredData: string, message?: string): string | undefined {
    if (!message) return undefined;
    if (structuredData === '-' || structuredData.startsWith('[')) return message.trim() || undefined;
    return `${structuredData} ${message}`.trim() || undefined;
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

interface ParsedSyslog {
  format: string;
  priority: number;
  facility: number;
  severityCode: number;
  version?: string;
  timestamp?: Date;
  host?: string;
  app?: string;
  processId?: string;
  messageId?: string;
  message?: string;
}

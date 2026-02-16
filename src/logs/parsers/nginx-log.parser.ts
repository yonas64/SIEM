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

    return [{ timestamp, source, severity, event, user, ip, raw }];
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
}


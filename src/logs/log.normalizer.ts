import { Injectable } from '@nestjs/common';
import { CreateLogDto } from './log.dto';
import { NormalizedLog, Severity } from './log.types';

@Injectable()
export class LogNormalizer {
  // Normalizes incoming data to the standard format used for storage
  normalize(dto: CreateLogDto): NormalizedLog[] {
    const rawEvents = this.extractRawEvents(dto);
    if (rawEvents.length === 0) {
      return [this.normalizeSingle(dto)];
    }

    return rawEvents.map((rawEvent) => this.normalizeFromRawEvent(dto, rawEvent));
  }

  private normalizeSeverity(value?: string): Severity {
    const v = (value || '').toLowerCase();
    if (v === 'critical') return 'critical';
    if (v === 'high') return 'high';
    if (v === 'medium') return 'medium';
    return 'low';
  }

  private normalizeEvent(value?: string): string | undefined {
    if (!value) return undefined;
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  private normalizeSingle(dto: CreateLogDto): NormalizedLog {
    const timestamp = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const source = typeof dto.source === 'string' && dto.source.trim() !== '' ? dto.source : 'unknown';
    const severity = this.normalizeSeverity(dto.severity);
    const event = this.normalizeEvent(this.readString(dto.event)) ?? 'unknown';
    const user = typeof dto.user === 'string' && dto.user.trim() !== '' ? dto.user : undefined;
    const ip = typeof dto.ip === 'string' && dto.ip.trim() !== '' ? dto.ip : undefined;

    const raw: Record<string, unknown> = { ...dto };
    return { timestamp, source, severity, event, user, ip, raw };
  }

  private normalizeFromRawEvent(dto: CreateLogDto, rawEvent: Record<string, unknown>): NormalizedLog {
    const eventTimestamp = this.readString(rawEvent.ts);
    const eventLevel = this.readString(rawEvent.level);
    const eventName = this.readString(rawEvent.event);

    const context = this.readRecord(rawEvent.context);
    const contextEmail = this.readString(context?.email);
    const contextUser = this.readString(context?.user);
    const contextIp = this.readString(context?.clientIp);

    const timestamp = eventTimestamp ? new Date(eventTimestamp) : dto.timestamp ? new Date(dto.timestamp) : new Date();
    const source = typeof dto.source === 'string' && dto.source.trim() !== '' ? dto.source : 'unknown';
    const severity = this.normalizeSeverity(eventLevel || dto.severity);
    const event = this.normalizeEvent(eventName) ?? this.normalizeEvent(this.readString(dto.event)) ?? 'unknown';
    const user =
      typeof dto.user === 'string' && dto.user.trim() !== '' ? dto.user : contextEmail || contextUser || undefined;
    const ip = typeof dto.ip === 'string' && dto.ip.trim() !== '' ? dto.ip : contextIp || undefined;

    const raw: Record<string, unknown> = { ...dto, rawEvent };
    return { timestamp, source, severity, event, user, ip, raw };
  }

  private extractRawEvents(dto: CreateLogDto): Record<string, unknown>[] {
    const dtoAny = dto as Record<string, unknown>;
    const raw = this.readRecord(dtoAny.raw);
    const rawEvents = this.readArray(raw?.events);
    const topLevelEvents = this.readArray(dtoAny.events);

    const events = rawEvents.length > 0 ? rawEvents : topLevelEvents;
    return events.filter((event): event is Record<string, unknown> => this.isRecord(event));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    return this.isRecord(value) ? value : undefined;
  }

  private readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
}

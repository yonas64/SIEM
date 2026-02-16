import { Inject, Injectable } from '@nestjs/common';
import { CreateLogDto } from './log.dto';
import { NormalizedLog } from './log.types';
import { LOG_PARSERS, LogParser } from './parsers/log-parser.interface';

@Injectable()
export class LogNormalizer {
  constructor(@Inject(LOG_PARSERS) private readonly parsers: LogParser[]) {}

  // Selects the first matching parser; keep specific parsers before generic fallback.
  normalize(dto: CreateLogDto): NormalizedLog[] {
    for (const parser of this.parsers) {
      if (!parser.canParse(dto)) continue;
      const parsed = parser.parse(dto);
      if (parsed.length > 0) return parsed;
    }

    return [];
  }
}

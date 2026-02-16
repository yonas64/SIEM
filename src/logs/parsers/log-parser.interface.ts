import { CreateLogDto } from '../log.dto';
import { NormalizedLog } from '../log.types';

export const LOG_PARSERS = 'LOG_PARSERS';

export interface LogParser {
  canParse(dto: CreateLogDto): boolean;
  parse(dto: CreateLogDto): NormalizedLog[];
}


import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Log } from './log.schema';
import { CreateLogDto } from './log.dto';
import { LogNormalizer } from './log.normalizer';
import { RulesService } from '../rules/rules.service';

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    private readonly normalizer: LogNormalizer,
    private readonly rulesService: RulesService,
  ) {}

  // Ingest log, normalize, store, then run rules
  async ingest(dto: CreateLogDto): Promise<Log | Log[]> {
    const normalized = this.normalizer.normalize(dto);
    const created = await this.logModel.create(normalized);
    const createdLogs = Array.isArray(created) ? created : [created];

    // Rule engine can be async and best-effort
    await Promise.all(createdLogs.map((log) => this.rulesService.evaluate(log)));

    return Array.isArray(created) ? created : createdLogs[0];
  }

  async list(): Promise<Log[]> {
    return this.logModel.find().sort({ timestamp: -1 }).limit(100).exec();
  }

  // Clear all logs from the database
  async clearAll(): Promise<{ deletedCount: number }> {
    const result = await this.logModel.deleteMany({});
    return { deletedCount: result.deletedCount ?? 0 };
  }
}

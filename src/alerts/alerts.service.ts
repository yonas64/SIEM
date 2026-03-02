import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Alert } from './alert.schema';

@Injectable()
export class AlertsService {
  constructor(@InjectModel(Alert.name) private readonly alertModel: Model<Alert>) {}

  async create(data: Partial<Alert>): Promise<Alert> {
    return this.alertModel.create(data);
  }

  async list(): Promise<Alert[]> {
    return this.alertModel.find().sort({ triggeredAt: -1 }).exec();
  }

  // Clear all alerts from the database
  async clearAll(): Promise<{ deletedCount: number }> {
    const result = await this.alertModel.deleteMany({});
    return { deletedCount: result.deletedCount ?? 0 };
  }
}

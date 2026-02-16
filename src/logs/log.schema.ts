import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Severity } from './log.types';

@Schema({ timestamps: false })
export class Log extends Document {
  @Prop({ type: Date, required: true })
  timestamp!: Date;

  @Prop({ type: String, required: true, index: true })
  source!: string;

  @Prop({ type: String, required: true, index: true })
  severity!: Severity;

  @Prop({ type: String, required: true, index: true })
  event!: string;

  @Prop({ type: String, required: false, index: true })
  user?: string;

  @Prop({ type: String, required: false, index: true })
  ip?: string;

  @Prop({ type: Number, required: false, index: true })
  latitude?: number;

  @Prop({ type: Number, required: false, index: true })
  longitude?: number;

  @Prop({ type: Object, required: false })
  raw?: Record<string, unknown>;
}

export const LogSchema = SchemaFactory.createForClass(Log);

// Helpful index for rule lookup by ip + timestamp
LogSchema.index({ ip: 1, timestamp: -1 });
// Helpful index for rules that analyze user login timelines
LogSchema.index({ user: 1, event: 1, timestamp: -1 });
// Helpful index for geo-based detections and investigations
LogSchema.index({ latitude: 1, longitude: 1, timestamp: -1 });

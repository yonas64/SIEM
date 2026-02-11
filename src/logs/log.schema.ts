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

  @Prop({ type: Object, required: false })
  raw?: Record<string, unknown>;
}

export const LogSchema = SchemaFactory.createForClass(Log);

// Helpful index for rule lookup by ip + timestamp
LogSchema.index({ ip: 1, timestamp: -1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Alert extends Document {
  @Prop({ type: String, required: true, index: true })
  ruleId!: string;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: String, required: true, index: true })
  severity!: string;

  @Prop({ type: String, required: false, index: true })
  ip?: string;

  @Prop({ type: Date, required: true })
  triggeredAt!: Date;

  @Prop({ type: Object, required: false })
  context?: Record<string, unknown>;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RulesService } from './rules.service';
import { Log, LogSchema } from '../logs/log.schema';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }]),
    AlertsModule,
  ],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}

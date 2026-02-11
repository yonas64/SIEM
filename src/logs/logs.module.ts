import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { Log, LogSchema } from './log.schema';
import { LogNormalizer } from './log.normalizer';
import { RulesModule } from '../rules/rules.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }]),
    RulesModule,
  ],
  controllers: [LogsController],
  providers: [LogsService, LogNormalizer],
  exports: [MongooseModule],
})
export class LogsModule {}

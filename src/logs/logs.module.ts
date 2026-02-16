import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { Log, LogSchema } from './log.schema';
import { LogNormalizer } from './log.normalizer';
import { RulesModule } from '../rules/rules.module';
import { LOG_PARSERS } from './parsers/log-parser.interface';
import { NginxLogParser } from './parsers/nginx-log.parser';
import { SyslogLogParser } from './parsers/syslog-log.parser';
import { GenericLogParser } from './parsers/generic-log.parser';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }]),
    RulesModule,
  ],
  controllers: [LogsController],
  providers: [
    LogsService,
    LogNormalizer,
    NginxLogParser,
    SyslogLogParser,
    GenericLogParser,
    {
      provide: LOG_PARSERS,
      useFactory: (nginx: NginxLogParser, syslog: SyslogLogParser, generic: GenericLogParser) => [
        nginx,
        syslog,
        generic,
      ],
      inject: [NginxLogParser, SyslogLogParser, GenericLogParser],
    },
  ],
  exports: [MongooseModule],
})
export class LogsModule {}

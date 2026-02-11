import { Body, Controller, Get, Post } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto } from './log.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  // POST /api/logs
  @Post()
  async ingest(@Body() dto: CreateLogDto) {
    return this.logsService.ingest(dto);
  }

  // GET /api/logs
  @Get()
  async list() {
    return this.logsService.list();
  }
}

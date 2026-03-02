import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
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

  // DELETE /api/logs
  @Delete()
  async clear() {
    return this.logsService.clearAll();
  }
}

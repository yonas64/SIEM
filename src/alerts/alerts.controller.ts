import { Controller, Delete, Get } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // GET /api/alerts
  @Get()
  async list() {
    return this.alertsService.list();
  }

  // DELETE /api/alerts
  @Delete()
  async clear() {
    return this.alertsService.clearAll();
  }
}

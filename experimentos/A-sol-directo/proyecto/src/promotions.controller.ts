import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import { adminQuery, commercialQuery, uuid, validateBatch, validateInput } from './validation.js';

@Controller('promociones')
export class PromotionsController {
  constructor(@Inject(PromotionsService) private readonly service: PromotionsService) {}
  @Post()
  create(@Body() body: unknown) { return this.service.create(validateInput(body)); }
  @Post('lote')
  batch(@Body() body: unknown) { return this.service.batch(validateBatch(body)); }
  @Get('administracion')
  admin(@Query() query: unknown) { return this.service.admin(adminQuery(query)); }
  @Get()
  commercial(@Query() query: unknown) { return this.service.commercial(commercialQuery(query)); }
  @Get(':promocionId')
  get(@Param('promocionId') id: string) { return this.service.get(uuid(id)); }
  @Patch(':promocionId')
  patch(@Param('promocionId') id: string, @Body() body: unknown) { return this.service.patch(uuid(id), body); }
  @Delete(':promocionId')
  @HttpCode(204)
  async remove(@Param('promocionId') id: string) { await this.service.remove(uuid(id)); }
}

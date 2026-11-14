import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { adminQuery, commercialQuery, uuid, validateBatch, validatePatch, validatePromotion } from './domain.js';
import { PromotionsRepository } from './promotions.repository.js';

@Controller('promociones')
export class PromotionsController {
  constructor(@Inject(PromotionsRepository) private readonly promotions: PromotionsRepository) {}
  @Post()
  create(@Body() body: unknown) { return this.promotions.create(validatePromotion(body)); }

  @Post('lote')
  batch(@Body() body: unknown) { return this.promotions.createBatch(validateBatch(body)); }

  @Get('administracion')
  administration(@Query() query: unknown) { return this.promotions.listAdmin(adminQuery(query)); }

  @Get()
  commercial(@Query() query: unknown) { return this.promotions.listCommercial(commercialQuery(query)); }

  @Get(':promocionId')
  get(@Param('promocionId') id: string) { return this.promotions.get(uuid(id)); }

  @Patch(':promocionId')
  patch(@Param('promocionId') id: string, @Body() body: unknown) {
    const validId = uuid(id);
    return this.promotions.patch(validId, validatePatch(body));
  }

  @Delete(':promocionId')
  @HttpCode(204)
  async remove(@Param('promocionId') id: string) { await this.promotions.remove(uuid(id)); }
}

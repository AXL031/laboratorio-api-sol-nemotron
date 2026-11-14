import { Module } from '@nestjs/common';
import { PromocionesController } from './promociones.controller.js';
import { PromocionesService } from './promociones.service.js';

@Module({
  controllers: [PromocionesController],
  providers: [PromocionesService],
  exports: [PromocionesService],
})
export class PromocionesModule {}

import { Module } from '@nestjs/common';
import { PromocionesController } from './promociones.controller.js';
import { PromocionesService } from './promociones.service.js';
import { PromocionesRepository } from './promociones.repository.js';

@Module({
  controllers: [PromocionesController],
  providers: [
    PromocionesService,
    {
      provide: PromocionesRepository,
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error('DATABASE_URL no está definido en el entorno');
        }
        return new PromocionesRepository(url);
      },
    },
  ],
  exports: [PromocionesService, PromocionesRepository],
})
export class PromocionesModule {}
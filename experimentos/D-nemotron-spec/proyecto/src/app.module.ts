import { Module } from '@nestjs/common';
import { PromocionesModule } from './promociones/promociones.module.js';

@Module({
  imports: [PromocionesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

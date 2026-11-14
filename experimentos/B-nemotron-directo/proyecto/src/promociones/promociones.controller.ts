import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { AdminGuard, LectorOAdminGuard } from '../common/auth.guard.js';
import { PromocionesService } from './promociones.service.js';
import {
  validateQueryCanal,
  parseBooleanQuery,
  parseIntegerQuery,
  validateEstadoQuery,
  validateModalidadQuery,
} from '../common/validators.js';

@Controller('promociones')
export class PromocionesController {
  constructor(private readonly promocionesService: PromocionesService) {}

  @Post()
  @AdminGuard()
  async crearPromocion(@Body() body: unknown, @Headers() headers: Record<string, string>) {
    const actorRole = this.getActorRole(headers);
    return this.promocionesService.crearPromocion(body, actorRole);
  }

  @Post('lote')
  @AdminGuard()
  async crearPromocionesLote(@Body() body: unknown, @Headers() headers: Record<string, string>) {
    const actorRole = this.getActorRole(headers);
    return this.promocionesService.crearPromocionesLote(body, actorRole);
  }

  @Get()
  @LectorOAdminGuard()
  async listarPromociones(
    @Query() query: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    const actorRole = this.getActorRole(headers);

    const canal = validateQueryCanal(query.canal);
    const vigentes = parseBooleanQuery(query.vigentes, true);
    const estado = validateEstadoQuery(query.estado) ?? 'ACTIVO';

    return this.promocionesService.listarPromocionesComerciales(canal, vigentes, estado, actorRole);
  }

  @Get('administracion')
  @LectorOAdminGuard()
  async listarPromocionesAdmin(
    @Query() query: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    const actorRole = this.getActorRole(headers);

    const pagina = parseIntegerQuery(query.pagina, 1, 1, 100);
    const tamanio = parseIntegerQuery(query.tamanio, 20, 1, 100);
    const estado = validateEstadoQuery(query.estado);
    const modalidad = validateModalidadQuery(query.modalidad);

    return this.promocionesService.listarPromocionesAdmin(
      pagina, tamanio, estado, modalidad, actorRole,
    );
  }

  @Get(':promocionId')
  @LectorOAdminGuard()
  async obtenerPromocionAdmin(
    @Param('promocionId') promocionId: string,
    @Headers() headers: Record<string, string>,
  ) {
    const actorRole = this.getActorRole(headers);
    return this.promocionesService.obtenerPromocionAdmin(promocionId, actorRole);
  }

  @Patch(':promocionId')
  @AdminGuard()
  async actualizarPromocion(
    @Param('promocionId') promocionId: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ) {
    const actorRole = this.getActorRole(headers);
    return this.promocionesService.actualizarPromocion(promocionId, body, actorRole);
  }

  @Delete(':promocionId')
  @HttpCode(204)
  @AdminGuard()
  async eliminarPromocion(
    @Param('promocionId') promocionId: string,
    @Headers() headers: Record<string, string>,
  ): Promise<void> {
    const actorRole = this.getActorRole(headers);
    await this.promocionesService.eliminarPromocion(promocionId, actorRole);
  }

  private getActorRole(headers: Record<string, string>): 'ADMIN' | 'LECTOR_O_ADMIN' {
    const authHeader = headers.authorization || headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return 'LECTOR_O_ADMIN';
    }
    const token = authHeader.substring(7).trim();
    const adminToken = process.env.LAB_ADMIN_TOKEN;
    if (adminToken && token === adminToken) {
      return 'ADMIN';
    }
    return 'LECTOR_O_ADMIN';
  }
}
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseFilters,
} from '@nestjs/common';
import { PromocionesService } from './promociones.service.js';
import {
  validarPromocionCreate,
  validarPromocionPatch,
  validarLoteCreate,
  validarUuid,
} from '../common/validation.js';
import { ProblemError } from '../common/problem.js';
import { ProblemExceptionFilter } from '../common/problem-exception.filter.js';
import type { PromocionAdminOutput } from '../common/validation.js';

/**
 * Controlador de las 7 operaciones del API de Promociones.
 * Rutas con prefijo /api/v1 (configurado en main.ts).
 * Auth: Bearer token estático verificado por AuthMiddleware (global).
 *
 * IMPORTANTE: las rutas estáticas (/lote, /administracion) se declaran
 * ANTES que la ruta parametrizada (/{promocionId}) para que Express no las
 * confunda con un parámetro de ruta.
 */

@UseFilters(ProblemExceptionFilter)
@Controller('promociones')
export class PromocionesController {
  constructor(private readonly promocionesService: PromocionesService) {}

  // O01: POST /api/v1/promociones — Crear una promoción (ADMIN)
  @Post()
  async crear(@Body() body: unknown): Promise<PromocionAdminOutput> {
    const input = validarPromocionCreate(body);
    return this.promocionesService.crearPromocion(input);
  }

  // O02: POST /api/v1/promociones/lote — Crear por lote (ADMIN)
  @Post('lote')
  async crearLote(@Body() body: unknown): Promise<{ items: PromocionAdminOutput[] }> {
    const items = validarLoteCreate(body);
    const resultados = await this.promocionesService.crearPromocionesLote(items);
    return { items: resultados };
  }

  // O05: GET /api/v1/promociones — Consulta comercial (LECTOR_O_ADMIN)
  @Get()
  async listarComerciales(
    @Query('canal') canal: unknown,
    @Query('vigentes') vigentes: unknown,
    @Query('estado') estado: unknown,
  ): Promise<{ items: Awaited<ReturnType<PromocionesService['listarPromocionesComerciales']>> }> {
    if (typeof canal !== 'string') {
      throw new ProblemError(
        400,
        'VALIDACION',
        'El parámetro de consulta canal es obligatorio',
      );
    }

    const estadoStr = typeof estado === 'string' ? estado : 'ACTIVO';
    if (estadoStr !== 'ACTIVO' && estadoStr !== 'INACTIVO') {
      throw new ProblemError(
        400,
        'VALIDACION',
        'estado debe ser ACTIVO o INACTIVO',
      );
    }

    const vigentesBool = vigentes === undefined ? true : vigentes === 'true';
    const items = await this.promocionesService.listarPromocionesComerciales({
      canal,
      vigentes: vigentesBool,
      estado: estadoStr as 'ACTIVO' | 'INACTIVO',
    });
    return { items };
  }

  // O06: GET /api/v1/promociones/administracion — Listado paginado (LECTOR_O_ADMIN)
  @Get('administracion')
  async listarAdmin(
    @Query('pagina') pagina: unknown,
    @Query('tamanio') tamanio: unknown,
    @Query('estado') estado: unknown,
    @Query('modalidad') modalidad: unknown,
  ): Promise<{ items: any[]; meta: any }> {
    const paginaNum = pagina !== undefined ? parseInt(String(pagina), 10) : 1;
    const tamanioNum = tamanio !== undefined ? parseInt(String(tamanio), 10) : 20;

    if (!Number.isInteger(paginaNum) || paginaNum < 1) {
      throw new ProblemError(400, 'VALIDACION', 'pagina debe ser un entero >= 1');
    }
    if (!Number.isInteger(tamanioNum) || tamanioNum < 1 || tamanioNum > 100) {
      throw new ProblemError(400, 'VALIDACION', 'tamanio debe ser un entero entre 1 y 100');
    }

    const estadoStr = typeof estado === 'string' ? (estado as 'ACTIVO' | 'INACTIVO') : undefined;
    if (estadoStr && estadoStr !== 'ACTIVO' && estadoStr !== 'INACTIVO') {
      throw new ProblemError(400, 'VALIDACION', 'estado debe ser ACTIVO o INACTIVO');
    }

    const modalidadStr = typeof modalidad === 'string' ? (modalidad as 'AUTOMATICA' | 'CUPON') : undefined;
    if (modalidadStr && modalidadStr !== 'AUTOMATICA' && modalidadStr !== 'CUPON') {
      throw new ProblemError(400, 'VALIDACION', 'modalidad debe ser AUTOMATICA o CUPON');
    }

    const resultado = await this.promocionesService.listarPromocionesAdmin({
      pagina: paginaNum,
      tamanio: tamanioNum,
      estado: estadoStr,
      modalidad: modalidadStr,
    });

    return {
      items: resultado.items,
      meta: {
        pagina: paginaNum,
        tamanio: tamanioNum,
        total: resultado.total,
        totalPaginas: resultado.totalPaginas,
      },
    };
  }

  // O07: GET /api/v1/promociones/{promocionId} — Detalle administrativo (LECTOR_O_ADMIN)
  @Get(':promocionId')
  async obtener(@Param('promocionId') promocionId: string): Promise<PromocionAdminOutput> {
    const id = validarUuid(promocionId, 'promocionId');
    return this.promocionesService.obtenerPromocionAdmin(id);
  }

  // O03: PATCH /api/v1/promociones/{promocionId} — Modificar parcialmente (ADMIN)
  @Patch(':promocionId')
  async actualizar(
    @Param('promocionId') promocionId: string,
    @Body() body: unknown,
  ): Promise<PromocionAdminOutput> {
    const id = validarUuid(promocionId, 'promocionId');
    const patch = validarPromocionPatch(body);
    return this.promocionesService.actualizarPromocion(id, patch);
  }

  // O04: DELETE /api/v1/promociones/{promocionId} — Eliminación lógica (ADMIN)
  @Delete(':promocionId')
  @HttpCode(204)
  async eliminar(@Param('promocionId') promocionId: string): Promise<void> {
    const id = validarUuid(promocionId, 'promocionId');
    await this.promocionesService.eliminarPromocion(id);
  }
}

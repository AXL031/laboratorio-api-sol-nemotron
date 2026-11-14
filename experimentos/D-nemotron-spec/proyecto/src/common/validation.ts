import { ProblemError, ErrorCode } from './problem.js';

export { ProblemError, ErrorCode };

const CHANNELS = ['MARKETPLACE', 'CHATBOT', 'RETAIL', 'VENTAS'] as const;
type Channel = (typeof CHANNELS)[number];

const MODALITIES = ['AUTOMATICA', 'CUPON'] as const;
type Modality = (typeof MODALITIES)[number];

const STATES = ['ACTIVO', 'INACTIVO'] as const;
type State = (typeof STATES)[number];

const DISCOUNT_TYPES = ['PORCENTAJE', 'MONTO_FIJO'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface AlcanceInput {
  productIds?: string[];
  skus?: string[];
}

export interface PoliticaCombinacionInput {
  ofertaPricing: boolean;
  promocionAutomatica: boolean;
  cupon: boolean;
}

export interface PromocionCreateInput {
  nombre: string;
  tipoDescuento: DiscountType;
  valor: number;
  modalidad: Modality;
  estado: State;
  validFrom: string;
  validUntil: string;
  alcance: AlcanceInput;
  prioridad: number;
  canalesHabilitados: Channel[];
  politicaCombinacion: PoliticaCombinacionInput;
}

export interface PromocionPatchInput {
  nombre?: string;
  tipoDescuento?: DiscountType;
  valor?: number;
  modalidad?: Modality;
  estado?: State;
  validFrom?: string;
  validUntil?: string;
  alcance?: AlcanceInput;
  prioridad?: number;
  canalesHabilitados?: Channel[];
  politicaCombinacion?: PoliticaCombinacionInput;
}

export interface PromocionAdminOutput {
  promotionId: string;
  nombre: string;
  tipoDescuento: DiscountType;
  valor: number;
  modalidad: Modality;
  estado: State;
  validFrom: string;
  validUntil: string;
  alcance: AlcanceInput;
  prioridad: number;
  canalesHabilitados: Channel[];
  politicaCombinacion: PoliticaCombinacionInput;
  puedeCambiarModalidad: boolean;
}

export interface PromocionResumenOutput {
  promotion_id: string;
  name: string;
  status: 'ACTIVA' | 'INACTIVA';
  valid_from: string;
  valid_until: string;
  channels: Channel[];
}

/**
 * Valida que un valor sea un número finito y mayor que 0.
 */
export function validarValorFinitoPositivo(valor: unknown, campo = 'valor'): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} debe ser un número finito`);
  }
  if (valor <= 0) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} debe ser mayor que 0`);
  }
  return valor;
}

/**
 * Valida que una cadena no esté vacía ni sea solo espacios.
 */
export function validarNombreTexto(texto: unknown, campo = 'nombre', maxLen = 160): string {
  if (typeof texto !== 'string') {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} debe ser una cadena`);
  }
  const trimmed = texto.trim();
  if (trimmed.length === 0) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} no puede estar vacío ni solo espacios`);
  }
  if (texto.length > maxLen) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} excede los ${maxLen} caracteres`);
  }
  return texto;
}

/**
 * Valida un string ISO 8601 con zona horaria.
 */
export function validarFechaHoraConZona(texto: unknown, campo = 'fecha'): Date {
  if (typeof texto !== 'string') {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} debe ser una cadena ISO 8601`);
  }
  const fecha = new Date(texto);
  if (isNaN(fecha.getTime())) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} no es una fecha ISO 8601 válida`);
  }
  // Verificar que incluya zona horaria (Z o ±HH:MM)
  const tieneZona = /([+-]\d{2}:?\d{2}|Z)$/i.test(texto);
  if (!tieneZona) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `El campo ${campo} debe incluir zona horaria (ISO 8601)`);
  }
  return fecha;
}

/**
 * Valida un UUID.
 */
export function validarUuid(id: unknown, campo = 'id'): string {
  if (typeof id !== 'string') {
    throw new ProblemError(400, ErrorCode.VALIDACION, `El campo ${campo} debe ser un UUID`);
  }
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(id)) {
    throw new ProblemError(400, ErrorCode.VALIDACION, `El campo ${campo} no es un UUID válido`);
  }
  return id;
}

/**
 * Valida que un valor de canal pertenezca al enum contractual.
 */
export function validarCanal(canal: unknown): Channel {
  if (typeof canal !== 'string' || !CHANNELS.includes(canal as Channel)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, `Canal no válido: ${String(canal)}`);
  }
  return canal as Channel;
}

/**
 * Valida la lista de canales habilitados: no vacía, sin duplicados, valores válidos.
 */
export function validarCanalesHabilitados(canales: unknown): Channel[] {
  if (!Array.isArray(canales)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'canalesHabilitados debe ser un arreglo');
  }
  if (canales.length === 0) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'canalesHabilitados no puede estar vacío');
  }
  const unicos = new Set<string>();
  for (const c of canales) {
    const canal = validarCanal(c);
    if (unicos.has(canal)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, `Canal duplicado: ${canal}`);
    }
    unicos.add(canal);
  }
  return canales as Channel[];
}

/**
 * Valida el alcance: al menos productIds o skus, no vacíos, sin duplicados.
 */
export function validarAlcance(alcance: unknown): AlcanceInput {
  if (!alcance || typeof alcance !== 'object' || Array.isArray(alcance)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'alcance debe ser un objeto');
  }
  const { productIds, skus } = alcance as AlcanceInput;

  if (productIds !== undefined) {
    if (!Array.isArray(productIds)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'productIds debe ser un arreglo');
    }
    if (productIds.length === 0) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'productIds no puede estar vacío');
    }
    const unicos = new Set<string>();
    for (const p of productIds) {
      if (typeof p !== 'string' || p.length === 0) {
        throw new ProblemError(422, ErrorCode.VALIDACION, 'productIds contiene un valor inválido');
      }
      if (unicos.has(p)) {
        throw new ProblemError(422, ErrorCode.VALIDACION, `productIds duplicado: ${p}`);
      }
      unicos.add(p);
    }
  }

  if (skus !== undefined) {
    if (!Array.isArray(skus)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'skus debe ser un arreglo');
    }
    if (skus.length === 0) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'skus no puede estar vacío');
    }
    const unicos = new Set<string>();
    for (const s of skus) {
      if (typeof s !== 'string' || s.length === 0) {
        throw new ProblemError(422, ErrorCode.VALIDACION, 'skus contiene un valor inválido');
      }
      if (unicos.has(s)) {
        throw new ProblemError(422, ErrorCode.VALIDACION, `skus duplicado: ${s}`);
      }
      unicos.add(s);
    }
  }

  if (productIds === undefined && skus === undefined) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'alcance requiere al menos productIds o skus');
  }

  return { productIds, skus };
}

/**
 * Valida la política de combinación: tres booleanos obligatorios.
 */
export function validarPoliticaCombinacion(politica: unknown): PoliticaCombinacionInput {
  if (!politica || typeof politica !== 'object' || Array.isArray(politica)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'politicaCombinacion debe ser un objeto');
  }
  const { ofertaPricing, promocionAutomatica, cupon } = politica as PoliticaCombinacionInput;
  if (typeof ofertaPricing !== 'boolean') {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'politicaCombinacion.ofertaPricing es obligatorio (booleano)');
  }
  if (typeof promocionAutomatica !== 'boolean') {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'politicaCombinacion.promocionAutomatica es obligatorio (booleano)');
  }
  if (typeof cupon !== 'boolean') {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'politicaCombinacion.cupon es obligatorio (booleano)');
  }
  return { ofertaPricing, promocionAutomatica, cupon };
}

/**
 * Valida una entrada completa de creación (PromocionCreate).
 * Incluye reglas R01-R06.
 * Referencias del catálogo académico se validan en el servicio contra catalogo.json.
 */
export function validarPromocionCreate(input: unknown): PromocionCreateInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'El cuerpo de la solicitud debe ser un objeto JSON');
  }

  const data = input as Record<string, unknown>;

  const nombre = validarNombreTexto(data.nombre, 'nombre');
  const tipoDescuento = data.tipoDescuento;
  if (typeof tipoDescuento !== 'string' || !DISCOUNT_TYPES.includes(tipoDescuento as DiscountType)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'tipoDescuento debe ser PORCENTAJE o MONTO_FIJO');
  }
  const valor = validarValorFinitoPositivo(data.valor, 'valor');
  if (tipoDescuento === 'PORCENTAJE' && valor > 100) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'valor no puede exceder 100 para tipoDescuento PORCENTAJE');
  }
  const modalidad = data.modalidad;
  if (typeof modalidad !== 'string' || !MODALITIES.includes(modalidad as Modality)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'modalidad debe ser AUTOMATICA o CUPON');
  }
  const estado = data.estado;
  if (typeof estado !== 'string' || !STATES.includes(estado as State)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'estado debe ser ACTIVO o INACTIVO');
  }
  const validFrom = validarFechaHoraConZona(data.validFrom, 'validFrom');
  const validUntil = validarFechaHoraConZona(data.validUntil, 'validUntil');
  if (validFrom.getTime() >= validUntil.getTime()) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'validFrom debe ser anterior a validUntil');
  }
  const alcance = validarAlcance(data.alcance);
  const prioridad = data.prioridad;
  if (typeof prioridad !== 'number' || !Number.isInteger(prioridad) || prioridad < 1) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'prioridad debe ser un entero >= 1');
  }
  const canalesHabilitados = validarCanalesHabilitados(data.canalesHabilitados);
  const politicaCombinacion = validarPoliticaCombinacion(data.politicaCombinacion);

  // Rechazar propiedades adicionales no definidas en el esquema
  const camposPermitidos = new Set([
    'nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom',
    'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion',
  ]);
  for (const key of Object.keys(data)) {
    if (!camposPermitidos.has(key)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, `Propiedad no permitida: ${key}`);
    }
  }

  return {
    nombre,
    tipoDescuento: tipoDescuento as DiscountType,
    valor,
    modalidad: modalidad as Modality,
    estado: estado as State,
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
    alcance,
    prioridad,
    canalesHabilitados,
    politicaCombinacion,
  };
}

/**
 * Valida una entrada de PATCH (PromocionPatch).
 * Rechaza body vacío, propiedades desconocidas y campos de solo lectura.
 * Los campos omitidos se conservan (se fusionan en el servicio).
 */
export function validarPromocionPatch(input: unknown): PromocionPatchInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'El cuerpo de la solicitud debe ser un objeto JSON');
  }

  const data = input as Record<string, unknown>;
  const claves = Object.keys(data);

  if (claves.length === 0) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'PATCH no puede ir vacío; envíe al menos un campo');
  }

  const camposPermitidos = new Set([
    'nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom',
    'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion',
  ]);
  const camposSoloLectura = new Set(['promotionId', 'puedeCambiarModalidad']);
  for (const key of claves) {
    if (camposSoloLectura.has(key)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, `Campo de solo lectura no admisible en PATCH: ${key}`);
    }
    if (!camposPermitidos.has(key)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, `Propiedad no permitida: ${key}`);
    }
  }

  const resultado: PromocionPatchInput = {};

  if (data.nombre !== undefined) {
    resultado.nombre = validarNombreTexto(data.nombre, 'nombre');
  }
  if (data.tipoDescuento !== undefined) {
    if (typeof data.tipoDescuento !== 'string' || !DISCOUNT_TYPES.includes(data.tipoDescuento as DiscountType)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'tipoDescuento debe ser PORCENTAJE o MONTO_FIJO');
    }
    resultado.tipoDescuento = data.tipoDescuento as DiscountType;
  }
  if (data.valor !== undefined) {
    resultado.valor = validarValorFinitoPositivo(data.valor, 'valor');
  }
  if (data.modalidad !== undefined) {
    if (typeof data.modalidad !== 'string' || !MODALITIES.includes(data.modalidad as Modality)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'modalidad debe ser AUTOMATICA o CUPON');
    }
    resultado.modalidad = data.modalidad as Modality;
  }
  if (data.estado !== undefined) {
    if (typeof data.estado !== 'string' || !STATES.includes(data.estado as State)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'estado debe ser ACTIVO o INACTIVO');
    }
    resultado.estado = data.estado as State;
  }
  if (data.validFrom !== undefined) {
    resultado.validFrom = validarFechaHoraConZona(data.validFrom, 'validFrom').toISOString();
  }
  if (data.validUntil !== undefined) {
    resultado.validUntil = validarFechaHoraConZona(data.validUntil, 'validUntil').toISOString();
  }
  if (data.validFrom !== undefined && data.validUntil !== undefined) {
    if (
      new Date(resultado.validFrom!).getTime() >=
      new Date(resultado.validUntil!).getTime()
    ) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'validFrom debe ser anterior a validUntil');
    }
  }
  if (data.alcance !== undefined) {
    resultado.alcance = validarAlcance(data.alcance);
  }
  if (data.prioridad !== undefined) {
    if (typeof data.prioridad !== 'number' || !Number.isInteger(data.prioridad) || data.prioridad < 1) {
      throw new ProblemError(422, ErrorCode.VALIDACION, 'prioridad debe ser un entero >= 1');
    }
    resultado.prioridad = data.prioridad;
  }
  if (data.canalesHabilitados !== undefined) {
    resultado.canalesHabilitados = validarCanalesHabilitados(data.canalesHabilitados);
  }
  if (data.politicaCombinacion !== undefined) {
    resultado.politicaCombinacion = validarPoliticaCombinacion(data.politicaCombinacion);
  }

  // Validación cruzada: si cambia tipoDescuento a PORCENTAJE, el valor resultante debe <= 100
  if (resultado.tipoDescuento === 'PORCENTAJE') {
    const valorFinal = resultado.valor;
    // Si valor no viene en el PATCH, no se puede validar aquí contra el persistido;
    // el servicio hará la validación de la entidad fusionada.
  }

  return resultado;
}

/**
 * Valida el cuerpo del lote: { items: [PromocionCreate...] } de 1 a 20 elementos.
 */
export function validarLoteCreate(input: unknown): PromocionCreateInput[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'El cuerpo de la solicitud debe ser un objeto JSON');
  }

  const data = input as Record<string, unknown>;
  if (!data.items || !Array.isArray(data.items)) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'items debe ser un arreglo');
  }
  if (data.items.length < 1 || data.items.length > 20) {
    throw new ProblemError(422, ErrorCode.VALIDACION, 'items debe tener entre 1 y 20 elementos');
  }

  const resultados: PromocionCreateInput[] = [];
  for (const item of data.items) {
    resultados.push(validarPromocionCreate(item));
  }

  // Rechazar propiedades adicionales en el nivel raíz del lote
  const camposPermitidos = new Set(['items']);
  for (const key of Object.keys(data)) {
    if (!camposPermitidos.has(key)) {
      throw new ProblemError(422, ErrorCode.VALIDACION, `Propiedad no permitida: ${key}`);
    }
  }

  return resultados;
}

export { CHANNELS, MODALITIES, STATES, DISCOUNT_TYPES };

/**
 * Valida referencias del alcance contra el catálogo académico (catalogo.json).
 * Referencias inexistentes o inactivas: 422.
 */
export function validarReferenciasCatalogo(
  alcance: AlcanceInput,
  productosActivos: Set<string>,
  skusActivos: Set<string>,
): void {
  if (alcance.productIds) {
    for (const pid of alcance.productIds) {
      if (!productosActivos.has(pid)) {
        throw new ProblemError(422, ErrorCode.VALIDACION, `productId no encontrado o inactivo: ${pid}`);
      }
    }
  }
  if (alcance.skus) {
    for (const sku of alcance.skus) {
      if (!skusActivos.has(sku)) {
        throw new ProblemError(422, ErrorCode.VALIDACION, `SKU no encontrado o inactivo: ${sku}`);
      }
    }
  }
}

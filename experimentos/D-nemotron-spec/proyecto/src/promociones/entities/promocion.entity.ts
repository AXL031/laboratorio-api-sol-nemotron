export interface PromocionRow {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  modality: string;
  state: string;
  valid_from: Date;
  valid_until: Date;
  priority: number;
  enabled_channels: string[];
  first_activated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface PromocionAlcanceRow {
  promocion_id: string;
  product_id: string | null;
  sku: string | null;
}

export interface PromocionPoliticaRow {
  promocion_id: string;
  oferta_pricing: boolean;
  promocion_automatica: boolean;
  cupon: boolean;
}

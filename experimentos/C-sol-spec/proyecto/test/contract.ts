import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { Response } from 'supertest';
const contract = JSON.parse(readFileSync(new URL('../contrato/openapi.yaml', import.meta.url), 'utf8'));
type Schema = Record<string, any>;

// Verificador de las palabras JSON Schema usadas por este contrato congelado.
// Independiente del validador de solicitudes de la aplicación.
function errors(schema: Schema, value: any): string[] {
  if (schema.$ref) return errors(schema.$ref.split('/').slice(1).reduce((node: any, key: string) => node[key], contract), value);
  const failures: string[] = [];
  if (schema.allOf) for (const s of schema.allOf) failures.push(...errors(s, value));
  if (schema.anyOf && !schema.anyOf.some((s: Schema) => errors(s, value).length === 0)) failures.push('anyOf');
  if (schema.if && errors(schema.if, value).length === 0 && schema.then) failures.push(...errors(schema.then, value));
  if (schema.const !== undefined && value !== schema.const) failures.push('const');
  if (schema.enum && !schema.enum.includes(value)) failures.push('enum');
  if (schema.type) {
    const correct = schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : schema.type === 'array' ? Array.isArray(value) : schema.type === 'integer' ? Number.isInteger(value) : typeof value === schema.type;
    if (!correct) return [...failures, `type:${schema.type}`];
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) failures.push(`required:${key}`);
    if (schema.minProperties && Object.keys(value).length < schema.minProperties) failures.push('minProperties');
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) failures.push(...errors(schema.properties[key], item).map(e => `${key}.${e}`));
      else if (schema.additionalProperties === false) failures.push(`extra:${key}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) failures.push('minItems');
    if (schema.maxItems && value.length > schema.maxItems) failures.push('maxItems');
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) failures.push('uniqueItems');
    if (schema.items) for (const v of value) failures.push(...errors(schema.items, v));
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) failures.push('minimum');
    if (schema.maximum !== undefined && value > schema.maximum) failures.push('maximum');
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) failures.push('exclusiveMinimum');
  }
  if (typeof value === 'string') {
    if (schema.minLength && [...value].length < schema.minLength) failures.push('minLength');
    if (schema.maxLength && [...value].length > schema.maxLength) failures.push('maxLength');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) failures.push('pattern');
    if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) failures.push('uuid');
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) failures.push('date-time');
  }
  return failures;
}
export function conforms(path: string, method: string, response: Response) {
  const definition = contract.paths[path][method].responses[String(response.status)];
  expect(definition, `${method} ${path}: status ${response.status} contractual`).toBeDefined();
  if (!definition.content) { expect(response.text).toBe(''); return; }
  const [media, body] = Object.entries(definition.content)[0] as [string, any];
  expect(response.headers['content-type']).toContain(media);
  expect(errors(body.schema, response.body), JSON.stringify(response.body)).toEqual([]);
}

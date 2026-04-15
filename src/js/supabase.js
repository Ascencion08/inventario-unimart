/**
 * supabase.js
 * Cliente liviano para la Supabase REST API.
 * Usa fetch nativo — sin dependencias externas.
 */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Obtiene todos los registros de una tabla.
 * @param {string} table  Nombre de la tabla
 * @param {string} [order] Columna por la que ordenar (ascendente)
 * @returns {Promise<Array>}
 */
export async function getAll(table, order) {
  const url = order
    ? `${SUPABASE_URL}/rest/v1/${table}?order=${order}.asc`
    : `${SUPABASE_URL}/rest/v1/${table}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${table} falló: ${res.status}`);
  return res.json();
}

/**
 * Inserta un registro en una tabla.
 * @param {string} table
 * @param {Object} data
 * @returns {Promise<Object>} El registro insertado
 */
export async function insert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`INSERT ${table} falló: ${res.status}`);
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Actualiza un registro por su ID.
 * @param {string} table
 * @param {number|string} id
 * @param {Object} data  Campos a actualizar (parcial)
 * @returns {Promise<boolean>}
 */
export async function update(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`UPDATE ${table} id=${id} falló: ${res.status}`);
  return true;
}

/**
 * Elimina un registro por su ID.
 * @param {string} table
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
export async function remove(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`DELETE ${table} id=${id} falló: ${res.status}`);
  return true;
}

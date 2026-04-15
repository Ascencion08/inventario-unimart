/**
 * history.js
 * Carga, renderizado, filtros y exportación CSV del historial de movimientos.
 */

import * as db from './supabase.js';
import { showToast } from './ui.js';

/** @type {Array<Object>} Caché local del historial (orden descendente) */
export let history = [];

/** @type {Array<Object>} Subconjunto actualmente visible según filtros */
let filtered = [];

let activeFilter = 'todo';

// ── Carga ─────────────────────────────────────────────────────

/**
 * Carga el historial desde Supabase (orden descendente).
 * @returns {Promise<Array>}
 */
export async function loadHistory() {
  const raw = await db.getAll('historial', 'created_at');
  history   = [...raw].reverse();
  filtered  = history;
  return history;
}

// ── Render ────────────────────────────────────────────────────

/** Aplica los filtros activos y re-renderiza la lista. */
export function applyFilters() {
  const query = (document.getElementById('hist-search')?.value ?? '').toLowerCase();

  filtered = history.filter(h => {
    const matchType  = activeFilter === 'todo' || (h.tipo || 'uso') === activeFilter;
    const matchQuery = !query
      || h.producto_nombre.toLowerCase().includes(query)
      || h.usuario.toLowerCase().includes(query);
    return matchType && matchQuery;
  });

  _renderHistory(filtered);
}

/**
 * Cambia el filtro de tipo activo.
 * @param {'todo'|'uso'|'conteo'} filter
 * @param {HTMLElement} btn  El botón que se activó
 */
export function setTypeFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function _renderHistory(data) {
  const el = document.getElementById('hist-list');
  if (!data.length) {
    el.innerHTML = '<div class="empty">Sin movimientos que coincidan.</div>';
    return;
  }

  el.innerHTML = data.map(h => {
    const diff  = h.diferencia;
    const cls   = diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'zer';
    const sign  = diff > 0 ? '+' : '';
    const tipo  = h.tipo || 'uso';
    const fecha = new Date(h.created_at).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });

    return `
      <div class="hist-item">
        <div class="hist-top">
          <div class="hist-name">${h.producto_nombre}</div>
          <div class="hist-diff ${cls}">${sign}${diff}</div>
        </div>
        <div class="hist-meta">
          <span class="hist-tipo ${tipo}">${tipo}</span>
          ${h.stock_anterior} → ${h.stock_nuevo}
          &nbsp;·&nbsp; ${h.usuario}
          &nbsp;·&nbsp; ${fecha}
          ${h.nota ? `&nbsp;·&nbsp; ${h.nota}` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Exportar CSV ──────────────────────────────────────────────

/**
 * Descarga el historial actualmente filtrado como archivo CSV.
 * Incluye BOM UTF-8 para compatibilidad con Excel.
 */
export function exportCSV() {
  const data = filtered.length ? filtered : history;
  if (!data.length) { showToast('Sin datos para exportar'); return; }

  const HEADERS = ['Fecha', 'Producto', 'Tipo', 'Stock anterior', 'Stock nuevo', 'Diferencia', 'Usuario', 'Nota'];

  const rows = data.map(h => [
    new Date(h.created_at).toLocaleString('es-CR'),
    h.producto_nombre,
    h.tipo || 'uso',
    h.stock_anterior,
    h.stock_nuevo,
    h.diferencia,
    h.usuario,
    h.nota ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv  = [HEADERS.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `inventario_${new Date().toISOString().slice(0, 10)}.csv`,
  });

  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ CSV descargado');
}

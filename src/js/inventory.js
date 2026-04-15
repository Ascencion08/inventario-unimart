/**
 * inventory.js
 * Lógica de productos: carga, renderizado, uso rápido (−1),
 * conteo masivo y CRUD de productos (solo supervisor).
 */

import * as db        from './supabase.js';
import { getSession } from './auth.js';
import { showToast, openModal, closeModal, getStockStatus } from './ui.js';

/** @type {Array<Object>} Caché local de productos */
export let products = [];

// ── Carga ─────────────────────────────────────────────────────

/**
 * Carga los productos desde Supabase y actualiza el caché local.
 * @returns {Promise<Array>}
 */
export async function loadProducts() {
  products = await db.getAll('productos', 'nombre');
  return products;
}

// ── Render: Inicio ────────────────────────────────────────────

/** Renderiza la vista de métricas + lista de productos en Inicio. */
export function renderDashboard(asAdmin) {
  _renderMetrics();
  _renderAlerts();
  asAdmin ? _renderAdminList() : _renderCollaboratorList();
}

function _renderMetrics() {
  const bajo = products.filter(p => p.stock > 0 && p.stock <= p.minimo).length;
  const sin  = products.filter(p => p.stock <= 0).length;
  const ok   = products.length - bajo - sin;

  document.getElementById('metrics-grid').innerHTML = `
    <div class="metric"><div class="num accent">${products.length}</div><div class="lbl">Productos</div></div>
    <div class="metric"><div class="num ok">${ok}</div><div class="lbl">Normal</div></div>
    <div class="metric"><div class="num warn">${bajo}</div><div class="lbl">Stock bajo</div></div>
    <div class="metric"><div class="num low">${sin}</div><div class="lbl">Sin stock</div></div>
  `;
}

function _renderAlerts() {
  const criticos = products.filter(p => p.stock <= p.minimo);
  const bar = document.getElementById('alert-bar');
  const dot = document.getElementById('alert-dot');

  if (criticos.length) {
    bar.innerHTML = `⚠️ Requieren reposición: <strong>${criticos.map(p => p.nombre).join(', ')}</strong>`;
    bar.classList.add('show');
    dot.classList.add('show');
  } else {
    bar.classList.remove('show');
    dot.classList.remove('show');
  }
}

function _renderCollaboratorList() {
  const label = document.getElementById('inicio-label');
  if (label) label.textContent = 'Tocá − para registrar un uso';

  document.getElementById('prod-list-inicio').innerHTML = products.map((p, i) => {
    const s = getStockStatus(p);
    return `
      <div class="uso-card ${s.cls !== 'ok' ? s.cls + '-stock' : ''}">
        <div class="uso-icon">${p.icono || '📦'}</div>
        <div class="uso-info">
          <div class="uso-name">${p.nombre}</div>
          <div class="uso-meta">${p.unidad} · mín: ${p.minimo}</div>
          <span class="badge ${s.cls}" style="margin-top:5px;">${s.label}</span>
        </div>
        <div class="uso-right">
          <div class="uso-stock ${s.cls !== 'ok' ? s.cls : ''}" id="stk-${p.id}">${p.stock}</div>
          <button
            class="uso-btn"
            id="ubtn-${p.id}"
            data-index="${i}"
            ${p.stock <= 0 ? 'disabled' : ''}
            aria-label="Restar una unidad de ${p.nombre}"
          >−</button>
        </div>
      </div>`;
  }).join('') || '<div class="empty">Sin productos registrados.</div>';

  // Delegar eventos en el contenedor (más eficiente que N listeners)
  const list = document.getElementById('prod-list-inicio');
  list.addEventListener('click', _handleQuickUseClick);
}

function _renderAdminList() {
  const label = document.getElementById('inicio-label');
  if (label) label.textContent = 'Todos los productos';

  document.getElementById('prod-list-inicio').innerHTML = products.map(p => {
    const s = getStockStatus(p);
    return `
      <div class="prod-card ${s.cls !== 'ok' ? s.cls + '-stock' : ''}">
        <div class="uso-icon">${p.icono || '📦'}</div>
        <div class="prod-info">
          <div class="prod-name">${p.nombre}</div>
          <div class="prod-meta">Mín: ${p.minimo} ${p.unidad}</div>
          <span class="badge ${s.cls}" style="margin-top:5px;">${s.label}</span>
        </div>
        <div class="prod-right">
          <div class="prod-unit">${p.unidad}</div>
          <div class="prod-stock-num ${s.cls !== 'ok' ? s.cls : ''}">${p.stock}</div>
        </div>
      </div>`;
  }).join('') || '<div class="empty">Sin productos registrados.</div>';
}

// ── Uso rápido (colaborador) ──────────────────────────────────

async function _handleQuickUseClick(e) {
  const btn = e.target.closest('.uso-btn');
  if (!btn || btn.disabled) return;

  const index = parseInt(btn.dataset.index);
  const p     = products[index];
  if (!p) return;

  btn.disabled = true;
  const newStock = p.stock - 1;

  try {
    await db.update('productos', p.id, { stock: newStock });
    await db.insert('historial', {
      producto_id:     p.id,
      producto_nombre: p.nombre,
      stock_anterior:  p.stock,
      stock_nuevo:     newStock,
      diferencia:      -1,
      usuario:         getSession().username,
      nota:            null,
      tipo:            'uso',
    });

    products[index].stock = newStock;

    // Actualizar DOM puntualmente (sin re-renderizar toda la lista)
    const s       = getStockStatus(products[index]);
    const stkEl   = document.getElementById(`stk-${p.id}`);
    const card    = btn.closest('.uso-card');
    const badgeEl = card?.querySelector('.badge');

    if (stkEl)   { stkEl.textContent = newStock; stkEl.className = `uso-stock ${s.cls !== 'ok' ? s.cls : ''}`; }
    if (badgeEl) { badgeEl.className = `badge ${s.cls}`; badgeEl.textContent = s.label; }
    if (card)    { card.className = `uso-card ${s.cls !== 'ok' ? s.cls + '-stock' : ''}`; }

    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 500);

    if (newStock > 0) btn.disabled = false;
    if (newStock <= p.minimo) showToast(`⚠️ ${p.nombre}: stock bajo (${newStock})`);

    _renderMetrics();
    _renderAlerts();

  } catch (err) {
    console.error('Error en uso rápido:', err);
    btn.disabled = false;
    showToast('Error al registrar. Intentá de nuevo.');
  }
}

// ── Conteo masivo (supervisor) ────────────────────────────────

/** Renderiza el formulario de conteo masivo. */
export function renderCountForm() {
  document.getElementById('conteo-items').innerHTML = products.map((p, i) => `
    <div class="conteo-card">
      <div class="conteo-head">
        <div>
          <div class="conteo-name">${p.icono || '📦'} ${p.nombre}</div>
          <div class="conteo-prev">Anterior: ${p.stock} ${p.unidad}</div>
        </div>
      </div>
      <div class="conteo-body">
        <div class="qty-wrap">
          <button class="qty-btn" data-action="dec" data-index="${i}">−</button>
          <input class="qty-input" type="number" min="0" id="cnt-${i}" value="${p.stock}" data-index="${i}">
          <button class="qty-btn" data-action="inc" data-index="${i}">+</button>
        </div>
        <span class="diff-label" id="diff-${i}"></span>
      </div>
    </div>
  `).join('');

  // Delegación de eventos
  const container = document.getElementById('conteo-items');
  container.addEventListener('click',  _handleCountButtonClick);
  container.addEventListener('input',  _handleCountInputChange);
}

function _handleCountButtonClick(e) {
  const btn = e.target.closest('.qty-btn');
  if (!btn) return;
  const i   = parseInt(btn.dataset.index);
  const inp = document.getElementById(`cnt-${i}`);
  const val = parseInt(inp.value || 0);
  inp.value = Math.max(0, btn.dataset.action === 'inc' ? val + 1 : val - 1);
  _updateDiff(i);
}

function _handleCountInputChange(e) {
  const inp = e.target.closest('.qty-input');
  if (!inp) return;
  _updateDiff(parseInt(inp.dataset.index));
}

function _updateDiff(i) {
  const val  = parseInt(document.getElementById(`cnt-${i}`)?.value || 0);
  const diff = val - products[i].stock;
  const el   = document.getElementById(`diff-${i}`);
  if (!el) return;
  el.textContent = diff === 0 ? '' : (diff > 0 ? '+' : '') + diff;
  el.className   = `diff-label${diff > 0 ? ' pos' : diff < 0 ? ' neg' : ''}`;
}

/** Guarda el conteo masivo en Supabase. */
export async function saveCount(nota) {
  const changes = products
    .map((p, i) => ({ p, newStock: parseInt(document.getElementById(`cnt-${i}`)?.value || 0) }))
    .filter(({ p, newStock }) => newStock !== p.stock);

  if (!changes.length) { showToast('Sin cambios en el conteo'); return false; }

  const { username } = getSession();

  for (const { p, newStock } of changes) {
    await db.update('productos', p.id, { stock: newStock });
    await db.insert('historial', {
      producto_id:     p.id,
      producto_nombre: p.nombre,
      stock_anterior:  p.stock,
      stock_nuevo:     newStock,
      diferencia:      newStock - p.stock,
      usuario:         username,
      nota:            nota || null,
      tipo:            'conteo',
    });
  }

  showToast(`✓ ${changes.length} producto${changes.length > 1 ? 's' : ''} actualizado${changes.length > 1 ? 's' : ''}`);
  return true;
}

// ── CRUD productos (supervisor) ───────────────────────────────

/** Renderiza la lista de gestión de productos. */
export function renderManagement() {
  document.getElementById('gestion-list').innerHTML = products.map(p => {
    const s = getStockStatus(p);
    return `
      <div class="prod-card" data-id="${p.id}" style="cursor:pointer;">
        <div class="uso-icon">${p.icono || '📦'}</div>
        <div class="prod-info">
          <div class="prod-name">${p.nombre}</div>
          <div class="prod-meta">${p.unidad} · mín: ${p.minimo}</div>
        </div>
        <div class="prod-right">
          <div class="prod-stock-num ${s.cls !== 'ok' ? s.cls : ''}">${p.stock}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">editar →</div>
        </div>
      </div>`;
  }).join('') || '<div class="empty">Sin productos. Agregá uno.</div>';

  document.getElementById('gestion-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openProductModal(card.dataset.id);
  });
}

/** Abre el modal de producto para crear o editar. */
export function openProductModal(id) {
  const p = id ? products.find(x => String(x.id) === String(id)) : null;

  document.getElementById('modal-prod-title').textContent = p ? 'Editar producto' : 'Agregar producto';
  document.getElementById('btn-eliminar-wrap').style.display = p ? 'block' : 'none';
  document.getElementById('mp-id').value     = p?.id     ?? '';
  document.getElementById('mp-nombre').value = p?.nombre ?? '';
  document.getElementById('mp-unidad').value = p?.unidad ?? 'Resmas';
  document.getElementById('mp-stock').value  = p?.stock  ?? 0;
  document.getElementById('mp-min').value    = p?.minimo ?? 5;
  document.getElementById('mp-icon').value   = p?.icono  ?? '';

  openModal('modal-prod');
}

/** Guarda (crea o actualiza) el producto del modal. */
export async function saveProduct() {
  const id     = document.getElementById('mp-id').value;
  const nombre = document.getElementById('mp-nombre').value.trim();
  const unidad = document.getElementById('mp-unidad').value;
  const stock  = parseInt(document.getElementById('mp-stock').value) || 0;
  const minimo = parseInt(document.getElementById('mp-min').value)   || 0;
  const icono  = document.getElementById('mp-icon').value.trim()     || '📦';

  if (!nombre) { showToast('Ingresá el nombre del producto'); return; }

  if (id) {
    await db.update('productos', id, { nombre, unidad, minimo, icono });
  } else {
    await db.insert('productos', { nombre, unidad, stock, minimo, icono });
  }

  closeModal('modal-prod');
  showToast('✓ Guardado');
}

/** Elimina el producto activo en el modal. */
export async function deleteProduct() {
  const id   = document.getElementById('mp-id').value;
  const name = document.getElementById('mp-nombre').value;

  if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;

  await db.remove('productos', id);
  closeModal('modal-prod');
  showToast('Producto eliminado');
}

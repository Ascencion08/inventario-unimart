/**
 * ui.js
 * Utilidades de interfaz reutilizables:
 * toasts, modales, navegación entre páginas y teclado PIN.
 */

// ── Toast ─────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Muestra un mensaje temporal flotante.
 * @param {string} message
 * @param {number} [duration=2200]
 */
export function showToast(message, duration = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(_toastTimer);
  el.textContent = message;
  el.classList.add('show');
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Modales ───────────────────────────────────────────────────

/**
 * Abre un modal por su ID.
 * @param {string} id
 */
export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

/**
 * Cierra un modal por su ID.
 * @param {string} id
 */
export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ── Navegación ────────────────────────────────────────────────

const PAGE_TITLES = {
  inicio:    'Inicio',
  conteo:    'Registrar conteo',
  historial: 'Historial',
  gestion:   'Gestión',
};

/**
 * Navega a una página de la app.
 * @param {string} pageId
 * @param {HTMLElement} navBtn  Botón de navegación que se activa
 * @param {Function} [onEnter] Callback opcional al llegar a la página
 */
export function navigateTo(pageId, navBtn, onEnter) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  navBtn?.classList.add('active');

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] ?? pageId;

  onEnter?.();
}

// ── PIN pad ───────────────────────────────────────────────────

/**
 * Renderiza el teclado numérico PIN y gestiona su estado interno.
 * @param {Object} opts
 * @param {Function} opts.onComplete  Se llama con el PIN completo (string de 4 dígitos)
 * @param {Function} opts.onCancel
 */
export function initPinPad({ onComplete, onCancel }) {
  let pin = '';

  const displayEl = document.getElementById('pin-display');
  const errorEl   = document.getElementById('pin-error');
  const gridEl    = document.getElementById('pin-grid');

  const updateDisplay = () => {
    if (displayEl) displayEl.textContent = '●'.repeat(pin.length) + '○'.repeat(4 - pin.length);
  };

  const reset = () => {
    pin = '';
    updateDisplay();
    if (errorEl) errorEl.textContent = '';
  };

  /** Muestra un mensaje de error y limpia el PIN ingresado. */
  const showError = (msg) => {
    if (errorEl) errorEl.textContent = msg;
    pin = '';
    updateDisplay();
  };

  const handleKey = (key) => {
    if (key === '⌫') {
      pin = pin.slice(0, -1);
      updateDisplay();
      return;
    }
    if (key === '✓') {
      if (pin.length < 4) { showError('Ingresá los 4 dígitos'); return; }
      onComplete(pin);
      return;
    }
    if (pin.length >= 4) return;
    pin += key;
    updateDisplay();
    if (pin.length === 4) setTimeout(() => onComplete(pin), 180);
  };

  // Renderizar teclado
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];
  if (gridEl) {
    gridEl.innerHTML = keys
      .map(k => `<button class="pin-key" data-key="${k}">${k}</button>`)
      .join('');
    gridEl.addEventListener('click', (e) => {
      const key = e.target.closest('.pin-key')?.dataset.key;
      if (key) handleKey(key);
    });
  }

  reset();
  return { reset, showError };
}

// ── Helpers de estado visual ──────────────────────────────────

/**
 * Retorna info de estado según el stock actual vs mínimo.
 * @param {{ stock: number, minimo: number }} product
 * @returns {{ cls: 'ok'|'warn'|'low', label: string }}
 */
export function getStockStatus(product) {
  if (product.stock <= 0)             return { cls: 'low',  label: 'Sin stock'  };
  if (product.stock <= product.minimo) return { cls: 'warn', label: 'Stock bajo' };
  return                                      { cls: 'ok',   label: 'Normal'     };
}

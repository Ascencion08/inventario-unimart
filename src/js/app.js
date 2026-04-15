/**
 * app.js
 * Punto de entrada de la aplicación.
 * Inicializa módulos, conecta eventos del DOM y arranca la sesión.
 */

import * as Auth      from './auth.js';
import * as UI        from './ui.js';
import * as Inventory from './inventory.js';
import * as History   from './history.js';

// ── Carga inicial de datos ────────────────────────────────────

async function loadAllData() {
  await Promise.all([
    Inventory.loadProducts(),
    History.loadHistory(),
  ]);
}

// ── Iniciar app post-login ────────────────────────────────────

async function bootApp() {
  const session = Auth.getSession();
  const admin   = Auth.isAdmin();

  // Mostrar shell de la app
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display     = 'flex';

  // Badge de rol
  const badge = document.getElementById('role-badge');
  badge.textContent = session.username;
  badge.className   = `role-badge ${admin ? 'admin' : 'user'}`;

  // Navegación según rol
  const nav = document.getElementById('bottom-nav');
  nav.className = admin ? 'bottom-nav cols4' : 'bottom-nav cols2';
  document.getElementById('nav-conteo').style.display  = admin ? '' : 'none';
  document.getElementById('nav-gestion').style.display = admin ? '' : 'none';
  document.getElementById('hist-export').style.display = admin ? 'block' : 'none';

  // Cargar datos y renderizar
  document.getElementById('prod-list-inicio').innerHTML =
    '<div class="loader-wrap"><div class="spinner"></div>Cargando...</div>';

  await loadAllData();
  Inventory.renderDashboard(admin);
}

// ── Logout ────────────────────────────────────────────────────

function handleLogout() {
  if (!confirm('¿Cerrar sesión?')) return;
  Auth.logout();
  // Volver a pantalla de login
  document.getElementById('main-app').style.display     = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-name').value           = '';
}

// ── Navegación ────────────────────────────────────────────────

function setupNavigation() {
  const admin = Auth.isAdmin();

  document.getElementById('nav-inicio').addEventListener('click', function () {
    UI.navigateTo('inicio', this, () => Inventory.renderDashboard(admin));
  });
  document.getElementById('nav-historial').addEventListener('click', function () {
    UI.navigateTo('historial', this, () => History.applyFilters());
  });
  document.getElementById('nav-conteo')?.addEventListener('click', function () {
    UI.navigateTo('conteo', this, () => Inventory.renderCountForm());
  });
  document.getElementById('nav-gestion')?.addEventListener('click', function () {
    UI.navigateTo('gestion', this, () => Inventory.renderManagement());
  });
}

// ── Login: colaborador ────────────────────────────────────────

async function setupCollaboratorLogin() {
  const btn   = document.getElementById('btn-login-colab');
  const input = document.getElementById('login-name');

  const doLogin = async () => {
    if (Auth.loginAsCollaborator(input.value)) {
      setupNavigation();
      await bootApp();
    }
  };

  btn.addEventListener('click', doLogin);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ── Login: supervisor (PIN) ───────────────────────────────────

function setupAdminLogin() {
  const openBtn = document.getElementById('btn-login-admin');

  openBtn.addEventListener('click', () => {
    UI.openModal('modal-pin');

    const pad = UI.initPinPad({
      onComplete: async (pin) => {
        if (Auth.loginAsAdmin(pin)) {
          UI.closeModal('modal-pin');
          setupNavigation();
          await bootApp();
        } else {
          pad.showError('PIN incorrecto. Intentá de nuevo.');
        }
      },
      onCancel: () => UI.closeModal('modal-pin'),
    });
  });

  document.getElementById('btn-pin-cancel').addEventListener('click', () => {
    UI.closeModal('modal-pin');
  });
}

// ── Historial: eventos ────────────────────────────────────────

function setupHistoryEvents() {
  document.getElementById('hist-search')
    .addEventListener('input', () => History.applyFilters());

  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      History.setTypeFilter(btn.dataset.filter, btn)
    );
  });

  document.getElementById('btn-export-csv')
    ?.addEventListener('click', () => History.exportCSV());
}

// ── Conteo: guardar ───────────────────────────────────────────

function setupCountEvents() {
  document.getElementById('btn-guardar-conteo')?.addEventListener('click', async () => {
    const btn  = document.getElementById('btn-guardar-conteo');
    const nota = document.getElementById('conteo-nota').value.trim();
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const saved = await Inventory.saveCount(nota);
      if (saved) {
        document.getElementById('conteo-nota').value = '';
        await loadAllData();
        UI.navigateTo('inicio', document.getElementById('nav-inicio'), () =>
          Inventory.renderDashboard(true)
        );
      }
    } catch (err) {
      console.error('Error al guardar conteo:', err);
      UI.showToast('Error al guardar. Intentá de nuevo.');
    }
    btn.disabled = false; btn.textContent = 'Guardar conteo';
  });
}

// ── Gestión: modal producto ───────────────────────────────────

function setupProductModal() {
  document.getElementById('btn-add-product')
    ?.addEventListener('click', () => Inventory.openProductModal(null));

  document.getElementById('btn-save-product')
    ?.addEventListener('click', async () => {
      await Inventory.saveProduct();
      await loadAllData();
      Inventory.renderManagement();
    });

  document.getElementById('btn-delete-product')
    ?.addEventListener('click', async () => {
      await Inventory.deleteProduct();
      await loadAllData();
      Inventory.renderManagement();
    });

  document.getElementById('btn-cancel-product')
    ?.addEventListener('click', () => UI.closeModal('modal-prod'));
}

// ── Logout button ─────────────────────────────────────────────

function setupLogout() {
  document.getElementById('btn-logout')
    ?.addEventListener('click', handleLogout);
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  setupCollaboratorLogin();
  setupAdminLogin();
  setupHistoryEvents();
  setupCountEvents();
  setupProductModal();
  setupLogout();

  // Restaurar sesión si ya había una guardada
  if (Auth.restoreSession()) {
    setupNavigation();
    await bootApp();
  }
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

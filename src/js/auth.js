/**
 * auth.js
 * Manejo de sesión: login de colaborador, acceso supervisor por PIN, logout.
 * La sesión se persiste en localStorage para sobrevivir cierres del browser.
 */

import { ADMIN_PIN, ADMIN_NAME } from './config.js';
import { showToast, closeModal } from './ui.js';

const SESSION_KEY  = 'inv_session';

/** @type {{ username: string, isAdmin: boolean } | null} */
let currentSession = null;

/** Retorna la sesión activa o null si no hay sesión. */
export function getSession() {
  return currentSession;
}

/** Retorna true si el usuario activo es supervisor. */
export function isAdmin() {
  return currentSession?.isAdmin === true;
}

/**
 * Intenta restaurar la sesión desde localStorage.
 * @returns {boolean} true si había sesión guardada
 */
export function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    currentSession = JSON.parse(raw);
    return !!currentSession?.username;
  } catch {
    return false;
  }
}

/**
 * Inicia sesión como colaborador.
 * @param {string} username
 */
export function loginAsCollaborator(username) {
  if (!username?.trim()) {
    showToast('Ingresá tu nombre');
    return false;
  }
  currentSession = { username: username.trim(), isAdmin: false };
  _persistSession();
  return true;
}

/**
 * Inicia sesión como supervisor si el PIN es correcto.
 * @param {string} pin
 * @returns {boolean} true si el PIN era correcto
 */
export function loginAsAdmin(pin) {
  if (pin !== ADMIN_PIN) return false;
  currentSession = { username: ADMIN_NAME, isAdmin: true };
  _persistSession();
  return true;
}

/**
 * Cierra la sesión activa y limpia el storage.
 */
export function logout() {
  currentSession = null;
  localStorage.removeItem(SESSION_KEY);
}

function _persistSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
}

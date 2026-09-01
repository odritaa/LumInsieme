const BASE = '/auth';

/** Iniciar OAuth exige navegacion top-level del navegador, no un fetch. */
export const GOOGLE_SIGNIN_URL = `${BASE}/google`;

export async function fetchCurrentUser() {
  const res = await fetch(`${BASE}/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.user;
}

export async function updateCurrentUser(patch) {
  const res = await fetch(`${BASE}/me`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.user;
}

export async function deleteCurrentUser() {
  const res = await fetch(`${BASE}/me`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export async function logoutRequest() {
  const res = await fetch(`${BASE}/logout`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

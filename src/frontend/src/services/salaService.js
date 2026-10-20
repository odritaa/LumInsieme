const BASE = '/salas';

const ERROR_MESSAGES = {
  unauthenticated: 'Tu sesión expiró. Volvé a iniciar sesión.',
  invalid_token: 'Tu sesión expiró. Volvé a iniciar sesión.',
  sala_not_found: 'La sala ya no existe.',
  sala_full: 'La sala está completa.',
  sala_closed: 'La función de esta sala ya pasó.',
  not_a_member: 'Unite a la sala para usar el chat.',
  invalid_sala: 'Revisá los datos de la sala.',
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(ERROR_MESSAGES[json.error] ?? `Error ${res.status}: ${res.statusText}`);
    error.status = res.status;
    error.code = json.error;
    error.details = json.details;
    throw error;
  }
  return json;
}

export async function fetchSalas() {
  const json = await request('');
  return json.salas;
}

export async function fetchSala(id) {
  const json = await request(`/${encodeURIComponent(id)}`);
  return json.sala;
}

export async function createSala(sala) {
  const json = await request('', { method: 'POST', body: JSON.stringify(sala) });
  return json.sala;
}

export async function joinSala(id) {
  const json = await request(`/${encodeURIComponent(id)}/miembros`, { method: 'POST' });
  return json.sala;
}

/** Devuelve null si la sala se eliminó por quedar vacía. */
export async function leaveSala(id) {
  const json = await request(`/${encodeURIComponent(id)}/miembros/me`, { method: 'DELETE' });
  return json.sala;
}

export async function fetchChatTicket(id) {
  const json = await request(`/${encodeURIComponent(id)}/chat-ticket`, { method: 'POST' });
  return json.ticket;
}

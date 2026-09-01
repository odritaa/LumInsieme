import config from "../config.js";

const { name, stateName, secure, sameSite, maxAge, stateMaxAge } = config.cookie;

const base = { httpOnly: true, secure, sameSite };

export function setSessionCookie(res, token) {
  res.cookie(name, token, { ...base, path: "/", maxAge });
}

export function clearSessionCookie(res) {
  res.clearCookie(name, { ...base, path: "/" });
}

// path /auth: la cookie de state solo viaja en el callback, no en el resto de la app.
export function setStateCookie(res, state) {
  res.cookie(stateName, state, { ...base, path: "/auth", maxAge: stateMaxAge });
}

export function clearStateCookie(res) {
  res.clearCookie(stateName, { ...base, path: "/auth" });
}

import config from "../config.js";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const VALID_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export async function exchangeCodeForTokens(code) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      // Debe coincidir byte a byte con el usado en buildAuthUrl o Google responde invalid_grant.
      redirect_uri: config.google.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`token endpoint respondio ${response.status}: ${detail}`);
  }

  return response.json();
}

// No se verifica la firma del id_token: llego por TLS directo desde el token endpoint,
// autenticado con nuestro client_secret (OIDC Core 3.1.3.7). Si alguna vez el token
// llegara desde el cliente, verificarlo contra el JWKS de Google pasa a ser obligatorio.
export function decodeIdToken(idToken) {
  const parts = idToken?.split(".");
  if (parts?.length !== 3) throw new Error("id_token con formato invalido");

  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));

  if (!VALID_ISSUERS.includes(claims.iss)) throw new Error(`iss inesperado: ${claims.iss}`);
  if (claims.aud !== config.google.clientId) throw new Error("aud no coincide con el client_id");
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new Error("id_token vencido");
  if (claims.email_verified !== true) throw new Error("el email de Google no esta verificado");

  return {
    googleSub: claims.sub,
    email: claims.email,
    name: claims.name?.trim() || claims.email,
    picture: claims.picture ?? null,
  };
}

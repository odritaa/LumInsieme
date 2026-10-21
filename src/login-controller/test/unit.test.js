import { describe, expect, it } from "vitest";
import User, { GENRES } from "../src/models/User.js";
import { buildAuthUrl, decodeIdToken } from "../src/services/googleOAuth.js";

function idToken(claims) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.firma`;
}

const validClaims = () => ({
  iss: "accounts.google.com",
  aud: process.env.GOOGLE_CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: "123",
  email: "ana@gmail.com",
  email_verified: true,
  name: "  Ana  ",
});

describe("CU-01 Autenticacion — validacion del id_token de Google (unitario)", () => {
  it("PT-CU01-27 decodeIdToken con id_token válido → perfil normalizado", () => {
    expect(decodeIdToken(idToken(validClaims()))).toEqual({
      googleSub: "123",
      email: "ana@gmail.com",
      name: "Ana",
      picture: null,
    });
  });

  it.each([
    ["PT-CU01-28", "emisor ajeno", { iss: "https://evil.example" }, /iss inesperado/],
    ["PT-CU01-29", "audiencia de otro cliente", { aud: "otro-client-id" }, /aud no coincide/],
    ["PT-CU01-30", "vencido", { exp: Math.floor(Date.now() / 1000) - 1 }, /vencido/],
    ["PT-CU01-31", "email no verificado", { email_verified: false }, /no esta verificado/],
  ])("%s decodeIdToken con %s → error", (_id, _desc, override, message) => {
    expect(() => decodeIdToken(idToken({ ...validClaims(), ...override }))).toThrow(message);
  });

  it("PT-CU01-32 decodeIdToken con token mal formado → error de formato", () => {
    expect(() => decodeIdToken("no-es-un-jwt")).toThrow(/formato invalido/);
  });

  it("PT-CU01-33 buildAuthUrl → scope openid email profile, response_type code y state propagado", () => {
    const url = new URL(buildAuthUrl("estado"));
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("estado");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});

describe("CU-01 Autenticacion — User.sanitizeProfile (unitario)", () => {
  it("PT-CU01-34 sanitizeProfile con edad null, 14 géneros válidos y 5 películas → sin errores", () => {
    const { errors, patch } = User.sanitizeProfile({
      age: null,
      genres: GENRES,
      favoriteMovies: Array.from({ length: 5 }, (_, i) => ({ title: `P${i}`, initials: "ABC" })),
    });
    expect(errors).toEqual([]);
    expect(patch.age).toBeNull();
    expect(patch.favoriteMovies[0].initials).toBe("AB");
  });

  it("PT-CU01-35 sanitizeProfile con arreglo, película sin título, nombre >80 o ciudad no texto → errores", () => {
    expect(User.sanitizeProfile([]).errors).toHaveLength(1);
    expect(User.sanitizeProfile({ favoriteMovies: [{ title: "  " }] }).errors.join()).toMatch(/title/);
    expect(User.sanitizeProfile({ name: "x".repeat(81) }).errors.join()).toMatch(/name/);
    expect(User.sanitizeProfile({ city: 5 }).errors.join()).toMatch(/city/);
  });
});

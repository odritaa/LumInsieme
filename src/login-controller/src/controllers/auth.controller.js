import crypto from "node:crypto";
import config from "../config.js";
import User from "../models/User.js";
import * as userRepository from "../repositories/userRepository.js";
import * as googleOAuth from "../services/googleOAuth.js";
import { signSession } from "../utils/jwt.js";
import {
  clearSessionCookie,
  clearStateCookie,
  setSessionCookie,
  setStateCookie,
} from "../utils/cookies.js";

const UNIQUE_VIOLATION = "23505";

function redirectToFrontend(res, pathOrError) {
  res.redirect(`${config.frontendUrl}${pathOrError}`);
}

function statesMatch(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function startGoogleLogin(_req, res) {
  const state = crypto.randomBytes(32).toString("hex");
  setStateCookie(res, state);
  res.redirect(googleOAuth.buildAuthUrl(state));
}

export async function handleGoogleCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    clearStateCookie(res);
    return redirectToFrontend(res, "/?error=access_denied");
  }

  const expectedState = req.cookies?.[config.cookie.stateName];
  clearStateCookie(res);

  if (!code || !statesMatch(state, expectedState)) {
    return redirectToFrontend(res, "/?error=invalid_state");
  }

  try {
    const tokens = await googleOAuth.exchangeCodeForTokens(code);
    const profile = googleOAuth.decodeIdToken(tokens.id_token);
    const user = await userRepository.upsertFromGoogle(profile);

    setSessionCookie(res, signSession(user));
    redirectToFrontend(res, "/feed");
  } catch (failure) {
    if (failure.code === UNIQUE_VIOLATION) {
      console.error("[login] email ya asociado a otra cuenta de Google");
      return redirectToFrontend(res, "/?error=email_in_use");
    }
    console.error("[login] fallo el callback de Google:", failure.message);
    redirectToFrontend(res, "/?error=oauth_failed");
  }
}

export async function getMe(req, res) {
  const user = await userRepository.findById(req.auth.sub);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "unauthenticated" });
  }
  res.json({ user: user.toJSON() });
}

export async function updateMe(req, res) {
  const { errors, patch } = User.sanitizeProfile(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: "invalid_profile", details: errors });
  }

  const user = await userRepository.updateProfile(req.auth.sub, patch);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "unauthenticated" });
  }
  res.json({ user: user.toJSON() });
}

export async function deleteMe(req, res) {
  await userRepository.remove(req.auth.sub);
  clearSessionCookie(res);
  res.status(204).end();
}

export function logout(_req, res) {
  clearSessionCookie(res);
  res.status(204).end();
}

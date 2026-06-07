import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

const BCRYPT_ROUNDS = 12;

/** Hash a plaintext password using bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** Generate a stable openId for an email-registered account. */
export function generateEmailOpenId(): string {
  return `email_${nanoid(21)}`;
}

/**
 * Sign a session JWT for the given user and set it as an httpOnly cookie.
 * Reuses the same session mechanism as the rest of the app (HS256 / JWT_SECRET).
 */
export async function issueSessionCookie(
  req: Request,
  res: Response,
  user: { openId: string; name: string | null },
): Promise<void> {
  const SESSION_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias (antes: 1 ano)
  const token = await sdk.signSession(
    { openId: user.openId, appId: process.env.VITE_APP_ID ?? "go-app", name: user.name ?? "" },
    { expiresInMs: SESSION_MS },
  );
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_MS });
}

import crypto from "crypto";

/**
 * Criptografia em repouso para segredos por usuário (ex.: token GO360).
 * AES-256-GCM. A chave vem de TOKEN_ENC_KEY (qualquer string — derivamos 32
 * bytes via SHA-256). SEM a chave, vira no-op (mantém texto puro), então é
 * seguro/retrocompatível: nada quebra até você configurar a chave, e valores
 * legados em texto puro continuam sendo lidos normalmente.
 *
 * Formato cifrado: "enc:v1:<iv b64>:<tag b64>:<ciphertext b64>"
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const key = getKey();
  if (!key) return plain; // no-op sem chave
  if (plain.startsWith(PREFIX)) return plain; // já cifrado
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legado/texto puro
  const key = getKey();
  if (!key) return null; // cifrado mas sem chave → não dá pra ler
  try {
    const [, , ivB64, tagB64, ctB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, generateEmailOpenId } from "./auth";

describe("password hashing", () => {
  it("hashes a password into a non-reversible bcrypt string", async () => {
    const hash = await hashPassword("s3nha-super-secreta");
    expect(hash).not.toBe("s3nha-super-secreta");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("minhaSenha123");
    await expect(verifyPassword("minhaSenha123", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("minhaSenha123");
    await expect(verifyPassword("senhaErrada", hash)).resolves.toBe(false);
  });

  it("rejects verification when no hash is stored", async () => {
    await expect(verifyPassword("qualquer", null)).resolves.toBe(false);
  });

  it("generates unique, prefixed openIds for email accounts", () => {
    const a = generateEmailOpenId();
    const b = generateEmailOpenId();
    expect(a.startsWith("email_")).toBe(true);
    expect(a).not.toBe(b);
  });
});

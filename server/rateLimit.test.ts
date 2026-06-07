import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, __resetRateLimits } from "./rateLimit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("allows requests up to the max within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", { max: 3, windowMs: 1000 }).allowed).toBe(true);
    }
  });

  it("blocks once the max is exceeded and reports a retry delay", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", { max: 3, windowMs: 1000 });
    const result = rateLimit("k", { max: 3, windowMs: 1000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", { max: 3, windowMs: 1000 });
    expect(rateLimit("b", { max: 3, windowMs: 1000 }).allowed).toBe(true);
  });
});

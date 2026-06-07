import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reverseGeocode } from "./geocode";

describe("reverseGeocode (OpenStreetMap / Nominatim)", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns the formatted address when Nominatim responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_name: "Avenida Paulista, 1000, São Paulo, SP, Brasil" }),
      }),
    );

    const address = await reverseGeocode("-23.561414", "-46.656139");
    expect(address).toBe("Avenida Paulista, 1000, São Paulo, SP, Brasil");
  });

  it("returns null when there is no result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    const address = await reverseGeocode("0", "0");
    expect(address).toBeNull();
  });

  it("throws on a network/HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" }),
    );

    await expect(reverseGeocode("-23.56", "-46.65")).rejects.toThrow();
  });
});

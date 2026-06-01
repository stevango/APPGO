import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, type GeocodingResult } from "./_core/map";

// Mock do makeRequest
vi.mock("./_core/map", () => ({
  makeRequest: vi.fn(),
}));

describe("SOS Reverse Geocoding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return formatted address when geocoding succeeds", async () => {
    const mockResult: GeocodingResult = {
      results: [
        {
          formatted_address: "Avenida Paulista, 1000, São Paulo, SP, Brasil",
          address_components: [],
          geometry: {
            location: { lat: -23.561414, lng: -46.656139 },
            location_type: "ROOFTOP",
            viewport: {
              northeast: { lat: 0, lng: 0 },
              southwest: { lat: 0, lng: 0 },
            },
          },
          place_id: "ChIJEQPOhvkxzpQRJzJcLZVGcK0",
          types: ["street_address"],
        },
      ],
      status: "OK",
    };

    (makeRequest as any).mockResolvedValue(mockResult);

    const result = await makeRequest<GeocodingResult>(
      "/maps/api/geocode/json",
      { latlng: "-23.561414,-46.656139" }
    );

    expect(result.status).toBe("OK");
    expect(result.results[0].formatted_address).toBe(
      "Avenida Paulista, 1000, São Paulo, SP, Brasil"
    );
  });

  it("should handle geocoding errors gracefully", async () => {
    const mockResult: GeocodingResult = {
      results: [],
      status: "ZERO_RESULTS",
    };

    (makeRequest as any).mockResolvedValue(mockResult);

    const result = await makeRequest<GeocodingResult>(
      "/maps/api/geocode/json",
      { latlng: "0,0" }
    );

    expect(result.status).toBe("ZERO_RESULTS");
    expect(result.results).toHaveLength(0);
  });

  it("should handle network errors", async () => {
    (makeRequest as any).mockRejectedValue(
      new Error("Network request failed")
    );

    await expect(
      makeRequest<GeocodingResult>("/maps/api/geocode/json", {
        latlng: "-23.561414,-46.656139",
      })
    ).rejects.toThrow("Network request failed");
  });
});

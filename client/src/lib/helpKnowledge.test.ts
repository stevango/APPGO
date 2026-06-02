import { describe, expect, it } from "vitest";
import { matchHelp } from "./helpKnowledge";

describe("help assistant matching", () => {
  it("matches tracking questions (accent/case-insensitive)", () => {
    expect(matchHelp("Como faço pra RASTREAR meu carro?")?.id).toBe("rastrear");
    expect(matchHelp("onde está meu veículo no mapa")?.id).toBe("rastrear");
  });

  it("matches geofence, sos and notifications", () => {
    expect(matchHelp("quero criar uma cerca eletrônica")?.id).toBe("cerca");
    expect(matchHelp("como funciona o sos de emergência")?.id).toBe("sos");
    expect(matchHelp("ativar notificações push")?.id).toBe("push");
  });

  it("returns null for unrelated questions (logged for improvement)", () => {
    expect(matchHelp("qual a previsão do tempo amanhã")).toBeNull();
    expect(matchHelp("")).toBeNull();
  });
});

import * as db from "./db";
import { sendPushToUser } from "./pushService";

// Reengajamento: quem não abre o app há alguns dias recebe um empurrãozinho
// gentil. Só chega em quem tem push habilitado (sendPushToUser é no-op sem
// inscrição). Deduplicado para no máx. 1x a cada 7 dias por usuário.
const INACTIVE_DAYS = 7;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const MESSAGES = [
  "Sentimos sua falta 👀 Dá uma olhada onde está seu veículo agora.",
  "Tudo certo por aí? Confira a localização e o status do seu rastreador.",
  "Seu GO está de olho 24h. Abra para ver o resumo da sua proteção. 🛡️",
];

export async function sendEngagementNudges(): Promise<{ sent: number; total: number }> {
  const users = await db.getInactiveUsersForNudge(INACTIVE_DAYS, COOLDOWN_MS);
  let sent = 0;
  for (const u of users) {
    const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    await sendPushToUser(u.userId, {
      title: u.name ? `Oi, ${u.name.split(" ")[0]}!` : "GO • Sentimos sua falta",
      body,
      tag: "go-engagement",
      data: { url: "/" },
    });
    await db.markEngagementNudgeSent(u.userId);
    sent++;
  }
  return { sent, total: users.length };
}

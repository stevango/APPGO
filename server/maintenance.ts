import * as db from "./db";
import { sendPushToUser } from "./pushService";

// Alerta de manutenção: rastreador parou de posicionar.
const STALE_THRESHOLD_DAYS = 3;           // a partir de quando avisamos
const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000; // processa no máx. 1x/dia por veículo

function maintenanceBody(plate: string, days: number): string {
  if (days <= 7) {
    return `Seu rastreador (${plate}) está há ${days} dias sem posicionar. Pode ser sinal ou energia — vamos verificar juntos?`;
  }
  return `Seu rastreador (${plate}) está há ${days} dias sem comunicar. Recomendamos uma manutenção para voltar a proteger seu bem. 💛`;
}

// O card no app é atualizado TODO dia (a contagem sobe). O push (que vibra o
// celular) só vai na 1ª detecção e depois semanalmente, para informar sem
// incomodar: dia 3, 10, 17, 24... (a cada 7 dias a partir do limiar).
function shouldPush(days: number, thresholdDays: number): boolean {
  if (days < thresholdDays) return false;
  return (days - thresholdDays) % 7 === 0;
}

/**
 * Para cada cliente cujo rastreador está há vários dias sem posicionar:
 *  - atualiza 1 alerta no app por veículo, todo dia, com a contagem de dias
 *    (49, 50, 51...) — o cliente sempre vê que está parado, sem poluir a lista;
 *  - dispara o push só na 1ª vez e depois semanalmente (sem fadiga de push).
 * Pensado para um agendador diário (/api/cron/maintenance-reminders).
 */
export async function sendMaintenanceReminders(
  thresholdDays = STALE_THRESHOLD_DAYS,
): Promise<{ sent: number; pushed: number; skipped: number; total: number }> {
  const stale = await db.getStaleTrackedVehicles(thresholdDays);
  let sent = 0;
  let pushed = 0;
  let skipped = 0;

  for (const v of stale) {
    const processedToday =
      v.lastStaleAlertAt && Date.now() - new Date(v.lastStaleAlertAt).getTime() < DAILY_COOLDOWN_MS;
    if (processedToday) { skipped++; continue; }

    const body = maintenanceBody(v.plate, v.daysStale);

    // Card no app: um por veículo, atualizado diariamente (aparece em "Alertas"
    // mesmo sem push habilitado).
    await db.upsertMaintenanceNotification(v.userId, v.vehicleId, "Rastreador sem posicionar", body);
    sent++;

    // Push: só na 1ª detecção e depois semanalmente.
    if (shouldPush(v.daysStale, thresholdDays)) {
      await sendPushToUser(v.userId, {
        title: "GO • Rastreador sem posicionar",
        body,
        tag: `go-maintenance-${v.vehicleId}`,
        data: { url: "/vehicle-care" },
      });
      pushed++;
    }

    await db.markStaleAlertSent(v.vehicleId);
  }

  return { sent, pushed, skipped, total: stale.length };
}

import { sendOverdueReminders } from "./billing";
import { sendMaintenanceReminders } from "./maintenance";
import { sendEngagementNudges } from "./engagement";

// In-process daily jobs. The HTTP cron endpoints (/api/cron/*) still exist for
// manual/external triggering, but this runs automatically on any host that
// keeps the process alive (Railway), so nothing needs to be configured there.
//
// Both reminder functions are internally deduplicated (billing ~20h, manutenção
// 3 dias por veículo), so running every few hours NEVER spams the customer — it
// just guarantees the daily reminder goes out even after restarts.
const INTERVAL_MS = 6 * 60 * 60 * 1000; // a cada 6h

async function runDailyJobs() {
  try {
    const billing = await sendOverdueReminders();
    console.log("[Scheduler] billing-reminders", billing);
  } catch (e) {
    console.error("[Scheduler] billing-reminders failed", e);
  }
  try {
    const maintenance = await sendMaintenanceReminders();
    console.log("[Scheduler] maintenance-reminders", maintenance);
  } catch (e) {
    console.error("[Scheduler] maintenance-reminders failed", e);
  }
  try {
    const engagement = await sendEngagementNudges();
    console.log("[Scheduler] engagement-nudges", engagement);
  } catch (e) {
    console.error("[Scheduler] engagement-nudges failed", e);
  }
}

let started = false;

/** Starts the in-process scheduler once. No-op if disabled or already running. */
export function startScheduler() {
  if (started) return;
  if (process.env.SCHEDULER_DISABLED === "1") {
    console.log("[Scheduler] disabled via SCHEDULER_DISABLED=1");
    return;
  }
  started = true;
  // Run shortly after boot, then periodically.
  setTimeout(() => { void runDailyJobs(); }, 60_000);
  setInterval(() => { void runDailyJobs(); }, INTERVAL_MS);
  console.log("[Scheduler] started (billing + maintenance reminders, every 6h)");
}

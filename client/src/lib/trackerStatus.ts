/**
 * Status do rastreador por tempo desde a última comunicação (regra GO, usada em
 * todas as telas para ficar consistente):
 *   < 24h  → Online
 *   24–72h → Standby
 *   ≥ 72h  → Offline (ou nunca comunicou)
 */
export type TrackerStatus = {
  key: "online" | "standby" | "offline";
  label: string;
  bg: string;
  dot: string;
  text: string;
  stale: boolean;
  ageH: number;
};

export function getTrackerStatus(lastSignalAt?: string | Date | null): TrackerStatus {
  const ms = lastSignalAt ? new Date(lastSignalAt).getTime() : 0;
  const ageH = ms ? (Date.now() - ms) / 3600000 : Infinity;
  if (ageH >= 72) {
    return { key: "offline", label: "Offline", bg: "bg-red-50", dot: "bg-red-400", text: "text-red-500", stale: true, ageH };
  }
  if (ageH >= 24) {
    return { key: "standby", label: "Standby", bg: "bg-amber-50", dot: "bg-amber-500", text: "text-amber-600", stale: true, ageH };
  }
  return { key: "online", label: "Online", bg: "bg-green-50", dot: "bg-green-500 pulse-online", text: "text-green-600", stale: false, ageH };
}

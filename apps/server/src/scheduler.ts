import cron from "node-cron";
import type { RadarService } from "./radar.js";

export function startDailyRadarScheduler(radar: RadarService): (() => void) | null {
  if (process.env.DAILY_RADAR_ENABLED !== "true") return null;
  const expression = process.env.DAILY_RADAR_CRON ?? "0 8 * * *";
  const timezone = process.env.PERSONAL_OS_TIMEZONE ?? "Asia/Tokyo";
  const mode = process.env.CODEX_MODE === "live" ? "live" : "demo";
  const task = cron.schedule(expression, () => {
    const execution = mode === "live" ? radar.generateLive() : Promise.resolve(radar.generateDemo());
    void execution.catch((error) => console.error("Daily radar failed", error));
  }, { timezone });
  return () => task.stop();
}

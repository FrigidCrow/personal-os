import cron from "node-cron";
import type { RadarService } from "./radar.js";
import type { AgentDispatcher } from "./dispatcher.js";

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

export function startAgentDispatcher(dispatcher: AgentDispatcher, intervalMilliseconds = 15_000): () => void {
  const run = () => {
    try {
      const result = dispatcher.tick();
      if (result.skipped.length > 0) console.warn("Agent dispatcher skipped tasks", result.skipped);
    } catch (error) {
      console.error("Agent dispatcher tick failed", error);
    }
  };
  const timer = setInterval(run, intervalMilliseconds);
  timer.unref();
  run();
  return () => clearInterval(timer);
}

import { CronExpressionParser } from "cron-parser";
import type { PersonalOsDatabase } from "@personal-os/database";
import type { RadarScheduleInput } from "@personal-os/domain";
import type { RadarService } from "./radar.js";
import type { AgentDispatcher } from "./dispatcher.js";

type RadarRunner = Pick<RadarService, "generateDemo" | "generateLive">;

export function nextRadarOccurrence(input: RadarScheduleInput, after = new Date()): Date {
  return CronExpressionParser.parse(input.expression, {
    currentDate: after,
    tz: input.timezone
  }).next().toDate();
}

export function validateRadarSchedule(input: RadarScheduleInput, currentDate = new Date()): void {
  try {
    nextRadarOccurrence(input, currentDate);
  } catch (error) {
    throw new Error(`Invalid radar schedule or timezone: ${error instanceof Error ? error.message : "unknown error"}`, { cause: error });
  }
}

export async function runDailyRadarTick(
  database: PersonalOsDatabase,
  radar: RadarRunner,
  currentTime = new Date(),
  mode: "demo" | "live" = process.env.CODEX_MODE === "live" ? "live" : "demo",
  scheduleGraceMilliseconds = 60_000
): Promise<"disabled" | "initialized" | "waiting" | "skipped" | "succeeded" | "failed"> {
  const schedule = database.getRadarSchedule();
  if (!schedule.enabled) return "disabled";

  if (!schedule.nextRunAt) {
    try {
      database.updateRadarScheduleRuntime({
        nextRunAt: nextRadarOccurrence(schedule, currentTime).toISOString(),
        lastStatus: "idle",
        lastError: null
      });
      return "initialized";
    } catch (error) {
      database.updateRadarScheduleRuntime({
        lastStatus: "failed",
        lastError: error instanceof Error ? error.message : "Radar schedule initialization failed."
      });
      return "failed";
    }
  }

  const scheduledFor = new Date(schedule.nextRunAt);
  if (scheduledFor.getTime() > currentTime.getTime()) return "waiting";

  let nextRunAt: string;
  try {
    nextRunAt = nextRadarOccurrence(schedule, currentTime).toISOString();
  } catch (error) {
    database.updateRadarScheduleRuntime({
      lastStatus: "failed",
      lastError: error instanceof Error ? error.message : "Radar schedule calculation failed."
    });
    return "failed";
  }

  if (currentTime.getTime() - scheduledFor.getTime() > scheduleGraceMilliseconds && !schedule.catchUp) {
    database.updateRadarScheduleRuntime({
      nextRunAt,
      lastCompletedAt: currentTime.toISOString(),
      lastStatus: "skipped",
      lastError: `Missed radar run at ${schedule.nextRunAt}; catch-up is disabled.`
    });
    return "skipped";
  }

  database.updateRadarScheduleRuntime({
    nextRunAt,
    lastStartedAt: currentTime.toISOString(),
    lastStatus: "running",
    lastError: null
  });
  try {
    if (mode === "live") await radar.generateLive();
    else radar.generateDemo();
    database.updateRadarScheduleRuntime({
      lastCompletedAt: new Date().toISOString(),
      lastStatus: "succeeded",
      lastError: null
    });
    return "succeeded";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily radar failed.";
    database.updateRadarScheduleRuntime({
      lastCompletedAt: new Date().toISOString(),
      lastStatus: "failed",
      lastError: message
    });
    console.error("Daily radar failed", error);
    return "failed";
  }
}

export function startDailyRadarScheduler(
  radar: RadarRunner,
  database: PersonalOsDatabase,
  intervalMilliseconds = 15_000
): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runDailyRadarTick(database, radar);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => { void run(); }, intervalMilliseconds);
  timer.unref();
  void run();
  return () => clearInterval(timer);
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

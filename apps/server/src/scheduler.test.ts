import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalOsDatabase } from "@personal-os/database";
import { nextRadarOccurrence, runDailyRadarTick, validateRadarSchedule } from "./scheduler.js";

describe("daily radar scheduler", () => {
  let database: PersonalOsDatabase;

  beforeEach(() => {
    database = new PersonalOsDatabase({ filePath: ":memory:", seed: false });
  });

  afterEach(() => database.close());

  it("initializes the default 08:00 Tokyo run without executing immediately", async () => {
    const radar = { generateDemo: vi.fn(), generateLive: vi.fn() };
    const result = await runDailyRadarTick(database, radar, new Date("2026-07-28T00:00:00.000Z"), "live");

    expect(result).toBe("initialized");
    expect(radar.generateLive).not.toHaveBeenCalled();
    expect(database.getRadarSchedule().nextRunAt).toBe("2026-07-28T23:00:00.000Z");
  });

  it("executes one due live report and advances to the next day", async () => {
    database.configureRadarSchedule({ enabled: true, expression: "0 8 * * *", timezone: "Asia/Tokyo", catchUp: true, executor: "codex", searchProfile: "技术服务", customInstructions: "" }, "2026-07-28T23:00:00.000Z");
    const radar = { generateDemo: vi.fn(), generateLive: vi.fn().mockResolvedValue({}) };
    const result = await runDailyRadarTick(database, radar, new Date("2026-07-28T23:00:00.000Z"), "live");

    expect(result).toBe("succeeded");
    expect(radar.generateLive).toHaveBeenCalledOnce();
    expect(radar.generateDemo).not.toHaveBeenCalled();
    expect(database.getRadarSchedule()).toEqual(expect.objectContaining({
      nextRunAt: "2026-07-29T23:00:00.000Z",
      lastStartedAt: "2026-07-28T23:00:00.000Z",
      lastStatus: "succeeded",
      lastError: null
    }));
  });

  it("skips an overdue run when catch-up is disabled", async () => {
    database.configureRadarSchedule({ enabled: true, expression: "0 8 * * *", timezone: "Asia/Tokyo", catchUp: false, executor: "codex", searchProfile: "技术服务", customInstructions: "" }, "2026-07-27T23:00:00.000Z");
    const radar = { generateDemo: vi.fn(), generateLive: vi.fn() };
    const result = await runDailyRadarTick(database, radar, new Date("2026-07-28T02:00:00.000Z"), "live");

    expect(result).toBe("skipped");
    expect(radar.generateLive).not.toHaveBeenCalled();
    expect(database.getRadarSchedule()).toEqual(expect.objectContaining({ lastStatus: "skipped", nextRunAt: "2026-07-28T23:00:00.000Z" }));
  });

  it("leaves a due OpenWorker run claimable instead of calling Codex", async () => {
    database.configureRadarSchedule({ enabled: true, expression: "0 8 * * *", timezone: "Asia/Tokyo", catchUp: true, executor: "openworker", searchProfile: "技术服务", customInstructions: "" }, "2026-07-28T23:00:00.000Z");
    const radar = { generateDemo: vi.fn(), generateLive: vi.fn() };

    const result = await runDailyRadarTick(database, radar, new Date("2026-07-28T23:00:00.000Z"), "live");

    expect(result).toBe("awaiting_worker");
    expect(radar.generateLive).not.toHaveBeenCalled();
    expect(database.getRadarSchedule().nextRunAt).toBe("2026-07-28T23:00:00.000Z");
  });

  it("rejects invalid expressions and timezones", () => {
    expect(() => validateRadarSchedule({ enabled: true, expression: "invalid", timezone: "Asia/Tokyo", catchUp: true, executor: "openworker", searchProfile: "技术服务", customInstructions: "" })).toThrow("Invalid radar schedule");
    expect(nextRadarOccurrence({ enabled: true, expression: "30 6 * * *", timezone: "Asia/Tokyo", catchUp: true, executor: "openworker", searchProfile: "技术服务", customInstructions: "" }, new Date("2026-07-28T00:00:00.000Z")).toISOString()).toBe("2026-07-28T21:30:00.000Z");
  });
});

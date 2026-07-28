import { CronExpressionParser } from "cron-parser";
import type { TaskInput } from "@personal-os/domain";

function configString(input: TaskInput, key: string): string | null {
  const value = input.triggerConfig?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function validateTaskAutomation(input: TaskInput, currentDate = new Date()): void {
  if (input.triggerType === "cron") {
    const expression = configString(input, "expression");
    if (!expression) throw new Error("Cron trigger requires triggerConfig.expression.");
    try {
      CronExpressionParser.parse(expression, { currentDate, tz: input.triggerTimezone });
    } catch (error) {
      throw new Error(`Invalid cron trigger or timezone: ${error instanceof Error ? error.message : "unknown error"}`, { cause: error });
    }
  }
  if (input.triggerType === "event" && !configString(input, "eventName")) {
    throw new Error("Event trigger requires triggerConfig.eventName.");
  }
  if (input.triggerType === "dependency") {
    const dependencyTaskId = configString(input, "taskId");
    if (!dependencyTaskId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dependencyTaskId)) {
      throw new Error("Dependency trigger requires a UUID in triggerConfig.taskId.");
    }
  }
}

export function nextCronOccurrence(input: TaskInput, after: Date): Date {
  validateTaskAutomation(input, after);
  const expression = configString(input, "expression")!;
  return CronExpressionParser.parse(expression, {
    currentDate: after,
    tz: input.triggerTimezone
  }).next().toDate();
}

export function cronCatchUpEnabled(input: TaskInput): boolean {
  return input.triggerConfig?.catchUp === true;
}

export function eventNameForTask(input: TaskInput): string | null {
  return configString(input, "eventName");
}

export function dependencyTaskId(input: TaskInput): string | null {
  return configString(input, "taskId");
}

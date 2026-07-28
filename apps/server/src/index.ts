import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { createDatabase } from "@personal-os/database";
import { createApp } from "./app.js";
import { CodexOrchestrator } from "./codex.js";
import { AgentDispatcher } from "./dispatcher.js";
import { RadarService } from "./radar.js";
import { startAgentDispatcher, startDailyRadarScheduler } from "./scheduler.js";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const defaultDatabasePath = fileURLToPath(new URL("../../../data/personal-os.db", import.meta.url));
// Production and normal development starts must never repopulate an intentionally
// emptied personal database. Demo records are opt-in through `npm run seed`.
const database = createDatabase(process.env.DATABASE_PATH ?? defaultDatabasePath, false);
const radar = new RadarService(database);
const codex = new CodexOrchestrator(database);
const dispatcher = new AgentDispatcher(database, codex);
const stopScheduler = startDailyRadarScheduler(radar, database);
const stopDispatcher = startAgentDispatcher(dispatcher);
const app = createApp({ database, radar, codex, dispatcher });

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Personal OS API listening on http://${hostname}:${info.port}`);
});

function shutdown(): void {
  stopScheduler();
  stopDispatcher();
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { createDatabase } from "@personal-os/database";
import { createApp } from "./app.js";
import { RadarService } from "./radar.js";
import { startDailyRadarScheduler } from "./scheduler.js";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const defaultDatabasePath = fileURLToPath(new URL("../../../data/personal-os.db", import.meta.url));
const database = createDatabase(process.env.DATABASE_PATH ?? defaultDatabasePath, true);
const radar = new RadarService(database);
const stopScheduler = startDailyRadarScheduler(radar);
const app = createApp({ database, radar });

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Personal OS API listening on http://${hostname}:${info.port}`);
});

function shutdown(): void {
  stopScheduler?.();
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

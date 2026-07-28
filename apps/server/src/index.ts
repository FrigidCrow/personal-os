import { serve } from "@hono/node-server";
import { createDatabase } from "@personal-os/database";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const database = createDatabase(process.env.DATABASE_PATH ?? "./data/personal-os.db", true);
const app = createApp({ database });

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Personal OS API listening on http://localhost:${info.port}`);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);


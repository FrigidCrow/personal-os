import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDatabase } from "@personal-os/database";
import { createPersonalOsMcpServer } from "./server.js";

const defaultDatabasePath = fileURLToPath(new URL("../../../data/personal-os.db", import.meta.url));
const database = createDatabase(process.env.DATABASE_PATH ?? defaultDatabasePath, true);
const configuredLease = Number(process.env.WORKER_LEASE_MILLISECONDS ?? 120_000);
const leaseMilliseconds = Number.isFinite(configuredLease) && configuredLease >= 30_000
  ? configuredLease
  : 120_000;
const server = createPersonalOsMcpServer(database, { leaseMilliseconds });
const transport = new StdioServerTransport();

await server.connect(transport);

async function shutdown(): Promise<void> {
  await server.close();
  database.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

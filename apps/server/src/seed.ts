import { fileURLToPath } from "node:url";
import { createDatabase } from "@personal-os/database";

const defaultDatabasePath = fileURLToPath(new URL("../../../data/personal-os.db", import.meta.url));
const database = createDatabase(process.env.DATABASE_PATH ?? defaultDatabasePath, true);
const dashboard = database.getDashboard();

console.log(`Seed ready: ${dashboard.projects.length} projects, ${dashboard.focusTasks.length} focus tasks, ${dashboard.opportunities.length} opportunities.`);
database.close();

import { createDatabase } from "@personal-os/database";

const database = createDatabase(process.env.DATABASE_PATH ?? "./data/personal-os.db", true);
const dashboard = database.getDashboard();

console.log(`Seed ready: ${dashboard.projects.length} projects, ${dashboard.focusTasks.length} focus tasks, ${dashboard.opportunities.length} opportunities.`);
database.close();


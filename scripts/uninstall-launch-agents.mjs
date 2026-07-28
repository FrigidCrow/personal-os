import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const uid = process.getuid?.() ?? 0;
const directory = join(homedir(), "Library", "LaunchAgents");
const labels = ["com.frigidcrow.personal-os.api", "com.frigidcrow.personal-os.web"];

for (const label of labels) {
  const target = join(directory, `${label}.plist`);
  if (!apply) {
    console.log(JSON.stringify({ apply: false, label, target, exists: existsSync(target) }));
    continue;
  }
  spawnSync("launchctl", ["bootout", `gui/${uid}`, target], { stdio: "ignore" });
  if (existsSync(target)) rmSync(target);
  console.log(JSON.stringify({ apply: true, label, removed: true }));
}

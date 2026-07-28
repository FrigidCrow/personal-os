import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@personal-os/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
      "@personal-os/database": fileURLToPath(new URL("./packages/database/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"]
  }
});

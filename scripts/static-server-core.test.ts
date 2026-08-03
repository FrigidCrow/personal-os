import { describe, expect, it } from "vitest";
import { contentType, isApiPath, resolveStaticPath } from "./static-server-core.mjs";

describe("production static server", () => {
  it("resolves SPA assets inside the configured root", () => {
    expect(resolveStaticPath("/runtime/web-v2", "/assets/app.js")).toBe("/runtime/web-v2/assets/app.js");
    expect(resolveStaticPath("/runtime/web-v2", "/")).toBe("/runtime/web-v2/index.html");
  });

  it("rejects encoded traversal and identifies API proxy paths", () => {
    expect(resolveStaticPath("/runtime/web-v2", "/%2e%2e/secrets")).toBeNull();
    expect(isApiPath("/api/v2/health")).toBe(true);
    expect(isApiPath("/assets/api.svg")).toBe(false);
  });

  it("uses explicit browser content types", () => {
    expect(contentType("app.js")).toContain("text/javascript");
    expect(contentType("font.woff2")).toBe("font/woff2");
  });
});

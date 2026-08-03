import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { resolve } from "node:path";
import { URL } from "node:url";
import { contentType, isApiPath, resolveStaticPath } from "./static-server-core.mjs";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5273);
const staticRoot = resolve(process.env.STATIC_ROOT ?? ".");
const apiTarget = new URL(process.env.API_TARGET ?? "http://127.0.0.1:8787");

const server = createServer((incoming, outgoing) => {
  const url = new URL(incoming.url ?? "/", `http://${host}:${port}`);
  if (isApiPath(url.pathname)) {
    const proxy = httpRequest({
      protocol: apiTarget.protocol,
      hostname: apiTarget.hostname,
      port: apiTarget.port,
      method: incoming.method,
      path: `${url.pathname}${url.search}`,
      headers: { ...incoming.headers, host: apiTarget.host }
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    proxy.on("error", (error) => {
      if (!outgoing.headersSent) outgoing.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      outgoing.end(JSON.stringify({ success: false, error: { code: "API_UNAVAILABLE", message: error.message } }));
    });
    incoming.pipe(proxy);
    return;
  }

  const candidate = resolveStaticPath(staticRoot, url.pathname);
  if (candidate === null) {
    outgoing.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("Forbidden");
    return;
  }
  const filePath = existsSync(candidate) && statSync(candidate).isFile() ? candidate : resolve(staticRoot, "index.html");
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    outgoing.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("Not found");
    return;
  }
  outgoing.writeHead(200, { "content-type": contentType(filePath), "cache-control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
  if (incoming.method === "HEAD") outgoing.end();
  else createReadStream(filePath).pipe(outgoing);
});

server.listen(port, host, () => console.log(`Personal OS Web listening on http://${host}:${port}; static root ${staticRoot}`));

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => process.exit(0)));

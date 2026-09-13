import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number(process.env.PORT || 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveTarget(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  if (pathname.includes("\0") || pathname.split("/").includes("..")) throw new Error("path rejected");
  const target = path.resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error("path rejected");
  return { pathname, target };
}

const server = http.createServer((request, response) => {
  try {
    const { pathname, target } = resolveTarget(request.url);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      if (!pathname.endsWith("/") && pathname !== "/") {
        response.writeHead(301, { Location: pathname + "/" });
        response.end();
        return;
      }
      const index = path.join(target, "index.html");
      if (fs.existsSync(index)) return send(index, response);
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return send(target, response);
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});

function send(file, response) {
  const headers = {
    "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store",
    "Content-Security-Policy": file.includes(`${path.sep}demo${path.sep}`)
      ? "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; frame-ancestors 'self'"
      : "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'self'",
  };
  response.writeHead(200, headers);
  fs.createReadStream(file).pipe(response);
}

server.listen(port, "127.0.0.1", () => console.log(`Gallery preview http://127.0.0.1:${port}/`));

import Fastify from "fastify";
import cors from "@fastify/cors";
import chokidar from "chokidar";
import path from "node:path";
import { Storage } from "./storage.js";

const WORKSPACE = process.env.STUDIO_WORKSPACE || path.join(process.env.HOME || "/root", "drawdb-projects");
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
const storage = new Storage(WORKSPACE);

await fastify.register(cors, { origin: CORS_ORIGIN });
await storage.init();

// --- REST ---

fastify.get("/api/health", async () => ({
  status: "ok",
  workspace: WORKSPACE,
  time: new Date().toISOString(),
}));

fastify.get("/api/projects", async () => storage.list());

fastify.get("/api/projects/:slug", async (req, reply) => {
  try {
    return await storage.read(req.params.slug);
  } catch (err) {
    if (err.code === "ENOENT") return reply.code(404).send({ error: "not found" });
    throw err;
  }
});

fastify.post("/api/projects", async (req, reply) => {
  try {
    return await storage.create(req.body || {});
  } catch (err) {
    return reply.code(409).send({ error: err.message });
  }
});

fastify.put("/api/projects/:slug", async (req) => storage.write(req.params.slug, req.body || {}));

fastify.patch("/api/projects/:slug", async (req, reply) => {
  try {
    return await storage.patch(req.params.slug, req.body || {});
  } catch (err) {
    if (err.code === "ENOENT") return reply.code(404).send({ error: "not found" });
    throw err;
  }
});

fastify.delete("/api/projects/:slug", async (req, reply) => {
  try {
    return await storage.remove(req.params.slug);
  } catch (err) {
    if (err.code === "ENOENT") return reply.code(404).send({ error: "not found" });
    throw err;
  }
});

// --- SSE: file watcher ---
// Klienci subskrybują `/api/events`, dostają eventy gdy pliki się zmienią
// (Launcher live-update Recent, edytor reload przy git pull, etc.).

const sseClients = new Set();

const watcher = chokidar.watch(`${WORKSPACE}/*.drawdb.json`, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
});

const ext = ".drawdb.json";
const slugFromPath = (p) => path.basename(p).slice(0, -ext.length);

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const reply of sseClients) {
    reply.raw.write(payload);
  }
}

watcher
  .on("add", (p) => broadcast("add", { diagramId: slugFromPath(p) }))
  .on("change", (p) => broadcast("change", { diagramId: slugFromPath(p) }))
  .on("unlink", (p) => broadcast("unlink", { diagramId: slugFromPath(p) }));

fastify.get("/api/events", (req, reply) => {
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  reply.raw.write(": connected\n\n");
  sseClients.add(reply);

  const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 30000);

  req.raw.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(reply);
  });
});

// --- start ---

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`workspace=${WORKSPACE} cors=${CORS_ORIGIN.join(",")}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

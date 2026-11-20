import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { setupWebSocket } from "./modules/chat/chat.socket.js";

const server = app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});

const wss = setupWebSocket(server);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  const forceExit = setTimeout(() => {
    console.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    for (const client of wss.clients) {
      client.close(1001, "server shutting down");
    }
    await new Promise<void>((resolve) => wss.close(() => resolve()));

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await pool.end();

    console.log("shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("shutdown failed:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
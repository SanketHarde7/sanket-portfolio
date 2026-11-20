import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { getUserById } from "../user/user.queries.js";
import type { Message } from "./chat.queries.js";
import {
  saveMessage,
  syncMessages,
  confirmDelivered,
  ChatError,
} from "./chat.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const clients = new Map<string, WebSocket>();

const HEARTBEAT_INTERVAL_MS = 30_000;

const alive = new WeakSet<WebSocket>();

function sendJson(socket: WebSocket | undefined, payload: object) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function toDelivery(m: Message) {
  return {
    type: "message",
    id: m.id,
    conversationId: m.conversation_id,
    from: m.sender_id,
    text: m.body,
  };
}

function reportError(socket: WebSocket, err: unknown) {
  if (err instanceof ChatError) {
    sendJson(socket, { type: "error", error: err.message });
  } else {
    console.error("message handling failed:", err);
    sendJson(socket, { type: "error", error: "server error" });
  }
}

async function connect(socket: WebSocket, rawUserId: string | null) {
  try {
    if (!rawUserId || !UUID_REGEX.test(rawUserId)) {
      socket.close(1008, "invalid userId");
      return null;
    }

    const user = await getUserById(rawUserId);
    if (!user) {
      socket.close(1008, "user not found");
      return null;
    }

    if (socket.readyState !== WebSocket.OPEN) return null;

    clients.set(user.id, socket);
    console.log(`${user.username} connected (online: ${clients.size})`);

    return user;
  } catch (err) {
    console.error("connect failed:", err);
    socket.close(1011, "server error");
    return null;
  }
}

async function handleDelivered(socket: WebSocket, userId: string, id: unknown) {
  if (typeof id !== "string" || !ULID_REGEX.test(id.toUpperCase())) {
    sendJson(socket, { type: "error", error: "invalid message id" });
    return;
  }

  const messageId = id.toUpperCase();
  const senderId = await confirmDelivered(messageId, userId);
  if (senderId) {
    sendJson(clients.get(senderId), { type: "delivered", id: messageId });
  }
}

const SYNC_LIMIT = 100;

async function handleSync(socket: WebSocket, userId: string, after: unknown) {
  let cursor: string | null = null;

  if (after !== undefined && after !== null) {
    if (typeof after !== "string" || !ULID_REGEX.test(after.toUpperCase())) {
      sendJson(socket, { type: "error", error: "invalid after id" });
      return;
    }
    cursor = after.toUpperCase();
  }

  const { messages, hasMore } = await syncMessages(userId, cursor, SYNC_LIMIT);

  for (const m of messages) {
    sendJson(socket, toDelivery(m));
  }

  sendJson(socket, {
    type: "sync_done",
    hasMore,
    lastId: messages.length > 0 ? messages[messages.length - 1].id : cursor,
  });
}

async function handleChat(
  socket: WebSocket,
  userId: string,
  m: { to?: unknown; text?: unknown; clientId?: unknown }
) {
  const { to, text, clientId } = m;

  if (typeof to !== "string" || typeof text !== "string" || text.trim() === "") {
    sendJson(socket, { type: "error", error: "to and text are required" });
    return;
  }

  const saved = await saveMessage(userId, to, text.trim());

  sendJson(socket, {
    type: "ack",
    clientId: typeof clientId === "string" ? clientId : null,
    id: saved.id,
    conversationId: saved.conversation_id,
  });

  sendJson(clients.get(to.toLowerCase()), toDelivery(saved));
}

async function handleMessage(socket: WebSocket, userId: string, raw: string) {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendJson(socket, { type: "error", error: "invalid JSON" });
    return;
  }

  if (typeof msg !== "object" || msg === null) {
    sendJson(socket, { type: "error", error: "invalid message" });
    return;
  }

  const m = msg as {
    type?: unknown;
    id?: unknown;
    after?: unknown;
    to?: unknown;
    text?: unknown;
    clientId?: unknown;
  };

  if (m.type === "delivered") {
    await handleDelivered(socket, userId, m.id);
  } else if (m.type === "sync") {
    await handleSync(socket, userId, m.after);
  } else {
    await handleChat(socket, userId, m);
  }

}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket, req) => {
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));
    socket.on("error", (err) => console.error("socket error:", err.message));

    const url = new URL(req.url ?? "", "http://localhost");
    const ready = connect(socket, url.searchParams.get("userId"));

    let chain: Promise<void> = Promise.resolve();

    socket.on("message", (data) => {
      const raw = data.toString();
      chain = chain.then(async () => {
        const user = await ready;
        if (!user) return;
        try {
          await handleMessage(socket, user.id, raw);
        } catch (err) {
          reportError(socket, err);
        }
      });
    });

    socket.on("close", async () => {
      const user = await ready;
      if (user && clients.get(user.id) === socket) {
        clients.delete(user.id);
        console.log(`${user.username} disconnected (online: ${clients.size})`);
      }
    });
  });

  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(interval));

  return wss;
  }
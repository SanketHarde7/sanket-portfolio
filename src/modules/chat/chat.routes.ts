import { Router } from "express";
import { getHistory } from "./chat.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const router = Router();

router.get("/:id/messages", async (req, res) => {
  const conversationId = req.params.id;
  const userId = req.query.userId;

  if (!UUID_REGEX.test(conversationId)) {
    res.status(400).json({ error: "invalid conversation id" });
    return;
  }

  if (typeof userId !== "string" || !UUID_REGEX.test(userId)) {
    res.status(400).json({ error: "invalid userId" });
    return;
  }

  let limit = DEFAULT_LIMIT;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      res.status(400).json({ error: `limit must be between 1 and ${MAX_LIMIT}` });
      return;
    }
  }

  let before: string | null = null;
  if (req.query.before !== undefined) {
    const raw = req.query.before;
    if (typeof raw !== "string" || !ULID_REGEX.test(raw.toUpperCase())) {
      res.status(400).json({ error: "invalid before cursor" });
      return;
    }
    before = raw.toUpperCase();
  }

  const messages = await getHistory(userId.toLowerCase(), conversationId.toLowerCase(), limit, before);

  if (messages === null) {
    res.status(403).json({ error: "not allowed" });
    return;
  }

  const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;
  res.json({ messages, nextCursor });
});

export default router;
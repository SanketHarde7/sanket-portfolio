import { pool } from "../../db/pool.js";

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: Date;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
};

async function selectConversation(userA: string, userB: string): Promise<Conversation | null> {
  const result = await pool.query<Conversation>(
    "SELECT id, user_a, user_b, created_at FROM conversations WHERE user_a = $1 AND user_b = $2",
    [userA, userB]
  );
  return result.rows[0] ?? null;
}

export async function findOrCreateConversation(userA: string, userB: string): Promise<Conversation> {
  const existing = await selectConversation(userA, userB);
  if (existing) return existing;

  const inserted = await pool.query<Conversation>(
    `INSERT INTO conversations (user_a, user_b)
     VALUES ($1, $2)
     ON CONFLICT (user_a, user_b) DO NOTHING
     RETURNING id, user_a, user_b, created_at`,
    [userA, userB]
  );
  if (inserted.rows[0]) return inserted.rows[0];

  const afterRace = await selectConversation(userA, userB);
  if (!afterRace) throw new Error("conversation lookup failed after conflict");
  return afterRace;
}

export async function insertMessage(
  id: string,
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const result = await pool.query<Message>(
    `INSERT INTO messages (id, conversation_id, sender_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, conversation_id, sender_id, body, created_at`,
    [id, conversationId, senderId, body]
  );
  return result.rows[0];
}

export async function isConversationMember(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM conversations WHERE id = $1 AND (user_a = $2 OR user_b = $2)",
    [conversationId, userId]
  );
  return result.rows.length > 0;
}

export async function getMessages(
  conversationId: string,
  limit: number,
  before: string | null
): Promise<Message[]> {
  const params: (string | number)[] = [conversationId];
  let cursorClause = "";

  if (before) {
    params.push(before);
    cursorClause = `AND id < $${params.length}`;
  }

  params.push(limit);

  const result = await pool.query<Message>(
    `SELECT id, conversation_id, sender_id, body, created_at
     FROM messages
     WHERE conversation_id = $1 ${cursorClause}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

export async function getPendingMessages(
  userId: string,
  limit: number
): Promise<Message[]> {
  const result = await pool.query<Message>(
    `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.delivered_at IS NULL
       AND m.sender_id <> $1
       AND (c.user_a = $1 OR c.user_b = $1)
     ORDER BY m.id ASC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function markDelivered(
  messageId: string,
  userId: string
): Promise<string | null> {
  const result = await pool.query<{ sender_id: string }>(
    `UPDATE messages m
     SET delivered_at = now()
     FROM conversations c
     WHERE m.id = $1
       AND m.conversation_id = c.id
       AND (c.user_a = $2 OR c.user_b = $2)
       AND m.sender_id <> $2
       AND m.delivered_at IS NULL
     RETURNING m.sender_id`,
    [messageId, userId]
  );
  return result.rows[0]?.sender_id ?? null;
}

export async function getMessagesAfter(
  userId: string,
  after: string,
  limit: number
): Promise<Message[]> {
  const result = await pool.query<Message>(
    `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.user_a = $1 OR c.user_b = $1)
       AND m.id > $2
     ORDER BY m.id ASC
     LIMIT $3`,
    [userId, after, limit]
  );
  return result.rows;
}
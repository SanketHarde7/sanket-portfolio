import { monotonicFactory } from "ulid";
import { getUserById } from "../user/user.queries.js";
import { findOrCreateConversation, insertMessage,isConversationMember,getMessages, getPendingMessages , markDelivered ,getMessagesAfter, type Message } from "./chat.queries.js";

const ulid = monotonicFactory();

export class ChatError extends Error {}

export async function saveMessage(senderId: string, to: string, text: string): Promise<Message> {
  const from = senderId.toLowerCase();
  const target = to.toLowerCase();

  if (from === target) {
    throw new ChatError("cannot message yourself");
  }

  const recipient = await getUserById(target);
  if (!recipient) {
    throw new ChatError("recipient not found");
  }

  const [userA, userB] = from < target ? [from, target] : [target, from];
  const conversation = await findOrCreateConversation(userA, userB);

  return insertMessage(ulid(), conversation.id, from, text);
}

export async function getHistory(
  userId: string,
  conversationId: string,
  limit: number,
  before: string | null
): Promise<Message[] | null> {
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return null;
  return getMessages(conversationId, limit, before);
}

export function confirmDelivered(messageId: string, userId: string) {
  return markDelivered(messageId, userId);
}

export async function syncMessages(
  userId: string,
  after: string | null,
  limit: number
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const rows = after
    ? await getMessagesAfter(userId, after, limit + 1)
    : await getPendingMessages(userId, limit + 1);

  return { messages: rows.slice(0, limit), hasMore: rows.length > limit };
}
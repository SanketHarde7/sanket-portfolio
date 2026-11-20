
CREATE TABLE IF NOT EXISTS  users (
   id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   username TEXT NOT NULL UNIQUE,
   created_at timestamptz not null default now() 
);


CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID NOT NULL REFERENCES users(id),
  user_b      UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id               CHAR(26) PRIMARY KEY,
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  sender_id        UUID NOT NULL REFERENCES users(id),
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_id
  ON messages (conversation_id, id DESC);


ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_undelivered
  ON messages (id) WHERE delivered_at IS NULL;
ALTER TABLE employee_messages ADD COLUMN external_message_id TEXT;
ALTER TABLE employee_messages ADD COLUMN external_channel TEXT;
ALTER TABLE employee_messages ADD COLUMN external_author_id TEXT;
ALTER TABLE employee_messages ADD COLUMN external_received_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_messages_thread_external_id
ON employee_messages(thread_id, external_message_id)
WHERE external_message_id IS NOT NULL;
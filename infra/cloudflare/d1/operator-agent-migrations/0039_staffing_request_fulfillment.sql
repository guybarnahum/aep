ALTER TABLE staffing_requests
  ADD COLUMN fulfilled_employee_id TEXT;

ALTER TABLE staffing_requests
  ADD COLUMN fulfillment_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_staffing_requests_fulfilled_employee
  ON staffing_requests(fulfilled_employee_id);

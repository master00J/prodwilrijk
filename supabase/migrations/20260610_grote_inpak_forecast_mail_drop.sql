-- Laat Outlook-mails ook koppelen aan forecast-labels die nog niet in grote_inpak_cases bestaan.
-- De bestaande mailviewer blijft hierdoor bruikbaar voor zowel forecast als PILS.

ALTER TABLE IF EXISTS grote_inpak_case_linked_mails
  DROP CONSTRAINT IF EXISTS grote_inpak_case_linked_mails_case_label_fkey;

ALTER TABLE IF EXISTS grote_inpak_customer_requests
  ADD COLUMN IF NOT EXISTS linked_mail_id BIGINT REFERENCES grote_inpak_case_linked_mails(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grote_inpak_customer_requests_linked_mail
  ON grote_inpak_customer_requests(linked_mail_id);

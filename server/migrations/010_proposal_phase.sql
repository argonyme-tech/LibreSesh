-- Mímir add-on: a pitch moves through decision phases before it deserves the
-- grid (concern -> inquiry -> proposal -> decision). Additive: everything
-- existing lands on 'concern' and the UI only surfaces phases when used.
ALTER TABLE proposals ADD COLUMN phase TEXT NOT NULL DEFAULT 'concern'
  CHECK (phase IN ('concern', 'inquiry', 'proposal', 'decision'));

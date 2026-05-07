-- Erweiterung der foerderungen-Tabelle um Detail-Felder
-- für aktuelle Termine, Voraussetzungen, Antragsablauf und gegenseitige Ausschlüsse.
-- Idempotent: alle Spalten werden nur hinzugefügt, wenn nicht vorhanden.

ALTER TABLE foerderungen
  ADD COLUMN IF NOT EXISTS voraussetzungen      TEXT,
  ADD COLUMN IF NOT EXISTS antragsablauf        TEXT,
  ADD COLUMN IF NOT EXISTS deadline_aktuell     TEXT,
  ADD COLUMN IF NOT EXISTS naechster_call_datum DATE,
  ADD COLUMN IF NOT EXISTS budget_status        TEXT,
  ADD COLUMN IF NOT EXISTS bearbeitungsdauer    TEXT,
  ADD COLUMN IF NOT EXISTS auszahlungsmodus     TEXT,
  ADD COLUMN IF NOT EXISTS excludes             UUID[] DEFAULT '{}'::uuid[];

-- CHECK-Constraint für budget_status (nur erlaubte Werte oder NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'foerderungen_budget_status_check'
  ) THEN
    ALTER TABLE foerderungen
      ADD CONSTRAINT foerderungen_budget_status_check
      CHECK (budget_status IS NULL OR budget_status IN ('ausreichend', 'knapp', 'ausgeschoepft'));
  END IF;
END $$;

COMMENT ON COLUMN foerderungen.excludes
  IS 'Liste der foerderungen.id, die mit dieser Förderung NICHT kombinierbar sind.';
COMMENT ON COLUMN foerderungen.budget_status
  IS 'ausreichend / knapp / ausgeschoepft';
COMMENT ON COLUMN foerderungen.naechster_call_datum
  IS 'Datum des nächsten geplanten Förder-Calls (für Hinweise im Kunden-Modus).';

-- Migration: Protokolle Status erweitern um 'in_bearbeitung'
ALTER TABLE protokolle DROP CONSTRAINT IF EXISTS protokolle_status_check;
ALTER TABLE protokolle ADD CONSTRAINT protokolle_status_check
  CHECK (status IN ('entwurf', 'in_bearbeitung', 'abgeschlossen'));

-- Migration: Protokoll Media
-- Speichert Fotos und Videos zu Besprechungsprotokollen
-- Bucket: "offer-media" (bestehend), Pfad: "protokoll/[protokoll_id]/filename"

CREATE TABLE IF NOT EXISTS protokoll_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  protokoll_id uuid REFERENCES protokolle(id) ON DELETE CASCADE,
  file_name text,
  file_type text,
  file_size integer,
  file_url text  -- Storage-Pfad: "protokoll/[id]/filename"
);

-- RLS aktivieren
ALTER TABLE protokoll_media ENABLE ROW LEVEL SECURITY;

-- Policy: eingeloggte User dürfen lesen und schreiben
CREATE POLICY "Authenticated users can manage protokoll_media"
  ON protokoll_media
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

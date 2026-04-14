-- Migration: Empfänger-Adressen
-- Speichert häufig verwendete E-Mail-Empfänger pro User

CREATE TABLE IF NOT EXISTS empfaenger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  email text NOT NULL,
  name text,
  firma text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(email, created_by)
);

ALTER TABLE empfaenger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own empfaenger"
  ON empfaenger
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

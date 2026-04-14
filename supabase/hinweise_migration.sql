-- Add hinweise column to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS hinweise jsonb DEFAULT '[]'::jsonb;

-- Add ergaenzungen column to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ergaenzungen jsonb DEFAULT '[]'::jsonb;

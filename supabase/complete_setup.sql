-- ============================================================
-- BAU4EPOWER – Komplette Datenbankstruktur + RLS
-- Erstellt: 2026-04-14
--
-- ANLEITUNG: In Supabase Dashboard → SQL Editor → New Query
-- → Dieses komplette Script einfügen → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABELLEN ERSTELLEN
-- ────────────────────────────────────────────────────────────

-- 1) USERS
CREATE TABLE IF NOT EXISTS users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  full_name text,
  display_name text,
  role text CHECK (role IN ('admin', 'bauleiter')) DEFAULT 'bauleiter',
  created_at timestamptz DEFAULT now()
);

-- 2) OFFERS
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  bauleiter_id uuid REFERENCES auth.users(id),
  betrifft text,
  hero_projektnummer text,
  eingabe_text text,
  angebot_data jsonb,
  gesamtsumme_netto numeric DEFAULT 0,
  gesamtsumme_brutto numeric DEFAULT 0,
  ergaenzungen jsonb DEFAULT '[]'::jsonb,
  hinweise jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'entwurf',
  created_at timestamptz DEFAULT now()
);

-- 3) CATALOG (Preisliste mit Versionierung)
CREATE TABLE IF NOT EXISTS catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  data_json jsonb NOT NULL DEFAULT '[]',
  stundensaetze_json jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id)
);

-- 4) PROMPTS
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type integer CHECK (type IN (1, 2)),
  active_version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 5) PROMPT_VERSIONS
CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  version_number integer,
  text text,
  created_at timestamptz DEFAULT now()
);

-- 6) SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- 7) AUFMAESSE
CREATE TABLE IF NOT EXISTS aufmaesse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  hero_projektnummer text,
  adresse text,
  betrifft text,
  aufmass_data jsonb,
  status text DEFAULT 'entwurf',
  created_at timestamptz DEFAULT now()
);

-- 8) OFFER_MEDIA
CREATE TABLE IF NOT EXISTS offer_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers(id) ON DELETE CASCADE,
  file_name text,
  file_type text,
  file_size integer,
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- 9) PROTOKOLLE
CREATE TABLE IF NOT EXISTS protokolle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  hero_projektnummer text,
  adresse text,
  betrifft text,
  eintraege jsonb NOT NULL DEFAULT '[]',
  protokoll_data jsonb,
  status text DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'in_bearbeitung', 'abgeschlossen'))
);

-- 10) INPUT_TEMPLATES
CREATE TABLE IF NOT EXISTS input_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  name text NOT NULL,
  type text CHECK (type IN ('klein', 'gross')),
  template_data jsonb NOT NULL DEFAULT '{}'
);

-- 11) EMPFAENGER
CREATE TABLE IF NOT EXISTS empfaenger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  email text NOT NULL,
  name text,
  firma text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(email, created_by)
);

-- 12) PROTOKOLL_MEDIA
CREATE TABLE IF NOT EXISTS protokoll_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  protokoll_id uuid REFERENCES protokolle(id) ON DELETE CASCADE,
  file_name text,
  file_type text,
  file_size integer,
  file_url text
);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- 1) USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_authenticated" ON users;
CREATE POLICY "users_select_authenticated" ON users
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2) OFFERS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_select" ON offers;
CREATE POLICY "offers_select" ON offers
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR bauleiter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "offers_insert" ON offers;
CREATE POLICY "offers_insert" ON offers
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "offers_update" ON offers;
CREATE POLICY "offers_update" ON offers
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "offers_delete" ON offers;
CREATE POLICY "offers_delete" ON offers
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 3) CATALOG
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_select_authenticated" ON catalog;
CREATE POLICY "catalog_select_authenticated" ON catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "catalog_insert_admin" ON catalog;
CREATE POLICY "catalog_insert_admin" ON catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "catalog_update_admin" ON catalog;
CREATE POLICY "catalog_update_admin" ON catalog
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "catalog_delete_admin" ON catalog;
CREATE POLICY "catalog_delete_admin" ON catalog
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 4) PROMPTS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompts_select_authenticated" ON prompts;
CREATE POLICY "prompts_select_authenticated" ON prompts
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "prompts_insert_admin" ON prompts;
CREATE POLICY "prompts_insert_admin" ON prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "prompts_update_admin" ON prompts;
CREATE POLICY "prompts_update_admin" ON prompts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "prompts_delete_admin" ON prompts;
CREATE POLICY "prompts_delete_admin" ON prompts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 5) PROMPT_VERSIONS
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_versions_select_authenticated" ON prompt_versions;
CREATE POLICY "prompt_versions_select_authenticated" ON prompt_versions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "prompt_versions_insert_admin" ON prompt_versions;
CREATE POLICY "prompt_versions_insert_admin" ON prompt_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "prompt_versions_update_admin" ON prompt_versions;
CREATE POLICY "prompt_versions_update_admin" ON prompt_versions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "prompt_versions_delete_admin" ON prompt_versions;
CREATE POLICY "prompt_versions_delete_admin" ON prompt_versions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 6) SETTINGS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_authenticated" ON settings;
CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_upsert_admin" ON settings;
CREATE POLICY "settings_upsert_admin" ON settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "settings_update_admin" ON settings;
CREATE POLICY "settings_update_admin" ON settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 7) AUFMAESSE
ALTER TABLE aufmaesse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aufmaesse_select" ON aufmaesse;
CREATE POLICY "aufmaesse_select" ON aufmaesse
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "aufmaesse_insert" ON aufmaesse;
CREATE POLICY "aufmaesse_insert" ON aufmaesse
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "aufmaesse_update" ON aufmaesse;
CREATE POLICY "aufmaesse_update" ON aufmaesse
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "aufmaesse_delete" ON aufmaesse;
CREATE POLICY "aufmaesse_delete" ON aufmaesse
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 8) OFFER_MEDIA
ALTER TABLE offer_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_media_select" ON offer_media;
CREATE POLICY "offer_media_select" ON offer_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_media.offer_id
      AND (
        offers.created_by = auth.uid()
        OR offers.bauleiter_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "offer_media_insert" ON offer_media;
CREATE POLICY "offer_media_insert" ON offer_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_media.offer_id
      AND (
        offers.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "offer_media_delete" ON offer_media;
CREATE POLICY "offer_media_delete" ON offer_media
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_media.offer_id
      AND (
        offers.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      )
    )
  );

-- 9) PROTOKOLLE
ALTER TABLE protokolle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "protokolle_select" ON protokolle;
CREATE POLICY "protokolle_select" ON protokolle
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "protokolle_insert" ON protokolle;
CREATE POLICY "protokolle_insert" ON protokolle
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "protokolle_update" ON protokolle;
CREATE POLICY "protokolle_update" ON protokolle
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "protokolle_delete" ON protokolle;
CREATE POLICY "protokolle_delete" ON protokolle
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- 10) INPUT_TEMPLATES
ALTER TABLE input_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON input_templates;
CREATE POLICY "templates_select" ON input_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "templates_insert" ON input_templates;
CREATE POLICY "templates_insert" ON input_templates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "templates_update" ON input_templates;
CREATE POLICY "templates_update" ON input_templates
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "templates_delete" ON input_templates;
CREATE POLICY "templates_delete" ON input_templates
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- 11) EMPFAENGER
ALTER TABLE empfaenger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own empfaenger" ON empfaenger;
CREATE POLICY "Users can manage their own empfaenger" ON empfaenger
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- 12) PROTOKOLL_MEDIA
ALTER TABLE protokoll_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage protokoll_media" ON protokoll_media;
CREATE POLICY "Authenticated users can manage protokoll_media" ON protokoll_media
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKET
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-media', 'offer-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies: Authenticated users can upload/read/delete
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'offer-media');

DROP POLICY IF EXISTS "Authenticated read" ON storage.objects;
CREATE POLICY "Authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'offer-media');

DROP POLICY IF EXISTS "Authenticated delete" ON storage.objects;
CREATE POLICY "Authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'offer-media');

-- ────────────────────────────────────────────────────────────
-- AUTH TRIGGER: Auto-create user profile on signup
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'bauleiter'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FERTIG! Alle 12 Tabellen + RLS + Storage + Auth-Trigger
-- ============================================================

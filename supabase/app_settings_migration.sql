-- App-weite Konfiguration / Secrets (Twilio, Make.com etc.) in der DB statt
-- in Vercel-ENV-Variablen. Nur Admins dürfen lesen oder schreiben.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_admin_select ON app_settings;
DROP POLICY IF EXISTS app_settings_admin_modify ON app_settings;

CREATE POLICY app_settings_admin_select ON app_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'administrator'
  ));

CREATE POLICY app_settings_admin_modify ON app_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'administrator'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'administrator'
  ));

-- Trigger: updated_at automatisch nachziehen
CREATE OR REPLACE FUNCTION app_settings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS app_settings_touch ON app_settings;
CREATE TRIGGER app_settings_touch
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION app_settings_touch_updated_at();

-- Optional: Schlüssel anlegen, damit die Admin-UI sie zum Edit findet.
-- (Werte müssen anschließend einmalig befüllt werden – siehe
--  supabase/app_settings_seed.local.sql, gitignored.)
INSERT INTO app_settings (key, value) VALUES
  ('TWILIO_ACCOUNT_SID',  ''),
  ('TWILIO_AUTH_TOKEN',   ''),
  ('TWILIO_PHONE_NUMBER', ''),
  ('APP_URL',             'https://bau4epower.vercel.app')
ON CONFLICT (key) DO NOTHING;

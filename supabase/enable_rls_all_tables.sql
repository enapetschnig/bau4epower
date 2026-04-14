-- ============================================================
-- NAPETSCHNIG. APP – RLS (Row Level Security) für ALLE Tabellen
-- Erstellt: 2026-04-08
-- Projekt: qwpjhxkcgovvpkpzqyta
--
-- Dieses Script in Supabase SQL Editor ausführen!
-- Dashboard → SQL Editor → New Query → Script einfügen → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) USERS – Benutzer-Tabelle
-- ────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Jeder eingeloggte User kann alle User sehen (für Bauleiter-Liste)
CREATE POLICY "users_select_authenticated" ON users
  FOR SELECT TO authenticated
  USING (true);

-- User kann nur eigenes Profil updaten
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Nur Service-Role kann neue User anlegen (via Auth-Trigger)
-- Kein INSERT-Policy für authenticated = Insert nur via Backend

-- ────────────────────────────────────────────────────────────
-- 2) OFFERS – Angebote
-- ────────────────────────────────────────────────────────────
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Admin sieht alles, Bauleiter nur eigene + zugewiesene
CREATE POLICY "offers_select" ON offers
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR bauleiter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Jeder eingeloggte User kann Angebote erstellen
CREATE POLICY "offers_insert" ON offers
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Eigene Angebote oder Admin kann updaten
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

-- Eigene Angebote oder Admin kann löschen
CREATE POLICY "offers_delete" ON offers
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3) CATALOG – Preisliste (nur Lesen für alle, Schreiben für Admin)
-- ────────────────────────────────────────────────────────────
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_select_authenticated" ON catalog
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "catalog_insert_admin" ON catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "catalog_update_admin" ON catalog
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "catalog_delete_admin" ON catalog
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4) PROMPTS – KI-Prompt-Verwaltung (Lesen alle, Schreiben Admin)
-- ────────────────────────────────────────────────────────────
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts_select_authenticated" ON prompts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "prompts_insert_admin" ON prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "prompts_update_admin" ON prompts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "prompts_delete_admin" ON prompts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5) PROMPT_VERSIONS – Prompt-Versionen (gleiche Logik wie Prompts)
-- ────────────────────────────────────────────────────────────
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_versions_select_authenticated" ON prompt_versions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "prompt_versions_insert_admin" ON prompt_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "prompt_versions_update_admin" ON prompt_versions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "prompt_versions_delete_admin" ON prompt_versions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6) SETTINGS – App-Einstellungen (Lesen alle, Schreiben Admin)
-- ────────────────────────────────────────────────────────────
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "settings_upsert_admin" ON settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "settings_update_admin" ON settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 7) AUFMAESSE – Aufmaße (eigene sehen/bearbeiten, Admin alles)
-- ────────────────────────────────────────────────────────────
ALTER TABLE aufmaesse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aufmaesse_select" ON aufmaesse
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "aufmaesse_insert" ON aufmaesse
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "aufmaesse_update" ON aufmaesse
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "aufmaesse_delete" ON aufmaesse
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 8) OFFER_MEDIA – Medien zu Angeboten
-- ────────────────────────────────────────────────────────────
ALTER TABLE offer_media ENABLE ROW LEVEL SECURITY;

-- Medien sichtbar wenn zugehöriges Angebot sichtbar ist
CREATE POLICY "offer_media_select" ON offer_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_media.offer_id
      AND (
        offers.created_by = auth.uid()
        OR offers.bauleiter_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "offer_media_insert" ON offer_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_media.offer_id
      AND (
        offers.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "offer_media_delete" ON offer_media
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_media.offer_id
      AND (
        offers.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
    )
  );

-- ============================================================
-- FERTIG! Alle 8 Tabellen haben jetzt RLS aktiviert.
--
-- Zusammenfassung:
-- ✓ users          → Alle sehen, nur eigenes Profil ändern
-- ✓ offers         → Eigene + zugewiesene, Admin alles
-- ✓ catalog        → Alle lesen, Admin schreiben
-- ✓ prompts        → Alle lesen, Admin schreiben
-- ✓ prompt_versions→ Alle lesen, Admin schreiben
-- ✓ settings       → Alle lesen, Admin schreiben
-- ✓ aufmaesse      → Eigene + Admin
-- ✓ offer_media    → Verknüpft mit Angebot-Zugriff
--
-- Bereits RLS aktiv (aus früheren Migrations):
-- ✓ empfaenger, input_templates, protokolle, protokoll_media
-- ============================================================

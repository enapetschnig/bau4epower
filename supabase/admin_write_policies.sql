-- Admin-Schreibrechte auf profiles, user_roles, app_settings,
-- employee_invitations.
--
-- Wichtig: Wir verwenden eine SECURITY-DEFINER-Helper-Funktion
-- `public.is_admin()` statt eines direkten EXISTS-Subquery auf
-- user_roles. Sonst entsteht eine REKURSIVE RLS-Auswertung, sobald
-- die Policy auf user_roles selbst angewendet wird (`user_roles_admin_modify`
-- prüft via user_roles → triggert dieselbe Policy-Auswertung).
-- Das Resultat ist, dass auch der ganz normale SELECT von user_roles
-- für den AuthContext leer zurückkommt – isAdmin wird false und der
-- Admin sieht plötzlich keinen Admin-Bereich mehr.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'administrator'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ─── PROFILES ───────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_admin_modify ON profiles;
CREATE POLICY profiles_admin_modify ON profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── USER_ROLES ────────────────────────────────────────────
DROP POLICY IF EXISTS user_roles_admin_modify ON user_roles;
CREATE POLICY user_roles_admin_modify ON user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── APP_SETTINGS ──────────────────────────────────────────
-- Diese Policies hatten bereits dasselbe Pattern – aus Konsistenzgründen
-- auch hier die Helper-Funktion.
DROP POLICY IF EXISTS app_settings_admin_select ON app_settings;
DROP POLICY IF EXISTS app_settings_admin_modify ON app_settings;

CREATE POLICY app_settings_admin_select ON app_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY app_settings_admin_modify ON app_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── EMPLOYEE_INVITATIONS ──────────────────────────────────
DROP POLICY IF EXISTS invitations_admin_all ON employee_invitations;
CREATE POLICY invitations_admin_all ON employee_invitations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

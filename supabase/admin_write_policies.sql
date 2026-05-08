-- Admin-Schreibrechte auf profiles, user_roles, employee_invitations.
--
-- Bisher gab es nur:
--   profiles_update_own  → User kann nur sein eigenes Profil ändern
--   user_roles_select_all → SELECT für alle, INSERT/UPDATE/DELETE NIE
-- Damit konnte kein Admin fremde User freischalten oder Rollen ändern.
-- Supabase liefert bei einer RLS-blockierten UPDATE-Anweisung KEINE
-- Fehlermeldung, sondern stillschweigend 0 betroffene Zeilen – darum
-- meldete die UI "freigeschaltet" obwohl tatsächlich nichts passierte.

-- ─── PROFILES ───────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_admin_modify ON profiles;
CREATE POLICY profiles_admin_modify ON profiles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'administrator'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'administrator'
  ));

-- ─── USER_ROLES ────────────────────────────────────────────
-- Admin kann Rollen vergeben, ändern, entziehen.
DROP POLICY IF EXISTS user_roles_admin_modify ON user_roles;
CREATE POLICY user_roles_admin_modify ON user_roles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'administrator'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'administrator'
  ));

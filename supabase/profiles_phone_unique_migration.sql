-- Telefonnummer in profiles eindeutig machen.
-- Hintergrund: Eine Telefonnummer darf sich nur einmal registrieren können.
-- Mehrere NULL/leere Werte sind erlaubt (Mitarbeiter ohne erfasste Nummer).

-- 1) Partial Unique Index: ignoriert NULL und leere Strings
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON profiles ((NULLIF(TRIM(phone), '')))
  WHERE phone IS NOT NULL AND TRIM(phone) <> '';

-- 2) RPC, mit der die anonyme Self-Registration vorab prüfen kann,
--    ob eine Nummer schon vergeben ist (RLS auf profiles erlaubt anon
--    in der Regel keinen direkten SELECT). SECURITY DEFINER, damit
--    sie auch ohne Login lesen kann.
CREATE OR REPLACE FUNCTION public.phone_already_registered(p TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE phone IS NOT NULL
      AND TRIM(phone) = TRIM(p)
      AND TRIM(p) <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.phone_already_registered(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.phone_already_registered(TEXT) TO authenticated;

COMMENT ON FUNCTION public.phone_already_registered(TEXT)
  IS 'Pre-Check für die Self-Registration: liefert true, wenn diese Telefonnummer bereits einem Profil zugeordnet ist.';

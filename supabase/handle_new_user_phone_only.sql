-- Trigger handle_new_user_etk: anpassen an Phone-only-Einladungen.
--
-- Bisher hat der Trigger als Fallback `split_part(email,'@',1)` als
-- Vorname genommen – bei Pseudo-Mails (`<digits>@phone.local`) führte
-- das dazu, dass die Telefonnummer als Vorname im Profil landete.
-- Neue Logik: kein Müll-Fallback. Vorname bleibt leer und wird beim
-- Freischalten vom Admin nachgepflegt.

CREATE OR REPLACE FUNCTION public.handle_new_user_etk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  invite_code text;
  invite_record record;
  meta_phone text;
BEGIN
  invite_code := NEW.raw_user_meta_data->>'invite_code';
  meta_phone  := NEW.raw_user_meta_data->>'phone';
  invite_record := NULL;

  IF invite_code IS NOT NULL THEN
    SELECT * INTO invite_record
    FROM public.employee_invitations
    WHERE code = invite_code
      AND status IN ('pending', 'sent')
      AND expires_at > now()
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id, email, vorname, nachname, phone,
    default_gewerk, registered_via, is_active
  ) VALUES (
    NEW.id,
    -- Pseudo-Mails (`*@phone.local`) gehören nicht ins Profil
    CASE WHEN NEW.email LIKE '%@phone.local' THEN NULL ELSE NEW.email END,
    COALESCE(invite_record.vorname,  NEW.raw_user_meta_data->>'vorname',  ''),
    COALESCE(invite_record.nachname, NEW.raw_user_meta_data->>'nachname', ''),
    COALESCE(invite_record.phone,    meta_phone),
    COALESCE(invite_record.default_gewerk, NEW.raw_user_meta_data->>'default_gewerk'),
    CASE WHEN invite_record.id IS NOT NULL THEN 'sms_invite' ELSE 'self_registration' END,
    invite_record.id IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(invite_record.role, 'mitarbeiter'))
  ON CONFLICT (user_id, role) DO NOTHING;

  IF invite_record.id IS NOT NULL THEN
    UPDATE public.employee_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
    WHERE id = invite_record.id;
  END IF;

  RETURN NEW;
END;
$function$;

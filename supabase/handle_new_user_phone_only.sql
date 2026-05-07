-- Trigger handle_new_user_etk: angepasst an Phone-only-Einladungen.
--
-- Bugfix gegenüber der vorigen Version: invite-Daten werden in skalare
-- Variablen geholt statt in einen ganzen RECORD. Wenn die Einladung
-- nicht gefunden wird (z.B. Self-Registration ohne Code), war
-- `invite_record` nicht zugewiesen und das spätere `invite_record.vorname`
-- warf "record is not assigned yet" – Supabase Auth meldete das als
-- "Database error saving new user".

CREATE OR REPLACE FUNCTION public.handle_new_user_etk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  invite_code      text;
  meta_phone       text;
  invite_id        uuid    := NULL;
  invite_vorname   text;
  invite_nachname  text;
  invite_phone     text;
  invite_gewerk    text;
  invite_role      text;
BEGIN
  invite_code := NEW.raw_user_meta_data->>'invite_code';
  meta_phone  := NEW.raw_user_meta_data->>'phone';

  IF invite_code IS NOT NULL AND invite_code <> '' THEN
    SELECT id, vorname, nachname, phone, default_gewerk, role
      INTO invite_id, invite_vorname, invite_nachname,
           invite_phone, invite_gewerk, invite_role
    FROM public.employee_invitations
    WHERE code = invite_code
      AND status IN ('pending', 'sent')
      AND expires_at > now()
    LIMIT 1;
  END IF;

  -- profiles.email hat NOT NULL – wir schreiben die volle E-Mail rein
  -- (Pseudo-Mails `*@phone.local` ebenfalls; sie sind syntaktisch gültig
  --  und werden im UI nicht angezeigt, sondern nur intern für Auth genutzt).
  INSERT INTO public.profiles (
    id, email, vorname, nachname, phone,
    default_gewerk, registered_via, is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(invite_vorname,  NEW.raw_user_meta_data->>'vorname',  ''),
    COALESCE(invite_nachname, NEW.raw_user_meta_data->>'nachname', ''),
    COALESCE(invite_phone,    meta_phone),
    COALESCE(invite_gewerk,   NEW.raw_user_meta_data->>'default_gewerk'),
    CASE WHEN invite_id IS NOT NULL THEN 'sms_invite' ELSE 'self_registration' END,
    invite_id IS NOT NULL    -- bei SMS-Einladung sofort aktiv, sonst Approval
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(invite_role, 'mitarbeiter'))
  ON CONFLICT (user_id, role) DO NOTHING;

  IF invite_id IS NOT NULL THEN
    UPDATE public.employee_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
    WHERE id = invite_id;
  END IF;

  RETURN NEW;
END;
$function$;

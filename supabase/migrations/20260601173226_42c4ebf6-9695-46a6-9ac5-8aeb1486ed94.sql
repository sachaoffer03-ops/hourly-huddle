CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_token TEXT;
  v_invitation public.invitations%ROWTYPE;
  v_role TEXT;
  v_studio uuid;
  v_contract contract_type;
  v_admin_count INTEGER;
  v_primary_studio uuid;
  v_primary_contract contract_type;
BEGIN
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_invitation_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE token = v_invitation_token AND status = 'pending';

    IF FOUND THEN
      v_primary_studio := COALESCE(
        (CASE WHEN array_length(v_invitation.studio_ids,1) > 0 THEN v_invitation.studio_ids[1] END),
        v_invitation.studio_id
      );
      v_primary_contract := COALESCE(
        (CASE WHEN array_length(v_invitation.contracts,1) > 0 THEN v_invitation.contracts[1] END),
        v_invitation.contract
      );

      -- Profil créé en statut « invited » : passera à « active » à la fin
      -- de l'inscription via completeActivationProfile.
      INSERT INTO public.profiles (id, email, first_name, last_name, phone, studio_id, contract, hire_date, status)
      VALUES (NEW.id, NEW.email, v_invitation.first_name, v_invitation.last_name, v_invitation.phone,
              v_primary_studio, v_primary_contract, v_invitation.hire_date, 'invited');

      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invitation.app_role);

      FOREACH v_role IN ARRAY v_invitation.business_roles LOOP
        INSERT INTO public.user_business_roles (user_id, role) VALUES (NEW.id, v_role)
        ON CONFLICT DO NOTHING;
      END LOOP;

      IF array_length(v_invitation.studio_ids, 1) > 0 THEN
        FOREACH v_studio IN ARRAY v_invitation.studio_ids LOOP
          INSERT INTO public.user_studios (user_id, studio_id) VALUES (NEW.id, v_studio)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF v_invitation.studio_id IS NOT NULL THEN
        INSERT INTO public.user_studios (user_id, studio_id) VALUES (NEW.id, v_invitation.studio_id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF array_length(v_invitation.contracts, 1) > 0 THEN
        FOREACH v_contract IN ARRAY v_invitation.contracts LOOP
          INSERT INTO public.user_contracts (user_id, contract) VALUES (NEW.id, v_contract)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF v_invitation.contract IS NOT NULL THEN
        INSERT INTO public.user_contracts (user_id, contract) VALUES (NEW.id, v_contract)
        ON CONFLICT DO NOTHING;
      END IF;

      -- On ne marque PAS l'invitation comme « accepted » ici :
      -- elle reste « pending » pour permettre la reprise tant que
      -- l'inscription n'est pas terminée.
      RETURN NEW;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active');

  IF v_admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END;
$function$;

-- Réactiver l'invitation de Charles-Elie
UPDATE public.invitations
   SET status = 'pending', accepted_at = NULL
 WHERE email = 'cegelbard@skult-studios.com'
   AND token = '3ad7593a8bcb745f8fa3b3ffa12ea97e37707420a7329cba40a67ab4c86bae58';

-- Repasser son profil en « invited »
UPDATE public.profiles
   SET status = 'invited'
 WHERE email = 'cegelbard@skult-studios.com';


-- 1. Add array columns on invitations (keep legacy single columns)
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS studio_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contracts contract_type[] NOT NULL DEFAULT '{}';

-- Backfill from legacy columns
UPDATE public.invitations
SET studio_ids = CASE WHEN studio_id IS NOT NULL THEN ARRAY[studio_id] ELSE '{}'::uuid[] END
WHERE studio_ids = '{}'::uuid[];

UPDATE public.invitations
SET contracts = CASE WHEN contract IS NOT NULL THEN ARRAY[contract] ELSE '{}'::contract_type[] END
WHERE contracts = '{}'::contract_type[];

-- 2. user_studios join table
CREATE TABLE IF NOT EXISTS public.user_studios (
  user_id uuid NOT NULL,
  studio_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, studio_id)
);

ALTER TABLE public.user_studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses studios"
  ON public.user_studios FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE POLICY "Admins gèrent les studios des employés"
  ON public.user_studios FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

-- 3. user_contracts join table
CREATE TABLE IF NOT EXISTS public.user_contracts (
  user_id uuid NOT NULL,
  contract contract_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contract)
);

ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses contrats"
  ON public.user_contracts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE POLICY "Admins gèrent les contrats des employés"
  ON public.user_contracts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

-- 4. Backfill: existing profiles → user_studios / user_contracts from legacy columns
INSERT INTO public.user_studios (user_id, studio_id)
SELECT id, studio_id FROM public.profiles
WHERE studio_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_contracts (user_id, contract)
SELECT id, contract FROM public.profiles
WHERE contract IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Update handle_new_user trigger to handle multi-studio / multi-contract
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_token TEXT;
  v_invitation public.invitations%ROWTYPE;
  v_role business_role;
  v_studio uuid;
  v_contract contract_type;
  v_admin_count INTEGER;
  v_primary_studio uuid;
  v_primary_contract contract_type;
BEGIN
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_invitation_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE token = v_invitation_token AND status = 'pending' AND expires_at > now();

    IF FOUND THEN
      -- Determine primary (first of array, fallback to legacy)
      v_primary_studio := COALESCE(
        (CASE WHEN array_length(v_invitation.studio_ids,1) > 0 THEN v_invitation.studio_ids[1] END),
        v_invitation.studio_id
      );
      v_primary_contract := COALESCE(
        (CASE WHEN array_length(v_invitation.contracts,1) > 0 THEN v_invitation.contracts[1] END),
        v_invitation.contract
      );

      INSERT INTO public.profiles (id, email, first_name, last_name, phone, studio_id, contract, hire_date, status)
      VALUES (NEW.id, NEW.email, v_invitation.first_name, v_invitation.last_name, v_invitation.phone,
              v_primary_studio, v_primary_contract, v_invitation.hire_date, 'active');

      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invitation.app_role);

      FOREACH v_role IN ARRAY v_invitation.business_roles LOOP
        INSERT INTO public.user_business_roles (user_id, role) VALUES (NEW.id, v_role)
        ON CONFLICT DO NOTHING;
      END LOOP;

      -- Multi-studios
      IF array_length(v_invitation.studio_ids, 1) > 0 THEN
        FOREACH v_studio IN ARRAY v_invitation.studio_ids LOOP
          INSERT INTO public.user_studios (user_id, studio_id) VALUES (NEW.id, v_studio)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF v_invitation.studio_id IS NOT NULL THEN
        INSERT INTO public.user_studios (user_id, studio_id) VALUES (NEW.id, v_invitation.studio_id)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Multi-contracts
      IF array_length(v_invitation.contracts, 1) > 0 THEN
        FOREACH v_contract IN ARRAY v_invitation.contracts LOOP
          INSERT INTO public.user_contracts (user_id, contract) VALUES (NEW.id, v_contract)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF v_invitation.contract IS NOT NULL THEN
        INSERT INTO public.user_contracts (user_id, contract) VALUES (NEW.id, v_invitation.contract)
        ON CONFLICT DO NOTHING;
      END IF;

      UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Premier utilisateur = admin (bootstrap)
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

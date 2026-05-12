
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert auth user
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'qa-admin@kadence.test',
    crypt('KadenceQA2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"QA","last_name":"Admin"}'::jsonb,
    now(), now(), '', '', '', ''
  );

  -- Identity row (needed for email login on some Supabase versions)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'qa-admin@kadence.test', 'email_verified', true),
    'email',
    'qa-admin@kadence.test',
    now(), now(), now()
  );

  -- Profile
  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (v_user_id, 'qa-admin@kadence.test', 'QA', 'Admin', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT DO NOTHING;
END $$;

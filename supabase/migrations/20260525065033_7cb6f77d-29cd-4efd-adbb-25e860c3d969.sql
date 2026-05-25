CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  studio_id uuid,
  studio_ids uuid[],
  contract contract_type,
  contracts contract_type[],
  app_role text,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id, i.email, i.first_name, i.last_name, i.phone,
    i.studio_id, i.studio_ids, i.contract, i.contracts,
    i.app_role::text, i.status::text, i.expires_at
  FROM public.invitations i
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
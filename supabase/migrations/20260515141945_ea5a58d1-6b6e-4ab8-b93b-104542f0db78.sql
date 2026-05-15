
CREATE OR REPLACE FUNCTION public.force_delete_studio(_studio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_shifts int := 0;
  v_templates int := 0;
  v_user_studios int := 0;
  v_checklists int := 0;
  v_signalements int := 0;
  v_exceptions int := 0;
  v_business_roles int := 0;
  v_invitations_scalar int := 0;
  v_invitations_arrays int := 0;
  v_profiles_nulled int := 0;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = _studio_id) THEN
    RAISE EXCEPTION 'Studio introuvable';
  END IF;

  WITH d AS (DELETE FROM public.shift_checklist_items
             WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id) RETURNING 1)
  SELECT 0 INTO v_shifts FROM d;

  WITH d AS (DELETE FROM public.shift_handoffs
             WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id) RETURNING 1)
  SELECT 0 FROM d;

  WITH d AS (DELETE FROM public.shift_proposals
             WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id) RETURNING 1)
  SELECT 0 FROM d;

  WITH d AS (DELETE FROM public.shift_reports
             WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id) RETURNING 1)
  SELECT 0 FROM d;

  WITH d AS (DELETE FROM public.feedbacks
             WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id) RETURNING 1)
  SELECT 0 FROM d;

  WITH d AS (DELETE FROM public.modification_requests
             WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id) RETURNING 1)
  SELECT 0 FROM d;

  WITH d AS (DELETE FROM public.shifts WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_shifts FROM d;

  WITH d AS (DELETE FROM public.staffing_templates WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_templates FROM d;

  WITH d AS (DELETE FROM public.user_studios WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_user_studios FROM d;

  WITH d AS (DELETE FROM public.checklist_templates WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_checklists FROM d;

  WITH d AS (DELETE FROM public.signalements WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_signalements FROM d;

  WITH d AS (DELETE FROM public.studio_exceptions WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_exceptions FROM d;

  WITH d AS (DELETE FROM public.studio_business_roles WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_business_roles FROM d;

  WITH u AS (UPDATE public.profiles SET studio_id = NULL WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_profiles_nulled FROM u;

  WITH d AS (DELETE FROM public.invitations WHERE studio_id = _studio_id RETURNING 1)
  SELECT count(*) INTO v_invitations_scalar FROM d;

  WITH u AS (
    UPDATE public.invitations
    SET studio_ids = (SELECT ARRAY(SELECT x FROM unnest(studio_ids) x WHERE x <> _studio_id))
    WHERE _studio_id = ANY(studio_ids)
    RETURNING 1
  ) SELECT count(*) INTO v_invitations_arrays FROM u;

  DELETE FROM public.studios WHERE id = _studio_id;

  RETURN jsonb_build_object(
    'shifts', v_shifts,
    'staffing_templates', v_templates,
    'user_studios', v_user_studios,
    'checklist_templates', v_checklists,
    'signalements', v_signalements,
    'studio_exceptions', v_exceptions,
    'studio_business_roles', v_business_roles,
    'profiles_nulled', v_profiles_nulled,
    'invitations_scalar', v_invitations_scalar,
    'invitations_arrays', v_invitations_arrays
  );
END;
$$;


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

  DELETE FROM public.shift_checklist_items
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.shift_handoffs
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.shift_proposals
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.shift_reports
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.feedbacks
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.modification_requests
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);

  DELETE FROM public.shifts WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_shifts = ROW_COUNT;

  DELETE FROM public.staffing_templates WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_templates = ROW_COUNT;

  DELETE FROM public.user_studios WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_user_studios = ROW_COUNT;

  DELETE FROM public.checklist_templates WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_checklists = ROW_COUNT;

  DELETE FROM public.signalements WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_signalements = ROW_COUNT;

  DELETE FROM public.studio_exceptions WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_exceptions = ROW_COUNT;

  DELETE FROM public.studio_business_roles WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_business_roles = ROW_COUNT;

  UPDATE public.profiles SET studio_id = NULL WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_profiles_nulled = ROW_COUNT;

  DELETE FROM public.invitations WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_invitations_scalar = ROW_COUNT;

  UPDATE public.invitations
    SET studio_ids = (SELECT ARRAY(SELECT x FROM unnest(studio_ids) x WHERE x <> _studio_id))
    WHERE _studio_id = ANY(studio_ids);
  GET DIAGNOSTICS v_invitations_arrays = ROW_COUNT;

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

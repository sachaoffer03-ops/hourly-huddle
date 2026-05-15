ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_studios_not_deleted ON public.studios (id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.studio_blockers(_studio_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'shifts', (SELECT count(*) FROM public.shifts WHERE studio_id = _studio_id),
    'staffing_templates', (SELECT count(*) FROM public.staffing_templates WHERE studio_id = _studio_id),
    'profiles', (SELECT count(*) FROM public.profiles WHERE studio_id = _studio_id),
    'user_studios', (SELECT count(*) FROM public.user_studios WHERE studio_id = _studio_id),
    'checklist_templates', (SELECT count(*) FROM public.checklist_templates WHERE studio_id = _studio_id),
    'signalements', (SELECT count(*) FROM public.signalements WHERE studio_id = _studio_id)
  );
$$;
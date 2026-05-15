
-- A. Compléter studios
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS surface_m2 integer;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS opened_at date;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS role_hours jsonb NOT NULL DEFAULT '{}'::jsonb;
-- deleted_at exists already per schema; ensure it
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- B. studio_business_roles
CREATE TABLE IF NOT EXISTS public.studio_business_roles (
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, role)
);
ALTER TABLE public.studio_business_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tout le monde voit les postes par studio" ON public.studio_business_roles;
CREATE POLICY "Tout le monde voit les postes par studio"
  ON public.studio_business_roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins gèrent les postes par studio" ON public.studio_business_roles;
CREATE POLICY "Admins gèrent les postes par studio"
  ON public.studio_business_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Backfill : tout rôle déjà utilisé dans staffing_templates devient actif sur ce studio
INSERT INTO public.studio_business_roles (studio_id, role)
SELECT DISTINCT studio_id, business_role
FROM public.staffing_templates
WHERE studio_id IS NOT NULL AND business_role IS NOT NULL
ON CONFLICT DO NOTHING;

-- C. studio_exceptions
CREATE TABLE IF NOT EXISTS public.studio_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  exception_type text NOT NULL CHECK (exception_type IN ('fermeture','evenement','ajustement')),
  title text NOT NULL,
  description text,
  staff_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tout le monde voit les exceptions" ON public.studio_exceptions;
CREATE POLICY "Tout le monde voit les exceptions"
  ON public.studio_exceptions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins/managers gèrent les exceptions" ON public.studio_exceptions;
CREATE POLICY "Admins/managers gèrent les exceptions"
  ON public.studio_exceptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS trg_studio_exceptions_updated ON public.studio_exceptions;
CREATE TRIGGER trg_studio_exceptions_updated
  BEFORE UPDATE ON public.studio_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

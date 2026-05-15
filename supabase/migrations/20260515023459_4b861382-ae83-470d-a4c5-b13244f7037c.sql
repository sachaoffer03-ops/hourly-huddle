-- Idempotent migration: production hardening (no data loss)

-- ===== studios.short_name =====
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS short_name text;

UPDATE public.studios
SET short_name = CASE
  WHEN short_name IS NOT NULL AND short_name <> '' THEN short_name
  WHEN name ILIKE 'Skult %' THEN regexp_replace(name, '^Skult\s+', '')
  ELSE name
END
WHERE short_name IS NULL OR short_name = '';

-- ===== studios.has_kitchen =====
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS has_kitchen boolean NOT NULL DEFAULT false;

UPDATE public.studios
SET has_kitchen = true
WHERE (name ILIKE '%châtelain%' OR name ILIKE '%chatelain%')
  AND has_kitchen = false;

-- ===== studios.manager_id =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='studios' AND column_name='manager_id'
  ) THEN
    ALTER TABLE public.studios ADD COLUMN manager_id uuid;
    -- No FK to profiles to avoid blocking deletes; we resolve via join.
  END IF;
END $$;

UPDATE public.studios s
SET manager_id = (
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE s.manager_id IS NULL;

-- ===== business_roles.is_kitchen =====
ALTER TABLE public.business_roles
  ADD COLUMN IF NOT EXISTS is_kitchen boolean NOT NULL DEFAULT false;

UPDATE public.business_roles
SET is_kitchen = true
WHERE (name ILIKE '%cuisine%' OR name ILIKE '%kitchen%')
  AND is_kitchen = false;

-- ===== profiles.is_protected =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_protected = true
WHERE email IN ('sachaoffer@gmail.com', 'sachaoffer03@gmail.com')
  AND is_protected = false;

UPDATE public.profiles p
SET is_protected = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role = 'admin'
)
AND p.is_protected = false;

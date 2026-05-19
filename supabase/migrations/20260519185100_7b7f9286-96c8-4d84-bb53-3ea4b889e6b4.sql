
-- A. studios
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS clock_out_button_appears_before_min int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS clock_out_grace_period_min int NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS clock_out_overdue_action text NOT NULL DEFAULT 'notify_manager',
  ADD COLUMN IF NOT EXISTS qr_renewal_seconds int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS qr_display_support text NOT NULL DEFAULT 'tablet',
  ADD COLUMN IF NOT EXISTS geofencing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS geofencing_radius_m int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS current_qr_code text NULL;

DO $$ BEGIN
  ALTER TABLE public.studios ADD CONSTRAINT studios_clock_out_overdue_action_check
    CHECK (clock_out_overdue_action IN ('notify_manager','auto_clock_out','block'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.studios ADD CONSTRAINT studios_qr_display_support_check
    CHECK (qr_display_support IN ('tablet','printed','manager_phone'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill current_qr_code with random 5-char code for existing studios
UPDATE public.studios SET current_qr_code = upper(substr(md5(random()::text || id::text), 1, 5))
  WHERE current_qr_code IS NULL;

-- B. checklist_templates
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS analyze_with_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_photos_required int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_validation_threshold int NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS ai_detection_hint text NULL;

DO $$ BEGIN
  ALTER TABLE public.checklist_templates ADD CONSTRAINT checklist_templates_ai_threshold_check
    CHECK (ai_validation_threshold BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- C. checklist_template_items
ALTER TABLE public.checklist_template_items
  ADD COLUMN IF NOT EXISTS photo_zone_id uuid NULL REFERENCES public.checklist_template_photos(id) ON DELETE SET NULL;

-- D. closure_questions
CREATE TABLE IF NOT EXISTS public.closure_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  response_type text NOT NULL DEFAULT 'stars_1_5'
    CHECK (response_type IN ('stars_1_5','yes_no','free_text')),
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS closure_questions_studio_order_idx
  ON public.closure_questions(studio_id, order_index);

ALTER TABLE public.closure_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/managers gèrent questions clôture" ON public.closure_questions;
CREATE POLICY "Admins/managers gèrent questions clôture"
  ON public.closure_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

DROP TRIGGER IF EXISTS update_closure_questions_updated_at ON public.closure_questions;
CREATE TRIGGER update_closure_questions_updated_at
  BEFORE UPDATE ON public.closure_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- E. closure_question_responses
CREATE TABLE IF NOT EXISTS public.closure_question_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.checklist_submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.closure_questions(id) ON DELETE CASCADE,
  stars_value int NULL CHECK (stars_value BETWEEN 1 AND 5),
  yesno_value boolean NULL,
  text_value text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, question_id)
);

ALTER TABLE public.closure_question_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employé crée ses réponses clôture" ON public.closure_question_responses;
CREATE POLICY "Employé crée ses réponses clôture"
  ON public.closure_question_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins/managers voient réponses clôture" ON public.closure_question_responses;
CREATE POLICY "Admins/managers voient réponses clôture"
  ON public.closure_question_responses FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

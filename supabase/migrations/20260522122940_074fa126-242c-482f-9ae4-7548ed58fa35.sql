ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS checklist_templates_phase_check;
ALTER TABLE public.checklist_templates
  ADD CONSTRAINT checklist_templates_phase_check
  CHECK (phase IN ('opening', 'transition', 'closing'));

ALTER TABLE public.checklist_submissions
  DROP CONSTRAINT IF EXISTS checklist_submissions_phase_check;
ALTER TABLE public.checklist_submissions
  ADD CONSTRAINT checklist_submissions_phase_check
  CHECK (phase IN ('opening', 'transition', 'closing'));
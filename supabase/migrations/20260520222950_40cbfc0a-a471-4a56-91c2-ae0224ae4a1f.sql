CREATE TABLE public.scoring_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL DEFAULT 'equilibre'
    CHECK (profile_name IN ('bienveillant','equilibre','exigeant','personnalise')),
  punctuality_tolerance text NOT NULL DEFAULT 'moyenne'
    CHECK (punctuality_tolerance IN ('forte','moyenne','faible')),
  checklist_strictness text NOT NULL DEFAULT 'moyenne'
    CHECK (checklist_strictness IN ('faible','moyenne','forte')),
  photos_importance text NOT NULL DEFAULT 'important'
    CHECK (photos_importance IN ('facultatif','important','critique')),
  weight_punctuality int NOT NULL DEFAULT 33 CHECK (weight_punctuality BETWEEN 0 AND 100),
  weight_checklist int NOT NULL DEFAULT 33 CHECK (weight_checklist BETWEEN 0 AND 100),
  weight_photos int NOT NULL DEFAULT 34 CHECK (weight_photos BETWEEN 0 AND 100),
  punct_0min int NOT NULL DEFAULT 10,
  punct_5min int NOT NULL DEFAULT 9,
  punct_15min int NOT NULL DEFAULT 7,
  punct_30min int NOT NULL DEFAULT 4,
  punct_over int NOT NULL DEFAULT 1,
  punct_noshow int NOT NULL DEFAULT 0,
  checklist_complete int NOT NULL DEFAULT 10,
  checklist_bonus_per_photo_item numeric(4,2) NOT NULL DEFAULT 0.5,
  checklist_penalty_per_missed int NOT NULL DEFAULT 1,
  photos_all_validated int NOT NULL DEFAULT 10,
  photos_penalty_per_refused int NOT NULL DEFAULT 2,
  expert_mode_unlocked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id),
  CONSTRAINT weights_sum_100 CHECK (weight_punctuality + weight_checklist + weight_photos = 100)
);

INSERT INTO public.scoring_settings DEFAULT VALUES;

ALTER TABLE public.scoring_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent scoring settings"
  ON public.scoring_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Tous lisent scoring settings"
  ON public.scoring_settings FOR SELECT TO authenticated
  USING (true);
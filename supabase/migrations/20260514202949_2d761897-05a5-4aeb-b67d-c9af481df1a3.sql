-- Table des propositions de shift envoyées aux employés
CREATE TABLE public.shift_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  sent_by uuid,
  UNIQUE(shift_id, user_id)
);

ALTER TABLE public.shift_proposals ENABLE ROW LEVEL SECURITY;

-- Admins/managers gèrent toutes les propositions
CREATE POLICY "Admins gèrent les propositions"
  ON public.shift_proposals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Employé voit ses propositions
CREATE POLICY "Employé voit ses propositions"
  ON public.shift_proposals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Employé répond à ses propositions pending (accept/decline géré côté serveur via service role pour éviter les races, mais on garde le droit)
CREATE POLICY "Employé répond à ses propositions"
  ON public.shift_proposals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX shift_proposals_shift_idx ON public.shift_proposals(shift_id);
CREATE INDEX shift_proposals_user_status_idx ON public.shift_proposals(user_id, status);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_proposals;
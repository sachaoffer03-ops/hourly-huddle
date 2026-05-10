-- Shifts table
CREATE TYPE shift_status AS ENUM ('scheduled', 'completed', 'cancelled', 'open');

CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id UUID REFERENCES public.studios(id) ON DELETE SET NULL,
  business_role business_role NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status shift_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_user_date ON public.shifts(user_id, shift_date);
CREATE INDEX idx_shifts_date ON public.shifts(shift_date);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employés voient leurs shifts"
  ON public.shifts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins/managers gèrent les shifts"
  ON public.shifts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Availabilities table
CREATE TYPE availability_slot AS ENUM ('matin', 'midi', 'soir');

CREATE TABLE public.availabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avail_date DATE NOT NULL,
  slot availability_slot NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, avail_date, slot)
);

CREATE INDEX idx_avail_user_date ON public.availabilities(user_id, avail_date);

ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employés gèrent leurs dispos"
  ON public.availabilities FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins/managers voient toutes les dispos"
  ON public.availabilities FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 1. Ajouter colonnes manquantes à modification_requests
ALTER TABLE public.modification_requests
  ADD COLUMN IF NOT EXISTS proposed_start_time time NULL,
  ADD COLUMN IF NOT EXISTS proposed_end_time time NULL,
  ADD COLUMN IF NOT EXISTS proposed_start_date date NULL,
  ADD COLUMN IF NOT EXISTS proposed_end_date date NULL,
  ADD COLUMN IF NOT EXISTS admin_actor_id uuid NULL;

-- 2. Table des périodes d'indisponibilité
CREATE TABLE IF NOT EXISTS public.unavailability_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NULL,
  source_request_id uuid NULL REFERENCES public.modification_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unavail_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_unavail_user_date
  ON public.unavailability_periods(user_id, start_date, end_date);

ALTER TABLE public.unavailability_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or admin read unavail" ON public.unavailability_periods;
CREATE POLICY "Owner or admin read unavail" ON public.unavailability_periods
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role));

DROP POLICY IF EXISTS "Admin/manager manage unavail" ON public.unavailability_periods;
CREATE POLICY "Admin/manager manage unavail" ON public.unavailability_periods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role));

-- 3. Trigger notif admin/manager à chaque nouvelle demande
CREATE OR REPLACE FUNCTION public.trg_notify_admins_on_modreq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_studio_id uuid;
  v_first_name text;
  v_type_label text;
  v_urg_emoji text;
  v_title text;
  v_body text;
  v_link text;
  v_recipient uuid;
BEGIN
  -- Studio concerné via le shift si dispo
  IF NEW.shift_id IS NOT NULL THEN
    SELECT studio_id INTO v_studio_id FROM public.shifts WHERE id = NEW.shift_id;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name), ''), 'Quelqu''un')
    INTO v_first_name FROM public.profiles WHERE id = NEW.user_id;

  v_type_label := CASE NEW.type::text
    WHEN 'cancel' THEN 'Annulation'
    WHEN 'time_change' THEN 'Changement d''horaire'
    WHEN 'unavailable' THEN 'Indispo future'
    WHEN 'swap' THEN 'Échange'
    ELSE NEW.type::text
  END;

  v_urg_emoji := CASE NEW.urgency::text
    WHEN 'critique' THEN '🔴'
    WHEN 'urgent' THEN '🟠'
    ELSE '🟢'
  END;

  v_title := v_urg_emoji || ' ' || COALESCE(v_first_name, 'Employé') || ' demande : ' || v_type_label;
  v_body := COALESCE(LEFT(NEW.reason, 120), '');
  v_link := '/demandes?req=' || NEW.id::text;

  FOR v_recipient IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.user_studios us ON us.user_id = ur.user_id
    WHERE ur.role IN ('admin','manager')
      AND (v_studio_id IS NULL OR us.studio_id = v_studio_id OR ur.role = 'admin')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_recipient, 'modification_request_new', v_title, v_body, v_link);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_modreq ON public.modification_requests;
CREATE TRIGGER trg_notify_admins_on_modreq
  AFTER INSERT ON public.modification_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admins_on_modreq();


-- ============================================================================
-- Auto-notifications via DB triggers (security definer): comble les trous
-- "Workflow→Notifications", "Modif requests→Notifications", chat → notif.
-- ============================================================================

-- 1) Nouveau message → notification au destinataire
CREATE OR REPLACE FUNCTION public.trg_notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_preview text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), email, 'Quelqu''un')
    INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  v_preview := COALESCE(NULLIF(TRIM(NEW.content), ''),
                        CASE WHEN NEW.attachment_url IS NOT NULL THEN '📎 Pièce jointe' ELSE '' END);
  IF length(v_preview) > 120 THEN v_preview := substring(v_preview from 1 for 117) || '…'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.recipient_id,
    'new_message',
    'Nouveau message de ' || COALESCE(v_sender_name, 'votre équipe'),
    v_preview,
    '/staff-app?tab=chat'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify ON public.messages;
CREATE TRIGGER messages_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_message();

-- 2) Nouveau feedback admin → notification à l'employé du shift
CREATE OR REPLACE FUNCTION public.trg_notify_on_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_author_name text;
BEGIN
  IF NEW.shift_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.shifts WHERE id = NEW.shift_id;
  IF v_user IS NULL OR v_user = NEW.author_id THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), 'Votre manager')
    INTO v_author_name
    FROM public.profiles WHERE id = NEW.author_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    v_user,
    'feedback_received',
    'Feedback reçu (' || NEW.rating || '★)',
    COALESCE(NULLIF(TRIM(NEW.message), ''), v_author_name || ' a laissé un retour sur votre shift.'),
    '/staff-app?tab=profil'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedbacks_notify ON public.feedbacks;
CREATE TRIGGER feedbacks_notify
AFTER INSERT ON public.feedbacks
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_feedback();

-- 3) Modification request résolue (status passé en accepted/refused) → notif employé
CREATE OR REPLACE FUNCTION public.trg_notify_on_modreq_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted','refused','cancelled') THEN RETURN NEW; END IF;

  v_title := CASE NEW.status
    WHEN 'accepted' THEN 'Demande acceptée'
    WHEN 'refused'  THEN 'Demande refusée'
    ELSE 'Demande annulée'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'modification_request_' || NEW.status,
    v_title,
    COALESCE(NULLIF(TRIM(NEW.admin_response), ''),
             'Votre demande a été ' ||
             CASE NEW.status WHEN 'accepted' THEN 'acceptée' WHEN 'refused' THEN 'refusée' ELSE 'annulée' END || '.'),
    '/staff-app?tab=demandes'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS modreq_notify ON public.modification_requests;
CREATE TRIGGER modreq_notify
AFTER UPDATE ON public.modification_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_modreq_resolved();

-- 4) Nouveau shift publié (workflow planning) → notif employé
CREATE OR REPLACE FUNCTION public.trg_notify_on_shift_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.published_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'shift_published',
    'Nouveau shift planifié',
    to_char(NEW.shift_date, 'DD/MM') || ' · ' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') || ' · ' || NEW.business_role,
    '/staff-app?tab=planning'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shifts_notify_publish ON public.shifts;
CREATE TRIGGER shifts_notify_publish
AFTER INSERT OR UPDATE OF published_at ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_shift_published();

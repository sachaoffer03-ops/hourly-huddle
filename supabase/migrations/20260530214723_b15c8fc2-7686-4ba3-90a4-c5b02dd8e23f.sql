-- 1) Invitations: drop overly broad SELECT policy (RPC get_invitation_by_token covers activation)
DROP POLICY IF EXISTS "Lecture par token (activation)" ON public.invitations;

-- 2) Signalements: restrict SELECT to author + admin/manager
DROP POLICY IF EXISTS "Tout le monde voit les signalements" ON public.signalements;
CREATE POLICY "Lecture signalements (auteur ou staff)"
  ON public.signalements
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- 3) Studios: hide current_qr_code from clients via column-level privileges
REVOKE SELECT (current_qr_code), UPDATE (current_qr_code) ON public.studios FROM authenticated;
REVOKE SELECT (current_qr_code), UPDATE (current_qr_code) ON public.studios FROM anon;
GRANT  SELECT (current_qr_code), UPDATE (current_qr_code) ON public.studios TO service_role;

-- 4) training_quiz_options: hide is_correct from clients via column-level privileges
REVOKE SELECT (is_correct) ON public.training_quiz_options FROM authenticated;
REVOKE SELECT (is_correct) ON public.training_quiz_options FROM anon;
GRANT  SELECT (is_correct) ON public.training_quiz_options TO service_role;
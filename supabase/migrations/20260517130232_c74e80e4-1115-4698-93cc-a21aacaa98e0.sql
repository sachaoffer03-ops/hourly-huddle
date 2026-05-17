-- checklist_templates
DROP POLICY IF EXISTS "Admins manage templates" ON public.checklist_templates;
CREATE POLICY "Admins and managers manage templates"
ON public.checklist_templates FOR ALL
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- checklist_template_items
DROP POLICY IF EXISTS "Admins manage template items" ON public.checklist_template_items;
CREATE POLICY "Admins and managers manage template items"
ON public.checklist_template_items FOR ALL
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- checklist_template_photos
DROP POLICY IF EXISTS "Admins manage template photos" ON public.checklist_template_photos;
CREATE POLICY "Admins and managers manage template photos"
ON public.checklist_template_photos FOR ALL
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
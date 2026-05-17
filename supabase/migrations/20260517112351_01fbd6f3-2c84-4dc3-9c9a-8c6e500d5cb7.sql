UPDATE public.shifts
SET clocked_out_at = NULL,
    status = 'scheduled',
    updated_at = now()
WHERE id = 'f012b590-61ec-4b76-9d97-c863f6fa56c2';
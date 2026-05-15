DELETE FROM availabilities a
USING profiles p
WHERE a.user_id = p.id
  AND p.first_name = 'Marco'
  AND p.last_name = 'Bianchi'
  AND EXTRACT(DOW FROM a.avail_date) IN (0, 6);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('formation-videos', 'formation-videos', true, 524288000, array['video/mp4','video/webm','video/quicktime','video/x-msvideo','video/ogg'])
on conflict (id) do update set public = true, file_size_limit = 524288000, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read formation videos"
on storage.objects for select
using (bucket_id = 'formation-videos');

create policy "Anyone can upload formation videos"
on storage.objects for insert
with check (bucket_id = 'formation-videos');

create policy "Anyone can update formation videos"
on storage.objects for update
using (bucket_id = 'formation-videos');

create policy "Anyone can delete formation videos"
on storage.objects for delete
using (bucket_id = 'formation-videos');
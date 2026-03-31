-- Allow admins (via service role) and authenticated users to upload product images
-- The service client bypasses RLS, but this policy covers direct authenticated uploads too

create policy "Authenticated upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "Authenticated update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

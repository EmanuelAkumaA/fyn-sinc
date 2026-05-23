ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bank-logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-logos');

CREATE POLICY "bank-logos org members upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bank-logos'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "bank-logos org members update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bank-logos'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "bank-logos org members delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bank-logos'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);
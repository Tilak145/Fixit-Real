-- The two older upload buckets accepted any file of any size. Documents are
-- photos or PDFs up to 10 MB; logos are web pictures up to 4 MB (no SVG, which
-- can carry scripts, because logos are public). The limits apply to new uploads.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
where id = 'provider-documents';

update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'provider-logos';

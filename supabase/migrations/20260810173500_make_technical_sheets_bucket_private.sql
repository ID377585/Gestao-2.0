-- Imported technical sheets contain tenant documents and are processed only
-- by authenticated server-side flows using the admin storage client.
update storage.buckets
set public = false
where id = 'technical-sheets'
  and public = true;

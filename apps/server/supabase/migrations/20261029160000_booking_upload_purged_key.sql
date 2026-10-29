-- A purged upload's object_key becomes `purged/{id}`, a marker that no storage
-- call will fetch. The original check only allowed `uploads/booking/...`, so the
-- purge deleted the object and then failed to mark the row (#159).

ALTER TABLE booking_uploads
  DROP CONSTRAINT booking_uploads_object_key_check,
  ADD CONSTRAINT booking_uploads_object_key_check
    CHECK (
      object_key ~ '^uploads/booking/'
      OR (purged_at IS NOT NULL AND object_key = 'purged/' || id::text)
    );

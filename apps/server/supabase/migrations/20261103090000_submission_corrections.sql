-- A visitor can report an error on a clinic page (#22). The report is a submission
-- against the existing facility with kind = 'correction'. Every existing row is a listing.
--
-- correction_reasons are the fixed reason codes the visitor picked. correction_changes holds
-- only the fields the visitor changed. It is not facility_partial: listing approval and the
-- moderation edit form read facility_partial as a whole new facility.
-- reporter_relation is an optional fixed label, never personal data. duplicate_listing_url is
-- the other Find a Doc listing for a duplicate. Notes retention is the shared submissions
-- retain_until rule (#236).

ALTER TABLE submissions
  ADD COLUMN kind text NOT NULL DEFAULT 'listing',
  ADD COLUMN correction_reasons text[],
  ADD COLUMN correction_changes jsonb,
  ADD COLUMN reporter_relation text,
  ADD COLUMN duplicate_listing_url text;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_kind_check
    CHECK (kind IN ('listing', 'correction')),
  ADD CONSTRAINT submissions_correction_facility_check
    CHECK (kind <> 'correction' OR facilities_id IS NOT NULL),
  ADD CONSTRAINT submissions_correction_reasons_check
    CHECK (
      correction_reasons IS NULL
      OR correction_reasons <@ ARRAY[
        'WRONG_CITY', 'CLOSED', 'WRONG_LANGUAGES', 'WRONG_PAYMENT', 'WRONG_CONTACT', 'DUPLICATE', 'OTHER'
      ]::text[]
    ),
  ADD CONSTRAINT submissions_correction_has_reasons_check
    CHECK (kind <> 'correction' OR cardinality(correction_reasons) > 0),
  ADD CONSTRAINT submissions_correction_changes_check
    CHECK (correction_changes IS NULL OR jsonb_typeof(correction_changes) = 'object'),
  ADD CONSTRAINT submissions_reporter_relation_check
    CHECK (reporter_relation IS NULL OR reporter_relation IN ('PATIENT', 'STAFF', 'CALLED', 'WEBSITE')),
  ADD CONSTRAINT submissions_duplicate_listing_url_check
    CHECK (duplicate_listing_url IS NULL OR duplicate_listing_url LIKE 'https://%');

-- The moderation queues filter by kind and status.
CREATE INDEX submissions_kind_status_idx ON submissions (kind, status);

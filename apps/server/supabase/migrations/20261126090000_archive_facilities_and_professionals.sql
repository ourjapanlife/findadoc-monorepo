-- Moderators archive a facility or a healthcare professional instead of deleting it.
--
-- Deleting an imported facility failed: institution_import_rows.facility_id is
-- ON DELETE SET NULL, and institution_import_rows_facility_outcome requires a facility_id
-- on every matched or created row (20261110090000_institution_import_rows.sql). The import
-- rows are the record of where a facility came from, so the facility stays and is hidden.
-- The directory data was always public, so keeping it is fine.
--
-- archived_at    when a moderator archived the row. Null means the row is active.
-- archived_reason why, written by the moderator. Required while archived, at most 500 characters.
-- archived_by    the Auth0 sub of that moderator, the same id audit_logs.updated_by stores.
--
-- An archived row is left out of every public read: search, clinic and doctor pages, hubs,
-- the sitemap, the MCP server, and booking. Links in hps_facilities are kept, so unarchiving
-- brings the row back as it was. All columns are nullable, so existing rows stay active and
-- no backfill is needed. The tables already grant the API and the db:prod roles, and the new
-- columns hold no personal data, so no grant or policy changes.
ALTER TABLE facilities
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_reason text,
  ADD COLUMN archived_by text;

ALTER TABLE facilities
  ADD CONSTRAINT facilities_archive_reason
  CHECK (
    (archived_at IS NULL AND archived_reason IS NULL AND archived_by IS NULL)
    OR (
      archived_at IS NOT NULL
      AND coalesce(btrim(archived_reason), '') <> ''
      AND char_length(archived_reason) <= 500
      AND coalesce(btrim(archived_by), '') <> ''
    )
  );

ALTER TABLE hps
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_reason text,
  ADD COLUMN archived_by text;

ALTER TABLE hps
  ADD CONSTRAINT hps_archive_reason
  CHECK (
    (archived_at IS NULL AND archived_reason IS NULL AND archived_by IS NULL)
    OR (
      archived_at IS NOT NULL
      AND coalesce(btrim(archived_reason), '') <> ''
      AND char_length(archived_reason) <= 500
      AND coalesce(btrim(archived_by), '') <> ''
    )
  );

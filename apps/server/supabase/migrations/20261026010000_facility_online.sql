-- Moderators may mark a facility as online. Default is false (not online).
-- An online facility has no street address: contact.address may be blank.
-- Map pins become nullable in 20261026020000_facility_map_nullable.sql.
ALTER TABLE facilities
  ADD COLUMN online boolean NOT NULL DEFAULT false;

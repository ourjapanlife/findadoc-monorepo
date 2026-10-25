-- Moderators may mark a facility as online. Default is false (not online).
-- An online facility has no street address: contact.address may be blank, and
-- the table still stores map_latitude/map_longitude as 0 when there is no pin.
ALTER TABLE facilities
  ADD COLUMN online boolean NOT NULL DEFAULT false;

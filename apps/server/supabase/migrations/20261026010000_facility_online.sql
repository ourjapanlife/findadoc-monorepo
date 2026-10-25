-- An online facility has no street address. Address text stays in contact and may be empty.
-- Latitude and longitude stay required by the table. An online row with no pin stores 0.
ALTER TABLE facilities
  ADD COLUMN online boolean NOT NULL DEFAULT false;

-- Our own user id for every signed-in person (#215, step 2).
--
-- user_identities maps a sign-in provider's (issuer, subject) to "user".id. Today the only
-- issuer is Auth0. A later provider adds identities that point at the same user, so data
-- keyed by user_id does not move.
--
-- "user".email is the last email the provider marked verified, lower-cased. An unverified
-- email is never written. A script can find a person by it. GraphQL does not expose it.
--
-- clinic_memberships claims move from auth0_sub to user_id. Every claimed auth0_sub gets a
-- user and an Auth0 identity, and its rows get that user_id. auth0_sub is no longer written.
-- It stays for one release so a rollback still reads the claims made before this one.

ALTER TABLE "user"
  ADD COLUMN email text,
  ADD CONSTRAINT user_email_check
    CHECK (
      email IS NULL
      OR (email = lower(email)
        AND char_length(email) <= 320
        AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    );

CREATE INDEX user_email_idx ON "user" (email) WHERE email IS NOT NULL;

CREATE TABLE user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON UPDATE CASCADE ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_identities_issuer_subject_key UNIQUE (issuer, subject),
  CONSTRAINT user_identities_issuer_check CHECK (issuer <> ''),
  CONSTRAINT user_identities_subject_check CHECK (subject <> '')
);

CREATE INDEX user_identities_user_id_idx ON user_identities (user_id);

-- One new user per claimed Auth0 sub. The issuer is the Auth0 tenant's `iss` claim.
WITH subs AS MATERIALIZED (
  SELECT subject, gen_random_uuid() AS user_id
  FROM (
    SELECT DISTINCT auth0_sub AS subject
    FROM clinic_memberships
    WHERE auth0_sub IS NOT NULL AND user_id IS NULL
  ) AS claimed
),
users AS (
  INSERT INTO "user" (id)
  SELECT user_id FROM subs
  RETURNING id
),
identities AS (
  INSERT INTO user_identities (user_id, issuer, subject)
  SELECT subs.user_id, 'https://findadoc.jp.auth0.com/', subs.subject
  FROM subs
  JOIN users ON users.id = subs.user_id
  RETURNING user_id, subject
)
UPDATE clinic_memberships AS membership
SET user_id = identities.user_id
FROM identities
WHERE membership.auth0_sub = identities.subject
  AND membership.user_id IS NULL;

CREATE UNIQUE INDEX clinic_memberships_facility_user_key
  ON clinic_memberships (facility_id, user_id)
  WHERE facility_id IS NOT NULL AND user_id IS NOT NULL;

DROP INDEX IF EXISTS clinic_memberships_pending_email_idx;

CREATE INDEX clinic_memberships_pending_email_idx
  ON clinic_memberships (invited_email)
  WHERE user_id IS NULL AND invited_email IS NOT NULL;

-- The GraphQL server connects as the database owner and bypasses RLS.
-- The Data API roles get nothing: accounts are not a public table.
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_identities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "user" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE user_identities TO service_role;
GRANT ALL ON TABLE "user" TO service_role;

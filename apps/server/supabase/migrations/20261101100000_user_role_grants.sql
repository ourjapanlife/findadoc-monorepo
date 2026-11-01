-- Admin, Moderator, and Dev live in Postgres (#215, step 3).
--
-- user_role_grants is one row per grant. Revoking sets revoked_at, so the row stays as the
-- record. A user holds a role while a grant for it has no revoked_at. The API reads the
-- grants on every request, so a revoke counts on the next request.
--
-- Until the first grant is written, the API still takes these roles from the Auth0 token, so
-- deploying this changes nothing. `pnpm --filter @findadoc/server roles:import-auth0:write`
-- copies the Auth0 roles here. From then on the token's roles are ignored.
--
-- account_audit_log records every grant and revoke: who did it, when, and to whom. Linking,
-- unlinking, and disabling a user are added with the accounts and admin apps.

CREATE TABLE user_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON UPDATE CASCADE ON DELETE CASCADE,
  role text NOT NULL,
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text,
  revoked_at timestamptz,
  CONSTRAINT user_role_grants_role_check CHECK (role IN ('admin', 'moderator', 'dev')),
  CONSTRAINT user_role_grants_granted_by_check CHECK (granted_by <> ''),
  CONSTRAINT user_role_grants_revoked_check
    CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE UNIQUE INDEX user_role_grants_active_key
  ON user_role_grants (user_id, role)
  WHERE revoked_at IS NULL;

CREATE TABLE account_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor text NOT NULL,
  target_user_id uuid NOT NULL REFERENCES "user" (id) ON UPDATE CASCADE ON DELETE CASCADE,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_audit_log_action_check CHECK (action IN ('grant_role', 'revoke_role')),
  CONSTRAINT account_audit_log_actor_check CHECK (actor <> '')
);

CREATE INDEX account_audit_log_target_idx ON account_audit_log (target_user_id, created_date);

-- The GraphQL server connects as the database owner and bypasses RLS.
-- The Data API roles get nothing: roles and the audit log are not public tables.
ALTER TABLE user_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_role_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE account_audit_log FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE user_role_grants TO service_role;
GRANT ALL ON TABLE account_audit_log TO service_role;

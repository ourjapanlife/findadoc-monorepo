-- Login roles for people who run scripts or inspect production from a laptop through `pnpm db:prod`.
-- Both sign in with an IAM auth token (rds_iam), so neither has a password, and neither can change the schema.
--
-- findadoc_readonly: SELECT only, every transaction read-only. The default for `pnpm db:prod`.
-- findadoc_operator: reads and writes rows, for backfills. Chosen with `--role operator`.
--
-- Patient and account data stays out of reach of both: booking requests, uploads, appointments,
-- clinic invitations (invited_email), user profiles, and the audit log (whose old and new values
-- can repeat any of those). The API reads that data. A person does not.
--
-- Grants cover the tables that exist now. There are no default privileges, so a new table is
-- closed to both roles until its migration grants it. That keeps new personal data closed by default.
--
-- rds_iam exists only on RDS, so this does nothing in Docker or in CI.
DO $$
DECLARE
    private_table text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'findadoc_readonly') THEN
        CREATE ROLE findadoc_readonly LOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'findadoc_operator') THEN
        CREATE ROLE findadoc_operator LOGIN;
    END IF;

    GRANT rds_iam TO findadoc_readonly, findadoc_operator;
    GRANT USAGE ON SCHEMA public TO findadoc_readonly, findadoc_operator;

    GRANT SELECT ON ALL TABLES IN SCHEMA public TO findadoc_readonly;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO findadoc_operator;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO findadoc_operator;

    FOREACH private_table IN ARRAY ARRAY[
        'booking_submissions',
        'booking_uploads',
        'booking_appointments',
        'clinic_memberships',
        'user',
        'audit_logs'
    ] LOOP
        IF to_regclass(format('public.%I', private_table)) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM findadoc_readonly, findadoc_operator', private_table);
        END IF;
    END LOOP;

    -- The operator may read the migration history but not change it.
    IF to_regclass('public.schema_migrations') IS NOT NULL THEN
        REVOKE INSERT, UPDATE, DELETE ON public.schema_migrations FROM findadoc_operator;
    END IF;

    -- A forgotten session or a runaway query must not hold locks on the live API.
    ALTER ROLE findadoc_readonly SET default_transaction_read_only = on;
    ALTER ROLE findadoc_readonly SET statement_timeout = '60s';
    ALTER ROLE findadoc_readonly SET idle_in_transaction_session_timeout = '5min';
    ALTER ROLE findadoc_operator SET statement_timeout = '5min';
    ALTER ROLE findadoc_operator SET lock_timeout = '10s';
    ALTER ROLE findadoc_operator SET idle_in_transaction_session_timeout = '5min';
END $$;

-- The API's login role on RDS. It signs in with an IAM auth token (rds_iam), so it has no password,
-- and it can read and write rows but not change the schema. Migrations run as the master user.
-- rds_iam exists only on RDS, so this does nothing on Supabase, in Docker, or in CI.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'findadoc_api') THEN
        CREATE ROLE findadoc_api LOGIN;
    END IF;

    GRANT rds_iam TO findadoc_api;
    GRANT USAGE ON SCHEMA public TO findadoc_api;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO findadoc_api;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO findadoc_api;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO findadoc_api;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO findadoc_api;

    -- The migration history is not the API's to change.
    IF to_regclass('public.schema_migrations') IS NOT NULL THEN
        REVOKE ALL ON public.schema_migrations FROM findadoc_api;
    END IF;
END $$;

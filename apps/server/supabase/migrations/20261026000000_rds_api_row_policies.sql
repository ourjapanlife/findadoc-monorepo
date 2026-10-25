-- Row-level security is on for most public tables, and no policy covers findadoc_api, so on RDS
-- the API read no rows and could write none. On Supabase it used service_role, which bypasses
-- RLS. This gives findadoc_api the same full access through a policy on every table with RLS on.
-- A table that turns RLS on later needs its own findadoc_api policy.
-- rds_iam exists only on RDS, so this does nothing on Supabase, in Docker, or in CI.
DO $$
DECLARE
    rls_table record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
        RETURN;
    END IF;

    FOR rls_table IN
        SELECT c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = rls_table.name AND policyname = 'findadoc_api_all'
        ) THEN
            EXECUTE format(
                'CREATE POLICY findadoc_api_all ON public.%I FOR ALL TO findadoc_api USING (true) WITH CHECK (true)',
                rls_table.name
            );
        END IF;
    END LOOP;
END $$;

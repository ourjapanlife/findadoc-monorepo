-- Row policies for the pnpm db:prod roles (follows 20261107090000_rds_operator_roles.sql).
--
-- Row-level security is on for most public tables, and their only policy is findadoc_api_all
-- (20261026000000_rds_api_row_policies.sql). So findadoc_readonly and findadoc_operator had the
-- grants but saw no rows: `select count(*) from facilities` returned 0 on production.
--
-- A table gets a policy only where the role already has the privilege. The tables closed in the
-- earlier migration keep no grant and get no policy. The legacy "Reservation" and "ReservationSlot"
-- tables hold appointment rows (user_id, meeting_link), so they are closed here as well.
--
-- A table that turns on RLS later needs its own grant and policy for these roles, as for findadoc_api.
-- rds_iam exists only on RDS, so this does nothing in Docker or in CI.
DO $$
DECLARE
    private_table text;
    rls_table record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
        RETURN;
    END IF;

    FOREACH private_table IN ARRAY ARRAY['Reservation', 'ReservationSlot'] LOOP
        IF to_regclass(format('public.%I', private_table)) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM findadoc_readonly, findadoc_operator', private_table);
        END IF;
    END LOOP;

    FOR rls_table IN
        SELECT c.oid, c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    LOOP
        IF has_table_privilege('findadoc_readonly', rls_table.oid, 'SELECT') AND NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = rls_table.name AND policyname = 'findadoc_readonly_select'
        ) THEN
            EXECUTE format(
                'CREATE POLICY findadoc_readonly_select ON public.%I FOR SELECT TO findadoc_readonly USING (true)',
                rls_table.name
            );
        END IF;

        IF has_table_privilege('findadoc_operator', rls_table.oid, 'UPDATE') AND NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = rls_table.name AND policyname = 'findadoc_operator_all'
        ) THEN
            EXECUTE format(
                'CREATE POLICY findadoc_operator_all ON public.%I FOR ALL TO findadoc_operator USING (true) WITH CHECK (true)',
                rls_table.name
            );
        END IF;
    END LOOP;
END $$;

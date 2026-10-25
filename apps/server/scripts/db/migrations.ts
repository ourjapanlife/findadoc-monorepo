import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type pg from 'pg'

// MIGRATIONS_DIR is set where the files are bundled elsewhere, such as the migration Lambda.
export const migrationsDir = process.env.MIGRATIONS_DIR
    ?? fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

// Session lock, so two deploys cannot apply the same file at once.
const MIGRATION_LOCK_ID = 7_318_204_551

export type MigrationFile = {
    version: string
    name: string
    file: string
}

/**
 * Supabase creates these objects on every project, and the baseline migration uses them:
 * it grants to anon, authenticated and service_role, creates extensions in the extensions
 * schema, and hps_facilities once defaulted to auth.uid(). On plain Postgres (local Docker,
 * CI, RDS) this creates them once. On Supabase they already exist, so nothing changes.
 */
export const supabaseCompatibilitySql = `
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
    END IF;
END $$;
`

/** Reads `<version>_<name>.sql` files in version order. */
export async function readMigrationFiles(dir = migrationsDir): Promise<MigrationFile[]> {
    const entries = await readdir(dir)

    return entries
        .filter(entry => /^\d+_.+\.sql$/.test(entry))
        .sort()
        .map(entry => {
            const [version, ...rest] = entry.replace(/\.sql$/, '').split('_')

            return { version, name: rest.join('_'), file: path.join(dir, entry) }
        })
}

/** Files whose version is not applied yet, in the order they run. */
export function pendingMigrations(files: MigrationFile[], applied: ReadonlySet<string>): MigrationFile[] {
    return files.filter(file => !applied.has(file.version))
}

/**
 * The versions already applied. The first run against a Supabase project copies
 * the history from supabase_migrations.schema_migrations, so nothing runs twice.
 */
async function appliedVersions(
    client: pg.Client,
    importSupabaseHistory: boolean,
    log: (line: string) => void
): Promise<Set<string>> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            version text PRIMARY KEY,
            name text NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
    `)

    const { rows } = await client.query<{ version: string }>('SELECT version FROM public.schema_migrations')

    if (rows.length || !importSupabaseHistory) {
        return new Set(rows.map(row => row.version))
    }

    const supabaseHistory = await client.query<{ exists: boolean }>(
        `SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS exists`
    )

    if (!supabaseHistory.rows[0]?.exists) {
        return new Set()
    }

    const imported = await client.query<{ version: string }>(`
        INSERT INTO public.schema_migrations (version, name)
        SELECT version, coalesce(name, '') FROM supabase_migrations.schema_migrations
        ON CONFLICT (version) DO NOTHING
        RETURNING version
    `)

    log(`Copied ${imported.rowCount} applied versions from supabase_migrations.schema_migrations.`)

    const all = await client.query<{ version: string }>('SELECT version FROM public.schema_migrations')

    return new Set(all.rows.map(row => row.version))
}

export type MigrateOptions = {
    dryRun?: boolean
    /**
     * Copy Supabase's history on the first run (default true). db:reset turns this off:
     * it has just dropped every table, so nothing in that history is applied any more.
     */
    importSupabaseHistory?: boolean
    log?: (line: string) => void
}

/**
 * Applies every pending migration file. Each file and its history row commit together,
 * so a failed file leaves the database as it was before that file.
 * @returns The files that ran, or would run on a dry run.
 */
export async function migrate(client: pg.Client, options: MigrateOptions = {}): Promise<MigrationFile[]> {
    const log = options.log ?? (line => console.log(line))

    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])

    try {
        if (!options.dryRun) {
            await client.query(supabaseCompatibilitySql)
        }

        const importSupabaseHistory = options.importSupabaseHistory ?? true
        const applied = options.dryRun
            ? await recordedVersions(client, importSupabaseHistory)
            : await appliedVersions(client, importSupabaseHistory, log)
        const pending = pendingMigrations(await readMigrationFiles(), applied)

        if (!pending.length) {
            log('No pending migrations.')
            return []
        }

        for (const migration of pending) {
            if (options.dryRun) {
                log(`Would apply ${migration.version}_${migration.name}`)
                continue
            }

            const sql = await readFile(migration.file, 'utf8')

            await client.query('BEGIN')
            try {
                await client.query(sql)
                await client.query(
                    'INSERT INTO public.schema_migrations (version, name) VALUES ($1, $2)',
                    [migration.version, migration.name]
                )
                await client.query('COMMIT')
            } catch (error) {
                await client.query('ROLLBACK')
                throw new Error(`Migration ${migration.version}_${migration.name} failed: ${error instanceof Error ? error.message : error}`)
            }

            log(`Applied ${migration.version}_${migration.name}`)
        }

        return pending
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
    }
}

/**
 * The applied versions, read without writing anything: public.schema_migrations when it
 * has rows, otherwise Supabase's history. A dry run uses this.
 */
async function recordedVersions(client: pg.Client, importSupabaseHistory: boolean): Promise<Set<string>> {
    const tables = importSupabaseHistory
        ? ['public.schema_migrations', 'supabase_migrations.schema_migrations']
        : ['public.schema_migrations']

    for (const table of tables) {
        const { rows: [found] } = await client.query<{ exists: boolean }>(
            'SELECT to_regclass($1) IS NOT NULL AS exists',
            [table]
        )

        if (!found?.exists) {
            continue
        }

        const { rows } = await client.query<{ version: string }>(`SELECT version FROM ${table}`)

        if (rows.length) {
            return new Set(rows.map(row => row.version))
        }
    }

    return new Set()
}

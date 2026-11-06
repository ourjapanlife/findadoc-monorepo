import { readFileSync } from 'node:fs'
import type pg from 'pg'
import { envVariables } from './environmentVariables.js'
import { isLocalHost, localDatabaseConfig } from './localDatabase.js'

/** The flag a script needs, next to `--write`, to change production rows. */
export const CONFIRM_PRODUCTION_FLAG = '--confirm-production'

/** The production role that may only read (see the rds_operator_roles migration). */
export const READONLY_DATABASE_USER = 'findadoc_readonly'

/** True when `pnpm db:prod` started this process, so it is about to touch production. */
export function isProductionTarget(): boolean {
    return envVariables.databaseTarget() === 'production'
}

/**
 * Connection for one-off scripts such as backfills.
 *
 * Outside `pnpm db:prod` this is the local Docker database, and any other host is refused, so a
 * stray PGHOST cannot point a backfill at production. Inside `pnpm db:prod` it is RDS through the
 * SSH tunnel: connect to the tunnel (PGHOSTADDR), check the certificate against the RDS CA for the
 * real hostname (PGHOST), and sign in with the IAM token that `pnpm db:prod` put in PGPASSWORD.
 */
export function scriptDatabaseConfig(): pg.ClientConfig {
    if (isProductionTarget()) {
        return productionConfig()
    }

    if (envVariables.isProduction()) {
        throw new Error('Run production scripts through pnpm db:prod. See apps/docs production-database.')
    }

    const local = localDatabaseConfig()
    if (!isLocalHost(local.host)) {
        throw new Error(`Scripts only reach a remote database through pnpm db:prod. PGHOST is ${local.host}.`)
    }
    return local
}

function productionConfig(): pg.ClientConfig {
    const host = envVariables.pgHost()
    const hostAddr = envVariables.pgHostAddr()
    const caFile = envVariables.pgSslRootCert()
    const user = envVariables.pgUser()
    const password = envVariables.pgPassword()
    const port = Number(envVariables.pgPort())

    if (!host || !hostAddr || !caFile || !user || !password || !Number.isInteger(port)) {
        throw new Error('The production connection is incomplete. Start this script with pnpm db:prod.')
    }

    return {
        host: hostAddr,
        port,
        user,
        password,
        database: 'postgres',
        application_name: envVariables.pgAppName(),
        // The tunnel ends on this machine, so name the RDS host for the certificate check.
        ssl: { ca: readFileSync(caFile, 'utf8'), servername: host, rejectUnauthorized: true },
        connectionTimeoutMillis: 10000
    }
}

/** One line that says which database a script is about to use. Holds no secret. */
export function describeScriptTarget(write: boolean): string {
    const mode = write ? 'WRITE' : 'dry-run'
    if (isProductionTarget()) {
        return `[${mode}] PRODUCTION database as ${envVariables.pgUser() ?? 'unknown role'} (through pnpm db:prod)`
    }
    return `[${mode}] local database`
}

/**
 * Refuse a production write that was not asked for twice. A dry-run is always allowed.
 * The read-only role is refused here too, so the script fails before it plans anything.
 */
export function assertScriptWriteAllowed(write: boolean, argv: readonly string[] = process.argv): void {
    if (!write || !isProductionTarget()) {
        return
    }
    if (envVariables.pgUser() === READONLY_DATABASE_USER) {
        throw new Error('This role can only read. Start it with pnpm db:prod --role operator.')
    }
    if (!argv.includes(CONFIRM_PRODUCTION_FLAG)) {
        throw new Error(`This writes to PRODUCTION. Run the dry-run first, then add ${CONFIRM_PRODUCTION_FLAG}.`)
    }
}

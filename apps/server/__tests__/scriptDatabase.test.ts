import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    assertScriptWriteAllowed,
    CONFIRM_PRODUCTION_FLAG,
    describeScriptTarget,
    scriptDatabaseConfig
} from '../utils/scriptDatabase.js'

const CA_BUNDLE = fileURLToPath(new URL('../certs/rds-ap-northeast-1-bundle.pem', import.meta.url))
const RDS_HOST = 'findadoc.example.ap-northeast-1.rds.amazonaws.com'

/** The variables `pnpm db:prod` sets for the command it runs. */
function stubProductionTunnel(user: string) {
    vi.stubEnv('FINDADOC_DB_TARGET', 'production')
    vi.stubEnv('PGHOST', RDS_HOST)
    vi.stubEnv('PGHOSTADDR', '127.0.0.1')
    vi.stubEnv('PGPORT', '15432')
    vi.stubEnv('PGUSER', user)
    vi.stubEnv('PGPASSWORD', 'fake-iam-token')
    vi.stubEnv('PGSSLROOTCERT', CA_BUNDLE)
}

describe('scriptDatabase', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    describe('outside pnpm db:prod', () => {
        it('uses the local database', () => {
            vi.stubEnv('FINDADOC_DB_TARGET', '')
            vi.stubEnv('PGHOST', '127.0.0.1')

            expect(scriptDatabaseConfig()).toMatchObject({ host: '127.0.0.1', database: 'postgres' })
            expect(describeScriptTarget(false)).toBe('[dry-run] local database')
        })

        it('refuses a remote host, so a stray PGHOST cannot reach production', () => {
            vi.stubEnv('FINDADOC_DB_TARGET', '')
            vi.stubEnv('PGHOST', RDS_HOST)

            expect(() => scriptDatabaseConfig()).toThrow(/pnpm db:prod/)
        })

        it('refuses NODE_ENV=production', () => {
            vi.stubEnv('FINDADOC_DB_TARGET', '')
            vi.stubEnv('NODE_ENV', 'production')

            expect(() => scriptDatabaseConfig()).toThrow(/pnpm db:prod/)
        })

        it('allows a local write without the production flag', () => {
            vi.stubEnv('FINDADOC_DB_TARGET', '')

            expect(() => assertScriptWriteAllowed(true, ['--write'])).not.toThrow()
        })
    })

    describe('inside pnpm db:prod', () => {
        it('connects to the tunnel and checks the certificate for the RDS host', () => {
            stubProductionTunnel('findadoc_readonly')

            const config = scriptDatabaseConfig()

            expect(config).toMatchObject({ host: '127.0.0.1', port: 15432, user: 'findadoc_readonly' })
            expect(config.ssl).toMatchObject({ servername: RDS_HOST, rejectUnauthorized: true })
            expect(describeScriptTarget(true)).toContain('PRODUCTION database as findadoc_readonly')
        })

        it('refuses to connect without the tunnel settings', () => {
            stubProductionTunnel('findadoc_readonly')
            vi.stubEnv('PGHOSTADDR', '')

            expect(() => scriptDatabaseConfig()).toThrow(/pnpm db:prod/)
        })

        it('allows a dry-run', () => {
            stubProductionTunnel('findadoc_readonly')

            expect(() => assertScriptWriteAllowed(false, [])).not.toThrow()
        })

        it('refuses a write from the read-only role', () => {
            stubProductionTunnel('findadoc_readonly')

            expect(() => assertScriptWriteAllowed(true, ['--write', CONFIRM_PRODUCTION_FLAG]))
                .toThrow(/--role operator/)
        })

        it('refuses an operator write without --confirm-production', () => {
            stubProductionTunnel('findadoc_operator')

            expect(() => assertScriptWriteAllowed(true, ['--write'])).toThrow(/--confirm-production/)
        })

        it('allows an operator write with --confirm-production', () => {
            stubProductionTunnel('findadoc_operator')

            expect(() => assertScriptWriteAllowed(true, ['--write', CONFIRM_PRODUCTION_FLAG])).not.toThrow()
        })
    })
})

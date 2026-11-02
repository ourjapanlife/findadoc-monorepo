import { afterEach, describe, expect, it } from 'vitest'
import { clientConfig } from '../utils/backfillProfessionalInsurance.js'

const saved = { ...process.env }

describe('insurance backfill connection', () => {
    afterEach(() => {
        process.env = { ...saved }
    })

    it('uses the local Docker password without TLS by default', () => {
        delete process.env.PGHOST
        delete process.env.PGPORT
        delete process.env.PGUSER
        delete process.env.PGPASSWORD
        delete process.env.PGSSLMODE
        delete process.env.DB_IAM_AUTH
        process.env.NODE_ENV = 'test'

        expect(clientConfig()).toEqual({
            host: '127.0.0.1',
            port: 54322,
            user: 'postgres',
            password: 'postgres',
            database: 'postgres'
        })
    })

    it('signs an IAM token over TLS when DB_IAM_AUTH is true', async () => {
        Object.assign(process.env, {
            PGHOST: 'findadoc.example.ap-northeast-1.rds.amazonaws.com',
            PGPORT: '5432',
            PGUSER: 'findadoc_api',
            DB_IAM_AUTH: 'true',
            AWS_REGION: 'ap-northeast-1',
            AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
            AWS_SECRET_ACCESS_KEY: 'example-secret'
        })
        delete process.env.PGPASSWORD

        const config = clientConfig()

        expect(config.user).toBe('findadoc_api')
        expect(config.port).toBe(5432)
        expect(config.ssl).toEqual({ rejectUnauthorized: true })
        expect(typeof config.password).toBe('function')

        const token = await (config.password as () => Promise<string>)()

        expect(token).toContain('DBUser=findadoc_api')
        expect(token).toContain('X-Amz-Signature=')
    })

    it('refuses IAM auth without a database user instead of falling back to postgres', () => {
        Object.assign(process.env, { DB_IAM_AUTH: 'true', PGPORT: '5432' })
        delete process.env.PGUSER

        expect(() => clientConfig()).toThrow('Set PGUSER')
    })

    it('refuses the transaction pooler port', () => {
        Object.assign(process.env, { PGPORT: '6543' })

        expect(() => clientConfig()).toThrow('session database port')
    })
})

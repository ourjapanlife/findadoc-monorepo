import { afterEach, describe, expect, it } from 'vitest'
import { poolConfig } from '../src/kyselyClient.js'

const saved = { ...process.env }

describe('poolConfig', () => {
    afterEach(() => {
        process.env = { ...saved }
    })

    it('uses the password and the local port by default', () => {
        delete process.env.PGPORT
        delete process.env.DB_IAM_AUTH
        delete process.env.DB_POOL_MAX

        const config = poolConfig()

        expect(config.port).toBe(54322)
        expect(typeof config.password).toBe('string')
        expect(config.ssl).toBeUndefined()
        expect(config.max).toBe(100)
        expect(config.connectionTimeoutMillis).toBe(2000)
    })

    it('signs an IAM token over TLS on RDS', async () => {
        Object.assign(process.env, {
            PGHOST: 'findadoc.example.ap-northeast-1.rds.amazonaws.com',
            PGPORT: '5432',
            PGUSER: 'findadoc_api',
            DB_IAM_AUTH: 'true',
            DB_POOL_MAX: '2',
            AWS_REGION: 'ap-northeast-1',
            AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
            AWS_SECRET_ACCESS_KEY: 'example-secret'
        })

        const config = poolConfig()

        expect(config.port).toBe(5432)
        expect(config.max).toBe(2)
        expect(config.connectionTimeoutMillis).toBe(10000)
        expect(config.ssl).toEqual({ rejectUnauthorized: true })
        expect(typeof config.password).toBe('function')

        const token = await (config.password as () => Promise<string>)()

        expect(token).toContain('findadoc.example.ap-northeast-1.rds.amazonaws.com:5432/?Action=connect')
        expect(token).toContain('DBUser=findadoc_api')
        expect(token).toContain('X-Amz-Signature=')
    })
})

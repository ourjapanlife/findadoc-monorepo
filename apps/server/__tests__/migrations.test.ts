import { describe, expect, it } from 'vitest'
import { pendingMigrations, readMigrationFiles } from '../scripts/db/migrations.js'

describe('migration files', () => {
    it('reads every migration in version order', async () => {
        const files = await readMigrationFiles()
        const versions = files.map(file => file.version)

        expect(files[0]).toMatchObject({ version: '20261005000000', name: 'baseline_remote_schema' })
        expect(versions).toEqual([...versions].sort())
        expect(new Set(versions).size).toBe(versions.length)
    })

    it('runs only the versions that are not applied yet', async () => {
        const files = await readMigrationFiles()
        const applied = new Set(files.slice(0, -1).map(file => file.version))

        expect(pendingMigrations(files, applied)).toEqual([files.at(-1)])
        expect(pendingMigrations(files, new Set())).toEqual(files)
    })
})

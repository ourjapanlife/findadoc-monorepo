import { readFile } from 'node:fs/promises'
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

    it('inserts the showcase clinic and links the existing facility', async () => {
        const files = await readMigrationFiles()
        const showcase = files.find(file => file.name === 'showcase_clinic_site')
        if (showcase === undefined) {
            throw new Error('showcase_clinic_site migration is missing')
        }
        const sql = await readFile(showcase.file, 'utf8')

        expect(sql).toContain("'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'::uuid")
        expect(sql).toContain("(SELECT id FROM facilities WHERE id = 'c32c316a-a368-499b-abaf-c5c973cb67e5'::uuid)")
        expect(sql).toContain("'multilingual-online-clinic'")
        expect(sql).toContain('COALESCE(EXCLUDED.facility_id, clinic_sites.facility_id)')
        expect(sql).not.toContain('INSERT INTO facilities')
        expect(sql).not.toContain('DELETE FROM clinic_memberships')
    })
})

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { pendingMigrations, readMigrationFiles } from '../scripts/db/migrations.js'
import { clinicSiteSeeds, SHOWCASE_CLINIC_SITE_ID, SHOWCASE_FACILITY_ID } from '../scripts/seed/clinicSiteContent.js'

/** `'it''s'` in SQL is `it's`. */
function unquoteSql(literal: string): string {
    return literal.replace(/''/g, '\'')
}

/** Every `'<locale>', '<name>', '<description>', $showcase$<json>$showcase$` row in the migration. */
function localeRowsInSql(sql: string): Map<string, { name: string, description: string, document: unknown }> {
    const pattern = /'([a-z]{2}-[A-Z]{2})', '((?:[^']|'')*)', '((?:[^']|'')*)', \$showcase\$(.*?)\$showcase\$::jsonb/g
    const rows = new Map<string, { name: string, description: string, document: unknown }>()
    for (const match of sql.matchAll(pattern)) {
        const [, locale, name, description, json] = match
        if (locale === undefined || name === undefined || description === undefined || json === undefined) {
            continue
        }
        rows.set(locale, { name: unquoteSql(name), description: unquoteSql(description), document: JSON.parse(json) })
    }
    return rows
}

/** The newest migration that rewrites the showcase clinic's locale rows. */
async function showcaseLocalesMigrationSql(): Promise<string> {
    const files = await readMigrationFiles()
    for (const file of [...files].reverse()) {
        const sql = await readFile(file.file, 'utf8')
        if (sql.includes('INSERT INTO clinic_site_locales') && sql.includes(`'${SHOWCASE_CLINIC_SITE_ID}'::uuid`)) {
            return sql
        }
    }
    throw new Error('no migration writes the showcase clinic locales')
}

async function showcaseMigrationSql(): Promise<string> {
    const files = await readMigrationFiles()
    const showcase = files.find(file => file.name === 'showcase_clinic_site')
    if (showcase === undefined) {
        throw new Error('showcase_clinic_site migration is missing')
    }
    return readFile(showcase.file, 'utf8')
}

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
        const sql = await showcaseMigrationSql()

        expect(sql).toContain(`'${SHOWCASE_CLINIC_SITE_ID}'::uuid`)
        expect(sql).toContain(`(SELECT id FROM facilities WHERE id = '${SHOWCASE_FACILITY_ID}'::uuid)`)
        expect(sql).toContain("'multilingual-online-clinic'")
        expect(sql).toContain('COALESCE(EXCLUDED.facility_id, clinic_sites.facility_id)')
        expect(sql).not.toContain('INSERT INTO facilities')
        expect(sql).not.toContain('DELETE FROM clinic_memberships')
    })

    it('writes the same showcase page as the seed', async () => {
        const seed = clinicSiteSeeds.find(site => site.id === SHOWCASE_CLINIC_SITE_ID)
        if (seed === undefined) {
            throw new Error('the showcase clinic is not in clinicSiteSeeds')
        }
        const sql = await showcaseMigrationSql()

        expect(sql).toContain(`'${seed.slug}',\n    '${seed.status}',\n    '${seed.share_image_path}',\n    '${seed.hero_path}',`)
        expect(sql).toContain(`$showcase$${JSON.stringify(seed.theme)}$showcase$::jsonb`)

        for (const [index, language] of seed.languages.entries()) {
            expect(sql).toContain(
                `('${seed.id}'::uuid, ${index}, '${language.code}', '${language.native}', '${language.bcp47}')`
            )
        }
        for (const [index, doctor] of seed.doctors.entries()) {
            expect(sql).toContain(
                `('${seed.id}'::uuid, ${index}, '${doctor.nameJa}', '${doctor.nameEn}', '${doctor.image}', '${doctor.position}', NULL)`
            )
        }

        const rows = localeRowsInSql(await showcaseLocalesMigrationSql())
        expect([...rows.keys()].sort()).toEqual(Object.keys(seed.copy).sort())
        for (const [locale, copy] of Object.entries(seed.copy)) {
            const row = rows.get(locale)
            expect(row?.name, locale).toBe(copy.name)
            expect(row?.description, locale).toBe(copy.description)
            expect(row?.document, locale).toEqual(JSON.parse(JSON.stringify(copy)))
        }
    })
})

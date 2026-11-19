import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'kysely'
import { Locale, type LocalizedName } from '@findadoc/graphql'
import { db } from '../src/kyselyClient.js'
import { asJsonb } from '../utils/dbUtils.js'

const CHECK_VIOLATION = '23514'
const ROMAJI = { firstName: 'Hanako', lastName: 'Yamada', locale: Locale.EnUs }
const JAPANESE = { firstName: '花子', lastName: '山田', locale: Locale.JaJp }
const insertedIds: string[] = []

async function insertNames(names: unknown[]): Promise<string> {
    const now = new Date().toISOString()
    const row = await db.insertInto('hps')
        .values({
            // Bound as raw jsonb so a malformed list reaches the database rule, not the API validation.
            names: sql<LocalizedName[]>`${JSON.stringify(names)}::jsonb`,
            degrees: asJsonb([]),
            primary_license: null,
            additional_credentials: asJsonb([]),
            license_review: null,
            license_recommendation: null,
            specialties: asJsonb([]),
            spoken_languages: asJsonb([]),
            additional_info_for_patients: null,
            email: null,
            created_date: now,
            updated_date: now
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    insertedIds.push(row.id)
    return row.id
}

async function violation(names: unknown[]): Promise<unknown> {
    return insertNames(names).then(() => null, (error: unknown) => (error as { code?: unknown }).code)
}

afterAll(async () => {
    if (insertedIds.length) {
        await db.deleteFrom('hps').where('id', 'in', insertedIds).execute()
    }
})

describe('hps_names_two_locales (#282)', () => {
    it('stores one romaji name with a middle name and one Japanese name', async () => {
        const id = await insertNames([{ ...ROMAJI, middleName: 'Rose' }, JAPANESE])

        expect(id).toBeTruthy()
    })

    it('stores the Japanese name first', async () => {
        expect(await insertNames([JAPANESE, ROMAJI])).toBeTruthy()
    })

    it('refuses a professional with one name', async () => {
        expect(await violation([ROMAJI])).toBe(CHECK_VIOLATION)
        expect(await violation([JAPANESE])).toBe(CHECK_VIOLATION)
    })

    it('refuses no names', async () => {
        expect(await violation([])).toBe(CHECK_VIOLATION)
    })

    it('refuses a third name', async () => {
        expect(await violation([ROMAJI, JAPANESE, { ...ROMAJI, locale: Locale.KoKr }])).toBe(CHECK_VIOLATION)
    })

    it('refuses two names in the same locale', async () => {
        expect(await violation([ROMAJI, ROMAJI])).toBe(CHECK_VIOLATION)
    })

    it('refuses a locale other than romaji or Japanese', async () => {
        expect(await violation([ROMAJI, { ...JAPANESE, locale: Locale.ZhCn }])).toBe(CHECK_VIOLATION)
    })

    it('refuses a blank first or last name', async () => {
        expect(await violation([{ ...ROMAJI, firstName: ' ' }, JAPANESE])).toBe(CHECK_VIOLATION)
        expect(await violation([ROMAJI, { firstName: '花子', locale: Locale.JaJp }])).toBe(CHECK_VIOLATION)
    })

    it('refuses a middle name on the Japanese name', async () => {
        expect(await violation([ROMAJI, { ...JAPANESE, middleName: 'ローズ' }])).toBe(CHECK_VIOLATION)
    })

    it('refuses a list entry that is not a name', async () => {
        expect(await violation([ROMAJI, 'Yamada'])).toBe(CHECK_VIOLATION)
    })
})

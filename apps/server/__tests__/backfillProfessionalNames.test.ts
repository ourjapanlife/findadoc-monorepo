import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Locale, NameReviewStatus, type LocalizedName } from '@findadoc/graphql'
import { backfillProfessionalNames } from '../utils/backfillProfessionalNames.js'
import { scriptDatabaseConfig } from '../utils/scriptDatabase.js'

const ROMAJI: LocalizedName = { firstName: 'Taro', lastName: 'Yamada', locale: Locale.EnUs }
const KANJI: LocalizedName = { firstName: '太郎', lastName: '試験', locale: Locale.JaJp }
const KOREAN: LocalizedName = { firstName: 'Taro', lastName: 'Yamada', locale: Locale.KoKr }

let client: pg.Client
const insertedIds: string[] = []

async function insertProfessional(names: LocalizedName[], nameReview: string | null = null): Promise<string> {
    const result = await client.query<{ id: string }>(`
        insert into hps (names, degrees, specialties, spoken_languages, name_review, created_date, updated_date)
        values ($1::jsonb, '[]', '[]', '[]', $2, now(), now())
        returning id
    `, [JSON.stringify(names), nameReview])
    const id = result.rows[0]?.id
    if (!id) {
        throw new Error('insert returned no id')
    }
    insertedIds.push(id)
    return id
}

async function stored(id: string): Promise<{ names: LocalizedName[], name_review: string | null }> {
    const result = await client.query<{ names: LocalizedName[], name_review: string | null }>(
        'select names, name_review from hps where id = $1',
        [id]
    )
    const row = result.rows[0]
    if (!row) {
        throw new Error('row not found')
    }
    return row
}

beforeAll(async () => {
    client = new pg.Client(scriptDatabaseConfig())
    await client.connect()
})

afterAll(async () => {
    if (insertedIds.length) {
        await client.query('delete from hps where id = any($1::uuid[])', [insertedIds])
    }
    await client.end()
})

describe('backfillProfessionalNames (#282)', () => {
    it('changes nothing on a dry run', async () => {
        const id = await insertProfessional([ROMAJI, KOREAN])

        const report = await backfillProfessionalNames(client, false)

        expect(report.updated).toBe(0)
        expect((await stored(id)).names).toEqual([ROMAJI, KOREAN])
    })

    it('drops other locales, fills or flags a missing name, and skips a confirmed row', async () => {
        const extraLocale = await insertProfessional([KOREAN, KANJI, ROMAJI])
        const romajiOnly = await insertProfessional([ROMAJI])
        const kanjiOnly = await insertProfessional([KANJI])
        const confirmed = await insertProfessional([ROMAJI, KOREAN], NameReviewStatus.Confirmed)

        const report = await backfillProfessionalNames(client, true)

        expect(report.updated).toBeGreaterThanOrEqual(3)
        expect(await stored(extraLocale)).toEqual({ names: [ROMAJI, KANJI], name_review: null })
        expect(await stored(romajiOnly)).toEqual({
            names: [ROMAJI, { firstName: 'タロ', lastName: 'ヤマダ', locale: Locale.JaJp }],
            name_review: NameReviewStatus.NeedsReview
        })
        expect(await stored(kanjiOnly)).toEqual({ names: [KANJI], name_review: NameReviewStatus.NeedsReview })
        expect(await stored(confirmed)).toEqual({ names: [ROMAJI, KOREAN], name_review: NameReviewStatus.Confirmed })
    })

    it('reports counts and ids, never a name', async () => {
        await insertProfessional([KANJI])

        const report = await backfillProfessionalNames(client, false)
        const printed = JSON.stringify(report)

        expect(printed).not.toContain(KANJI.firstName)
        expect(printed).not.toContain(ROMAJI.lastName)
    })
})

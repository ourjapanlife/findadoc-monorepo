import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { Gender, type CreateHealthcareProfessionalInput, Degree, Locale, Specialty } from '@findadoc/graphql'
import { ErrorCode, type Result } from '../src/result.js'
import {
    isGender,
    validateCreateProfessionalInput,
    validateGender,
    validateUpdateProfessionalInput
} from '../src/validation/validationHealthcareProfessional.js'
import { professionalFromRow } from '../src/services/mappersEntityService.js'
import { buildHpUpdatePatch } from '../src/services/healthcareProfessionalService.js'
import { scriptDatabaseConfig } from '../utils/scriptDatabase.js'
import type { Selectable } from 'kysely'
import type { HpsTable } from '../src/typeDefs/kyselyTypes.js'

const NAMES = [
    { firstName: 'Hana', lastName: 'Test', locale: Locale.EnUs },
    { firstName: '花', lastName: 'テスト', locale: Locale.JaJp }
]

function check(gender: unknown) {
    const result: Result<unknown> = { data: undefined, hasErrors: false, errors: [] }
    validateGender(gender, result)
    return result.errors?.map(error => [error.field, error.errorCode])
}

function createInput(gender: unknown): CreateHealthcareProfessionalInput {
    return {
        names: NAMES,
        degrees: [Degree.Md],
        specialties: [Specialty.ObstetricsAndGynecology],
        spokenLanguages: [Locale.EnUs],
        facilityIds: ['00000000-0000-0000-0000-000000000001'],
        // The test sends what a client could send, not only what the type allows.
        gender: gender as Gender
    }
}

function row(gender: string): Selectable<HpsTable> {
    return {
        id: 'hp',
        names: NAMES,
        spoken_languages: [Locale.EnUs],
        degrees: [Degree.Md],
        primary_license: Degree.Md,
        additional_credentials: [],
        license_review: null,
        name_review: null,
        // A value the CHECK would refuse, to test the mapper on its own.
        gender: gender as Gender,
        license_recommendation: null,
        specialties: [],
        additional_info_for_patients: null,
        email: null,
        firestore_id: null,
        search_text: '',
        created_date: '2026-11-24T00:00:00.000Z',
        updated_date: '2026-11-24T00:00:00.000Z',
        archived_at: null,
        archived_reason: null,
        archived_by: null
    }
}

describe('validateGender', () => {
    it('accepts the four genders and an absent gender', () => {
        for (const gender of [Gender.Male, Gender.Female, Gender.Unspecified, Gender.Unknown, undefined, null]) {
            expect(check(gender)).toEqual([])
        }
    })

    it('refuses any other value', () => {
        for (const gender of ['OTHER', 'male', '', 'selfDescribe', 1]) {
            expect(check(gender)).toEqual([['gender', ErrorCode.INVALID_GENDER]])
        }
        expect(isGender('NON_BINARY')).toBe(false)
    })

    it('refuses another value on create and on update', () => {
        expect(validateCreateProfessionalInput(createInput('OTHER')).errors?.map(error => error.errorCode))
            .toEqual([ErrorCode.INVALID_GENDER])
        expect(validateUpdateProfessionalInput({ gender: 'OTHER' as Gender }).errors?.map(error => error.errorCode))
            .toEqual([ErrorCode.INVALID_GENDER])
        expect(validateCreateProfessionalInput(createInput(undefined)).hasErrors).toBe(false)
        expect(validateUpdateProfessionalInput({ gender: Gender.Female }).hasErrors).toBe(false)
    })
})

describe('professionalFromRow gender', () => {
    it('returns the stored gender', () => {
        expect(professionalFromRow(row(Gender.Female)).gender).toBe(Gender.Female)
        expect(professionalFromRow(row(Gender.Unspecified)).gender).toBe(Gender.Unspecified)
    })

    it('reads a value it does not know as UNKNOWN', () => {
        expect(professionalFromRow(row('OTHER')).gender).toBe(Gender.Unknown)
    })
})

describe('buildHpUpdatePatch gender', () => {
    it('stores a new gender', () => {
        expect(buildHpUpdatePatch({ gender: Gender.Male }).gender).toBe(Gender.Male)
    })

    it('leaves the stored gender alone when the update omits it or sends null', () => {
        expect(buildHpUpdatePatch({ specialties: [Specialty.Urology] })).not.toHaveProperty('gender')
        expect(buildHpUpdatePatch({ gender: null })).not.toHaveProperty('gender')
    })
})

/** Inserts one professional in a rolled-back transaction and returns its gender or the Postgres error. */
async function insertProfessional(gender?: string): Promise<{ gender?: string, constraint?: string }> {
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()
    await client.query('begin')
    try {
        const columns = gender === undefined ? '' : ', gender'
        const values = gender === undefined ? '' : ', $2'
        const inserted = await client.query<{ gender: string }>(`
            insert into hps (
                names, degrees, additional_credentials, specialties, spoken_languages,
                created_date, updated_date${columns}
            )
            values ($1, '["MD"]', '[]', '[]', '["en_US"]', now(), now()${values})
            returning gender
        `, gender === undefined ? [JSON.stringify(NAMES)] : [JSON.stringify(NAMES), gender])
        return { gender: inserted.rows[0]?.gender }
    } catch (error) {
        return { constraint: (error as { constraint?: string }).constraint }
    } finally {
        await client.query('rollback')
        await client.end()
    }
}

// The migration's default fills every existing row, so no backfill script was needed (#224).
describe('hps.gender', () => {
    it('is UNKNOWN for a row written without a gender, as every row before the migration was', async () => {
        expect(await insertProfessional()).toEqual({ gender: Gender.Unknown })
    })

    it('keeps one of the four genders', async () => {
        expect(await insertProfessional(Gender.Female)).toEqual({ gender: Gender.Female })
    })

    it('refuses any other value', async () => {
        expect(await insertProfessional('OTHER')).toEqual({ constraint: 'hps_gender_check' })
    })
})

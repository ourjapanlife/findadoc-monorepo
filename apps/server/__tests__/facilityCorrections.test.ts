import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'kysely'
import request from 'supertest'
import type { GraphQLResolveInfo } from 'graphql'
import {
    CorrectionReporterRelation,
    FacilityCorrectionReason,
    FacilityVerificationStatus,
    Locale,
    PaymentType,
    SubmissionKind,
    type ContactInput,
    type FacilityCorrectionInput
} from '@findadoc/graphql'
import { FIELD_LIMITS } from '@findadoc/utils'
import { db } from '../src/kyselyClient.js'
import { ErrorCode } from '../src/result.js'
import { gqlApiUrl } from './testSetup.test.js'
import resolvers from '../src/resolvers.js'
import type { UserContext } from '../src/auth.js'
import { submitFacilityCorrection } from '../src/services/facilityCorrectionService.js'
import { searchSubmissions, updateSubmission } from '../src/services/submissionService.js'
import { validateFacilityCorrectionInput } from '../src/validation/validateFacilityCorrection.js'
import { storedContactText } from '../src/corrections/facilityCorrection.js'
import {
    DECIDED_NOTES_RETENTION_DAYS,
    UNDECIDED_NOTES_RETENTION_DAYS
} from '../src/submissions/notesRetention.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MODERATOR = 'test|moderator'
const VISITOR = 'anonymous'

const CONTACT = {
    // Stored as E.164, as every facility phone is (#229).
    phone: '+81355550100',
    email: 'front-desk@example.com',
    website: 'https://clinic.example.com',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=35.65,139.74',
    address: {
        postalCode: '105-0011',
        prefectureEn: 'Tokyo',
        cityEn: 'Minato',
        addressLine1En: '1-1-1 Shibakoen',
        addressLine2En: '2F',
        prefectureJa: '東京都',
        cityJa: '港区',
        addressLine1Ja: '芝公園1-1-1',
        addressLine2Ja: '2階'
    }
} satisfies ContactInput

const createdFacilityIds: string[] = []
let cityIds: string[] = []

async function insertFacility(options: { published: boolean }): Promise<string> {
    const now = new Date().toISOString()
    const row = await db.insertInto('facilities')
        .values({
            code: null,
            name_en: 'Correction Test Clinic',
            name_ja: '訂正テストクリニック',
            contact: CONTACT,
            map_latitude: 35.65,
            map_longitude: 139.74,
            created_date: now,
            updated_date: now,
            firestore_id: null,
            payment_options: JSON.stringify([{ paymentType: PaymentType.Cash, paymentBrands: [] }]),
            city_id: options.published ? cityIds[0]! : null,
            // An offline facility needs a place id (#230). Fake, and unique per row.
            google_place_id: `ChIJcorrectionTest${randomUUID().slice(0, 8)}`,
            source: null,
            verification_status: options.published
                ? FacilityVerificationStatus.Confirmed
                : FacilityVerificationStatus.UnverifiedLocation,
            supported_languages: JSON.stringify([Locale.EnUs])
        })
        .returning('id')
        .executeTakeFirstOrThrow()

    createdFacilityIds.push(row.id)
    return row.id
}

async function facilityRow(id: string) {
    return db.selectFrom('facilities').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

/** Submits a correction and returns the id of the stored row, which the visitor never sees. */
async function submitAndFind(input: FacilityCorrectionInput): Promise<string> {
    const result = await submitFacilityCorrection(input, VISITOR)
    expect(result.errors).toBeUndefined()

    const row = await db.selectFrom('submissions')
        .select('id')
        .where('facilities_id', '=', input.facilityId)
        .where('kind', '=', 'correction')
        .orderBy('created_date', 'desc')
        .executeTakeFirstOrThrow()
    return row.id
}

/** What a moderator does to a clinic page: no city, and back to UNVERIFIED_LOCATION. */
async function unpublish(facilityId: string): Promise<void> {
    await db.updateTable('facilities')
        .set({ city_id: null, verification_status: FacilityVerificationStatus.UnverifiedLocation })
        .where('id', '=', facilityId)
        .execute()
}

/** Whole days from now until a stored retain_until. */
function daysUntil(retainUntil: string | null): number {
    return Math.round((Date.parse(retainUntil ?? '') - Date.now()) / DAY_MS)
}

function errorCodes(result: { errors?: Array<{ errorCode: ErrorCode }> }): ErrorCode[] {
    return (result.errors ?? []).map(error => error.errorCode)
}

beforeAll(async () => {
    const cities = await db.selectFrom('cities').select('id').orderBy('lg_code').limit(2).execute()
    cityIds = cities.map(city => city.id)
    expect(cityIds).toHaveLength(2)
})

afterAll(async () => {
    if (createdFacilityIds.length > 0) {
        // Corrections cascade with their facility.
        await db.deleteFrom('facilities').where('id', 'in', createdFacilityIds).execute()
    }
})

describe('validateFacilityCorrectionInput', () => {
    const facilityId = randomUUID()

    it('accepts a field sent with its reason', () => {
        const result = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongLanguages],
            supportedLanguages: [Locale.EnUs, Locale.JaJp],
            reporterRelation: CorrectionReporterRelation.Patient
        })

        expect(result.hasErrors).toBe(false)
    })

    it('refuses an empty reason list', () => {
        expect(errorCodes(validateFacilityCorrectionInput({ facilityId, reasons: [] }))).toContain(ErrorCode.REQUIRED)
    })

    it('refuses a field sent under a different reason', () => {
        const result = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongPayment],
            phone: '03-5555-0199'
        })

        expect(result.errors).toContainEqual(expect.objectContaining({
            field: 'phone',
            errorCode: ErrorCode.CORRECTION_FIELD_WITHOUT_REASON
        }))
    })

    it('refuses notes over the limit and notes with a script tag', () => {
        const long = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.Other],
            notes: 'a'.repeat(FIELD_LIMITS.correctionNotes + 1)
        })
        const script = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.Other],
            notes: '<script>alert(1)</script>'
        })

        expect(errorCodes(long)).toContain(ErrorCode.INVALID_LENGTH_TOO_LONG)
        expect(errorCodes(script)).toContain(ErrorCode.INVALID_INPUT)
    })

    it('refuses a website that is not https', () => {
        const result = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongContact],
            website: 'http://clinic.example.com'
        })

        expect(errorCodes(result)).toContain(ErrorCode.INVALID_WEBSITE)
    })

    it('refuses a duplicate link that is not a Find a Doc listing', () => {
        const other = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.Duplicate],
            duplicateListingUrl: 'https://example.com/clinic/tokyo/minato/other'
        })
        const script = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.Duplicate],
            duplicateListingUrl: 'javascript:alert(1)'
        })
        const listing = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.Duplicate],
            duplicateListingUrl: 'https://www.findadoc.jp/clinic/tokyo/minato/other-clinic'
        })

        expect(errorCodes(other)).toContain(ErrorCode.INVALID_LISTING_URL)
        expect(errorCodes(script)).toContain(ErrorCode.INVALID_LISTING_URL)
        expect(listing.hasErrors).toBe(false)
    })

    it('refuses a payment brand outside the controlled list', () => {
        const free = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongPayment],
            paymentOptions: [{ paymentType: PaymentType.CreditCard, paymentBrands: ['My Card'] }]
        })
        const listed = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongPayment],
            paymentOptions: [{ paymentType: PaymentType.CreditCard, paymentBrands: ['Visa'] }]
        })

        expect(errorCodes(free)).toEqual([ErrorCode.INVALID_INPUT])
        expect(listed.hasErrors).toBe(false)
    })

    it('refuses a language that is not published', () => {
        const result = validateFacilityCorrectionInput({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongLanguages],
            supportedLanguages: [Locale.Und]
        })

        expect(result.hasErrors).toBe(true)
    })
})

describe('storedContactText', () => {
    it('reads the text fields of a stored contact and treats anything else as empty', () => {
        expect(storedContactText({ phone: '+81355550100', email: 7, website: null })).toEqual({
            phone: '+81355550100',
            email: '',
            website: ''
        })
        expect(storedContactText(null)).toEqual({ phone: '', email: '', website: '' })
        expect(storedContactText(['+81355550100'])).toEqual({ phone: '', email: '', website: '' })
    })
})

describe('submitFacilityCorrection', () => {
    it('stores a signed-out report as a pending correction with only the changed fields', async () => {
        const facilityId = await insertFacility({ published: true })
        const response = await request(gqlApiUrl).post('').send({
            query: `mutation Correct($input: FacilityCorrectionInput!) {
                submitFacilityCorrection(input: $input) { isSuccessful }
            }`,
            variables: {
                input: {
                    facilityId,
                    reasons: [FacilityCorrectionReason.WrongLanguages],
                    supportedLanguages: [Locale.EnUs, Locale.JaJp],
                    notes: 'The receptionist also speaks Japanese.',
                    reporterRelation: CorrectionReporterRelation.Patient
                }
            }
        })

        expect(response.body.errors).toBeUndefined()
        expect(response.body.data.submitFacilityCorrection).toEqual({ isSuccessful: true })

        const row = await db.selectFrom('submissions')
            .selectAll()
            .where('facilities_id', '=', facilityId)
            .executeTakeFirstOrThrow()

        expect(row.kind).toBe('correction')
        expect(row.status).toBe('pending')
        expect(row.correction_reasons).toEqual([FacilityCorrectionReason.WrongLanguages])
        expect(row.correction_changes).toEqual({ supportedLanguages: [Locale.EnUs, Locale.JaJp] })
        expect(row.reporter_relation).toBe(CorrectionReporterRelation.Patient)
        expect(row.facility_partial).toBeNull()
        expect(daysUntil(row.retain_until)).toBe(UNDECIDED_NOTES_RETENTION_DAYS)
    })

    it('reads back through the moderation query without a null in a non-null field', async () => {
        const facilityId = await insertFacility({ published: true })
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongContact],
            website: 'https://new.example.com'
        })
        const response = await request(gqlApiUrl).post('').send({
            query: `query Read($id: ID!) {
                submission(id: $id) {
                    id kind googleMapsUrl healthcareProfessionalName spokenLanguages
                    correction { facilityId reasons reporterRelation changes { website phone address { cityEn } } }
                }
            }`,
            variables: { id: submissionId }
        })

        expect(response.body.errors).toBeUndefined()
        expect(response.body.data.submission).toMatchObject({
            kind: SubmissionKind.Correction,
            googleMapsUrl: '',
            spokenLanguages: [],
            correction: {
                facilityId,
                reasons: [FacilityCorrectionReason.WrongContact],
                reporterRelation: null,
                changes: { website: 'https://new.example.com', phone: null, address: null }
            }
        })
    })

    it('refuses a facility that does not exist', async () => {
        const result = await submitFacilityCorrection({
            facilityId: randomUUID(),
            reasons: [FacilityCorrectionReason.Closed]
        }, VISITOR)

        expect(errorCodes(result)).toEqual([ErrorCode.NOT_FOUND])
    })

    it('refuses a facility that is not published', async () => {
        const facilityId = await insertFacility({ published: false })
        const result = await submitFacilityCorrection({
            facilityId,
            reasons: [FacilityCorrectionReason.Closed]
        }, VISITOR)

        expect(errorCodes(result)).toEqual([ErrorCode.FACILITY_NOT_PUBLISHED])
    })

    it('keeps the notes out of the audit log', async () => {
        const facilityId = await insertFacility({ published: true })
        const note = `audit-check-${randomUUID()}`
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.Other],
            notes: note
        })

        const logs = await db.selectFrom('audit_logs')
            .select(sql<string>`new_value::text`.as('text'))
            .where(sql<string>`new_value::text`, 'like', `%${submissionId}%`)
            .execute()

        expect(logs.length).toBeGreaterThan(0)
        expect(logs.some(log => log.text.includes(note))).toBe(false)
    })

    it('stops an address after its budget, before the service runs', async () => {
        const context = {
            user: { sub: VISITOR, name: 'Anonymous', email: '', roles: [], scope: '' },
            clientIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`
        } satisfies UserContext
        const call = () => Promise.resolve().then(() => resolvers.Mutation.submitFacilityCorrection(
            {},
            { input: { facilityId: 'not-a-uuid', reasons: [] } },
            context,
            {} as GraphQLResolveInfo
        ))

        for (let attempt = 0; attempt < 5; attempt++) {
            await expect(call()).rejects.toMatchObject({
                extensions: { errors: expect.not.arrayContaining([
                    expect.objectContaining({ errorCode: ErrorCode.TOO_MANY_REQUESTS })
                ]) }
            })
        }
        await expect(call()).rejects.toMatchObject({
            extensions: { errors: [expect.objectContaining({ errorCode: ErrorCode.TOO_MANY_REQUESTS })] }
        })
    })
})

describe('approving a correction', () => {
    it('changes only the fields the visitor named and leaves the rest identical', async () => {
        const facilityId = await insertFacility({ published: true })
        const before = await facilityRow(facilityId)
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongLanguages, FacilityCorrectionReason.WrongContact],
            supportedLanguages: [Locale.EnUs, Locale.KoKr],
            phone: '03-5555-0199'
        })

        const result = await updateSubmission(submissionId, { isApproved: true }, MODERATOR)
        expect(result.errors).toBeUndefined()
        expect(result.data.isApproved).toBe(true)

        const after = await facilityRow(facilityId)
        expect(after.supported_languages).toEqual([Locale.EnUs, Locale.KoKr])
        expect(after.contact).toEqual({ ...before.contact, phone: '+81355550199' })
        expect(after.name_en).toBe(before.name_en)
        expect(after.name_ja).toBe(before.name_ja)
        expect(after.payment_options).toEqual(before.payment_options)
        expect(after.city_id).toBe(before.city_id)
        expect(after.verification_status).toBe(before.verification_status)
        expect(after.map_latitude).toBe(before.map_latitude)

        const submission = await db.selectFrom('submissions').selectAll()
            .where('id', '=', submissionId).executeTakeFirstOrThrow()
        expect(daysUntil(submission.retain_until)).toBe(DECIDED_NOTES_RETENTION_DAYS)
    })

    it('changes nothing on the facility for a closed or duplicate report', async () => {
        const facilityId = await insertFacility({ published: true })
        const before = await facilityRow(facilityId)
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.Closed, FacilityCorrectionReason.Duplicate],
            duplicateListingUrl: 'https://findadoc.jp/clinic/tokyo/minato/the-other-listing'
        })

        const result = await updateSubmission(submissionId, { isApproved: true }, MODERATOR)
        expect(result.errors).toBeUndefined()

        const after = await facilityRow(facilityId)
        expect({ ...after, updated_date: before.updated_date }).toEqual(before)
    })

    it('waits for a moderator to choose the city of a wrong-city report', async () => {
        const facilityId = await insertFacility({ published: true })
        const address = { ...CONTACT.address, addressLine1En: '2-2-2 Shibakoen', addressLine1Ja: '芝公園2-2-2' }
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongCity],
            address
        })

        const early = await updateSubmission(submissionId, { isApproved: true }, MODERATOR)
        expect(errorCodes(early)).toEqual([ErrorCode.CORRECTION_CITY_REQUIRED])
        expect((await facilityRow(facilityId)).contact).toEqual(CONTACT)

        const chosen = await updateSubmission(submissionId, { correctionCityId: cityIds[1]! }, MODERATOR)
        expect(chosen.errors).toBeUndefined()
        expect(chosen.data.correction?.changes.cityId).toBe(cityIds[1])

        const approved = await updateSubmission(submissionId, { isApproved: true }, MODERATOR)
        expect(approved.errors).toBeUndefined()

        const after = await facilityRow(facilityId)
        expect(after.city_id).toBe(cityIds[1])
        expect(after.contact.address).toEqual(address)
        expect(after.contact.phone).toBe(CONTACT.phone)
    })

    it('refuses to change a facility that was unpublished after the report', async () => {
        const facilityId = await insertFacility({ published: true })
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongLanguages],
            supportedLanguages: [Locale.JaJp]
        })
        await unpublish(facilityId)

        const result = await updateSubmission(submissionId, { isApproved: true }, MODERATOR)

        expect(errorCodes(result)).toEqual([ErrorCode.FACILITY_NOT_PUBLISHED])
        expect((await facilityRow(facilityId)).supported_languages).toEqual([Locale.EnUs])
    })

    it('still approves a closed report after the moderator unpublished the clinic', async () => {
        const facilityId = await insertFacility({ published: true })
        const submissionId = await submitAndFind({ facilityId, reasons: [FacilityCorrectionReason.Closed] })
        await unpublish(facilityId)

        const result = await updateSubmission(submissionId, { isApproved: true }, MODERATOR)

        expect(result.errors).toBeUndefined()
        expect(result.data.isApproved).toBe(true)
    })
})

describe('moderating a correction', () => {
    it('refuses listing fields on a correction and a city the visitor did not report', async () => {
        const facilityId = await insertFacility({ published: true })
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.WrongLanguages],
            supportedLanguages: [Locale.JaJp]
        })

        const listingField = await updateSubmission(submissionId, { healthcareProfessionalName: 'Someone' }, MODERATOR)
        const city = await updateSubmission(submissionId, { correctionCityId: cityIds[1]! }, MODERATOR)

        expect(errorCodes(listingField)).toEqual([ErrorCode.SUBMISSION_KIND_MISMATCH])
        expect(errorCodes(city)).toEqual([ErrorCode.CORRECTION_FIELD_WITHOUT_REASON])
    })

    it('starts the decided notes clock on decline and puts the submit cap back on reopen', async () => {
        const facilityId = await insertFacility({ published: true })
        const submissionId = await submitAndFind({
            facilityId,
            reasons: [FacilityCorrectionReason.Other],
            notes: 'Opening hours changed.'
        })
        const retainUntil = async () => (await db.selectFrom('submissions').select('retain_until')
            .where('id', '=', submissionId).executeTakeFirstOrThrow()).retain_until

        expect((await updateSubmission(submissionId, { isRejected: true }, MODERATOR)).errors).toBeUndefined()
        expect(daysUntil(await retainUntil())).toBe(DECIDED_NOTES_RETENTION_DAYS)

        expect((await updateSubmission(submissionId, { isUnderReview: true }, MODERATOR)).errors).toBeUndefined()
        expect(daysUntil(await retainUntil())).toBe(UNDECIDED_NOTES_RETENTION_DAYS)
    })

    it('lists corrections apart from listings', async () => {
        const facilityId = await insertFacility({ published: true })
        await submitAndFind({ facilityId, reasons: [FacilityCorrectionReason.Closed] })

        const corrections = await searchSubmissions({ kind: SubmissionKind.Correction, limit: 50 })
        const listings = await searchSubmissions({ kind: SubmissionKind.Listing, limit: 50 })

        expect(corrections.data.length).toBeGreaterThan(0)
        expect(corrections.data.every(submission => submission.kind === SubmissionKind.Correction)).toBe(true)
        expect(listings.data.every(submission => submission.kind === SubmissionKind.Listing)).toBe(true)
    })
})


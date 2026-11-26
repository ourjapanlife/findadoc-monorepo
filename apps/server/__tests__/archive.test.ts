import { afterAll, describe, expect, it } from 'vitest'
import { ArchiveFilter, Specialty } from '@findadoc/graphql'
import { sql } from 'kysely'
import { db } from '../src/kyselyClient.js'
import type { BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { resolvePublicBookingTarget } from '../src/booking/target.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { generateRandomCreateHealthcareProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { ErrorCode } from '../src/result.js'
import * as archiveService from '../src/services/archiveService.js'
import { getClinicSiteBySlug } from '../src/services/clinicSiteService.js'
import { featureIdToPlaceId } from '../src/places/mapsLink.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import * as facilityService from '../src/services/facilityService.js'
import * as healthcareProfessionalService from '../src/services/healthcareProfessionalService.js'
import { ARCHIVE_REASON_MAX, validateArchiveInput } from '../src/validation/validateArchive.js'
import { removeTestFacility } from './fixtures/removeTestFacility.js'

const MODERATOR = 'test|moderator'
const IMPORT_SOURCE = 'archive-test-fixture.xlsx'

const facilityIds: string[] = []
const professionalIds: string[] = []
const bookedFacilityIds: string[] = []

async function createFacility(): Promise<string> {
    const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), MODERATOR)
    expect(created.hasErrors).toBe(false)
    facilityIds.push(created.data.id)
    return created.data.id
}

async function createProfessional(facilityId: string, specialties?: Specialty[]): Promise<string> {
    const input = generateRandomCreateHealthcareProfessionalInput({ facilityIds: [facilityId] })
    const created = await healthcareProfessionalService.createHealthcareProfessional(
        specialties === undefined ? input : { ...input, specialties },
        MODERATOR
    )
    expect(created.hasErrors).toBe(false)
    professionalIds.push(created.data.id)
    return created.data.id
}

afterAll(async () => {
    await db.deleteFrom('institution_import_rows').where('source_file', '=', IMPORT_SOURCE).execute()
    for (const facilityId of bookedFacilityIds) {
        await db.deleteFrom('booking_appointments').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('booking_submissions').where('facility_id', '=', facilityId).execute()
    }
    if (professionalIds.length > 0) {
        await db.deleteFrom('hps_facilities').where('hps_id', 'in', professionalIds).execute()
        await db.deleteFrom('hps').where('id', 'in', professionalIds).execute()
    }
    for (const facilityId of facilityIds) {
        await removeTestFacility(facilityId)
    }
})

describe('validateArchiveInput', () => {
    const id = '00000000-0000-4000-8000-000000000000'

    it('requires a uuid and a reason that is not blank', () => {
        expect(validateArchiveInput('not-a-uuid', 'Closed').errors?.[0]?.errorCode).toBe(ErrorCode.INVALID_ID)
        expect(validateArchiveInput(id, '').errors?.[0]).toMatchObject({ field: 'reason', errorCode: ErrorCode.REQUIRED })
        expect(validateArchiveInput(id, '  \n ').errors?.[0]?.errorCode).toBe(ErrorCode.REQUIRED)
        expect(validateArchiveInput(id, 'Closed').hasErrors).toBe(false)
    })

    it('limits the reason to the database limit', () => {
        expect(validateArchiveInput(id, 'x'.repeat(ARCHIVE_REASON_MAX)).hasErrors).toBe(false)
        expect(validateArchiveInput(id, 'x'.repeat(ARCHIVE_REASON_MAX + 1)).errors?.[0]?.errorCode)
            .toBe(ErrorCode.INVALID_LENGTH_TOO_LONG)
    })
})

describe('archiveFacility', () => {
    it('archives an imported facility that has an institution import row, and keeps the row', async () => {
        // Deleting such a facility failed on institution_import_rows_facility_outcome.
        const facilityId = await createFacility()
        await db.insertInto('institution_import_rows').values({
            source_file: IMPORT_SOURCE,
            sheet_name: 'Sheet1',
            row_number: 2,
            colour: 'none',
            raw: JSON.stringify({ name: 'Fake Imported Clinic' }),
            outcome: 'created',
            facility_id: facilityId
        }).execute()

        const archived = await archiveService.archiveFacility(facilityId, '  Closed (ministry list)  ', MODERATOR)

        expect(archived.hasErrors).toBe(false)
        expect(archived.data.archivedAt).toBeTruthy()
        expect(archived.data.archivedReason).toBe('Closed (ministry list)')
        const importRow = await db.selectFrom('institution_import_rows')
            .select(['facility_id', 'outcome'])
            .where('source_file', '=', IMPORT_SOURCE)
            .executeTakeFirst()
        expect(importRow).toEqual({ facility_id: facilityId, outcome: 'created' })
        const stored = await db.selectFrom('facilities')
            .select(['archived_reason', 'archived_by'])
            .where('id', '=', facilityId)
            .executeTakeFirst()
        expect(stored).toEqual({ archived_reason: 'Closed (ministry list)', archived_by: MODERATOR })
    })

    it('keeps the professional links and writes an audit log', async () => {
        const facilityId = await createFacility()
        const professionalId = await createProfessional(facilityId)

        const archived = await archiveService.archiveFacility(facilityId, 'Duplicate listing', MODERATOR)

        expect(archived.hasErrors).toBe(false)
        expect(archived.data.healthcareProfessionalIds).toEqual([professionalId])
        const links = await db.selectFrom('hps_facilities').selectAll().where('facilities_id', '=', facilityId).execute()
        expect(links).toEqual([{ hps_id: professionalId, facilities_id: facilityId }])
        const audit = await db.selectFrom('audit_logs')
            .select('new_value')
            .where('object_type', '=', 'Facility')
            .where(sql<string>`new_value->>'id'`, '=', facilityId)
            .orderBy('updated_date', 'desc')
            .executeTakeFirst()
        expect(JSON.stringify(audit?.new_value)).toContain('Duplicate listing')
    })

    it('refuses a blank reason, a second archive, and an unarchive of an active facility', async () => {
        const facilityId = await createFacility()

        const blank = await archiveService.archiveFacility(facilityId, ' ', MODERATOR)
        expect(blank.errors).toEqual([{ field: 'reason', errorCode: ErrorCode.REQUIRED, httpStatus: 400 }])

        const notArchived = await archiveService.unarchiveFacility(facilityId, MODERATOR)
        expect(notArchived.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_ARCHIVED)

        expect((await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)).hasErrors).toBe(false)
        const again = await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)
        expect(again.errors?.[0]).toMatchObject({ field: 'archiveFacility', errorCode: ErrorCode.ALREADY_ARCHIVED })

        const missing = await archiveService.archiveFacility('00000000-0000-4000-8000-000000000000', 'Closed', MODERATOR)
        expect(missing.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_FOUND)
    })

    it('unarchives and clears the reason', async () => {
        const facilityId = await createFacility()
        await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)

        const restored = await archiveService.unarchiveFacility(facilityId, MODERATOR)

        expect(restored.hasErrors).toBe(false)
        expect(restored.data.archivedAt).toBeNull()
        expect(restored.data.archivedReason).toBeNull()
        expect((await facilityService.getFacilityById(facilityId)).hasErrors).toBe(false)
    })

    it('is enforced by the database: archived needs a reason, active has none', async () => {
        const facilityId = await createFacility()

        await expect(db.updateTable('facilities')
            .set({ archived_at: new Date().toISOString(), archived_by: MODERATOR })
            .where('id', '=', facilityId)
            .execute()).rejects.toThrow(/facilities_archive_reason/)
        await expect(db.updateTable('facilities')
            .set({ archived_reason: 'Closed' })
            .where('id', '=', facilityId)
            .execute()).rejects.toThrow(/facilities_archive_reason/)
    })
})

describe('archived facilities in reads', () => {
    it('are left out of public reads and shown to moderators who ask', async () => {
        const facilityId = await createFacility()
        await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)

        const byId = await facilityService.getFacilityById(facilityId)
        expect(byId.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_FOUND)
        const moderatorById = await facilityService.getFacilityById(facilityId, { includeArchived: true })
        expect(moderatorById.data.id).toBe(facilityId)

        const publicList = await facilityService.searchFacilities({ query: facilityId })
        expect(publicList.data).toEqual([])
        expect((await facilityService.countFacilities({ query: facilityId })).data).toBe(0)

        const archivedList = await facilityService.searchFacilities({
            query: facilityId,
            archive: ArchiveFilter.Archived
        })
        expect(archivedList.data.map(facility => facility.id)).toEqual([facilityId])
        const allList = await facilityService.searchFacilities({ query: facilityId, archive: ArchiveFilter.All })
        expect(allList.data.map(facility => facility.id)).toEqual([facilityId])
        expect((await facilityService.countFacilities({ query: facilityId, archive: ArchiveFilter.All })).data).toBe(1)
    })

    it('leave a doctor page without a link to the archived clinic', async () => {
        const facilityId = await createFacility()
        const professionalId = await createProfessional(facilityId)
        await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)

        expect((await healthcareProfessionalService.facilityIdsByHpIds([professionalId])).get(professionalId))
            .toBeUndefined()
        expect((await healthcareProfessionalService.facilityIdsByHpIds([professionalId], { includeArchived: true }))
            .get(professionalId)).toEqual([facilityId])
    })

    it('do not take patient bookings', async () => {
        const facilityId = await createFacility()
        const owner: BookingAccess = { isAdmin: false, memberships: new Map([[facilityId, 'owner']]) }
        const settings = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [30],
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, owner)
        expect(settings.hasErrors).toBe(false)
        expect(await resolvePublicBookingTarget(facilityId)).toBeDefined()

        await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)

        expect(await resolvePublicBookingTarget(facilityId)).toBeUndefined()
    })
})

describe('archiveFacility with bookings', () => {
    const day = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000)
    day.setUTCHours(2, 0, 0, 0)
    const iso = (minutes: number) => new Date(day.getTime() + minutes * 60 * 1000).toISOString()

    it('refuses a clinic with an upcoming booking, says how many, and archives once it is answered', async () => {
        const facilityId = await createFacility()
        bookedFacilityIds.push(facilityId)
        const owner: BookingAccess = { isAdmin: false, memberships: new Map([[facilityId, 'owner']]) }
        await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [30],
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, owner)
        const window = await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(0), endsAt: iso(30) },
            'test|staff',
            owner
        )
        expect(window.hasErrors).toBe(false)
        const booked = await bookingService.submitBooking({
            clinicSiteId: facilityId,
            formDefinitionId: DEFAULT_BOOKING_FORM_ID,
            formVersion: 1,
            locale: 'en-US',
            answers: [
                { fieldId: 'email', value: 'patient@example.com' },
                { fieldId: 'phone', value: '090-1234-5678' },
                { fieldId: 'fullName', value: 'Test Patient' },
                { fieldId: 'reason', value: 'Checkup' }
            ],
            startsAt: iso(0),
            durationMinutes: 30,
            confirmedInJapan: true,
            healthDataConsent: true
        })
        expect(booked.hasErrors).toBe(false)

        const refused = await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)

        expect(refused.errors).toEqual([{
            field: 'archiveFacility',
            errorCode: ErrorCode.FACILITY_HAS_UPCOMING_BOOKINGS,
            httpStatus: 409,
            count: 1
        }])
        const stillActive = await db.selectFrom('facilities').select('archived_at').where('id', '=', facilityId)
            .executeTakeFirst()
        expect(stillActive?.archived_at).toBeNull()

        // A visit waiting on payment still holds its slot, so it blocks too.
        await db.updateTable('booking_appointments').set({ status: 'pending_payment' })
            .where('facility_id', '=', facilityId).execute()
        const refusedPending = await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)
        expect(refusedPending.errors?.[0]?.errorCode).toBe(ErrorCode.FACILITY_HAS_UPCOMING_BOOKINGS)

        // Once the clinic declines it, nothing holds the clinic open, and the booking is kept.
        await db.updateTable('booking_appointments').set({ status: 'declined' }).where('facility_id', '=', facilityId)
            .execute()
        const archived = await archiveService.archiveFacility(facilityId, 'Closed', MODERATOR)
        expect(archived.hasErrors).toBe(false)
        const bookings = await db.selectFrom('booking_submissions').select('id').where('facility_id', '=', facilityId)
            .execute()
        expect(bookings).toHaveLength(1)
    })
})

describe('archiveHealthcareProfessional', () => {
    it('hides the professional from public reads and keeps the facility links', async () => {
        const facilityId = await createFacility()
        const professionalId = await createProfessional(facilityId)

        const archived = await archiveService.archiveHealthcareProfessional(professionalId, 'Left the clinic', MODERATOR)

        expect(archived.hasErrors).toBe(false)
        expect(archived.data.facilityIds).toEqual([facilityId])
        expect(archived.data.archivedReason).toBe('Left the clinic')
        const publicRead = await healthcareProfessionalService.getHealthcareProfessionalById(professionalId)
        expect(publicRead.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_FOUND)
        expect((await healthcareProfessionalService.getHealthcareProfessionalById(professionalId, {
            includeArchived: true
        })).data.id).toBe(professionalId)
        expect((await healthcareProfessionalService.searchProfessionals({ ids: [professionalId] })).data).toEqual([])
        expect((await healthcareProfessionalService.countProfessionals({ facilityIds: [facilityId] })).data).toBe(0)
        expect((await healthcareProfessionalService.searchProfessionals({
            ids: [professionalId],
            archive: ArchiveFilter.Archived
        })).data.map(professional => professional.id)).toEqual([professionalId])

        // The clinic page no longer links to the doctor, but the link is kept for moderators.
        expect((await facilityService.hpIdsByFacilityIds([facilityId])).get(facilityId)).toBeUndefined()
        expect((await facilityService.hpIdsByFacilityIds([facilityId], { includeArchived: true })).get(facilityId))
            .toEqual([professionalId])
    })

    it('no longer makes the clinic match a specialty search', async () => {
        const facilityId = await createFacility()
        const professionalId = await createProfessional(facilityId, [Specialty.Dermatology])
        const filters = { query: facilityId, specialties: [Specialty.Dermatology] }
        const before = await facilityService.searchFacilities(filters)
        expect(before.data.map(facility => facility.id)).toEqual([facilityId])

        await archiveService.archiveHealthcareProfessional(professionalId, 'Left the clinic', MODERATOR)

        expect((await facilityService.searchFacilities(filters)).data).toEqual([])
    })

    it('unarchives, and refuses a second archive', async () => {
        const facilityId = await createFacility()
        const professionalId = await createProfessional(facilityId)
        await archiveService.archiveHealthcareProfessional(professionalId, 'Left the clinic', MODERATOR)

        const again = await archiveService.archiveHealthcareProfessional(professionalId, 'Again', MODERATOR)
        expect(again.errors?.[0]?.errorCode).toBe(ErrorCode.ALREADY_ARCHIVED)

        const restored = await archiveService.unarchiveHealthcareProfessional(professionalId, MODERATOR)
        expect(restored.hasErrors).toBe(false)
        expect(restored.data.archivedAt).toBeNull()
        const publicRead = await healthcareProfessionalService.getHealthcareProfessionalById(professionalId)
        expect(publicRead.hasErrors).toBe(false)
    })
})

describe('archived facilities and Maps links', () => {
    const suffix = Date.now().toString(36)
    const name = `Archive Maps Test Clinic ${suffix}`
    const linkName = name.replaceAll(' ', '+')

    async function setMapsIdentity(id: string, values: {
        name: string
        placeId?: string
        latitude: number
        longitude: number
    }) {
        await db.updateTable('facilities')
            .set({
                name_en: values.name,
                map_latitude: values.latitude,
                map_longitude: values.longitude,
                ...(values.placeId === undefined ? {} : { google_place_id: values.placeId })
            })
            .where('id', '=', id)
            .execute()
    }

    it('does not fall back to a same-named clinic when the exact place id is archived', async () => {
        const archivedId = await createFacility()
        const otherId = await createFacility()
        const featureId = `0x6018${suffix.padStart(10, '0').slice(-10)}:0x1`
        await setMapsIdentity(archivedId, {
            name, placeId: featureIdToPlaceId(...featureId.split(':') as [string, string]), latitude: 33.1, longitude: 131.1
        })
        await setMapsIdentity(otherId, { name, latitude: 33.2, longitude: 131.2 })
        await archiveService.archiveFacility(archivedId, 'Closed', MODERATOR)
        const url = `https://www.google.com/maps/place/${linkName}/@33.1,131.1,17z/data=!3m1!4b1!4m6!3m5!1s${featureId}`

        expect((await facilityService.getFacilityMatchingMapsUrl(url)).data).toBeNull()
        expect((await facilityService.getFacilityMatchingMapsUrl(url, { includeArchived: true })).data?.id)
            .toBe(archivedId)
    })

    it('keeps a name-and-pin conflict when the named clinic is archived', async () => {
        const namedId = await createFacility()
        const pinnedId = await createFacility()
        const conflictName = `Conflict Named Clinic ${suffix}`
        await setMapsIdentity(namedId, { name: conflictName, latitude: 33.3, longitude: 131.3 })
        await setMapsIdentity(pinnedId, { name: `Other Pin Clinic ${suffix}`, latitude: 33.456789, longitude: 131.456789 })
        await archiveService.archiveFacility(namedId, 'Closed', MODERATOR)
        const url = `https://www.google.com/maps/place/${conflictName.replaceAll(' ', '+')}/@33.456789,131.456789,17z`

        expect((await facilityService.getFacilityMatchingMapsUrl(url)).data).toBeNull()
    })
})

describe('archived professionals on clinic sites', () => {
    it('leave the public doctor list and keep the row', async () => {
        const facilityId = await createFacility()
        const professionalId = await createProfessional(facilityId)
        const slug = `archive-doctor-${Date.now().toString(36)}`
        const site = await db.insertInto('clinic_sites')
            .values({
                facility_id: facilityId,
                slug,
                status: 'preview',
                share_image_path: '/clinic-landings/archive-test/hero.jpg',
                hero_path: '/clinic-landings/archive-test/hero.jpg',
                theme: JSON.stringify({})
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        const doctor = { clinic_site_id: site.id, image_path: '/d.jpg', object_position: 'center' }
        await db.insertInto('clinic_site_doctors').values([
            { ...doctor, sort_order: 0, name_ja: '例 太郎', name_en: 'Taro Example', hp_id: professionalId },
            { ...doctor, sort_order: 1, name_ja: '例 花子', name_en: 'Hanako Example', hp_id: null }
        ]).execute()

        try {
            await archiveService.archiveHealthcareProfessional(professionalId, 'Left the clinic', MODERATOR)

            const page = await getClinicSiteBySlug(slug)
            expect(page?.doctors.map(row => row.nameEn)).toEqual(['Hanako Example'])
            const rows = await db.selectFrom('clinic_site_doctors').select('id').where('clinic_site_id', '=', site.id)
                .execute()
            expect(rows).toHaveLength(2)
        } finally {
            await db.deleteFrom('clinic_site_doctors').where('clinic_site_id', '=', site.id).execute()
            await db.deleteFrom('clinic_sites').where('id', '=', site.id).execute()
        }
    })
})

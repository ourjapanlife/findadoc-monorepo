import { db } from '../kyselyClient.js'
import { clinicThemeFromRow } from '../services/clinicSiteService.js'
import { DEFAULT_BOOKING_FORM_ID } from './formDefinitions.js'
import { DEFAULT_ALLOWED_DURATIONS, parseAllowedDurations } from './schedule.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type BookingTarget = {
    facilityId: string | null
    clinicSiteId: string | null
    clinicSiteSlug: string | null
    clinicName: string
    themePrimary: string | null
    allowedDurations: number[]
    formDefinitionId: string
}

function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value)
}

async function settingsForFacility(facilityId: string | null): Promise<{
    allowedDurations: number[]
    formDefinitionId: string
}> {
    if (facilityId === null) {
        return {
            allowedDurations: [...DEFAULT_ALLOWED_DURATIONS],
            formDefinitionId: DEFAULT_BOOKING_FORM_ID
        }
    }

    const row = await db.selectFrom('booking_settings')
        .select(['form_definition_id', 'allowed_durations'])
        .where('facility_id', '=', facilityId)
        .executeTakeFirst()

    if (row === undefined) {
        return {
            allowedDurations: [...DEFAULT_ALLOWED_DURATIONS],
            formDefinitionId: DEFAULT_BOOKING_FORM_ID
        }
    }

    return {
        allowedDurations: parseAllowedDurations(row.allowed_durations),
        formDefinitionId: row.form_definition_id
    }
}

async function targetFromFacility(facilityId: string): Promise<BookingTarget | undefined> {
    const facility = await db.selectFrom('facilities')
        .select(['id', 'name_en', 'name_ja'])
        .where('id', '=', facilityId)
        .executeTakeFirst()
    if (facility === undefined) {
        return undefined
    }

    const site = await db.selectFrom('clinic_sites')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'clinic_sites.id').on('locale.locale', '=', 'en-US'))
        .select([
            'clinic_sites.id',
            'clinic_sites.slug',
            'clinic_sites.status',
            'clinic_sites.theme',
            'locale.name'
        ])
        .where('clinic_sites.facility_id', '=', facility.id)
        .where('clinic_sites.status', '!=', 'draft')
        .executeTakeFirst()

    const settings = await settingsForFacility(facility.id)
    const clinicName = site?.name?.trim()
        || facility.name_en.trim()
        || facility.name_ja.trim()
        || facility.id
    const theme = site === undefined ? null : clinicThemeFromRow(site.theme)

    return {
        facilityId: facility.id,
        clinicSiteId: site?.id ?? null,
        clinicSiteSlug: site?.slug ?? null,
        clinicName,
        themePrimary: theme?.primary ?? null,
        allowedDurations: settings.allowedDurations,
        formDefinitionId: settings.formDefinitionId
    }
}

async function targetFromClinicSite(siteIdOrSlug: string, byId: boolean): Promise<BookingTarget | undefined> {
    let query = db.selectFrom('clinic_sites as site')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'site.id').on('locale.locale', '=', 'en-US'))
        .select([
            'site.id',
            'site.slug',
            'site.facility_id',
            'site.status',
            'site.theme',
            'locale.name'
        ])
        .where('site.status', '!=', 'draft')

    query = byId
        ? query.where('site.id', '=', siteIdOrSlug)
        : query.where('site.slug', '=', siteIdOrSlug)

    const site = await query.executeTakeFirst()
    if (site === undefined) {
        return undefined
    }

    if (site.facility_id !== null) {
        const fromFacility = await targetFromFacility(site.facility_id)
        if (fromFacility !== undefined) {
            return fromFacility
        }
    }

    const settings = await settingsForFacility(site.facility_id)
    const theme = clinicThemeFromRow(site.theme)
    return {
        facilityId: site.facility_id,
        clinicSiteId: site.id,
        clinicSiteSlug: site.slug,
        clinicName: site.name?.trim() || site.slug,
        themePrimary: theme.primary,
        allowedDurations: settings.allowedDurations,
        formDefinitionId: settings.formDefinitionId
    }
}

/** Facility id, clinic site id, or clinic site slug. */
export async function resolveBookingTarget(clinicIdOrSlug: string): Promise<BookingTarget | undefined> {
    const trimmed = clinicIdOrSlug.trim()
    if (trimmed === '') {
        return undefined
    }

    if (isUuid(trimmed)) {
        const byFacility = await targetFromFacility(trimmed)
        if (byFacility !== undefined) {
            return byFacility
        }
        return targetFromClinicSite(trimmed, true)
    }

    if (SLUG_PATTERN.test(trimmed)) {
        return targetFromClinicSite(trimmed, false)
    }

    return undefined
}

export function bookingLockKey(target: BookingTarget): string {
    return target.facilityId ?? target.clinicSiteId ?? 'booking'
}

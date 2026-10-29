import { db } from '../kyselyClient.js'
import { clinicThemeFromRow } from '../services/clinicSiteService.js'
import { DEFAULT_BOOKING_FORM_ID, parseFormDefinitionIds } from './formDefinitions.js'
import { DEFAULT_ALLOWED_DURATIONS, parseAllowedDurations, resolveDefaultDuration } from './schedule.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type BookingTarget = {
    facilityId: string | null
    clinicSiteId: string | null
    clinicSiteSlug: string | null
    clinicName: string
    themePrimary: string | null
    allowedDurations: number[]
    /** The offered length the Book page preselects. */
    defaultDuration: number
    /** Forms the clinic offers. The first is the default. */
    formDefinitionIds: string[]
    /** True when the facility has a booking_settings row. Patients may book only then. */
    bookingEnabled: boolean
}

// parseAllowedDurations never returns an empty list, so a default always resolves.
function defaultDurationFor(allowed: readonly number[], preferred?: number | null): number {
    return resolveDefaultDuration(allowed, preferred) ?? allowed[0]!
}

function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value)
}

export async function settingsForFacility(facilityId: string | null): Promise<{
    allowedDurations: number[]
    defaultDuration: number
    formDefinitionIds: string[]
    enabled: boolean
}> {
    if (facilityId === null) {
        return {
            allowedDurations: [...DEFAULT_ALLOWED_DURATIONS],
            defaultDuration: defaultDurationFor(DEFAULT_ALLOWED_DURATIONS),
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID],
            enabled: false
        }
    }

    const row = await db.selectFrom('booking_settings')
        .select(['form_definition_ids', 'allowed_durations', 'default_duration'])
        .where('facility_id', '=', facilityId)
        .executeTakeFirst()

    if (row === undefined) {
        return {
            allowedDurations: [...DEFAULT_ALLOWED_DURATIONS],
            defaultDuration: defaultDurationFor(DEFAULT_ALLOWED_DURATIONS),
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID],
            enabled: false
        }
    }

    const allowedDurations = parseAllowedDurations(row.allowed_durations)
    return {
        allowedDurations,
        defaultDuration: defaultDurationFor(allowedDurations, row.default_duration),
        formDefinitionIds: parseFormDefinitionIds(row.form_definition_ids),
        enabled: true
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
        defaultDuration: settings.defaultDuration,
        formDefinitionIds: settings.formDefinitionIds,
        bookingEnabled: settings.enabled
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
        defaultDuration: settings.defaultDuration,
        formDefinitionIds: settings.formDefinitionIds,
        bookingEnabled: settings.enabled
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

/**
 * resolveBookingTarget for the patient surface. A facility books only after a
 * moderator or owner saves its booking settings, so a directory clinic that
 * never opted in reads as missing.
 */
export async function resolvePublicBookingTarget(clinicIdOrSlug: string): Promise<BookingTarget | undefined> {
    const target = await resolveBookingTarget(clinicIdOrSlug)
    return target?.bookingEnabled === true ? target : undefined
}

/** Facility ids in the list that have saved booking settings. */
export async function bookingEnabledFacilityIds(facilityIds: readonly string[]): Promise<Set<string>> {
    if (facilityIds.length === 0) {
        return new Set()
    }
    const rows = await db.selectFrom('booking_settings')
        .select('facility_id')
        .where('facility_id', 'in', [...facilityIds])
        .execute()
    return new Set(rows.map(row => row.facility_id))
}

export function bookingLockKey(target: BookingTarget): string {
    return target.facilityId ?? target.clinicSiteId ?? 'booking'
}

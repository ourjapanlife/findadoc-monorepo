import { Locale, type BookingPractitioner } from '@findadoc/graphql'
import { db } from '../kyselyClient.js'

/**
 * Doctors at a booking clinic, and which schedules a patient's choice may book on.
 *
 * A schedule ("lane") is a doctor's own weekly hours and windows, or the clinic's
 * (practitionerId null). A doctor without rows of their own books on the clinic
 * schedule; naming them is a preference the clinic sees on the request.
 */

export type ScheduleLane = { practitionerId: string | null }

export const MAX_REQUESTED_LANGUAGES = 10

const LOCALES = new Set<string>(Object.values(Locale))

/** Known Locale values, unique, without `und`. Undefined when the list is not valid. */
export function parseRequestedLanguages(value: readonly string[] | null | undefined): Locale[] | undefined {
    const languages: Locale[] = []
    for (const language of value ?? []) {
        if (!LOCALES.has(language) || language === Locale.Und) {
            return undefined
        }
        if (!languages.includes(language as Locale)) {
            languages.push(language as Locale)
        }
    }
    return languages.length > MAX_REQUESTED_LANGUAGES ? undefined : languages
}

function speaksAll(spoken: readonly string[], requested: readonly string[]): boolean {
    return requested.every(language => spoken.includes(language))
}

/**
 * The schedules to search, in the order submit tries them. Undefined when the
 * chosen doctor does not practise at this clinic.
 *
 * With no doctor chosen: every doctor with their own schedule who speaks every
 * requested language, then the clinic schedule when the clinic covers those
 * languages, either itself (facilities.supported_languages) or through one doctor
 * on the clinic schedule who speaks them all. When the clinic's interpretation
 * covers the request, every doctor and the clinic schedule stay bookable.
 */
export function scheduleLanes(input: {
    practitioners: readonly BookingPractitioner[]
    facilityLanguages: readonly string[]
    practitionerId: string | null
    languages: readonly string[]
    offersInterpretation: boolean
}): ScheduleLane[] | undefined {
    if (input.practitionerId !== null) {
        const chosen = input.practitioners.find(practitioner => practitioner.id === input.practitionerId)
        if (chosen === undefined) {
            return undefined
        }
        return [{ practitionerId: chosen.hasOwnSchedule ? chosen.id : null }]
    }

    const languages = interpretationCovers(input) ? [] : input.languages
    const lanes: ScheduleLane[] = input.practitioners
        .filter(practitioner => practitioner.hasOwnSchedule && speaksAll(practitioner.spokenLanguages, languages))
        .map(practitioner => ({ practitionerId: practitioner.id }))

    const clinicCovers = languages.length === 0
        || speaksAll(input.facilityLanguages, languages)
        || input.practitioners.some(practitioner =>
            !practitioner.hasOwnSchedule && speaksAll(practitioner.spokenLanguages, languages))
    if (clinicCovers) {
        lanes.push({ practitionerId: null })
    }
    return lanes
}

/**
 * True when the clinic offers interpretation and lists every requested language,
 * so any doctor can see the patient in them (#205). A language the clinic does not
 * list still narrows the doctors as usual. Interpretation covers every listed
 * language at every open time today; per-language interpreter hours would be
 * checked here.
 */
export function interpretationCovers(input: {
    practitioners: readonly BookingPractitioner[]
    facilityLanguages: readonly string[]
    languages: readonly string[]
    offersInterpretation: boolean
}): boolean {
    if (!input.offersInterpretation) {
        return false
    }
    const offered: readonly string[] = clinicLanguages(input.practitioners, input.facilityLanguages)
    return speaksAll(offered, input.languages)
}

/** Languages the clinic can offer: its own list, then each doctor's. */
export function clinicLanguages(
    practitioners: readonly BookingPractitioner[],
    facilityLanguages: readonly string[]
): Locale[] {
    const languages: Locale[] = []
    const spoken = practitioners.flatMap(practitioner => practitioner.spokenLanguages)
    for (const language of [...facilityLanguages, ...spoken]) {
        if (LOCALES.has(language) && language !== Locale.Und && !languages.includes(language as Locale)) {
            languages.push(language as Locale)
        }
    }
    return languages
}

function stringList(value: unknown): string[] {
    if (typeof value === 'string') {
        try {
            return stringList(JSON.parse(value))
        } catch {
            return []
        }
    }
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Doctors linked to the facility, with whether each has a schedule of their own. Sorted by id. */
export async function listFacilityPractitioners(facilityId: string | null): Promise<BookingPractitioner[]> {
    if (facilityId === null) {
        return []
    }
    const [rows, scheduled] = await Promise.all([
        db.selectFrom('hps')
            .innerJoin('hps_facilities', 'hps_facilities.hps_id', 'hps.id')
            .select(['hps.id', 'hps.names', 'hps.spoken_languages', 'hps.specialties'])
            .where('hps_facilities.facilities_id', '=', facilityId)
            .orderBy('hps.id')
            .execute(),
        db.selectFrom('clinic_weekly_hours')
            .select('practitioner_id')
            .where('facility_id', '=', facilityId)
            .where('practitioner_id', 'is not', null)
            .union(db.selectFrom('clinic_availability_windows')
                .select('practitioner_id')
                .where('facility_id', '=', facilityId)
                .where('practitioner_id', 'is not', null)
                .where('ends_at', '>', new Date().toISOString()))
            .execute()
    ])
    const withSchedule = new Set(scheduled.map(row => row.practitioner_id))

    return rows.map(row => ({
        id: row.id,
        names: row.names ?? [],
        spokenLanguages: stringList(row.spoken_languages).filter(language => LOCALES.has(language)) as Locale[],
        specialties: row.specialties ?? [],
        hasOwnSchedule: withSchedule.has(row.id)
    }))
}

/** facilities.supported_languages, which may come back as a JSON string. */
export async function facilityLanguagesFor(facilityId: string | null): Promise<string[]> {
    if (facilityId === null) {
        return []
    }
    const row = await db.selectFrom('facilities')
        .select('supported_languages')
        .where('id', '=', facilityId)
        .executeTakeFirst()
    return stringList(row?.supported_languages)
}

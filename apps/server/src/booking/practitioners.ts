import { Locale, type BookingPractitioner } from '@findadoc/graphql'
import { db } from '../kyselyClient.js'

/**
 * Doctors at a booking clinic, and which schedules a patient's choice may book on.
 *
 * A schedule ("lane") is a doctor's own weekly hours and windows, or the clinic's
 * (practitionerId null). A doctor without rows of their own books on the clinic
 * schedule; naming them is a preference the clinic sees on the request. A lane may
 * also hold one interpreter (#205, docs/booking-interpretation.md).
 */

export type ScheduleLane = { practitionerId: string | null, interpreterId: string | null }

/** An interpreter's languages with null already read as every clinic language. */
export type InterpreterCoverage = { id: string, languages: readonly string[] }

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

/** Requested languages this schedule does not speak. */
export function languageGap(spoken: readonly string[], requested: readonly string[]): string[] {
    return requested.filter(language => !spoken.includes(language))
}

/** Interpreters who cover every language in the gap, in the clinic's order. One interpreter per visit. */
export function coveringInterpreters(
    interpreters: readonly InterpreterCoverage[],
    gap: readonly string[]
): InterpreterCoverage[] {
    return gap.length === 0 ? [] : interpreters.filter(interpreter => speaksAll(interpreter.languages, gap))
}

function interpretedLanes(
    practitionerId: string | null,
    interpreters: readonly InterpreterCoverage[],
    gap: readonly string[]
): ScheduleLane[] {
    return coveringInterpreters(interpreters, gap)
        .map(interpreter => ({ practitionerId, interpreterId: interpreter.id }))
}

/**
 * The schedules to search, in the order submit tries them. Undefined when the
 * chosen doctor does not practise at this clinic.
 *
 * With no doctor chosen, native lanes come first: every doctor with their own
 * schedule who speaks every requested language, then the clinic schedule when the
 * clinic covers them (facilities.supported_languages, or one doctor on clinic time
 * who speaks them all). Then interpreted lanes: each other doctor schedule and
 * clinic time, paired with each interpreter who covers what that schedule does not
 * speak. Interpreters are empty when the clinic has interpretation off.
 */
export function scheduleLanes(input: {
    practitioners: readonly BookingPractitioner[]
    facilityLanguages: readonly string[]
    practitionerId: string | null
    languages: readonly string[]
    interpreters: readonly InterpreterCoverage[]
}): ScheduleLane[] | undefined {
    if (input.practitionerId !== null) {
        return chosenDoctorLanes(input)
    }

    const ownSchedules = input.practitioners.filter(practitioner => practitioner.hasOwnSchedule)
    const native: ScheduleLane[] = ownSchedules
        .filter(practitioner => speaksAll(practitioner.spokenLanguages, input.languages))
        .map(practitioner => ({ practitionerId: practitioner.id, interpreterId: null }))
    const interpreted: ScheduleLane[] = ownSchedules.flatMap(practitioner =>
        interpretedLanes(
            practitioner.id,
            input.interpreters,
            languageGap(practitioner.spokenLanguages, input.languages)
        ))

    const clinicCovers = input.languages.length === 0
        || speaksAll(input.facilityLanguages, input.languages)
        || input.practitioners.some(practitioner =>
            !practitioner.hasOwnSchedule && speaksAll(practitioner.spokenLanguages, input.languages))
    if (clinicCovers) {
        native.push({ practitionerId: null, interpreterId: null })
    } else {
        interpreted.push(...interpretedLanes(
            null,
            input.interpreters,
            languageGap(input.facilityLanguages, input.languages)
        ))
    }
    return [...native, ...interpreted]
}

/**
 * A chosen doctor books on their own schedule, or on clinic time when they have
 * none. When they do not speak a requested language and an interpreter covers it,
 * only interpreted lanes are tried. Otherwise the choice stands, as before #205.
 */
function chosenDoctorLanes(input: {
    practitioners: readonly BookingPractitioner[]
    practitionerId: string | null
    languages: readonly string[]
    interpreters: readonly InterpreterCoverage[]
}): ScheduleLane[] | undefined {
    const chosen = input.practitioners.find(practitioner => practitioner.id === input.practitionerId)
    if (chosen === undefined) {
        return undefined
    }
    const practitionerId = chosen.hasOwnSchedule ? chosen.id : null
    const interpreted = interpretedLanes(
        practitionerId,
        input.interpreters,
        languageGap(chosen.spokenLanguages, input.languages)
    )
    return interpreted.length > 0 ? interpreted : [{ practitionerId, interpreterId: null }]
}

/** Languages the clinic can offer: its own list, each doctor's, then each interpreter's. */
export function clinicLanguages(
    practitioners: readonly BookingPractitioner[],
    facilityLanguages: readonly string[],
    interpreterLanguages: readonly (readonly string[] | null)[] = []
): Locale[] {
    const languages: Locale[] = []
    const spoken = practitioners.flatMap(practitioner => practitioner.spokenLanguages)
    const interpreted = interpreterLanguages.flatMap(list => list ?? [])
    for (const language of [...facilityLanguages, ...spoken, ...interpreted]) {
        if (LOCALES.has(language) && language !== Locale.Und && !languages.includes(language as Locale)) {
            languages.push(language as Locale)
        }
    }
    return languages
}

/** Each interpreter's languages, with null read as every language the clinic offers. */
export function interpreterCoverage(
    interpreters: readonly { id: string, languages: readonly string[] | null }[],
    offered: readonly string[]
): InterpreterCoverage[] {
    return interpreters.map(interpreter => ({ id: interpreter.id, languages: interpreter.languages ?? offered }))
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

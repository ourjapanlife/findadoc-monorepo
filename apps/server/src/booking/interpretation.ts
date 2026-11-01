import type { BookingAccess } from './access.js'
import { SLOT_HOLDING_STATUSES } from './lifecycle.js'
import { expandWeeklyHours, type TimeWindow, type WeeklyHours } from './schedule.js'
import { db } from '../kyselyClient.js'

/**
 * Clinic interpretation (#205). docs/booking-interpretation.md has the model.
 *
 * booking_interpretation says a clinic may use interpreters. It is meant to be a
 * paid add-on, so canChangeInterpretation is the one gate and billing hooks in
 * there. clinic_interpreters say which languages, when, and how many visits at once.
 */

export const INTERPRETATION_SOURCE = {
    PILOT: 'pilot',
    ADMIN: 'admin'
} as const

/** The label of the interpreter added when interpretation is turned on and the clinic has none. */
export const DEFAULT_INTERPRETER_LABEL = 'Interpretation'

export type Interpreter = {
    id: string
    label: string
    /** Null: every language the clinic lists. */
    languages: string[] | null
    /** Null: no limit. */
    capacity: number | null
    /** Empty: whenever the clinic is open. */
    hours: WeeklyHours[]
}

type Executor = Pick<typeof db, 'selectFrom'>

/** Who may turn interpretation on or off: admins only, until there is a plan to check. */
export function canChangeInterpretation(access: BookingAccess): boolean {
    return access.manageMembersAll
}

export async function offersInterpretation(facilityId: string | null): Promise<boolean> {
    if (facilityId === null) {
        return false
    }
    const row = await db.selectFrom('booking_interpretation')
        .select('facility_id')
        .where('facility_id', '=', facilityId)
        .executeTakeFirst()
    return row !== undefined
}

/** Every interpreter at the facility, with hours, oldest first. */
export async function listInterpreters(facilityId: string, executor: Executor = db): Promise<Interpreter[]> {
    const rows = await executor.selectFrom('clinic_interpreters')
        .select(['id', 'label', 'languages', 'capacity'])
        .where('facility_id', '=', facilityId)
        .orderBy('created_date')
        .orderBy('id')
        .execute()
    if (rows.length === 0) {
        return []
    }
    const hours = await executor.selectFrom('clinic_interpreter_hours')
        .select(['interpreter_id', 'weekday', 'start_minute', 'end_minute'])
        .where('interpreter_id', 'in', rows.map(row => row.id))
        .orderBy('weekday')
        .orderBy('start_minute')
        .execute()
    return rows.map(row => ({
        id: row.id,
        label: row.label,
        languages: row.languages,
        capacity: row.capacity,
        hours: hours
            .filter(block => block.interpreter_id === row.id)
            .map(block => ({ weekday: block.weekday, startMinute: block.start_minute, endMinute: block.end_minute }))
    }))
}

/** Interpreters a patient may book with: none unless the clinic has interpretation on. */
export async function activeInterpreters(facilityId: string | null): Promise<Interpreter[]> {
    if (facilityId === null || !await offersInterpretation(facilityId)) {
        return []
    }
    return listInterpreters(facilityId)
}

/**
 * Turns interpretation on or off. Callers check canChangeInterpretation first.
 * Turning it on adds one interpreter with every field empty (every language, all
 * open times, no limit) when the clinic has none. Turning it off keeps the rows.
 */
export async function setInterpretation(facilityId: string, enabled: boolean): Promise<void> {
    if (!enabled) {
        await db.deleteFrom('booking_interpretation').where('facility_id', '=', facilityId).execute()
        return
    }
    await db.transaction().execute(async transaction => {
        await transaction.insertInto('booking_interpretation')
            .values({ facility_id: facilityId, source: INTERPRETATION_SOURCE.ADMIN })
            .onConflict(conflict => conflict.column('facility_id').doNothing())
            .execute()
        const existing = await transaction.selectFrom('clinic_interpreters')
            .select('id')
            .where('facility_id', '=', facilityId)
            .executeTakeFirst()
        if (existing === undefined) {
            await transaction.insertInto('clinic_interpreters')
                .values({ facility_id: facilityId, label: DEFAULT_INTERPRETER_LABEL, languages: null, capacity: null })
                .execute()
        }
    })
}

/**
 * Starts the interpreter can take: inside their hours for the whole visit (any
 * time when they have none), and with fewer held visits overlapping it than
 * their capacity (any number when null).
 */
export function interpreterStarts(input: {
    starts: readonly Date[]
    durationMs: number
    interpreter: Pick<Interpreter, 'hours' | 'capacity'>
    held: readonly TimeWindow[]
    rangeStart: Date
    rangeEnd: Date
}): Date[] {
    // A start near the range end still needs its whole visit inside the hours.
    const hoursEnd = new Date(input.rangeEnd.getTime() + input.durationMs)
    const windows = input.interpreter.hours.length === 0
        ? undefined
        : expandWeeklyHours(input.interpreter.hours, input.rangeStart, hoursEnd)
    const capacity = input.interpreter.capacity ?? Number.POSITIVE_INFINITY
    return input.starts.filter(start => {
        const startMs = start.getTime()
        const endMs = startMs + input.durationMs
        const inHours = windows === undefined || windows.some(window =>
            window.startsAt.getTime() <= startMs && window.endsAt.getTime() >= endMs)
        const overlapping = input.held.filter(visit =>
            visit.startsAt.getTime() < endMs && visit.endsAt.getTime() > startMs).length
        return inHours && overlapping < capacity
    })
}

/** Visits this interpreter holds that overlap the range. */
export async function interpreterHolds(
    interpreterId: string,
    from: Date,
    to: Date,
    executor: Executor = db
): Promise<TimeWindow[]> {
    const rows = await executor.selectFrom('booking_appointments')
        .select(['starts_at', 'ends_at'])
        .where('interpreter_id', '=', interpreterId)
        .where('status', 'in', SLOT_HOLDING_STATUSES)
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
        .execute()
    return rows.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) }))
}

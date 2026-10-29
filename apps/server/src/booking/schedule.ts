/**
 * Staff availability is painted in 30-minute windows.
 * Patients pick a start every 15 minutes inside those windows.
 * Visit length is one of 15, 30, 45, or 60 minutes from the clinic settings.
 */

export const AVAILABILITY_SNAP_MINUTES = 30
export const BOOKING_SLOT_STEP_MINUTES = 15
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30
export const ALLOWED_APPOINTMENT_DURATIONS = [15, 30, 45, 60] as const
export const DEFAULT_ALLOWED_DURATIONS = [...ALLOWED_APPOINTMENT_DURATIONS]
export const MAX_PUBLIC_SLOT_RANGE_MS = 16 * 24 * 60 * 60 * 1000

export type AppointmentDurationMinutes = typeof ALLOWED_APPOINTMENT_DURATIONS[number]

const AVAILABILITY_SNAP_MS = AVAILABILITY_SNAP_MINUTES * 60 * 1000
const SLOT_STEP_MS = BOOKING_SLOT_STEP_MINUTES * 60 * 1000
const DEFAULT_DURATION_MS = DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000

export function isAppointmentDuration(value: number): value is AppointmentDurationMinutes {
    return ALLOWED_APPOINTMENT_DURATIONS.some(duration => duration === value)
}

export function parseAppointmentDuration(
    value: number | null | undefined,
    allowed: readonly number[] = DEFAULT_ALLOWED_DURATIONS
): AppointmentDurationMinutes | undefined {
    if (value === null || value === undefined || !Number.isInteger(value)) {
        return undefined
    }
    if (!isAppointmentDuration(value) || !allowed.includes(value)) {
        return undefined
    }
    return value
}

/** The length the Book page preselects: the clinic's choice, else 30 minutes when offered, else the shortest. */
export function resolveDefaultDuration(
    allowed: readonly number[] = DEFAULT_ALLOWED_DURATIONS,
    preferred?: number | null
): AppointmentDurationMinutes | undefined {
    const chosen = parseAppointmentDuration(preferred, allowed)
    if (chosen !== undefined) {
        return chosen
    }
    if (allowed.includes(DEFAULT_APPOINTMENT_DURATION_MINUTES)
      && isAppointmentDuration(DEFAULT_APPOINTMENT_DURATION_MINUTES)) {
        return DEFAULT_APPOINTMENT_DURATION_MINUTES
    }
    const shortest = [...allowed].sort((a, b) => a - b)[0]
    return shortest !== undefined && isAppointmentDuration(shortest) ? shortest : undefined
}

export function resolveAppointmentDuration(
    value: number | null | undefined,
    allowed: readonly number[] = DEFAULT_ALLOWED_DURATIONS,
    defaultDuration?: number | null
): AppointmentDurationMinutes | undefined {
    const parsed = parseAppointmentDuration(value, allowed)
    if (parsed !== undefined) {
        return parsed
    }
    if (value !== null && value !== undefined) {
        return undefined
    }
    return resolveDefaultDuration(allowed, defaultDuration)
}

export function parseAllowedDurations(value: unknown): AppointmentDurationMinutes[] {
    if (!Array.isArray(value)) {
        return [...DEFAULT_ALLOWED_DURATIONS]
    }
    const unique: AppointmentDurationMinutes[] = []
    for (const item of value) {
        const minutes = typeof item === 'number' ? item : Number(item)
        if (!isAppointmentDuration(minutes) || unique.includes(minutes)) {
            continue
        }
        unique.push(minutes)
    }
    return unique.length > 0 ? unique : [...DEFAULT_ALLOWED_DURATIONS]
}

export function snapUpToAvailability(date: Date): Date {
    const ms = date.getTime()
    const snapped = Math.ceil(ms / AVAILABILITY_SNAP_MS) * AVAILABILITY_SNAP_MS
    return new Date(snapped)
}

export function snapDownToAvailability(date: Date): Date {
    const ms = date.getTime()
    const snapped = Math.floor(ms / AVAILABILITY_SNAP_MS) * AVAILABILITY_SNAP_MS
    return new Date(snapped)
}

export function isAlignedToMinutes(date: Date, minutes: number): boolean {
    return (Math.floor(date.getTime() / 1000) % (minutes * 60)) === 0
}

export function assertAvailabilityRange(startsAt: Date, endsAt: Date): void {
    if (!(endsAt.getTime() > startsAt.getTime())) {
        throw new Error('Availability end must be after start')
    }
    if (!isAlignedToMinutes(startsAt, AVAILABILITY_SNAP_MINUTES)
      || !isAlignedToMinutes(endsAt, AVAILABILITY_SNAP_MINUTES)) {
        throw new Error('Availability must align to 30-minute boundaries')
    }
}

export function isPublicSlotRange(from: Date, to: Date): boolean {
    if (!(to.getTime() > from.getTime())) {
        return false
    }
    return (to.getTime() - from.getTime()) <= MAX_PUBLIC_SLOT_RANGE_MS
}

export type TimeWindow = { startsAt: Date, endsAt: Date }

/**
 * Joins windows that overlap or touch. Staff paint one window per drag, so
 * 09:00-09:30 and 09:30-10:00 are two rows that must still hold a 60-minute visit.
 */
export function mergeWindows(windows: readonly TimeWindow[]): TimeWindow[] {
    const sorted = [...windows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    const merged: TimeWindow[] = []
    for (const window of sorted) {
        const last = merged.at(-1)
        if (last !== undefined && window.startsAt.getTime() <= last.endsAt.getTime()) {
            if (window.endsAt.getTime() > last.endsAt.getTime()) {
                last.endsAt = window.endsAt
            }
            continue
        }
        merged.push({ startsAt: window.startsAt, endsAt: window.endsAt })
    }
    return merged
}

/** Removes every closed range from the windows. The result is merged and sorted. */
export function subtractWindows(windows: readonly TimeWindow[], closed: readonly TimeWindow[]): TimeWindow[] {
    let open = mergeWindows(windows)
    for (const closure of mergeWindows(closed)) {
        const next: TimeWindow[] = []
        for (const window of open) {
            if (closure.endsAt <= window.startsAt || closure.startsAt >= window.endsAt) {
                next.push(window)
                continue
            }
            if (closure.startsAt > window.startsAt) {
                next.push({ startsAt: window.startsAt, endsAt: closure.startsAt })
            }
            if (closure.endsAt < window.endsAt) {
                next.push({ startsAt: closure.endsAt, endsAt: window.endsAt })
            }
        }
        open = next
    }
    return open
}

/** Japan has no daylight saving time, so JST is always UTC+9. */
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type WeeklyHours = {
    /** ISO weekday: 1 Monday to 7 Sunday. */
    weekday: number
    /** Minutes after midnight JST. */
    startMinute: number
    endMinute: number
}

export function isWeeklyHours(hours: WeeklyHours): boolean {
    return Number.isInteger(hours.weekday) && hours.weekday >= 1 && hours.weekday <= 7
        && Number.isInteger(hours.startMinute) && Number.isInteger(hours.endMinute)
        && hours.startMinute >= 0 && hours.endMinute <= 24 * 60 && hours.endMinute > hours.startMinute
        && hours.startMinute % AVAILABILITY_SNAP_MINUTES === 0
        && hours.endMinute % AVAILABILITY_SNAP_MINUTES === 0
}

/** Joins blocks on the same weekday that overlap or touch, sorted by weekday then start. */
export function normalizeWeeklyHours(hours: readonly WeeklyHours[]): WeeklyHours[] {
    const normalized: WeeklyHours[] = []
    const sorted = [...hours].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
    for (const block of sorted) {
        const last = normalized.at(-1)
        if (last !== undefined && last.weekday === block.weekday && block.startMinute <= last.endMinute) {
            last.endMinute = Math.max(last.endMinute, block.endMinute)
            continue
        }
        normalized.push({ weekday: block.weekday, startMinute: block.startMinute, endMinute: block.endMinute })
    }
    return normalized
}

/** Each weekly block as a dated window in the range, clipped to it. */
export function expandWeeklyHours(hours: readonly WeeklyHours[], rangeStart: Date, rangeEnd: Date): TimeWindow[] {
    const windows: TimeWindow[] = []
    if (hours.length === 0 || !(rangeEnd > rangeStart)) {
        return windows
    }
    // Midnight JST of the day that holds rangeStart, as a UTC instant.
    const firstDay = Math.floor((rangeStart.getTime() + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS
    for (let day = firstDay; day < rangeEnd.getTime(); day += DAY_MS) {
        // 1970-01-01 was a Thursday (ISO 4).
        const weekday = ((Math.floor((day + JST_OFFSET_MS) / DAY_MS) + 3) % 7) + 1
        for (const block of hours) {
            if (block.weekday !== weekday) {
                continue
            }
            const startsAt = Math.max(day + block.startMinute * 60 * 1000, rangeStart.getTime())
            const endsAt = Math.min(day + block.endMinute * 60 * 1000, rangeEnd.getTime())
            if (endsAt > startsAt) {
                windows.push({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) })
            }
        }
    }
    return windows
}

/** Candidate appointment starts every 15 minutes that fit duration inside windows and avoid booked ranges. */
export function availableStarts(input: {
    windows: readonly TimeWindow[]
    booked: readonly TimeWindow[]
    /** Closures. No visit may overlap one. */
    closed?: readonly TimeWindow[]
    rangeStart: Date
    rangeEnd: Date
    durationMs?: number
}): Date[] {
    const durationMs = input.durationMs ?? DEFAULT_DURATION_MS
    const starts: Date[] = []

    for (const window of subtractWindows(input.windows, input.closed ?? [])) {
        const from = Math.max(window.startsAt.getTime(), input.rangeStart.getTime())
        const to = Math.min(window.endsAt.getTime(), input.rangeEnd.getTime())
        if (!(to > from)) {
            continue
        }

        let cursor = Math.ceil(from / SLOT_STEP_MS) * SLOT_STEP_MS
        while (cursor + durationMs <= to) {
            const start = new Date(cursor)
            const end = new Date(cursor + durationMs)
            const overlapsBooked = input.booked.some(booked =>
                booked.startsAt.getTime() < end.getTime()
                && booked.endsAt.getTime() > start.getTime())
            if (!overlapsBooked) {
                starts.push(start)
            }
            cursor += SLOT_STEP_MS
        }
    }

    return starts.sort((a, b) => a.getTime() - b.getTime())
}

export function appointmentEndFromStart(
    startsAt: Date,
    durationMinutes: number = DEFAULT_APPOINTMENT_DURATION_MINUTES
): Date {
    return new Date(startsAt.getTime() + durationMinutes * 60 * 1000)
}

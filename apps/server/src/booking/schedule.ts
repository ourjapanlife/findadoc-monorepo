/**
 * Clinic availability is painted in 30-minute windows.
 * Patients pick a start every 15 minutes inside those windows.
 * Default visit length is 30 minutes (matches the availability snap).
 */

export const AVAILABILITY_SNAP_MINUTES = 30
export const BOOKING_SLOT_STEP_MINUTES = 15
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30

const AVAILABILITY_SNAP_MS = AVAILABILITY_SNAP_MINUTES * 60 * 1000
const SLOT_STEP_MS = BOOKING_SLOT_STEP_MINUTES * 60 * 1000
const DEFAULT_DURATION_MS = DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000

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

export type TimeWindow = { startsAt: Date, endsAt: Date }

/** Candidate appointment starts every 15 minutes that fit duration inside windows and avoid booked ranges. */
export function availableStarts(input: {
    windows: readonly TimeWindow[]
    booked: readonly TimeWindow[]
    rangeStart: Date
    rangeEnd: Date
    durationMs?: number
}): Date[] {
    const durationMs = input.durationMs ?? DEFAULT_DURATION_MS
    const starts: Date[] = []

    for (const window of input.windows) {
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

export function appointmentEndFromStart(startsAt: Date, durationMs = DEFAULT_DURATION_MS): Date {
    return new Date(startsAt.getTime() + durationMs)
}

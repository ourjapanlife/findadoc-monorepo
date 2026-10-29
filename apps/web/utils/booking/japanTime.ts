/**
 * Booking times are Japan time. Japan has no daylight saving time, so JST is
 * always UTC+9, and a JST date or weekday is plain arithmetic on the instant.
 * Weekly hours are ISO weekdays (1 Monday, 7 Sunday) and minutes after midnight JST.
 */

export const JAPAN_TIME_ZONE = 'Asia/Tokyo'
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type WeeklyHoursBlock = {
    weekday: number
    startMinute: number
    endMinute: number
}

export type TimeRange = { startsAt: string, endsAt: string }

/** 'YYYY-MM-DD' of the JST day that holds this instant. */
export function jstDateKey(value: string | Date): string {
    return new Date(new Date(value).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Midnight JST of a 'YYYY-MM-DD' day, as an instant. */
export function jstMidnight(dateKey: string): Date {
    return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - JST_OFFSET_MS)
}

export function addDaysToKey(dateKey: string, days: number): string {
    return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** ISO weekday of a 'YYYY-MM-DD' day: 1 Monday to 7 Sunday. */
export function weekdayOfKey(dateKey: string): number {
    return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay() || 7
}

/** The Monday that starts the JST week holding this day. */
export function weekStartKey(dateKey: string): string {
    return addDaysToKey(dateKey, 1 - weekdayOfKey(dateKey))
}

/** A day as a Date whose UTC fields are that JST day, for Intl with timeZone 'UTC'. */
export function dateFromKey(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`)
}

export function minutesLabel(minutes: number): string {
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
    return `${hours}:${String(minutes % 60).padStart(2, '0')}`
}

/** Each weekly block as a dated range inside [from, to). */
export function expandWeeklyHours<T extends WeeklyHoursBlock>(
    hours: readonly T[],
    fromIso: string,
    toIso: string
): Array<TimeRange & { block: T }> {
    const from = new Date(fromIso).getTime()
    const to = new Date(toIso).getTime()
    const ranges: Array<TimeRange & { block: T }> = []
    for (let dateKey = jstDateKey(fromIso); jstMidnight(dateKey).getTime() < to; dateKey = addDaysToKey(dateKey, 1)) {
        const midnight = jstMidnight(dateKey).getTime()
        const weekday = weekdayOfKey(dateKey)
        for (const block of hours) {
            if (block.weekday !== weekday) {
                continue
            }
            const startsAt = Math.max(midnight + block.startMinute * 60 * 1000, from)
            const endsAt = Math.min(midnight + block.endMinute * 60 * 1000, to)
            if (endsAt > startsAt) {
                ranges.push({ startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), block })
            }
        }
    }
    return ranges
}

/** The parts of one range that no closure covers. */
export function subtractRanges(range: TimeRange, closed: readonly TimeRange[]): TimeRange[] {
    let open = [{ startsAt: Date.parse(range.startsAt), endsAt: Date.parse(range.endsAt) }]
    for (const closure of closed) {
        const closedFrom = Date.parse(closure.startsAt)
        const closedTo = Date.parse(closure.endsAt)
        open = open.flatMap(part => {
            if (closedTo <= part.startsAt || closedFrom >= part.endsAt) {
                return [part]
            }
            return [
                ...(closedFrom > part.startsAt ? [{ startsAt: part.startsAt, endsAt: closedFrom }] : []),
                ...(closedTo < part.endsAt ? [{ startsAt: closedTo, endsAt: part.endsAt }] : [])
            ]
        })
    }
    return open.map(part => ({
        startsAt: new Date(part.startsAt).toISOString(),
        endsAt: new Date(part.endsAt).toISOString()
    }))
}

/** The browser's own time zone, for showing a patient their local time next to JST. */
export function viewerTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * The viewer's clock for one instant, or null when it reads the same as Japan's.
 * The weekday is named when the viewer's day is not the Japan day.
 */
export function viewerTimeLabel(iso: string, locale: string, viewerZone: string): string | null {
    const date = new Date(iso)
    const time = (timeZone: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone })
        .format(date)
    const weekday = (timeZone: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone }).format(date)
    const sameDay = weekday(viewerZone) === weekday(JAPAN_TIME_ZONE)
    if (sameDay && time(viewerZone) === time(JAPAN_TIME_ZONE)) {
        return null
    }
    return sameDay ? time(viewerZone) : `${weekday(viewerZone)} ${time(viewerZone)}`
}

/** An appointment time as Japan time, with the zone named, whatever the browser's zone. */
export function formatJapanDateTime(iso: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: JAPAN_TIME_ZONE,
        timeZoneName: 'short'
    }).format(new Date(iso))
}

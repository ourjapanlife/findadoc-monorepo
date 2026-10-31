import type { BookingFormField } from '@findadoc/graphql'

/**
 * The same rules the API applies in `apps/server/src/booking/formDefinitions.ts`:
 * a field with `showWhen` is shown, required, and sent only while that other
 * answer matches, and a DATE's `min`/`max` are whole calendar years from today
 * in Japan time.
 */

/** Japan has no daylight saving time. */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function fieldIsShown(
    field: Pick<BookingFormField, 'showWhen'>,
    answerFor: (fieldId: string) => string
): boolean {
    const condition = field.showWhen
    if (condition === null || condition === undefined) {
        return true
    }
    return answerFor(condition.fieldId) === condition.equals
}

function isoDate(year: number, monthIndex: number, day: number): string {
    return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Today in Japan moved by whole calendar years, as `YYYY-MM-DD`, for a date input's
 * `min` or `max`. 29 February in a year without one becomes 28 February.
 */
export function japanDateYearsFromToday(
    years: number | null | undefined,
    now: Date = new Date()
): string | undefined {
    if (years === null || years === undefined) {
        return undefined
    }
    const japanNow = new Date(now.getTime() + JST_OFFSET_MS)
    const year = japanNow.getUTCFullYear() + Math.trunc(years)
    const monthIndex = japanNow.getUTCMonth()
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    return isoDate(year, monthIndex, Math.min(japanNow.getUTCDate(), lastDay))
}

/** A real calendar day, `YYYY-MM-DD`, inside the field's range. */
export function dateAnswerIsValid(
    raw: string,
    range: Pick<BookingFormField, 'min' | 'max'>,
    now: Date = new Date()
): boolean {
    const match = ISO_DATE_PATTERN.exec(raw)
    if (match === null) {
        return false
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        return false
    }
    // Same-width ISO dates compare in calendar order.
    const earliest = japanDateYearsFromToday(range.min, now)
    const latest = japanDateYearsFromToday(range.max, now)
    if (earliest !== undefined && raw < earliest) {
        return false
    }
    if (latest !== undefined && raw > latest) {
        return false
    }
    return true
}

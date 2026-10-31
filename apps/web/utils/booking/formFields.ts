import type { BookingFormField } from '@findadoc/graphql'

/**
 * The same rules the API applies in `apps/server/src/booking/formDefinitions.ts`:
 * a field with `showWhen` is shown, required, and sent only while that other
 * answer matches, and a DATE's `min`/`max` count days from today in Japan time.
 */

/** Japan has no daylight saving time. */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
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

function japanToday(now: Date): number {
    const shifted = new Date(now.getTime() + JST_OFFSET_MS)
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
}

/** `YYYY-MM-DD` for today in Japan plus `days`, for a date input's `min` or `max`. */
export function japanDateFromToday(days: number | null | undefined, now: Date = new Date()): string | undefined {
    if (days === null || days === undefined) {
        return undefined
    }
    return new Date(japanToday(now) + Math.round(days) * DAY_MS).toISOString().slice(0, 10)
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
    const answered = Date.UTC(year, month - 1, day)
    const parsed = new Date(answered)
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        return false
    }
    const offsetDays = Math.round((answered - japanToday(now)) / DAY_MS)
    if (range.min !== null && range.min !== undefined && offsetDays < range.min) {
        return false
    }
    if (range.max !== null && range.max !== undefined && offsetDays > range.max) {
        return false
    }
    return true
}

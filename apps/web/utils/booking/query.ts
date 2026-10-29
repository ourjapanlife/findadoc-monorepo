import { DEFAULT_ALLOWED_DURATIONS, isAppointmentDuration } from './durations'

export type BookingQuery = {
    duration?: number
    start?: string
    practitioner?: string
    form?: string
    service?: string
}

function firstQueryValue(value: unknown): string | undefined {
    if (Array.isArray(value)) {
        return firstQueryValue(value[0])
    }
    if (typeof value !== 'string') {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

export function parseBookingQuery(query: Record<string, unknown>): BookingQuery {
    const durationRaw = firstQueryValue(query.duration)
    const durationNumber = durationRaw === undefined ? NaN : Number(durationRaw)
    const start = firstQueryValue(query.start)
    const practitioner = firstQueryValue(query.practitioner)
    const form = firstQueryValue(query.form)
    const service = firstQueryValue(query.service)

    return {
        duration: isAppointmentDuration(durationNumber) ? durationNumber : undefined,
        start: start !== undefined && !Number.isNaN(new Date(start).getTime()) ? start : undefined,
        practitioner,
        form,
        service
    }
}

export function bookingQueryString(query: BookingQuery, preview?: '0' | '1'): string {
    const params = new URLSearchParams()
    if (query.duration !== undefined && DEFAULT_ALLOWED_DURATIONS.includes(query.duration)) {
        params.set('duration', String(query.duration))
    }
    if (query.start) {
        params.set('start', query.start)
    }
    if (query.practitioner) {
        params.set('practitioner', query.practitioner)
    }
    if (query.form) {
        params.set('form', query.form)
    }
    if (query.service) {
        params.set('service', query.service)
    }
    if (preview === '1') {
        params.set('preview', '1')
    }
    const encoded = params.toString()
    return encoded === '' ? '' : `?${encoded}`
}

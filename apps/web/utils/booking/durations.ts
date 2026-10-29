export const ALLOWED_APPOINTMENT_DURATIONS = [15, 30, 45, 60] as const
export const DEFAULT_ALLOWED_DURATIONS = [...ALLOWED_APPOINTMENT_DURATIONS]
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30

export type AppointmentDurationMinutes = typeof ALLOWED_APPOINTMENT_DURATIONS[number]

export function isAppointmentDuration(value: number): value is AppointmentDurationMinutes {
    return ALLOWED_APPOINTMENT_DURATIONS.some(duration => duration === value)
}

export function resolveDuration(
    value: number | null | undefined,
    allowed: readonly number[] = DEFAULT_ALLOWED_DURATIONS
): number {
    if (value !== null && value !== undefined && isAppointmentDuration(value) && allowed.includes(value)) {
        return value
    }
    if (allowed.includes(DEFAULT_APPOINTMENT_DURATION_MINUTES)) {
        return DEFAULT_APPOINTMENT_DURATION_MINUTES
    }
    return allowed[0] ?? DEFAULT_APPOINTMENT_DURATION_MINUTES
}

export function dayRangeUtc(day: Date): { from: string, to: string } {
    const start = new Date(day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { from: start.toISOString(), to: end.toISOString() }
}

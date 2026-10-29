/**
 * Appointment lifecycle.
 *
 * A patient submit creates a `requested` appointment that holds its slot.
 * Staff confirm or decline it. Staff or the patient may cancel while it still
 * holds time. Declined and cancelled appointments free the slot.
 */

export const APPOINTMENT_STATUS = {
    REQUESTED: 'requested',
    CONFIRMED: 'confirmed',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed'
} as const

export type AppointmentStatus = typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS]

/** Statuses that occupy calendar time. */
export const SLOT_HOLDING_STATUSES: AppointmentStatus[] = [
    APPOINTMENT_STATUS.REQUESTED,
    APPOINTMENT_STATUS.CONFIRMED
]

export const CANCELLED_BY = {
    PATIENT: 'patient',
    CLINIC: 'clinic'
} as const

export const MAX_STATUS_REASON_LENGTH = 500

const STAFF_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    requested: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.DECLINED, APPOINTMENT_STATUS.CANCELLED],
    confirmed: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED],
    declined: [],
    cancelled: [],
    completed: []
}

export function isAppointmentStatus(value: string): value is AppointmentStatus {
    return Object.values(APPOINTMENT_STATUS).some(status => status === value)
}

export function canStaffMoveTo(from: string, to: AppointmentStatus): boolean {
    return isAppointmentStatus(from) && STAFF_TRANSITIONS[from].includes(to)
}

/** The patient may cancel a request or a confirmed visit that has not started. */
export function canPatientCancel(status: string, startsAt: Date, now: Date = new Date()): boolean {
    return SLOT_HOLDING_STATUSES.some(holding => holding === status)
        && startsAt.getTime() > now.getTime()
}

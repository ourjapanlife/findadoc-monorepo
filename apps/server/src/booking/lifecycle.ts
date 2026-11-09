/**
 * Appointment lifecycle.
 *
 * A patient submit creates a `requested` appointment that holds its slot. On a
 * form that asks for a payment method it starts as `pending_payment` instead
 * (online consult v2 §3.2), which also holds the slot until the clinic has the
 * payment. Staff confirm or decline it. Staff may mark a confirmed visit as unpaid
 * again. Staff or the patient may cancel while it still holds time. Declined and
 * cancelled appointments free the slot.
 */

export const APPOINTMENT_STATUS = {
    REQUESTED: 'requested',
    PENDING_PAYMENT: 'pending_payment',
    CONFIRMED: 'confirmed',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed'
} as const

export type AppointmentStatus = typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS]

/** Statuses that occupy calendar time. */
export const SLOT_HOLDING_STATUSES: AppointmentStatus[] = [
    APPOINTMENT_STATUS.REQUESTED,
    APPOINTMENT_STATUS.PENDING_PAYMENT,
    APPOINTMENT_STATUS.CONFIRMED
]

/** Statuses still waiting on the clinic: the dashboard badge and the per-email open-request limit. */
export const OPEN_REQUEST_STATUSES: AppointmentStatus[] = [
    APPOINTMENT_STATUS.REQUESTED,
    APPOINTMENT_STATUS.PENDING_PAYMENT
]

export const CANCELLED_BY = {
    PATIENT: 'patient',
    CLINIC: 'clinic'
} as const

export const MAX_STATUS_REASON_LENGTH = 500

const STAFF_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    requested: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.DECLINED, APPOINTMENT_STATUS.CANCELLED],
    pending_payment: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.DECLINED, APPOINTMENT_STATUS.CANCELLED],
    confirmed: [APPOINTMENT_STATUS.PENDING_PAYMENT, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED],
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

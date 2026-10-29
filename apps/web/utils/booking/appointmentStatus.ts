import { BookingAppointmentStatus } from '@findadoc/graphql'

/**
 * Appointment lifecycle on the site. The API enforces the same transitions
 * (apps/server/src/booking/lifecycle.ts); this only decides which buttons show.
 */

const LABEL_KEYS: Record<BookingAppointmentStatus, string> = {
    [BookingAppointmentStatus.Requested]: 'bookingDashboard.appointmentStatus.requested',
    [BookingAppointmentStatus.Confirmed]: 'bookingDashboard.appointmentStatus.confirmed',
    [BookingAppointmentStatus.Declined]: 'bookingDashboard.appointmentStatus.declined',
    [BookingAppointmentStatus.Cancelled]: 'bookingDashboard.appointmentStatus.cancelled',
    [BookingAppointmentStatus.Completed]: 'bookingDashboard.appointmentStatus.completed'
}

const STAFF_ACTIONS: Record<BookingAppointmentStatus, BookingAppointmentStatus[]> = {
    [BookingAppointmentStatus.Requested]: [
        BookingAppointmentStatus.Confirmed,
        BookingAppointmentStatus.Declined,
        BookingAppointmentStatus.Cancelled
    ],
    [BookingAppointmentStatus.Confirmed]: [
        BookingAppointmentStatus.Completed,
        BookingAppointmentStatus.Cancelled
    ],
    [BookingAppointmentStatus.Declined]: [],
    [BookingAppointmentStatus.Cancelled]: [],
    [BookingAppointmentStatus.Completed]: []
}

const ACTION_KEYS: Partial<Record<BookingAppointmentStatus, string>> = {
    [BookingAppointmentStatus.Confirmed]: 'bookingDashboard.actions.confirm',
    [BookingAppointmentStatus.Declined]: 'bookingDashboard.actions.decline',
    [BookingAppointmentStatus.Cancelled]: 'bookingDashboard.actions.cancel',
    [BookingAppointmentStatus.Completed]: 'bookingDashboard.actions.complete'
}

export function appointmentStatusLabelKey(status: BookingAppointmentStatus): string {
    return LABEL_KEYS[status]
}

export function staffActionsFor(status: BookingAppointmentStatus | null | undefined): BookingAppointmentStatus[] {
    return status === null || status === undefined ? [] : STAFF_ACTIONS[status]
}

export function staffActionLabelKey(next: BookingAppointmentStatus): string {
    return ACTION_KEYS[next] ?? LABEL_KEYS[next]
}

/** Decline and cancel tell the patient why; the reason box shows for those. */
export function actionTakesReason(next: BookingAppointmentStatus): boolean {
    return next === BookingAppointmentStatus.Declined || next === BookingAppointmentStatus.Cancelled
}

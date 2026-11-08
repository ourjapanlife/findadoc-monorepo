import { BookingAppointmentStatus, BookingPaymentMethod } from '@findadoc/graphql'

/**
 * Appointment lifecycle on the site. The API enforces the same transitions
 * (apps/server/src/booking/lifecycle.ts); this only decides which buttons show.
 */

const LABEL_KEYS: Record<BookingAppointmentStatus, string> = {
    [BookingAppointmentStatus.Requested]: 'bookingDashboard.appointmentStatus.requested',
    [BookingAppointmentStatus.PendingPayment]: 'bookingDashboard.appointmentStatus.pendingPayment',
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
    [BookingAppointmentStatus.PendingPayment]: [
        BookingAppointmentStatus.Confirmed,
        BookingAppointmentStatus.Declined,
        BookingAppointmentStatus.Cancelled
    ],
    [BookingAppointmentStatus.Confirmed]: [
        BookingAppointmentStatus.Completed,
        BookingAppointmentStatus.PendingPayment,
        BookingAppointmentStatus.Cancelled
    ],
    [BookingAppointmentStatus.Declined]: [],
    [BookingAppointmentStatus.Cancelled]: [],
    [BookingAppointmentStatus.Completed]: []
}

const ACTION_KEYS: Partial<Record<BookingAppointmentStatus, string>> = {
    [BookingAppointmentStatus.Confirmed]: 'bookingDashboard.actions.confirm',
    // Only a confirmed visit moves to pending payment: staff mark it unpaid again (§3.2).
    [BookingAppointmentStatus.PendingPayment]: 'bookingDashboard.actions.markUnpaid',
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

/** Confirming a visit that waits on payment says the payment arrived. */
export function staffActionLabelKey(next: BookingAppointmentStatus, current?: BookingAppointmentStatus | null): string {
    if (current === BookingAppointmentStatus.PendingPayment && next === BookingAppointmentStatus.Confirmed) {
        return 'bookingDashboard.actions.confirmPaid'
    }
    return ACTION_KEYS[next] ?? LABEL_KEYS[next]
}

const PAYMENT_METHOD_KEYS: Record<BookingPaymentMethod, string> = {
    [BookingPaymentMethod.CreditCard]: 'bookingPage.options.paymentMethod.creditCard',
    [BookingPaymentMethod.BankTransfer]: 'bookingPage.options.paymentMethod.bankTransfer',
    [BookingPaymentMethod.PayPay]: 'bookingPage.options.paymentMethod.payPay'
}

/** The same label the patient picked on the form. */
export function paymentMethodLabelKey(method: BookingPaymentMethod): string {
    return PAYMENT_METHOD_KEYS[method]
}

/** Decline and cancel tell the patient why; the reason box shows for those. */
export function actionTakesReason(next: BookingAppointmentStatus): boolean {
    return next === BookingAppointmentStatus.Declined || next === BookingAppointmentStatus.Cancelled
}

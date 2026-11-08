import type { BookingAppointmentStatus, BookingPaymentMethod, BookingSubmissionExportRow } from '@findadoc/graphql'
import { appointmentStatusLabelKey, paymentMethodLabelKey } from '~/utils/booking/appointmentStatus'
import { jstDateKey } from '~/utils/booking/japanTime'

/**
 * The owner booking export (spec §3.2), built in the browser so nothing is stored on a server.
 * UTF-8 with a byte order mark, so Excel opens Japanese names without an import step.
 * The columns are contact and scheduling only; the API never sends health data here.
 */

export const CSV_BOM = '﻿'

/** The column order, by i18n key under `clinicDashboard.export.columns`. */
export const EXPORT_COLUMNS = [
    'date',
    'time',
    'status',
    'paymentMethod',
    'consultationLanguage',
    'name',
    'email',
    'phone',
    'submissionId'
] as const

type Translate = (key: string) => string

// A spreadsheet runs a cell that starts like a formula. Patient answers are free text,
// so such a cell is prefixed with an apostrophe (OWASP CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/

/** One CSV cell: always quoted, inner quotes doubled, formula starts neutralised. */
export function csvCell(value: string | null | undefined): string {
    const text = value ?? ''
    const safe = FORMULA_START.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
}

/** HH:mm in Japan time. */
function jstTime(iso: string): string {
    return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

function timeRange(startsAt: string | null | undefined, endsAt: string | null | undefined): string {
    if (startsAt === null || startsAt === undefined) {
        return ''
    }
    return endsAt === null || endsAt === undefined ? jstTime(startsAt) : `${jstTime(startsAt)}–${jstTime(endsAt)}`
}

function statusLabel(status: BookingAppointmentStatus | null | undefined, t: Translate): string {
    return status === null || status === undefined ? '' : t(appointmentStatusLabelKey(status))
}

function paymentLabel(method: BookingPaymentMethod | null | undefined, t: Translate): string {
    return method === null || method === undefined ? '' : t(paymentMethodLabelKey(method))
}

function languageLabel(code: string | null | undefined, t: Translate, te: (key: string) => boolean): string {
    if (code === null || code === undefined || code === '') {
        return ''
    }
    const key = `bookingPage.options.consultationLanguage.${code}`
    return te(key) ? t(key) : code
}

/** The whole file as text, header first, CRLF line ends, with the BOM. */
export function bookingExportCsv(
    rows: readonly BookingSubmissionExportRow[],
    t: Translate,
    te: (key: string) => boolean
): string {
    const header = EXPORT_COLUMNS.map(column => csvCell(t(`clinicDashboard.export.columns.${column}`))).join(',')
    const lines = rows.map(row => [
        row.startsAt ? jstDateKey(row.startsAt) : '',
        timeRange(row.startsAt, row.endsAt),
        statusLabel(row.appointmentStatus, t),
        paymentLabel(row.paymentMethod, t),
        languageLabel(row.consultationLanguage, t, te),
        row.patientName,
        row.email,
        row.phone,
        row.id
    ].map(csvCell).join(','))
    return `${CSV_BOM}${[header, ...lines].join('\r\n')}\r\n`
}

/** A file name with the export day in Japan time and no patient or clinic data. */
export function bookingExportFileName(now: Date = new Date()): string {
    return `bookings-${jstDateKey(now)}.csv`
}

// Safari and Firefox can drop a download whose object URL is revoked in the same tick as the click.
const REVOKE_AFTER_MS = 10000

/** Hands the file to the browser as a download. The object URL is released shortly after. */
export function downloadCsv(text: string, fileName: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

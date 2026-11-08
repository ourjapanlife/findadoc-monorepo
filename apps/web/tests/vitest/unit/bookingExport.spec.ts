import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'chai'
import { createI18n } from 'vue-i18n'
import { BookingAppointmentStatus, BookingPaymentMethod, type BookingSubmissionExportRow } from '@findadoc/graphql'
import {
    CSV_BOM,
    EXPORT_COLUMNS,
    bookingExportCsv,
    bookingExportFileName,
    csvCell
} from '@/utils/booking/exportCsv'
import { staffActionLabelKey, staffActionsFor } from '@/utils/booking/appointmentStatus'

// The raw English file: the i18n module compiles an imported locale into message functions.
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const en: unknown = JSON.parse(readFileSync(join(rootDir, 'i18n/locales/en.json'), 'utf8'))

function lookup(key: string): string | undefined {
    const value = key.split('.').reduce<unknown>((node, part) =>
        (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined), en)
    return typeof value === 'string' ? value : undefined
}
const t = (key: string) => lookup(key) ?? key
const te = (key: string) => lookup(key) !== undefined

const row: BookingSubmissionExportRow = {
    id: 'submission-1',
    // 10:00-10:30 on 3 December 2026 in Japan.
    startsAt: '2026-12-03T01:00:00.000Z',
    endsAt: '2026-12-03T01:30:00.000Z',
    appointmentStatus: BookingAppointmentStatus.PendingPayment,
    paymentMethod: BookingPaymentMethod.BankTransfer,
    consultationLanguage: 'ne',
    patientName: '山田 "Taro"',
    email: 'patient@example.com',
    phone: '090-1234-5678',
    createdDate: '2026-11-08T00:00:00.000Z'
}

describe('booking export CSV', () => {
    it('starts with a byte order mark so Excel reads UTF-8', () => {
        expect(bookingExportCsv([], t, te).startsWith(CSV_BOM)).to.equal(true)
    })

    it('writes the header in the staff language and one line per booking, in Japan time', () => {
        const lines = bookingExportCsv([row], t, te).slice(1).split('\r\n')

        expect(lines[0]).to.equal(EXPORT_COLUMNS.map(column => csvCell(t(`clinicDashboard.export.columns.${column}`)))
            .join(','))
        expect(lines[1]).to.equal([
            '"2026-12-03"',
            '"10:00–10:30"',
            '"Pending payment"',
            '"Bank transfer"',
            '"Nepali"',
            '"山田 ""Taro"""',
            '"patient@example.com"',
            '"090-1234-5678"',
            '"submission-1"'
        ].join(','))
        expect(lines[2]).to.equal('')
    })

    it('leaves empty cells for a booking with no visit or payment answer', () => {
        const line = bookingExportCsv([{
            ...row,
            startsAt: null,
            endsAt: null,
            appointmentStatus: null,
            paymentMethod: null,
            consultationLanguage: null
        }], t, te).split('\r\n')[1]

        expect(line?.startsWith('"","","","","",')).to.equal(true)
    })

    it('neutralises a cell that a spreadsheet would run as a formula', () => {
        expect(csvCell('=HYPERLINK("x")')).to.equal('"\'=HYPERLINK(""x"")"')
        expect(csvCell('@SUM(A1)')).to.equal('"\'@SUM(A1)"')
        expect(csvCell('plain')).to.equal('"plain"')
    })

    it('names the file by the Japan date only', () => {
        expect(bookingExportFileName(new Date('2026-11-08T16:00:00.000Z'))).to.equal('bookings-2026-11-09.csv')
    })
})

describe('pending payment actions', () => {
    it('lets staff confirm, decline, or cancel a visit waiting on payment', () => {
        expect(staffActionsFor(BookingAppointmentStatus.PendingPayment)).to.deep.equal([
            BookingAppointmentStatus.Confirmed,
            BookingAppointmentStatus.Declined,
            BookingAppointmentStatus.Cancelled
        ])
    })

    it('offers to mark a confirmed visit as unpaid again', () => {
        expect(staffActionsFor(BookingAppointmentStatus.Confirmed)).to.include(BookingAppointmentStatus.PendingPayment)
        expect(t(staffActionLabelKey(BookingAppointmentStatus.PendingPayment, BookingAppointmentStatus.Confirmed)))
            .to.equal('Mark as unpaid')
    })

    it('says the payment arrived when confirming a visit waiting on payment', () => {
        expect(t(staffActionLabelKey(BookingAppointmentStatus.Confirmed, BookingAppointmentStatus.PendingPayment)))
            .to.equal('Payment received, confirm')
        expect(t(staffActionLabelKey(BookingAppointmentStatus.Confirmed, BookingAppointmentStatus.Requested)))
            .to.equal('Confirm')
    })
})

describe('the export status line', () => {
    it('reads as a plural that agrees with the count in English', () => {
        const message = lookup('clinicDashboard.export.done') ?? ''
        const i18n = createI18n({
            legacy: false,
            locale: 'en-US',
            messages: { 'en-US': { clinicDashboard: { export: { done: message } } } }
        })
        const done = (n: number) => i18n.global.t('clinicDashboard.export.done', { n }, n)
        expect(done(0)).to.equal('No bookings to download.')
        expect(done(1)).to.equal('Downloaded 1 booking.')
        expect(done(3)).to.equal('Downloaded 3 bookings.')
    })
})

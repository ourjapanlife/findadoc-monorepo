import { describe, expect, it } from 'vitest'
import {
    SITE_LOCALES,
    clinicPatientCancelledEmail,
    clinicRequestEmail,
    patientRequestEmail,
    patientStatusEmail,
    type BookingEmail
} from '../src/booking/emailCopy.js'

// 09:00 on Monday 2 November 2026 in Japan.
const startsAt = new Date('2026-11-02T00:00:00.000Z')
const manageUrl = 'https://www.findadoc.jp/vi-VN/book/manage#token'

function receipt(locale: string | null): BookingEmail {
    return patientRequestEmail({
        locale,
        clinicName: 'Minato Clinic',
        startsAt,
        durationMinutes: 30,
        reference: 'booking-1',
        manageUrl
    })
}

function decodeHtml(value: string): string {
    return value
        .replace(/<[^>]+>/g, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&amp;/g, '&')
}

/** Every line of the text part shows up in the HTML part. */
function expectSameContent(email: BookingEmail) {
    const html = decodeHtml(email.htmlBody)
    for (const line of email.textBody.split('\n').filter(text => text !== '' && text !== '---')) {
        const value = line.includes(': ') ? line.slice(line.indexOf(': ') + 2) : line
        expect(html).toContain(value)
    }
}

describe('patient booking emails', () => {
    it('writes the receipt in the patient locale with Japan time and the visit length', () => {
        const email = receipt('vi-VN')

        expect(email.subject).toBe('Chúng tôi đã nhận được yêu cầu của bạn · Minato Clinic')
        expect(email.textBody).toContain('09:00')
        expect(email.textBody).toContain('giờ Nhật Bản')
        expect(email.textBody).toContain('30 phút')
        expect(email.textBody).toContain(manageUrl)
        expect(email.textBody).not.toContain('UTC')
        expect(email.textBody).not.toContain('2026-11-02T00:00:00.000Z')
        expect(email.htmlBody).toContain('<html lang="vi-VN">')
        expectSameContent(email)
    })

    it('keeps the link, reference, and clinic name away from Translate', () => {
        const html = receipt('en-US').htmlBody

        expect(html).toContain(`<a translate="no" class="notranslate" href="${manageUrl}"`)
        expect(html).toContain('<td translate="no" class="notranslate" style="padding:4px 0">booking-1</td>')
        expect(html).toContain('<td translate="no" class="notranslate" style="padding:4px 0">Minato Clinic</td>')
        // The time is ordinary text and may be translated.
        expect(html).toContain('<td style="padding:4px 0">Monday, November 2, 2026')
    })

    it('falls back to English for a missing or unknown locale', () => {
        expect(receipt(null).subject).toBe('We received your request · Minato Clinic')
        expect(receipt('xx-XX').textBody).toContain('Monday, November 2, 2026 at 9:00 AM (Japan time)')
    })

    it('has its own copy for every site locale', () => {
        const english = receipt('en-US')
        for (const locale of SITE_LOCALES.filter(code => code !== 'en-US')) {
            const email = receipt(locale)
            expect(email.subject, locale).not.toBe(english.subject)
            expect(email.textBody.split('\n')[0], locale).not.toBe(english.textBody.split('\n')[0])
            for (const status of ['confirmed', 'declined', 'cancelled'] as const) {
                const notice = patientStatusEmail({
                    locale,
                    status,
                    clinicName: 'Minato Clinic',
                    startsAt,
                    durationMinutes: 30,
                    reference: 'booking-1',
                    clinicNote: null
                })
                expect(notice.subject, `${locale} ${status}`).not.toBe(patientStatusEmail({
                    locale: 'en-US',
                    status,
                    clinicName: 'Minato Clinic',
                    startsAt,
                    durationMinutes: 30,
                    reference: 'booking-1',
                    clinicNote: null
                }).subject)
            }
        }
    })

    it('carries the clinic note on a decline and escapes it in HTML', () => {
        const email = patientStatusEmail({
            locale: 'ja-JP',
            status: 'declined',
            clinicName: 'Minato Clinic',
            startsAt,
            durationMinutes: 45,
            reference: 'booking-1',
            clinicNote: 'Please call <first>'
        })

        expect(email.subject).toBe('予約リクエストはお断りとなりました · Minato Clinic')
        expect(email.textBody).toContain('クリニックからのメッセージ: Please call <first>')
        expect(email.textBody).toContain('9:00 (日本時間)')
        expect(email.textBody).toContain('45 分')
        expect(email.htmlBody).toContain('Please call &lt;first&gt;')
        expect(email.htmlBody).not.toContain('<first>')
        expectSameContent(email)
    })
})

describe('clinic booking notices', () => {
    const request = clinicRequestEmail({
        clinicName: 'Minato Clinic',
        startsAt,
        durationMinutes: 30,
        bookingId: 'booking-1',
        patientName: 'Nguyen Van A',
        patientEmail: 'patient@example.com',
        languages: ['ne_NP', 'ja_JP'],
        interpreterLabel: 'Nepali line',
        dashboardUrl: 'https://www.findadoc.jp/clinic-dashboard/facility-1'
    })

    it('is always Japanese first, then English', () => {
        expect(request.subject).toBe('新しい予約リクエスト / New appointment request · Minato Clinic')
        const [japanese, english] = request.textBody.split('\n\n---\n\n')
        expect(japanese).toContain('患者さんから予約リクエストが届きました。')
        expect(japanese).toContain('2026年11月2日月曜日 9:00 (日本時間)')
        expect(japanese).toContain('診察時間: 30 分')
        expect(english).toContain('A patient requested an appointment.')
        expect(english).toContain('Monday, November 2, 2026 at 9:00 AM (Japan time)')
        expect(request.htmlBody).toContain('<html lang="ja-JP">')
        expect(request.htmlBody.indexOf('lang="ja-JP"')).toBeLessThan(request.htmlBody.indexOf('lang="en-US"'))
        expect(request.textBody).toContain('https://www.findadoc.jp/clinic-dashboard/facility-1')
        expectSameContent(request)
    })

    it('names the chosen languages and the interpreter, in Japanese and English (#205)', () => {
        const [japanese, english] = request.textBody.split('\n\n---\n\n')
        expect(japanese).toContain('ご希望の言語: ネパール語、日本語')
        expect(english).toContain('Languages requested: Nepali and Japanese')
        expect(japanese).toContain('通訳: Nepali line')
        expect(english).toContain('Interpreter: Nepali line')
        const none = clinicRequestEmail({
            clinicName: 'Minato Clinic',
            startsAt,
            durationMinutes: 30,
            bookingId: 'booking-1',
            patientName: 'Nguyen Van A',
            patientEmail: 'patient@example.com',
            languages: [],
            interpreterLabel: null,
            dashboardUrl: null
        })
        expect(none.textBody).not.toContain('Languages requested')
        expect(none.textBody).not.toContain('Interpreter')
    })

    it('tells the clinic in Japanese and English when the patient cancels', () => {
        const email = clinicPatientCancelledEmail({
            clinicName: 'Minato Clinic',
            startsAt,
            durationMinutes: 30,
            bookingId: 'booking-1',
            patientName: 'Nguyen Van A',
            reason: 'Feeling better'
        })

        expect(email.subject).toBe('患者さんが予約をキャンセルしました / Appointment cancelled by the patient · Minato Clinic')
        expect(email.textBody).toContain('キャンセルの理由: Feeling better')
        expect(email.textBody).toContain('Reason: Feeling better')
        expectSameContent(email)
    })
})

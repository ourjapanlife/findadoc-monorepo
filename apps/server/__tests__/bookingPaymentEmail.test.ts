import { describe, expect, it } from 'vitest'
import { SITE_LOCALES, patientRequestEmail, type BookingEmail } from '../src/booking/emailCopy.js'
import {
    PAYPAY_QR_CONTENT_ID,
    formatFeeJpy,
    patientPendingPaymentEmail,
    type PaymentEmailInstructions
} from '../src/booking/paymentEmailCopy.js'
import type { PaymentMethod } from '../src/booking/formDefinitions.js'

// 09:00 on Monday 2 November 2026 in Japan.
const startsAt = new Date('2026-11-02T00:00:00.000Z')
const manageUrl = 'https://www.findadoc.jp/book/manage#token'
const cardUrl = 'https://example.com/pay'
const bank = {
    bankName: 'テスト銀行',
    bankBranch: 'サンプル支店',
    accountType: 'ordinary',
    accountNumber: '1234567',
    accountHolder: 'テスト クリニック'
} as const

const everySetting: Omit<PaymentEmailInstructions, 'method'> = {
    feeJpy: 5000,
    card: { mode: 'fixed_link', url: cardUrl },
    bank,
    payPayQr: true
}

const noSetting: Omit<PaymentEmailInstructions, 'method'> = { feeJpy: null, card: null, bank: null, payPayQr: false }

function pendingEmail(
    method: PaymentMethod | null,
    settings: Omit<PaymentEmailInstructions, 'method'> = everySetting,
    locale: string | null = 'en-US'
): BookingEmail {
    return patientPendingPaymentEmail({
        locale,
        clinicName: 'Minato Clinic',
        startsAt,
        durationMinutes: 30,
        reference: 'booking-1',
        manageUrl,
        instructions: { method, ...settings }
    })
}

const FALLBACK = 'The clinic will contact you with payment instructions.'

describe('pending-payment email', () => {
    it('gives the clinic, time, pending notice, method, fee, reference, and manage link', () => {
        const email = pendingEmail('creditCard')

        expect(email.subject).toBe('Payment needed to confirm your appointment · Minato Clinic')
        expect(email.textBody).toContain('It is not confirmed yet')
        expect(email.textBody).toContain('Clinic: Minato Clinic')
        expect(email.textBody).toContain('Monday, November 2, 2026 at 9:00 AM (Japan time)')
        expect(email.textBody).toContain('Payment method: Credit card')
        expect(email.textBody).toContain('Initial fee: ¥5,000')
        expect(email.textBody).toContain('Reference: booking-1')
        expect(email.textBody).toContain(manageUrl)
    })

    it('leaves the fee out when the clinic set none', () => {
        const email = pendingEmail('creditCard', { ...everySetting, feeJpy: null })

        expect(email.textBody).not.toContain('Initial fee')
        expect(email.textBody).not.toContain('¥')
    })

    it('shows a fee of zero yen', () => {
        expect(pendingEmail('creditCard', { ...everySetting, feeJpy: 0 }).textBody).toContain('Initial fee: ¥0')
    })

    it('formats the fee in yen in the reader language', () => {
        expect(formatFeeJpy(12000, 'en-US')).toBe('¥12,000')
        expect(formatFeeJpy(12000, 'ja-JP')).toBe('￥12,000')
        expect(formatFeeJpy(12000, 'de-DE')).toContain('12.000')
        expect(pendingEmail('creditCard', everySetting, 'ja-JP').textBody).toContain('初回料金: ￥5,000')
    })

    describe('credit card', () => {
        it('gives the fixed link and nothing about the other methods', () => {
            const email = pendingEmail('creditCard')

            expect(email.textBody).toContain(`Pay by credit card at this link:\n${cardUrl}`)
            expect(email.htmlBody).toContain(`href="${cardUrl}"`)
            expect(email.textBody).not.toContain('テスト銀行')
            expect(email.textBody).not.toContain('PayPay')
            expect(email.htmlBody).not.toContain('cid:')
        })

        it('says the clinic sends the link when staff send it by hand', () => {
            const email = pendingEmail('creditCard', { ...everySetting, card: { mode: 'sent_by_staff' } })

            expect(email.textBody).toContain('The clinic will email you a link to pay by credit card.')
            expect(email.textBody).not.toContain(cardUrl)
            expect(email.textBody).not.toContain(FALLBACK)
        })

        it('falls back when the clinic has no card setting', () => {
            const email = pendingEmail('creditCard', noSetting)

            expect(email.textBody).toContain(FALLBACK)
            expect(email.textBody).not.toContain(cardUrl)
        })
    })

    describe('bank transfer', () => {
        it('gives the account as a fixed Japanese block', () => {
            const email = pendingEmail('bankTransfer')

            expect(email.textBody).toContain('Pay by bank transfer to this account.')
            const lines = ['銀行名: テスト銀行', '支店名: サンプル支店', '口座種別: 普通', '口座番号: 1234567', '口座名義: テスト クリニック']
            for (const line of lines) {
                expect(email.textBody).toContain(line)
            }
            expect(email.htmlBody).toContain('<table role="presentation" lang="ja-JP" translate="no" class="notranslate"')
            expect(email.textBody).not.toContain(cardUrl)
            expect(email.htmlBody).not.toContain('cid:')
        })

        it('keeps the bank labels in Japanese in every language', () => {
            for (const locale of SITE_LOCALES) {
                const email = pendingEmail('bankTransfer', everySetting, locale)
                expect(email.textBody, locale).toContain('口座番号: 1234567')
                expect(email.textBody, locale).toContain('口座種別: 普通')
            }
        })

        it('shows 当座 for a checking account', () => {
            const email = pendingEmail('bankTransfer', { ...everySetting, bank: { ...bank, accountType: 'checking' } })
            expect(email.textBody).toContain('口座種別: 当座')
        })

        it('falls back when the clinic has no complete account', () => {
            const email = pendingEmail('bankTransfer', { ...everySetting, bank: null })

            expect(email.textBody).toContain(FALLBACK)
            expect(email.textBody).not.toContain('口座番号')
        })
    })

    describe('PayPay', () => {
        it('shows the QR as an inline cid image, with a note in the text part', () => {
            const email = pendingEmail('payPay')

            expect(email.htmlBody).toContain(`<img src="cid:${PAYPAY_QR_CONTENT_ID}" alt="PayPay QR code"`)
            expect(email.textBody).toContain('Pay with PayPay: open the PayPay app and scan this QR code.')
            expect(email.textBody).toContain('The QR code is in this email.')
            expect(email.textBody).not.toContain('cid:')
            expect(email.textBody).not.toContain(cardUrl)
            expect(email.textBody).not.toContain('テスト銀行')
        })

        it('falls back when the clinic has no QR', () => {
            const email = pendingEmail('payPay', { ...everySetting, payPayQr: false })

            expect(email.textBody).toContain(FALLBACK)
            expect(email.htmlBody).not.toContain('<img')
        })
    })

    it('falls back and names no method when the answer was not a known method', () => {
        const email = pendingEmail(null)

        expect(email.textBody).toContain(FALLBACK)
        expect(email.textBody).not.toContain('Payment method')
    })

    it('falls back to English for a missing or unknown locale', () => {
        expect(pendingEmail('payPay', everySetting, null).subject)
            .toBe('Payment needed to confirm your appointment · Minato Clinic')
        expect(pendingEmail('payPay', everySetting, 'xx-XX').textBody).toContain('Japan time')
    })

    it('has its own copy for every site locale, different from the plain receipt', () => {
        const english = pendingEmail('creditCard', noSetting)
        for (const locale of SITE_LOCALES) {
            const email = pendingEmail('creditCard', noSetting, locale)
            const receipt = patientRequestEmail({
                locale,
                clinicName: 'Minato Clinic',
                startsAt,
                durationMinutes: 30,
                reference: 'booking-1',
                manageUrl
            })
            expect(email.subject, locale).not.toBe(receipt.subject)
            expect(email.htmlBody, locale).toContain(`<html lang="${locale}">`)
            if (locale !== 'en-US') {
                expect(email.subject, locale).not.toBe(english.subject)
                // The intro, method label, and fallback are translated.
                for (const line of [0, 1]) {
                    expect(email.textBody.split('\n\n')[line], locale).not.toBe(english.textBody.split('\n\n')[line])
                }
                expect(email.textBody, locale).not.toContain(FALLBACK)
            }
        }
    })

    it('escapes the clinic name and keeps the card link away from Translate', () => {
        const email = patientPendingPaymentEmail({
            locale: 'en-US',
            clinicName: '<b>Clinic</b>',
            startsAt,
            durationMinutes: 30,
            reference: 'booking-1',
            manageUrl,
            instructions: { method: 'creditCard', ...everySetting }
        })
        expect(email.htmlBody).not.toContain('<b>Clinic</b>')
        expect(email.htmlBody).toContain('&lt;b&gt;Clinic&lt;/b&gt;')
        expect(email.htmlBody).toContain(`<a translate="no" class="notranslate" href="${cardUrl}"`)
    })
})

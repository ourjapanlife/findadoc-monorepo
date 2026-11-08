import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    BookingBankAccountType,
    BookingCardPaymentMode,
    type UpdateBookingPaymentSettingsInput
} from '@findadoc/graphql'
import type { BookingAccess } from '../src/booking/access.js'
import { PAYPAY_QR_CONTENT_ID } from '../src/booking/paymentEmailCopy.js'
import { pendingPaymentEmail } from '../src/booking/paymentEmail.js'
import { writeEmailPreview } from '../src/email/emailPreview.js'
import { sendTransactionalEmail } from '../src/email/sesClient.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { db } from '../src/kyselyClient.js'
import { logger } from '../src/logger.js'
import { ErrorCode } from '../src/result.js'
import * as facilityService from '../src/services/facilityService.js'
import * as paymentSettingsService from '../src/services/paymentSettingsService.js'
import {
    PAYMENT_QR_MAX_BYTES,
    imageTypeFromBytes,
    isPaymentQrKeyFor,
    paymentQrObjectKey
} from '../src/storage/clinicAssetStorage.js'
import { isSafeBookingObjectKey, isSafeLocalObjectKey, storeLocalBookingUpload } from '../src/storage/objectStorage.js'
import { isHttpsUrl, validatePaymentSettings } from '../src/validation/validatePaymentSettings.js'

const API = 'http://127.0.0.1:4000'
const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const memberOf = (facilityId: string, role: 'owner' | 'staff'): BookingAccess => ({
    readAll: false,
    writeAll: false,
    manageMembersAll: false,
    memberships: new Map([[facilityId, role]])
})

// The smallest valid-looking headers for each type. The server reads only the first bytes.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')])

function settingsInput(
    facilityId: string,
    overrides: Partial<UpdateBookingPaymentSettingsInput> = {}
): UpdateBookingPaymentSettingsInput {
    return {
        facilityId,
        cardMode: BookingCardPaymentMode.FixedLink,
        cardUrl: 'https://example.com/pay',
        bankName: 'テスト銀行',
        bankBranch: 'サンプル支店',
        bankAccountType: BookingBankAccountType.Ordinary,
        bankAccountNumber: '1234567',
        bankAccountHolder: 'テスト クリニック',
        feeJpy: 5000,
        ...overrides
    }
}

async function storedQr(facilityId: string, bytes: Buffer, type: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png') {
    const key = paymentQrObjectKey(facilityId, crypto.randomUUID(), type)
    await storeLocalBookingUpload(key, bytes, type)
    return key
}

describe('payment settings validation', () => {
    const facilityId = '00000000-0000-4000-8000-000000000000'

    it('accepts https only for the card link', () => {
        expect(isHttpsUrl('https://example.com/pay')).toBe(true)
        const refused = [
            'http://example.com/pay',
            'javascript:alert(1)',
            'data:text/html,hi',
            'example.com',
            'https://user:pass@example.com/',
            `https://example.com/${'a'.repeat(2048)}`
        ]
        for (const url of refused) {
            expect(isHttpsUrl(url), url).toBe(false)
        }
        expect(validatePaymentSettings(settingsInput(facilityId, { cardUrl: 'http://example.com' })))
            .toEqual({ error: { field: 'cardUrl', errorCode: ErrorCode.INVALID_WEBSITE } })
    })

    it('requires the card link for a fixed link, but not when staff send it', () => {
        expect(validatePaymentSettings(settingsInput(facilityId, { cardUrl: '  ' })))
            .toEqual({ error: { field: 'cardUrl', errorCode: ErrorCode.REQUIRED } })
        const byStaff = validatePaymentSettings(settingsInput(facilityId, {
            cardMode: BookingCardPaymentMode.SentByStaff,
            cardUrl: null
        }))
        expect('value' in byStaff && byStaff.value.cardMode).toBe('sent_by_staff')
    })

    it('takes a whole number of yen, zero or more, or no fee', () => {
        expect(validatePaymentSettings(settingsInput(facilityId, { feeJpy: -1 })))
            .toEqual({ error: { field: 'feeJpy', errorCode: ErrorCode.NEGATIVE_NUMBER } })
        expect(validatePaymentSettings(settingsInput(facilityId, { feeJpy: 1.5 })))
            .toEqual({ error: { field: 'feeJpy', errorCode: ErrorCode.INVALID_INPUT } })
        for (const feeJpy of [0, null]) {
            const checked = validatePaymentSettings(settingsInput(facilityId, { feeJpy }))
            expect('value' in checked && checked.value.feeJpy).toBe(feeJpy)
        }
    })

    it('checks the account number and the text lengths, and turns blanks into null', () => {
        expect(validatePaymentSettings(settingsInput(facilityId, { bankAccountNumber: '12-345' })))
            .toEqual({ error: { field: 'bankAccountNumber', errorCode: ErrorCode.INVALID_INPUT } })
        expect(validatePaymentSettings(settingsInput(facilityId, { bankName: 'x'.repeat(101) })))
            .toEqual({ error: { field: 'bankName', errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG } })
        const cleared = validatePaymentSettings(settingsInput(facilityId, { bankName: '  ', bankAccountType: null }))
        expect('value' in cleared && cleared.value.bankName).toBeNull()
        expect('value' in cleared && cleared.value.bankAccountType).toBeNull()
    })

    it('refuses a facility id that is not a uuid', () => {
        expect(validatePaymentSettings(settingsInput('not-a-uuid')))
            .toEqual({ error: { field: 'facilityId', errorCode: ErrorCode.INVALID_ID } })
    })
})

describe('clinic asset keys', () => {
    const facilityId = '00000000-0000-4000-8000-000000000000'

    it('builds keys under uploads/clinic that only that facility may use', () => {
        const key = paymentQrObjectKey(facilityId, '11111111-1111-4111-8111-111111111111', 'image/webp')
        expect(key).toBe(`uploads/clinic/${facilityId}/paypay/11111111-1111-4111-8111-111111111111.webp`)
        expect(isPaymentQrKeyFor(facilityId, key)).toBe(true)
        expect(isPaymentQrKeyFor('00000000-0000-4000-8000-000000000001', key)).toBe(false)
        expect(isPaymentQrKeyFor(facilityId, `uploads/clinic/${facilityId}/paypay/../x.png`)).toBe(false)
        expect(isPaymentQrKeyFor(facilityId, `uploads/clinic/${facilityId}/logo/11111111-1111-4111-8111-111111111111.png`))
            .toBe(false)
    })

    it('lets the local store take clinic keys, which stay outside the booking purge', () => {
        const key = paymentQrObjectKey(facilityId, '11111111-1111-4111-8111-111111111111', 'image/png')
        expect(isSafeLocalObjectKey(key)).toBe(true)
        expect(isSafeBookingObjectKey(key)).toBe(false)
        expect(isSafeLocalObjectKey('uploads/other/x/y/z.png')).toBe(false)
    })

    it('reads the image type from the bytes, not the name', () => {
        expect(imageTypeFromBytes(PNG)).toBe('image/png')
        expect(imageTypeFromBytes(JPEG)).toBe('image/jpeg')
        expect(imageTypeFromBytes(WEBP)).toBe('image/webp')
        expect(imageTypeFromBytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
        expect(imageTypeFromBytes(Buffer.from('%PDF-1.7'))).toBeNull()
    })
})

describe('booking payment settings', () => {
    let facilityId = ''
    let otherFacilityId = ''

    beforeAll(async () => {
        for (const assign of [(id: string) => { facilityId = id }, (id: string) => { otherFacilityId = id }]) {
            const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
            expect(created.hasErrors).toBe(false)
            assign(created.data.id)
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        for (const id of [facilityId, otherFacilityId]) {
            await db.deleteFrom('booking_payment_settings').where('facility_id', '=', id).execute()
            await db.deleteFrom('facilities').where('id', '=', id).execute()
        }
    })

    it('lets the owner save and staff read, with no QR at first', async () => {
        const saved = await paymentSettingsService.updateBookingPaymentSettings(
            settingsInput(facilityId),
            memberOf(facilityId, 'owner'),
            API
        )
        expect(saved.hasErrors).toBe(false)
        expect(saved.data).toMatchObject({
            cardMode: BookingCardPaymentMode.FixedLink,
            cardUrl: 'https://example.com/pay',
            bankAccountType: BookingBankAccountType.Ordinary,
            feeJpy: 5000,
            hasPayPayQr: false,
            payPayQrPreviewUrl: null,
            canManage: true
        })

        const read = await paymentSettingsService.getBookingPaymentSettings(facilityId, memberOf(facilityId, 'staff'), API)
        expect(read).toMatchObject({ bankName: 'テスト銀行', canManage: false })
    })

    it('refuses staff and the owner of another clinic, and hides the settings from other clinics', async () => {
        for (const access of [memberOf(facilityId, 'staff'), memberOf(otherFacilityId, 'owner')]) {
            const refused = await paymentSettingsService.updateBookingPaymentSettings(
                settingsInput(facilityId, { feeJpy: 1 }),
                access,
                API
            )
            expect(refused.errors?.[0]).toMatchObject({ field: 'facilityId', errorCode: ErrorCode.FORBIDDEN })
        }
        expect(await paymentSettingsService.getBookingPaymentSettings(facilityId, memberOf(otherFacilityId, 'owner'), API))
            .toBeNull()
        const row = await db.selectFrom('booking_payment_settings').select('fee_jpy')
            .where('facility_id', '=', facilityId).executeTakeFirstOrThrow()
        expect(row.fee_jpy).toBe(5000)
    })

    it('lets an admin save any clinic', async () => {
        const saved = await paymentSettingsService.updateBookingPaymentSettings(
            settingsInput(otherFacilityId, {
                cardMode: BookingCardPaymentMode.SentByStaff,
                cardUrl: null,
                feeJpy: null
            }),
            admin,
            API
        )
        expect(saved.hasErrors).toBe(false)
        expect(saved.data).toMatchObject({ cardMode: BookingCardPaymentMode.SentByStaff, cardUrl: null, feeJpy: null })
    })

    describe('PayPay QR', () => {
        it('signs an upload for the owner only, for a small PNG, JPEG, or WebP', async () => {
            const owner = memberOf(facilityId, 'owner')
            const signed = await paymentSettingsService.createPaymentQrUploadUrl(
                { facilityId, contentType: 'image/png', byteSize: 2048 },
                owner,
                API
            )
            expect(signed.hasErrors).toBe(false)
            expect(isPaymentQrKeyFor(facilityId, signed.data.objectKey)).toBe(true)
            expect(signed.data.uploadUrl).toContain(`${API}/dev-uploads/`)

            const cases = [
                { input: { facilityId, contentType: 'image/svg+xml', byteSize: 2048 }, access: owner, field: 'contentType' },
                { input: { facilityId, contentType: 'image/png', byteSize: PAYMENT_QR_MAX_BYTES + 1 }, access: owner, field: 'byteSize' },
                { input: { facilityId, contentType: 'image/png', byteSize: 0 }, access: owner, field: 'byteSize' },
                {
                    input: { facilityId, contentType: 'image/png', byteSize: 2048 },
                    access: memberOf(facilityId, 'staff'),
                    field: 'facilityId'
                }
            ]
            for (const { input, access, field } of cases) {
                const refused = await paymentSettingsService.createPaymentQrUploadUrl(input, access, API)
                expect(refused.errors?.[0]?.field, field).toBe(field)
            }
        })

        it('saves an uploaded QR after checking its bytes, and shows a preview link', async () => {
            const key = await storedQr(facilityId, PNG)
            const saved = await paymentSettingsService.updateBookingPaymentSettings(
                settingsInput(facilityId, { payPayQrObjectKey: key }),
                memberOf(facilityId, 'owner'),
                API
            )
            expect(saved.hasErrors).toBe(false)
            expect(saved.data.hasPayPayQr).toBe(true)
            expect(saved.data.payPayQrPreviewUrl).toBe(`${API}/dev-uploads/${encodeURIComponent(key)}`)

            // Saving the form again without a new key keeps the QR.
            const again = await paymentSettingsService.updateBookingPaymentSettings(
                settingsInput(facilityId, { feeJpy: 6000 }),
                memberOf(facilityId, 'owner'),
                API
            )
            expect(again.data.hasPayPayQr).toBe(true)
        })

        it('refuses a QR that is not an image, too large, missing, or another clinic\'s', async () => {
            const notImage = await storedQr(facilityId, Buffer.from('<svg/>'))
            const wrongType = await storedQr(facilityId, JPEG, 'image/png')
            const tooLarge = await storedQr(facilityId, Buffer.concat([PNG, Buffer.alloc(PAYMENT_QR_MAX_BYTES)]))
            const missing = paymentQrObjectKey(facilityId, crypto.randomUUID(), 'image/png')
            const otherClinic = await storedQr(otherFacilityId, PNG)
            for (const key of [notImage, wrongType, tooLarge, missing, otherClinic]) {
                const refused = await paymentSettingsService.updateBookingPaymentSettings(
                    settingsInput(facilityId, { payPayQrObjectKey: key }),
                    memberOf(facilityId, 'owner'),
                    API
                )
                expect(refused.errors?.[0]).toMatchObject({
                    field: 'payPayQrObjectKey',
                    errorCode: ErrorCode.PAYMENT_QR_INVALID
                })
            }
        })

        it('removes the QR when asked', async () => {
            const removed = await paymentSettingsService.updateBookingPaymentSettings(
                settingsInput(facilityId, { removePayPayQr: true }),
                memberOf(facilityId, 'owner'),
                API
            )
            expect(removed.data.hasPayPayQr).toBe(false)
        })
    })

    describe('the pending-payment email', () => {
        const base = {
            locale: 'en-US',
            clinicName: 'Payment Clinic',
            startsAt: new Date('2026-11-02T00:00:00.000Z'),
            durationMinutes: 30,
            reference: 'booking-1',
            manageUrl: 'https://www.findadoc.jp/book/manage#token'
        }

        it('attaches the clinic QR inline for PayPay, and only for PayPay', async () => {
            const key = await storedQr(facilityId, PNG)
            await paymentSettingsService.updateBookingPaymentSettings(
                settingsInput(facilityId, { payPayQrObjectKey: key, feeJpy: 3000 }),
                admin,
                API
            )

            const payPay = await pendingPaymentEmail({ ...base, facilityId, paymentAnswer: 'payPay' })
            expect(payPay.inlineAttachments).toEqual([{
                contentId: PAYPAY_QR_CONTENT_ID,
                fileName: 'paypay-qr.png',
                contentType: 'image/png',
                content: PNG
            }])
            expect(payPay.htmlBody).toContain(`cid:${PAYPAY_QR_CONTENT_ID}`)
            expect(payPay.textBody).toContain('Initial fee: ¥3,000')

            const bank = await pendingPaymentEmail({ ...base, facilityId, paymentAnswer: 'bankTransfer' })
            expect(bank.inlineAttachments).toBeUndefined()
            expect(bank.textBody).toContain('口座番号: 1234567')
        })

        it('falls back when the clinic saved no settings, or the answer is not a method', async () => {
            const facility = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
            const unset = await pendingPaymentEmail({ ...base, facilityId: facility.data.id, paymentAnswer: 'payPay' })
            expect(unset.textBody).toContain('The clinic will contact you with payment instructions.')
            expect(unset.inlineAttachments).toBeUndefined()
            await db.deleteFrom('facilities').where('id', '=', facility.data.id).execute()

            const unknown = await pendingPaymentEmail({ ...base, facilityId, paymentAnswer: 'cash' })
            expect(unknown.textBody).not.toContain('Payment method')
            expect(unknown.textBody).toContain('The clinic will contact you with payment instructions.')
        })
    })

    it('is deleted with the facility', async () => {
        const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
        const id = created.data.id
        await paymentSettingsService.updateBookingPaymentSettings(settingsInput(id), admin, API)

        const deleted = await facilityService.deleteFacility(id, 'test|moderator')
        expect(deleted.hasErrors).toBe(false)
        const rows = await db.selectFrom('booking_payment_settings').select('facility_id')
            .where('facility_id', '=', id).execute()
        expect(rows).toEqual([])
    })
})

describe('inline attachments when SES is not configured', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('logs how many attachments and their types, never a name or a key', async () => {
        const info = vi.spyOn(logger, 'info').mockImplementation(() => logger)
        const result = await sendTransactionalEmail({
            to: 'patient@example.com',
            subject: 'Subject',
            textBody: 'Body',
            htmlBody: `<img src="cid:${PAYPAY_QR_CONTENT_ID}">`,
            bookingId: 'booking-1',
            inlineAttachments: [{
                contentId: PAYPAY_QR_CONTENT_ID,
                fileName: 'paypay-qr.png',
                contentType: 'image/png',
                content: PNG
            }]
        })
        expect(result).toBe('logged')
        const logged = JSON.stringify(info.mock.calls)
        expect(logged).toContain('"inlineAttachments":1')
        expect(logged).toContain('image/png')
        expect(logged).not.toContain('paypay-qr.png')
        expect(logged).not.toContain('uploads/clinic')
        expect(logged).not.toContain('patient@example.com')
    })

    it('writes a browser preview with the cid image beside it', async () => {
        const root = await mkdtemp(join(tmpdir(), 'email-preview-'))
        try {
            const indexPath = await writeEmailPreview({
                to: 'patient@example.com',
                subject: 'Subject',
                textBody: 'Body',
                htmlBody: `<p><img src="cid:${PAYPAY_QR_CONTENT_ID}"></p>`,
                bookingId: 'booking-1',
                inlineAttachments: [{
                    contentId: PAYPAY_QR_CONTENT_ID,
                    fileName: 'paypay-qr.png',
                    contentType: 'image/png',
                    content: PNG
                }]
            }, root)
            const html = await readFile(indexPath, 'utf8')
            expect(html).toContain('<img src="0-paypay-qr.png">')
            const [folder] = await readdir(root)
            expect(folder).toContain('booking-1')
            expect(folder).not.toContain('patient')
            expect(await readFile(join(root, folder ?? '', '0-paypay-qr.png'))).toEqual(PNG)
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })
})

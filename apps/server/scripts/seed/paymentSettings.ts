import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import type { Insertable } from 'kysely'
import type { BookingPaymentSettingsTable } from '../../src/typeDefs/kyselyTypes.js'
import { SHOWCASE_FACILITY_ID } from './clinicSiteContent.js'

/**
 * Showcase payment settings (online consult v2 §3.3), so a local booking on the online-consult
 * form sends the pending-payment email with every method filled in. Every value is obviously fake:
 * example.com, テスト銀行, and a QR-like placeholder that no app can scan.
 */
export const SHOWCASE_PAYPAY_QR_KEY =
    `uploads/clinic/${SHOWCASE_FACILITY_ID}/paypay/00000000-0000-4000-8000-000000000001.png`

export const SHOWCASE_PAYMENT_SETTINGS = {
    facility_id: SHOWCASE_FACILITY_ID,
    card_mode: 'fixed_link',
    card_url: 'https://example.com/pay',
    bank_name: 'テスト銀行',
    bank_branch: 'サンプル支店',
    bank_account_type: 'ordinary',
    bank_account_number: '1234567',
    bank_account_holder: 'テスト クリニック',
    paypay_qr_object_key: SHOWCASE_PAYPAY_QR_KEY,
    fee_jpy: 5000
} satisfies Insertable<BookingPaymentSettingsTable>

const MODULES = 25
const QUIET = 4
const SCALE = 8

function isFinder(row: number, column: number): boolean | null {
    const corners: Array<[number, number]> = [[0, 0], [0, MODULES - 7], [MODULES - 7, 0]]
    for (const [top, left] of corners) {
        const y = row - top
        const x = column - left
        if (y >= 0 && y < 7 && x >= 0 && x < 7) {
            const ring = Math.min(y, x, 6 - y, 6 - x)
            return ring !== 1
        }
    }
    return null
}

/** Dark or light for one module: finder squares in three corners, a fixed pattern elsewhere. */
function moduleIsDark(row: number, column: number): boolean {
    const finder = isFinder(row, column)
    if (finder !== null) {
        return finder
    }
    return ((row * 7 + column * 13 + row * column) % 5) < 2
}

function chunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
}

/** A grayscale PNG that looks like a QR code. It encodes nothing. */
export function placeholderQrPng(): Buffer {
    const size = (MODULES + QUIET * 2) * SCALE
    const rows: Buffer[] = []
    for (let y = 0; y < size; y++) {
        const row = Buffer.alloc(size + 1)
        for (let x = 0; x < size; x++) {
            const moduleRow = Math.floor(y / SCALE) - QUIET
            const moduleColumn = Math.floor(x / SCALE) - QUIET
            const inside = moduleRow >= 0 && moduleRow < MODULES && moduleColumn >= 0 && moduleColumn < MODULES
            row[x + 1] = inside && moduleIsDark(moduleRow, moduleColumn) ? 0 : 255
        }
        rows.push(row)
    }
    const header = Buffer.alloc(13)
    header.writeUInt32BE(size, 0)
    header.writeUInt32BE(size, 4)
    header[8] = 8
    header[9] = 0
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(Buffer.concat(rows))),
        chunk('IEND', Buffer.alloc(0))
    ])
}

/** Writes the placeholder QR into the local upload store the dev API serves (.booking-uploads). */
export async function writeShowcaseQr(): Promise<void> {
    const path = join(process.cwd(), '.booking-uploads', SHOWCASE_PAYPAY_QR_KEY)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, placeholderQrPng())
}

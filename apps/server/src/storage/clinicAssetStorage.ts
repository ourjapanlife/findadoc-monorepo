import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { envVariables } from '../../utils/environmentVariables.js'
import { UUID_REGEX } from '../validation/validateFacility.js'
import {
    newUploadId,
    readLocalBookingUpload,
    s3Client,
    usesS3,
    type SignedUpload
} from './objectStorage.js'

/**
 * Clinic assets: files a clinic uploads about itself, not about a patient (online consult v2 §3.3).
 * Today that is only the PayPay QR. Keys are uploads/clinic/{facilityId}/paypay/{uuid}.{ext}.
 * The patient purge (uploads/booking/) never touches them.
 */

/** The QR goes inline in every pending-payment email, so it stays small. */
export const PAYMENT_QR_MAX_BYTES = 1024 * 1024

const PRESIGN_TTL_SECONDS = 15 * 60
const PREVIEW_TTL_SECONDS = 5 * 60

export const PAYMENT_QR_CONTENT_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
} as const

export type PaymentQrContentType = keyof typeof PAYMENT_QR_CONTENT_TYPES

export function isPaymentQrContentType(value: string): value is PaymentQrContentType {
    return Object.keys(PAYMENT_QR_CONTENT_TYPES).some(type => type === value)
}

const EXTENSION_TYPES: Record<string, PaymentQrContentType> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp'
}

const QR_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/

export function paymentQrObjectKey(facilityId: string, uploadId: string, contentType: PaymentQrContentType): string {
    return `uploads/clinic/${facilityId}/paypay/${uploadId}.${PAYMENT_QR_CONTENT_TYPES[contentType]}`
}

/** True only for a key this API made for this facility's QR, so one clinic cannot point at another's file. */
export function isPaymentQrKeyFor(facilityId: string, objectKey: string): boolean {
    if (!UUID_REGEX.test(facilityId)) {
        return false
    }
    const parts = objectKey.split('/')
    return parts.length === 5
        && parts[0] === 'uploads'
        && parts[1] === 'clinic'
        && parts[2] === facilityId
        && parts[3] === 'paypay'
        && QR_FILE_PATTERN.test(parts[4] ?? '')
}

/** The image type from the key's extension. The key was built from a checked type. */
export function paymentQrContentType(objectKey: string): PaymentQrContentType {
    const extension = objectKey.split('.').pop() ?? ''
    return EXTENSION_TYPES[extension] ?? 'image/png'
}

/**
 * The image type from the first bytes of the file: PNG, JPEG, or WebP, else null.
 * The upload's Content-Type header is the client's claim; this is the server's check.
 */
export function imageTypeFromBytes(bytes: Uint8Array): PaymentQrContentType | null {
    const starts = (signature: readonly number[], offset = 0): boolean =>
        bytes.length >= offset + signature.length
        && signature.every((byte, index) => bytes[offset + index] === byte)
    if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 'image/png'
    }
    if (starts([0xff, 0xd8, 0xff])) {
        return 'image/jpeg'
    }
    // RIFF....WEBP
    if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
        return 'image/webp'
    }
    return null
}

function bucketName(): string {
    const bucket = envVariables.s3Bucket()
    if (bucket === undefined || bucket === '') {
        throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
    }
    return bucket
}

/** A short-lived PUT for one QR. S3 signs the type and length, so the PUT must match them. */
export async function createPaymentQrUploadTarget(input: {
    facilityId: string
    contentType: PaymentQrContentType
    byteSize: number
    apiBaseUrl: string
}): Promise<SignedUpload> {
    const objectKey = paymentQrObjectKey(input.facilityId, newUploadId(), input.contentType)
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString()
    const headers = [{ name: 'Content-Type', value: input.contentType }]
    if (usesS3()) {
        const command = new PutObjectCommand({
            Bucket: bucketName(),
            Key: objectKey,
            ContentType: input.contentType,
            ContentLength: input.byteSize
        })
        const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: PRESIGN_TTL_SECONDS })
        return { uploadUrl, objectKey, headers, expiresAt }
    }
    const uploadUrl = `${input.apiBaseUrl.replace(/\/$/, '')}/dev-uploads/${encodeURIComponent(objectKey)}`
    return { uploadUrl, objectKey, headers, expiresAt }
}

/** The stored bytes of a clinic asset, or null when the object is missing or unreadable. */
export async function readClinicAsset(objectKey: string): Promise<Buffer | null> {
    try {
        if (usesS3()) {
            const object = await s3Client().send(new GetObjectCommand({ Bucket: bucketName(), Key: objectKey }))
            if (object.Body === undefined) {
                return null
            }
            return Buffer.from(await object.Body.transformToByteArray())
        }
        return await readLocalBookingUpload(objectKey)
    } catch {
        return null
    }
}

/** A 5-minute link for staff to see the QR in the dashboard. */
export async function clinicAssetPreviewUrl(objectKey: string, apiBaseUrl: string): Promise<string> {
    if (usesS3()) {
        const command = new GetObjectCommand({
            Bucket: bucketName(),
            Key: objectKey,
            ResponseContentType: paymentQrContentType(objectKey),
            ResponseContentDisposition: 'inline'
        })
        return getSignedUrl(s3Client(), command, { expiresIn: PREVIEW_TTL_SECONDS })
    }
    return `${apiBaseUrl.replace(/\/$/, '')}/dev-uploads/${encodeURIComponent(objectKey)}`
}

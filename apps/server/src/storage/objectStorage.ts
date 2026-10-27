import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { BOOKING_UPLOAD_MAX_BYTES } from '../booking/limits.js'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { envVariables } from '../../utils/environmentVariables.js'
import { logger } from '../logger.js'

const LOCAL_UPLOAD_ROOT = join(process.cwd(), '.booking-uploads')
const PRESIGN_TTL_SECONDS = 15 * 60
const DOWNLOAD_TTL_SECONDS = 5 * 60

function s3Client(): S3Client {
    const endpoint = envVariables.s3Endpoint()
    if (endpoint === undefined) {
        return new S3Client({
            region: envVariables.s3Region(),
            useDualstackEndpoint: true
        })
    }

    const accessKeyId = envVariables.s3AccessKeyId()
    const secretAccessKey = envVariables.s3SecretAccessKey()
    if (accessKeyId === undefined || accessKeyId === '' || secretAccessKey === undefined || secretAccessKey === '') {
        throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when S3_ENDPOINT is set')
    }

    // A local bucket is path-style and uses the static key. AWS keeps the default credential chain.
    return new S3Client({
        region: envVariables.s3Region(),
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey }
    })
}

export type SignedUpload = {
    uploadUrl: string
    objectKey: string
    headers: Array<{ name: string, value: string }>
    expiresAt: string
}

function usesS3(): boolean {
    return envVariables.storageBackend() === 's3'
        && typeof envVariables.s3Bucket() === 'string'
        && envVariables.s3Bucket() !== ''
}

function sanitizeFileName(fileName: string): string {
    const base = fileName.split(/[/\\]/).pop()?.trim() || 'upload'
    return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'upload'
}

/** Object key under uploads/booking/{clinicSiteId}/{uploadId}/{fileName}. */
export function bookingObjectKey(clinicSiteId: string, uploadId: string, fileName: string): string {
    return `uploads/booking/${clinicSiteId}/${uploadId}/${sanitizeFileName(fileName)}`
}

/** Rejects empty segments, `.`, `..`, and anything outside uploads/booking/. */
export function isSafeBookingObjectKey(objectKey: string): boolean {
    if (objectKey.includes('\\') || objectKey.includes('\0')) {
        return false
    }
    const parts = objectKey.split('/')
    if (parts.some(part => part === '' || part === '.' || part === '..')) {
        return false
    }
    return parts[0] === 'uploads' && parts[1] === 'booking' && parts.length >= 3
}

function localBookingFilePath(objectKey: string): string {
    if (!isSafeBookingObjectKey(objectKey)) {
        throw new Error('Invalid booking upload key')
    }
    const root = resolve(LOCAL_UPLOAD_ROOT)
    const absolute = resolve(root, objectKey)
    const fromRoot = relative(root, absolute)
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
        throw new Error('Invalid booking upload key')
    }
    return absolute
}

/**
 * A short-lived PUT URL for one booking file.
 * S3 when STORAGE_BACKEND=s3. Otherwise a local API path the Fastify route serves.
 */
export async function createBookingUploadTarget(input: {
    clinicSiteId: string
    uploadId: string
    contentType: string
    fileName: string
    byteSize: number
    apiBaseUrl: string
}): Promise<SignedUpload> {
    const objectKey = bookingObjectKey(input.clinicSiteId, input.uploadId, input.fileName)
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString()

    if (usesS3()) {
        const bucket = envVariables.s3Bucket()
        if (bucket === undefined || bucket === '') {
            throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
        }

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ContentType: input.contentType,
            ContentLength: input.byteSize
        })
        const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: PRESIGN_TTL_SECONDS })
        return {
            uploadUrl,
            objectKey,
            headers: [{ name: 'Content-Type', value: input.contentType }],
            expiresAt
        }
    }

    const uploadUrl = `${input.apiBaseUrl.replace(/\/$/, '')}/dev-uploads/${encodeURIComponent(objectKey)}`
    return {
        uploadUrl,
        objectKey,
        headers: [{ name: 'Content-Type', value: input.contentType }],
        expiresAt
    }
}

/** Stores a local PUT body when STORAGE_BACKEND is not s3. */
export async function storeLocalBookingUpload(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    if (usesS3()) {
        throw new Error('Local booking upload store is disabled when STORAGE_BACKEND=s3')
    }
    const absolute = localBookingFilePath(objectKey)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, body)
    logger.info('Stored local booking upload', {
        objectKey,
        contentType,
        byteSize: body.byteLength
    })
}

export function newUploadId(): string {
    return randomUUID()
}

/** Short-lived GET URL for staff download. Purged objects must not call this. */
export async function createBookingDownloadUrl(input: {
    objectKey: string
    apiBaseUrl: string
}): Promise<{ downloadUrl: string, expiresAt: string }> {
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000).toISOString()
    if (usesS3()) {
        const bucket = envVariables.s3Bucket()
        if (bucket === undefined || bucket === '') {
            throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
        }
        const command = new GetObjectCommand({ Bucket: bucket, Key: input.objectKey })
        const downloadUrl = await getSignedUrl(s3Client(), command, { expiresIn: DOWNLOAD_TTL_SECONDS })
        return { downloadUrl, expiresAt }
    }
    return {
        downloadUrl: `${input.apiBaseUrl.replace(/\/$/, '')}/dev-uploads/${encodeURIComponent(input.objectKey)}`,
        expiresAt
    }
}

/** Byte size of a stored object, or null when the object is missing. */
export async function bookingObjectByteSize(objectKey: string): Promise<number | null> {
    if (!isSafeBookingObjectKey(objectKey)) {
        return null
    }
    if (usesS3()) {
        const bucket = envVariables.s3Bucket()
        if (bucket === undefined || bucket === '') {
            throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
        }
        try {
            const head = await s3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }))
            return head.ContentLength ?? null
        } catch {
            return null
        }
    }
    try {
        const info = await stat(localBookingFilePath(objectKey))
        return info.size
    } catch {
        return null
    }
}

export function bookingUploadExceedsLimit(byteSize: number, maxBytes: number | null | undefined): boolean {
    const limit = maxBytes ?? BOOKING_UPLOAD_MAX_BYTES
    return byteSize > limit
}

export async function deleteBookingObject(objectKey: string): Promise<void> {
    if (!isSafeBookingObjectKey(objectKey) && !objectKey.startsWith('purged/')) {
        throw new Error('Invalid booking upload key')
    }
    if (objectKey.startsWith('purged/')) {
        return
    }
    if (usesS3()) {
        const bucket = envVariables.s3Bucket()
        if (bucket === undefined || bucket === '') {
            throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
        }
        await s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
        return
    }
    try {
        await unlink(localBookingFilePath(objectKey))
    } catch (error) {
        logger.warn(`Local booking object missing during purge: ${objectKey} (${String(error)})`)
    }
}

export async function readLocalBookingUpload(objectKey: string): Promise<Buffer> {
    if (usesS3()) {
        throw new Error('Local read is disabled when STORAGE_BACKEND=s3')
    }
    return readFile(localBookingFilePath(objectKey))
}

export function localUploadRoot(): string {
    return LOCAL_UPLOAD_ROOT
}

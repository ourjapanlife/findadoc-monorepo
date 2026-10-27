import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { envVariables } from '../../utils/environmentVariables.js'
import { logger } from '../logger.js'

const LOCAL_UPLOAD_ROOT = join(process.cwd(), '.booking-uploads')
const PRESIGN_TTL_SECONDS = 15 * 60

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

/**
 * A short-lived PUT URL for one booking file.
 * S3 when STORAGE_BACKEND=s3. Otherwise a local API path the Fastify route serves.
 */
export async function createBookingUploadTarget(input: {
    clinicSiteId: string
    uploadId: string
    contentType: string
    fileName: string
    apiBaseUrl: string
}): Promise<SignedUpload> {
    const objectKey = bookingObjectKey(input.clinicSiteId, input.uploadId, input.fileName)
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString()

    if (usesS3()) {
        const bucket = envVariables.s3Bucket()
        if (bucket === undefined || bucket === '') {
            throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3')
        }

        const client = new S3Client({
            region: envVariables.s3Region(),
            // Dual-stack so the VPC IPv6 path can reach S3 when signing is not enough alone.
            useDualstackEndpoint: true
        })
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ContentType: input.contentType
        })
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_TTL_SECONDS })
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
    if (!objectKey.startsWith('uploads/booking/')) {
        throw new Error('Invalid booking upload key')
    }

    const absolute = join(LOCAL_UPLOAD_ROOT, objectKey)
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

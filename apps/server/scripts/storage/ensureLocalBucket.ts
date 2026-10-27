import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { envVariables } from '../../utils/environmentVariables.js'

/**
 * Creates the local booking bucket. Browser CORS comes from the container,
 * not a bucket CORS document (this server does not implement PutBucketCors).
 * Safe to run again.
 */
const endpoint = envVariables.s3Endpoint()
const accessKeyId = envVariables.s3AccessKeyId()
const secretAccessKey = envVariables.s3SecretAccessKey()
const bucket = envVariables.s3Bucket()

if (endpoint === undefined || bucket === undefined || bucket === '') {
    throw new Error('S3_ENDPOINT and S3_BUCKET are required')
}
if (accessKeyId === undefined || accessKeyId === '' || secretAccessKey === undefined || secretAccessKey === '') {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when S3_ENDPOINT is set')
}

const client = new S3Client({
    region: envVariables.s3Region(),
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey }
})

function errorLabel(error: unknown): string {
    if (error instanceof Error && error.name !== '') {
        return error.name
    }
    if (typeof error === 'object' && error !== null && 'Code' in error && typeof error.Code === 'string') {
        return error.Code
    }
    return ''
}

try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
} catch (error) {
    const label = errorLabel(error)
    if (label !== 'BucketAlreadyOwnedByYou' && label !== 'BucketAlreadyExists') {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Could not create ${bucket}: ${label || message}`)
    }
}

console.log(`Local bucket ready: ${bucket} at ${endpoint}`)

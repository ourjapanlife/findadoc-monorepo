import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import type { Function } from 'aws-cdk-lib/aws-lambda'
import {
    BlockPublicAccess,
    Bucket,
    BucketEncryption,
    HttpMethods,
    ObjectOwnership,
} from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import { FINDADOC_ENV } from './environment.js'

export interface UploadsStackProps extends StackProps {
    apiFunction: Function
}

// Private object storage for clinic images, and later for documents.
// Browsers upload and download with presigned URLs signed by the API role.
// Nothing writes yet: STORAGE_BACKEND stays none until a feature uses the bucket.
//
// An empty bucket is $0. Stored bytes are S3 Standard in Tokyo, $0.025/GB-month.
// SSE-S3 is free. A customer-managed KMS key is not used.
export class UploadsStack extends Stack {
    readonly bucket: Bucket

    constructor(scope: Construct, id: string, props: UploadsStackProps) {
        super(scope, id, props)

        // Concrete name, so the Lambda environment does not have to reference this stack.
        const bucketName = `findadoc-uploads-${FINDADOC_ENV.account}`

        this.bucket = new Bucket(this, 'Uploads', {
            bucketName,
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
            enforceSSL: true,
            versioned: false,
            removalPolicy: RemovalPolicy.RETAIN,
            lifecycleRules: [{
                id: 'abort-incomplete-multipart',
                abortIncompleteMultipartUploadAfter: Duration.days(7),
            }],
            cors: [{
                allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
                allowedOrigins: [
                    'https://findadoc.jp',
                    'https://*.findadoc.jp',
                    'https://*.amplifyapp.com',
                    'http://localhost:3000',
                    'http://*.localhost:3000',
                    'http://localhost:4242',
                    'http://127.0.0.1:3000',
                    'http://127.0.0.1:4242',
                ],
                allowedHeaders: ['content-type', 'x-amz-*'],
                exposedHeaders: ['ETag'],
                maxAge: 3600,
            }],
        })

        const role = props.apiFunction.role
        if (role === undefined) {
            throw new Error('The API function needs a role so it can sign upload URLs.')
        }

        // Put and Get on uploads/* only. A presigned URL is signed with this role.
        // There is no access key, and no public object.
        new Policy(this, 'ApiUploads', {
            policyName: 'findadoc-api-uploads',
            roles: [role],
            statements: [
                new PolicyStatement({
                    actions: ['s3:PutObject', 's3:GetObject'],
                    resources: [this.bucket.arnForObjects('uploads/*')],
                }),
            ],
        })

        // Booking intake uploads insurance images through API-signed URLs.
        props.apiFunction.addEnvironment('STORAGE_BACKEND', 's3')
        props.apiFunction.addEnvironment('S3_BUCKET', bucketName)
        props.apiFunction.addEnvironment('S3_REGION', FINDADOC_ENV.region)

        new CfnOutput(this, 'UploadsBucketName', { value: bucketName })
    }
}

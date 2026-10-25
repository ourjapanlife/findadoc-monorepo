import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import type { Construct } from 'constructs'

// The API's secret values, one JSON secret ($0.40 a month). Fill GOOGLE_API_KEY and
// SENTRY_DSN in the console after the first deploy, then redeploy FindadocApi: the
// values are resolved into the Lambda environment at deploy time, so a changed value
// reaches the function on the next deploy. EDGE_SHARED_SECRET is generated here and
// sent by CloudFront on every request (see apps/server/src/clientIp.ts).
//
// It is its own stack because a deploy-time reference needs the secret to exist first.
export class ApiSecretsStack extends Stack {
    readonly secret: Secret

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props)

        this.secret = new Secret(this, 'ApiSecret', {
            secretName: 'findadoc/api',
            description: 'findadoc API: GOOGLE_API_KEY, SENTRY_DSN, EDGE_SHARED_SECRET',
            generateSecretString: {
                // CloudFormation sets this once. Values typed in the console stay.
                secretStringTemplate: JSON.stringify({ GOOGLE_API_KEY: '', SENTRY_DSN: '' }),
                generateStringKey: 'EDGE_SHARED_SECRET',
                excludePunctuation: true,
                passwordLength: 48,
            },
            removalPolicy: RemovalPolicy.RETAIN,
        })

        new CfnOutput(this, 'ApiSecretName', { value: 'findadoc/api' })
    }
}

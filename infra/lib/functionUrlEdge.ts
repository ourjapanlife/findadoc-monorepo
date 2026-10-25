import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import {
    AllowedMethods,
    CachePolicy,
    Distribution,
    FunctionCode,
    FunctionEventType,
    FunctionRuntime,
    Function as CloudFrontFunction,
    HttpVersion,
    OriginRequestCookieBehavior,
    OriginRequestHeaderBehavior,
    OriginRequestPolicy,
    OriginRequestQueryStringBehavior,
    PriceClass,
    ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { FunctionUrlAuthType, type IFunction, type FunctionUrl } from 'aws-cdk-lib/aws-lambda'
import { ARecord, AaaaRecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import type { Construct } from 'constructs'

export interface FunctionUrlEdgeProps {
    fn: IFunction & { addFunctionUrl: (options: { authType: FunctionUrlAuthType }) => FunctionUrl }
    // "API" or "MCP", used in descriptions.
    label: string
    // Names for the CloudFront resources: `${name}` for the policy, `${name}-viewer-ip` for the function.
    name: string
    domainName: string
    certificate: ICertificate
    // Sent to the origin in x-findadoc-edge. The app trusts x-findadoc-viewer-ip only with it.
    edgeSecret: string
    hostedZoneId: string
    zoneName: string
    // Construct ids, kept stable so a deployed stack keeps its resources.
    ids: {
        originRequest: string
        viewerIp: string
        distribution: string
        aliasA: string
        aliasAaaa: string
    }
}

/**
 * A Lambda Function URL behind CloudFront on its own hostname, with A and AAAA aliases.
 * Caching is off. Every viewer header but Host reaches the function (a Function URL only
 * answers its own hostname). A CloudFront Function writes the viewer's address to
 * x-findadoc-viewer-ip, replacing anything the client sent, and the origin adds the edge
 * secret, so rate limits count people rather than CloudFront edges (clientIpFrom in
 * @findadoc/utils). Inside CloudFront's free tier at this traffic.
 */
export function addFunctionUrlEdge(scope: Construct, props: FunctionUrlEdgeProps): { distribution: Distribution, functionUrl: FunctionUrl } {
    const functionUrl = props.fn.addFunctionUrl({ authType: FunctionUrlAuthType.NONE })

    const originRequestPolicy = new OriginRequestPolicy(scope, props.ids.originRequest, {
        originRequestPolicyName: props.name,
        comment: 'All viewer headers except Host',
        headerBehavior: OriginRequestHeaderBehavior.denyList('host'),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
        cookieBehavior: OriginRequestCookieBehavior.none(),
    })

    const viewerIp = new CloudFrontFunction(scope, props.ids.viewerIp, {
        functionName: `${props.name}-viewer-ip`,
        comment: `Sends the viewer IP to the ${props.label}`,
        runtime: FunctionRuntime.JS_2_0,
        code: FunctionCode.fromInline([
            'function handler(event) {',
            '    event.request.headers[\'x-findadoc-viewer-ip\'] = { value: event.viewer.ip }',
            '    return event.request',
            '}',
        ].join('\n')),
    })

    const distribution = new Distribution(scope, props.ids.distribution, {
        comment: `findadoc ${props.label} (${props.domainName})`,
        domainNames: [props.domainName],
        certificate: props.certificate,
        priceClass: PriceClass.PRICE_CLASS_200,
        httpVersion: HttpVersion.HTTP2_AND_3,
        enableIpv6: true,
        defaultBehavior: {
            origin: new FunctionUrlOrigin(functionUrl, {
                customHeaders: { 'x-findadoc-edge': props.edgeSecret },
            }),
            allowedMethods: AllowedMethods.ALLOW_ALL,
            cachePolicy: CachePolicy.CACHING_DISABLED,
            originRequestPolicy,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            compress: true,
            functionAssociations: [{ function: viewerIp, eventType: FunctionEventType.VIEWER_REQUEST }],
        },
    })

    const zone = HostedZone.fromHostedZoneAttributes(scope, 'Zone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.zoneName,
    })
    const target = RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    const recordName = props.domainName.replace(`.${props.zoneName}`, '')

    new ARecord(scope, props.ids.aliasA, { zone, recordName, target })
    new AaaaRecord(scope, props.ids.aliasAaaa, { zone, recordName, target })

    return { distribution, functionUrl }
}

import { App, Tags } from 'aws-cdk-lib'
import { DnsStack } from '../lib/dnsStack.js'
import { FINDADOC_DOMAIN, FINDADOC_ENV } from '../lib/environment.js'

const app = new App()

Tags.of(app).add('project', 'findadoc')
Tags.of(app).add('managed-by', 'cdk')

new DnsStack(app, 'FindadocDns', {
    env: FINDADOC_ENV,
    domainName: FINDADOC_DOMAIN,
})

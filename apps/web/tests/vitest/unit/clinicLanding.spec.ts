import { expect } from 'chai'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOCALE_CODE, LOCALE_CODES } from '@/utils/localePath'
import {
    CLINIC_LANDING_LOCALE_PREFIXES,
    CLINIC_LANDING_MODE,
    CLINIC_PREVIEW_SHELL_SLUGS,
    clinicHostLandingTarget,
    clinicLandingAccess,
    clinicLandingHostSlug,
    clinicLandingMode,
    clinicLandingPath,
    clinicLandingPreviewCookie,
    clinicLandingRedirectTarget,
    clinicLandingShareImage,
    isClinicLandingPath,
    type HostedClinicRef
} from '@/utils/clinicLanding'
import { clinicPreviewShellPaths, writeClinicPreviewShells } from '@/utils/nuxt/clinicPreviewShell'
import { indexableMarketingPaths } from '@/utils/sitemap'
import { SITE_ORIGIN } from '@/utils/site'
import { clinicThemeVars } from '@/utils/clinicTheme'
import { devServerEnv } from '../../../scripts/devFlags.mjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('clinic landings', () => {
    const slug = 'multilingual-online-clinic'
    const clean = clinicLandingPath(slug)
    const sites: HostedClinicRef[] = [
        {
            slug,
            facilityId: 'facility-1',
            status: 'PREVIEW',
            shareImagePath: '/clinic-landings/multilingual-online-clinic/hero.jpg'
        }
    ]

    it('reads a clinic hostname and leaves reserved names alone', () => {
        expect(clinicLandingHostSlug(`${slug}.localhost`)).to.equal(slug)
        expect(clinicLandingHostSlug(`${slug}.localhost:3000`)).to.equal(slug)
        expect(clinicLandingHostSlug(`${slug}.findadoc.jp`)).to.equal(slug)
        expect(clinicLandingHostSlug('www.findadoc.jp')).to.equal(undefined)
        expect(clinicLandingHostSlug('api.findadoc.jp')).to.equal(undefined)
        expect(clinicLandingHostSlug('mcp.findadoc.jp')).to.equal(undefined)
        expect(clinicLandingHostSlug('docs.findadoc.jp')).to.equal(undefined)
        expect(clinicLandingHostSlug('admin.findadoc.jp')).to.equal(undefined)
        expect(clinicLandingHostSlug('findadoc.jp')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.findadoc.jp`, '/ja-JP', 'public')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/submit', 'preview')).to.equal('/')
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/ja-JP/submit', 'preview')).to.equal('/ja-JP')
        expect(clinicHostLandingTarget(`${slug}.localhost`, clean, 'preview')).to.equal('/')
        expect(clinicHostLandingTarget(`${slug}.localhost`, `/ja-JP${clean}`, 'preview')).to.equal('/ja-JP')
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/favicon.ico', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/api/send', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/_nuxt/entry.js', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget('www.findadoc.jp', '/', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/', 'off')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/submit', 'off')).to.equal(undefined)
    })

    it('keeps locale prefixes aligned with the site catalog', () => {
        expect([...CLINIC_LANDING_LOCALE_PREFIXES].sort()).to.deep.equal(
            LOCALE_CODES.filter(code => code !== DEFAULT_LOCALE_CODE).sort()
        )
    })

    it('sends the breadcrumb, the clean path, and the shareable id to the subdomain', () => {
        const home = `https://${slug}.findadoc.jp/`
        expect(isClinicLandingPath(clean)).to.equal(true)
        expect(isClinicLandingPath(`/ja-JP${clean}/`)).to.equal(true)
        expect(isClinicLandingPath(`/clinic/tokyo/minato/${slug}--abc`)).to.equal(false)

        expect(clinicLandingRedirectTarget(`/clinic/tokyo/minato/${slug}`, 'preview', sites, 'www.findadoc.jp'))
            .to.equal(home)
        expect(clinicLandingRedirectTarget(`/clinic/tokyo/minato/${slug}--facility-1`, 'public', sites, 'www.findadoc.jp'))
            .to.equal(home)
        expect(clinicLandingRedirectTarget(`/clinic/tokyo/minato/${slug}--abc`, 'public', sites, 'www.findadoc.jp'))
            .to.equal(undefined)
        expect(clinicLandingRedirectTarget(`/ja-JP/clinic/osaka/kita/${slug}--facility-1?preview=1`, 'preview', sites, '127.0.0.1:3000'))
            .to.equal(`http://${slug}.localhost:3000/ja-JP?preview=1`)
        expect(clinicLandingRedirectTarget(`/clinic/${slug}--facility-1`, 'preview', sites, 'findadoc.jp'))
            .to.equal(home)
        expect(clinicLandingRedirectTarget(clean, 'preview', sites, 'www.findadoc.jp'))
            .to.equal(home)
        expect(clinicLandingRedirectTarget('/clinic/tokyo/minato/other--facility-1', 'public', sites, 'www.findadoc.jp'))
            .to.equal(home)
        expect(clinicLandingRedirectTarget('/clinic/tokyo/minato/other-clinic--abc', 'public', sites, 'www.findadoc.jp'))
            .to.equal(undefined)
        expect(clinicLandingRedirectTarget(`/clinic/tokyo/minato/${slug}--abc`, 'off', sites, 'www.findadoc.jp'))
            .to.equal(undefined)
    })

    it('stays a 404 until preview grants a cookie, and public skips the cookie', () => {
        expect(CLINIC_LANDING_MODE).to.equal('preview')
        expect(clinicLandingMode(undefined)).to.equal('off')
        expect(clinicLandingMode('off')).to.equal('off')
        expect(clinicLandingMode('true')).to.equal('preview')
        expect(clinicLandingMode('public')).to.equal('public')
        expect(clinicLandingAccess('off', '1', '1')).to.equal('deny')
        expect(clinicLandingAccess('preview', null, null)).to.equal('deny')
        expect(clinicLandingAccess('preview', '1', null)).to.equal('grant')
        expect(clinicLandingAccess('preview', null, '1')).to.equal('allow')
        expect(clinicLandingAccess('preview', '0', '1')).to.equal('revoke')
        expect(clinicLandingAccess('public', null, null)).to.equal('allow')
        expect(clinicLandingPreviewCookie('a=1; online_clinic_preview=1')).to.equal('1')
    })

    it('maps a clinic primary color onto the theme tokens', () => {
        expect(clinicThemeVars('#177A80')?.['--clinic-primary']).to.equal('23 122 128')
        expect(clinicThemeVars('#177A80')?.['--clinic-primary-dark']).to.not.equal('23 122 128')
        expect(clinicThemeVars('teal')).to.equal(undefined)
        expect(clinicThemeVars(null)).to.equal(undefined)
    })

    it('uses the clinic icon as the share image and keeps the landing out of the static sitemap', () => {
        expect(clinicLandingShareImage(sites[0]?.shareImagePath ?? '')).to.equal(
            `${SITE_ORIGIN}/clinic-landings/multilingual-online-clinic/hero.jpg`
        )
        expect(indexableMarketingPaths()).to.not.include(clean)
    })

    it('gives the showcase clinic an exact SPA fallback, not a /clinic wildcard', () => {
        const redirects = readFileSync(join(rootDir, 'public/_redirects'), 'utf8')
        const serve = readFileSync(join(rootDir, 'public/serve.json'), 'utf8')
        expect(redirects).to.match(new RegExp(`^${clean}\\s+/200\\.html\\s+200`, 'm'))
        expect(redirects).to.match(new RegExp(`^/:locale${clean}\\s+/200\\.html\\s+200`, 'm'))
        expect(serve).to.include(`"${clean}"`)
        const seedSource = readFileSync(join(rootDir, '../server/scripts/seed/clinicSiteContent.ts'), 'utf8')
        const seededSlugs = [...seedSource.matchAll(/^ +slug: '([^']+)',$/gm)].map(match => match[1])
        expect([...CLINIC_PREVIEW_SHELL_SLUGS]).to.deep.equal(seededSlugs)
    })
})

describe('clinic preview shells', () => {
    it('copies the SPA shell to the html path Amplify serves', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'clinic-shell-'))
        try {
            await writeFile(join(dir, '200.html'), '<html>shell</html>')
            await writeClinicPreviewShells(dir, 'multilingual-online-clinic', false)
            for (const relative of clinicPreviewShellPaths('multilingual-online-clinic')) {
                expect(await readFile(join(dir, relative), 'utf8')).to.equal('<html>shell</html>')
            }
            expect(clinicPreviewShellPaths('multilingual-online-clinic')).to.include(
                'ja-JP/clinic/multilingual-online-clinic.html'
            )
            expect(CLINIC_LANDING_LOCALE_PREFIXES).to.include('ja-JP')
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })

    it('leaves a public build\'s prerendered page alone', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'clinic-shell-'))
        try {
            await writeFile(join(dir, '200.html'), '<html>shell</html>')
            await writeClinicPreviewShells(dir, 'multilingual-online-clinic', true)
            let found = false
            try {
                await readFile(join(dir, 'clinic/multilingual-online-clinic.html'), 'utf8')
                found = true
            } catch {
                found = false
            }
            expect(found).to.equal(false)
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })
})

describe('turbo dev flags', () => {
    it('points pnpm dev at the local API when asked', () => {
        const env = devServerEnv({}, { localApi: true })
        expect(env.NUXT_USE_LOCAL_API).to.equal('true')
    })

    it('leaves the API target alone unless asked', () => {
        const env = devServerEnv({})
        expect(env.NUXT_USE_LOCAL_API).to.equal(undefined)
    })
})

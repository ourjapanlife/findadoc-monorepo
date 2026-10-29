import { expect } from 'chai'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_LOCALE_CODE, LOCALE_CODES } from '@/utils/localePath'
import {
    CLINIC_HOST_BOOTSTRAP,
    CLINIC_LANDING_LOCALE_PREFIXES,
    CLINIC_LANDING_MODE,
    CLINIC_PREVIEW_SHELL_SLUGS,
    clinicHostBookPath,
    clinicHostLandingTarget,
    clinicHostPagePath,
    clinicLandingAccess,
    clinicLandingHostSlug,
    clinicLandingMode,
    clinicLandingPath,
    clinicLandingPreviewFlag,
    clinicLandingRedirectTarget,
    clinicLandingShareImage,
    clinicLocalePrefix,
    clinicSiteFetchIsServer,
    clinicSubdomainHreflang,
    clinicSubdomainUrl,
    isClinicHostBookPage,
    isClinicHostDashboardPage,
    isClinicHostPage,
    isClinicHostSurface,
    isClinicLandingPath,
    markClinicHostReady,
    type HostedClinicRef
} from '@/utils/clinicLanding'
import { clinicPreviewShellPaths, writeClinicPreviewShells } from '@/utils/nuxt/clinicPreviewShell'
import { indexableMarketingPaths } from '@/utils/sitemap'
import { SITE_ORIGIN } from '@/utils/site'
import { clinicThemeVars } from '@/utils/clinicTheme'
import { clinicSiteSeeds } from '../../../../server/scripts/seed/clinicSiteContent'

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
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/book', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/ja-JP/book', 'preview')).to.equal(undefined)
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/book/extra', 'preview')).to.equal('/book')
        expect(clinicHostLandingTarget(`${slug}.localhost`, '/ja-JP/book/extra', 'preview')).to.equal('/ja-JP/book')
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

    it('hides the prerendered homepage on a clinic host until the clinic is ready', () => {
        expect(CLINIC_HOST_BOOTSTRAP).to.match(/^\(function \(\)/)
        expect(CLINIC_HOST_BOOTSTRAP).to.include('data-clinic-host')
        expect(CLINIC_HOST_BOOTSTRAP).to.include('visibility:hidden')
        expect(CLINIC_HOST_BOOTSTRAP).to.include('www')
        expect(CLINIC_HOST_BOOTSTRAP).to.include('findadoc.jp')

        const root = document.documentElement
        root.removeAttribute('data-clinic-host')
        root.removeAttribute('data-clinic-ready')
        markClinicHostReady()
        expect(root.hasAttribute('data-clinic-ready')).to.equal(false)

        root.setAttribute('data-clinic-host', slug)
        markClinicHostReady()
        expect(root.getAttribute('data-clinic-ready')).to.equal('')
        root.removeAttribute('data-clinic-host')
        root.removeAttribute('data-clinic-ready')
    })

    it('keeps locale prefixes aligned with the site catalog', () => {
        expect([...CLINIC_LANDING_LOCALE_PREFIXES].sort()).to.deep.equal(
            LOCALE_CODES.filter(code => code !== DEFAULT_LOCALE_CODE).sort()
        )
        expect(clinicLocalePrefix(DEFAULT_LOCALE_CODE)).to.equal('')
        expect(clinicLocalePrefix(undefined)).to.equal('')
        expect(clinicLocalePrefix('ja-JP')).to.equal('/ja-JP')
        expect(clinicLocalePrefix('xx-XX')).to.equal('')
        expect(clinicHostPagePath('/')).to.equal('/')
        expect(clinicHostPagePath('/ja-JP/')).to.equal('/ja-JP')
        expect(clinicHostPagePath('/ja-JP/submit')).to.equal('/ja-JP')
        expect(isClinicHostPage('/')).to.equal(true)
        expect(isClinicHostPage('/zh-CN')).to.equal(true)
        expect(isClinicHostPage('/zh-CN/')).to.equal(true)
        expect(isClinicHostPage('/submit')).to.equal(false)
        expect(isClinicHostPage(clean)).to.equal(false)
        expect(isClinicHostBookPage('/book')).to.equal(true)
        expect(isClinicHostBookPage('/ja-JP/book')).to.equal(true)
        expect(isClinicHostDashboardPage('/dashboard')).to.equal(true)
        expect(isClinicHostDashboardPage('/ja-JP/dashboard')).to.equal(true)
        expect(isClinicHostSurface('/dashboard')).to.equal(true)
        expect(isClinicHostDashboardPage('/dashboard/x')).to.equal(false)
        expect(isClinicHostBookPage('/book/x')).to.equal(false)
        expect(isClinicHostSurface('/book')).to.equal(true)
        expect(isClinicHostSurface('/')).to.equal(true)
        expect(isClinicHostSurface('/submit')).to.equal(false)
        expect(clinicHostBookPath('/ja-JP/submit')).to.equal('/ja-JP/book')
        expect(clinicHostBookPath('/')).to.equal('/book')
    })

    it('builds the clinic hostname from the request host', () => {
        expect(clinicSubdomainUrl(slug)).to.equal(`https://${slug}.findadoc.jp/`)
        expect(clinicSubdomainUrl(slug, { requestHost: 'www.findadoc.jp' })).to.equal(`https://${slug}.findadoc.jp/`)
        expect(clinicSubdomainUrl(slug, { localeCode: 'ja-JP', requestHost: 'WWW.FINDADOC.JP' }))
            .to.equal(`https://${slug}.findadoc.jp/ja-JP`)
        expect(clinicSubdomainUrl(slug, { localeCode: DEFAULT_LOCALE_CODE, query: '?preview=1' }))
            .to.equal(`https://${slug}.findadoc.jp/?preview=1`)
        expect(clinicSubdomainUrl(slug, { requestHost: 'localhost:3001' })).to.equal(`http://${slug}.localhost:3001/`)
        expect(clinicSubdomainUrl(slug, { requestHost: '127.0.0.1' })).to.equal(`http://${slug}.localhost:3000/`)
        expect(clinicSubdomainUrl(slug, { requestHost: `${slug}.localhost:3000`, localeCode: 'ja-JP' }))
            .to.equal(`http://${slug}.localhost:3000/ja-JP`)

        const hreflang = clinicSubdomainHreflang(slug, 'www.findadoc.jp')
        expect(hreflang.map(link => link.hreflang)).to.deep.equal([...LOCALE_CODES, 'x-default'])
        expect(hreflang.find(link => link.hreflang === 'x-default')?.href).to.equal(`https://${slug}.findadoc.jp/`)
        expect(hreflang.find(link => link.hreflang === 'ja-JP')?.href).to.equal(`https://${slug}.findadoc.jp/ja-JP`)
        expect(new Set(hreflang.map(link => link.key)).size).to.equal(hreflang.length)
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
        expect(clinicLandingMode('true')).to.equal('off')
        expect(clinicLandingMode('preview')).to.equal('preview')
        expect(clinicLandingMode('public')).to.equal('public')
        expect(clinicLandingAccess('off', '1', '1')).to.equal('deny')
        expect(clinicLandingAccess('preview', null, null)).to.equal('deny')
        expect(clinicLandingAccess('preview', '1', null)).to.equal('grant')
        expect(clinicLandingAccess('preview', 1, null)).to.equal('grant')
        expect(clinicLandingAccess('preview', true, null)).to.equal('grant')
        expect(clinicLandingAccess('preview', '"1"', null)).to.equal('grant')
        expect(clinicLandingAccess('preview', null, '1')).to.equal('allow')
        expect(clinicLandingAccess('preview', null, 1)).to.equal('allow')
        expect(clinicLandingAccess('preview', null, '"1"')).to.equal('allow')
        expect(clinicLandingAccess('preview', '0', '1')).to.equal('revoke')
        expect(clinicLandingAccess('preview', 0, '1')).to.equal('revoke')
        expect(clinicLandingAccess('public', null, null)).to.equal('allow')
        expect(clinicLandingPreviewFlag(undefined, '?preview=1')).to.equal('1')
        expect(clinicLandingPreviewFlag(undefined, '?preview=0')).to.equal('0')
        expect(clinicLandingPreviewFlag('1', '?preview=0')).to.equal('1')
        expect(clinicSiteFetchIsServer('preview', `${slug}.findadoc.jp`)).to.equal(false)
        expect(clinicSiteFetchIsServer('public', `${slug}.findadoc.jp`)).to.equal(false)
        expect(clinicSiteFetchIsServer('public', 'www.findadoc.jp')).to.equal(true)
        expect(clinicSiteFetchIsServer('preview', 'www.findadoc.jp')).to.equal(false)
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
        expect([...CLINIC_PREVIEW_SHELL_SLUGS]).to.deep.equal(clinicSiteSeeds.map(site => site.slug))
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

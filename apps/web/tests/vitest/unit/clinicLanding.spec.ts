import { expect } from 'chai'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOCALE_CODE, LOCALE_CODES } from '@/utils/localePath'
import {
    CLINIC_LANDING_LOCALE_PREFIXES,
    clinicHostLandingTarget,
    clinicLandingAccess,
    clinicLandingHostSlug,
    CLINIC_LANDING_MODE,
    clinicLandingMode,
    clinicLandingPath,
    clinicLandingPreviewCookie,
    clinicLandingRedirectTarget,
    clinicLandingShareImage,
    isClinicLandingPath,
    type HostedClinicRef
} from '@/utils/clinicLanding'
import { indexableMarketingPaths } from '@/utils/sitemap'
import { SITE_ORIGIN } from '@/utils/site'
import { clinicSiteSeeds } from '../../../../server/scripts/seed/clinicSiteContent'
import { clinicThemeVars } from '@/utils/clinicTheme'

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
        expect(clinicLandingRedirectTarget(`/clinic/tokyo/minato/${slug}--abc`, 'public', sites, 'www.findadoc.jp'))
            .to.equal(home)
        expect(clinicLandingRedirectTarget(`/ja-JP/clinic/osaka/kita/${slug}--abc?preview=1`, 'preview', sites, '127.0.0.1:3000'))
            .to.equal(`http://${slug}.localhost:3000/ja-JP?preview=1`)
        expect(clinicLandingRedirectTarget(`/clinic/${slug}--abc`, 'preview', sites, 'findadoc.jp'))
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

    it('seeds the showcase clinic without a directory facility', () => {
        const site = clinicSiteSeeds.find(item => item.slug === slug)
        expect(site?.facility_id).to.equal(null)
        expect(site?.status).to.equal('preview')
        expect(site?.theme.primary).to.equal('#177A80')
        expect(clinicThemeVars('#177A80')?.['--clinic-primary']).to.equal('23 122 128')
        expect(clinicThemeVars('#177A80')?.['--clinic-primary-dark']).to.not.equal('23 122 128')
        expect(clinicThemeVars('teal')).to.equal(undefined)
        expect(clinicThemeVars(null)).to.equal(undefined)
        expect(site?.copy['ja-JP']?.name).to.equal('多言語オンラインクリニック')
        expect(site?.copy['fr-FR']?.book).to.not.equal(site?.copy['en-US']?.book)
        for (const copy of Object.values(site?.copy ?? {})) {
            expect(copy.doctorCopy).to.have.length(site?.doctors.length ?? -1)
            expect(copy.name.length).to.be.greaterThan(0)
            expect(copy.description.length).to.be.greaterThan(0)
        }
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
    })
})

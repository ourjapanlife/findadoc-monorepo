import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, onMounted } from 'vue'
import type { ClinicBranding } from '@findadoc/graphql'
import ClinicBrandedLayout from '~/layouts/clinic-branded.vue'
import { useClinicBrandedChrome, useClinicBranding } from '~/composables/useClinicBranding'
import { CLINIC_BRANDING_FIELDS, clinicLogoSrc, clinicWordmark } from '~/utils/booking/clinicBranding'
import { SITE_ORIGIN } from '~/utils/site'

const SHOWCASE: ClinicBranding = {
    displayName: 'Multilingual Online Clinic',
    wordmark: { ja: '多言語オンラインクリニック', en: 'Multilingual Online Clinic' },
    logoPath: null,
    primary: '#177A80'
}

describe('clinicWordmark', () => {
    it('shows the Japanese wordmark on Japanese pages and the English one everywhere else', () => {
        expect(clinicWordmark(SHOWCASE, 'ja_JP')).toBe('多言語オンラインクリニック')
        expect(clinicWordmark(SHOWCASE, 'ja')).toBe('多言語オンラインクリニック')
        expect(clinicWordmark(SHOWCASE, 'en_US')).toBe('Multilingual Online Clinic')
        expect(clinicWordmark(SHOWCASE, 'vi_VN')).toBe('Multilingual Online Clinic')
    })

    it('falls back to the other language, then the display name', () => {
        expect(clinicWordmark({ ...SHOWCASE, wordmark: { ja: '日本語だけ', en: null } }, 'fr_FR')).toBe('日本語だけ')
        expect(clinicWordmark({ ...SHOWCASE, wordmark: null, displayName: 'Sakura' }, 'ja_JP')).toBe('Sakura')
    })
})

describe('clinicLogoSrc', () => {
    it('uses a same-origin static path and nothing else', () => {
        expect(clinicLogoSrc({ ...SHOWCASE, logoPath: '/clinic-landings/a/logo.svg' })).toBe('/clinic-landings/a/logo.svg')
        for (const logoPath of ['//evil.example/logo.png', 'javascript:alert(1)', 'https://x.example/a.png', null]) {
            expect(clinicLogoSrc({ ...SHOWCASE, logoPath })).toBeNull()
        }
    })

    it('asks for every branding field the layout reads', () => {
        for (const field of ['displayName', 'wordmark', 'ja', 'en', 'logoPath', 'primary']) {
            expect(CLINIC_BRANDING_FIELDS).toContain(field)
        }
    })
})

describe('clinic-branded layout', () => {
    afterEach(() => {
        useClinicBrandedChrome().value = null
    })

    const page = () => h('p', { 'data-testid': 'branded-page' }, 'page')

    it('is the Find a Doc layout until the page names a branded clinic', async () => {
        const wrapper = await mountSuspended(ClinicBrandedLayout, { slots: { default: page } })

        expect(wrapper.find('[data-testid="top-nav"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="clinic-branded-header"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="clinic-branded-footer"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="branded-page"]').exists()).toBe(true)
    })

    it('swaps in the clinic wordmark, colour, and credit footer without remounting the page', async () => {
        let pageMounts = 0
        const Page = defineComponent({
            setup() {
                onMounted(() => {
                    pageMounts += 1
                })
                return page
            }
        })
        const wrapper = await mountSuspended(ClinicBrandedLayout, { slots: { default: () => h(Page) } })
        useClinicBranding().show({ branding: SHOWCASE, staff: false, canSwitchClinic: false, localeSelector: true })
        await nextTick()

        expect(wrapper.find('[data-testid="top-nav"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="clinic-branded-wordmark"]').text()).toBe('Multilingual Online Clinic')
        expect(wrapper.find('[data-testid="clinic-branded"]').classes()).toContain('clinic-theme')
        expect(wrapper.find('[data-testid="clinic-branded-credit"]').attributes('href')).toBe(SITE_ORIGIN)
        expect(wrapper.find('[data-testid="clinic-branded-cookie-settings"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="locale-selector"]').exists()).toBe(true)
        // A patient page has no account controls.
        expect(wrapper.find('[data-testid="clinic-branded-sign-out"]').exists()).toBe(false)
        expect(pageMounts).toBe(1)
    })

    it('shows the logo instead of the wordmark when the clinic has one', async () => {
        const wrapper = await mountSuspended(ClinicBrandedLayout, { slots: { default: page } })
        useClinicBranding().show({
            branding: { ...SHOWCASE, logoPath: '/clinic-landings/a/logo.svg' },
            staff: false,
            canSwitchClinic: false,
            localeSelector: false
        })
        await nextTick()

        const logo = wrapper.find('[data-testid="clinic-branded-logo"]')
        expect(logo.attributes('src')).toBe('/clinic-landings/a/logo.svg')
        expect(logo.attributes('alt')).toBe('Multilingual Online Clinic')
        expect(wrapper.find('[data-testid="clinic-branded-wordmark"]').exists()).toBe(false)
    })

    it('keeps the next page\'s branding when the previous page clears late', () => {
        const previous = useClinicBranding()
        const next = useClinicBranding()
        previous.show({ branding: SHOWCASE, staff: false, canSwitchClinic: false, localeSelector: false })
        next.show({ branding: { ...SHOWCASE, displayName: 'Next' }, staff: true, canSwitchClinic: true, localeSelector: true })
        previous.clear()

        expect(useClinicBrandedChrome().value?.chrome.branding.displayName).toBe('Next')
        next.clear()
        expect(useClinicBrandedChrome().value).toBeNull()
    })
})

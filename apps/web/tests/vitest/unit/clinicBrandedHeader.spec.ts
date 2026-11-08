import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import type { ClinicBranding } from '@findadoc/graphql'
import ClinicBrandedHeader from '~/components/clinic/ClinicBrandedHeader.vue'
import type { ClinicBrandedChrome } from '~/composables/useClinicBranding'

const auth = vi.hoisted(() => ({ state: { isLoggedIn: true }, logout: vi.fn() }))

vi.mock('~/stores/authStore', () => ({
    useAuthStore: () => auth.state
}))

const SHOWCASE: ClinicBranding = {
    displayName: 'Multilingual Online Clinic',
    wordmark: { ja: '多言語オンラインクリニック', en: 'Multilingual Online Clinic' },
    logoPath: null,
    primary: '#177A80'
}

function chrome(overrides: Partial<ClinicBrandedChrome>): ClinicBrandedChrome {
    return { branding: SHOWCASE, staff: true, canSwitchClinic: false, localeSelector: true, ...overrides }
}

describe('ClinicBrandedHeader on the clinic dashboard (online consult v2 §4)', () => {
    beforeEach(() => {
        auth.state = reactive({ isLoggedIn: true, logout: auth.logout })
        auth.logout.mockReset()
        auth.logout.mockResolvedValue(undefined)
    })

    it('keeps sign-out for a signed-in clinic member, and signs out on click', async () => {
        const wrapper = await mountSuspended(ClinicBrandedHeader, { props: { chrome: chrome({}) } })

        const signOut = wrapper.find('[data-testid="clinic-branded-sign-out"]')
        expect(signOut.exists()).toBe(true)
        expect(wrapper.find('[data-testid="clinic-branded-switch-clinic"]').exists()).toBe(false)
        await signOut.trigger('click')
        expect(auth.logout).toHaveBeenCalledTimes(1)
    })

    it('links back to the clinic picker when the account can switch clinics', async () => {
        const wrapper = await mountSuspended(ClinicBrandedHeader, {
            props: { chrome: chrome({ canSwitchClinic: true }) }
        })

        const link = wrapper.find('[data-testid="clinic-branded-switch-clinic"]')
        expect(link.exists()).toBe(true)
        expect(link.attributes('href')).toMatch(/\/clinic-dashboard$/)
    })

    it('shows no account controls on a patient page or when signed out', async () => {
        const patient = await mountSuspended(ClinicBrandedHeader, {
            props: { chrome: chrome({ staff: false, canSwitchClinic: true }) }
        })
        expect(patient.find('[data-testid="clinic-branded-sign-out"]').exists()).toBe(false)
        expect(patient.find('[data-testid="clinic-branded-switch-clinic"]').exists()).toBe(false)

        auth.state.isLoggedIn = false
        const signedOut = await mountSuspended(ClinicBrandedHeader, {
            props: { chrome: chrome({ canSwitchClinic: true }) }
        })
        expect(signedOut.find('[data-testid="clinic-branded-sign-out"]').exists()).toBe(false)
    })
})

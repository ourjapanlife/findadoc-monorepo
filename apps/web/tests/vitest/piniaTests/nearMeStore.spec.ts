import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEAR_ME_STATUS, useNearMeStore } from '~/stores/nearMeStore'

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2

type Success = (position: { coords: { latitude: number, longitude: number } }) => void
type Failure = (error: { code: number, PERMISSION_DENIED: number }) => void

function stubGeolocation(answer: (success: Success, failure: Failure) => void) {
    const getCurrentPosition = vi.fn<(success: Success, failure: Failure, options?: PositionOptions) => void>(
        (success, failure) => answer(success, failure)
    )
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
    return getCurrentPosition
}

function stubPermission(state: PermissionState) {
    const permission = { state, addEventListener: vi.fn() }
    vi.stubGlobal('navigator', {
        ...navigator,
        geolocation: { getCurrentPosition: vi.fn() },
        permissions: { query: vi.fn(async () => permission) }
    })
}

describe('nearMeStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.stubGlobal('isSecureContext', true)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('holds the position in memory once the browser gives one', async () => {
        stubGeolocation(success => success({ coords: { latitude: 35.68, longitude: 139.76 } }))
        const store = useNearMeStore()

        await expect(store.locate()).resolves.toEqual({ latitude: 35.68, longitude: 139.76 })
        expect(store.status).toBe(NEAR_ME_STATUS.LOCATED)
        expect(store.position).toEqual({ latitude: 35.68, longitude: 139.76 })
    })

    it('asks for a coarse, recent position rather than a fresh precise one', async () => {
        const getCurrentPosition = stubGeolocation(success => success({ coords: { latitude: 1, longitude: 1 } }))
        await useNearMeStore().locate()

        expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ enableHighAccuracy: false })
    })

    it('reports a refusal as denied and keeps no position', async () => {
        stubGeolocation((success, failure) => failure({ code: PERMISSION_DENIED, PERMISSION_DENIED }))
        const store = useNearMeStore()

        await expect(store.locate()).resolves.toBeUndefined()
        expect(store.status).toBe(NEAR_ME_STATUS.DENIED)
        expect(store.position).toBeUndefined()
    })

    it('reports no signal as unavailable, not as denied', async () => {
        stubGeolocation((success, failure) => failure({ code: POSITION_UNAVAILABLE, PERMISSION_DENIED }))
        const store = useNearMeStore()
        await store.locate()

        expect(store.status).toBe(NEAR_ME_STATUS.UNAVAILABLE)
    })

    it('does not leave the position in localStorage or sessionStorage', async () => {
        stubGeolocation(success => success({ coords: { latitude: 35.68, longitude: 139.76 } }))
        localStorage.clear()
        sessionStorage.clear()
        await useNearMeStore().locate()

        expect(JSON.stringify({ ...localStorage })).not.toContain('35.68')
        expect(JSON.stringify({ ...sessionStorage })).not.toContain('35.68')
    })

    it('reads a granted permission without asking for a position', async () => {
        stubPermission('granted')
        const store = useNearMeStore()
        await store.checkPermission()

        expect(store.permissionGranted).toBe(true)
        expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled()
    })

    it('shows a site-level block as denied before any tap', async () => {
        stubPermission('denied')
        const store = useNearMeStore()
        await store.checkPermission()

        expect(store.status).toBe(NEAR_ME_STATUS.DENIED)
    })

    it('is unsupported on a page that is not secure', async () => {
        vi.stubGlobal('isSecureContext', false)
        const store = useNearMeStore()
        await store.checkPermission()

        expect(store.isSupported).toBe(false)
    })
})

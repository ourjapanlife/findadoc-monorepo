import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import RouteLoadingIndicator from '~/components/common/RouteLoadingIndicator.vue'
import { createSlowNavigationSignal, SLOW_NAVIGATION_MS } from '~/utils/slowNavigation'

describe('createSlowNavigationSignal', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('marks a navigation slow once it passes the delay', () => {
        const onChange = vi.fn()
        const signal = createSlowNavigationSignal(onChange)

        signal.start()
        vi.advanceTimersByTime(SLOW_NAVIGATION_MS - 1)
        expect(onChange).not.toHaveBeenCalledWith(true)

        vi.advanceTimersByTime(1)
        expect(onChange).toHaveBeenLastCalledWith(true)

        signal.stop()
        expect(onChange).toHaveBeenLastCalledWith(false)
    })

    it('never marks a fast navigation slow', () => {
        const onChange = vi.fn()
        const signal = createSlowNavigationSignal(onChange)

        signal.start()
        vi.advanceTimersByTime(SLOW_NAVIGATION_MS / 2)
        signal.stop()
        vi.advanceTimersByTime(SLOW_NAVIGATION_MS * 2)

        expect(onChange).not.toHaveBeenCalledWith(true)
    })

    it('keeps the clock running when the start hook fires again mid-navigation', () => {
        const onChange = vi.fn()
        const signal = createSlowNavigationSignal(onChange)

        signal.start()
        vi.advanceTimersByTime(SLOW_NAVIGATION_MS - 100)
        signal.start()
        vi.advanceTimersByTime(100)
        expect(onChange).toHaveBeenLastCalledWith(true)
    })

    it('starts a fresh clock for the next navigation', () => {
        const onChange = vi.fn()
        const signal = createSlowNavigationSignal(onChange)

        signal.start()
        signal.stop()
        signal.start()
        vi.advanceTimersByTime(SLOW_NAVIGATION_MS - 1)
        expect(onChange).not.toHaveBeenCalledWith(true)

        vi.advanceTimersByTime(1)
        expect(onChange).toHaveBeenLastCalledWith(true)
    })
})

describe('RouteLoadingIndicator', () => {
    const mountIndicator = (props: { progress: number, loading: boolean, slow: boolean }) =>
        mount(RouteLoadingIndicator, {
            props,
            global: {
                plugins: [createI18n({
                    legacy: false,
                    locale: 'en-US',
                    messages: { 'en-US': { common: { loading: 'Loading' } } }
                })],
                stubs: { SvgHeartIcon: true }
            }
        })

    it('shows the bar at the current progress while loading', () => {
        const wrapper = mountIndicator({ progress: 40, loading: true, slow: false })
        const bar = wrapper.get('[data-testid="route-loading-bar"]')

        expect(bar.attributes('style')).toContain('width: 40%')
        expect(bar.classes()).toContain('opacity-100')
        expect(wrapper.find('[data-testid="route-loading-pill"]').exists()).toBe(false)
    })

    it('adds the Loading pill when the navigation is slow', () => {
        const wrapper = mountIndicator({ progress: 60, loading: true, slow: true })

        expect(wrapper.get('[data-testid="route-loading-pill"]').text()).toContain('Loading')
        expect(wrapper.find('[role="status"]').exists()).toBe(true)
    })

    it('hides everything when nothing is loading', () => {
        const wrapper = mountIndicator({ progress: 0, loading: false, slow: true })

        expect(wrapper.get('[data-testid="route-loading-bar"]').classes()).toContain('opacity-0')
        expect(wrapper.find('[data-testid="route-loading-pill"]').exists()).toBe(false)
    })
})

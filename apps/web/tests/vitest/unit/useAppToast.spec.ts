import { flushPromises, mount } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import AppToast from '~/components/common/AppToast.vue'
import { appToastManager, useAppToast, type AppToast as ToastApi } from '~/composables/useAppToast'

const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {
        'en-US': {
            toast: {
                successTitle: 'Done',
                warningTitle: 'Check this',
                dangerTitle: 'Something went wrong',
                infoTitle: 'Note',
                dismiss: 'Dismiss',
                announceLabel: 'Notification',
                viewportLabel: 'Notifications ({hotkey})'
            }
        }
    }
})

const Host = defineComponent({
    components: { AppToast },
    setup() {
        const toast = useAppToast()
        return { toast }
    },
    template: '<AppToast />'
})

function mountedToasts(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('li[data-status]')]
}

function requireToast(items: HTMLElement[], index: number): HTMLElement {
    const item = items[index]
    if (item === undefined) {
        throw new Error(`missing toast at ${index}`)
    }
    return item
}

describe('useAppToast', () => {
    let wrapper: ReturnType<typeof mount> | undefined

    afterEach(() => {
        appToastManager.close()
        wrapper?.unmount()
        wrapper = undefined
        vi.useRealTimers()
    })

    function mountHost() {
        wrapper = mount(Host, {
            attachTo: document.body,
            global: { plugins: [i18n] }
        })
        return wrapper.vm as unknown as { toast: ToastApi }
    }

    async function showAndSettle(show: () => void) {
        show()
        await nextTick()
        await flushPromises()
    }

    it('gives a one-line message a status title and keeps the sentence', async () => {
        const { toast } = mountHost()
        await showAndSettle(() => {
            toast.success('Your submission has been recorded.')
        })

        const item = requireToast(mountedToasts(), 0)
        expect(item.dataset.status).toBe('success')
        expect(item.dataset.swipeDirection).toBe('right')
        expect(item.textContent).toContain('Done')
        expect(item.textContent).toContain('Your submission has been recorded.')
        expect(item.querySelectorAll('p').length).toBeGreaterThan(1)
    })

    it('shows a custom title, the status word, and an action', async () => {
        const onView = vi.fn()
        const { toast } = mountHost()
        await showAndSettle(() => {
            toast.success({
                title: 'Clinic saved',
                description: 'The English name is live.',
                action: {
                    label: 'View',
                    altText: 'View the saved clinic',
                    onClick: onView
                },
                className: 'e2e-moderation-success-toast'
            })
        })

        const item = requireToast(mountedToasts(), 0)
        expect(item.classList.contains('e2e-moderation-success-toast')).toBe(true)
        expect(item.textContent).toContain('Done')
        expect(item.textContent).toContain('Clinic saved')
        expect(item.textContent).toContain('The English name is live.')

        const action = [...item.querySelectorAll('button')].find(button => button.textContent?.includes('View'))
        expect(action).toBeTruthy()
        action?.click()
        expect(onView).toHaveBeenCalledOnce()
    })

    it('stacks more than one toast and dismisses the one that was closed', async () => {
        const { toast } = mountHost()
        await showAndSettle(() => {
            toast.warning('No language chosen')
            toast.error('No first name entered')
        })

        const items = mountedToasts()
        const first = requireToast(items, 0)
        const second = requireToast(items, 1)
        expect(items.map(item => item.dataset.status)).toEqual(['danger', 'warning'])
        expect(first.textContent).toContain('Something went wrong')
        expect(first.textContent).toContain('No first name entered')
        expect(second.textContent).toContain('Check this')

        const dismiss = first.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')
        dismiss?.click()
        await nextTick()
        await flushPromises()

        const remaining = mountedToasts().filter(item => item.dataset.state !== 'closed')
        expect(remaining).toHaveLength(1)
        expect(requireToast(remaining, 0).textContent).toContain('No language chosen')
    })

    it('closes every toast from dismiss()', async () => {
        const { toast } = mountHost()
        let id = ''
        await showAndSettle(() => {
            id = toast.info('This submission is already approved.')
            toast.info('A second note.')
        })

        toast.dismiss(id)
        await nextTick()
        await flushPromises()
        const open = mountedToasts().filter(item => item.dataset.state !== 'closed')
        expect(open).toHaveLength(1)

        toast.dismiss()
        await nextTick()
        await flushPromises()
        const stillOpen = mountedToasts().filter(item => item.dataset.state !== 'closed')
        expect(stillOpen).toHaveLength(0)
    })

    it('closes itself after the short duration', async () => {
        vi.useFakeTimers()
        const { toast } = mountHost()
        await showAndSettle(() => {
            toast.success({
                title: 'Saved',
                description: 'The clinic was updated.',
                duration: 4000
            })
        })
        expect(document.body.textContent).toContain('The clinic was updated.')

        await vi.advanceTimersByTimeAsync(4000)
        await flushPromises()

        const stillOpen = mountedToasts().filter(item => item.dataset.state !== 'closed')
        expect(stillOpen).toHaveLength(0)
    })

    it('renders the viewport on the server with no toast', async () => {
        const suspended = await mountSuspended(AppToast)
        expect(suspended.html()).toContain('role="region"')
        expect(suspended.html()).not.toContain('data-status')
    })

    it('names the viewport for keyboard users', () => {
        mountHost()
        const region = document.querySelector('[role="region"]')
        expect(region?.getAttribute('aria-label')).toContain('F8')
    })
})

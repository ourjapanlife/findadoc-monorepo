import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ChipTag from '~/components/common/ChipTag.vue'

const longLabel = 'International health insurance'

class ResizeObserverStub {
    observe() {
        return undefined
    }

    unobserve() {
        return undefined
    }

    disconnect() {
        return undefined
    }
}

function setOverflow(element: HTMLElement, overflowing: boolean) {
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 100 })
    Object.defineProperty(element, 'scrollWidth', { configurable: true, value: overflowing ? 240 : 100 })
}

describe('ChipTag', () => {
    it('keeps the tooltip closed when the label fits', async () => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub)
        const wrapper = mount(ChipTag, {
            props: { label: longLabel },
            attachTo: document.body
        })

        const trigger = wrapper.get('button')
        setOverflow(trigger.get('span').element, false)

        await trigger.trigger('click')

        expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
        wrapper.unmount()
    })

    it('shows the full label in a tooltip after a tap when the label is cut off', async () => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub)
        const wrapper = mount(ChipTag, {
            props: { label: longLabel },
            attachTo: document.body
        })

        const trigger = wrapper.get('button')
        expect(trigger.text()).toBe(longLabel)
        expect(trigger.find('span').classes()).toContain('truncate')
        setOverflow(trigger.get('span').element, true)

        await trigger.trigger('click')

        const tooltip = document.body.querySelector('[role="tooltip"]')
        expect(tooltip?.textContent).toContain(longLabel)

        await trigger.trigger('click')
        expect(document.body.querySelector('[role="tooltip"]')).toBeNull()

        wrapper.unmount()
    })
})

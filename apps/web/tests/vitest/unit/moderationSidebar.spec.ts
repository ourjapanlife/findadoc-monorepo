import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import ModLeftNavbar from '~/components/moderation-panel/ModLeftNavbar.vue'
import {
    MODERATION_SIDEBAR_COLLAPSED_KEY,
    readModerationSidebarCollapsed,
    writeModerationSidebarCollapsed
} from '~/utils/moderationSidebar'

function memoryStorage(): Storage {
    const values = new Map<string, string>()
    return {
        get length() {
            return values.size
        },
        clear: () => values.clear(),
        getItem: key => values.get(key) ?? null,
        key: index => [...values.keys()][index] ?? null,
        removeItem: key => values.delete(key),
        setItem: (key, value) => values.set(key, value)
    }
}

describe('moderation sidebar collapsed preference', () => {
    it('starts expanded when nothing is stored', () => {
        expect(readModerationSidebarCollapsed(memoryStorage())).toBe(false)
    })

    it('remembers a collapsed choice across a reload', () => {
        const storage = memoryStorage()
        writeModerationSidebarCollapsed(true, storage)
        expect(storage.getItem(MODERATION_SIDEBAR_COLLAPSED_KEY)).toBe('true')
        expect(readModerationSidebarCollapsed(storage)).toBe(true)
    })

    it('remembers opening the sidebar again', () => {
        const storage = memoryStorage()
        writeModerationSidebarCollapsed(true, storage)
        writeModerationSidebarCollapsed(false, storage)
        expect(readModerationSidebarCollapsed(storage)).toBe(false)
    })

    it('collapses from the dock control and keeps that choice', async () => {
        localStorage.removeItem(MODERATION_SIDEBAR_COLLAPSED_KEY)
        const i18n = createI18n({
            legacy: false,
            locale: 'en',
            messages: {
                en: {
                    topNav: { myPage: 'My Page' },
                    modDashboardLeftNav: {
                        collapse: 'Collapse sidebar',
                        expand: 'Expand sidebar'
                    }
                }
            }
        })
        const wrapper = mount(ModLeftNavbar, {
            global: {
                plugins: [i18n],
                stubs: { MyPageAccessPanel: true }
            }
        })

        const button = wrapper.get('[data-testid="mod-sidebar-collapse"]')
        expect(button.attributes('aria-label')).toBe('Collapse sidebar')
        expect(button.attributes('aria-expanded')).toBe('true')
        expect(wrapper.get('aside').classes()).toContain('md:w-80')

        await button.trigger('click')

        expect(button.attributes('aria-label')).toBe('Expand sidebar')
        expect(button.attributes('aria-expanded')).toBe('false')
        expect(wrapper.get('aside').classes()).toContain('md:w-16')
        expect(localStorage.getItem(MODERATION_SIDEBAR_COLLAPSED_KEY)).toBe('true')
    })

    it('stays expanded when storage is unavailable', () => {
        const storage = {
            getItem: () => {
                throw new Error('blocked')
            },
            setItem: () => {
                throw new Error('blocked')
            }
        }
        expect(readModerationSidebarCollapsed(storage)).toBe(false)
        expect(() => writeModerationSidebarCollapsed(true, storage)).not.toThrow()
    })
})

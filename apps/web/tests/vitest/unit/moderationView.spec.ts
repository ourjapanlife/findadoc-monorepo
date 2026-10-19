import { describe, expect, it } from 'vitest'
import {
    hidesModerationListTopbar,
    isModerationSettingsView
} from '~/utils/moderationView'

describe('my-page view', () => {
    it('opens an empty my-page on the account page', () => {
        expect(isModerationSettingsView(undefined)).toBe(true)
        expect(isModerationSettingsView('')).toBe(true)
        expect(isModerationSettingsView('settings')).toBe(true)
        expect(hidesModerationListTopbar('')).toBe(true)
        expect(hidesModerationListTopbar('settings')).toBe(true)
    })

    it('keeps a moderation list on its own view', () => {
        expect(isModerationSettingsView('submissions')).toBe(false)
        expect(hidesModerationListTopbar('submissions')).toBe(false)
        expect(hidesModerationListTopbar('facilities')).toBe(false)
    })
})

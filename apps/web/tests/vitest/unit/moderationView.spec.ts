import { describe, expect, it } from 'vitest'
import {
    hidesModerationListTopbar,
    isModerationOverviewView,
    isModerationSettingsView,
    moderationQueueDestination
} from '~/utils/moderationView'

describe('moderation dashboard view', () => {
    it('opens an empty my-page on the queue overview', () => {
        expect(isModerationOverviewView(undefined)).toBe(true)
        expect(isModerationOverviewView('')).toBe(true)
        expect(isModerationSettingsView('')).toBe(false)
        expect(hidesModerationListTopbar('')).toBe(true)
    })

    it('keeps settings as its own destination', () => {
        expect(isModerationSettingsView('settings')).toBe(true)
        expect(isModerationOverviewView('settings')).toBe(false)
        expect(hidesModerationListTopbar('submissions')).toBe(false)
    })

    it('sends each waiting card into the list already filtered', () => {
        expect(moderationQueueDestination('newSubmissions')).toEqual({
            view: 'submissions',
            submissionTab: 'NEW',
            licenseReview: false
        })
        expect(moderationQueueDestination('forReview')).toEqual({
            view: 'submissions',
            submissionTab: 'FOR_REVIEW',
            licenseReview: false
        })
        expect(moderationQueueDestination('licenseReview')).toEqual({
            view: 'healthcare-professionals',
            submissionTab: null,
            licenseReview: true
        })
    })
})

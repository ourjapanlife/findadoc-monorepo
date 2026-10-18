/** Query value for the moderation dashboard. An empty view is the queue overview. */
export function moderationViewQuery(view: unknown): string {
    return typeof view === 'string' ? view : ''
}

export function isModerationOverviewView(view: unknown): boolean {
    return moderationViewQuery(view) === ''
}

export function isModerationSettingsView(view: unknown): boolean {
    return moderationViewQuery(view) === 'settings'
}

/** The list search and status tabs stay off the overview and the settings page. */
export function hidesModerationListTopbar(view: unknown): boolean {
    return isModerationOverviewView(view) || isModerationSettingsView(view)
}

export type ModerationQueueCard = 'newSubmissions' | 'forReview' | 'licenseReview'

export interface ModerationQueueDestination {
    view: 'submissions' | 'healthcare-professionals'
    submissionTab: 'NEW' | 'FOR_REVIEW' | null
    licenseReview: boolean
}

export function moderationQueueDestination(card: ModerationQueueCard): ModerationQueueDestination {
    switch (card) {
        case 'newSubmissions':
            return { view: 'submissions', submissionTab: 'NEW', licenseReview: false }
        case 'forReview':
            return { view: 'submissions', submissionTab: 'FOR_REVIEW', licenseReview: false }
        case 'licenseReview':
            return { view: 'healthcare-professionals', submissionTab: null, licenseReview: true }
    }
}

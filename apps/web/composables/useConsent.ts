import { useRuntimeConfig, useState } from '#imports'
import {
    CONSENT_SETTINGS_HASH,
    E2E_GOOGLE_TAG_IDS_KEY,
    denyConsent,
    grantConsent,
    parseConsentCookie,
    type ConsentChoice
} from '~/utils/consent'

/**
 * Google tag ids for this build. Empty in dev, so there is nothing to consent to.
 * In testing mode an e2e override in localStorage wins, even over configured ids.
 */
export function useGoogleTagIds(): string[] {
    const config = useRuntimeConfig().public
    const ids = [...(config.googleTagIds ?? [])]
    if (config.isTestingMode && import.meta.client) {
        try {
            const raw = window.localStorage.getItem(E2E_GOOGLE_TAG_IDS_KEY)
            if (raw === null) {
                return ids
            }
            const stored = JSON.parse(raw) as unknown
            return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
        } catch {
            return []
        }
    }
    return ids
}

/** The cookie banner's open state and the visitor's choice. Client only. */
export function useConsent() {
    const isOpen = useState('consent-banner-open', () => false)
    /** True when the visitor asked for the banner, so it takes focus. */
    const openedOnRequest = useState('consent-banner-requested', () => false)

    function storedChoice(): ConsentChoice | undefined {
        return parseConsentCookie(document.cookie)
    }

    /** Everyone is asked once, when the build has a Google tag to load. */
    function openIfUndecided(): void {
        if (storedChoice() === undefined && useGoogleTagIds().length > 0) {
            isOpen.value = true
        }
    }

    function openSettings(): void {
        openedOnRequest.value = true
        isOpen.value = true
    }

    /** Opens for `#cookie-settings`, then drops the hash so a reload doesn't reopen it. */
    function openFromHash(): void {
        if (window.location.hash !== `#${CONSENT_SETTINGS_HASH}`) {
            return
        }
        history.replaceState(history.state, '', window.location.pathname + window.location.search)
        openSettings()
    }

    function choose(choice: ConsentChoice): void {
        isOpen.value = false
        openedOnRequest.value = false
        if (choice === 'granted') {
            grantConsent(useGoogleTagIds(), window, document)
        } else {
            denyConsent(window, document)
        }
    }

    return { isOpen, openedOnRequest, storedChoice, openIfUndecided, openSettings, openFromHash, choose }
}

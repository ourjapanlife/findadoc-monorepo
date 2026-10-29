import { useState } from '#imports'
import {
    CONSENT_SETTINGS_HASH,
    consentCookie,
    consentSignals,
    isConsentRegionTimeZone,
    parseConsentCookie,
    type ConsentChoice
} from '~/utils/consent'

/** The cookie banner's open state and the visitor's choice. Client only. */
export function useConsent() {
    const isOpen = useState('consent-banner-open', () => false)
    /** True when the visitor asked for the banner, so it takes focus. */
    const openedOnRequest = useState('consent-banner-requested', () => false)
    const { gtag } = useGtag()

    function storedChoice(): ConsentChoice | undefined {
        return parseConsentCookie(document.cookie)
    }

    /** Opens on first visit from Europe. Anyone can open it from the footer. */
    function openIfUndecided(): void {
        if (storedChoice() !== undefined) {
            return
        }
        isOpen.value = isConsentRegionTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
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
        document.cookie = consentCookie(choice, window.location.hostname, window.location.protocol === 'https:')
        gtag('consent', 'update', consentSignals(choice))
        isOpen.value = false
        openedOnRequest.value = false
    }

    return { isOpen, openedOnRequest, storedChoice, openIfUndecided, openSettings, openFromHash, choose }
}

import { useState } from '#imports'
import {
    consentCookie,
    consentSignals,
    isConsentRegionTimeZone,
    parseConsentCookie,
    type ConsentChoice
} from '~/utils/consent'

/** The cookie banner's open state and the visitor's choice. Client only. */
export function useConsent() {
    const isOpen = useState('consent-banner-open', () => false)
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
        isOpen.value = true
    }

    function choose(choice: ConsentChoice): void {
        document.cookie = consentCookie(choice, window.location.hostname, window.location.protocol === 'https:')
        gtag('consent', 'update', consentSignals(choice))
        isOpen.value = false
    }

    return { isOpen, storedChoice, openIfUndecided, openSettings, choose }
}

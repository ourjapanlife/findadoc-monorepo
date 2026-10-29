import { defineNuxtPlugin } from '#imports'
import { useGoogleTagIds } from '~/composables/useConsent'
import { restoreConsent } from '~/utils/consent'

/**
 * Loads the Google tag on page load only for a visitor who already accepted.
 * Everyone else gets nothing until they choose in the banner (useConsent).
 */
export default defineNuxtPlugin(() => {
    restoreConsent(useGoogleTagIds(), window, document)
})

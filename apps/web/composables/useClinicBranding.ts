import { getCurrentInstance, onBeforeUnmount } from 'vue'
import type { ClinicBranding } from '@findadoc/graphql'
import { useState } from '#imports'

/** What the `clinic-branded` layout shows above a page (online consult v2 §4). */
export type ClinicBrandedChrome = {
    branding: ClinicBranding
    /** The clinic dashboard: show sign-out, and the clinic switcher when canSwitchClinic. */
    staff: boolean
    canSwitchClinic: boolean
    /** Show the language picker in the header. The Book form has its own. */
    localeSelector: boolean
}

type ChromeState = { owner: number, chrome: ClinicBrandedChrome } | null

let nextOwner = 1

/** The layout's read of the current page's branding. Null keeps the Find a Doc header and footer. */
export function useClinicBrandedChrome() {
    return useState<ChromeState>('clinicBrandedChrome', () => null)
}

/**
 * For a page on the `clinic-branded` layout. `show` sets the clinic header once the clinic is
 * known, and `clear` returns to the Find a Doc chrome. Leaving the page clears it, unless the
 * next page has already set its own: the incoming page can mount before this one unmounts.
 */
export function useClinicBranding() {
    const state = useClinicBrandedChrome()
    const owner = nextOwner
    nextOwner += 1

    function show(chrome: ClinicBrandedChrome | null): void {
        state.value = chrome === null ? (state.value?.owner === owner ? null : state.value) : { owner, chrome }
    }

    function clear(): void {
        show(null)
    }

    if (getCurrentInstance() !== null) {
        onBeforeUnmount(clear)
    }

    return { show, clear }
}

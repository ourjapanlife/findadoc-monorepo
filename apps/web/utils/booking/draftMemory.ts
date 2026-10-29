/**
 * In-memory booking answers for a locale change.
 * The page remounts when the URL prefix changes. This keeps the typed fields
 * for that navigation and is dropped on a full reload.
 * Chosen files stay in this object only. They are never written to localStorage.
 */

export type BookingDraftMemory = {
    formId: string
    formVersion: number
    values: Record<string, string>
    startsAt: string | null
    stepIndex: number
    uploadIds: Record<string, string>
    fileNames: Record<string, string>
    files: Record<string, File>
}

let draft: BookingDraftMemory | null = null

export function rememberBookingDraft(next: BookingDraftMemory): void {
    draft = next
}

export function takeBookingDraft(formId: string, formVersion: number): BookingDraftMemory | null {
    if (draft === null || draft.formId !== formId || draft.formVersion !== formVersion) {
        return null
    }
    const found = draft
    draft = null
    return found
}

export function clearBookingDraftMemory(): void {
    draft = null
}

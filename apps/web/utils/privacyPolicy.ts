/**
 * Privacy policy sections in the order they are numbered in `privacyPage.sections.*`.
 * Each section has a `heading` and `p1`…`pN`. `cookies` keeps the `#cookies`
 * anchor the consent banner links to.
 */
export type PrivacySection = { id: string, paragraphs: number, anchor?: string }

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
    { id: 'whoWeAre', paragraphs: 1 },
    { id: 'collect', paragraphs: 5 },
    { id: 'use', paragraphs: 1 },
    { id: 'share', paragraphs: 4 },
    { id: 'retention', paragraphs: 2 },
    { id: 'cookies', paragraphs: 3, anchor: 'cookies' },
    { id: 'security', paragraphs: 1 },
    { id: 'rights', paragraphs: 1 },
    { id: 'children', paragraphs: 1 },
    { id: 'changes', paragraphs: 1 },
    { id: 'gdpr', paragraphs: 3, anchor: 'gdpr' },
    { id: 'contact', paragraphs: 1 }
]

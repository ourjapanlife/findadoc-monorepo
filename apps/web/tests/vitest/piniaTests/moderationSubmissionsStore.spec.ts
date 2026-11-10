import { setActivePinia, createPinia } from 'pinia'
import { expect } from 'chai'
import { vi, beforeEach, describe, it } from 'vitest'
import {
    FacilityCorrectionReason,
    SubmissionKind,
    type Submission,
    type SubmissionSearchFilters
} from '@findadoc/graphql'

const graphQLClientRequestWithRetry = vi.fn()

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

vi.mock('~/utils/graphql.js', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

const { SelectedSubmissionListViewTab, useModerationSubmissionsStore } = await import('~/stores/moderationSubmissionsStore')

// Fake rows only.
const FACILITY_ID = '6f1c2a5e-4b3d-4c2a-9e1f-0a1b2c3d4e5f'

function submission(id: string, kind: SubmissionKind, status: Partial<Submission> = {}): Submission {
    return {
        id,
        kind,
        googleMapsUrl: '',
        healthcareProfessionalName: kind === SubmissionKind.Listing ? 'Taro Example' : '',
        spokenLanguages: [],
        isUnderReview: false,
        isApproved: false,
        isRejected: false,
        createdDate: '2026-11-01T00:00:00.000Z',
        updatedDate: '2026-11-01T00:00:00.000Z',
        correction: kind === SubmissionKind.Correction
            ? {
                facilityId: FACILITY_ID,
                reasons: [FacilityCorrectionReason.WrongLanguages],
                changes: {}
            }
            : null,
        ...status
    }
}

const ROWS: Submission[] = [
    submission('listing-new', SubmissionKind.Listing),
    submission('correction-new', SubmissionKind.Correction),
    submission('correction-review', SubmissionKind.Correction, { isUnderReview: true }),
    submission('correction-approved', SubmissionKind.Correction, { isApproved: true })
]

type SubmissionsVariables = { listFilters: SubmissionSearchFilters }

const requestedFilters: SubmissionSearchFilters[] = []

const isOpen = (row: Submission) => !row.isApproved && !row.isRejected

/** A tiny stand-in for the API: it filters by kind and status like submissionService does. */
function answer(variables: Record<string, unknown>) {
    if ('listFilters' in variables) {
        const { listFilters } = variables as SubmissionsVariables
        requestedFilters.push(listFilters)
        const rows = ROWS.filter(row => (listFilters.kind === undefined || listFilters.kind === row.kind)
          && (!listFilters.isPending || (isOpen(row) && !row.isUnderReview))
          && (!listFilters.isOpen || isOpen(row))
          && (!listFilters.isUnderReview || row.isUnderReview)
          && (!listFilters.isApproved || row.isApproved)
          && (!listFilters.isRejected || row.isRejected))
        return { data: { submissions: rows, submissionsTotalCount: rows.length }, errors: [], hasErrors: false }
    }
    // The aliased facility-name query: one alias per id variable.
    const names = Object.fromEntries(Object.values(variables).map((id, index) => [
        `f${index}`,
        { id, nameEn: 'Example Minato Clinic', nameJa: '港サンプルクリニック' }
    ]))
    return { data: names, errors: [], hasErrors: false }
}

describe('moderationSubmissionsStore queues (#22)', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        requestedFilters.length = 0
        graphQLClientRequestWithRetry.mockReset()
        graphQLClientRequestWithRetry.mockImplementation(
            (_request: unknown, _query: unknown, variables: Record<string, unknown>) => Promise.resolve(answer(variables))
        )
    })

    it('lists new and under-review corrections in User feedback, with the clinic name', async () => {
        const store = useModerationSubmissionsStore()
        await store.setSelectedModerationListViewTabChosen(SelectedSubmissionListViewTab.UserFeedback)

        expect(store.filteredSubmissionDataForListComponent.map(row => row.id))
            .to.have.members(['correction-new', 'correction-review'])
        // The server filters and pages the queue: one page, never a 1000-row download.
        expect(requestedFilters.at(-1)).to.include({
            kind: SubmissionKind.Correction,
            isOpen: true,
            limit: store.itemsPerPage,
            offset: 0
        })
        const first = store.filteredSubmissionDataForListComponent[0]
        expect(first && store.submissionFacilityName(first)?.nameEn).to.equal('Example Minato Clinic')
    })

    it('keeps corrections out of New', async () => {
        const store = useModerationSubmissionsStore()
        await store.setSelectedModerationListViewTabChosen(SelectedSubmissionListViewTab.New)

        expect(store.filteredSubmissionDataForListComponent.map(row => row.id)).to.deep.equal(['listing-new'])
        expect(requestedFilters.at(-1)).to.include({ kind: SubmissionKind.Listing, isPending: true })
    })

    it('shows decided corrections in Approved next to listings', async () => {
        const store = useModerationSubmissionsStore()
        await store.setSelectedModerationListViewTabChosen(SelectedSubmissionListViewTab.Approved)

        expect(requestedFilters.at(-1)?.kind).to.equal(undefined)
        expect(store.filteredSubmissionDataForListComponent.map(row => row.id)).to.deep.equal(['correction-approved'])
    })

    it('finds a correction in User feedback by its clinic name', async () => {
        const store = useModerationSubmissionsStore()
        await store.setSelectedModerationListViewTabChosen(SelectedSubmissionListViewTab.UserFeedback)
        store.setSubmissionSearchQuery('港サンプル')

        expect(store.filteredSubmissionDataForListComponent).to.have.length(2)
    })

    it('counts open corrections for the User feedback tab', async () => {
        const store = useModerationSubmissionsStore()
        await store.fetchStatusCounts()

        expect(store.statusTotalCounts.feedbackCount).to.equal(2)
        expect(store.statusTotalCounts.newCount).to.equal(1)
    })
})

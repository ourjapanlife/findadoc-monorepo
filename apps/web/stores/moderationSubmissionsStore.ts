import { gql } from 'graphql-request'
import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { fetchSubmissionsWithCount } from '../utils/graphqlHelpers'
import { submissionSelection } from '../utils/graphqlSelection'
import { SubmissionKind } from '@findadoc/graphql'
import type { Submission, MutationUpdateSubmissionArgs, Mutation, SubmissionSearchFilters } from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql.js'
import type { ServerResponse } from '~/typedefs/serverResponse'
import { usePersistentFilters } from '~/composables/usePersistentFilters'
import { useTranslation } from '~/composables/useTranslation'
import { hasServerErrors, isNewSubmission } from '~/utils/moderationUtils'
import { isCorrection, isOpenCorrection } from '~/utils/moderationSubmissionStatus'
import {
    fetchCorrectionFacilityNames,
    fetchSubmissionById,
    type CorrectionFacilityName
} from '~/utils/moderationCorrections'
import { toastModerationLoadError } from '~/utils/moderationListToast'
import {
    DEFAULT_MODERATION_PAGE_SIZE,
    loadPageInRange,
    MODERATION_PAGE_SIZES,
    nextListOrder,
    orderByInput,
    orderedPage,
    pageOffsetInRange,
    type ListOrder
} from '~/utils/moderationTable'

/** The stored values stay as they were, so a saved tab still opens. Rejected reads as Declined. */
export enum SelectedSubmissionListViewTab {
    New = 'NEW',
    ForReview = 'FOR_REVIEW',
    Approved = 'APPROVED',
    Rejected = 'REJECTED',
    UserFeedback = 'USER_FEEDBACK'
}

export enum SelectedModerationListView {
    Facilities = 'FACILITIES',
    HealthcareProfessionals = 'HEALTHCARE_PROFESSIONALS',
    Submissions = 'SUBMISSIONS',
    Bookings = 'BOOKINGS',
    Availability = 'AVAILABILITY'
}

type SubmissionStatusFilter = Pick<SubmissionSearchFilters, 'isUnderReview' | 'isApproved' | 'isRejected'>

// Visitor corrections (#22) wait in User feedback, so New and Under review show listings only.
// Approved and Declined show both kinds, and a correction row carries the Feedback tag.
const LISTINGS_ONLY = { kind: SubmissionKind.Listing } as const satisfies SubmissionSearchFilters
const CORRECTIONS_ONLY = { kind: SubmissionKind.Correction } as const satisfies SubmissionSearchFilters

type ServerTabFilter = SubmissionStatusFilter & Pick<SubmissionSearchFilters, 'kind'>

const FOR_REVIEW_FILTER: ServerTabFilter = { ...LISTINGS_ONLY, isUnderReview: true }
const APPROVED_FILTER: ServerTabFilter = { isApproved: true }
const DECLINED_FILTER: ServerTabFilter = { isRejected: true }

const SUBMISSION_TAB_FILTERS: Partial<Record<SelectedSubmissionListViewTab, ServerTabFilter>> = {
    [SelectedSubmissionListViewTab.ForReview]: FOR_REVIEW_FILTER,
    [SelectedSubmissionListViewTab.Approved]: APPROVED_FILTER,
    [SelectedSubmissionListViewTab.Rejected]: DECLINED_FILTER
}

const SUBMISSION_STATUS_COUNT_QUERIES = [
    { countKey: 'forReviewCount', filter: FOR_REVIEW_FILTER },
    { countKey: 'approvedCount', filter: APPROVED_FILTER },
    { countKey: 'rejectedCount', filter: DECLINED_FILTER }
] as const

/**
 * New and User feedback are not one server status: New is `pending`, User feedback is `pending`
 * or `under_review`. These tabs load the queue once and page it in the browser.
 */
const CLIENT_QUEUE_FETCH_LIMIT = 1000

const CLIENT_QUEUE_TABS: ReadonlySet<SelectedSubmissionListViewTab> = new Set([
    SelectedSubmissionListViewTab.New,
    SelectedSubmissionListViewTab.UserFeedback
])

interface SubmissionStatusCounts {
    newCount: number
    forReviewCount: number
    approvedCount: number
    rejectedCount: number
    feedbackCount: number
}

export const useModerationSubmissionsStore = defineStore(
    'modSubmissionsStore',
    () => {
        const submissionsData: Ref<Submission[]> = ref([])
        const selectedModerationListViewChosen: Ref<SelectedModerationListView> = ref(SelectedModerationListView.Submissions)
        const selectedSubmissionId: Ref<string> = ref('')
        const selectedSubmissionData: Ref<Submission | undefined> = ref()
        const filteredSubmissionDataForListComponent: Ref<Submission[]> = ref([])
        const submissionSearchQuery: Ref<string> = ref('')
        const didMutationFail: Ref<boolean> = ref(false)
        const selectedModerationListViewTabChosen = usePersistentFilters(
            'submissions',
            'tab',
            SelectedSubmissionListViewTab.New,
            Object.values(SelectedSubmissionListViewTab)
        )
        const statusTotalCounts: Ref<SubmissionStatusCounts> = ref({
            newCount: 0,
            forReviewCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            feedbackCount: 0
        })
        // A correction row stores only the facility id. The list shows the clinic's name.
        const correctionFacilityNames: Ref<Record<string, CorrectionFacilityName>> = ref({})

        const totalSubmissionsCount: Ref<number> = ref(0)
        const currentOffset = usePersistentFilters('submissions', 'offset', 0)
        const itemsPerPage = usePersistentFilters(
            'submissions',
            'pageSize',
            DEFAULT_MODERATION_PAGE_SIZE,
            MODERATION_PAGE_SIZES
        )
        const listOrder: Ref<ListOrder | null> = ref(null)
        const cachedQueueSubmissions: Ref<Submission[]> = ref([])
        const hasNextPage = computed(() => currentOffset.value + itemsPerPage.value < totalSubmissionsCount.value)
        const hasPrevPage = computed(() => currentOffset.value > 0)

        function setDidMutationFail(newValue: boolean) {
            didMutationFail.value = newValue
        }

        function applySearchFilter(submissions: Submission[]) {
            const query = submissionSearchQuery.value.trim().toLowerCase()
            if (!query) {
                return submissions
            }
            return submissions.filter((submission: Submission) => {
                const submissionId = submission.id.toLowerCase()
                const healthcareProfessionalName = submission.healthcareProfessionalName.toLowerCase()
                const facility = submissionFacilityName(submission)
                const facilityNameEn = facility?.nameEn?.toLowerCase() || ''
                const facilityNameJa = facility?.nameJa?.toLowerCase() || ''
                return submissionId.includes(query)
                  || healthcareProfessionalName.includes(query)
                  || facilityNameEn.includes(query)
                  || facilityNameJa.includes(query)
            })
        }

        /** The submitted clinic on a listing, or the clinic a correction is about. */
        function submissionFacilityName(
            submission: Submission
        ): { nameEn?: string | null, nameJa?: string | null } | undefined {
            if (isCorrection(submission)) {
                const facilityId = submission.correction?.facilityId
                return facilityId === undefined ? undefined : correctionFacilityNames.value[facilityId]
            }
            return submission.facility ?? undefined
        }

        /** Loads the names the list does not have yet. A failure leaves the cell empty, not the list. */
        async function loadCorrectionFacilityNames(submissions: readonly Submission[]) {
            const missing = submissions
                .filter(isCorrection)
                .map(submission => submission.correction?.facilityId)
                .filter((id): id is string => id !== undefined && correctionFacilityNames.value[id] === undefined)
            if (missing.length === 0) {
                return
            }
            try {
                const names = await fetchCorrectionFacilityNames(missing)
                correctionFacilityNames.value = { ...correctionFacilityNames.value, ...names }
            } catch (error) {
                console.error(`Error fetching correction facility names: ${JSON.stringify(error)}`)
            }
        }

        async function fetchNewSubmissions() {
            const { filteredSearchResults } = await fetchSubmissionsWithCount({
                ...LISTINGS_ONLY,
                limit: CLIENT_QUEUE_FETCH_LIMIT,
                offset: 0
            })
            return filteredSearchResults.filter(isNewSubmission)
        }

        async function fetchOpenCorrections() {
            const { filteredSearchResults } = await fetchSubmissionsWithCount({
                ...CORRECTIONS_ONLY,
                limit: CLIENT_QUEUE_FETCH_LIMIT,
                offset: 0
            })
            return filteredSearchResults.filter(isOpenCorrection)
        }

        function fetchClientQueue(tab: SelectedSubmissionListViewTab) {
            return tab === SelectedSubmissionListViewTab.UserFeedback ? fetchOpenCorrections() : fetchNewSubmissions()
        }

        function submissionSortValue(submission: Submission, field: string): string {
            if (field === 'healthcareProfessionalName') {
                return submission.healthcareProfessionalName
            }
            if (field === 'createdDate') {
                return submission.createdDate
            }
            if (field === 'updatedDate') {
                return submission.updatedDate
            }
            return ''
        }

        function applyClientQueueListView(queue: Submission[]) {
            cachedQueueSubmissions.value = queue
            const searchFiltered = applySearchFilter(queue)
            const nextOffset = pageOffsetInRange(
                currentOffset.value,
                itemsPerPage.value,
                searchFiltered.length
            )
            currentOffset.value = nextOffset
            totalSubmissionsCount.value = searchFiltered.length
            // New and User feedback are not one server status, so the queue is sorted before the page is cut.
            const page = orderedPage(
                searchFiltered,
                listOrder.value,
                nextOffset,
                itemsPerPage.value,
                submissionSortValue
            )
            submissionsData.value = page
            filteredSubmissionDataForListComponent.value = page
        }

        function applySubmissionPage(offset: number, rows: Submission[], totalCount: number) {
            currentOffset.value = offset
            submissionsData.value = rows
            totalSubmissionsCount.value = totalCount
            filteredSubmissionDataForListComponent.value = applySearchFilter(rows)
        }

        async function getSubmissions() {
            try {
                const tab = selectedModerationListViewTabChosen.value
                if (CLIENT_QUEUE_TABS.has(tab)) {
                    const queue = await fetchClientQueue(tab)
                    // Names first: the search box matches a correction by its clinic's name.
                    await loadCorrectionFacilityNames(queue)
                    applyClientQueueListView(queue)
                    return
                }

                cachedQueueSubmissions.value = []

                const orderBy = orderByInput(listOrder.value)
                const page = await loadPageInRange(
                    currentOffset.value,
                    itemsPerPage.value,
                    async offset => {
                        const filters: SubmissionSearchFilters = {
                            offset,
                            limit: itemsPerPage.value,
                            ...SUBMISSION_TAB_FILTERS[selectedModerationListViewTabChosen.value],
                            ...(orderBy === null ? {} : { orderBy })
                        }
                        const { filteredSearchResults, totalCount } = await fetchSubmissionsWithCount(filters)
                        return { rows: filteredSearchResults, totalCount }
                    }
                )
                await loadCorrectionFacilityNames(page.rows)
                applySubmissionPage(page.offset, page.rows, page.totalCount)
            } catch (error) {
                console.error(`Error fetching submissions: ${JSON.stringify(error)}`)
                toastModerationLoadError('moderationListErrors.submissions')
                submissionsData.value = []
                filteredSubmissionDataForListComponent.value = []
                totalSubmissionsCount.value = 0
            }
        }

        async function fetchStatusCounts() {
            try {
                const [newSubmissions, openCorrections, ...countResults] = await Promise.all([
                    fetchNewSubmissions(),
                    fetchOpenCorrections(),
                    ...SUBMISSION_STATUS_COUNT_QUERIES.map(({ filter }) =>
                        fetchSubmissionsWithCount({ ...filter, limit: 1, offset: 0 }))
                ])

                statusTotalCounts.value = SUBMISSION_STATUS_COUNT_QUERIES.reduce(
                    (counts, { countKey }, index) => {
                        counts[countKey] = countResults[index]?.totalCount ?? 0
                        return counts
                    },
                    {
                        newCount: newSubmissions.length,
                        forReviewCount: 0,
                        approvedCount: 0,
                        rejectedCount: 0,
                        feedbackCount: openCorrections.length
                    }
                )
            } catch (error) {
                console.error(`Error fetching submission status counts: ${JSON.stringify(error)}`)
            }
        }

        function setOffset(newOffset: number) {
            currentOffset.value = newOffset
            getSubmissions()
        }

        function setSelectedModerationListViewChosen(selectedOption: SelectedModerationListView) {
            selectedModerationListViewChosen.value = selectedOption
        }

        async function setSelectedModerationListViewTabChosen(selectedOption: SelectedSubmissionListViewTab) {
            selectedModerationListViewTabChosen.value = selectedOption
            currentOffset.value = 0
            await getSubmissions()
        }

        function filterSelectedSubmission(submissionId: string | undefined) {
            const fromList = submissionsData.value.find(submission => submission.id === submissionId)
            // A submission loaded by id is kept when the current tab's page does not hold it.
            if (fromList !== undefined || selectedSubmissionData.value?.id !== submissionId) {
                selectedSubmissionData.value = fromList
            }
        }

        /**
         * The submission an edit or review screen opens. A link or a reload can open one that is
         * not on the current tab's page, so it is read by id when the list does not have it.
         */
        async function loadSelectedSubmission(submissionId: string): Promise<Submission | undefined> {
            const fromList = submissionsData.value.find(submission => submission.id === submissionId)
            if (fromList !== undefined) {
                selectedSubmissionData.value = fromList
                return fromList
            }
            try {
                selectedSubmissionData.value = await fetchSubmissionById(submissionId) ?? undefined
            } catch (error) {
                console.error(`Error fetching submission: ${JSON.stringify(error)}`)
                selectedSubmissionData.value = undefined
            }
            return selectedSubmissionData.value
        }

        function setSubmissionSearchQuery(newQuery: string) {
            submissionSearchQuery.value = newQuery
            if (CLIENT_QUEUE_TABS.has(selectedModerationListViewTabChosen.value)) {
                applyClientQueueListView(cachedQueueSubmissions.value)
                return
            }
            filteredSubmissionDataForListComponent.value = applySearchFilter(submissionsData.value)
        }

        async function updateSubmission(
  updateSubmissionInput: MutationUpdateSubmissionArgs
        ): Promise<ServerResponse<Mutation>> {
            const serverResponse = await graphQLClientRequestWithRetry<Mutation>(
                gqlClient.request.bind(gqlClient),
                updateFacilitySubmissionGqlMutation,
                updateSubmissionInput,
                { abortAfterMs: 15000 }
            )

            if (hasServerErrors(serverResponse)) {
                setDidMutationFail(true)
                return serverResponse
            }

            const updatedSubmission = serverResponse.data?.updateSubmission
            if (!updatedSubmission) {
                setDidMutationFail(true)
                return serverResponse
            }

            const indexOfOutdatedSubmissionData = submissionsData.value
                .findIndex(submission => submission.id === updatedSubmission.id)

            if (indexOfOutdatedSubmissionData === -1) {
                submissionsData.value.push(updatedSubmission)
            } else {
                submissionsData.value[indexOfOutdatedSubmissionData] = updatedSubmission
            }

            selectedSubmissionData.value = updatedSubmission
            await fetchStatusCounts()
            await getSubmissions()

            return serverResponse
        }

        async function approveSubmission() {
            if (!selectedSubmissionId.value) {
                console.error(useTranslation('moderationSubmissionErrors.unableToApprove'))
                return
            }

            const approveSubmissionInput: MutationUpdateSubmissionArgs = {
                id: selectedSubmissionId.value,
                input: {
                    isApproved: true
                }
            }
            return updateSubmission(approveSubmissionInput)
        }

        async function rejectSubmission() {
            if (!selectedSubmissionId.value) {
                console.error(useTranslation('moderationSubmissionErrors.unableToReject'))
                return
            }

            const facilityInputVariables = {
                id: selectedSubmissionId.value,
                input: {
                    isRejected: true,
                    isUnderReview: false
                }
            }

            return updateSubmission(facilityInputVariables)
        }

        function setItemsPerPage(newLimit: number) {
            itemsPerPage.value = newLimit
        }

        function setListOrder(field: string) {
            listOrder.value = nextListOrder(listOrder.value, field)
            currentOffset.value = 0
            return getSubmissions()
        }

        async function updateSubmissionStatus(
            id: string,
            input: { isApproved?: boolean, isRejected?: boolean, isUnderReview?: boolean }
        ): Promise<boolean> {
            const serverResponse = await graphQLClientRequestWithRetry<Mutation>(
                gqlClient.request.bind(gqlClient),
                updateFacilitySubmissionGqlMutation,
                { id, input },
                { abortAfterMs: 15000 }
            )
            const updatedSubmission = serverResponse.data?.updateSubmission
            return !hasServerErrors(serverResponse)
              && updatedSubmission !== undefined
              && updatedSubmission !== null
        }

        return {
            getSubmissions,
            fetchStatusCounts,
            submissionsData,
            filteredSubmissionDataForListComponent,
            submissionSearchQuery,
            setSubmissionSearchQuery,
            selectedSubmissionId,
            filterSelectedSubmission,
            loadSelectedSubmission,
            selectedSubmissionData,
            correctionFacilityNames,
            submissionFacilityName,
            didMutationFail,
            setDidMutationFail,
            selectedModerationListViewChosen,
            setSelectedModerationListViewChosen,
            selectedModerationListViewTabChosen,
            setSelectedModerationListViewTabChosen,
            statusTotalCounts,
            updateSubmission,
            approveSubmission,
            rejectSubmission,
            totalSubmissionsCount,
            currentOffset,
            itemsPerPage,
            listOrder,
            setListOrder,
            updateSubmissionStatus,
            setOffset,
            hasNextPage,
            hasPrevPage,
            setItemsPerPage
        }
    }
)

const updateFacilitySubmissionGqlMutation = gql`
mutation Mutation($id: ID!, $input: UpdateSubmissionInput!) {
  updateSubmission(id: $id, input: $input) {
    ${submissionSelection}
  }
}`

import { gql } from 'graphql-request'
import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { fetchSubmissionsWithCount } from '../utils/graphqlHelpers'
import { submissionSelection } from '../utils/graphqlSelection'
import type { Submission, MutationUpdateSubmissionArgs, Mutation, SubmissionSearchFilters } from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql.js'
import type { ServerResponse } from '~/typedefs/serverResponse'
import { usePersistentFilters } from '~/composables/usePersistentFilters'
import { useTranslation } from '~/composables/useTranslation'
import { isNewSubmission } from '~/utils/moderationUtils'
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

export enum SelectedSubmissionListViewTab {
    New = 'NEW',
    ForReview = 'FOR_REVIEW',
    Approved = 'APPROVED',
    Rejected = 'REJECTED'
}

export enum SelectedModerationListView {
    Facilities = 'FACILITIES',
    HealthcareProfessionals = 'HEALTHCARE_PROFESSIONALS',
    Submissions = 'SUBMISSIONS'
}

type SubmissionStatusFilter = Pick<SubmissionSearchFilters, 'isUnderReview' | 'isApproved' | 'isRejected'>

const SUBMISSION_TAB_FILTERS: Partial<Record<SelectedSubmissionListViewTab, SubmissionStatusFilter>> = {
    [SelectedSubmissionListViewTab.ForReview]: { isUnderReview: true },
    [SelectedSubmissionListViewTab.Approved]: { isApproved: true },
    [SelectedSubmissionListViewTab.Rejected]: { isRejected: true }
}

const SUBMISSION_STATUS_COUNT_QUERIES = [
    { countKey: 'forReviewCount', filter: { isUnderReview: true } },
    { countKey: 'approvedCount', filter: { isApproved: true } },
    { countKey: 'rejectedCount', filter: { isRejected: true } }
] as const

const NEW_SUBMISSIONS_FETCH_LIMIT = 1000

interface SubmissionStatusCounts {
    newCount: number
    forReviewCount: number
    approvedCount: number
    rejectedCount: number
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
            rejectedCount: 0
        })

        const totalSubmissionsCount: Ref<number> = ref(0)
        const currentOffset = usePersistentFilters('submissions', 'offset', 0)
        const itemsPerPage = usePersistentFilters(
            'submissions',
            'pageSize',
            DEFAULT_MODERATION_PAGE_SIZE,
            MODERATION_PAGE_SIZES
        )
        const listOrder: Ref<ListOrder | null> = ref(null)
        const cachedNewSubmissions: Ref<Submission[]> = ref([])
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
                const facilityNameEn = submission.facility?.nameEn?.toLowerCase() || ''
                const facilityNameJa = submission.facility?.nameJa?.toLowerCase() || ''
                return submissionId.includes(query)
                  || healthcareProfessionalName.includes(query)
                  || facilityNameEn.includes(query)
                  || facilityNameJa.includes(query)
            })
        }

        async function fetchNewSubmissions() {
            const { filteredSearchResults } = await fetchSubmissionsWithCount({
                limit: NEW_SUBMISSIONS_FETCH_LIMIT,
                offset: 0
            })
            return filteredSearchResults.filter(isNewSubmission)
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

        function applyNewTabListView(newSubmissions: Submission[]) {
            cachedNewSubmissions.value = newSubmissions
            const searchFiltered = applySearchFilter(newSubmissions)
            const nextOffset = pageOffsetInRange(
                currentOffset.value,
                itemsPerPage.value,
                searchFiltered.length
            )
            currentOffset.value = nextOffset
            totalSubmissionsCount.value = searchFiltered.length
            // New is not a server status, so the loaded queue is sorted before the page is cut.
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
                if (selectedModerationListViewTabChosen.value === SelectedSubmissionListViewTab.New) {
                    applyNewTabListView(await fetchNewSubmissions())
                    return
                }

                cachedNewSubmissions.value = []

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
                applySubmissionPage(page.offset, page.rows, page.totalCount)
            } catch (error) {
                console.error(`Error fetching submissions: ${JSON.stringify(error)}`)
                //eslint-disable-next-line
                alert('Error loading submissions. Please try again later.')
                submissionsData.value = []
                filteredSubmissionDataForListComponent.value = []
                totalSubmissionsCount.value = 0
            }
        }

        async function fetchStatusCounts() {
            try {
                const [newSubmissions, ...countResults] = await Promise.all([
                    fetchNewSubmissions(),
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
                        rejectedCount: 0
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
            selectedSubmissionData.value = submissionsData.value.find(submission => submission.id === submissionId)
        }

        function setSubmissionSearchQuery(newQuery: string) {
            submissionSearchQuery.value = newQuery
            if (selectedModerationListViewTabChosen.value === SelectedSubmissionListViewTab.New) {
                applyNewTabListView(cachedNewSubmissions.value)
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
                updateSubmissionInput
            )

            if (serverResponse.errors?.length) {
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
                { id, input }
            )
            const updatedSubmission = serverResponse.data?.updateSubmission
            return serverResponse.errors?.length ? false : updatedSubmission !== undefined && updatedSubmission !== null
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
            selectedSubmissionData,
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

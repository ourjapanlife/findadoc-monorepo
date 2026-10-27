<template>
    <ModerationDataTable
        :column-storage-key="columnStorageKey"
        :columns="columns"
        :rows="rows"
        :empty-label="emptyLabel"
        :search="listSearchQuery"
        :offset="offset"
        :total-items="totalItems"
        :page-size="pageSize"
        :sort="sort"
        :selectable="submissionsModerationListViewChosen"
        :selected-ids="selectedIds"
        :selected-names="selectedNames"
        :page-selection="pageSelection"
        :pending="bulkPending"
        :results="bulkResultLines"
        @update:search="listSearchQuery = $event"
        @update:offset="onOffset"
        @update:page-size="onPageSize"
        @sort="onSort"
        @toggle-row="toggleRow"
        @toggle-page="togglePage"
        @open="openRow"
        @approve="runBulk('approve')"
        @reject="runBulk('reject')"
    />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
    BookingSubmissionStatus,
    type HealthcareProfessional,
    type Submission
} from '@findadoc/graphql'
import { SelectedModerationListView, useModerationSubmissionsStore } from '~/stores/moderationSubmissionsStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useBookingSubmissionsStore } from '~/stores/bookingSubmissionsStore'
import { formatToReadableDate } from '~/utils/dateUtils'
import { isNewSubmission } from '~/utils/moderationUtils'
import { pageSelectionState, type ModerationTableColumn, type ModerationTableRow } from '~/utils/moderationTable'
import { runBulkSubmissionAction } from '~/utils/moderationTable'

const { t } = useI18n()

const modSubmissionsStore = useModerationSubmissionsStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const facilitiesStore = useFacilitiesStore()
const bookingSubmissionsStore = useBookingSubmissionsStore()

const selectedSubmissions = ref<Record<string, string>>({})
const bulkPending = ref(false)
const bulkResultLines = ref<{ id: string, text: string }[]>([])

const healthcareProfessionalsModerationListViewChosen = computed(() => modSubmissionsStore.selectedModerationListViewChosen
  === SelectedModerationListView.HealthcareProfessionals)

const facilitiesModerationListViewChosen = computed(() => modSubmissionsStore.selectedModerationListViewChosen
  === SelectedModerationListView.Facilities)

const submissionsModerationListViewChosen = computed(() => modSubmissionsStore.selectedModerationListViewChosen
  === SelectedModerationListView.Submissions)

const bookingsModerationListViewChosen = computed(() => modSubmissionsStore.selectedModerationListViewChosen
  === SelectedModerationListView.Bookings)

const columnStorageKey = computed(() => {
    if (facilitiesModerationListViewChosen.value) {
        return 'facilities'
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return 'healthcare-professionals'
    }
    if (bookingsModerationListViewChosen.value) {
        return 'bookings'
    }
    return 'submissions'
})

const columns = computed((): ModerationTableColumn[] => {
    if (facilitiesModerationListViewChosen.value) {
        return [
            { id: 'englishName', label: t('moderationTable.englishName'), sortField: 'nameEn' },
            { id: 'japaneseName', label: t('moderationTable.japaneseName'), sortField: 'nameJa' },
            { id: 'created', label: t('modListContainerItem.createdDate'), sortField: 'createdDate' },
            { id: 'updated', label: t('modListContainerItem.updatedDate'), sortField: 'updatedDate' }
        ]
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return [
            { id: 'name', label: t('moderationTable.name') },
            { id: 'created', label: t('modListContainerItem.createdDate'), sortField: 'createdDate' },
            { id: 'updated', label: t('modListContainerItem.updatedDate'), sortField: 'updatedDate' }
        ]
    }
    if (bookingsModerationListViewChosen.value) {
        return [
            { id: 'clinic', label: t('bookingDashboard.columns.clinic') },
            { id: 'status', label: t('bookingDashboard.columns.status') },
            { id: 'appointment', label: t('bookingDashboard.columns.appointment') },
            { id: 'identity', label: t('bookingDashboard.columns.identity') },
            { id: 'created', label: t('modListContainerItem.createdDate'), sortField: 'createdDate' }
        ]
    }
    return [
        { id: 'name', label: t('moderationTable.name'), sortField: 'healthcareProfessionalName' },
        { id: 'facility', label: t('moderationTable.facility') },
        { id: 'status', label: t('moderationTable.status') },
        { id: 'created', label: t('modListContainerItem.createdDate'), sortField: 'createdDate' },
        { id: 'updated', label: t('modListContainerItem.updatedDate'), sortField: 'updatedDate' }
    ]
})

const rows = computed((): ModerationTableRow[] => {
    if (facilitiesModerationListViewChosen.value) {
        return facilitiesStore.filteredFacilityData.map((facility, index) => ({
            id: facility.id,
            href: `/my-page/edit-facility/${facility.id}`,
            testId: `mod-facility-list-item-${index + 1}`,
            linkColumn: 'englishName',
            badges: [],
            cells: {
                englishName: facility.nameEn ?? '',
                japaneseName: facility.nameJa ?? '',
                created: formatToReadableDate(facility.createdDate),
                updated: formatToReadableDate(facility.updatedDate)
            }
        }))
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return healthcareProfessionalsStore.filteredHealthcareProfessionalsData.map((professional, index) => ({
            id: professional.id,
            href: `/my-page/edit-healthcare-professional/${professional.id}`,
            testId: `mod-healthcare-professional-list-item-${index + 1}`,
            linkColumn: 'name',
            badges: [],
            cells: {
                name: professionalLabel(professional),
                created: formatToReadableDate(professional.createdDate),
                updated: formatToReadableDate(professional.updatedDate)
            }
        }))
    }
    if (bookingsModerationListViewChosen.value) {
        return bookingSubmissionsStore.rows.map((booking, index) => ({
            id: booking.id,
            href: `/my-page/booking/${booking.id}`,
            testId: `mod-booking-list-item-${index + 1}`,
            linkColumn: 'clinic',
            badges: booking.hasIdentityUploads
                ? [{ label: t('bookingDashboard.identityBadge'), className: 'bg-warning/80' }]
                : [],
            cells: {
                clinic: booking.clinicName,
                status: bookingStatusLabel(booking.status),
                appointment: booking.startsAt
                    ? formatToReadableDate(booking.startsAt)
                    : t('bookingDashboard.noAppointment'),
                identity: booking.hasIdentityUploads
                    ? t('bookingDashboard.identityYes')
                    : t('bookingDashboard.identityNo'),
                created: formatToReadableDate(booking.createdDate)
            }
        }))
    }
    return modSubmissionsStore.filteredSubmissionDataForListComponent.map((submission, index) => ({
        id: submission.id,
        href: `/my-page/edit-submission/${submission.id}`,
        testId: `mod-submission-list-item-${index + 1}`,
        linkColumn: 'name',
        badges: submissionBadges(submission),
        cells: {
            name: submission.healthcareProfessionalName,
            facility: submission.facility?.nameEn || submission.facility?.nameJa || '',
            status: '',
            created: formatToReadableDate(submission.createdDate),
            updated: formatToReadableDate(submission.updatedDate)
        }
    }))
})

const emptyLabel = computed(() => {
    if (submissionsModerationListViewChosen.value) {
        return t('modPanelSubmissionList.noSubmissions')
    }
    if (bookingsModerationListViewChosen.value) {
        return t('bookingDashboard.empty')
    }
    return t('searchResultsList.noResults')
})

const offset = computed(() => {
    if (facilitiesModerationListViewChosen.value) {
        return facilitiesStore.currentOffset
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return healthcareProfessionalsStore.currentOffset
    }
    if (bookingsModerationListViewChosen.value) {
        return bookingSubmissionsStore.currentOffset
    }
    return modSubmissionsStore.currentOffset
})

const totalItems = computed(() => {
    if (facilitiesModerationListViewChosen.value) {
        return facilitiesStore.totalFacilitiesCount
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return healthcareProfessionalsStore.totalHealthcareProfessionalsCount
    }
    if (bookingsModerationListViewChosen.value) {
        return bookingSubmissionsStore.totalCount
    }
    return modSubmissionsStore.totalSubmissionsCount
})

const pageSize = computed(() => {
    if (facilitiesModerationListViewChosen.value) {
        return facilitiesStore.itemsPerPage
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return healthcareProfessionalsStore.itemsPerPage
    }
    if (bookingsModerationListViewChosen.value) {
        return bookingSubmissionsStore.itemsPerPage
    }
    return modSubmissionsStore.itemsPerPage
})

const sort = computed(() => {
    if (facilitiesModerationListViewChosen.value) {
        return facilitiesStore.listOrder
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        return healthcareProfessionalsStore.listOrder
    }
    if (bookingsModerationListViewChosen.value) {
        return bookingSubmissionsStore.listOrder
    }
    return modSubmissionsStore.listOrder
})

const listSearchQuery = computed({
    get() {
        if (facilitiesModerationListViewChosen.value) {
            return facilitiesStore.listSearchQuery
        }
        if (healthcareProfessionalsModerationListViewChosen.value) {
            return healthcareProfessionalsStore.listSearchQuery
        }
        if (bookingsModerationListViewChosen.value) {
            return bookingSubmissionsStore.listSearchQuery
        }
        return modSubmissionsStore.submissionSearchQuery
    },
    set(newValue: string) {
        if (facilitiesModerationListViewChosen.value) {
            facilitiesStore.setListSearchQuery(newValue)
            return
        }
        if (healthcareProfessionalsModerationListViewChosen.value) {
            healthcareProfessionalsStore.setListSearchQuery(newValue)
            return
        }
        if (bookingsModerationListViewChosen.value) {
            bookingSubmissionsStore.setListSearchQuery(newValue)
            return
        }
        modSubmissionsStore.setSubmissionSearchQuery(newValue)
    }
})

const selectedIds = computed(() => Object.keys(selectedSubmissions.value))
const selectedNames = computed(() => Object.values(selectedSubmissions.value))
const pageSelection = computed(() => pageSelectionState(
    rows.value.map(row => row.id),
    new Set(selectedIds.value)
))

watch(
    () => [
        modSubmissionsStore.selectedModerationListViewChosen,
        modSubmissionsStore.selectedModerationListViewTabChosen
    ],
    () => {
        selectedSubmissions.value = {}
        bulkResultLines.value = []
    }
)

onMounted(async () => {
    await modSubmissionsStore.getSubmissions()
    await modSubmissionsStore.fetchStatusCounts()
    await facilitiesStore.loadFacilityList()
    await healthcareProfessionalsStore.loadHealthcareProfessionalList()
    if (bookingsModerationListViewChosen.value) {
        await bookingSubmissionsStore.loadList()
    }
})

watch(bookingsModerationListViewChosen, async isBookings => {
    if (isBookings) {
        await bookingSubmissionsStore.loadList()
    }
})

function professionalLabel(professional: HealthcareProfessional): string {
    const name = healthcareProfessionalsStore.displayChosenLocaleForHealthcareProfessional(professional)
    return [name.lastName, name.firstName, name.middleName].filter(part => part).join(' ')
}

function bookingStatusLabel(status: BookingSubmissionStatus): string {
    if (status === BookingSubmissionStatus.Notified) {
        return t('bookingDashboard.status.notified')
    }
    if (status === BookingSubmissionStatus.FailedNotify) {
        return t('bookingDashboard.status.failedNotify')
    }
    return t('bookingDashboard.status.received')
}

function submissionBadges(submission: Submission) {
    const badges = []
    if (isNewSubmission(submission)) {
        badges.push({ label: t('modListContainerItem.newSubmission'), className: 'bg-success/80' })
    }
    if (submission.isUnderReview) {
        badges.push({ label: t('modListContainerItem.underReviewSubmission'), className: 'bg-info/80' })
    }
    if (submission.isApproved) {
        badges.push({ label: t('modListContainerItem.approvedSubmission'), className: 'bg-warning/80' })
    }
    if (submission.isRejected) {
        badges.push({ label: t('modListContainerItem.rejectedSubmission'), className: 'bg-error/80' })
    }
    return badges
}

function onOffset(nextOffset: number) {
    if (facilitiesModerationListViewChosen.value) {
        facilitiesStore.setOffset(nextOffset)
        return
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        healthcareProfessionalsStore.setOffset(nextOffset)
        return
    }
    if (bookingsModerationListViewChosen.value) {
        bookingSubmissionsStore.setOffset(nextOffset)
        return
    }
    modSubmissionsStore.setOffset(nextOffset)
}

function onPageSize(nextPageSize: number) {
    if (facilitiesModerationListViewChosen.value) {
        facilitiesStore.setItemsPerPage(nextPageSize)
        facilitiesStore.setOffset(0)
        return
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        healthcareProfessionalsStore.setItemsPerPage(nextPageSize)
        healthcareProfessionalsStore.setOffset(0)
        return
    }
    if (bookingsModerationListViewChosen.value) {
        bookingSubmissionsStore.setItemsPerPage(nextPageSize)
        return
    }
    modSubmissionsStore.setItemsPerPage(nextPageSize)
    modSubmissionsStore.setOffset(0)
}

function onSort(field: string) {
    if (facilitiesModerationListViewChosen.value) {
        facilitiesStore.setListOrder(field)
        return
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        healthcareProfessionalsStore.setListOrder(field)
        return
    }
    if (bookingsModerationListViewChosen.value) {
        return
    }
    modSubmissionsStore.setListOrder(field)
}

function omitSelected(ids: ReadonlySet<string>): Record<string, string> {
    const next: Record<string, string> = {}
    for (const [id, label] of Object.entries(selectedSubmissions.value)) {
        if (!ids.has(id)) {
            next[id] = label
        }
    }
    return next
}

function rowLabel(row: ModerationTableRow): string {
    const label = row.cells[row.linkColumn]
    return label === undefined || label === '' ? row.id : label
}

function toggleRow(row: ModerationTableRow) {
    if (selectedSubmissions.value[row.id] !== undefined) {
        selectedSubmissions.value = omitSelected(new Set([row.id]))
    } else {
        selectedSubmissions.value = {
            ...selectedSubmissions.value,
            [row.id]: rowLabel(row)
        }
    }
    bulkResultLines.value = []
}

function togglePage() {
    if (pageSelection.value === 'all') {
        selectedSubmissions.value = omitSelected(new Set(rows.value.map(row => row.id)))
    } else {
        const next = { ...selectedSubmissions.value }
        for (const row of rows.value) {
            next[row.id] = rowLabel(row)
        }
        selectedSubmissions.value = next
    }
    bulkResultLines.value = []
}

function openRow(row: ModerationTableRow) {
    if (facilitiesModerationListViewChosen.value) {
        facilitiesStore.selectedFacilityId = row.id
        return
    }
    if (healthcareProfessionalsModerationListViewChosen.value) {
        healthcareProfessionalsStore.selectedHealthcareProfessionalId = row.id
        return
    }
    modSubmissionsStore.selectedSubmissionId = row.id
}

async function runBulk(action: 'approve' | 'reject') {
    const targets = Object.entries(selectedSubmissions.value).map(([id, label]) => ({ id, label }))
    if (targets.length === 0 || bulkPending.value) {
        return
    }
    bulkPending.value = true
    try {
        const results = await runBulkSubmissionAction(targets, id => modSubmissionsStore.updateSubmissionStatus(
            id,
            action === 'approve'
                ? { isApproved: true }
                : { isRejected: true, isUnderReview: false }
        ))
        bulkResultLines.value = results.map(result => ({
            id: result.id,
            text: t(
                result.succeeded
                    ? (action === 'approve' ? 'moderationTable.rowApproved' : 'moderationTable.rowRejected')
                    : 'moderationTable.rowFailed',
                { name: result.label }
            )
        }))
        selectedSubmissions.value = omitSelected(new Set(
            results.filter(result => result.succeeded).map(result => result.id)
        ))
        await modSubmissionsStore.fetchStatusCounts()
        await modSubmissionsStore.getSubmissions()
    } finally {
        bulkPending.value = false
    }
}
</script>

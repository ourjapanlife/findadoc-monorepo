import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import type { BookingSubmissionListItem } from '@findadoc/graphql'
import {
    DEFAULT_MODERATION_PAGE_SIZE,
    MODERATION_PAGE_SIZES,
    type ListOrder
} from '~/utils/moderationTable'
import { fetchBookingSubmissions } from '~/utils/booking/staffQuery'
import { usePersistentFilters } from '~/composables/usePersistentFilters'

export const useBookingSubmissionsStore = defineStore('bookingSubmissionsStore', () => {
    const rows: Ref<BookingSubmissionListItem[]> = ref([])
    const totalCount: Ref<number> = ref(0)
    const listSearchQuery: Ref<string> = ref('')
    const currentOffset = usePersistentFilters('bookings', 'offset', 0)
    const itemsPerPage = usePersistentFilters(
        'bookings',
        'pageSize',
        DEFAULT_MODERATION_PAGE_SIZE,
        MODERATION_PAGE_SIZES
    )
    const listOrder: Ref<ListOrder> = ref({ field: 'createdDate', direction: 'desc' })
    const selectedClinicSiteId: Ref<string> = ref('')
    const loadError: Ref<boolean> = ref(false)

    async function loadList(): Promise<void> {
        loadError.value = false
        try {
            const result = await fetchBookingSubmissions({
                clinicSiteId: selectedClinicSiteId.value || undefined,
                limit: itemsPerPage.value,
                offset: currentOffset.value
            })
            const query = listSearchQuery.value.trim().toLowerCase()
            rows.value = query === ''
                ? result.rows
                : result.rows.filter(row =>
                    row.clinicName.toLowerCase().includes(query)
                    || (row.clinicSiteSlug ?? '').toLowerCase().includes(query)
                    || (row.facilityId ?? '').toLowerCase().includes(query)
                    || row.id.toLowerCase().includes(query))
            totalCount.value = result.totalCount
        } catch {
            loadError.value = true
            rows.value = []
            totalCount.value = 0
        }
    }

    function setOffset(offset: number) {
        currentOffset.value = Math.max(0, offset)
        void loadList()
    }

    function setItemsPerPage(size: number) {
        itemsPerPage.value = size
        currentOffset.value = 0
        void loadList()
    }

    function setListSearchQuery(query: string) {
        listSearchQuery.value = query
        void loadList()
    }

    function setClinicSiteId(clinicSiteId: string) {
        selectedClinicSiteId.value = clinicSiteId
        currentOffset.value = 0
        void loadList()
    }

    return {
        rows,
        totalCount,
        listSearchQuery,
        currentOffset,
        itemsPerPage,
        listOrder,
        selectedClinicSiteId,
        loadError,
        loadList,
        setOffset,
        setItemsPerPage,
        setListSearchQuery,
        setClinicSiteId
    }
})

<template>
    <div class="md:h-full md:min-h-0 md:overflow-hidden flex flex-col">
        <div
            v-if="moderationScreenStore.dashboardScreenIsActive()"
            class="md:h-full md:min-h-0 flex flex-col"
        >
            <MyPageSettingsContent v-if="isSettingsView" />
            <ClinicAvailabilityCalendar
                v-else-if="isAvailabilityView"
            />
            <ModListContainer v-else />
        </div>
        <div
            v-if="moderationScreenStore.editSubmissionScreenIsActive()"
            class="md:h-full overflow-y-auto"
        >
            <form class="p-4 md:h-full md:overflow-y-auto">
                <ModEditSubmissionForm />
            </form>
        </div>
        <div
            v-if="moderationScreenStore.createFacilityScreenIsActive()"
            class="md:h-full overflow-y-auto"
        >
            <form
                class="p-4 md:h-full md:overflow-y-auto"
            >
                <ModCreateFacilitySection />
            </form>
        </div>
        <div
            v-if="moderationScreenStore.editFacilityScreenIsActive()"
            class="md:h-full overflow-y-auto"
        >
            <form class="p-4 md:h-full md:overflow-y-auto">
                <ModEditFacilitySection />
            </form>
        </div>
        <div
            v-if="moderationScreenStore.editHealthcareProfessionalScreenIsActive()"
            class="md:h-full overflow-y-auto"
        >
            <form
                class="p-4 md:h-full md:overflow-y-auto"
            >
                <ModEditHealthcareProfessionalSection />
            </form>
        </div>
        <div
            v-if="moderationScreenStore.createHealthcareProfessionalScreenIsActive()"
            class="md:h-full overflow-y-auto"
        >
            <form
                class="p-4 md:h-full md:overflow-y-auto"
            >
                <ModCreateHealthcareProfessionalSection />
            </form>
        </div>
        <div
            v-if="moderationScreenStore.viewBookingScreenIsActive()"
            class="md:h-full overflow-y-auto"
        >
            <BookingSubmissionDetail :booking-id="selectedIdFromModSubmissionList" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, nextTick, onMounted, watch } from 'vue'
import { useModerationScreenStore, ModerationScreen } from '~/stores/moderationScreenStore'
import { SelectedModerationListView, useModerationSubmissionsStore } from '~/stores/moderationSubmissionsStore'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { isModerationSettingsView } from '~/utils/moderationView'
import { useBookingSubmissionsStore } from '~/stores/bookingSubmissionsStore'

const route = useRoute()

const moderationScreenStore = useModerationScreenStore()
const moderationSubmissionsStore = useModerationSubmissionsStore()
const facilitiesStore = useFacilitiesStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const bookingSubmissionsStore = useBookingSubmissionsStore()

const routePathForModerationScreen = computed(() => route.path as string)
const selectedIdFromModSubmissionList = computed(() => route.params.id as string)
const selectedViewQuery = computed(() => {
    const view = route.query.view
    return typeof view === 'string' ? view : ''
})
const isSettingsView = computed(() => isModerationSettingsView(selectedViewQuery.value))
const isAvailabilityView = computed(() => selectedViewQuery.value === 'availability')

function syncSelectedModerationViewFromQuery() {
    if (isSettingsView.value) {
        return
    }

    switch (selectedViewQuery.value) {
        case 'facilities':
            moderationSubmissionsStore.setSelectedModerationListViewChosen(SelectedModerationListView.Facilities)
            return
        case 'healthcare-professionals':
            moderationSubmissionsStore
                .setSelectedModerationListViewChosen(SelectedModerationListView.HealthcareProfessionals)
            return
        case 'bookings':
            moderationSubmissionsStore.setSelectedModerationListViewChosen(SelectedModerationListView.Bookings)
            return
        case 'availability':
            moderationSubmissionsStore.setSelectedModerationListViewChosen(SelectedModerationListView.Availability)
            return
        case 'submissions':
        default:
            moderationSubmissionsStore.setSelectedModerationListViewChosen(SelectedModerationListView.Submissions)
    }
}

const setActiveScreenBasedOnRoute = async () => {
    await nextTick()
    // grab the relevant part of the path
    const pathSnippet = routePathForModerationScreen.value.split('/')[2] ?? ''

    // for routes that require a selected ID, check before entering the switch
    const editRoutes = ['edit-submission', 'edit-facility', 'edit-healthcare-professional', 'booking']
    if (editRoutes.includes(pathSnippet) && !selectedIdFromModSubmissionList.value) {
        moderationScreenStore.setActiveScreen(ModerationScreen.Dashboard)
        moderationSubmissionsStore.selectedSubmissionId = ''
        facilitiesStore.selectedFacilityId = ''
        facilitiesStore.selectedFacilityData = undefined
        healthcareProfessionalsStore.selectedHealthcareProfessionalId = ''
        healthcareProfessionalsStore.selectedHealthcareProfessionalData = undefined
        return
    }

    switch (pathSnippet) {
        case 'edit-submission':
            moderationScreenStore.setActiveScreen(ModerationScreen.EditSubmission)
            moderationSubmissionsStore.selectedSubmissionId = selectedIdFromModSubmissionList.value
            break
        case 'edit-facility':
            moderationScreenStore.setActiveScreen(ModerationScreen.EditFacility)
            facilitiesStore.selectedFacilityId = selectedIdFromModSubmissionList.value
            break
        case 'edit-healthcare-professional':
            moderationScreenStore.setActiveScreen(ModerationScreen.EditHealthcareProfessional)
            healthcareProfessionalsStore.selectedHealthcareProfessionalId = selectedIdFromModSubmissionList.value
            break
        case 'create-healthcare-professional':
            moderationScreenStore.setActiveScreen(ModerationScreen.CreateHealthcareProfessional)
            break
        case 'create-facility':
            moderationScreenStore.setActiveScreen(ModerationScreen.CreateFacility)
            break
        case 'booking':
            moderationScreenStore.setActiveScreen(ModerationScreen.ViewBooking)
            break
        default:
            moderationScreenStore.setActiveScreen(ModerationScreen.Dashboard)
            syncSelectedModerationViewFromQuery()
            moderationSubmissionsStore.selectedSubmissionId = ''
            facilitiesStore.selectedFacilityId = ''
            facilitiesStore.selectedFacilityData = undefined
            healthcareProfessionalsStore.selectedHealthcareProfessionalId = ''
            healthcareProfessionalsStore.selectedHealthcareProfessionalData = undefined
            // Reset healthcareProfessionalSections
            healthcareProfessionalsStore.resetHealthcareProfessionalSectionFields()
            // Reset facilitySectionFields
            facilitiesStore.resetFacilitySectionFields()
            if (selectedViewQuery.value === 'bookings') {
                void bookingSubmissionsStore.loadList()
            }
    }
}

watch(
    [selectedIdFromModSubmissionList, routePathForModerationScreen, selectedViewQuery],
    setActiveScreenBasedOnRoute
)

onMounted(() => {
    setActiveScreenBasedOnRoute()
})
</script>

<template>
    <div class="flex w-full flex-col gap-3">
        <div v-if="moderationScreenStore.dashboardScreenIsActive() && !isSettingsView">
            <ModDashboardTopbar />
        </div>
        <div
            v-if="moderationScreenStore.editSubmissionScreenIsActive()"
            class="w-full min-w-0"
        >
            <ModEditSubmissionTopbar
                data-test-id="mod-edit-submission-topbar"
            />
        </div>
        <div
            v-if="moderationScreenStore.editFacilityScreenIsActive()
                || moderationScreenStore.editHealthcareProfessionalScreenIsActive()"
            class="w-full min-w-0"
        >
            <ModEditFacilityOrProfessionalTopbar />
        </div>
        <div
            v-if="moderationScreenStore.createHealthcareProfessionalScreenIsActive()"
            class="w-full min-w-0"
        >
            <ModCreateFacilityOrProfessionalTopbar />
        </div>
        <div
            v-if="moderationScreenStore.createFacilityScreenIsActive()"
            class="w-full min-w-0"
        >
            <ModCreateFacilityOrProfessionalTopbar />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useModerationScreenStore } from '~/stores/moderationScreenStore'
import { hidesModerationListTopbar } from '~/utils/moderationView'

const route = useRoute()
const moderationScreenStore = useModerationScreenStore()
const isSettingsView = computed(() => hidesModerationListTopbar(route.query.view))
</script>

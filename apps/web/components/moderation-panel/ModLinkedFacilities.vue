<template>
    <div class="flex flex-col gap-2">
        <ModSearchBar
            v-model="pendingFacilities"
            :data-testid="dataTestId"
            :place-holder-text="placeHolderText"
            :no-match-text="noMatchText"
            :fields-to-display-callback="fieldsToDisplay"
            :default-suggestions="suggestions"
            @search-input-change="handleSearchInputChange"
        />
        <ul
            v-if="linked.length"
            class="mod-token-list m-0 flex list-none flex-wrap gap-2 p-0"
            data-testid="linked-facilities"
        >
            <li
                v-for="facility in linked"
                :key="facility.id"
                class="chip gap-1 pr-1"
            >
                <span>{{ facilityLinkLabel(facility) }}</span>
                <button
                    type="button"
                    class="mod-edit-only inline-flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none"
                    :aria-label="removeLabel(facilityLinkLabel(facility))"
                    data-testid="linked-facility-remove"
                    @click="removeFacility(facility.id)"
                >
                    ×
                </button>
            </li>
        </ul>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch, type Ref } from 'vue'
import type { Facility } from '@findadoc/graphql'
import { useLinkedFacilities } from '~/composables/useLinkedFacilities'
import { addFacilityLink, facilityLinkLabel, removeFacilityLink, type LinkedFacilityName } from '~/utils/linkedFacilities'
import { matchesFacilitySearch } from '~/utils/moderationSearchUtils'

const facilityIds = defineModel<string[]>({ required: true })

const props = defineProps<{
    suggestions: Facility[]
    placeHolderText: string
    noMatchText: string
    dataTestId?: string
    removeLabel: (name: string) => string
    loadFacilities?: (ids: readonly string[]) => Promise<LinkedFacilityName[]>
}>()

const pendingFacilities = ref<Facility[]>([])
const { linked, remember } = useLinkedFacilities(
    () => facilityIds.value,
    props.loadFacilities
)

watch(pendingFacilities, picked => {
    if (!picked.length) {
        return
    }
    let next = facilityIds.value ?? []
    for (const facility of picked) {
        remember({
            id: facility.id,
            nameEn: facility.nameEn ?? '',
            nameJa: facility.nameJa ?? ''
        })
        next = addFacilityLink(next, facility.id)
    }
    facilityIds.value = next
    pendingFacilities.value = []
})

function removeFacility(facilityId: string) {
    facilityIds.value = removeFacilityLink(facilityIds.value, facilityId)
}

function handleSearchInputChange(filteredItems: Ref<Facility[]>, inputValue: string) {
    filteredItems.value = props.suggestions.filter(facility => matchesFacilitySearch(facility, inputValue))
}

function fieldsToDisplay(facility: Facility) {
    return [facility.nameEn, facility.nameJa]
}
</script>

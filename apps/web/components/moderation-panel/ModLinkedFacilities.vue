<template>
    <div class="flex flex-col gap-3">
        <ModSearchBar
            v-model="selectedFacilities"
            :data-testid="dataTestId"
            :place-holder-text="placeHolderText"
            :no-match-text="noMatchText"
            :fields-to-display-callback="fieldsToDisplay"
            :default-suggestions="suggestions"
            @search-input-blur="handleSearchInputChange.cancel"
            @search-input-change="handleSearchInputChange"
        />
        <ul
            v-if="linked.length"
            class="m-0 grid list-none gap-2 p-0"
            data-testid="linked-facilities"
        >
            <li
                v-for="facility in linked"
                :key="facility.id"
                class="flex min-w-0 items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5"
            >
                <SVGCheckMark
                    class="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                />
                <div class="flex min-w-0 flex-1 flex-col">
                    <span class="font-semibold wrap-break-word text-primary-text">
                        {{ facility.nameEn || facility.nameJa || facility.id }}
                    </span>
                    <span
                        v-if="facility.nameEn && facility.nameJa"
                        class="text-sm wrap-break-word text-primary-text-muted"
                    >
                        {{ facility.nameJa }}
                    </span>
                </div>
                <button
                    type="button"
                    class="mod-edit-only inline-flex size-8 shrink-0 items-center justify-center rounded-full
                        text-lg leading-none text-primary-text hover:bg-accent-bg"
                    :aria-label="removeLabel(facilityLinkLabel(facility))"
                    data-testid="linked-facility-remove"
                    @click="removeFacility(facility.id)"
                >
                    ×
                </button>
            </li>
        </ul>
        <p
            v-else
            class="text-sm text-primary-text-muted"
            data-testid="linked-facilities-empty"
        >
            {{ emptyText }}
        </p>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { Facility } from '@findadoc/graphql'
import SVGCheckMark from '~/assets/icons/check-mark.svg'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useLinkedFacilities } from '~/composables/useLinkedFacilities'
import { facilityLinkLabel, linkedFacilityIds, removeFacilityLink, type LinkedFacilityName } from '~/utils/linkedFacilities'
import { useDirectoryPickerSearch } from '~/composables/useDirectoryPickerSearch'

const facilityIds = defineModel<string[]>({ required: true })

const props = defineProps<{
    suggestions: Facility[]
    placeHolderText: string
    noMatchText: string
    emptyText: string
    dataTestId?: string
    removeLabel: (name: string) => string
    loadFacilities?: (ids: readonly string[]) => Promise<LinkedFacilityName[]>
}>()

const { linked, remember } = useLinkedFacilities(
    () => facilityIds.value,
    props.loadFacilities
)

const selectedFacilities = computed<Facility[]>({
    get: () => linked.value as Facility[],
    set: picked => {
        for (const facility of picked) {
            remember({
                id: facility.id,
                nameEn: facility.nameEn ?? '',
                nameJa: facility.nameJa ?? ''
            })
        }
        facilityIds.value = linkedFacilityIds(picked.map(facility => facility.id))
    }
})

function removeFacility(facilityId: string) {
    facilityIds.value = removeFacilityLink(facilityIds.value, facilityId)
}

const facilitiesStore = useFacilitiesStore()
const handleSearchInputChange = useDirectoryPickerSearch(
    query => facilitiesStore.searchFacilities(query)
)

function fieldsToDisplay(facility: Facility) {
    return [facility.nameEn, facility.nameJa].filter(Boolean)
}
</script>

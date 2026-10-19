<template>
    <div
        v-if="urlIsValid"
        class="mod-span-2 flex flex-col gap-2 rounded-lg border border-accent-bg bg-secondary-bg p-3"
        data-testid="mod-maps-link-tools"
    >
        <a
            :href="url"
            class="link inline-flex min-h-11 items-center break-all"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mod-open-maps-link"
        >
            {{ url }}
        </a>
        <div class="flex flex-wrap gap-2">
            <a
                :href="url"
                class="btn btn-secondary btn-sm"
                target="_blank"
                rel="noopener noreferrer"
            >
                {{ t('modFacilitySection.openMaps') }}
            </a>
            <button
                type="button"
                class="btn btn-secondary btn-sm mod-edit-only"
                data-testid="mod-fill-from-maps"
                :disabled="filling"
                @click="fillEmptyFields"
            >
                {{ t('modFacilitySection.fillFromMaps') }}
            </button>
        </div>
        <p class="mod-edit-only text-sm text-primary-text-muted">
            {{ t('modFacilitySection.fillFromMapsHint') }}
        </p>
        <p
            v-if="status"
            class="text-sm text-primary-text"
            role="status"
            data-testid="mod-fill-from-maps-status"
        >
            {{ status }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '#imports'
import { fetchCities } from '~/utils/cityOptions'
import { parseMapsPlace, validateGoogleMapsUrlInput } from '~/utils/formValidations'
import {
    fillEmptyFacilityFields,
    officialCityPatch,
    type FacilityMapsFillTarget
} from '~/utils/mapsAutofill'
import { fetchMapsPlaceDetails, type MapsPlaceDetails } from '~/utils/mapsPlaceDetails'

const props = defineProps<{
    url: string
    current: FacilityMapsFillTarget
}>()

const emit = defineEmits<{
    apply: [patch: Partial<FacilityMapsFillTarget>]
}>()

const { t } = useI18n()
const filling = ref(false)
const status = ref('')
const urlIsValid = computed(() => validateGoogleMapsUrlInput(props.url))

async function fillEmptyFields() {
    filling.value = true
    status.value = ''
    const parsed = parseMapsPlace(props.url)
    let english: MapsPlaceDetails | null = null
    let japanese: MapsPlaceDetails | null = null
    let failed = false

    try {
        const places = await Promise.all([
            fetchMapsPlaceDetails(props.url, 'en'),
            fetchMapsPlaceDetails(props.url, 'ja')
        ])
        english = places[0]
        japanese = places[1]
    } catch (error) {
        failed = true
        console.error('Reading a Maps link for autofill failed', error)
    }

    const placesPin = pinFrom(japanese) ?? pinFrom(english)
    const urlPin = parsed !== null && parsed.latitude !== null && parsed.longitude !== null
        ? { latitude: parsed.latitude, longitude: parsed.longitude }
        : null
    const pin = placesPin ?? urlPin
    let patch = fillEmptyFacilityFields(props.current, {
        nameEn: english?.name ?? null,
        nameJa: japanese?.name ?? null,
        postalCode: japanese?.postalCode ?? english?.postalCode ?? null,
        prefectureEn: english?.prefecture ?? null,
        prefectureJa: japanese?.prefecture ?? null,
        cityEn: english?.city ?? null,
        cityJa: japanese?.city ?? null,
        streetEn: english?.street ?? null,
        streetJa: japanese?.street ?? null,
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null
    })
    patch = await matchOfficialCity(patch)

    filling.value = false
    const filled = Object.keys(patch).length
    if (filled > 0) {
        emit('apply', patch)
    }

    if (filled > 0) {
        status.value = t('modFacilitySection.fillFromMapsDone', { count: filled })
        return
    }
    status.value = failed
        ? t('modFacilitySection.fillFromMapsFailed')
        : t('modFacilitySection.fillFromMapsNone')
}

function pinFrom(place: MapsPlaceDetails | null): { latitude: number, longitude: number } | null {
    if (place === null || place.latitude === null || place.longitude === null) {
        return null
    }
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
        return null
    }
    return { latitude: place.latitude, longitude: place.longitude }
}

async function matchOfficialCity(patch: Partial<FacilityMapsFillTarget>): Promise<Partial<FacilityMapsFillTarget>> {
    const prefectureEn = (patch.prefectureEn ?? props.current.prefectureEn).trim()
    if ((!patch.cityEn && !patch.cityJa) || !prefectureEn) {
        return patch
    }

    try {
        const cities = await fetchCities(prefectureEn)
        return officialCityPatch(props.current, patch, cities)
    } catch (error) {
        console.error('Matching a Maps city failed', error)
        return patch
    }
}
</script>

<template>
    <a
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-secondary btn-sm"
    >
        <SVGMapPinIcon
            class="size-4 stroke-current"
            aria-hidden="true"
        />
        {{ t('search.openInMaps') }}
    </a>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SVGMapPinIcon from '~/assets/icons/map-pin-icon.svg'

/** One Open in Google Maps button for search results and moderation. Listeners and data-testid fall through. */
defineProps<{
    href: string
}>()

const { t } = useI18n()
</script>

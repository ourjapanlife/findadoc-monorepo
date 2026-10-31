<template>
    <div
        v-show="loadingStore.isLoading"
        class="absolute z-10 size-full bg-primary-bg/70"
    >
        <div class="mt-12 flex justify-center align-middle">
            <div class="flex self-center text-4xl text-primary">
                {{ t('common.loading') }}
            </div>
            <SVGLoadingIcon
                role="img"
                alt="loading animation"
                title="loading animation"
                class="flex h-12 text-primary"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLoadingStore } from '~/stores/loadingStore'
import SVGLoadingIcon from '~/assets/icons/loading.svg'

const { t } = useI18n()
const loadingStore = useLoadingStore()
</script>

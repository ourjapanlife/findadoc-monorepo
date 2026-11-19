<template>
    <div
        v-show="loadingStore.isLoading"
        class="absolute z-10 size-full bg-primary-bg/70"
        data-testid="mod-loader"
    >
        <div class="mt-12 flex justify-center">
            <ChikoLoader size="lg" />
        </div>
    </div>
</template>

<script setup lang="ts">
import ChikoLoader from '~/components/common/ChikoLoader.vue'
import { useLoadingStore } from '~/stores/loadingStore'

const loadingStore = useLoadingStore()
</script>

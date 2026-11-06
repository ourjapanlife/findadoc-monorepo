<template>
    <RouteLoadingIndicator
        :progress="progress"
        :loading="isLoading"
        :slow="isSlow"
    />
</template>

<script setup lang="ts">
import RouteLoadingIndicator from '~/components/common/RouteLoadingIndicator.vue'
import { useRouteLoading } from '~/composables/useRouteLoading'

const { progress, isLoading, isSlow } = useRouteLoading()
</script>

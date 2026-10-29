<template>
    <BookingSubmissionDetail :booking-id="bookingId" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

definePageMeta({
    ssr: false
})

const route = useRoute()
const bookingId = computed(() => String(route.params.id ?? ''))
</script>

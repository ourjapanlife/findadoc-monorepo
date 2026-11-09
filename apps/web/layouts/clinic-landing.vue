<template>
    <div class="flex min-h-dvh w-full flex-col bg-primary-bg font-sans text-primary-text">
        <main class="flex-1">
            <slot />
        </main>
        <ClinicCreditFooter test-id-prefix="clinic-landing" />
    </div>
</template>

<script setup lang="ts">
import ClinicCreditFooter from '~/components/clinic/ClinicCreditFooter.vue'
</script>

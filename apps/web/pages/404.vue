<template>
    <NuxtLayout name="error-layout" />
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports'

/**
 * Direct /404 visits in dev and client navigation. Unknown production URLs
 * get the SSR'd 404.html from error.vue (experimental.prerenderErrorPages).
 * layout: false so this is not wrapped again by the default TopNav/Footer.
 */
definePageMeta({
    layout: false
})
</script>

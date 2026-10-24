<template>
    <section class="page-section">
        <div class="page-container-narrow">
            <p class="eyebrow">
                Find a Doc
            </p>
            <h1 class="page-title">
                Hospital staff
            </h1>
            <p class="mt-4 max-w-2xl text-primary-text-muted">
                Find a Doc staff assign people to a hospital. A hospital owner can assign staff
                at that hospital. The basic plan has three active people. Removing someone frees
                a seat and keeps the record.
            </p>
            <p class="mt-4 max-w-2xl text-primary-text-muted">
                This site is not indexed. Signing in is still required before a person can be added.
            </p>
        </div>
    </section>
</template>

<script setup lang="ts">
import { definePageMeta, useHead } from '#imports'

definePageMeta({
    middleware: ['admin-site']
})

useHead({
    title: 'Hospital staff',
    meta: [{ name: 'robots', content: 'noindex' }]
})
</script>

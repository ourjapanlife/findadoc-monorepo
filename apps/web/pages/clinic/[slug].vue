<template>
    <ClinicLanding :slug="slug" />
</template>

<script setup lang="ts">
import { createError, useRoute } from '#imports'
import ClinicLanding from '~/components/clinic/ClinicLanding.vue'

/**
 * `/clinic/{slug}` on the main site. The same page answers at `/` on
 * `{slug}.findadoc.jp` through `app.vue`. The preview middleware runs first.
 */
definePageMeta({
    layout: 'clinic-landing',
    middleware: ['online-clinic-preview']
})

const param = useRoute().params.slug
const slug = typeof param === 'string' ? param : param?.[0]
if (slug === undefined || slug.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}
</script>

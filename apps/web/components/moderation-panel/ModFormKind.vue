<template>
    <p
        class="mod-kind"
        :class="kind === 'facility' ? 'mod-kind-facility' : 'mod-kind-healthcare'"
    >
        <span
            class="size-2 rounded-full"
            :class="kind === 'facility' ? 'bg-primary' : 'bg-accent'"
            aria-hidden="true"
        />
        {{ label }}
    </p>
</template>

<script setup lang="ts">
defineProps<{
    kind: 'facility' | 'healthcare'
    label: string
}>()
</script>

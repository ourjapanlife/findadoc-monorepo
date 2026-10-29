<template>
    <div
        data-testid="my-page-app"
        class="min-h-dvh md:h-dvh w-full font-sans text-primary-text bg-primary-bg flex flex-col"
    >
        <!--
            Desktop (md+): viewport-locked app shell with an internally scrolling main —
            sidebar and list share one screen.

            Mobile: normal document flow. The old h-dvh + overflow-hidden shell stacked the
            access panel above the list and clipped both, so facilities and submissions sat
            below the fold with nothing to scroll. min-h-dvh lets the page grow; the list
            rides the document scroll.
        -->
        <TopNav class="shrink-0" />
        <main class="flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
            <slot />
        </main>
    </div>
</template>

<script lang="ts" setup>
</script>

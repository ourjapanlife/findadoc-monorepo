<template>
    <div class="flex min-h-dvh w-full flex-col bg-primary-bg font-sans text-primary-text">
        <!--
            Normal document flow: the page itself scrolls, and the footer sits after the
            content rather than being pinned above it.

            This layout used to lock to h-dvh with an internally scrolling <main>, which is
            the right shape for the map app but wrong for content pages — it pinned the
            footer to the viewport on every screen and left the document unscrollable, so
            browser scroll restoration and mobile chrome auto-hide had nothing to act on.
            The map app now has its own `search` layout, so this one is free to be a
            document.
        -->
        <TopNav class="shrink-0" />

        <main class="flex-1">
            <slot />
        </main>

        <Footer class="shrink-0" />
    </div>
</template>

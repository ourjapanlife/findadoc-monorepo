<template>
    <aside
        class="w-full min-w-0 shrink-0 rounded-xl border
        border-accent-bg bg-secondary-bg p-4
        shadow-sm transition-[width,padding] duration-200 ease-out md:max-h-full
        md:self-stretch md:overflow-y-auto md:py-6"
        :class="collapsed ? 'md:w-16 md:px-2' : 'md:w-80'"
        :aria-label="t('topNav.myPage')"
    >
        <div
            class="mb-4 flex items-center gap-2 md:mb-6"
            :class="collapsed ? 'justify-between md:justify-center' : 'justify-between'"
        >
            <h2
                class="min-w-0 text-3xl font-semibold text-primary-text md:text-4xl"
                :class="collapsed ? 'md:hidden' : ''"
            >
                {{ t('topNav.myPage') }}
            </h2>
            <button
                type="button"
                class="hidden size-9 shrink-0 items-center justify-center rounded-lg text-primary-text
                hover:bg-accent-bg/40 md:inline-flex"
                :aria-expanded="!collapsed"
                :aria-label="collapsed ? t('modDashboardLeftNav.expand') : t('modDashboardLeftNav.collapse')"
                data-testid="mod-sidebar-collapse"
                @click="collapsed = !collapsed"
            >
                <SVGDockToRight
                    class="size-6"
                    aria-hidden="true"
                />
            </button>
        </div>
        <MyPageAccessPanel :collapsed="collapsed" />
    </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SVGDockToRight from '~/assets/icons/dock-to-right.svg'
import { readModerationSidebarCollapsed, writeModerationSidebarCollapsed } from '~/utils/moderationSidebar'

const { t } = useI18n()
const collapsed = ref(readModerationSidebarCollapsed())

watch(collapsed, value => {
    writeModerationSidebarCollapsed(value)
})
</script>

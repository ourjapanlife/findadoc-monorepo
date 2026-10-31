<template>
    <aside
        class="w-full shrink-0 md:self-stretch md:max-h-full md:overflow-y-auto
        p-4 md:py-6 min-w-0
        border border-accent-bg bg-secondary-bg rounded-xl shadow-sm
        transition-[width,padding] duration-200 ease-out"
        :class="collapsed ? 'md:w-16 md:px-2' : 'md:w-80'"
        :aria-label="t('topNav.myPage')"
    >
        <div
            class="mb-4 md:mb-6 flex items-center gap-2"
            :class="collapsed ? 'justify-between md:justify-center' : 'justify-between'"
        >
            <h2
                class="text-3xl md:text-4xl font-semibold text-primary-text min-w-0"
                :class="collapsed ? 'md:hidden' : ''"
            >
                {{ t('topNav.myPage') }}
            </h2>
            <button
                type="button"
                class="hidden md:inline-flex size-9 shrink-0 items-center justify-center rounded-lg
                text-primary-text hover:bg-accent-bg/40"
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

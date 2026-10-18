<template>
    <div
        data-testid="mod-access-panel"
        class="mb-6 pb-5 border-b border-accent-bg text-base"
    >
        <div
            v-if="!accessStore.isLoaded && !accessStore.loadError"
            class="text-primary-text-muted"
            :class="collapsed ? 'md:break-words md:text-center md:text-xs' : ''"
        >
            {{ t('accessPanel.loading') }}
        </div>
        <div
            v-else-if="accessStore.loadError"
            class="text-error"
            :class="collapsed ? 'md:break-words md:text-center md:text-xs' : ''"
        >
            {{ t('accessPanel.loadError') }}
        </div>
        <template v-else>
            <div
                class="mb-3"
                :class="collapsed ? 'md:hidden' : ''"
            >
                <span class="font-medium text-primary-text block mb-1">{{ t('accessPanel.signedInAs') }}</span>
                <span class="text-primary-text-muted">{{ authStore.userId }}</span>
            </div>
            <div
                class="mb-3"
                :class="collapsed ? 'md:hidden' : ''"
            >
                <span class="font-medium text-primary-text block mb-2">{{ t('accessPanel.roles') }}</span>
                <div class="flex flex-wrap gap-2">
                    <span
                        v-for="role in accessRoles"
                        :key="role"
                        class="inline-flex items-center px-3 py-1.5 rounded-full
                        text-sm font-semibold bg-accent-bg/40 text-primary-text"
                    >
                        {{ role }}
                    </span>
                    <span
                        v-if="accessRoles.length === 0"
                        class="text-primary-text-muted"
                    >
                        {{ t('accessPanel.none') }}
                    </span>
                </div>
            </div>

            <div class="flex flex-col gap-3">
                <div
                    v-if="settingsPages.length > 0"
                    class="flex flex-col gap-1"
                >
                    <button
                        type="button"
                        class="md:hidden flex items-center justify-between py-1 text-left"
                        @click="settingsExpanded = !settingsExpanded"
                    >
                        <span class="font-bold text-primary-text">{{ t('accessPanel.sections.settings') }}</span>
                        <SVGAccordionArrow
                            class="w-4 h-4 fill-primary-text transition-transform"
                            :class="settingsExpanded ? 'rotate-180' : ''"
                            aria-hidden="true"
                        />
                    </button>
                    <span
                        class="font-bold text-primary-text"
                        :class="collapsed ? 'hidden' : 'hidden md:block'"
                    >
                        {{ t('accessPanel.sections.settings') }}
                    </span>
                    <ul class="hidden md:flex md:flex-col md:gap-1 pl-0 list-none">
                        <li
                            v-for="page in settingsPages"
                            :key="page.id"
                        >
                            <NuxtLink
                                :to="pageRoute(page)"
                                :class="sidebarNavLinkClass(page)"
                                :title="collapsed ? page.label : undefined"
                                :data-testid="`access-page-link-${page.id}`"
                                @click="onPageClick(page.listView)"
                            >
                                <component
                                    :is="page.icon"
                                    class="h-5 w-5 shrink-0"
                                    :class="page.iconClass"
                                    aria-hidden="true"
                                />
                                <span :class="collapsed ? 'md:sr-only' : ''">{{ page.label }}</span>
                            </NuxtLink>
                        </li>
                    </ul>
                    <ul
                        v-show="settingsExpanded"
                        class="md:hidden flex flex-col gap-1 pl-0 list-none"
                    >
                        <li
                            v-for="page in settingsPages"
                            :key="`${page.id}-mobile`"
                        >
                            <NuxtLink
                                :to="pageRoute(page)"
                                :class="sidebarNavLinkClass(page)"
                                :data-testid="`access-page-link-${page.id}-mobile`"
                                @click="onPageClick(page.listView)"
                            >
                                {{ page.label }}
                            </NuxtLink>
                        </li>
                    </ul>
                </div>

                <div
                    v-if="moderationPages.length > 0"
                    class="flex flex-col gap-1"
                >
                    <button
                        type="button"
                        class="md:hidden flex items-center justify-between py-1 text-left"
                        @click="moderationExpanded = !moderationExpanded"
                    >
                        <span class="font-bold text-primary-text">{{ t('accessPanel.sections.moderation') }}</span>
                        <SVGAccordionArrow
                            class="w-4 h-4 fill-primary-text transition-transform"
                            :class="moderationExpanded ? 'rotate-180' : ''"
                            aria-hidden="true"
                        />
                    </button>
                    <span
                        class="font-bold text-primary-text"
                        :class="collapsed ? 'hidden' : 'hidden md:block'"
                    >
                        {{ t('accessPanel.sections.moderation') }}
                    </span>
                    <ul class="hidden md:flex md:flex-col md:gap-1 pl-0 list-none">
                        <li
                            v-for="page in moderationPages"
                            :key="page.id"
                        >
                            <NuxtLink
                                :to="pageRoute(page)"
                                :class="sidebarNavLinkClass(page)"
                                :title="collapsed ? page.label : undefined"
                                :data-testid="`access-page-link-${page.id}`"
                                @click="onPageClick(page.listView)"
                            >
                                <component
                                    :is="page.icon"
                                    class="h-5 w-5 shrink-0"
                                    :class="page.iconClass"
                                    aria-hidden="true"
                                />
                                <span :class="collapsed ? 'md:sr-only' : ''">{{ page.label }}</span>
                            </NuxtLink>
                        </li>
                    </ul>
                    <ul
                        v-show="moderationExpanded"
                        class="md:hidden flex flex-col gap-1 pl-0 list-none"
                    >
                        <li
                            v-for="page in moderationPages"
                            :key="`${page.id}-mobile`"
                        >
                            <NuxtLink
                                :to="pageRoute(page)"
                                :class="sidebarNavLinkClass(page)"
                                :data-testid="`access-page-link-${page.id}-mobile`"
                                @click="onPageClick(page.listView)"
                            >
                                {{ page.label }}
                            </NuxtLink>
                        </li>
                    </ul>
                </div>

                <div
                    v-if="settingsPages.length === 0 && moderationPages.length === 0"
                    class="text-primary-text-muted py-1 px-2"
                >
                    {{ t('accessPanel.none') }}
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/authStore'
import { useCurrentUserAccessStore } from '~/stores/currentUserAccessStore'
import SVGSettingsIcon from '~/assets/icons/settings-icon.svg'
import SVGInbox from '~/assets/icons/inbox.svg'
import SVGFacilityIcon from '~/assets/icons/hospital-facility-icon.svg'
import SVGProfessionalIcon from '~/assets/icons/user-icon.svg'
import {
    SelectedModerationListView,
    type SelectedModerationListView as SelectedModerationListViewType
} from '~/stores/moderationSubmissionsStore'
import { useModerationSubmissionsStore } from '~/stores/moderationSubmissionsStore'
import { ModerationScreen, useModerationScreenStore } from '~/stores/moderationScreenStore'
import SVGAccordionArrow from '~/assets/icons/accordion-arrow.svg'
import { unlocalizedPath } from '~/utils/localePath'

interface NavPage {
    id: string
    route: string
    label: string
    icon: Component
    iconClass: string
    listView?: SelectedModerationListViewType
}

const props = withDefaults(defineProps<{ collapsed?: boolean }>(), {
    collapsed: false
})

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const accessStore = useCurrentUserAccessStore()
const moderationSubmissionsStore = useModerationSubmissionsStore()
const moderationScreenStore = useModerationScreenStore()

const accessRoles = computed(() => accessStore.roles)
const settingsExpanded = ref(false)
const moderationExpanded = ref(false)
const allowLinksWhileAccessUnknown = computed(() => accessStore.loadError || !accessStore.isLoaded)
const canReadSubmissions = computed(() => allowLinksWhileAccessUnknown.value || accessStore.hasScope('read:submissions'))
const canReadFacilities = computed(() => allowLinksWhileAccessUnknown.value || accessStore.hasScope('read:facilities'))
const canReadHealthcareProfessionals = computed(
    () => allowLinksWhileAccessUnknown.value || accessStore.hasScope('read:healthcareprofessionals')
)

const settingsPages = computed<NavPage[]>(() => [{
    id: 'my-page',
    route: '/my-page',
    label: t('topNav.myPage'),
    icon: SVGSettingsIcon,
    iconClass: '[&_path]:fill-current'
}])

const moderationPages = computed<NavPage[]>(() => [
    ...(canReadSubmissions.value
        ? [{
            id: 'moderation-submissions',
            route: '/my-page',
            label: t('modDashboardLeftNav.submissions'),
            icon: SVGInbox,
            iconClass: '',
            listView: SelectedModerationListView.Submissions
        }]
        : []),
    ...(canReadFacilities.value
        ? [{
            id: 'moderation-facilities',
            route: '/my-page',
            label: t('modDashboardLeftNav.facilities'),
            icon: SVGFacilityIcon,
            iconClass: '',
            listView: SelectedModerationListView.Facilities
        }]
        : []),
    ...(canReadHealthcareProfessionals.value
        ? [{
            id: 'moderation-healthcare-professionals',
            route: '/my-page',
            label: t('modDashboardLeftNav.healthcareProfessionals'),
            icon: SVGProfessionalIcon,
            iconClass: '',
            listView: SelectedModerationListView.HealthcareProfessionals
        }]
        : [])
])

function onPageClick(listView?: SelectedModerationListViewType): void {
    moderationScreenStore.setActiveScreen(ModerationScreen.Dashboard)
    if (listView) {
        moderationSubmissionsStore.setSelectedModerationListViewChosen(listView)
    }
}

function pageRoute(page: NavPage): string | { path: string, query: { view: string } } {
    if (!page.listView) {
        return page.route
    }

    const view = page.listView === SelectedModerationListView.Submissions
        ? 'submissions'
        : page.listView === SelectedModerationListView.Facilities
            ? 'facilities'
            : 'healthcare-professionals'

    return {
        path: page.route,
        query: { view }
    }
}

function sidebarNavLinkClass(page: NavPage): string {
    const collapsedLayout = props.collapsed ? ' md:justify-center md:px-1.5 md:gap-0' : ''
    const base = `flex items-center gap-2 py-2 px-3 text-sm font-medium transition-colors border-l-2 rounded-r-md${collapsedLayout}`
    const resolved = pageRoute(page)
    const targetPath = typeof resolved === 'string' ? resolved : resolved.path
    const targetView = typeof resolved === 'string'
        ? 'settings'
        : resolved.query.view

    const currentView = typeof route.query.view === 'string' ? route.query.view : 'settings'
    const isActive = unlocalizedPath(route.path) === unlocalizedPath(targetPath)
      && (page.listView ? currentView === targetView : currentView === 'settings' || currentView === '')

    return isActive
        ? `${base} border-primary text-primary-text bg-accent-bg/20`
        : `${base} border-transparent text-primary-text-muted hover:text-primary-text hover:bg-accent-bg/10`
}

async function loadIfLoggedIn(): Promise<void> {
    if (!authStore.isLoggedIn || authStore.isLoadingAuth) {
        return
    }
    if (accessStore.isLoaded) {
        return
    }
    await accessStore.fetchAccess()
}

onMounted(() => {
    void loadIfLoggedIn()
})

watch(
    () => [authStore.isLoggedIn, authStore.isLoadingAuth] as const,
    ([loggedIn, loading]) => {
        if (loggedIn && !loading && !accessStore.isLoaded) {
            void accessStore.fetchAccess()
        }
        if (!loggedIn) {
            accessStore.reset()
        }
    }
)
</script>

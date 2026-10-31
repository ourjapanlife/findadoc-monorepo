<template>
    <!--
        Out of flow so the sticky bar sits on the viewport. An in-flow `h-2` left an
        8px strip of page ground above the header.
    -->
    <div
        ref="sentinel"
        class="pointer-events-none absolute top-0 left-0 h-2 w-full"
        aria-hidden="true"
    />
    <header
        class="sticky top-0 z-30 w-full border-b bg-primary text-primary-text-inverted transition-shadow"
        :class="stuck ? 'border-primary-hover shadow-raised' : 'border-transparent'"
        data-testid="clinic-landing-header"
    >
        <div class="px-6 landscape:px-12">
            <div class="page-container flex h-16 items-center justify-between gap-4">
                <a
                    href="#top"
                    class="flex min-w-0 items-center gap-2 font-semibold"
                >
                    <span
                        class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-text-inverted/15 text-sm"
                        aria-hidden="true"
                    >{{ mark }}</span>
                    <span class="truncate">{{ name }}</span>
                </a>
                <nav
                    class="min-w-0 portrait:hidden"
                    :aria-label="navLabel"
                >
                    <ul class="m-0 flex list-none gap-1 p-0">
                        <li
                            v-for="section in sections"
                            :key="section.id"
                        >
                            <a
                                :href="`#${section.id}`"
                                class="inline-flex h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium"
                                :class="activeId === section.id
                                    ? 'bg-primary-text-inverted/20'
                                    : 'hover:bg-primary-text-inverted/10'"
                                :aria-current="activeId === section.id ? 'true' : undefined"
                            >{{ section.label }}</a>
                        </li>
                    </ul>
                </nav>
                <div class="flex shrink-0 items-center gap-2">
                    <LocaleSelector on-primary />
                    <button
                        type="button"
                        class="btn btn-sm btn-on-primary portrait:hidden"
                        data-testid="clinic-landing-header-book"
                        @click="emit('book')"
                    >
                        {{ bookLabel }}
                    </button>
                </div>
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'

const props = defineProps<{
    name: string
    navLabel: string
    bookLabel: string
    sections: readonly { id: string, label: string }[]
}>()

const emit = defineEmits<{
    book: []
}>()

const sentinel = ref<HTMLElement | null>(null)
const stuck = ref(false)
const activeId = ref<string | undefined>(undefined)
const mark = computed(() => props.name.trim().charAt(0))

let sectionObserver: IntersectionObserver | undefined

function observeSections() {
    sectionObserver?.disconnect()
    sectionObserver = new IntersectionObserver(entries => {
        const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        const id = visible?.target.id
        if (id) {
            activeId.value = id
        }
    }, { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.75] })

    for (const section of props.sections) {
        const element = document.getElementById(section.id)
        if (element) {
            sectionObserver.observe(element)
        }
    }
}

onMounted(() => {
    const marker = sentinel.value
    if (marker) {
        const stuckObserver = new IntersectionObserver(([entry]) => {
            stuck.value = entry ? !entry.isIntersecting : false
        })
        stuckObserver.observe(marker)
        onScopeDispose(() => stuckObserver.disconnect())
    }

    observeSections()
    onScopeDispose(() => sectionObserver?.disconnect())
})

watch(
    () => props.sections.map(section => section.id).join(','),
    () => {
        if (import.meta.client) {
            observeSections()
        }
    }
)
</script>

<template>
    <div
        ref="sentinel"
        class="h-2"
        aria-hidden="true"
    />
    <header
        class="sticky top-0 z-30 border-b bg-primary text-primary-text-inverted transition-shadow"
        :class="stuck ? 'border-primary-hover shadow-raised' : 'border-transparent'"
        data-testid="clinic-landing-header"
    >
        <div class="page-container flex h-16 items-center gap-3 px-6 landscape:px-12">
            <a
                href="#top"
                class="flex min-w-0 items-center gap-2 font-semibold"
            >
                <span
                    class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-text-inverted/15 text-sm"
                    aria-hidden="true"
                >{{ mark }}</span>
                <span class="truncate">{{ name }}</span>
            </a>
            <nav
                class="portrait:hidden"
                :aria-label="navLabel"
            >
                <ul class="m-0 flex list-none gap-1 p-0">
                    <li
                        v-for="section in sections"
                        :key="section.id"
                    >
                        <a
                            :href="`#${section.id}`"
                            class="inline-flex h-10 items-center rounded-lg px-3 text-sm"
                            :class="activeId === section.id
                                ? 'bg-primary-text-inverted/20'
                                : 'hover:bg-primary-text-inverted/10'"
                            :aria-current="activeId === section.id ? 'true' : undefined"
                        >{{ section.label }}</a>
                    </li>
                </ul>
            </nav>
            <div class="ml-auto flex shrink-0 items-center gap-2">
                <LocaleSelector />
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

<template>
    <section
        class="flex flex-col gap-4"
        data-testid="clinic-interpreters"
    >
        <div class="flex flex-col gap-1">
            <h3 class="text-lg font-bold text-primary-text">
                {{ t('clinicDashboard.interpreters.heading') }}
            </h3>
            <p class="text-sm text-primary-text-muted">
                {{ t('clinicDashboard.interpreters.help') }}
            </p>
        </div>

        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.loadError') }}
        </p>
        <p
            v-else-if="drafts.length === 0"
            class="text-sm text-primary-text-muted"
        >
            {{ t('clinicDashboard.interpreters.none') }}
        </p>

        <form
            v-for="draft in drafts"
            :key="draft.key"
            class="flex flex-col gap-4 rounded-lg border border-accent-bg p-4"
            data-testid="clinic-interpreter"
            @submit.prevent="save(draft)"
        >
            <div class="flex flex-col gap-1">
                <label
                    :for="`interpreter-label-${draft.key}`"
                    class="field-label"
                >
                    {{ t('clinicDashboard.interpreters.label') }}
                </label>
                <input
                    :id="`interpreter-label-${draft.key}`"
                    v-model="draft.label"
                    type="text"
                    class="field"
                    maxlength="80"
                    required
                    :placeholder="t('clinicDashboard.interpreters.labelPlaceholder')"
                    data-testid="clinic-interpreter-label"
                >
            </div>

            <fieldset class="flex flex-col gap-2">
                <legend class="field-label">
                    {{ t('clinicDashboard.interpreters.languages') }}
                </legend>
                <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        v-model="draft.allLanguages"
                        type="radio"
                        class="size-4 accent-primary"
                        :name="`interpreter-languages-${draft.key}`"
                        :value="true"
                    >
                    {{ t('clinicDashboard.interpreters.allLanguages') }}
                </label>
                <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        v-model="draft.allLanguages"
                        type="radio"
                        class="size-4 accent-primary"
                        :name="`interpreter-languages-${draft.key}`"
                        :value="false"
                        data-testid="clinic-interpreter-some-languages"
                    >
                    {{ t('clinicDashboard.interpreters.someLanguages') }}
                </label>
                <div
                    v-if="!draft.allLanguages"
                    class="ml-6 flex flex-wrap gap-2"
                >
                    <label
                        v-for="language in sortedLanguages"
                        :key="language"
                        class="inline-flex cursor-pointer items-center gap-2 text-sm"
                    >
                        <input
                            v-model="draft.languages"
                            type="checkbox"
                            class="size-4 accent-primary"
                            :value="language"
                            :data-testid="`clinic-interpreter-language-${language}`"
                        >
                        {{ languageName(language, locale) }}
                    </label>
                </div>
            </fieldset>

            <div class="flex flex-col gap-1">
                <label
                    :for="`interpreter-capacity-${draft.key}`"
                    class="field-label"
                >
                    {{ t('clinicDashboard.interpreters.capacity') }}
                </label>
                <select
                    :id="`interpreter-capacity-${draft.key}`"
                    v-model="draft.capacity"
                    class="field w-40"
                    data-testid="clinic-interpreter-capacity"
                >
                    <option :value="null">
                        {{ t('clinicDashboard.interpreters.noLimit') }}
                    </option>
                    <option
                        v-for="count in CAPACITY_OPTIONS"
                        :key="count"
                        :value="count"
                    >
                        {{ count }}
                    </option>
                </select>
            </div>

            <fieldset class="flex flex-col gap-2">
                <legend class="field-label">
                    {{ t('clinicDashboard.interpreters.hours') }}
                </legend>
                <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        v-model="draft.alwaysAvailable"
                        type="radio"
                        class="size-4 accent-primary"
                        :name="`interpreter-hours-${draft.key}`"
                        :value="true"
                    >
                    {{ t('clinicDashboard.interpreters.always') }}
                </label>
                <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        v-model="draft.alwaysAvailable"
                        type="radio"
                        class="size-4 accent-primary"
                        :name="`interpreter-hours-${draft.key}`"
                        :value="false"
                        data-testid="clinic-interpreter-set-hours"
                    >
                    {{ t('clinicDashboard.interpreters.setHours') }}
                </label>
                <WeeklyHoursFields
                    v-if="!draft.alwaysAvailable"
                    v-model:blocks="draft.blocks"
                    :testid-prefix="`clinic-interpreter-hours-${draft.key}`"
                />
            </fieldset>

            <p
                v-if="problem(draft) !== null"
                class="field-error"
                role="alert"
            >
                {{ problem(draft) }}
            </p>

            <div class="flex flex-wrap items-center gap-3 border-t border-accent-bg pt-4">
                <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="draft.saving || problem(draft) !== null"
                    :aria-busy="draft.saving"
                    data-testid="clinic-interpreter-save"
                >
                    <ButtonSpinner v-if="draft.saving" />
                    {{ t('clinicDashboard.interpreters.save') }}
                </button>
                <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="draft.saving"
                    data-testid="clinic-interpreter-remove"
                    @click="remove(draft)"
                >
                    {{ t('clinicDashboard.interpreters.remove') }}
                </button>
            </div>
        </form>

        <button
            type="button"
            class="btn btn-secondary w-fit"
            data-testid="clinic-interpreter-add"
            @click="addDraft"
        >
            {{ t('clinicDashboard.interpreters.add') }}
        </button>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ClinicInterpreter, Locale } from '@findadoc/graphql'
import WeeklyHoursFields from '~/components/booking/WeeklyHoursFields.vue'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import { deleteClinicInterpreter, fetchClinicInterpreters, saveClinicInterpreter } from '~/utils/booking/staffQuery'
import { blocksOverlap, editableBlocks, hoursInput, type EditableBlock } from '~/utils/booking/weeklyHoursBlocks'
import { languageName } from '~/utils/languageName'

/**
 * A clinic's interpreters (#205, apps/server/docs/booking-interpretation.md).
 * Each choice has an "all" default: every language the clinic offers, whenever the
 * clinic is open, and no limit on visits at once.
 */
const props = defineProps<{
    facilityId: string
    clinicLanguages: readonly Locale[]
}>()

const { t, locale } = useI18n()
const toast = useAppToast()

const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 10]

type Draft = {
    key: string
    id: string | null
    label: string
    allLanguages: boolean
    languages: Locale[]
    capacity: number | null
    alwaysAvailable: boolean
    blocks: EditableBlock[]
    saving: boolean
}

const drafts = ref<Draft[]>([])
const loadError = ref(false)
let draftCount = 0

const sortedLanguages = computed(() => [...props.clinicLanguages]
    .sort((a, b) => languageName(a, locale.value).localeCompare(languageName(b, locale.value), locale.value)))

function draftFrom(interpreter: ClinicInterpreter | null): Draft {
    draftCount += 1
    const languages = interpreter?.languages ?? null
    return {
        key: interpreter?.id ?? `new-${draftCount}`,
        id: interpreter?.id ?? null,
        label: interpreter?.label ?? '',
        allLanguages: languages === null,
        languages: [...(languages ?? [])],
        capacity: interpreter?.capacity ?? null,
        alwaysAvailable: (interpreter?.hours.length ?? 0) === 0,
        blocks: editableBlocks(interpreter?.hours ?? []),
        saving: false
    }
}

/** Why this draft cannot be saved yet, or null. */
function problem(draft: Draft): string | null {
    if (!draft.allLanguages && draft.languages.length === 0) {
        return t('clinicDashboard.interpreters.pickLanguage')
    }
    if (!draft.alwaysAvailable && (draft.blocks.length === 0 || blocksOverlap(draft.blocks))) {
        return t('clinicDashboard.weeklyHours.invalid')
    }
    return null
}

function addDraft(): void {
    drafts.value = [...drafts.value, draftFrom(null)]
}

async function load(): Promise<void> {
    const loaded = await fetchClinicInterpreters(props.facilityId)
    loadError.value = loaded === null
    drafts.value = (loaded ?? []).map(draftFrom)
}

async function save(draft: Draft): Promise<void> {
    if (problem(draft) !== null) {
        return
    }
    draft.saving = true
    const saved = await saveClinicInterpreter({
        id: draft.id,
        facilityId: props.facilityId,
        label: draft.label.trim(),
        languages: draft.allLanguages ? null : draft.languages,
        capacity: draft.capacity,
        hours: draft.alwaysAvailable ? [] : hoursInput(draft.blocks)
    })
    draft.saving = false
    if (saved === null) {
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    drafts.value = drafts.value.map(item => item.key === draft.key ? draftFrom(saved) : item)
    toast.success(t('clinicDashboard.saved'))
}

async function remove(draft: Draft): Promise<void> {
    if (draft.id === null) {
        drafts.value = drafts.value.filter(item => item.key !== draft.key)
        return
    }
    draft.saving = true
    const removed = await deleteClinicInterpreter(draft.id)
    draft.saving = false
    if (!removed) {
        toast.error(t('clinicDashboard.interpreters.removeFailed'))
        return
    }
    drafts.value = drafts.value.filter(item => item.key !== draft.key)
}

onMounted(load)
</script>

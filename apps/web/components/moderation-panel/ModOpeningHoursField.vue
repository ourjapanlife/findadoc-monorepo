<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-opening-hours"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modFacilitySection.openingHoursLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modFacilitySection.openingHoursHint') }}
        </p>
        <div
            v-for="day in OPENING_DAYS"
            :key="day"
            class="flex flex-col gap-2"
            :data-testid="`mod-facility-section-opening-hours-${day}`"
        >
            <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-primary-text">{{ openingDayLabel(day, t) }}</span>
                <button
                    v-if="isEditing && blocksFor(day).length < MAX_OPENING_BLOCKS_PER_DAY"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :data-testid="`mod-facility-section-opening-hours-${day}-add`"
                    @click="addBlock(day)"
                >
                    {{ t('modFacilitySection.openingHoursAdd') }}
                </button>
            </div>
            <p
                v-if="!blocksFor(day).length"
                class="m-0 text-sm text-primary-text-muted"
            >
                {{ hours.length ? t('openingHours.closed') : t('modFacilitySection.openingHoursUnknown') }}
            </p>
            <div
                v-for="entry in blocksFor(day)"
                :key="entry.index"
                class="flex flex-wrap items-end gap-2"
            >
                <label class="flex flex-col gap-1 text-xs text-primary-text-muted">
                    {{ t('modFacilitySection.openingHoursOpens') }}
                    <input
                        type="time"
                        class="field"
                        :value="entry.block.opens"
                        :disabled="!isEditing"
                        :data-testid="`mod-facility-section-opening-hours-${day}-opens-${entry.position}`"
                        @change="setTime(entry.index, 'opens', $event)"
                    >
                </label>
                <label class="flex flex-col gap-1 text-xs text-primary-text-muted">
                    {{ t('modFacilitySection.openingHoursCloses') }}
                    <!-- A time input cannot hold 24:00, so the end of the day is its own checkbox. -->
                    <input
                        type="time"
                        class="field"
                        :value="entry.block.closes === END_OF_DAY ? '' : entry.block.closes"
                        :disabled="!isEditing || entry.block.closes === END_OF_DAY"
                        :data-testid="`mod-facility-section-opening-hours-${day}-closes-${entry.position}`"
                        @change="setTime(entry.index, 'closes', $event)"
                    >
                </label>
                <label class="flex items-center gap-2 text-xs text-primary-text-muted">
                    <input
                        type="checkbox"
                        :checked="entry.block.closes === END_OF_DAY"
                        :disabled="!isEditing"
                        :data-testid="`mod-facility-section-opening-hours-${day}-midnight-${entry.position}`"
                        @change="setUntilMidnight(entry.index, $event)"
                    >
                    {{ t('modFacilitySection.openingHoursUntilMidnight') }}
                </label>
                <button
                    v-if="isEditing"
                    type="button"
                    class="btn btn-ghost btn-sm"
                    :aria-label="t('modFacilitySection.openingHoursRemove', { day: openingDayLabel(day, t) })"
                    :data-testid="`mod-facility-section-opening-hours-${day}-remove-${entry.position}`"
                    @click="removeBlock(entry.index)"
                >
                    {{ t('modFacilitySection.openingHoursRemoveShort') }}
                </button>
            </div>
        </div>
        <p
            v-if="problem"
            class="m-0 text-sm text-error"
            role="alert"
            data-testid="mod-facility-section-opening-hours-error"
        >
            {{ t('modFacilitySection.openingHoursInvalid') }}
        </p>
        <button
            v-if="isEditing && hours.length"
            type="button"
            class="btn btn-ghost btn-sm self-start"
            data-testid="mod-facility-section-opening-hours-clear"
            @click="hours = []"
        >
            {{ t('modFacilitySection.openingHoursClear') }}
        </button>
    </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '#imports'
import type { OpeningDay, OpeningHours } from '@findadoc/graphql'
import { MAX_OPENING_BLOCKS_PER_DAY, OPENING_DAYS, openingHoursProblem } from '@findadoc/utils'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import { openingDayLabel } from '~/utils/openingHours'

/**
 * Published opening hours (#294), in Japan time, from the clinic's own site or a call — never
 * from Places. No blocks at all is unknown. Once any block exists, a day without one is closed.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()

const END_OF_DAY = '24:00'

const hours = defineModel<OpeningHours[]>({ required: true })

/** The blocks for one day, with their place in the whole list so edits reach the right one. */
function blocksFor(day: OpeningDay) {
    return hours.value
        .map((block, index) => ({ block, index }))
        .filter(entry => entry.block.day === day)
        .map((entry, position) => ({ ...entry, position }))
}

function addBlock(day: OpeningDay) {
    const last = blocksFor(day).at(-1)?.block
    // A second block on a day usually follows a lunch break. Its closing time is left for the moderator.
    const block = last
        ? { day, opens: last.closes === END_OF_DAY ? '' : last.closes, closes: '' }
        : { day, opens: '09:00', closes: '18:00' }
    hours.value = [...hours.value, block]
}

function removeBlock(index: number) {
    hours.value = hours.value.filter((block, position) => position !== index)
}

function setBlock(index: number, change: Partial<OpeningHours>) {
    hours.value = hours.value.map((block, position) => (position === index ? { ...block, ...change } : block))
}

/** 23:59 stays 23:59. Only the checkbox stores 24:00, the end of the day. */
function setTime(index: number, field: 'opens' | 'closes', event: Event) {
    if (event.target instanceof HTMLInputElement) {
        setBlock(index, { [field]: event.target.value })
    }
}

/** Unchecking leaves the closing time blank, so the moderator enters the real one. */
function setUntilMidnight(index: number, event: Event) {
    if (event.target instanceof HTMLInputElement) {
        setBlock(index, { closes: event.target.checked ? END_OF_DAY : '' })
    }
}

const problem = computed(() => openingHoursProblem(hours.value))
</script>

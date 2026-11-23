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
        <p
            v-if="!hours.length"
            class="m-0 text-sm font-medium text-primary-text"
            data-testid="mod-facility-section-opening-hours-unknown"
        >
            {{ t('modFacilitySection.openingHoursUnknown') }}
        </p>
        <ul class="m-0 flex list-none flex-col divide-y divide-accent-bg rounded-lg border border-accent-bg p-0">
            <li
                v-for="day in OPENING_DAYS"
                :key="day"
                class="flex flex-col gap-3 p-3 landscape:flex-row landscape:items-start"
                :data-testid="`mod-facility-section-opening-hours-${day}`"
            >
                <label class="flex w-44 shrink-0 cursor-pointer items-center gap-3 pt-2">
                    <input
                        type="checkbox"
                        class="size-5 accent-primary"
                        :checked="blocksFor(day).length > 0"
                        :disabled="!isEditing"
                        :data-testid="`mod-facility-section-opening-hours-${day}-open`"
                        @change="toggleDay(day)"
                    >
                    <span class="font-semibold text-primary-text">{{ openingDayLabel(day, t) }}</span>
                </label>
                <p
                    v-if="!blocksFor(day).length"
                    class="m-0 pt-2 text-sm text-primary-text-muted"
                >
                    {{ hours.length ? t('openingHours.closed') : t('modFacilitySection.openingHoursUnknown') }}
                </p>
                <div
                    v-else
                    class="flex flex-1 flex-col gap-2"
                >
                    <template
                        v-for="(entry, position) in blocksFor(day)"
                        :key="entry.index"
                    >
                        <p
                            v-if="breakBefore(day, position)"
                            class="m-0 text-xs text-primary-text-muted"
                            :data-testid="`mod-facility-section-opening-hours-${day}-break-${position - 1}`"
                        >
                            {{ t('modFacilitySection.openingHoursBreak', breakBefore(day, position) ?? {}) }}
                        </p>
                        <div class="flex flex-wrap items-center gap-2">
                            <select
                                class="field w-28"
                                :value="entry.block.opens"
                                :disabled="!isEditing"
                                :aria-label="t('modFacilitySection.openingHoursOpensOn', { day: openingDayLabel(day, t) })"
                                :data-testid="`mod-facility-section-opening-hours-${day}-opens-${position}`"
                                @change="setTime(entry.index, 'opens', $event)"
                            >
                                <option
                                    v-for="time in openingTimeOptions(entry.block.opens)"
                                    :key="time"
                                    :value="time"
                                >
                                    {{ time }}
                                </option>
                            </select>
                            <span
                                class="text-primary-text-muted"
                                aria-hidden="true"
                            >–</span>
                            <select
                                class="field w-28"
                                :value="entry.block.closes"
                                :disabled="!isEditing"
                                :aria-label="t('modFacilitySection.openingHoursClosesOn', { day: openingDayLabel(day, t) })"
                                :data-testid="`mod-facility-section-opening-hours-${day}-closes-${position}`"
                                @change="setTime(entry.index, 'closes', $event)"
                            >
                                <option
                                    v-if="!entry.block.closes"
                                    value=""
                                    disabled
                                >
                                    –
                                </option>
                                <option
                                    v-for="time in closingTimeOptions(entry.block.opens, entry.block.closes)"
                                    :key="time"
                                    :value="time"
                                >
                                    {{ time }}
                                </option>
                            </select>
                            <button
                                v-if="isEditing"
                                type="button"
                                class="btn btn-ghost btn-sm"
                                :aria-label="t('modFacilitySection.openingHoursRemove', { day: openingDayLabel(day, t) })"
                                :data-testid="`mod-facility-section-opening-hours-${day}-remove-${position}`"
                                @click="removeBlock(entry.index)"
                            >
                                {{ t('modFacilitySection.openingHoursRemoveShort') }}
                            </button>
                        </div>
                    </template>
                    <div
                        v-if="isEditing"
                        class="flex flex-wrap gap-2"
                    >
                        <button
                            v-if="blocksFor(day).length < MAX_OPENING_BLOCKS_PER_DAY"
                            type="button"
                            class="btn btn-ghost btn-sm text-primary"
                            :data-testid="`mod-facility-section-opening-hours-${day}-add-break`"
                            @click="hours = addBreak(hours, day)"
                        >
                            {{ t('modFacilitySection.openingHoursAddBreak') }}
                        </button>
                        <button
                            v-if="day === OpeningDay.Monday"
                            type="button"
                            class="btn btn-ghost btn-sm text-primary"
                            data-testid="mod-facility-section-opening-hours-copy-weekdays"
                            @click="hours = copyMondayToWeekdays(hours)"
                        >
                            {{ t('modFacilitySection.openingHoursCopyWeekdays') }}
                        </button>
                    </div>
                </div>
            </li>
        </ul>
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
import { OpeningDay, type OpeningHours } from '@findadoc/graphql'
import { MAX_OPENING_BLOCKS_PER_DAY, OPENING_DAYS, openingHoursProblem } from '@findadoc/utils'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import { openingDayLabel } from '~/utils/openingHours'
import {
    addBreak,
    blocksForDay,
    breaksForDay,
    closeDay,
    closingTimeOptions,
    copyMondayToWeekdays,
    openDay,
    openingTimeOptions
} from '~/utils/openingHoursEditor'

/**
 * Published opening hours (#294), in Japan time, from the clinic's own site or a call — never
 * from Places. Laid out like the clinic dashboard's weekly hours: a row per day, a checkbox to
 * open it, and a break is the gap between two blocks. No blocks at all is unknown. Once any
 * block exists, a day without one is closed.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()

const hours = defineModel<OpeningHours[]>({ required: true })

function blocksFor(day: OpeningDay) {
    return blocksForDay(hours.value, day)
}

/** The break that ends where this block opens, if there is one. */
function breakBefore(day: OpeningDay, position: number) {
    return position > 0 ? breaksForDay(hours.value, day)[position - 1] ?? null : null
}

function toggleDay(day: OpeningDay) {
    hours.value = blocksFor(day).length ? closeDay(hours.value, day) : openDay(hours.value, day)
}

function removeBlock(index: number) {
    hours.value = hours.value.filter((block, position) => position !== index)
}

function setTime(index: number, field: 'opens' | 'closes', event: Event) {
    if (event.target instanceof HTMLSelectElement) {
        const value = event.target.value
        hours.value = hours.value.map((block, position) => (position === index ? { ...block, [field]: value } : block))
    }
}

const problem = computed(() => openingHoursProblem(hours.value))
</script>

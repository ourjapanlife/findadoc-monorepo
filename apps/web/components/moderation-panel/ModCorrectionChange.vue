<template>
    <div
        class="flex flex-col gap-3 rounded-lg border border-accent-bg bg-secondary-bg p-4"
        :data-testid="`mod-correction-change-${row.field}`"
    >
        <h4 class="text-sm font-semibold text-primary-text">
            {{ t(row.labelKey) }}
        </h4>
        <div class="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
            <div class="flex flex-col gap-1">
                <span class="text-xs font-semibold tracking-wide text-primary-text-muted uppercase">
                    {{ t('modCorrectionReview.before') }}
                </span>
                <div
                    class="flex flex-col gap-1"
                    :data-testid="`mod-correction-before-${row.field}`"
                >
                    <p
                        v-if="row.before.length === 0"
                        class="m-0 text-sm text-primary-text-muted italic"
                    >
                        {{ t('modCorrectionReview.emptyValue') }}
                    </p>
                    <ul
                        v-else-if="row.list"
                        class="m-0 flex list-none flex-wrap gap-1.5 p-0"
                    >
                        <li
                            v-for="value in row.before"
                            :key="value"
                            class="rounded-full border px-2.5 py-0.5 text-sm"
                            :class="row.removed.includes(value)
                                ? 'border-error/50 bg-error/10 text-primary-text line-through'
                                : 'border-accent-bg text-primary-text'"
                        >
                            {{ valueLabel(value) }}
                            <span
                                v-if="row.removed.includes(value)"
                                class="sr-only"
                            >({{ t('modCorrectionReview.removed') }})</span>
                        </li>
                    </ul>
                    <template v-else>
                        <p
                            v-for="line in row.before"
                            :key="line"
                            class="m-0 text-sm wrap-anywhere text-primary-text"
                        >
                            {{ line }}
                        </p>
                    </template>
                </div>
            </div>
            <span
                class="hidden pt-6 text-lg text-primary-text-muted md:block"
                aria-hidden="true"
            >→</span>
            <div class="flex flex-col gap-1">
                <span class="text-xs font-semibold tracking-wide text-primary uppercase">
                    {{ t('modCorrectionReview.after') }}
                </span>
                <div
                    class="flex flex-col gap-1"
                    :data-testid="`mod-correction-after-${row.field}`"
                >
                    <p
                        v-if="row.after.length === 0"
                        class="m-0 text-sm text-primary-text-muted italic"
                    >
                        {{ t('modCorrectionReview.emptyValue') }}
                    </p>
                    <ul
                        v-else-if="row.list"
                        class="m-0 flex list-none flex-wrap gap-1.5 p-0"
                    >
                        <li
                            v-for="value in row.after"
                            :key="value"
                            class="rounded-full border px-2.5 py-0.5 text-sm text-primary-text"
                            :class="row.added.includes(value)
                                ? 'border-success/60 bg-success/10 font-semibold'
                                : 'border-accent-bg'"
                        >
                            <span
                                v-if="row.added.includes(value)"
                                aria-hidden="true"
                            >+ </span>{{ valueLabel(value) }}
                            <span
                                v-if="row.added.includes(value)"
                                class="sr-only"
                            >({{ t('modCorrectionReview.added') }})</span>
                        </li>
                    </ul>
                    <template v-else>
                        <p
                            v-for="line in row.after"
                            :key="line"
                            class="m-0 text-sm font-semibold wrap-anywhere text-primary-text"
                        >
                            {{ line }}
                        </p>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { localeDisplayOptions } from '~/stores/localeStore'
import { PAYMENT_TYPE_OPTIONS } from '~/utils/facilityCorrection'
import type { CorrectionChangeRow } from '~/utils/facilityCorrectionReview'

/** One field of a clinic correction (#22): what the clinic page says now, and what the visitor sent. */
const props = defineProps<{
    row: CorrectionChangeRow
}>()

const { t } = useI18n()

function valueLabel(value: string): string {
    if (props.row.field === 'supportedLanguages') {
        return localeDisplayOptions.find(option => option.code === value)?.simpleText ?? value
    }
    if (props.row.field === 'paymentOptions') {
        const option = PAYMENT_TYPE_OPTIONS.find(candidate => candidate.paymentType === value)
        return option ? t(option.labelKey) : value
    }
    return value
}
</script>

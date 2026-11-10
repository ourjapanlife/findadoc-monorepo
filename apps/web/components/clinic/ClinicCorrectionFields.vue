<template>
    <div class="flex flex-col gap-5">
        <fieldset
            v-if="fields.includes('address')"
            data-testid="clinic-correction-field-address"
            class="m-0 flex min-w-0 flex-col gap-3 rounded-lg border border-accent-bg p-4"
        >
            <legend class="px-1 text-sm font-semibold text-primary-text">
                <ClinicCorrectionReasonIcon
                    :reason="FacilityCorrectionReason.WrongCity"
                    class="inline-block align-text-bottom"
                />
                {{ t('clinicCorrection.addressLegend') }}
            </legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label
                        for="clinic-correction-postal-code"
                        class="field-label"
                    >{{ t('clinicCorrection.postalCode') }}</label>
                    <input
                        id="clinic-correction-postal-code"
                        :value="model.address.postalCode"
                        type="text"
                        class="field"
                        autocomplete="off"
                        inputmode="numeric"
                        :maxlength="FIELD_LIMITS.postalCode"
                        @input="setAddress('postalCode', inputValue($event))"
                    >
                </div>
                <div>
                    <label
                        for="clinic-correction-prefecture"
                        class="field-label"
                    >{{ t('clinicCorrection.prefecture') }}</label>
                    <select
                        id="clinic-correction-prefecture"
                        :value="japanese ? model.address.prefectureJa : model.address.prefectureEn"
                        class="field"
                        @change="setPrefecture(inputValue($event))"
                    >
                        <option
                            v-for="prefecture in prefectureOptions"
                            :key="prefecture"
                            :value="prefecture"
                        >
                            {{ prefecture }}
                        </option>
                    </select>
                </div>
            </div>
            <div>
                <label
                    for="clinic-correction-city"
                    class="field-label"
                >{{ t('clinicCorrection.city') }}</label>
                <input
                    id="clinic-correction-city"
                    :value="model.address[addressKeys.city]"
                    type="text"
                    class="field"
                    autocomplete="off"
                    :maxlength="FIELD_LIMITS.city"
                    @input="setAddress(addressKeys.city, inputValue($event))"
                >
            </div>
            <div>
                <label
                    for="clinic-correction-line1"
                    class="field-label"
                >{{ t('clinicCorrection.addressLine1') }}</label>
                <input
                    id="clinic-correction-line1"
                    :value="model.address[addressKeys.line1]"
                    type="text"
                    class="field"
                    autocomplete="off"
                    :maxlength="FIELD_LIMITS.addressLine"
                    @input="setAddress(addressKeys.line1, inputValue($event))"
                >
            </div>
            <div>
                <label
                    for="clinic-correction-line2"
                    class="field-label"
                >{{ t('clinicCorrection.addressLine2') }}</label>
                <input
                    id="clinic-correction-line2"
                    :value="model.address[addressKeys.line2]"
                    type="text"
                    class="field"
                    autocomplete="off"
                    :maxlength="FIELD_LIMITS.addressLine"
                    :aria-invalid="errors.address ? 'true' : undefined"
                    :aria-describedby="errors.address ? 'clinic-correction-address-error' : undefined"
                    @input="setAddress(addressKeys.line2, inputValue($event))"
                >
                <p
                    v-if="errors.address"
                    id="clinic-correction-address-error"
                    class="field-error"
                >
                    {{ t(errors.address) }}
                </p>
            </div>
        </fieldset>

        <fieldset
            v-if="fields.includes('languages')"
            data-testid="clinic-correction-field-languages"
            class="m-0 min-w-0 rounded-lg border border-accent-bg p-4"
        >
            <legend class="px-1 text-sm font-semibold text-primary-text">
                <ClinicCorrectionReasonIcon
                    :reason="FacilityCorrectionReason.WrongLanguages"
                    class="inline-block align-text-bottom"
                />
                {{ t('clinicCorrection.languagesLegend') }}
            </legend>
            <p
                id="clinic-correction-languages-hint"
                class="field-hint mt-0 mb-3"
            >
                {{ t('clinicCorrection.languagesHint') }}
            </p>
            <div
                class="flex flex-wrap gap-2"
                aria-describedby="clinic-correction-languages-hint"
            >
                <button
                    v-for="language in languageOptions"
                    :key="language"
                    type="button"
                    class="chip h-10 transition-colors hover:border-primary"
                    :class="{ 'chip-primary': model.supportedLanguages.includes(language) }"
                    :aria-pressed="model.supportedLanguages.includes(language)"
                    :data-testid="`clinic-correction-language-${language}`"
                    @click="toggleLanguage(language)"
                >
                    {{ languageLabel(language) }}
                </button>
            </div>
        </fieldset>

        <fieldset
            v-if="fields.includes('payment')"
            data-testid="clinic-correction-field-payment"
            class="m-0 min-w-0 rounded-lg border border-accent-bg p-4"
        >
            <legend class="px-1 text-sm font-semibold text-primary-text">
                <ClinicCorrectionReasonIcon
                    :reason="FacilityCorrectionReason.WrongPayment"
                    class="inline-block align-text-bottom"
                />
                {{ t('clinicCorrection.paymentLegend') }}
            </legend>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                    v-for="option in PAYMENT_TYPE_OPTIONS"
                    :key="option.paymentType"
                    class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-accent-bg px-3
                        has-checked:border-primary has-checked:bg-primary/5"
                >
                    <input
                        type="checkbox"
                        class="size-4 accent-primary"
                        :checked="model.paymentTypes.includes(option.paymentType)"
                        :data-testid="`clinic-correction-payment-${option.paymentType}`"
                        @change="togglePayment(option.paymentType)"
                    >
                    <span class="text-primary-text">{{ t(option.labelKey) }}</span>
                </label>
            </div>
        </fieldset>

        <fieldset
            v-if="fields.includes('contact')"
            data-testid="clinic-correction-field-contact"
            class="m-0 flex min-w-0 flex-col gap-3 rounded-lg border border-accent-bg p-4"
        >
            <legend class="px-1 text-sm font-semibold text-primary-text">
                <ClinicCorrectionReasonIcon
                    :reason="FacilityCorrectionReason.WrongContact"
                    class="inline-block align-text-bottom"
                />
                {{ t('clinicCorrection.contactLegend') }}
            </legend>
            <div>
                <label
                    for="clinic-correction-phone"
                    class="field-label"
                >{{ t('clinicCorrection.phone') }}</label>
                <input
                    id="clinic-correction-phone"
                    :value="model.phone"
                    type="tel"
                    class="field"
                    autocomplete="off"
                    :maxlength="FIELD_LIMITS.phone"
                    data-testid="clinic-correction-phone"
                    :aria-invalid="errors.phone ? 'true' : undefined"
                    :aria-describedby="errors.phone ? 'clinic-correction-phone-error' : undefined"
                    @input="update({ phone: inputValue($event) })"
                >
                <p
                    v-if="errors.phone"
                    id="clinic-correction-phone-error"
                    class="field-error"
                >
                    {{ t(errors.phone) }}
                </p>
            </div>
            <div>
                <label
                    for="clinic-correction-website"
                    class="field-label"
                >{{ t('clinicCorrection.website') }}</label>
                <input
                    id="clinic-correction-website"
                    :value="model.website"
                    type="url"
                    class="field"
                    autocomplete="off"
                    :maxlength="FIELD_LIMITS.website"
                    data-testid="clinic-correction-website"
                    :aria-invalid="errors.website ? 'true' : undefined"
                    :aria-describedby="errors.website ? 'clinic-correction-website-error' : 'clinic-correction-website-hint'"
                    @input="update({ website: inputValue($event) })"
                >
                <p
                    v-if="errors.website"
                    id="clinic-correction-website-error"
                    class="field-error"
                >
                    {{ t(errors.website) }}
                </p>
                <p
                    v-else
                    id="clinic-correction-website-hint"
                    class="field-hint"
                >
                    {{ t('clinicCorrection.websiteHint') }}
                </p>
            </div>
        </fieldset>

        <div
            v-if="fields.includes('duplicate')"
            data-testid="clinic-correction-field-duplicate"
        >
            <label
                for="clinic-correction-duplicate"
                class="field-label"
            >
                <ClinicCorrectionReasonIcon
                    :reason="FacilityCorrectionReason.Duplicate"
                    class="inline-block align-text-bottom"
                />
                {{ t('clinicCorrection.duplicateLabel') }}
                <span class="font-normal text-primary-text-muted">({{ t('clinicCorrection.optional') }})</span>
            </label>
            <input
                id="clinic-correction-duplicate"
                :value="model.duplicateListingUrl"
                type="url"
                class="field"
                autocomplete="off"
                :maxlength="FIELD_LIMITS.listingUrl"
                placeholder="https://findadoc.jp/clinic/…"
                data-testid="clinic-correction-duplicate"
                :aria-invalid="errors.duplicateListingUrl ? 'true' : undefined"
                :aria-describedby="errors.duplicateListingUrl
                    ? 'clinic-correction-duplicate-error'
                    : 'clinic-correction-duplicate-hint'"
                @input="update({ duplicateListingUrl: inputValue($event) })"
            >
            <p
                v-if="errors.duplicateListingUrl"
                id="clinic-correction-duplicate-error"
                class="field-error"
            >
                {{ t(errors.duplicateListingUrl) }}
            </p>
            <p
                v-else
                id="clinic-correction-duplicate-hint"
                class="field-hint"
            >
                {{ t('clinicCorrection.duplicateHint') }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FacilityCorrectionReason, type Locale, type PaymentType, type PhysicalAddressInput } from '@findadoc/graphql'
import { FIELD_LIMITS } from '@findadoc/utils'
import { localeDisplayOptions } from '~/stores/localeStore'
import { listPrefectureJapanEn, listPrefectureJapanJa } from '~/stores/locationsStore'
import { isJapaneseLocale } from '~/utils/activeLocale'
import {
    PAYMENT_TYPE_OPTIONS,
    addressWithPrefecture,
    type CorrectionDraft,
    type CorrectionDraftField,
    type CorrectionFieldGroup
} from '~/utils/facilityCorrection'

/**
 * One block per picked reason (#22), pre-filled with what the page shows.
 * The visitor edits the address in the site's language; the other language stays as stored and a
 * moderator checks both before approving. A city is never taken from here: the moderator picks it.
 */
const props = defineProps<{
    fields: CorrectionFieldGroup[]
    languageOptions: Locale[]
    errors: Partial<Record<CorrectionDraftField, string>>
}>()

const model = defineModel<CorrectionDraft>({ required: true })

const { t, locale } = useI18n()

const japanese = computed(() => isJapaneseLocale(locale.value))

const addressKeys = computed(() => (japanese.value
    ? { city: 'cityJa', line1: 'addressLine1Ja', line2: 'addressLine2Ja' } as const
    : { city: 'cityEn', line1: 'addressLine1En', line2: 'addressLine2En' } as const))

/** Every prefecture, plus the stored one if it is spelled differently, so the select never drops it. */
const prefectureOptions = computed(() => {
    const list = japanese.value ? listPrefectureJapanJa : listPrefectureJapanEn
    const current = japanese.value ? model.value.address.prefectureJa : model.value.address.prefectureEn
    return current !== '' && !list.includes(current) ? [current, ...list] : list
})

function inputValue(event: Event): string {
    const target = event.target
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : ''
}

function update(patch: Partial<CorrectionDraft>) {
    model.value = { ...model.value, ...patch }
}

function setAddress(key: keyof PhysicalAddressInput, value: string) {
    update({ address: { ...model.value.address, [key]: value } })
}

function setPrefecture(value: string) {
    update({ address: addressWithPrefecture(model.value.address, value, japanese.value) })
}

function toggleLanguage(language: Locale) {
    const languages = model.value.supportedLanguages
    update({
        supportedLanguages: languages.includes(language)
            ? languages.filter(current => current !== language)
            : props.languageOptions.filter(option => option === language || languages.includes(option))
    })
}

function togglePayment(paymentType: PaymentType) {
    const types = model.value.paymentTypes
    update({
        paymentTypes: types.includes(paymentType)
            ? types.filter(current => current !== paymentType)
            : [...types, paymentType]
    })
}

function languageLabel(code: Locale): string {
    return localeDisplayOptions.find(option => option.code === code)?.simpleText ?? code
}
</script>

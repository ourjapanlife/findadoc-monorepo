<template>
    <div
        data-testid="clinic-booking-region-notice"
        class="card flex flex-col gap-4 p-6"
    >
        <h2 class="text-lg font-semibold">
            {{ t('bookingPage.regionNotice.heading') }}
        </h2>
        <p class="text-primary-text-muted">
            {{ t('bookingPage.regionNotice.body', { clinic: clinicName }) }}
        </p>

        <dl
            v-if="contact"
            class="flex flex-col gap-2 text-sm"
            data-testid="clinic-booking-region-contact"
        >
            <div
                v-if="phone"
                class="flex flex-wrap gap-x-2"
            >
                <dt class="font-medium">
                    {{ t('bookingPage.regionNotice.phone') }}
                </dt>
                <dd>
                    <a
                        v-if="phoneHref"
                        :href="`tel:${phoneHref}`"
                        class="text-primary underline"
                    >{{ phone }}</a>
                    <template v-else>
                        {{ phone }}
                    </template>
                </dd>
            </div>
            <div
                v-if="contact.email"
                class="flex flex-wrap gap-x-2"
            >
                <dt class="font-medium">
                    {{ t('bookingPage.regionNotice.email') }}
                </dt>
                <dd>
                    <a
                        :href="`mailto:${contact.email}`"
                        class="break-all text-primary underline"
                    >{{ contact.email }}</a>
                </dd>
            </div>
            <div
                v-if="contact.website"
                class="flex flex-wrap gap-x-2"
            >
                <dt class="font-medium">
                    {{ t('bookingPage.regionNotice.website') }}
                </dt>
                <dd>
                    <a
                        :href="contact.website"
                        class="break-all text-primary underline"
                        target="_blank"
                        rel="noopener noreferrer"
                    >{{ contact.website }}</a>
                </dd>
            </div>
        </dl>

        <NuxtLink
            v-if="clinicPath"
            :to="clinicPath"
            class="btn btn-secondary self-start"
            data-testid="clinic-booking-region-clinic-link"
        >
            {{ t('bookingPage.regionNotice.clinicLink', { clinic: clinicName }) }}
        </NuxtLink>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingForm, Contact } from '@findadoc/graphql'
import { fetchClinicById } from '~/utils/clinicFacility'
import { clinicLandingPath } from '~/utils/clinicLanding'
import { facilityPath } from '~/utils/clinicPath'
import { localizedPath } from '~/utils/localePath'
import { facilityPhone, facilityPhoneHref, type FacilitySearchResult } from '~/utils/searchDirectory'
import { isJapaneseLocale } from '~/utils/activeLocale'
import { patientClinicName } from '~/utils/booking/clinicBranding'

/**
 * Shown on the Book page instead of the form when the API says booking is not
 * available here: booking is offered only to people in Japan (#173). The clinic's
 * page and its own contact details stay open to everyone.
 */
const props = defineProps<{
    form: Pick<BookingForm, 'clinicName' | 'clinicNameJa' | 'facilityId' | 'clinicSiteSlug'>
}>()

const { t, locale } = useI18n()
const clinicName = computed(() => patientClinicName(props.form, String(locale.value)))
const facility = ref<FacilitySearchResult | null>(null)

const contact = computed<Pick<Contact, 'phone' | 'email' | 'website'> | null>(() => facility.value?.contact ?? null)
// Stored as E.164: national form on Japanese pages, +81 elsewhere; the link is always E.164.
const phone = computed(() => facility.value ? facilityPhone(facility.value, isJapaneseLocale(String(locale.value))) : '')
const phoneHref = computed(() => facility.value ? facilityPhoneHref(facility.value) : '')

const clinicPath = computed(() => {
    if (facility.value) {
        return localizedPath(facilityPath(facility.value), String(locale.value))
    }
    if (props.form.clinicSiteSlug) {
        return localizedPath(clinicLandingPath(props.form.clinicSiteSlug), String(locale.value))
    }
    return ''
})

onMounted(async () => {
    if (props.form.facilityId) {
        facility.value = await fetchClinicById(props.form.facilityId)
    }
})
</script>

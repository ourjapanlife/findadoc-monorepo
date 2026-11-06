<template>
    <component
        :is="icon.component"
        class="size-4 shrink-0"
        :class="icon.paint"
        aria-hidden="true"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FacilityCorrectionReason } from '@findadoc/graphql'
import SvgCreditCard from '~/assets/icons/credit-card-icon.svg'
import SvgHospital from '~/assets/icons/hospital-facility-icon.svg'
import SvgMapPin from '~/assets/icons/map-pin-icon.svg'
import SvgPencil from '~/assets/icons/pencil-edit.svg'
import SvgPhone from '~/assets/icons/phone-icon.svg'
import SvgTranslate from '~/assets/icons/translate-icon.svg'
import SvgClose from '~/assets/icons/x-close-symbol.svg'

/**
 * The site icon for a correction reason (#22). Decorative only: the label next to it carries the
 * meaning. Outline icons take the text color as stroke, solid ones as fill.
 */
const props = defineProps<{
    reason: FacilityCorrectionReason
}>()

// nuxt-svgo makes each icon a component. Its module declaration types the import as string.
type ReasonIcon = { component: string, paint: string }

const OUTLINE = 'stroke-current'
const SOLID = 'fill-current'

const ICONS: Readonly<Record<FacilityCorrectionReason, ReasonIcon>> = {
    [FacilityCorrectionReason.WrongCity]: { component: SvgMapPin, paint: OUTLINE },
    [FacilityCorrectionReason.Closed]: { component: SvgClose, paint: SOLID },
    [FacilityCorrectionReason.WrongLanguages]: { component: SvgTranslate, paint: SOLID },
    [FacilityCorrectionReason.WrongPayment]: { component: SvgCreditCard, paint: OUTLINE },
    [FacilityCorrectionReason.WrongContact]: { component: SvgPhone, paint: OUTLINE },
    [FacilityCorrectionReason.Duplicate]: { component: SvgHospital, paint: SOLID },
    [FacilityCorrectionReason.Other]: { component: SvgPencil, paint: SOLID }
}

const icon = computed(() => ICONS[props.reason])
</script>

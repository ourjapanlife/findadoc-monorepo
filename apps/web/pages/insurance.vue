<template>
    <section
        data-testid="insurance-page"
        class="page-section"
    >
        <div class="page-container-narrow flex flex-col gap-8">
            <header class="flex flex-col gap-3">
                <h1 class="page-title-sm">
                    {{ t('insurancePage.heading') }}
                </h1>
                <p class="text-lg text-primary-text-muted">
                    {{ t('insurancePage.intro') }}
                </p>
            </header>

            <p
                class="card m-0 p-5 text-primary-text"
                role="note"
                data-testid="insurance-disclaimer"
            >
                {{ t('insurancePage.disclaimer') }}
            </p>

            <section
                v-for="section in sections"
                :key="section.key"
                class="flex flex-col gap-3"
                :data-testid="`insurance-${section.key}`"
            >
                <h2 class="text-xl font-bold text-primary-text">
                    {{ section.heading }}
                </h2>
                <p
                    v-for="paragraph in section.paragraphs"
                    :key="paragraph"
                    class="m-0 text-primary-text"
                >
                    {{ paragraph }}
                </p>
                <ul
                    v-if="section.items.length"
                    class="m-0 flex list-disc flex-col gap-2 pl-5 text-primary-text"
                >
                    <li
                        v-for="item in section.items"
                        :key="item"
                    >
                        {{ item }}
                    </li>
                </ul>
            </section>

            <section class="flex flex-col gap-3">
                <h2 class="text-xl font-bold text-primary-text">
                    {{ t('insurancePage.sourcesHeading') }}
                </h2>
                <ul class="m-0 flex list-none flex-col gap-1 p-0">
                    <li
                        v-for="source in sources"
                        :key="source.url"
                    >
                        <a
                            :href="source.url"
                            target="_blank"
                            rel="noopener"
                            class="link inline-flex min-h-11 items-center"
                        >{{ source.label }}</a>
                    </li>
                </ul>
            </section>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/**
 * How paying for care works in Japan (#18). Linked from the insurance line on
 * clinic and doctor pages. The patient share is the ministry's published rule;
 * the page links the ministry instead of keeping a fee table that would go stale.
 * Find a Doc does not check coverage and does not give medical advice.
 */
const sections = computed(() => [
    {
        key: 'schemes',
        heading: t('insurancePage.schemesHeading'),
        paragraphs: [t('insurancePage.schemesIntro')],
        items: [
            t('insurancePage.schemeEmployee'),
            t('insurancePage.schemeNational'),
            t('insurancePage.schemeElderly')
        ]
    },
    { key: 'share', heading: t('insurancePage.shareHeading'), paragraphs: [t('insurancePage.shareBody')], items: [] },
    { key: 'bring', heading: t('insurancePage.bringHeading'), paragraphs: [t('insurancePage.bringBody')], items: [] },
    { key: 'clinics', heading: t('insurancePage.clinicsHeading'), paragraphs: [t('insurancePage.clinicsBody')], items: [] },
    {
        key: 'self-pay',
        heading: t('insurancePage.selfPayHeading'),
        paragraphs: [t('insurancePage.selfPayBody'), t('insurancePage.mixedBody')],
        items: []
    },
    { key: 'overseas', heading: t('insurancePage.overseasHeading'), paragraphs: [t('insurancePage.overseasBody')], items: [] }
])

const sources = computed(() => [
    {
        label: t('insurancePage.sourceShare'),
        url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/newpage_00008.html'
    },
    { label: t('insurancePage.sourceNationalInsurance'), url: 'https://www.mhlw.go.jp/stf/newpage_21539.html' },
    { label: t('insurancePage.sourceMynaCard'), url: 'https://www.mhlw.go.jp/stf/newpage_08277.html' },
    {
        label: t('insurancePage.sourceCertificate'),
        url: 'https://www.digital.go.jp/policies/mynumber/insurance-card/optional-insured-status'
    },
    {
        label: t('insurancePage.sourceFacilitySearch'),
        url: 'https://www.iryou.teikyouseido.mhlw.go.jp/'
    }
])
</script>

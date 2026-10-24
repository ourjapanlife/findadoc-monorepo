import { gql } from 'graphql-request'
import type { ClinicSite } from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from './graphql'

const LOCALE_FIELDS = `
  locale
  name
  description
  book
  seeFees
  sectionNavLabel
  heroBadge
  heroTitleBefore
  heroTitleHighlight
  heroLead
  heroNote
  heroAlt
  badgeTitle
  badgeDetail
  highlights
  aboutEyebrow
  aboutTitle
  about
  navDoctors
  navCases
  navFees
  navFlow
  doctorsEyebrow
  doctorsTitle
  doctorCopy { role tag paragraphs alt }
  casesEyebrow
  casesTitle
  casesLead
  cases { title detail }
  noticeEyebrow
  noticeTitle
  noticeLead
  notices { title detail feesLink }
  feesLink
  feesEyebrow
  feesTitle
  feesLead
  rangeLabel
  plans { amount note }
  includedLabel
  fees
  referralNote
  flowEyebrow
  flowTitle
  steps { title detail }
  bookEyebrow
  bookTitle
  bookLead
  bookNote
  ctaTitle
  ctaLead
  ctaButton
  emergency
`

const clinicSiteQuery = gql`
  query ClinicSite($slug: String!) {
    clinicSite(slug: $slug) {
      id
      slug
      facilityId
      status
      shareImagePath
      heroPath
      theme { primary }
      languages { code native bcp47 }
      doctors { id nameJa nameEn imagePath objectPosition hpId }
      locales { ${LOCALE_FIELDS} }
    }
  }
`

export async function fetchClinicSite(slug: string): Promise<ClinicSite | null> {
    if (!slug) {
        return null
    }

    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ clinicSite: ClinicSite | null }>(
        gqlClient.request.bind(gqlClient),
        clinicSiteQuery,
        { slug },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.clinicSite ?? null
}

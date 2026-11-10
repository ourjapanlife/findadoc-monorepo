/**
 * Site-wide identity used in titles, canonicals, and social meta.
 *
 * Keep this in one place: nuxt.config.ts cannot hold a function `titleTemplate`
 * (it is serialized into the app manifest and functions are dropped), so app.vue
 * formats titles at runtime with `formatPageTitle`. Canonicals always use
 * SITE_ORIGIN so prerendered HTML points at production, not localhost.
 */
export const SITE_TITLE = 'Find a Doc, Japan'

export const SITE_ORIGIN = 'https://www.findadoc.jp'

/**
 * The fallback description, and the only one /search and the other SPA routes show a
 * crawler, because they ship the shared shell. Keep it at or under 125 characters so a
 * social preview does not cut it off, which also keeps it under Google's ~155.
 */
export const SITE_DESCRIPTION
    = 'Find English-speaking and multilingual doctors and clinics in Japan. '
      + 'Search by language, specialty, and location. It\'s free.'

/**
 * The fallback document title for routes whose head has not run yet: the SPA shell that
 * /search, /login, and /book ship to crawlers. It already carries the brand, so
 * `formatPageTitle` does not add it twice.
 */
export const SITE_DEFAULT_TITLE = `English-speaking doctors in Japan · ${SITE_TITLE}`

/**
 * A new card gets a new file name. LinkedIn, preview checkers, and the CDN cache an image
 * by URL, so replacing the bytes at the old name keeps showing the old picture.
 * `findadoc-social.jpg` stays in public/ for links that already point at it.
 */
export const SITE_SOCIAL_IMAGE = `${SITE_ORIGIN}/findadoc-social-home.jpg`

/** Every social card is 1200×630, the size LinkedIn, Facebook, and X expect. */
export const SITE_SOCIAL_IMAGE_WIDTH = 1200

export const SITE_SOCIAL_IMAGE_HEIGHT = 630

export const SITE_SOCIAL_IMAGE_ALT = `${SITE_TITLE}: find doctors in Japan who speak your language`

/**
 * Pages with their own share card. Every other page uses `SITE_SOCIAL_IMAGE`. The
 * cards are English only; one image serves every locale of the page.
 */
export const PAGE_SOCIAL_IMAGES = {
    '/about': {
        url: `${SITE_ORIGIN}/findadoc-social-about.jpg`,
        alt: `${SITE_TITLE}: healthcare in Japan, in your language`
    },
    '/insurance': {
        url: `${SITE_ORIGIN}/findadoc-social-insurance.jpg`,
        alt: `${SITE_TITLE}: paying for a doctor in Japan? Read the guide`
    },
    '/submit': {
        url: `${SITE_ORIGIN}/findadoc-social-submit.jpg`,
        alt: `${SITE_TITLE}: know a doctor who speaks your language? Add a doctor`
    }
} as const satisfies Record<string, { url: string, alt: string }>

export const SITE_SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`

const BRAND_SUFFIX = ` · ${SITE_TITLE}`

/**
 * Builds a document title that always includes the brand, never doubles it, and
 * never produces a leading " · Brand" when a page has not set a title.
 *
 * Untitled pages (and pages whose title is already the brand) fall back to the
 * brand alone, so the homepage can opt into a descriptive title without
 * `titleTemplate` rendering "Find a Doc, Japan · Find a Doc, Japan".
 */
export function formatPageTitle(title?: string | null): string {
    const trimmed = title?.trim() ?? ''

    if (!trimmed || trimmed === SITE_TITLE) {
        return SITE_TITLE
    }

    if (trimmed.endsWith(BRAND_SUFFIX)) {
        return trimmed
    }

    return `${trimmed}${BRAND_SUFFIX}`
}

/**
 * The organisation's public contact address. It replaced a Google Form everywhere the site
 * asks people to get in touch, so the contact a bank or partner sees is on our own domain.
 */
export const CONTACT_EMAIL = 'contact@findadoc.jp'

export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`

/** Registered name, as published in the footer and on /npo. */
export const NPO_LEGAL_NAME = 'NPO法人Find a Doc Japan'

/** 東京都 NPO法人台帳 registration number. Shown on /npo. */
export const NPO_REGISTRATION_NUMBER = '9011005010215'

/** Certified by the Tokyo Metropolitan Government. Shown on /npo as 28 August 2023. */
export const NPO_FOUNDING_DATE = '2023-08-28'

/** Public profiles linked from the footer, menu, and about page. */
export const GITHUB_ORGANIZATION_URL = 'https://github.com/ourjapanlife'

export const LINKEDIN_ORGANIZATION_URL = 'https://www.linkedin.com/company/find-a-doc-japan/'

export const ORGANIZATION_PROFILE_URLS = [
    GITHUB_ORGANIZATION_URL,
    LINKEDIN_ORGANIZATION_URL
] as const

/**
 * Production MCP host from findadoc-mcp. Streamable HTTP is `/mcp`.
 * The same process serves the REST OpenAPI document at `/openapi.yaml`.
 */
export const MCP_SERVER_URL = 'https://mcp.findadoc.jp/mcp'

export const MCP_OPENAPI_URL = 'https://mcp.findadoc.jp/openapi.yaml'

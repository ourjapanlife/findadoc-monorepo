const STATIC_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:4242',
    'http://127.0.0.1:4242',
    'https://findadoc.jp',
    'https://www.findadoc.jp',
    'https://findadoc-monorepo-web.netlify.app'
]

// https://deploy-preview-<pr>--<site>.netlify.app
const NETLIFY_PREVIEW = /^https:\/\/deploy-preview-\d+--(?:findadoc|findadoc-monorepo-web)\.netlify\.app$/

// Amplify gives each branch https://<branch>.<app-id>.amplifyapp.com.
// Production publishes `main`. A pull request publishes `pr-<number>`.
const AMPLIFY_BRANCH = /^https:\/\/(?:main|pr-\d+)\.d[a-z0-9]+\.amplifyapp\.com$/

const LOCAL_BROWSER = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export function isAllowedApiOrigin(
    origin: string | undefined,
    options: { isLocal: boolean, websiteURL: string | undefined }
): boolean {
    if (origin === undefined) {
        return false
    }

    if (options.websiteURL !== undefined && options.websiteURL !== '' && origin === options.websiteURL) {
        return true
    }

    if (STATIC_ORIGINS.includes(origin)) {
        return true
    }

    if (NETLIFY_PREVIEW.test(origin) || AMPLIFY_BRANCH.test(origin)) {
        return true
    }

    return options.isLocal && LOCAL_BROWSER.test(origin)
}

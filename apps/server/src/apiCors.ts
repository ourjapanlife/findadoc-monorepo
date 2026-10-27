const STATIC_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:4242',
    'http://127.0.0.1:4242'
]

// Amplify gives each branch https://<branch>.<app-id>.amplifyapp.com.
// Production publishes `main`. A pull request publishes `pr-<number>`.
const AMPLIFY_BRANCH = /^https:\/\/(?:main|pr-\d+)\.d[a-z0-9]+\.amplifyapp\.com$/

// The Route 53 zone is ours. Apex, www, api, docs, mcp, and every clinic
// hostname (`{slug}.findadoc.jp`) share this pattern. One extra label only.
const FINDADOC_HOST = /^https:\/\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\.)?findadoc\.jp$/

// `<slug>.localhost` is the same clinic page on a dev machine.
const LOCAL_BROWSER = /^https?:\/\/(?:(?:[a-z0-9]+(?:-[a-z0-9]+)*\.)?localhost|127\.0\.0\.1)(:\d+)?$/

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

    if (AMPLIFY_BRANCH.test(origin) || FINDADOC_HOST.test(origin)) {
        return true
    }

    return options.isLocal && LOCAL_BROWSER.test(origin)
}

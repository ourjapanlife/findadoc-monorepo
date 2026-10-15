/** A full Google Maps https URL. Short share links are handled separately. */
export function isGoogleMapsUrl(url: string): boolean {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return false
    }

    if (parsed.protocol !== 'https:') {
        return false
    }

    const host = parsed.hostname
    if (host === 'maps.google.com' || host === 'maps.google.co.jp') {
        return true
    }

    const googleHost = host === 'www.google.com'
        || host === 'google.com'
        || host === 'www.google.co.jp'
        || host === 'google.co.jp'
    return googleHost && (parsed.pathname === '/maps' || parsed.pathname.startsWith('/maps/'))
}

/** A maps.app.goo.gl or goo.gl/maps link. The place id is on the page it opens. */
export function isShortMapsUrl(url: string): boolean {
    let parsed: URL
    try {
        parsed = new URL(url.trim())
    } catch {
        return false
    }

    if (parsed.protocol !== 'https:') {
        return false
    }
    if (parsed.hostname === 'maps.app.goo.gl') {
        return true
    }
    return parsed.hostname === 'goo.gl' && parsed.pathname.startsWith('/maps')
}

/**
 * Accepts a Maps share link or a full Maps URL.
 * The share-link check keeps the slash the Google Maps app includes.
 */
export function validateGoogleMapsUrlInput(url: string): boolean {
    const trimmed = url.trim()
    if (trimmed.startsWith('https://maps.app.goo.gl/') || trimmed.startsWith('https://goo.gl/maps/')) {
        return true
    }
    return isGoogleMapsUrl(trimmed)
}

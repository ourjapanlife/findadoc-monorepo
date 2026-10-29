/** Site locale codes are `ja_JP`; Intl wants a BCP 47 tag such as `ja-JP`, and throws on the underscore. */
export function intlLocale(siteLocale: string): string {
    return siteLocale.replace('_', '-') || 'en'
}

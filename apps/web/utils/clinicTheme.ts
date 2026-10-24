type Rgb = readonly [number, number, number]

const HEX = /^#([0-9A-Fa-f]{6})$/
const DARK_INK: Rgb = [11, 18, 20]
const DARK_GROUND: Rgb = [16, 22, 23]
const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]

function parseHex(hex: string): Rgb | undefined {
    const match = HEX.exec(hex)
    const value = match?.[1]
    if (value === undefined) {
        return undefined
    }

    return [
        Number.parseInt(value.slice(0, 2), 16),
        Number.parseInt(value.slice(2, 4), 16),
        Number.parseInt(value.slice(4, 6), 16)
    ]
}

function channel(value: number): number {
    const scaled = value / 255
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: Rgb): number {
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

function contrast(left: Rgb, right: Rgb): number {
    const lighter = luminance(left)
    const darker = luminance(right)
    const [high, low] = lighter > darker ? [lighter, darker] : [darker, lighter]
    return (high + 0.05) / (low + 0.05)
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    return [
        Math.round(from[0] + (to[0] - from[0]) * amount),
        Math.round(from[1] + (to[1] - from[1]) * amount),
        Math.round(from[2] + (to[2] - from[2]) * amount)
    ]
}

function triplet(rgb: Rgb): string {
    return `${rgb[0]} ${rgb[1]} ${rgb[2]}`
}

/** Lighten until the color reads on the dark page ground and under dark ink on a button. */
function forDarkSurface(rgb: Rgb): Rgb {
    let current = rgb
    for (let step = 0; step <= 16; step += 1) {
        if (contrast(current, DARK_GROUND) >= 4.5 && contrast(current, DARK_INK) >= 4.5) {
            return current
        }
        current = mix(rgb, WHITE, step / 16)
    }
    return current
}

/**
 * CSS variables for `.clinic-theme`. Light mode uses the stored hex.
 * Dark mode uses a lighter partner so the same buttons stay readable.
 * An invalid value leaves the Find a Doc primary in place.
 */
export function clinicThemeVars(primary: string | null | undefined): Record<string, string> | undefined {
    if (primary === null || primary === undefined) {
        return undefined
    }

    const rgb = parseHex(primary)
    if (rgb === undefined) {
        return undefined
    }

    const dark = forDarkSurface(rgb)
    return {
        '--clinic-primary': triplet(rgb),
        '--clinic-primary-hover': triplet(mix(rgb, BLACK, 0.18)),
        '--clinic-primary-dark': triplet(dark),
        '--clinic-primary-hover-dark': triplet(mix(dark, WHITE, 0.16))
    }
}

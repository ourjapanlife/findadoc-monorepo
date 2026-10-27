import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { CLINIC_LANDING_LOCALE_PREFIXES, clinicLandingsArePublic } from '../clinicLanding'

/**
 * Amplify serves `/foo/bar` from `/foo/bar.html`. A preview landing is not
 * prerendered, and the app rules do not rewrite this slug to the SPA shell.
 * Copying the shell into the publish dir is what makes
 * `/clinic/{slug}?preview=1` open on a pull-request preview.
 * `public` writes the real page instead, so this copy stays out of the way.
 */
export function clinicPreviewShellPaths(slug: string): string[] {
    return [
        `clinic/${slug}.html`,
        ...CLINIC_LANDING_LOCALE_PREFIXES.map(code => `${code}/clinic/${slug}.html`)
    ]
}

export async function writeClinicPreviewShells(
    publicDir: string,
    slug: string,
    publicMode = clinicLandingsArePublic()
): Promise<void> {
    if (publicMode) {
        return
    }

    const shell = resolve(publicDir, '200.html')
    if (!existsSync(shell)) {
        return
    }

    for (const relative of clinicPreviewShellPaths(slug)) {
        const target = resolve(publicDir, relative)
        await mkdir(dirname(target), { recursive: true })
        await copyFile(shell, target)
    }
}

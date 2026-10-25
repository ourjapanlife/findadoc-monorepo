import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { DEFAULT_LOCALE_CODE, LOCALE_CODES } from '../localePath'

/**
 * Amplify serves `/admin` from `/admin.html`. The staff page is not
 * prerendered, and the app rules do not rewrite it to the SPA shell.
 * Copying the shell into the publish dir is what makes `/admin` open.
 */
export function adminPreviewShellPaths(): string[] {
    return [
        'admin.html',
        ...LOCALE_CODES
            .filter(code => code !== DEFAULT_LOCALE_CODE)
            .map(code => `${code}/admin.html`)
    ]
}

export async function writeAdminPreviewShells(publicDir: string): Promise<void> {
    const shell = resolve(publicDir, '200.html')
    if (!existsSync(shell)) {
        return
    }

    for (const relative of adminPreviewShellPaths()) {
        const target = resolve(publicDir, relative)
        await mkdir(dirname(target), { recursive: true })
        await copyFile(shell, target)
    }
}

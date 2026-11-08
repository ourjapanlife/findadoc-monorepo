import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { OutboundEmail } from './sesClient.js'

/** Gitignored (apps/server/.gitignore). The dev API runs from apps/server, like .booking-uploads. */
const PREVIEW_ROOT = join(process.cwd(), '.email-previews')

const SAFE_FILE_NAME = /[^a-zA-Z0-9._-]+/g

function previewFolderName(bookingId: string | undefined): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const booking = bookingId === undefined ? 'email' : bookingId.replace(SAFE_FILE_NAME, '_').slice(0, 40)
    return `${stamp}-${booking}-${randomBytes(3).toString('hex')}`
}

/**
 * Writes a logged email where a browser can open it: index.html (with each `cid:` image pointed
 * at a file next to it), body.txt, and the inline images. Local development only: the caller
 * never runs it in production or in tests. The folder name holds a timestamp and the booking
 * id, never the recipient. Returns the index.html path.
 */
export async function writeEmailPreview(message: OutboundEmail, root: string = PREVIEW_ROOT): Promise<string> {
    const folder = join(root, previewFolderName(message.bookingId))
    await mkdir(folder, { recursive: true })
    let html = message.htmlBody ?? `<!doctype html><meta charset="utf-8"><pre>${message.textBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</pre>`
    for (const [index, attachment] of (message.inlineAttachments ?? []).entries()) {
        const fileName = `${index}-${attachment.fileName.replace(SAFE_FILE_NAME, '_')}`
        await writeFile(join(folder, fileName), attachment.content)
        html = html.split(`cid:${attachment.contentId}`).join(fileName)
    }
    const indexPath = join(folder, 'index.html')
    await writeFile(indexPath, html)
    await writeFile(join(folder, 'body.txt'), `Subject: ${message.subject}\n\n${message.textBody}\n`)
    return indexPath
}

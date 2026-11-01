import { userInfo } from 'node:os'
import { pathToFileURL } from 'node:url'
import { closeDatabase, db, initializeKyselyClient } from '../src/kyselyClient.js'
import { initializeLogger } from '../src/logger.js'
import { grantRole, isGrantedRole, revokeRole, type GrantedRole } from '../src/accounts/roleGrants.js'

/**
 * Grants or revokes admin, moderator, or dev by verified email (#215), until the admin app
 * exists. The person must have signed in once, so their user has that email.
 * Dry-run unless `--write` is passed. The last admin cannot be revoked.
 *
 *   pnpm --filter @findadoc/server roles:grant <email> <admin|moderator|dev> [--revoke] [--write]
 */

type Args = { email: string, role: GrantedRole, revoke: boolean, write: boolean }

function parseArgs(argv: string[]): Args | undefined {
    const positional = argv.filter(arg => !arg.startsWith('--'))
    const [email, role] = positional
    if (email === undefined || role === undefined || !isGrantedRole(role)) {
        return undefined
    }
    return {
        email: email.trim().toLowerCase(),
        role,
        revoke: argv.includes('--revoke'),
        write: argv.includes('--write')
    }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
    const args = parseArgs(argv)
    if (args === undefined) {
        console.error('Usage: roles:grant <email> <admin|moderator|dev> [--revoke] [--write]')
        process.exitCode = 1
        return
    }

    initializeLogger()
    await initializeKyselyClient()

    try {
        const users = await db.selectFrom('user').select('id').where('email', '=', args.email).execute()
        if (users.length !== 1) {
            console.error(users.length === 0
                ? `No user has the verified email ${args.email}. They need to sign in once first.`
                : `${users.length} users have the verified email ${args.email}: ${users.map(user => user.id).join(', ')}. Nothing changed.`)
            process.exitCode = 1
            return
        }
        const userId = users[0]!.id
        const verb = args.revoke ? 'revoke' : 'grant'

        if (!args.write) {
            console.log(`Would ${verb} ${args.role} for ${args.email} (${userId}). Re-run with --write.`)
            return
        }

        const actor = `cli:${userInfo().username}`
        const result = args.revoke
            ? await revokeRole({ userId, role: args.role, actor })
            : await grantRole({ userId, role: args.role, actor })
        console.log(`${verb} ${args.role} for ${args.email} (${userId}): ${result}`)
        if (result === 'last_admin') {
            process.exitCode = 1
        }
    } finally {
        await closeDatabase()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        console.error(`grantRole failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exitCode = 1
    })
}

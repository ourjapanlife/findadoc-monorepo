import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

/**
 * `pnpm db:prod`: reach the production database from a laptop.
 *
 * It checks the AWS Identity Center session, starts the jump host if it is stopped, pushes a
 * 60-second SSH key, and forwards 127.0.0.1:<port> to RDS through the EC2 Instance Connect
 * Endpoint (infra/lib/operatorAccessStack.ts). It signs in with a 15-minute IAM token for
 * findadoc_readonly, or findadoc_operator with --role operator. No password is stored anywhere.
 *
 * With a command, it runs that command with the connection in PG* variables and closes the
 * tunnel when the command exits. Without one, it holds the tunnel open for psql or a GUI.
 * The jump host powers itself off 20 minutes after the last connection.
 */

const REGION = 'ap-northeast-1'
const DEFAULT_PROFILE = 'findadoc'
const DEFAULT_LOCAL_PORT = 15432
const DATABASE_PORT = 5432
const ACCESS_STACK = 'FindadocOperatorAccess'
const DATABASE_STACK = 'FindadocDatabase'
const API_SECRET_ID = 'findadoc/api'
const SSH_USER = 'ec2-user'
const TUNNEL_ATTEMPTS = 8

const ROLES = {
    readonly: 'findadoc_readonly',
    operator: 'findadoc_operator'
} as const

type RoleName = keyof typeof ROLES

function isRoleName(value: string): value is RoleName {
    return Object.hasOwn(ROLES, value)
}

const CA_BUNDLE = fileURLToPath(new URL('../../certs/rds-ap-northeast-1-bundle.pem', import.meta.url))

const USAGE = `Usage: pnpm db:prod [options] [command ...]

Opens a tunnel to the production database. With a command, runs it with PGHOST, PGPORT,
PGUSER, PGPASSWORD, and the TLS settings set, then closes the tunnel. Without one, keeps the
tunnel open until Ctrl-C.

Options:
  --role readonly|operator  Database role. readonly (default) cannot write.
  --port <number>           Local port for the tunnel (default ${DEFAULT_LOCAL_PORT}).
  --places-key              Also set GOOGLE_API_KEY from the findadoc/api secret.
  --help                    Show this text.

Examples:
  pnpm db:prod psql
  pnpm db:prod node --loader ts-node/esm utils/<script>.ts
  pnpm db:prod --role operator node --loader ts-node/esm utils/<script>.ts --write --confirm-production
`

type Options = {
    role: RoleName
    port: number
    placesKey: boolean
    command: string[]
}

function fail(message: string): never {
    console.error(`\n✖ ${message}\n`)
    process.exit(1)
}

function parseOptions(args: string[]): Options {
    const options: Options = { role: 'readonly', port: DEFAULT_LOCAL_PORT, placesKey: false, command: [] }
    let index = 0

    while (index < args.length) {
        const arg = args[index] ?? ''
        if (arg === '--') {
            index += 1
            break
        }
        if (!arg.startsWith('--')) {
            break
        }
        const [name, inlineValue] = arg.split('=', 2)
        const takeValue = (): string => {
            if (inlineValue !== undefined) {
                return inlineValue
            }
            index += 1
            return args[index] ?? fail(`${name} needs a value.`)
        }

        if (name === '--help') {
            console.log(USAGE)
            process.exit(0)
        } else if (name === '--role') {
            const role = takeValue()
            options.role = isRoleName(role) ? role : fail(`--role is readonly or operator, not "${role}".`)
        } else if (name === '--port') {
            const port = Number(takeValue())
            options.port = Number.isInteger(port) && port > 1024 && port < 65536 ? port : fail('--port is 1025-65535.')
        } else if (name === '--places-key') {
            options.placesKey = true
        } else {
            fail(`Unknown option ${arg}.\n\n${USAGE}`)
        }
        index += 1
    }

    options.command = args.slice(index)
    return options
}

const awsEnv = { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE ?? DEFAULT_PROFILE, AWS_REGION: REGION }

function aws(args: string[]): string {
    return execFileSync('aws', [...args, '--region', REGION, '--output', 'text'], {
        env: awsEnv,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
}

function checkTools(): void {
    for (const [tool, hint] of [
        ['aws', 'Install the AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html'],
        ['ssh', 'Install an OpenSSH client.'],
        ['ssh-keygen', 'Install an OpenSSH client.']
    ] as const) {
        try {
            execFileSync(tool, tool === 'aws' ? ['--version'] : ['-V'], { stdio: 'ignore' })
        } catch (error) {
            // ssh-keygen has no version flag and exits non-zero, but it ran.
            if (!(error instanceof Error && 'status' in error && typeof error.status === 'number')) {
                fail(`${tool} was not found. ${hint}`)
            }
        }
    }
}

/** The signed-in Identity Center user, for the banner and the database application name. */
function signedInUser(): string {
    try {
        const arn = aws(['sts', 'get-caller-identity', '--query', 'Arn'])
        return arn.split('/').pop() ?? arn
    } catch {
        return fail(`You are not signed in to AWS (profile ${awsEnv.AWS_PROFILE}). Run:\n\n` +
            `    aws sso login --profile ${awsEnv.AWS_PROFILE}\n\n` +
            'First time? See "Production database" in the contributor docs for the profile setup.')
    }
}

function stackOutput(stack: string, key: string): string {
    let value = ''
    try {
        value = aws(['cloudformation', 'describe-stacks', '--stack-name', stack,
            '--query', `Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue`])
    } catch {
        fail(`Could not read the ${stack} stack. Is your role AdministratorAccess in account 677501681118?`)
    }
    return value && value !== 'None' ? value : fail(`${stack} has no ${key} output. Has infra deployed?`)
}

function instanceState(instanceId: string): string {
    return aws(['ec2', 'describe-instances', '--instance-ids', instanceId,
        '--query', 'Reservations[0].Instances[0].State.Name'])
}

function ensureJumpHostRunning(instanceId: string): void {
    let state = instanceState(instanceId)
    if (state === 'stopping') {
        console.log('• The jump host is stopping. Waiting for it to stop before starting it again...')
        aws(['ec2', 'wait', 'instance-stopped', '--instance-ids', instanceId])
        state = 'stopped'
    }
    if (state === 'stopped') {
        console.log('• Starting the jump host (about a minute)...')
        aws(['ec2', 'start-instances', '--instance-ids', instanceId])
        aws(['ec2', 'wait', 'instance-running', '--instance-ids', instanceId])
        return
    }
    if (state !== 'running' && state !== 'pending') {
        fail(`The jump host is ${state}. Ask an admin to check ${instanceId}.`)
    }
}

function portIsFree(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const server = net.createServer()
        server.once('error', () => resolve(false))
        server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
    })
}

function portAcceptsConnections(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const socket = net.connect(port, '127.0.0.1')
        socket.once('connect', () => {
            socket.destroy()
            resolve(true)
        })
        socket.once('error', () => resolve(false))
    })
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type Tunnel = { ssh: ChildProcess, close: () => void }

/** One SSH attempt. Resolves when the local port listens, or null if ssh exits first. */
async function tryTunnel(
    keyFile: string, instanceId: string, endpointId: string, databaseHost: string, port: number
): Promise<ChildProcess | null> {
    aws(['ec2-instance-connect', 'send-ssh-public-key', '--instance-id', instanceId,
        '--instance-os-user', SSH_USER, '--ssh-public-key', `file://${keyFile}.pub`])

    const ssh = spawn('ssh', [
        '-i', keyFile,
        '-N',
        '-o', 'IdentitiesOnly=yes',
        // The host is reached by instance id through an IAM-authorized AWS tunnel, and it is
        // replaced when the AMI changes, so a saved host key would only go stale.
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveInterval=30',
        '-o', `ProxyCommand=aws ec2-instance-connect open-tunnel --instance-id ${instanceId} ` +
            `--instance-connect-endpoint-id ${endpointId} --region ${REGION}`,
        '-L', `127.0.0.1:${port}:${databaseHost}:${DATABASE_PORT}`,
        `${SSH_USER}@${instanceId}`
    ], { env: awsEnv, stdio: ['ignore', 'ignore', 'pipe'] })

    let exited = false
    ssh.once('exit', () => {
        exited = true
    })

    for (let waited = 0; waited < 30 && !exited; waited += 1) {
        if (await portAcceptsConnections(port)) {
            return ssh
        }
        await delay(1000)
    }
    ssh.kill()
    return null
}

async function openTunnel(instanceId: string, endpointId: string, databaseHost: string, port: number): Promise<Tunnel> {
    const keyDir = mkdtempSync(path.join(os.tmpdir(), 'findadoc-db-'))
    const keyFile = path.join(keyDir, 'key')
    execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'findadoc-db-prod', '-f', keyFile])

    const removeKey = () => rmSync(keyDir, { recursive: true, force: true })

    for (let attempt = 1; attempt <= TUNNEL_ATTEMPTS; attempt += 1) {
        const ssh = await tryTunnel(keyFile, instanceId, endpointId, databaseHost, port)
        if (ssh) {
            return {
                ssh,
                close: () => {
                    ssh.kill()
                    removeKey()
                }
            }
        }
        // A host that just started takes a little while to accept SSH.
        console.log(`• Waiting for the jump host to accept SSH (attempt ${attempt} of ${TUNNEL_ATTEMPTS})...`)
        await delay(10000)
    }
    removeKey()
    return fail('Could not open the tunnel. Check that FindadocOperatorAccess deployed and try again.')
}

function authToken(databaseHost: string, user: string): string {
    return aws(['rds', 'generate-db-auth-token', '--hostname', databaseHost,
        '--port', String(DATABASE_PORT), '--username', user])
}

function googleApiKey(): string {
    const secret: unknown = JSON.parse(aws(['secretsmanager', 'get-secret-value', '--secret-id', API_SECRET_ID,
        '--query', 'SecretString']))
    if (typeof secret === 'object' && secret !== null && 'GOOGLE_API_KEY' in secret
        && typeof secret.GOOGLE_API_KEY === 'string' && secret.GOOGLE_API_KEY !== '') {
        return secret.GOOGLE_API_KEY
    }
    return fail(`${API_SECRET_ID} has no GOOGLE_API_KEY.`)
}

function connectionEnv(options: Options, databaseHost: string, user: string, who: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...awsEnv,
        // PGHOST names the certificate. PGHOSTADDR is where the tunnel listens. psql reads both.
        PGHOST: databaseHost,
        PGHOSTADDR: '127.0.0.1',
        PGPORT: String(options.port),
        PGDATABASE: 'postgres',
        PGUSER: user,
        PGPASSWORD: authToken(databaseHost, user),
        PGSSLMODE: 'verify-full',
        PGSSLROOTCERT: CA_BUNDLE,
        // Shows in pg_stat_activity and the RDS log, so a session can be traced to a person.
        PGAPPNAME: `db:prod ${who}`.slice(0, 63),
        FINDADOC_DB_TARGET: 'production'
    }
    if (options.placesKey) {
        env.GOOGLE_API_KEY = googleApiKey()
    }
    return env
}

function printBanner(user: string, who: string, port: number): void {
    const warning = user === ROLES.operator ? '  ⚠ This role can change production rows.\n' : ''
    console.log(`\n✔ PRODUCTION database tunnel is open for ${who} as ${user} on 127.0.0.1:${port}.\n${warning}`)
}

function printGuiSettings(env: NodeJS.ProcessEnv): void {
    console.log([
        'Connect a GUI (TablePlus, DBeaver, pgAdmin) with:',
        `  Host      127.0.0.1`,
        `  Port      ${env.PGPORT}`,
        `  Database  postgres`,
        `  User      ${env.PGUSER}`,
        '  Password  the token below (it works for new connections for 15 minutes)',
        `  SSL       require (the RDS certificate names ${env.PGHOST}, not 127.0.0.1)`,
        '',
        'Or run psql in another terminal: pnpm db:prod psql',
        '',
        `Password: ${env.PGPASSWORD}`,
        '',
        'Press Enter for a new password. Ctrl-C closes the tunnel.'
    ].join('\n'))
}

async function holdOpen(tunnel: Tunnel, env: NodeJS.ProcessEnv, databaseHost: string): Promise<number> {
    printGuiSettings(env)
    const input = readline.createInterface({ input: process.stdin })
    input.on('line', () => {
        const user = env.PGUSER ?? ROLES.readonly
        console.log(`Password: ${authToken(databaseHost, user)}`)
    })

    return new Promise(resolve => {
        const stop = () => {
            input.close()
            resolve(0)
        }
        process.once('SIGINT', stop)
        process.once('SIGTERM', stop)
        tunnel.ssh.once('exit', () => {
            console.error('\nThe tunnel closed. An Instance Connect tunnel lasts at most an hour. Run pnpm db:prod again.')
            input.close()
            resolve(1)
        })
    })
}

function runCommand(tunnel: Tunnel, env: NodeJS.ProcessEnv, command: string[]): Promise<number> {
    const [program, ...args] = command
    if (program === undefined) {
        return Promise.resolve(0)
    }
    // Ctrl-C reaches the command, which decides how to stop. The tunnel closes after it exits.
    const ignore = () => undefined
    process.on('SIGINT', ignore)

    return new Promise(resolve => {
        const child = spawn(program, args, { env, stdio: 'inherit' })
        tunnel.ssh.once('exit', () => {
            console.error('\nThe tunnel closed while the command was running.')
        })
        child.once('error', error => {
            console.error(`Could not start ${program}: ${error.message}`)
            resolve(1)
        })
        child.once('exit', code => {
            process.off('SIGINT', ignore)
            resolve(code ?? 1)
        })
    })
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2))
    checkTools()

    const who = signedInUser()
    const instanceId = stackOutput(ACCESS_STACK, 'JumpHostInstanceId')
    const endpointId = stackOutput(ACCESS_STACK, 'InstanceConnectEndpointId')
    const databaseHost = stackOutput(DATABASE_STACK, 'DatabaseEndpoint')
    const user = ROLES[options.role]

    if (!await portIsFree(options.port)) {
        fail(`Port ${options.port} is in use. Is another pnpm db:prod running? Pass --port to use another.`)
    }

    ensureJumpHostRunning(instanceId)
    const tunnel = await openTunnel(instanceId, endpointId, databaseHost, options.port)
    process.once('exit', () => tunnel.close())

    const env = connectionEnv(options, databaseHost, user, who)
    printBanner(user, who, options.port)

    const code = options.command.length > 0
        ? await runCommand(tunnel, env, options.command)
        : await holdOpen(tunnel, env, databaseHost)

    tunnel.close()
    process.exit(code)
}

await main()

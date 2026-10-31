import { spawnSync } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { localDatabaseConfig } from '../../utils/localDatabase.js'

const serverRoot = fileURLToPath(new URL('../..', import.meta.url))
const composeFile = 'docker/docker-compose-db.yml'
const containerName = 'findadoc-db'

/**
 * Starts the local Docker database on PGPORT (54322 by default) and waits until it is healthy.
 * When something else holds that port, says what it is instead of Docker's "port is already allocated".
 */
export async function startLocalDatabase(): Promise<boolean> {
    const { port } = localDatabaseConfig()
    const running = runningContainers()

    if (running === null) {
        console.error('Docker is required to run the local database. Start Docker, then try again.')
        return false
    }

    const holders = running.filter(container => container.name !== containerName && publishesPort(container.ports, port))
    const ours = running.some(container => container.name === containerName && publishesPort(container.ports, port))

    if (holders.length > 0) {
        explainTakenPort(port, holders.map(container => container.name))
        return false
    }

    if (!ours && await isListening(port)) {
        explainTakenPort(port, [])
        return false
    }

    const started = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], {
        cwd: serverRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, PGPORT: String(port) }
    })

    return !started.error && started.status === 0
}

type RunningContainer = { name: string, ports: string }

/** Running containers, or null when Docker does not answer. */
function runningContainers(): RunningContainer[] | null {
    const listed = spawnSync('docker', ['ps', '--format', '{{.Names}}|{{.Ports}}'], { encoding: 'utf8' })

    if (listed.error || listed.status !== 0) {
        return null
    }

    return listed.stdout
        .split(/\r?\n/)
        .filter(line => line.trim() !== '')
        .map(line => {
            const [name, ports = ''] = line.split('|')
            return { name: name.trim(), ports }
        })
}

/**
 * True when a container's port list publishes `port`. Docker lists it as
 * "0.0.0.0:54322->5432/tcp, [::]:54322->5432/tcp".
 */
function publishesPort(ports: string, port: number): boolean {
    return ports.includes(`:${port}->`)
}

/** True when something accepts a TCP connection on 127.0.0.1:`port` within a second, Docker or not. */
function isListening(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const socket = net.connect({ host: '127.0.0.1', port })
        const finish = (listening: boolean) => {
            socket.destroy()
            resolve(listening)
        }

        socket.setTimeout(1000)
        socket.once('connect', () => finish(true))
        socket.once('timeout', () => finish(false))
        socket.once('error', () => finish(false))
    })
}

/**
 * Says what holds the database port and how to free it: the old Supabase stack, another
 * container, or a process outside Docker. It also names the PGPORT way around it (#168).
 */
function explainTakenPort(port: number, containers: string[]): void {
    const oldSupabase = containers.filter(name => name.startsWith('supabase_'))

    if (containers.length === 0) {
        console.error(`Port ${port} is taken by something outside Docker, such as a Postgres installed on this machine.`)
    } else {
        console.error(`Port ${port} is taken by the Docker container ${containers.join(', ')}, not ${containerName}.`)
    }

    if (oldSupabase.length > 0) {
        console.error('That is the old local Supabase stack. Stop it (its data is kept):')
        console.error('  supabase stop                      # in the old project, or')
        console.error(`  docker stop ${oldSupabase.join(' ')}`)
    } else if (containers.length > 0) {
        console.error(`Stop it with: docker stop ${containers.join(' ')}`)
    } else {
        console.error('Stop it, then run this again.')
    }

    console.error(`Or run the database on another port, and use the same PGPORT for db:reset, db:seed, and the API: PGPORT=${port + 1} pnpm db:start`)
}

const invokedDirectly = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
    process.exit(await startLocalDatabase() ? 0 : 1)
}

import { spawn } from 'node:child_process'
import { devServerEnv } from './devFlags.mjs'

const env = devServerEnv(process.env, {
    localApi: process.argv.includes('--local-api')
})

const child = spawn('pnpm', ['exec', 'nuxi', 'dev'], {
    env,
    stdio: 'inherit',
    shell: true
})

function forward(signal) {
    child.kill(signal)
}

process.on('SIGINT', () => forward('SIGINT'))
process.on('SIGTERM', () => forward('SIGTERM'))

child.on('exit', code => {
    process.exit(code ?? 0)
})

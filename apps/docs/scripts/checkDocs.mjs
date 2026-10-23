// Fails when the docs drift from the monorepo: a page without its Japanese mirror,
// a page missing from the nav, a broken relative link, a pnpm command that no
// package defines, or a Node or pnpm version that no longer matches the repo.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagesRoot = path.join(docsRoot, 'docs')
const repoRoot = path.resolve(docsRoot, '..', '..')

// pnpm's own commands, not package scripts.
const pnpmBuiltins = new Set(['add', 'dlx', 'exec', 'i', 'install', 'remove', 'run', 'update', 'why'])

// Repos that were merged into this monorepo. Link to a path here instead.
const retiredRepos = /github\.com\/ourjapanlife\/findadoc-(web|server|mcp|docs)\b/

function markdownFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            return markdownFiles(fullPath)
        }
        return entry.name.endsWith('.md') ? [fullPath] : []
    })
}

function packageScripts() {
    const scriptsByPackage = new Map()
    const root = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    scriptsByPackage.set('root', new Set(Object.keys(root.scripts ?? {})))
    for (const group of ['apps', 'packages']) {
        for (const name of fs.readdirSync(path.join(repoRoot, group))) {
            const manifestPath = path.join(repoRoot, group, name, 'package.json')
            if (!fs.existsSync(manifestPath)) {
                continue
            }
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            scriptsByPackage.set(manifest.name, new Set(Object.keys(manifest.scripts ?? {})))
        }
    }
    return { scriptsByPackage, packageManager: root.packageManager }
}

export function pnpmCommandProblems(code, scriptsByPackage) {
    const problems = []
    for (const match of code.matchAll(/\bpnpm\s+((?:--filter\s+\S+\s+)?)([a-z][\w:.-]*)/g)) {
        const filter = match[1].trim().replace(/^--filter\s+/, '')
        const script = match[2]
        if (filter === '' && pnpmBuiltins.has(script)) {
            continue
        }
        const packageName = filter === '' ? 'root' : filter
        const scripts = scriptsByPackage.get(packageName)
        if (scripts === undefined) {
            problems.push(`\`pnpm --filter ${filter}\` names a package that does not exist`)
        }
        else if (!scripts.has(script) && !(filter !== '' && pnpmBuiltins.has(script))) {
            problems.push(`\`${match[0].trim()}\`: ${packageName} has no "${script}" script`)
        }
    }
    return problems
}

export function docsProblems() {
    const problems = []
    const nodeVersion = fs.readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim().replace(/^v/, '')
    const { scriptsByPackage, packageManager } = packageScripts()
    const pnpmVersion = packageManager.replace(/^pnpm@/, '')
    const mkdocs = fs.readFileSync(path.join(docsRoot, 'mkdocs.yml'), 'utf8')
    const navPages = new Set([...mkdocs.matchAll(/^\s*-\s+(?:[^:\n]+:\s+)?([\w/.-]+\.md)\s*$/gm)].map(match => match[1]))

    const pages = markdownFiles(pagesRoot).map(file => path.relative(pagesRoot, file).split(path.sep).join('/'))
    const englishPages = pages.filter(page => !page.startsWith('ja/'))
    const japanesePages = new Set(pages.filter(page => page.startsWith('ja/')).map(page => page.slice(3)))

    for (const page of englishPages) {
        if (!japanesePages.has(page)) {
            problems.push(`${page}: no Japanese page at docs/ja/${page}`)
        }
        if (!navPages.has(page)) {
            problems.push(`${page}: not listed under nav in mkdocs.yml`)
        }
    }
    for (const page of japanesePages) {
        if (!englishPages.includes(page)) {
            problems.push(`ja/${page}: no English page at docs/${page}`)
        }
    }

    for (const page of pages) {
        const filePath = path.join(pagesRoot, page)
        const lines = fs.readFileSync(filePath, 'utf8').split('\n')
        let inFence = false
        lines.forEach((line, index) => {
            if (/^\s*```/.test(line)) {
                inFence = !inFence
                return
            }
            // Commands are only checked in code, so prose like "pnpm workspace" is not a script.
            const code = inFence ? line : [...line.matchAll(/`([^`]+)`/g)].map(match => match[1]).join('\0')
            const where = `${page}:${index + 1}`
            for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
                const target = match[1].split('#')[0]
                if (target === '' || /^[a-z]+:/.test(target)) {
                    continue
                }
                if (!fs.existsSync(path.resolve(path.dirname(filePath), target))) {
                    problems.push(`${where}: broken link ${match[1]}`)
                }
            }
            if (retiredRepos.test(line)) {
                problems.push(`${where}: links a retired repo. Link to findadoc-monorepo instead`)
            }
            if (inFence && /\byarn\b|\bnpm run\b|\bnpx\b/.test(line)) {
                problems.push(`${where}: uses yarn, npm run, or npx. The monorepo uses pnpm`)
            }
            for (const problem of pnpmCommandProblems(code, scriptsByPackage)) {
                problems.push(`${where}: ${problem}`)
            }
            for (const match of line.matchAll(/Node(?:\.js)?\s+v?(\d+\.\d+\.\d+)/g)) {
                if (match[1] !== nodeVersion) {
                    problems.push(`${where}: says Node ${match[1]}, but .nvmrc pins ${nodeVersion}`)
                }
            }
            for (const match of line.matchAll(/pnpm[@\s]v?(\d+\.\d+\.\d+)/g)) {
                if (match[1] !== pnpmVersion) {
                    problems.push(`${where}: says pnpm ${match[1]}, but packageManager pins ${pnpmVersion}`)
                }
            }
        })
    }
    return problems
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
    const problems = docsProblems()
    if (problems.length > 0) {
        process.stderr.write(`${problems.join('\n')}\n`)
        process.exit(1)
    }
    process.stdout.write('Docs match the monorepo.\n')
}

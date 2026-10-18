import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { localeMessageProblems } from './localeMessages.js'

const localesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'locales')

export function allowedSameAsEnglishKeys(allowlist, filename) {
    const shared = Array.isArray(allowlist.all) ? allowlist.all : []
    const localeCode = filename.replace(/\.json$/, '')
    const local = Array.isArray(allowlist[localeCode]) ? allowlist[localeCode] : []
    return new Set([...shared, ...local])
}

export function localeFileProblems(localesDirectoryPath, allowlist) {
    const english = JSON.parse(fs.readFileSync(path.join(localesDirectoryPath, 'en.json'), 'utf8'))
    const localeFiles = fs.readdirSync(localesDirectoryPath)
        .filter(filename => filename.endsWith('.json') && filename !== 'en.json')
        .sort()

    return localeFiles.flatMap(filename => {
        const translated = JSON.parse(fs.readFileSync(path.join(localesDirectoryPath, filename), 'utf8'))
        return localeMessageProblems(english, translated, allowedSameAsEnglishKeys(allowlist, filename))
            .map(problem => `${filename}: ${problem}`)
    })
}

function reportProblems(problems) {
    const byFile = new Map()
    for (const problem of problems) {
        const splitAt = problem.indexOf(': ')
        const filename = problem.slice(0, splitAt)
        const detail = problem.slice(splitAt + 2)
        const rows = byFile.get(filename) ?? []
        rows.push(detail)
        byFile.set(filename, rows)
    }

    const lines = []
    for (const [filename, rows] of byFile) {
        lines.push(filename)
        for (const row of rows) {
            lines.push(row)
        }
        lines.push('')
    }
    const report = lines.join('\n')
    process.stdout.write(report)
    process.stderr.write(report)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
    const allowlist = JSON.parse(fs.readFileSync(new URL('./sameAsEnglish.json', import.meta.url), 'utf8'))
    const problems = localeFileProblems(localesDirectory, allowlist)
    if (problems.length > 0) {
        reportProblems(problems)
        process.exit(1)
    }
}

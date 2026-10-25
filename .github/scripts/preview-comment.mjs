import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const COMMENT_MARKER = '<!-- amplify-preview -->'

const CATEGORIES = [
    ['performance', 'Performance'],
    ['accessibility', 'Accessibility'],
    ['best-practices', 'Best practices'],
    ['seo', 'SEO'],
]

const METRICS = [
    ['first-contentful-paint', 'First Contentful Paint', 'ms'],
    ['largest-contentful-paint', 'Largest Contentful Paint', 'ms'],
    ['total-blocking-time', 'Total Blocking Time', 'ms'],
    ['cumulative-layout-shift', 'Cumulative Layout Shift', 'cls'],
    ['speed-index', 'Speed Index', 'ms'],
]

const MISSING = '—'

export function previewComment({ previewUrl, preview, production, productionUrl, reportsUrl }) {
    const lines = [COMMENT_MARKER, '', heading(preview), '', previewUrl, '']
    if (preview === null) {
        lines.push('Lighthouse did not finish for this preview. The site is published.', '')
        return lines.join('\n')
    }

    const compared = production !== null
    lines.push('Mobile Lighthouse, one run of the homepage.')
    if (compared) {
        lines.push(`Compared with production at ${productionUrl}.`)
        lines.push('Change is the preview minus production. A higher score is better. A lower timing is faster.')
    }
    lines.push('', '### Scores', '', scoreTable(preview, production), '', '### Performance', '', metricTable(preview, production))

    const savings = opportunities(preview)
    lines.push('', '### Opportunities', '')
    if (savings.length === 0) {
        lines.push('No savings opportunities reported.', '')
    }
    else {
        for (const saving of savings) {
            lines.push(`- **${saving.title}** — ${saving.detail}`)
        }
        lines.push('')
    }

    if (reportsUrl) {
        lines.push(`HTML reports for this run are attached to [the workflow run](${reportsUrl}).`, '')
    }
    return lines.join('\n')
}

export function loadReport(file) {
    if (!file || !existsSync(file)) {
        return null
    }
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed?.categories) {
        return parsed
    }
    if (parsed?.lhr?.categories) {
        return parsed.lhr
    }
    return null
}

function heading(preview) {
    const performance = categoryScore(preview, 'performance')
    if (performance === null) {
        return '## Preview'
    }
    return `## Preview · ${performance} performance`
}

function scoreTable(preview, production) {
    const compared = production !== null
    const headers = compared ? ['Category', 'Preview', 'Production', 'Change'] : ['Category', 'Preview']
    const rows = CATEGORIES.map(([id, label]) => {
        const current = categoryScore(preview, id)
        const row = [label, current === null ? MISSING : String(current)]
        if (!compared) {
            return row
        }
        const live = categoryScore(production, id)
        row.push(live === null ? MISSING : String(live))
        row.push(current === null || live === null ? MISSING : formatSigned(current - live))
        return row
    })
    return table(headers, rows)
}

function metricTable(preview, production) {
    const compared = production !== null
    const headers = compared ? ['Metric', 'Preview', 'Production', 'Change'] : ['Metric', 'Preview']
    const rows = METRICS.map(([id, label, unit]) => {
        const current = metricValue(preview, id)
        const row = [label, formatMetric(current, unit)]
        if (!compared) {
            return row
        }
        const live = metricValue(production, id)
        row.push(formatMetric(live, unit))
        row.push(current === null || live === null ? MISSING : formatMetricDelta(current - live, unit))
        return row
    })
    return table(headers, rows)
}

function opportunities(report) {
    const audits = Object.values(report.audits ?? {})
    return audits
        .filter(audit => audit.details?.type === 'opportunity' && typeof audit.numericValue === 'number' && audit.numericValue > 0)
        .sort((left, right) => right.numericValue - left.numericValue)
        .slice(0, 3)
        .map(audit => ({
            title: audit.title,
            detail: audit.displayValue || formatDuration(audit.numericValue),
        }))
}

function categoryScore(report, id) {
    const score = report?.categories?.[id]?.score
    if (typeof score !== 'number') {
        return null
    }
    return Math.round(score * 100)
}

function metricValue(report, id) {
    const value = report?.audits?.[id]?.numericValue
    return typeof value === 'number' ? value : null
}

function formatMetric(value, unit) {
    if (value === null) {
        return MISSING
    }
    return unit === 'cls' ? value.toFixed(3) : formatDuration(value)
}

function formatMetricDelta(delta, unit) {
    if (unit === 'cls') {
        const text = delta.toFixed(3)
        if (text === '0.000' || text === '-0.000') {
            return '0'
        }
        return delta > 0 ? `+${text}` : text
    }
    return formatSignedDuration(delta)
}

function formatDuration(milliseconds) {
    const rounded = Math.round(milliseconds)
    if (Math.abs(rounded) < 1000) {
        return `${rounded} ms`
    }
    return `${(rounded / 1000).toFixed(1)} s`
}

function formatSignedDuration(delta) {
    const rounded = Math.round(delta)
    if (rounded === 0) {
        return '0'
    }
    return formatDuration(rounded)
}

function formatSigned(delta) {
    if (delta > 0) {
        return `+${delta}`
    }
    return String(delta)
}

function table(headers, rows) {
    const divider = headers.map((_, index) => (index === 0 ? '---' : '---:')).join(' | ')
    const body = rows.map(row => `| ${row.join(' | ')} |`)
    return [`| ${headers.join(' | ')} |`, `| ${divider} |`, ...body].join('\n')
}

function argument(argv, name) {
    const index = argv.indexOf(name)
    if (index === -1) {
        return ''
    }
    return argv[index + 1] ?? ''
}

function main() {
    const argv = process.argv.slice(2)
    const previewUrl = argument(argv, '--preview-url')
    if (previewUrl === '') {
        process.stderr.write('preview-comment: --preview-url is required\n')
        process.exitCode = 1
        return
    }
    const body = previewComment({
        previewUrl,
        preview: loadReport(argument(argv, '--preview')),
        production: loadReport(argument(argv, '--production')),
        productionUrl: argument(argv, '--production-url'),
        reportsUrl: argument(argv, '--reports-url'),
    })
    process.stdout.write(`${body}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main()
}

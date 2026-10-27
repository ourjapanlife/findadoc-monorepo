import assert from 'node:assert/strict'
import test from 'node:test'
import { previewComment } from './preview-comment.mjs'

function report(scores, metrics, savings = []) {
    const categories = Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { score }]))
    const audits = Object.fromEntries(Object.entries(metrics).map(([id, numericValue]) => [id, { numericValue }]))
    for (const [index, saving] of savings.entries()) {
        audits[`opportunity-${index}`] = {
            title: saving.title,
            displayValue: saving.detail,
            numericValue: saving.wastedMs,
            details: { type: 'opportunity' },
        }
    }
    return { categories, audits }
}

const preview = report(
    { performance: 0.92, accessibility: 1, 'best-practices': 0.96, seo: 0.9 },
    {
        'first-contentful-paint': 1200,
        'largest-contentful-paint': 2100,
        'total-blocking-time': 80,
        'cumulative-layout-shift': 0.012,
        'speed-index': 1800,
    },
    [
        { title: 'Reduce unused JavaScript', detail: 'Est savings of 210 ms', wastedMs: 210 },
        { title: 'Render blocking requests', detail: 'Est savings of 450 ms', wastedMs: 450 },
        { title: 'Properly size images', detail: 'Est savings of 180 ms', wastedMs: 180 },
        { title: 'Too small to show', detail: 'Est savings of 10 ms', wastedMs: 10 },
    ],
)

const production = report(
    { performance: 0.88, accessibility: 0.97, 'best-practices': 1, seo: 0.91 },
    {
        'first-contentful-paint': 1400,
        'largest-contentful-paint': 2500,
        'total-blocking-time': 120,
        'cumulative-layout-shift': 0.041,
        'speed-index': 2000,
    },
)

test('preview comment compares the homepage with production', () => {
    const body = previewComment({
        previewUrl: 'https://pr-12.d1example.amplifyapp.com',
        preview,
        production,
        productionUrl: 'https://www.findadoc.jp',
        reportsUrl: 'https://github.com/ourjapanlife/findadoc-monorepo/actions/runs/1',
    })

    assert.equal(body, [
        '<!-- amplify-preview -->',
        '',
        '## Preview · 92 performance',
        '',
        'https://pr-12.d1example.amplifyapp.com',
        '',
        'Mobile Lighthouse, one run of the homepage.',
        'Compared with production at https://www.findadoc.jp.',
        'Change is the preview minus production. A higher score is better. A lower timing is faster.',
        '',
        '### Scores',
        '',
        '| Category | Preview | Production | Change |',
        '| --- | ---: | ---: | ---: |',
        '| Performance | 92 | 88 | +4 |',
        '| Accessibility | 100 | 97 | +3 |',
        '| Best practices | 96 | 100 | -4 |',
        '| SEO | 90 | 91 | -1 |',
        '',
        '### Performance',
        '',
        '| Metric | Preview | Production | Change |',
        '| --- | ---: | ---: | ---: |',
        '| First Contentful Paint | 1.2 s | 1.4 s | -200 ms |',
        '| Largest Contentful Paint | 2.1 s | 2.5 s | -400 ms |',
        '| Total Blocking Time | 80 ms | 120 ms | -40 ms |',
        '| Cumulative Layout Shift | 0.012 | 0.041 | -0.029 |',
        '| Speed Index | 1.8 s | 2.0 s | -200 ms |',
        '',
        '### Opportunities',
        '',
        '- **Render blocking requests** — Est savings of 450 ms',
        '- **Reduce unused JavaScript** — Est savings of 210 ms',
        '- **Properly size images** — Est savings of 180 ms',
        '',
        'HTML reports for this run are attached to [the workflow run](https://github.com/ourjapanlife/findadoc-monorepo/actions/runs/1).',
        '',
    ].join('\n'))
})

test('preview comment keeps the url when lighthouse does not finish', () => {
    const body = previewComment({
        previewUrl: 'https://pr-12.d1example.amplifyapp.com',
        preview: null,
        production: null,
        productionUrl: 'https://www.findadoc.jp',
        reportsUrl: '',
    })

    assert.match(body, /^<!-- amplify-preview -->/)
    assert.match(body, /https:\/\/pr-12\.d1example\.amplifyapp\.com/)
    assert.match(body, /Lighthouse did not finish/)
    assert.doesNotMatch(body, /### Scores/)
})

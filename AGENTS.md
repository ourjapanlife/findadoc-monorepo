# Agent notes

These notes apply to the whole monorepo: the site, the API, the MCP server, and the shared packages. Paths are from the repository root.

## City vocabulary

`apps/server/docs/city-rules.md` is the frozen search-city decision. Follow it. Do not invent a second naming scheme in code, migrations, or issues.

- Tokyo: the search city is one of the 23 special wards. `Minato City` is Minato. Japanese keeps 区.
- Everywhere else: the search city is the municipality. A ward of a designated city rolls up to that city. Fukuoka's East Ward and Higashi Ward are both Fukuoka.
- A city is unique per prefecture. Tokyo Chuo (中央区), Osaka's Chuo ward, and Yamanashi's Chuo city (中央市) are different places.
- Prefecture keys come from `apps/server/utils/japanesePrefectures.ts`.
- A district (郡), a street, or an English/Japanese pair that names two different places stays unresolved. Do not guess. Osaka and Sakai both have Kita and Nishi, so a bare North Ward is not Osaka.

Alias lookup lives in `apps/server/src/vocabulary/`. Resolvers and services do not import it. `apps/server/utils/backfillFacilityCities.ts` is the #1011 run: it writes `city_id` only when the facility maps to one official municipality, leaves anything else as `UNVERIFIED_LOCATION`, and does not change a confirmed facility's stored name or address. A district row uses the town named in the address line. Dry-run is the default. It does not call Places. It writes nothing unless every facility maps and no published row is still a generic East, West, North, South, or Chuo Ward. The city table is #1009: every current municipality from the Address Base Registry, shaped by the rules above. Designated-city wards are not rows. Tokyo's 23 wards are. Refresh with `apps/server/utils/buildMunicipalityVocabulary.py` and match on `lg_code`. The alias map only returns a row that already exists.

## Affiliations

A society or collaboration is a row in `affiliations`, not a Postgres enum (#1029). The first row is the Intercultural Psychiatric Society of Japan. Japanese name, website, and logo stay empty until that society sends them.

`affiliation_memberships` attaches that row to one facility or one healthcare professional. Do not attach the existing directory in this change. Bulk CSV import and the profile-card mark are later tickets.

## Equality

Compare values with `===` and `!==`. Do not use `==` or `!=`. That includes `== null` and `!= null`. A missing value is `=== null` or `=== undefined`.

## Code style

ESLint is the style guide. Each app has its own `eslint.config.js` (`apps/server`, `apps/web`, `apps/mcp`), and `.husky/pre-push` runs `turbo lint typecheck`. Run `pnpm lint` and `pnpm typecheck` before you push. Do not turn off a rule for a whole file, and do not loosen a config to get a change through. A one-line `eslint-disable-next-line <rule>` needs a reason on the same line or the line above.

- 4-space indent, LF, UTF-8, final newline (`.editorconfig`). CSS uses 2 spaces.
- Single quotes, no semicolons, no trailing commas, `1tbs` braces, `curly` on every block.
- Lines stay under 120 characters (130 in web).
- `const` by default, `let` only when reassigned, never `var`. Template literals, not string `+`. Arrow callbacks.
- No `console` in the API or the MCP server. Use `logger` from `apps/server/src/logger.ts`. Web may use `console.warn`, `console.error`, and `console.info`.
- No unused variables, no shadowed names, no leading or trailing `_` on names.
- Keep functions small enough to read. `complexity` fails at 40. Split well before that.

Names: `camelCase` for variables, functions, and files that export functions (`facilityService.ts`, `useConsent.ts`). `PascalCase` for types, enums, classes, and Vue components (`BreadcrumbNav.vue`). `SCREAMING_SNAKE_CASE` for module constants (`LIST_QUERY_MAX`). Database columns and tables are `snake_case`; GraphQL fields are `camelCase`. Map between them in the service or mapper, not in the resolver or the page.

## TypeScript

Every package extends `@findadoc/tsconfig/base.json` with `strict: true`. Do not weaken it per file.

- No `any`. Use `unknown` and narrow it. If a library forces `any`, disable `@typescript-eslint/no-explicit-any` on that line only.
- No `@ts-ignore`. Use `@ts-expect-error` with a reason, and only for a library typing bug.
- No non-null `!` on data from a request, the database, or an external API. Check it.
- Prefer `satisfies` over `as` when building a typed object. An `as` cast on external data needs a check first.
- Use `??` for defaults. `||` also replaces `0`, `''`, and `false`; use it only when that is what you mean.
- Server and MCP imports are ESM with a `.js` extension (`'./logger.js'`). Web imports use the `~/` alias.
- Use `import type` for type-only imports.
- Fixed string sets are `as const` objects or string enums with a type guard, like `MEMBERSHIP_ROLE` and `isMembershipRole` in `apps/server/src/booking/access.ts`.
- Exported functions that are not obvious get a short `/** */` comment that says what they do and why. Comments explain a decision or a rule, with the issue number when there is one (`(#173)`). Do not leave commented-out code or a commented-out import.

## API code

The request path is resolver → service → Kysely. Each layer has one job.

- **Resolvers** (`apps/server/src/resolvers.ts`) authorize, call one service, and turn its `Result` into a response with `convertErrorsToGqlErrors`. They do not query the database or hold business rules.
- **Services** (`apps/server/src/services/`) validate input, run queries, map rows to GraphQL types, and return `Result<T>` from `apps/server/src/result.ts`. A service catches its own errors, logs them, and returns `hasErrors: true` with an `ErrorCode` and an `httpStatus`. It does not throw to the resolver for an expected failure.
- **Validation** lives in `apps/server/src/validation/`. Validate every input at the API: ids, string lengths, emails, phone numbers, URLs, enums, and list limits. The web form checks are for the user; they are not a security boundary.
- Add a new `ErrorCode` instead of reusing one that means something else. The client reads the code, not the message.
- Use the shared helpers in `apps/server/utils/` and `@findadoc/utils` before writing another one.

## Security

Find a Doc holds patient booking requests, insurance documents, and health information. Treat that data as APPI special care-required data, even where the law calls it ordinary personal information. When a rule here and convenience disagree, follow the rule.

### Authorization

- Every resolver is wrapped in `withScope`, `withAnyScope`, `withAuthenticatedScope`, `withAuthenticatedUser`, or `withClinicScope` from `apps/server/src/auth.ts` and `apps/server/src/booking/facilityRoles.ts`. A new resolver without one is a bug. `apps/server/__tests__/resolverScopes.test.ts` checks this; add the new resolver there.
- Pick the narrowest scope. A new scope goes in the `Scope` enum and in `roleScopes` for each role that needs it. Production strips write scopes from anyone who is not Admin or Moderator. Keep that.
- A scope says what kind of thing a user may do. It does not say which clinic. Booking services check the facility through `apps/server/src/booking/access.ts` on every call (see Booking above).
- Roles come from verified JWT claims or from `clinic_memberships`. Never from a request argument, a header, or a cookie the client sets.
- `TEST_ENABLED=true` skips auth. It is set only in CI and local tests. Never set it in a deployed environment, and never add another bypass.

### Data access

- Build every query with Kysely. Values go in as bound parameters. Do not use `sql.raw` or `sql.lit` with anything a user can influence, and do not build SQL with string templates. A dynamic column or order name goes through an allowlist, like `apps/server/src/search/orderColumn.ts`.
- Select only the rows the caller may see. Filter by facility or owner in the query, not after the query in JavaScript.
- A list query always has a limit. Use the caps in `apps/server/utils/requestedFields.ts` and `apps/server/src/search/listQuery.ts`.
- A status change that two people can make at once is a compare-and-set on the current value (`.where('status', '=', current)`), not a read then a write.
- The API logs in as `findadoc_api`, which can read and write rows but cannot change the schema. Do not grant it more.

### Personal and health data

- Do not log personal data. That includes names, emails, phone numbers, dates of birth, addresses, free-text answers, file names, object keys, booking tokens, and access tokens. Log ids that are not secret, counts, and error codes. `apps/server/docs/booking-retention.md` shows the pattern.
- Do not log a whole input object, a whole row, a request body, or an `error` whose message can repeat the input. Log the error code and the field name.
- Sentry stays at `sendDefaultPii: false`. Do not attach user data to Sentry scopes or breadcrumbs.
- Do not send personal data to analytics (Umami, Google tags). Event properties are fixed labels, not user input.
- Collect only the fields the clinic needs. Never ask for a My Number or its card (`booking-retention.md`).
- Every new kind of stored personal data needs a retention rule and a purge path before it ships. Uploads carry `sensitivity` and `retain_until`.
- Health data is sent to a clinic only after explicit consent, and the time of consent is stored (`health_data_consented_at`).
- Booking emails, links, and pages never put personal data in a URL. A manage link carries an unguessable token, not an id.
- Do not copy production data to a laptop, a fixture, a seed, a test, an issue, or a pull request. Use the fake data in `apps/server/src/fakeData/` and the seed.

### Secrets and configuration

- Secrets come from environment variables. A new API setting is a function in `apps/server/utils/environmentVariables.ts`. Do not add a new `process.env` read elsewhere. The Lambda entry points and `booking/retention.ts` are the existing exceptions.
- Never commit a secret, a token, a private key, or a real `.env`. The committed `.env.dev`, `.env.prod`, `.env.sample`, and `.env.example` hold only non-secret values and commented-out names.
- Do not put a secret in `runtimeConfig.public` or any `NUXT_PUBLIC_*` value. Everything there ships to the browser.
- A client API key (Maps) is restricted by referrer in its console. A server key (Places) stays on the server.

### Web and HTTP

- Do not use `v-html` or set `innerHTML` with data from the API or the user. Render text with `{{ }}`. JSON-LD goes through `serializeJsonLd` in `apps/web/utils/structuredData.ts`, which escapes `<`.
- A stored URL (clinic website, Maps) is parsed with `new URL()` and must be `https:` before it is saved or rendered as a link (`apps/web/utils/formValidations.ts`). Never render a `javascript:` or `data:` URL. External links that open a new tab use `rel="noopener noreferrer"`.
- CORS origins are the allowlist in `apps/server/src/apiCors.ts`. Do not add a wildcard or reflect the request origin.
- Signed-out endpoints that write or send email are rate-limited, like `apps/server/src/booking/rateLimits.ts`. A new one gets a budget too.
- Upload URLs are short-lived and scoped to one object key. Check file type and size on the server.
- Tokens stay in memory on production (see Auth above). Do not put tokens or personal data in `localStorage`, `sessionStorage`, or a cookie. `localStorage` holds UI preferences and the local-only cases already named.

### Dependencies

- Add a dependency only when it does something we should not write ourselves. Prefer one that is maintained and widely used. Pin through `pnpm-lock.yaml`; Renovate updates it.
- Do not add a package that runs install scripts, fetches code at runtime, or loads a script from a CDN without review.
- GitHub workflows set read-only `permissions` at the top. A job that needs more names exactly what it needs.

## Database migrations

- A migration is a new file in `apps/server/supabase/migrations` named `YYYYMMDDHHMMSS_short_description.sql`. Never edit a migration that has merged. Fix it with a new one.
- Start the file with a comment that says what changes and why, with the issue number.
- Make it safe to run once on production data: add columns as nullable or with a default, backfill in a separate step, then add the constraint.
- Add a foreign key, a `CHECK`, or `NOT NULL` where the data has a rule. The database is the last check.
- After a schema change, update `apps/server/src/typeDefs/kyselyTypes.ts` and the seed (`apps/server/scripts/seed/`), then run `pnpm db:reset` and `pnpm db:seed`.
- A data backfill is a script in `apps/server/utils/` with dry-run as the default, like `backfillFacilityCities.ts`.

## Web code

- Components use `<script setup lang="ts">` and `defineProps<{ ... }>()`. Template first, then script, then any scoped style.
- Shared state goes in a Pinia store in `apps/web/stores/` named `<thing>Store.ts`. Reusable logic goes in a composable in `apps/web/composables/` named `use<Thing>.ts`. Plain functions go in `apps/web/utils/`.
- Every user-facing string uses `t()` with a key in `apps/web/i18n/locales/en.json`, and every locale gets the key (see Locale files above). No hard-coded English in a template.
- Style with Tailwind classes and the theme tokens in `apps/web/assets/css/tailwind.css`. ESLint enforces class order and names. Do not add a hex color in a component.
- Accessibility is required. Interactive elements are `<button>` or `<a>`, not a clickable `<div>`. Images have `alt`. Inputs have a label. Clickable things work from the keyboard. Fix `vuejs-accessibility` warnings in code you touch.
- Add `data-testid` to anything a Playwright spec selects.
- GraphQL calls go through `apps/web/utils/graphql.ts` and the selections in `graphqlSelection.ts` (see GraphQL types above).

## MCP server

The MCP server is a public read-only client of the public API. Keep it that way.

- GraphQL queries live in `apps/mcp/src/core/`. Tools in `src/tools/` and REST routes in `src/rest.ts` call `core/`; they do not hold a query.
- Every tool input is a `zod` schema with limits on strings and lists.
- It sends no auth token and exposes no booking, submission, moderation, or user data.

## Tests

- New behavior gets a test. A bug fix gets a test that fails without the fix.
- API tests are Vitest in `apps/server/__tests__/<subject>.test.ts`. Web unit tests are in `apps/web/tests/vitest/`. Browser tests are Playwright in `apps/web/tests/e2e/<page>.spec.ts`. MCP tests mirror `apps/mcp/src/` under `apps/mcp/tests/`.
- Test the rule, not the implementation: `describe` the subject, and name each `it` by what should happen (`'refuses other countries in production mode'`).
- Authorization changes need a test for the user who is allowed and for the user who is not.
- Tests use fake data. No real names, emails, phone numbers, or clinic patients.
- Do not skip, delete, or loosen a test to make CI green. Fix the code or explain in the pull request why the test was wrong.

## Pull request checklist

Before a change is done:

1. `pnpm lint`, `pnpm typecheck`, and the tests for the packages you changed pass.
2. Schema change: `pnpm generate` and `packages/graphql/src/index.ts` committed.
3. Migration: new file only, types and seed updated.
4. New resolver: scope wrapper and a `resolverScopes` test.
5. New personal data: validation, retention, no logging, and a note in the pull request.
6. New user-facing text: every locale.
7. Contributor-facing change: `apps/docs` in English and Japanese.
8. Title and commits follow Conventional Commits, with a scope when one fits (`fix(booking): ...`).

## Languages

`apps/server/src/languages/publishedLocales.ts` is the search-facet allowlist (#1015). Spreadsheet codes map through `apps/server/src/vocabulary/languageMap.ts`. Services do not import that map.

`facilities.supported_languages` is language support with no named professional. Do not create a healthcare professional to hold a hospital-level language. A language-only search matches that list or one professional who speaks every requested language. A specialty filter still requires the same professional to match both. Existing `spoken_languages` stay on the professional, including `en_US` and `ja_JP`. A Locale that is not on the allowlist is not a facet.

## Licenses

A professional has one primary clinical license. PhD, MPH, and DSc are additional credentials. DVM, EdD, and DSW stay in the enum and stay hidden from the moderation picker.

`apps/server/utils/backfillProfessionalLicenses.ts` is the #1014 run. Dry-run is the default. It does not rewrite `degrees`. MD+DO is queued as `NEEDS_REVIEW` with recommendation `MD`. DDS+DMD is queued with recommendation `one_dental_license`. The 18 Sep notes disagree about that dental count, so the run counts the rows it reads and does not collapse them. A row with `license_review = CONFIRMED`, or a row that already has `primary_license`, is left alone. A new professional is not given a license. The moderator chooses one.

## Places

`apps/server/docs/places-storage.md` is the storage rule. Follow it. Do not open a Places write path that contradicts it.

- Store `place_id`. Refresh it if it is older than 12 months.
- Places latitude and longitude last at most 30 days, then delete or refresh.
- Do not store a Places display name, formatted address, phone, website, hours, photos, or reviews as directory data.
- The Maps URL enrichment path is gone (#1008). Do not copy a Places payload into a submission. The picker is #1012. The facility resolver is #1013.

## Directory HTML

Clinic, doctor, hub, and facet pages are generated for English and Japanese only. `apps/web/utils/localePath.ts` names that set as `DIRECTORY_PRERENDER_LOCALE_CODES`. Marketing pages still generate for every locale. A directory URL in another locale renders in the browser, stays `noindex`, and stays out of hreflang and the sitemap. Do not add a `/ja-JP/*` rewrite. Unknown Japanese clinics stay a real 404.

Moderation forms that already have saved data open in preview. Create forms stay editable. A Maps link that matches a clinic disables Submit on the public form. The same match is a warning in moderation, and update, approve, and create stay available.

## Auth

The web Auth0 client keeps its cache in memory on the production site. A reload there restores the session through the iframe on `findadoc.jp.auth0.com`. That cookie is third-party on localhost, so the browser blocks it and a local reload logs the user out. `auth0CacheLocation` in `apps/web/utils/auth0Config.ts` uses localStorage only for localhost and `127.0.0.1`. Do not use localStorage for the production origin. A refresh token is not requested. After the access token expires, a local reload still cannot renew it until Auth0 allows refresh tokens for this client.

## Booking

`apps/server/docs/booking-access.md` is the booking access rule. Clinic owners and staff get `Role.FacilityOwner` and `Role.FacilityStaff`, which the API derives from claimed `clinic_memberships` rows on every request (`apps/server/src/booking/facilityRoles.ts`). Do not read them from Auth0. Clinic resolvers use `withClinicScope` with an every-clinic scope and an own-clinic scope, and every booking service still checks the facility through `apps/server/src/booking/access.ts`. Do not give a clinic member a global booking scope. Admins keep every-clinic access only while booking is in preview. Moderators get none. Only `requested` and `confirmed` appointments hold a slot, and a status change is a compare-and-set on the current status. A new intake form is a `FormSource` in `apps/server/src/booking/formDefinitions.ts`; a clinic offers it through `booking_settings.form_definition_ids`. Booking is for visitors in Japan only (#173): `submitBooking` and `createBookingUploadUrl` go through `apps/server/src/booking/region.ts`, and the manage link stays open everywhere. Clinic notices go to the clinic's members only (#161). Do not fall back to directory emails: the facility contact, clinic-page doctors, or linked professionals never opted in.

## Locale files

`apps/web/i18n/checkLocaleKeys.js` compares every file in `apps/web/i18n/locales` with `en.json`. Web typecheck runs it, and it does not write the locale files. A missing key, an extra key, or a `{token}` that does not match English fails the check. A value that is still the English sentence also fails, unless that key is listed in `apps/web/i18n/sameAsEnglish.json` because it is a brand name, a person's name, or a word that is the same in that language. Add the translation. Do not copy the English sentence in to make the check pass.

## Developer docs

`apps/docs` is docs.findadoc.jp, the contributor site. It is built with Zensical and deployed to GitHub Pages by `.github/workflows/docs.yml` when `apps/docs` changes on `main`.

Update it in the same change that makes it wrong: a root or contributor-facing `pnpm` script, the Node or pnpm pin, an app or package, how something is set up, run, tested, or deployed, the stack, or the architecture. English is `apps/docs/docs/`. Japanese mirrors the same path under `apps/docs/docs/ja/`. Write both. A new page also goes under `nav` in `apps/docs/mkdocs.yml`.

`pnpm lint:docs` runs `apps/docs/scripts/checkDocs.mjs`. The Docs workflow runs it on every pull request, not only docs changes. It fails on a page without its mirror, a page missing from `nav`, a broken relative link, a `pnpm` command in code that no package defines, a Node or pnpm version that does not match `.nvmrc` or `packageManager`, Yarn, `npm run`, or `npx` in a code block, or a link to a retired single-app repo. Fix the page. Do not loosen the check to make it pass.

Rules that only code follows, such as `apps/server/docs/city-rules.md`, stay next to that code. The site links to them.

## Pull requests

A pull request title follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary): `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:`, or `revert:`. `.github/workflows/lint-pr-title.yml` rejects anything else. Commit subjects use the same form.

## Node and pnpm

Node is pinned in the repo-root `.nvmrc` (24.22.0). pnpm 10.27.0 comes from the root `packageManager` field through Corepack. After `nvm use`, including on Windows, activate pnpm for that Node install before running `turbo` or `pnpm`:

```bash
corepack enable
corepack prepare pnpm@10.27.0 --activate
```

Without that shim, `turbo` fails with `Unable to find package manager binary`.

## GraphQL types

`apps/server/src/typeDefs/schema.graphql` is the only schema. Web, the API, and the MCP server import the generated types from `@findadoc/graphql`. Do not hand-write those types, and do not add another codegen config.

When a type, field, enum, input, query, or mutation changes in that schema, regenerate from the repo root before the change is finished:

```bash
pnpm generate
pnpm --filter @findadoc/graphql build
```

Commit `packages/graphql/src/index.ts` with the schema change. `pnpm generate` rewrites that file. The build compiles it so the rest of the workspace can import the new types.

Every web read of a facility, professional, or submission uses `apps/web/utils/graphqlSelection.ts`. That includes moderation, search, clinic, doctor, hub, sitemap, prerender, and the directory Playwright specs. A new field on one of those types fails web typecheck until that file names it. Do not paste a shorter field list into another query. Maps previews, city suggestions, and delete results are different types. They stay on their own selections.

The API reads whole rows with Kysely. It does not turn requested GraphQL fields into a column list. `Facility.healthcareProfessionalIds` and `HealthcareProfessional.facilityIds` are field resolvers. They load through the per-request DataLoaders in `apps/server/src/loaders.ts`, so a list runs one junction query, not one per row. A mutation that already returns those ids keeps them. A facility list that does not ask for `healthcareProfessionalIds` may return up to 1000 rows. Otherwise the limit is 100 (`apps/server/utils/requestedFields.ts`). A renamed column fails server typecheck through the Kysely table types in `apps/server/src/typeDefs/kyselyTypes.ts`. The text filters use `search_text`. That column is generated, so the seed does not insert it. `payment_options` may come back as a JSON string. The facility mapper parses that string, or uses the array, and otherwise returns `[]`.

`pnpm --filter @findadoc/server typecheck` also runs `apps/server/scripts/seed/data.ts`. `apps/server/scripts/seed/schema.ts` requires each seed type to name every required insert column. `facilities.supported_languages` is one of those columns. The first three seed professionals are dentists at Tokyo Minato facilities, and they speak English and Japanese. The address city is Minato, not Tokyo. Facet pages are generated only when one prefecture has three professionals in the same specialty, and random rows do not cluster. That pin is what writes `/tokyo/dentistry`.

Playwright starts the local Postgres container (`pnpm db:start`), then runs `pnpm db:reset` and `pnpm db:seed` before the API. `db:start` retries when the Postgres image is rate-limited. Migrations are the SQL files in `apps/server/supabase/migrations`. `apps/server/scripts/db/migrate.ts` applies them and records each version in `public.schema_migrations`. The Supabase CLI is not used. `pnpm db:push` migrates production and needs `DATABASE_URL`. Directory specs skip only when the local API connection is refused and this is not CI. In CI an API error, an empty seed, or a missing prerendered specialty facet fails the test. A local database that has not been reset onto the current migrations makes the professional list fail as `searchProfessionals` / `INTERNAL_SERVER_ERROR`. Reset and seed before changing the list query. `db:reset` only runs against the local database.

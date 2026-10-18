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

## Locale files

`apps/web/i18n/checkLocaleKeys.js` compares every file in `apps/web/i18n/locales` with `en.json`. Web typecheck runs it, and it does not write the locale files. A missing key, an extra key, or a `{token}` that does not match English fails the check. A value that is still the English sentence also fails, unless that key is listed in `apps/web/i18n/sameAsEnglish.json` because it is a brand name, a person's name, or a word that is the same in that language. Add the translation. Do not copy the English sentence in to make the check pass.

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

`apps/server/utils/fieldSelectionUtils.ts` maps each of those fields to a real table column, or `skip` when the API resolves it from another table. `healthcareProfessionalIds` and `facilityIds` are `skip`. `city` selects `city_id`. An unknown requested field is ignored so it cannot invent a missing column and return `INTERNAL_SERVER_ERROR`. A new field or a renamed column fails server typecheck until that map is updated. The text filters use `search_text`. That column is generated, so the seed does not insert it. `payment_options` may come back as a JSON string. The facility mapper parses that string, or uses the array, and otherwise returns `[]`.

`pnpm --filter @findadoc/server typecheck` also runs `apps/server/scripts/seed/data.ts`. `apps/server/scripts/seed/schema.ts` requires each seed type to name every required insert column. `facilities.supported_languages` is one of those columns. The first three seed professionals are dentists at Tokyo Minato facilities, and they speak English and Japanese. The address city is Minato, not Tokyo. Facet pages are generated only when one prefecture has three professionals in the same specialty, and random rows do not cluster. That pin is what writes `/tokyo/dentistry`.

Playwright starts local Supabase, then runs `pnpm db:reset` and `pnpm db:seed` before the API. `supabase start` retries when the public Postgres image is rate-limited. Directory specs skip only when the local API connection is refused and this is not CI. In CI an API error, an empty seed, or a missing prerendered specialty facet fails the test. A local database that has not been reset onto the current migrations makes the professional list fail as `searchProfessionals` / `INTERNAL_SERVER_ERROR`. Reset and seed before changing the list query. `db:reset` only runs against the local database.

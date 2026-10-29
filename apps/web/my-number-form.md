# My Number / MyNa on the booking form — integration and privacy

**Project:** Findadoc.jp × MINNA online consultation booking  
**Status:** Draft proposal (no implementation in this change)  
**Answers:** [`online-booking.md`](./online-booking.md) §6.4 pattern 3 and §9.2  
**Last updated:** 2026-10-25

> This document proposes how the patient booking form would obtain insurance information that doctors and the coordinator need, when the patient uses a **My Number card as a health insurance card**, and how that path stays safe and private. It is a design draft for review. It does not add APIs, schema, or UI.

---

## 1. Goal

Doctors and the consultation coordinator need **insurance qualification context** before the online visit (who is insured, insurer, symbols/numbers as the clinic EMR expects, and enough identity to match the patient). Patients who use a My Number insurance card today are told to open MyNa Portal, download proof, and upload an image (`online-booking.md` §6.4).

We want a clearer answer to §9.2:

1. Can Findadoc **call a MyNa / My Number–related API** from the booking form?
2. If yes, what may we collect, who may see it, and how long may we keep it?
3. If not (or not yet), what is the **safe interim** that still gives the clinic what it needs?

---

## 2. Hard boundary: never collect the 12-digit My Number

Under the My Number Act (行政手続における特定の個人を識別するための番号の利用等に関する法律), the **Individual Number** (12 digits) may only be handled for legally listed purposes by authorised handlers.

**Findadoc must not:**

- Ask for the 12-digit My Number on any form field
- OCR, store, log, or export that number from an uploaded image
- Put that number in GraphQL, Excel exports, audit JSON, analytics, or support tickets

**Findadoc may** help the patient prove **health-insurance qualification** (資格情報) and related clinical prep data the clinic already needs, without ever treating the Individual Number as a form value.

If an upload appears to show the 12-digit number, the product rule is: reject or redact before persistence, and teach the patient which MyNa screen to capture (qualification / insurance info, not the Number itself).

---

## 3. Three different “My Number” paths (do not conflate them)

| Path | Who operates it | What Findadoc should do |
|---|---|---|
| **A. Online eligibility verification (オンライン資格確認)** | The **clinic** (or its EMR / onshi vendor), as a medical institution | Out of Findadoc scope. The clinic confirms qualification at consultation time with its own reader / online診療向け onshi flow. Booking must not pretend to be onshi. |
| **B. MyNa Portal medical-insurance APIs** (医療保険情報取得API and related Digital Agency APIs) | An approved **API user** after Digital Agency review; patient consent in MyNa | Possible long-term integration for Findadoc *if* legal role, purpose, and PHR guidelines fit. Application-to-production is typically **~6–12 months**. |
| **C. Guided manual MyNa download + upload** | Patient + Findadoc booking form | **Recommended v0 / launch path.** Multilingual steps; patient uploads a screenshot or PDF of qualification (and only what the clinic needs); Findadoc stores it under the privacy rules below. |

Path A stays with the clinic EMR. Path B is a product and legal programme, not a sprint. Path C is what the booking form should ship first, shaped so a later Path B swap-in does not rewrite consent or retention.

---

## 4. Recommended product shape on the form

### 4.1 Patient-facing insurance step

On the intake / insurance step, the patient chooses one of:

1. Photo of a physical insurance card  
2. Photo of an eligibility certificate (資格確認書)  
3. **My Number insurance card → MyNa guidance** (this proposal)  
4. Uninsured / other (existing open question in `online-booking.md` §9.5)

For option 3, the form does **not** call government APIs in v0. It:

1. Explains in the patient’s language (including やさしい日本語 when that locale exists) that they will open MyNa Portal, show insurance / qualification info, and upload **that** screen — not the 12-digit Number.  
2. Links out to the official MyNa Portal entry (external).  
3. Accepts an image or PDF under the same upload limits as §6.4.  
4. Runs server-side checks: file type/size; optional malware scan; **heuristic redact / reject** if a 12-digit Individual Number pattern is detected in OCR (best-effort; not a substitute for clear UX copy).  
5. Stores the object only after explicit booking consent (§6.8), tagged with purpose `insurance_verification_for_consultation`.

### 4.2 What doctors / the coordinator see

A **Coordinator** role (missing today — `online-booking.md` Appendix A.3.9) opens a booking detail view:

- Patient contact and intake fields needed for EMR entry  
- Insurance artifact: time-limited signed URL to the upload, or structured fields if Path B later fills them  
- **No** Individual Number field  
- Access logged (who, when, booking id) without copying medical free-text into the audit row

Clinic physicians receive the same insurance context via the coordinator’s EMR entry (manual today). Findadoc does not give every `User` or `Moderator` reservation read access (fix A.3.4 before any real patient data).

### 4.3 Optional later: API call from the form (Path B)

If Findadoc becomes an approved MyNa API user for **医療保険情報取得API** (or a narrower qualification-only product the Digital Agency accepts):

```
Patient browser          Findadoc API              MyNa / Digital Agency
     |                        |                              |
     |  start insurance step  |                              |
     |----------------------->|  create consent session      |
     |                        |----------------------------->|
     |  redirect / app link to MyNa consent                  |
     |<-----------------------------------------------------|
     |  authenticate + consent in MyNa                        |
     |----------------------------------------------------->|
     |                        |  callback + one-time token   |
     |                        |<-----------------------------|
     |                        |  fetch allowed attributes    |
     |                        |----------------------------->|
     |                        |  insurance attrs (no My Number)|
     |                        |<-----------------------------|
     |  “Insurance verified”  |  persist purpose-limited row |
     |<-----------------------|                              |
```

Rules for that call:

- Browser never holds Digital Agency client secrets; only `apps/server` talks to MyNa.  
- Fetch **only** attributes the clinic needs for this booking (qualification / insurer identifiers), not a broad PHR dump “because the API allows it.”  
- Patient consent is MyNa’s consent **plus** Findadoc’s recorded booking consent (document version, language, timestamp).  
- Handling of medical-insurance information (other than 医療費通知) must follow the PHR service-provider guidelines referenced by the Digital Agency API docs.  
- Tokens are short-lived; refresh only with continued purpose and consent.  
- Expect a long approval track; do not block Nov–Dec consultation launch on Path B.

---

## 5. Privacy and safety controls

These apply to Path C now and Path B later. They extend `online-booking.md` §6.8 and §7.

### 5.1 Legal and policy (before collecting anything)

| Control | Requirement |
|---|---|
| Purpose limitation | Stated purpose: verify insurance for this consultation and hand off to the clinic / coordinator. No secondary use (marketing, directory analytics, model training). |
| APPI 要配慮個人情報 | Health and insurance images / API attributes need **separate affirmative opt-in**, not a buried terms checkbox. |
| My Number Act | Individual Number never collected; uploads instructed and filtered accordingly. |
| Controller / processor | Written agreement: who is controller for intake vs clinical record (`online-booking.md` §9.8, §9.14). |
| Privacy policy + booking terms | Extend beyond today’s directory-only policy; name categories, recipients (clinic, interpreter if any, payment provider), retention, and patient rights. |
| Language | Consent text in every booking UI language; consent against unread English-only text is invalid for launch. |

### 5.2 Access control (engineering)

| Control | Requirement |
|---|---|
| Role | New `Coordinator` (and Admin). Moderators who only edit the public directory do **not** inherit patient-document read. |
| Scopes | e.g. `read:booking-pii`, `read:insurance-artifacts`, `export:bookings` — not granted to base `User`. |
| Ownership | Fix reservation IDOR: only the patient (or tokenised booking link), Coordinator, or Admin. |
| URLs | Insurance files via **short-lived signed URLs**; no permanent public bucket paths. |
| Export | Excel export is authenticated, rate-limited, and access-logged; cells must not include Individual Numbers. |

### 5.3 Storage and retention

| Control | Requirement |
|---|---|
| Encryption | Encrypted at rest; TLS in transit. |
| Separability | PII and medical/insurance payloads in tables or columns that can be purged without deleting the anonymous booking metric row (`online-booking.md` §7). |
| Audit logs | Do **not** dump insurance images or symptom text into `audit_logs` JSONB (fix A.3.8). Log actor, action, booking id, field names touched. |
| Retention | Default proposal for review: delete insurance artifacts **30 days after consultation completion** or **immediately after** successful handoff to the clinic if legal review prefers zero Findadoc retention (§9.12, §9.14). Pending bookings: delete on cancel or after a fixed abandon TTL. |
| Backups | Backup TTL must not silently outlive the retention promise; document the gap if any. |

### 5.4 Application security on the “call”

Whether the “call” is Path C upload processing or Path B MyNa HTTP:

- Secrets only on the server; web stays static (`online-booking.md` A.4).  
- Strict allowlists for redirect URIs and callbacks.  
- Idempotent callbacks; bind tokens to `booking_id` + patient session.  
- Rate-limit start-consent and upload endpoints.  
- No MyNa payloads in client logs, Sentry breadcrumbs, or CDN access logs.  
- Minimal structured server logs: request id, booking id, status — not response bodies.

### 5.5 Human process

- Coordinator training: do not paste insurance screenshots into Slack/email; use the app export only.  
- Support playbook: patient deletion / access requests go to the agreed controller contact.  
- Incident: lost export or signed URL leak → revoke URLs, rotate keys, notify per agreement and APPI breach rules.

---

## 6. What we explicitly will not build on the form

- A text field labelled “My Number” / マイナンバー  
- Client-side use of MyNa client credentials  
- Treating Findadoc as オンライン資格確認 for the clinic  
- Unlimited retention of insurance images “for convenience”  
- Sharing Path B PHR payloads with interpreters or payment providers unless consent and contract say so (default: **no**)

---

## 7. Phased plan

| Phase | Deliverable | Blocks launch? |
|---|---|---|
| **0 — Policy** | Booking privacy/terms draft; controller agreement outline; legal review scheduled | Yes for any real patient insurance data |
| **1 — Path C form** | MyNa guidance step + upload + Coordinator view + signed URLs + retention job + consent records | Yes for My Number–card patients if we refuse other insurance paths |
| **2 — Access hardening** | Coordinator role, reservation ownership checks, audit without payload dumps | Yes before real data |
| **3 — Path B exploration** | Digital Agency API interest application; purpose narrowing; security review | No — parallel track |
| **4 — Path B build** | Server-only MyNa consent + attribute fetch; map into the same Coordinator UI as Path C | No — post-approval |

Interim Google Forms + Excel (`online-booking.md` §9.7) must still follow §2 and §5.1: no Individual Number field, limited access to the sheet, deletion after the block.

---

## 8. Open decisions for reviewers

1. Prefer **zero Findadoc retention** (transit-only to clinic) vs **short retention** for coordinator re-entry — drives storage design.  
2. Is Findadoc’s purpose narrow enough that Digital Agency would accept Path B, or should Path B stay “never” and Path C + clinic onshi remain permanent?  
3. Who funds and owns the bilingual APPI / My Number Act review?  
4. OCR redaction: ship best-effort in phase 1, or rely on UX copy only until a vendor is chosen?

---

## 9. References

- [`online-booking.md`](./online-booking.md) — booking requirements; §6.4, §6.8, §9.2  
- Digital Agency — [医療保険情報取得API](https://developers.digital.go.jp/documents/mynaportal-api/specification/medicalexaminfo/) (approval flow; PHR guideline note; ~6–12 month reference timeline)  
- MHLW — [オンライン資格確認（医療機関向け）](https://www.mhlw.go.jp/stf/newpage_08280.html) (clinic-side Path A)  
- Findadoc privacy page (directory-only today): https://www.findadoc.jp/privacypolicy  

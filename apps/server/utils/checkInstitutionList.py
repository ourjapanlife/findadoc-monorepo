"""Check the multilingual institutions rows against public sources before the import (#21).

Writes the evidence file that `importInstitutionList.ts --evidence` reads. For every row:

- Ministry open data (医療情報ネットのオープンデータ, e-Gov data portal, CC BY): is the institution
  in the registry, and where? A match on name and address sends the registry's municipality, which
  the import uses when the sheet's address names none, and to catch a city the two disagree on.
  The open data holds only part of each prefecture, so `not_found` is a note, not a closure.
- Japan Post postal codes (utf_ken_all.csv and the business-code file jigyosyo.csv): does the
  postal code belong to the address, or is it the institution's own business code?
- The website, fetched once: https first, then http. Only a working https link is sent to store.
  A site that redirects to another host and names neither the clinic nor its phone is not sent.
  When the sheet's site fails, the registry's site is used if it works and names the clinic.

Downloads (keep them out of the repository):
- https://data.e-gov.go.jp/data/dataset/iryou_teikyouseido_mhlw (the newest e-gov*.zip)
- https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip
- https://www.post.japanpost.jp/service/search/zipcode/download/office/zip/jigyosyo.zip
  (Shift_JIS; convert with `iconv -f CP932 -t UTF-8 JIGYOSYO.CSV > jigyosyo.csv`)

Usage:
  python3 utils/checkInstitutionList.py --rows rows.json --registry e-gov.zip \\
    --postal utf_ken_all.csv --business jigyosyo.csv --cache /tmp/site-cache --out evidence.json \\
    [--skip-websites]

Only the standard library is used. Website fetches go through curl, through HTTPS_PROXY when it is set.
"""
import argparse
import concurrent.futures
import csv
import hashlib
import io
import json
import os
import re
import subprocess
import unicodedata
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

MUNICIPALITIES = Path(__file__).resolve().parents[1] / 'src' / 'vocabulary' / 'municipalities.json'
REGISTRY_FILES = ('01-1_hospital', '02-1_clinic', '03-1_dental')
KIND_BY_TYPE = {'病院': '01', '診療所': '02', '歯科診療所': '03'}
KANJI = {'〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}
CORPORATE = re.compile(
    r'^(医療法人社団|医療法人財団|特定医療法人|社会医療法人|医療法人|社会福祉法人|一般社団法人|一般財団法人|'
    r'公益社団法人|公益財団法人|地方独立行政法人|独立行政法人|国立大学法人|公立大学法人|学校法人|宗教法人|'
    r'医療生活協同組合|生活協同組合)'
)
# Left after a corporation name is removed, these name nothing on their own.
GENERIC = {'クリニック', '病院', '医院', '歯科医院', '歯科', '診療所', '歯科クリニック', '内科', '眼科', '皮膚科', '整形外科',
           '小児科', '耳鼻咽喉科', '内科クリニック', 'デンタルクリニック', '総合病院', 'レディースクリニック', '眼科医院',
           '歯科診療所', '内科医院', '記念病院', '中央病院', '外科', '産婦人科'}
URL = re.compile(r'https?://[^\s、，,（()）「」<>"\']+', re.I)
USER_AGENT = 'Mozilla/5.0 (compatible; directory-link-check)'


def nfkc(value):
    return unicodedata.normalize('NFKC', value or '')


# ---- names and addresses

def name_forms(name):
    """The name with spaces removed, and again without a leading corporation name."""
    text = nfkc(name)
    compact = re.sub(r'\s+', '', text)
    forms = {compact}
    parts = text.split()
    if len(parts) > 1 and CORPORATE.match(parts[0]):
        forms.add(''.join(parts[1:]))
    corporate = CORPORATE.match(compact)
    if corporate:
        rest = compact[corporate.end():]
        body = re.match(r'^.{1,12}?(会|団|社)', rest)
        if body:
            forms.add(rest[body.end():])
    return {form for form in forms if len(form) >= 3 and form not in GENERIC}


def names_agree(left, right):
    if left & right:
        return 'exact'
    for a in left:
        for b in right:
            short, long_ = (a, b) if len(a) <= len(b) else (b, a)
            if len(short) >= 4 and short in long_:
                return 'partial'
    return None


def kanji_number(match):
    text = match.group(0)
    if '十' in text:
        tens, _, ones = text.partition('十')
        return str((KANJI.get(tens, 1) if tens else 1) * 10 + (KANJI.get(ones, 0) if ones else 0))
    return ''.join(str(KANJI[c]) for c in text)


def address_key(address, prefecture_ja):
    """'北海道函館市石川町３３１番地１' and '函館市石川町331-1' are the same key."""
    text = re.sub(r'\s+', '', nfkc(address))
    if prefecture_ja and text.startswith(prefecture_ja):
        text = text[len(prefecture_ja):]
    text = re.sub(r'[ー－‐−—―~〜]', '-', text)
    text = re.sub(r'[〇一二三四五六七八九十]+(?=丁目|番|号|地割|条|線)', kanji_number, text)
    text = text.replace('大字', '').replace('字', '')
    text = re.sub(r'(丁目|番地の|番地|番|号|の)', '-', text)
    return re.sub(r'-+', '-', text)


def address_core(key):
    """Up to the last number of the street address; the building after it is dropped."""
    match = re.match(r'^(.*?\d+(?:-\d+)*)', key)
    return match.group(1).rstrip('-') if match else key


def same_address(left, right):
    a, b = address_core(left), address_core(right)
    return a == b or (len(a) >= 6 and (right.startswith(a) or left.startswith(b)))


# ---- municipalities

class Municipalities:
    def __init__(self, path):
        rows = json.loads(Path(path).read_text(encoding='utf-8'))
        self.by_code = {row['lgCode'][:5]: row for row in rows}
        self.by_prefecture = defaultdict(list)
        for row in rows:
            self.by_prefecture[row['lgCode'][:2]].append(row)

    def city_of_code(self, code):
        """A designated-city ward code (27127) belongs to the city at or below it (27100)."""
        if code in self.by_code:
            return self.by_code[code]
        parents = [c for c in self.by_code if c[:2] == code[:2] and c[2] == '1' and c[4] == '0' and c <= code]
        return self.by_code[max(parents)] if parents else None

    def named_in(self, prefecture_code, address):
        """The longest municipality named in the address, or None. Only used to gate weak name matches."""
        text = nfkc(address)
        found = sorted((row for row in self.by_prefecture[prefecture_code] if row['nameJa'] in text),
                       key=lambda row: len(row['nameJa']), reverse=True)
        return found[0] if found else None


def canonical(row):
    return {'prefectureEn': row['prefectureEn'], 'nameEn': row['nameEn'], 'nameJa': row['nameJa']}


# ---- ministry registry

def load_registry(zip_path):
    registry = defaultdict(list)
    with zipfile.ZipFile(zip_path) as archive:
        for name in archive.namelist():
            if not name.startswith(REGISTRY_FILES):
                continue
            kind = name[:2]
            with archive.open(name) as handle:
                for row in csv.DictReader(io.TextIOWrapper(handle, encoding='utf-8-sig')):
                    prefecture = row['都道府県コード'].zfill(2)
                    forms = name_forms(row['正式名称']) | (name_forms(row['略称']) if row['略称'] else set())
                    registry[prefecture].append({
                        'id': row['ID'],
                        'kind': kind,
                        'code': prefecture + row['市区町村コード'].zfill(3),
                        'address': row['所在地'],
                        'website': row['案内用ホームページアドレス'],
                        'forms': forms
                    })
    return registry


def match_registry(row, entries, prefecture_ja, municipalities):
    raw = row['raw']
    forms = name_forms(raw.get('医療機関', ''))
    key = address_key(raw.get('住所', ''), prefecture_ja)
    kind = KIND_BY_TYPE.get(nfkc(raw.get('医療機関種別', '')).strip())
    prefecture_code = row['sheet'].split('.')[0].zfill(2)
    ours = municipalities.named_in(prefecture_code, raw.get('住所', ''))

    named, by_address = [], []
    for entry in entries:
        entry_key = entry.setdefault('key', address_key(entry['address'], prefecture_ja))
        agree = names_agree(forms, entry['forms'])
        here = same_address(key, entry_key)
        if agree:
            same_city = ours is not None and municipalities.city_of_code(entry['code']) is not None \
                and municipalities.city_of_code(entry['code'])['lgCode'] == ours['lgCode']
            # A partial name only counts at the same address or in the same municipality.
            if agree == 'exact' or here or same_city:
                named.append((here, agree == 'exact', entry['kind'] == kind, same_city, entry))
        elif here and entry['kind'] == kind:
            by_address.append(entry)

    if named:
        named.sort(key=lambda c: c[:4], reverse=True)
        best = named[0]
        rivals = [c for c in named if c[:3] == best[:3]]
        if len(rivals) > 1 and not best[0]:
            return 'name_ambiguous', None
        if best[0]:
            how = 'name_address' if best[1] else 'name_address_partial'
        elif ours is not None and not best[3]:
            how = 'same_name_other_city'
        else:
            how = 'name_only' if best[1] else 'name_only_partial'
        return how, best[4]
    if len(by_address) == 1:
        return 'address_only', by_address[0]
    return 'not_found', None


# ---- Japan Post

def load_postal(ken_path, business_path):
    towns = defaultdict(list)
    with open(ken_path, encoding='utf-8') as handle:
        for row in csv.reader(handle):
            town = row[8]
            if town == '以下に掲載がない場合' or 'の次に番地がくる場合' in town:
                town = ''
            towns[row[2]].append((row[7], re.sub(r'（.*$', '', town)))
    business = defaultdict(list)
    with open(business_path, encoding='utf-8') as handle:
        for row in csv.reader(handle):
            business[row[7]].append((row[4], row[5], name_forms(row[2])))
    return towns, business


def postal_fits(entries, address, prefecture_ja):
    text = re.sub(r'\s+', '', nfkc(address))
    text = text[len(prefecture_ja):] if text.startswith(prefecture_ja) else text
    for city, town in entries:
        city = nfkc(city)
        bare_city = re.sub(r'^.+?郡', '', city)
        if bare_city not in text:
            continue
        rest = text[text.find(bare_city) + len(bare_city):].replace('大字', '').replace('字', '')
        town = nfkc(town).replace('大字', '')
        return 'ok' if not town or rest.startswith(town) else 'town_differs'
    return 'city_differs'


def check_postal(row, prefecture_ja, towns, business):
    raw = row['raw']
    digits = re.sub(r'\D', '', nfkc(raw.get('郵便番号', '')))
    if len(digits) != 7:
        return 'invalid'
    if digits in towns:
        return postal_fits(towns[digits], raw.get('住所', ''), prefecture_ja)
    if digits in business:
        forms = name_forms(raw.get('医療機関', ''))
        if any(names_agree(forms, entry[2]) for entry in business[digits]):
            return 'ok_business_code'
        fits = postal_fits([(city, town) for city, town, _ in business[digits]], raw.get('住所', ''), prefecture_ja)
        return 'business_code_other_name' if fits == 'ok' else fits
    return 'unknown_code'


# ---- websites

def first_url(value):
    match = URL.search(nfkc(value))
    return match.group(0) if match else ''


# curl exit codes that say the TLS certificate is wrong for a browser too. An incomplete chain
# ("unable to get local issuer certificate") is not one: browsers fetch the missing intermediate.
CERTIFICATE_ERRORS = ('no alternative certificate subject name', 'certificate has expired', 'self-signed certificate',
                      'self signed certificate', 'certificate subject name', 'unable to verify the first certificate')
INCOMPLETE_CHAIN = 'unable to get local issuer certificate'
# Answers that say nothing about the site from inside Japan: many clinic and hospital sites refuse
# traffic from abroad, rate-limit, or time out for a crawler.
BLOCKED_STATUSES = {0, 403, 405, 429, 500, 502, 503, 504}


def fetch(url, cache, retry=False):
    digest = hashlib.sha1(url.encode()).hexdigest()
    meta_path, body_path = cache / f'{digest}.json', cache / digest
    if meta_path.exists():
        cached = json.loads(meta_path.read_text())
        if not (retry and classify(cached) == 'blocked'):
            return cached
    command = ['curl', '-sS', '-L', '--max-redirs', '6', '-m', '30', '--connect-timeout', '15', '-A', USER_AGENT,
               '--max-filesize', '3000000', '-o', str(body_path), '-w', '%{http_code} %{url_effective}', url]
    proxy = os.environ.get('HTTPS_PROXY')
    if proxy:
        command[1:1] = ['--proxytunnel', '-x', proxy]
    try:
        done = subprocess.run(command, capture_output=True, text=True, timeout=50)
        code, _, final = done.stdout.strip().partition(' ')
        errors = [line for line in done.stderr.splitlines() if line.startswith('curl:')]
        result = {'status': int(code) if code.isdigit() else 0, 'final': final,
                  'exit': done.returncode, 'error': errors[0][:200] if errors else ''}
    except subprocess.TimeoutExpired:
        result = {'status': 0, 'final': '', 'exit': 28, 'error': 'timeout'}
    result['body'] = str(body_path) if body_path.exists() else None
    meta_path.write_text(json.dumps(result))
    return result


def classify(result):
    """ok, incomplete_chain, bad_certificate, not_found, dns, or blocked (cannot tell from here)."""
    status, error = result['status'], result.get('error', '')
    if 200 <= status < 400:
        return 'ok'
    if INCOMPLETE_CHAIN in error:
        return 'incomplete_chain'
    if any(text in error for text in CERTIFICATE_ERRORS):
        return 'bad_certificate'
    if status in (404, 410):
        return 'not_found'
    if result.get('exit') == 6 or 'Could not resolve host' in error:
        return 'dns'
    return 'blocked'


def check_site(url, cache, retry=False):
    """The https answer, and the http answer when https did not work."""
    https = 'https://' + url.split('://', 1)[1]
    first = fetch(https, cache, retry)
    if classify(first) in ('ok', 'incomplete_chain'):
        return first, None
    return first, fetch('http://' + https.split('://', 1)[1], cache, retry)


def page_text(path):
    raw = Path(path).read_bytes()
    head = raw[:4000].decode('ascii', 'ignore').lower()
    declared = re.search(r'charset=["\']?([a-z0-9_-]+)', head)
    for encoding in ([declared.group(1)] if declared else []) + ['utf-8', 'cp932', 'euc-jp']:
        try:
            return raw.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode('utf-8', 'ignore')


def mentions(result, row):
    if not result.get('body'):
        return []
    text = re.sub(r'\s+', '', nfkc(page_text(result['body'])))
    digits = re.sub(r'\D', '', text)
    raw = row['raw']
    found = []
    if any(form in text for form in name_forms(raw.get('医療機関', ''))):
        found.append('name')
    phone = re.sub(r'\D', '', nfkc(raw.get('電話番号', '')))[:11]
    if len(phone) >= 10 and phone in digits:
        found.append('phone')
    return found


def host(url):
    try:
        return (urlparse(url).hostname or '').lower().removeprefix('www.')
    except ValueError:
        return ''


def site_evidence(row, registry_url, cache, retry=False):
    """The https link to store (None: the sheet had none), why, and what the page names.

    - https works: store where it ended, unless it left for another host that names neither the
      clinic nor its phone.
    - The certificate only lacks an intermediate: browsers open it, so store it.
    - https is refused for a reason a browser shows too (wrong name, expired) and http answers, or the
      page is gone (404, no such host): store none.
    - Nothing answers from here (blocked abroad, rate limit, timeout): keep the link only when the
      clinic itself published https, since nobody saw https work for an http link.
    When the sheet's link is not stored, the registry's link is used if it works and names the clinic.
    """
    sheet_url = first_url(row['raw'].get('WEBサイト', ''))
    status, keep = 'none', None
    if sheet_url:
        https, http = check_site(sheet_url, cache, retry)
        kind = classify(https)
        if kind == 'ok':
            named = mentions(https, row)
            if named or host(https['final']) == host(sheet_url):
                return https['final'], 'https_ok', named
            status = 'redirects_elsewhere'
        elif kind == 'incomplete_chain':
            return 'https://' + sheet_url.split('://', 1)[1], 'https_incomplete_chain', []
        elif http is not None and classify(http) == 'ok':
            status = 'http_only'
        elif kind in ('not_found', 'dns') or (http is not None and classify(http) in ('not_found', 'dns')):
            status = 'gone'
        elif kind == 'bad_certificate':
            status = 'bad_certificate'
        else:
            status = 'unverified'
            if sheet_url.lower().startswith('https://'):
                keep = sheet_url
    if registry_url and registry_url != sheet_url and keep is None:
        https, _ = check_site(registry_url, cache, retry)
        named = mentions(https, row) if classify(https) == 'ok' else []
        if named:
            return https['final'], 'from_registry', named
    if keep:
        return keep, 'unverified_https_kept', []
    return ('', status, []) if sheet_url else (None, status, [])


# ---- main

def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--rows', required=True)
    parser.add_argument('--registry', required=True)
    parser.add_argument('--postal', required=True)
    parser.add_argument('--business', required=True)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--skip-websites', action='store_true')
    parser.add_argument('--retry-blocked', action='store_true',
                        help='fetch again, slowly, every cached answer that said nothing (blocked, timeout)')
    args = parser.parse_args()

    document = json.loads(Path(args.rows).read_text(encoding='utf-8'))
    municipalities = Municipalities(MUNICIPALITIES)
    registry = load_registry(args.registry)
    towns, business = load_postal(args.postal, args.business)
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)

    evidence = {}
    sites = {}
    for row in document['rows']:
        prefecture_code = row['sheet'].split('.')[0].zfill(2)
        prefecture_ja = re.sub(r'^\d+\.', '', row['sheet']).strip()
        how, entry = match_registry(row, registry.get(prefecture_code, []), prefecture_ja, municipalities)
        item = {'registry': how, 'postal': check_postal(row, prefecture_ja, towns, business)}
        if entry:
            item['registryId'] = entry['id']
            city = municipalities.city_of_code(entry['code'])
            if city and how.startswith('name_address'):
                item['city'] = canonical(city)
        evidence[f"{row['sheet']}#{row['rowNumber']}"] = item
        sites[f"{row['sheet']}#{row['rowNumber']}"] = (row, first_url(entry['website']) if entry else '')

    if not args.skip_websites:
        def work(key):
            row, registry_url = sites[key]
            return key, site_evidence(row, registry_url, cache, args.retry_blocked)

        with concurrent.futures.ThreadPoolExecutor(max_workers=4 if args.retry_blocked else 24) as pool:
            for done, (key, (url, status, named)) in enumerate(pool.map(work, sites), start=1):
                if url is not None:
                    evidence[key]['website'] = url
                evidence[key]['websiteCheck'] = status
                if named:
                    evidence[key]['websiteMentions'] = named
                if done % 250 == 0:
                    print(f'websites: {done}/{len(sites)}', flush=True)

    Path(args.out).write_text(json.dumps({
        'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sources': {'registry': Path(args.registry).name, 'postal': Path(args.postal).name,
                    'business': Path(args.business).name},
        'rows': evidence
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({
        'rows': len(evidence),
        'registry': Counter(item['registry'] for item in evidence.values()),
        'postal': Counter(item['postal'] for item in evidence.values()),
        'website': Counter(item.get('websiteCheck', 'skipped') for item in evidence.values()),
        'registryCity': sum('city' in item for item in evidence.values())
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()

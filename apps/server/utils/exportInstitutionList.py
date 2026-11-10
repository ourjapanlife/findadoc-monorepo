"""Turn the multilingual institutions workbook into JSON for importInstitutionList.ts (#21).

The workbook is the Ministry of Health list of medical institutions that accept foreign
patients (外国人患者を受け入れる医療機関リスト), one sheet per prefecture, with the fill
colour volunteers used to mark progress:

- green: already in the directory
- red: reviewed and not added
- yellow: reviewed and not decided
- none: not reviewed

Each sheet finds its own header row, because one prefecture has an extra column and another has
no title row. Values are keyed by header text, never by column letter. A repeated
"対応言語/対応可能日時" header is named after the flag column before it.

Only the standard library is used, so there is nothing to install.

Usage: python3 utils/exportInstitutionList.py path/to/list.xlsx path/to/out.json
"""
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships'
}

# Every shade a volunteer used. Each prefecture used one family of the same three meanings.
COLOURS = {
    'FF6AA84F': 'green', 'FFB6D7A8': 'green', 'FF93C47D': 'green',
    'FFFF0000': 'red', 'FFEA9999': 'red', 'FFE06666': 'red',
    'FFFFD966': 'yellow', 'FFFFE599': 'yellow', 'FFFFFF00': 'yellow'
}

NAME_HEADER = '医療機関'
LANGUAGE_DETAIL_HEADER = '対応言語/対応可能日時'
SHEET_NAME = re.compile(r'^\d+\.')


def text_of(node):
    return ''.join(part.text or '' for part in node.iter(f'{{{NS["m"]}}}t'))


def shared_strings(archive):
    if 'xl/sharedStrings.xml' not in archive.namelist():
        return []
    root = ElementTree.fromstring(archive.read('xl/sharedStrings.xml'))
    return [text_of(item) for item in root.findall('m:si', NS)]


def style_colours(archive):
    """Colour family for each cell style index, or 'none'."""
    root = ElementTree.fromstring(archive.read('xl/styles.xml'))
    fills = []
    for fill in root.find('m:fills', NS).findall('m:fill', NS):
        pattern = fill.find('m:patternFill', NS)
        colour = pattern.find('m:fgColor', NS) if pattern is not None else None
        rgb = colour.get('rgb', '').upper() if colour is not None else ''
        solid = pattern is not None and pattern.get('patternType') == 'solid'
        fills.append(COLOURS.get(rgb, 'none') if solid else 'none')
    styles = []
    for xf in root.find('m:cellXfs', NS).findall('m:xf', NS):
        fill_id = int(xf.get('fillId', '0'))
        styles.append(fills[fill_id] if fill_id < len(fills) else 'none')
    return styles


def sheet_paths(archive):
    workbook = ElementTree.fromstring(archive.read('xl/workbook.xml'))
    rels = ElementTree.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    targets = {rel.get('Id'): rel.get('Target') for rel in rels.findall('rel:Relationship', NS)}
    for sheet in workbook.find('m:sheets', NS).findall('m:sheet', NS):
        target = targets[sheet.get(f'{{{NS["r"]}}}id')].lstrip('/')
        yield sheet.get('name'), target if target.startswith('xl/') else f'xl/{target}'


def column_index(reference):
    letters = re.match(r'[A-Z]+', reference).group(0)
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter) - 64
    return index


def cell_value(cell, strings):
    kind = cell.get('t')
    if kind == 'inlineStr':
        node = cell.find('m:is', NS)
        return text_of(node) if node is not None else ''
    value = cell.find('m:v', NS)
    if value is None or value.text is None:
        return ''
    if kind == 's':
        return strings[int(value.text)]
    return value.text


def header_label(raw):
    """'住所\\n(英語)\\n※' is '住所(英語)'. The required mark, the ○ hint, and category notes drop."""
    lines = [line.strip() for line in unicodedata.normalize('NFKC', raw).split('\n')]
    kept = [line for line in lines if line and line != '※' and line != '該当ありに○' and not line.startswith('カテゴリ')]
    return ''.join(kept).replace('※', '').strip()


def read_sheet(archive, path, strings, styles):
    root = ElementTree.fromstring(archive.read(path))
    rows = []
    for row in root.find('m:sheetData', NS).findall('m:row', NS):
        cells = {}
        colours = {}
        for cell in row.findall('m:c', NS):
            index = column_index(cell.get('r'))
            cells[index] = cell_value(cell, strings)
            colours[index] = styles[int(cell.get('s', '0'))]
        rows.append((int(row.get('r')), cells, colours))
    return rows


def headers_for(rows):
    for number, cells, _ in rows[:5]:
        labels = {index: header_label(value) for index, value in cells.items() if value.strip()}
        if NAME_HEADER in labels.values():
            named = {}
            previous = ''
            for index in sorted(labels):
                label = labels[index]
                if label == LANGUAGE_DETAIL_HEADER:
                    label = f'{previous}/{LANGUAGE_DETAIL_HEADER}'
                else:
                    previous = label
                named[index] = label
            return number, named
    raise ValueError('no header row')


def export(xlsx_path):
    with zipfile.ZipFile(xlsx_path) as archive:
        strings = shared_strings(archive)
        styles = style_colours(archive)
        out = []
        for name, path in sheet_paths(archive):
            if not SHEET_NAME.match(name):
                continue
            rows = read_sheet(archive, path, strings, styles)
            header_row, headers = headers_for(rows)
            name_column = next(index for index, label in headers.items() if label == NAME_HEADER)
            for number, cells, colours in rows:
                if number <= header_row or not cells.get(name_column, '').strip():
                    continue
                raw = {label: cells.get(index, '') for index, label in headers.items()}
                out.append({
                    'sheet': name,
                    'rowNumber': number,
                    'colour': colours.get(name_column, 'none'),
                    'raw': raw
                })
        return out


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage: python3 utils/exportInstitutionList.py list.xlsx out.json')
    source = Path(sys.argv[1])
    rows = export(source)
    document = {'sourceFile': source.name, 'rows': rows}
    Path(sys.argv[2]).write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding='utf-8')
    counts = {}
    for row in rows:
        counts[row['colour']] = counts.get(row['colour'], 0) + 1
    print(json.dumps({'rows': len(rows), 'colours': counts}, ensure_ascii=False))


if __name__ == '__main__':
    main()

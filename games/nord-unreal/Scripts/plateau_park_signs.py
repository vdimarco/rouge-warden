"""The city's on-street parking signs, clipped to the district, and what they mean for a parked car.

Source: Ville de Montréal, "Signalisation (stationnement sur rue)" (CC BY 4.0): one row per parking sign with the
pole it hangs on, its code, its text and its arrow. --clip writes Data/Plateau/Inventory/park_signs.json from a
datastore extract (a JSON list of records), keeping the signs that stand now (DESCRIPTION_REP 'Réel').

The parked cars are a still picture of one moment: a Wednesday at 12:30 in late October (MOMENT), close to the
low midday sun the previews use. A sign is read at that moment:
- 'ban': no car may stand there now (no stopping or no parking at all times, a bus zone, a taxi stand, a delivery
  zone in its hours, a reserved space);
- 'allow': the curb takes cars now (permit parking for the residents, street cleaning at another hour, a time
  limit, a ban outside its hours or months).

An arrow gives the side of the pole the rule covers. The city codes it in FLECHE_PAN: 0 none, 2 left, 3 right, 8
both. Left and right are the reader's, facing the sign from the carriageway, so on the right side of a way (OSM
sense) a left arrow points along the way and on its left side against it. The data bears this out: 49 of the 50
arrowed AD-TT signs within 15 m of a junction point toward it. A sign without an arrow covers the curb up to the
next intersection (immigrantquebec.com, "En finir avec le cauchemar des panneaux de signalisation").

Stdlib only and deterministic.
"""
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_lafontaine import BOUNDS, ROOT, inside, xy  # noqa: E402

PARK_SIGNS = ROOT / 'Data/Plateau/Inventory/park_signs.json'
SOURCE = {'dataset': 'Ville de Montréal, Signalisation (stationnement sur rue)',
          'url': 'https://donnees.montreal.ca/dataset/stationnement-sur-rue-signalisation-courant',
          'mirror': 'https://donneesquebec.ca/recherche/dataset/vmtl-stationnement-sur-rue-signalisation-courant',
          'licence': 'CC BY 4.0', 'attribution': 'Source: Ville de Montréal, données ouvertes (CC BY 4.0)'}
POLE_FIELDS = ('POTEAU_ID_POT', 'DESCRIPTION_RTP', 'Latitude', 'Longitude', 'X', 'Y', 'PAS_SUR_RUE')
SIGN_FIELDS = ('PANNEAU_ID_PAN', 'CODE_RPA', 'DESCRIPTION_RPA', 'FLECHE_PAN', 'POSITION_POP', 'DESCRIPTION_CAT')

# The moment the parked cars show: weekday (Monday 0), hour, month.
MOMENT = {'weekday': 2, 'hour': 12.5, 'month': 10}
ARROWS = {'0': 'none', '2': 'left', '3': 'right', '8': 'both'}
DAYS = {'LUN': 0, 'MAR': 1, 'MER': 2, 'JEU': 3, 'VEN': 4, 'SAM': 5, 'DIM': 6}
MONTHS = {'JANV': 1, 'JAN': 1, 'FEV': 2, 'MARS': 3, 'AVRIL': 4, 'AVR': 4, 'MAI': 5, 'JUIN': 6, 'JUIL': 7,
          'AOUT': 8, 'SEPT': 9, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12}
OSM_DAYS = {'Mo': 0, 'Tu': 1, 'We': 2, 'Th': 3, 'Fr': 4, 'Sa': 5, 'Su': 6}
# A ban with one of these exceptions still leaves the residents' cars at the curb.
RESIDENT_EXCEPTIONS = ('EXCEPTE S3R', 'EXCEPTE TITULAIRE', 'EXCEPTE HANDICAPES')
# A ban that only reaches another kind of vehicle.
OTHER_VEHICLES = ('CARAVANE', 'VEHICULE RECREATIF')
HOURS = re.compile(r'(\d{1,2})\s*H?\s*(\d{2})?\s*-\s*(\d{1,2})\s*H\s*(\d{2})?')


def plain(text):
    """Upper case without accents, one space between words."""
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().upper()
    return ' '.join(text.split())


def hour_ranges(text):
    return [(int(a) + int(b or 0) / 60, int(c) + int(d or 0) / 60) for a, b, c, d in HOURS.findall(text)]


DAY_WORDS = dict({k: v for k, v in DAYS.items()}, LUNDI=0, MARDI=1, MERCREDI=2, JEUDI=3, VENDREDI=4, SAMEDI=5,
                 DIMANCHE=6)


def day_set(text):
    """The weekdays a sign names ('LUN A VEN', 'MARDI', 'MAR. VEN.'), or None for every day."""
    words = [w for w in re.split(r'[\s,.]+', text) if w]
    out, k = set(), 0
    while k < len(words):
        day = DAY_WORDS.get(words[k])
        if day is None:
            k += 1
            continue
        if k + 2 < len(words) and words[k + 1] in ('A', 'AU') and words[k + 2] in DAY_WORDS:
            last = DAY_WORDS[words[k + 2]]
            out |= {d % 7 for d in range(day, day + (last - day) % 7 + 1)}
            k += 3
        else:
            out.add(day)
            k += 1
    return out or None


def month_span(text):
    """The months a sign names (inclusive, wrapping over the new year), or None for the whole year."""
    found = [(m.start(), MONTHS[m.group(1)]) for m in re.finditer(r'\b(' + '|'.join(MONTHS) + r')S?\b', text)]
    if len(found) < 2:
        return None
    first, last = found[0][1], found[1][1]
    return {(first - 1 + k) % 12 + 1 for k in range((last - first) % 12 + 1)}


def in_force(text, moment=MOMENT):
    """Whether the time a sign gives covers the moment (no time: always)."""
    days, months, hours = day_set(text), month_span(text), hour_ranges(text)
    if days is not None and moment['weekday'] not in days:
        return False
    if months is not None and moment['month'] not in months:
        return False
    return not hours or any(a <= moment['hour'] < b for a, b in hours)


def regulation(code, text, moment=MOMENT):
    """'ban' or 'allow' for a parked car at the moment."""
    t = plain(text)
    banned = t.startswith('\\') or t.startswith('ARRET INTERDIT')
    if not banned:
        return 'allow'          # P 15 min, P 60 min, P a angle, paid parking: cars stand there
    if any(word in t for word in OTHER_VEHICLES):
        return 'allow'
    if not in_force(t, moment):
        return 'allow'          # street cleaning on another day or hour, a peak-hour ban at midday
    if any(word in t for word in RESIDENT_EXCEPTIONS) and 'DEBARCADERE' not in t:
        return 'allow'
    return 'ban'


def arrow_directions(arrow, side):
    """The directions along the way (+1 along it, -1 against) an arrow covers, for a pole on side +1 (left, OSM
    sense) or -1 (right). None for a sign without an arrow, which covers the curb to the next intersection both
    ways."""
    kind = ARROWS.get(str(arrow), 'none')
    left = -1 if side > 0 else 1
    return {'left': (left,), 'right': (-left,), 'both': (1, -1)}.get(kind)


def condition_active(value, moment=MOMENT):
    """An OSM conditional restriction ('1 @ (Mo-Fr 06:30-09:30)') holds at the moment."""
    match = re.search(r'@\s*\(([^)]*)\)', value or '')
    if not match:
        return True
    rules = match.group(1).split(';')
    for rule in rules:
        days, hours = None, []
        for part in rule.split():
            if re.fullmatch(r'[A-Z][a-z](-[A-Z][a-z])?(,[A-Z][a-z](-[A-Z][a-z])?)*', part):
                days = set()
                for item in part.split(','):
                    a, _, b = item.partition('-')
                    lo, hi = OSM_DAYS[a], OSM_DAYS[b or a]
                    days |= {d % 7 for d in range(lo, lo + (hi - lo) % 7 + 1)}
            for a, b, c, d in re.findall(r'(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})', part):
                hours.append((int(a) + int(b) / 60, int(c) + int(d) / 60))
        if (days is None or moment['weekday'] in days) and (not hours or any(lo <= moment['hour'] < hi for lo, hi in hours)):
            return True
    return False


def clip(extract_path):
    """Write PARK_SIGNS from a datastore extract: the poles inside the district box with the signs that stand now,
    sorted by pole id and by place on the pole."""
    raw = Path(extract_path).read_bytes()
    poles = {}
    for r in json.loads(raw):
        if r.get('DESCRIPTION_REP') != 'Réel':
            continue
        try:
            lat, lon = float(r['Latitude']), float(r['Longitude'])
        except (KeyError, TypeError, ValueError):
            continue
        if not inside((lat, lon)):
            continue
        pole = poles.setdefault(str(r['POTEAU_ID_POT']), dict({k: r.get(k) for k in POLE_FIELDS}, signs=[]))
        pole['signs'].append({k: r.get(k) for k in SIGN_FIELDS})
    records = sorted(poles.values(), key=lambda p: int(p['POTEAU_ID_POT']))
    for p in records:
        p['signs'].sort(key=lambda g: (int(g['POSITION_POP'] or 0), g['CODE_RPA'] or '', int(g['PANNEAU_ID_PAN'] or 0)))
    head = {'source': dict(SOURCE, extract_sha256={Path(extract_path).name: hashlib.sha256(raw).hexdigest()}),
            'box_lat_lon': list(BOUNDS), 'frame': 'WGS84 latitude and longitude (Latitude, Longitude)',
            'moment': MOMENT, 'count': len(records), 'signs': sum(len(p['signs']) for p in records)}
    PARK_SIGNS.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "poles": [\n' + \
        ',\n'.join('  ' + json.dumps(p, ensure_ascii=False, sort_keys=True) for p in records) + '\n ]\n}\n'
    PARK_SIGNS.write_text(text)
    return len(records), head['signs']


def load(path=None):
    """The clipped poles: id, kind (DESCRIPTION_RTP), p (xy, cm), off_street, and signs with code, text, arrow
    ('0', '2', '3' or '8'), place on the pole and the rule at the moment. Empty when the clip is absent."""
    path = Path(path or PARK_SIGNS)
    if not path.is_file():
        return []
    out = []
    for r in json.loads(path.read_text())['poles']:
        signs = [{'code': g['CODE_RPA'] or '', 'text': g['DESCRIPTION_RPA'] or '', 'arrow': str(g['FLECHE_PAN'] or '0'),
                  'position': int(g['POSITION_POP'] or 0),
                  'rule': regulation(g['CODE_RPA'] or '', g['DESCRIPTION_RPA'] or '')} for g in r['signs']]
        out.append({'id': str(r['POTEAU_ID_POT']), 'kind': r.get('DESCRIPTION_RTP') or '',
                    'p': xy(float(r['Latitude']), float(r['Longitude'])), 'off_street': r.get('PAS_SUR_RUE') == '1',
                    'signs': signs})
    return out


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--clip':
        n, signs = clip(sys.argv[2])
        print(f'{PARK_SIGNS.relative_to(ROOT)}: {n} poles carrying {signs} signs')
        sys.exit(0)
    print(__doc__.splitlines()[0])
    print('Usage: python3 Scripts/plateau_park_signs.py --clip extract.json')

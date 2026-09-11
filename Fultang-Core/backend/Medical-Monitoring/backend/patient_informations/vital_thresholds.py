"""Plages de référence pour les constantes vitales (CORR-A2-011)."""
import re

TA_PATTERN = re.compile(r'^(\d{2,3})\s*[/]\s*(\d{2,3})$')

VITAL_RANGES = {
    'temperature': (34.0, 42.0, '°C'),
    'taux_oxygene': (50, 100, '%'),
    'pouls': (30, 220, 'bpm'),
    'poids': (0.5, 300, 'kg'),
    'taille': (30, 250, 'cm'),
    'frequence_respiratoire': (8, 60, '/min'),
    'glycemie': (0.3, 5.0, 'g/L'),
}


def _parse_float(value):
    if value is None or str(value).strip() == '':
        return None
    return float(str(value).replace(',', '.').strip())


def validate_vital_field(name, raw_value):
    """Retourne (ok, message) — ok=False si hors plage."""
    if raw_value is None or str(raw_value).strip() in ('', '0'):
        return True, None
    if name == 'tension_arterielle':
        m = TA_PATTERN.match(str(raw_value).strip())
        if not m:
            return False, 'Format tension attendu : NNN/NNN (ex. 120/80).'
        sys_val, dia_val = int(m.group(1)), int(m.group(2))
        if not (60 <= sys_val <= 250 and (40 <= dia_val <= 150)):
            return False, 'Tension artérielle hors plage réaliste (60–250 / 40–150 mmHg).'
        if sys_val <= dia_val:
            return False, 'La systolique doit être supérieure à la diastolique.'
        return True, None
    if name not in VITAL_RANGES:
        return True, None
    lo, hi, unit = VITAL_RANGES[name]
    try:
        val = _parse_float(raw_value)
    except ValueError:
        return False, f'{name} : valeur numérique attendue.'
    if val is None:
        return True, None
    if not (lo <= val <= hi):
        return False, f'{name} hors plage ({lo}–{hi} {unit}).'
    return True, None


def validate_clinical_data(data):
    """Lève ValueError si une constante est invalide."""
    errors = []
    for field in ('temperature', 'taux_oxygene', 'pouls', 'poids', 'taille', 'tension_arterielle'):
        if field not in data:
            continue
        ok, msg = validate_vital_field(field, data.get(field))
        if not ok:
            errors.append(msg)
    if errors:
        raise ValueError(' ; '.join(errors))

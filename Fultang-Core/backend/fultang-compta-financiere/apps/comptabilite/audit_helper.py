"""Helper audit synchrone depuis les views (complète le consumer Kafka)."""
from __future__ import annotations

ROLE_LABELS = {
    'ComptableFinancier': 'comptable_financier',
    'ComptableMatiere': 'compta_matiere',
    'Admin': 'admin',
    'Directeur': 'directeur',
    'Caissier': 'caissier',
}

EMAIL_ROLE_OVERRIDE = {
    'paul.talla@fultang.local': 'caissier',
    'i.njoya@fultang.local': 'comptable_financier',
    'dg@fultang.local': 'directeur',
}

ROLE_DISPLAY = {
    'caissier': 'Caissier',
    'comptable_financier': 'Comptable financier',
    'compta_matiere': 'Comptable matière',
    'admin': 'Administrateur',
    'directeur': 'Directeur',
}


def get_user_from_request(request):
    """Retourne (utilisateur_id, utilisateur_nom, role_utilisateur)."""
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        uid = getattr(user, 'id', None)
        try:
            uid = int(uid) if uid is not None and str(uid).isdigit() else None
        except (TypeError, ValueError):
            uid = None

        roles = getattr(user, 'roles', []) or []
        primary_role = roles[0] if roles else ''
        email = (getattr(user, 'email', None) or '').lower()

        role_utilisateur = EMAIL_ROLE_OVERRIDE.get(email) or ROLE_LABELS.get(
            primary_role, primary_role.lower() if primary_role else ''
        )

        prenom = getattr(user, 'prenom', '') or ''
        nom = getattr(user, 'nom', '') or ''
        full_name = f'{prenom} {nom}'.strip()
        if full_name:
            utilisateur_nom = full_name
        elif email:
            # Dernier recours lisible : partie locale de l'email
            utilisateur_nom = email.split('@')[0].replace('.', ' ').title()
        elif primary_role:
            utilisateur_nom = ROLE_DISPLAY.get(role_utilisateur, primary_role)
        else:
            utilisateur_nom = getattr(user, 'username', '') or ''

        return uid, utilisateur_nom, role_utilisateur

    return None, '', ''


def get_creator_display_name(request):
    """Nom à stocker sur une écriture (created_by_nom)."""
    _, nom, role = get_user_from_request(request)
    if nom and nom not in ROLE_DISPLAY.values():
        return nom
    if nom:
        return nom
    return ROLE_DISPLAY.get(role, role or 'Système')


def audit_action(request, action, module, description, objet_id=None, objet_reference=None,
                 donnees_avant=None, donnees_apres=None):
    from apps.comptabilite.models import AuditLog

    utilisateur_id, utilisateur_nom, role_utilisateur = get_user_from_request(request)
    ip = request.META.get('REMOTE_ADDR') if request else None
    return AuditLog.log(
        action=action,
        module=module,
        description=description,
        objet_id=objet_id,
        objet_reference=objet_reference,
        utilisateur_id=utilisateur_id,
        utilisateur_nom=utilisateur_nom or None,
        role_utilisateur=role_utilisateur or None,
        donnees_avant=donnees_avant,
        donnees_apres=donnees_apres,
        adresse_ip=ip,
    )

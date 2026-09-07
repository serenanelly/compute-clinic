"""
Seed Fultang — services hospitaliers et personnel (réception → directeur).
Mots de passe :
  - Personnel (défaut système) : Fultang@123
  - admin@fultang.local : adminpass
  - jean.dupont@fultang.local : password123
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_personnel.settings')
django.setup()

from datetime import date
from django.contrib.auth.hashers import make_password
from api.models import (
    Service, Medecin, MedecinGeneraliste, Infirmiere, Receptionniste,
    ComptableFinancier, ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin,
)

PWD_DEFAULT = make_password('Fultang@123')
PWD_ADMIN = make_password('adminpass')
PWD_JEAN = make_password('password123')

SERVICES = [
    ('Chirurgie', 'CHIR-001'),
    ('Radiologie', 'RAD-002'),
    ('Pharmacie', 'PHAR-003'),
    ('Neurologie', 'NEUR-004'),
    ('Laboratoire', 'LAB-005'),
    ('Maternité', 'MAT-006'),
    ('Pédiatrie', 'PED-007'),
    ('Urgences', 'URG-008'),
    ('Consultation générale', 'CONS-009'),
    ('Administration', 'ADM-010'),
]

PERSONNEL = [
  # email, matricule, nom, prenom, role, extra, service_key, password
  ('claire.b@fultang.local', 'REC001', 'Biyogo', 'Claire', 'receptionniste',
   {'langues_parlees': ['FRANCAIS', 'ANGLAIS']}, 'Consultation générale', PWD_DEFAULT),
  ('nelly@recept.com', 'REC002', 'Nkomo', 'Nelly', 'receptionniste',
   {'langues_parlees': ['FRANCAIS']}, 'Urgences', PWD_DEFAULT),
  ('paul.talla@fultang.local', 'CF001', 'Talla', 'Paul', 'comptable_financier',
   {'niveau_accreditation': 'CADRE_COMPTABLE'}, 'Administration', PWD_DEFAULT),
  ('i.njoya@fultang.local', 'CF002', 'Njoya', 'Isabelle', 'comptable_financier',
   {'niveau_accreditation': 'CADRE_COMPTABLE'}, 'Administration', PWD_DEFAULT),
  ('a.matiere@fultang.local', 'CM001', 'Manga', 'Alice', 'comptable_matiere',
   {}, 'Administration', PWD_DEFAULT),
  ('marie.ateba@fultang.local', 'INF001', 'Ateba', 'Marie', 'infirmiere',
   {'grade': 'IDE'}, 'Maternité', PWD_DEFAULT),
  ('luc.kamga@fultang.local', 'LAB001', 'Kamga', 'Luc', 'laborantin',
   {'specialite_labo': 'HEMATOLOGIE'}, 'Laboratoire', PWD_DEFAULT),
  ('sylvie.ekani@fultang.local', 'PHA001', 'Ekani', 'Sylvie', 'pharmacien',
   {'numero_licence': 'PH-CM-2020-4412'}, 'Pharmacie', PWD_DEFAULT),
  ('pharmacien@fultang.local', 'PHA002', 'Dupont', 'Pierre', 'pharmacien',
   {'numero_licence': 'PH-CM-2026-9999'}, 'Pharmacie', PWD_DEFAULT),
  ('jean.dupont@fultang.local', 'MD001', 'Dupont', 'Jean', 'medecin',
   {'specialite': 'Chirurgie cardiaque', 'numero_ordre': 'ORD-54321'}, 'Chirurgie', PWD_JEAN),
  ('alain.kengne@fultang.local', 'MG001', 'Kengne', 'Alain', 'medecin_generaliste',
   {'numero_ordre': 'ORD-88210', 'zone_couverte': 'Yaoundé Centre'}, 'Consultation générale', PWD_DEFAULT),
  ('sophie.mballa@fultang.local', 'MD002', 'Mballa', 'Sophie', 'medecin',
   {'specialite': 'Neurologie', 'numero_ordre': 'ORD-77102'}, 'Neurologie', PWD_DEFAULT),
  ('dg@fultang.local', 'DIR001', 'Fultang', 'Directeur', 'directeur',
   {}, 'Administration', PWD_DEFAULT),
  ('admin@fultang.local', 'ADM001', 'Global', 'Admin', 'admin',
   {}, 'Administration', PWD_ADMIN),
]

COMMON = {
    'date_naissance': date(1985, 6, 15),
    'adresse': 'Polyclinique Fultang, Yaoundé',
    'contact': '+237600000000',
    'date_embauche': date(2020, 1, 1),
}


def get_service_map():
    mapping = {}
    for nom, code in SERVICES:
        svc, _ = Service.objects.get_or_create(
            code_analytique=code,
            defaults={'nom_service': nom},
        )
        if svc.nom_service != nom:
            svc.nom_service = nom
            svc.save(update_fields=['nom_service'])
        mapping[nom] = svc
    return mapping


def upsert_person(model_cls, email, matricule, defaults):
    obj = model_cls.objects.filter(email=email).first()
    if not obj:
        obj = model_cls.objects.filter(matricule=matricule).first()
        
    if obj:
        for k, v in defaults.items():
            setattr(obj, k, v)
        obj.email = email
        obj.matricule = matricule
        obj.save()
        return obj, False
    else:
        clean_defaults = {k: v for k, v in defaults.items() if k not in ('email', 'matricule')}
        obj = model_cls.objects.create(email=email, matricule=matricule, **clean_defaults)
        return obj, True


def ensure_person_role(email, target_model, matricule, defaults):
    """Supprime l'ancien profil multi-table si l'email change de rôle."""
    ROLE_MODELS = (
        ComptableFinancier, ComptableMatiere, Receptionniste, Infirmiere,
        Laborantin, Pharmacien, Medecin, MedecinGeneraliste, Directeur, Admin,
    )
    for model_cls in ROLE_MODELS:
        if model_cls is target_model:
            continue
        try:
            old = model_cls.objects.get(email=email)
            old.delete()
            print(f"  ! migration rôle: {email} → {target_model.__name__}")
        except model_cls.DoesNotExist:
            continue
    return upsert_person(target_model, email, matricule, defaults)


def seed_personnel(services):
    created = 0
    for row in PERSONNEL:
        email, matricule, nom, prenom, role, extra, svc_name, pwd = row
        svc = services.get(svc_name)
        base = {
            **COMMON,
            'nom': nom,
            'prenom': prenom,
            'email': email,
            'matricule': matricule,
            'mot_de_passe': pwd,
            'service': svc,
        }
        if role == 'receptionniste':
            _, is_new = upsert_person(Receptionniste, email, matricule, {**base, **extra})
        elif role == 'comptable_financier':
            _, is_new = ensure_person_role(email, ComptableFinancier, matricule, {**base, **extra})
        elif role == 'comptable_matiere':
            _, is_new = ensure_person_role(email, ComptableMatiere, matricule, {**base, **extra})
        elif role == 'infirmiere':
            _, is_new = upsert_person(Infirmiere, email, matricule, {**base, **extra})
        elif role == 'laborantin':
            _, is_new = upsert_person(Laborantin, email, matricule, {**base, **extra})
        elif role == 'pharmacien':
            _, is_new = upsert_person(Pharmacien, email, matricule, {**base, **extra})
        elif role == 'medecin':
            _, is_new = upsert_person(Medecin, email, matricule, {**base, **extra})
        elif role == 'medecin_generaliste':
            _, is_new = upsert_person(MedecinGeneraliste, email, matricule, {**base, **extra})
        elif role == 'directeur':
            _, is_new = upsert_person(Directeur, email, matricule, base)
        elif role == 'admin':
            _, is_new = upsert_person(Admin, email, matricule, base)
        else:
            continue
        if is_new:
            created += 1
        print(f"  {'+' if is_new else '~'} {role}: {email}")

    print(f"\nPersonnel : {created} créé(s), {len(PERSONNEL)} profils au total.")


if __name__ == '__main__':
    # Phase 6 (Dynamic Database Routing) : ce script tourne au démarrage du
    # conteneur, hors de tout cycle de requête HTTP — aucun mécanisme
    # d'authentification n'établit donc de Tenant Context automatiquement.
    # Les comptes de démonstration seedés ici appartiennent délibérément au
    # pool non assigné (tenant_id=None, voir Phase 3) : c'est exactement ce
    # contexte qu'on établit explicitement, pour que le Database Router les
    # route vers 'default' plutôt que de refuser faute de contexte.
    from api.tenant_routing.context import set_tenant_context
    set_tenant_context(None)

    print('=== Seed personnel Fultang ===\n')
    svc_map = get_service_map()
    print(f"Services : {len(svc_map)}")
    seed_personnel(svc_map)
    print('\nIdentifiants : Fultang@123 (sauf adminpass / password123 pour Jean Dupont)')

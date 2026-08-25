import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_personnel.settings')
django.setup()

from datetime import date
from django.contrib.auth.hashers import make_password
from api.models import Admin

PWD_ADMIN = make_password('FultangAdmin2026!')

COMMON = {
    'date_naissance': date(1990, 1, 1),
    'adresse': 'Polyclinique Fultang, Yaoundé',
    'contact': '+237600000000',
    'date_embauche': date(2026, 1, 1),
}

def seed_admin():
    # Create or update Admin without a service
    email = 'superadmin@fultang.local'
    matricule = 'ADM001'
    
    defaults = {
        **COMMON,
        'nom': 'Admin',
        'prenom': 'Super',
        'email': email,
        'matricule': matricule,
        'mot_de_passe': PWD_ADMIN,
        'service': None,
    }
    
    obj, created = Admin.objects.get_or_create(
        email=email,
        defaults=defaults
    )
    if not created:
        for k, v in defaults.items():
            setattr(obj, k, v)
        obj.save()
    
    print(f"{'+' if created else '~'} Admin: {email}")

if __name__ == '__main__':
    print('=== Seeding Admin only (No Services) ===')
    seed_admin()
    print('Done!')

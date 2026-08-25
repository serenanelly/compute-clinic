import os
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

from patient.models.emergency import LienParente

liens = LienParente.objects.filter(relation='AUTRE')
print(f"Liens avec relation AUTRE: {liens.count()}")
for l in liens:
    print(f"  Patient: {l.patient} | PAP: {l.personne_a_prevenir}")

import os
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

from patient.models.emergency import LienParente
from patient.models import Patient

# Trouver le patient ATANGA
try:
    patient = Patient.objects.get(nom="ATANGA")
    liens = LienParente.objects.filter(patient=patient)
    print(f"Patient: {patient}")
    for l in liens:
        print(f"  PAP: {l.personne_a_prevenir} | relation actuelle: {l.relation}")
        l.relation = "PERE"  # "PARENT" n'existe pas → PERE est le choix le plus proche
        l.save()
        print(f"  → Relation mise à jour: {l.relation}")
except Patient.DoesNotExist:
    print("Patient ATANGA non trouvé")

# Vérification finale
print("\nTous les liens AUTRE restants:")
for l in LienParente.objects.filter(relation='AUTRE'):
    print(f"  {l.patient} | {l.personne_a_prevenir}")

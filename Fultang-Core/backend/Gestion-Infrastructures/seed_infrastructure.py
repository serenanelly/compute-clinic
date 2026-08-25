import django
import os
import sys

# Ajouter le dossier actuel au path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from infrastructures.models import TypeBatiment, TypeSalle, Batiment, Etage, Salle

def seed():
    print("Seeding infrastructure database...")
    # 1. TypeBatiment
    tb_medical, _ = TypeBatiment.objects.get_or_create(nom="HOPITAL_PRINCIPAL", description="Bâtiment principal médical")
    
    # 2. TypeSalle
    ts_hosp, _ = TypeSalle.objects.get_or_create(nom="Chambre d'hospitalisation", description="Chambre pour séjour hospitalier")
    ts_consult, _ = TypeSalle.objects.get_or_create(nom="Salle de consultation", description="Salle pour consultations médicales")
    
    # 3. Batiment
    bat, _ = Batiment.objects.get_or_create(
        nom='Hôpital Central',
        defaults={
            'type': tb_medical,
            'nb_etages': 5,
            'date_construction': '2020-01-01',
            'responsable_id': 1
        }
    )
    
    # 4. Etages
    etage1, _ = Etage.objects.get_or_create(numero=1, batiment=bat)
    etage2, _ = Etage.objects.get_or_create(numero=2, batiment=bat)
    etage3, _ = Etage.objects.get_or_create(numero=3, batiment=bat)

    # 5. Salles (Chambres)
    # 1: "Médecine Générale", 2: "Pédiatrie", 3: "Gynécologie-Obstétrique", 4: "Cardiologie", 5: "Urgences", 6: "Chirurgie"
    salles_data = [
        {"nom": "Chambre 101", "type": ts_hosp, "capacite": 2, "numero": "101", "statut": "DISPONIBLE", "etage": etage1, "service_id": 6, "tarif_journalier": 150.0, "nb_places_disponibles": 2},
        {"nom": "Chambre 102", "type": ts_hosp, "capacite": 2, "numero": "102", "statut": "DISPONIBLE", "etage": etage1, "service_id": 6, "tarif_journalier": 150.0, "nb_places_disponibles": 2},
        {"nom": "Chambre 201", "type": ts_hosp, "capacite": 2, "numero": "201", "statut": "DISPONIBLE", "etage": etage2, "service_id": 2, "tarif_journalier": 100.0, "nb_places_disponibles": 2},
        {"nom": "Chambre 202", "type": ts_hosp, "capacite": 2, "numero": "202", "statut": "DISPONIBLE", "etage": etage2, "service_id": 1, "tarif_journalier": 120.0, "nb_places_disponibles": 2},
        {"nom": "Chambre 301", "type": ts_hosp, "capacite": 4, "numero": "301", "statut": "DISPONIBLE", "etage": etage3, "service_id": 6, "tarif_journalier": 80.0, "nb_places_disponibles": 4},
    ]
    
    for s_data in salles_data:
        Salle.objects.get_or_create(
            numero=s_data["numero"],
            defaults=s_data
        )
    print("Infrastructures database seeded successfully!")

if __name__ == '__main__':
    seed()

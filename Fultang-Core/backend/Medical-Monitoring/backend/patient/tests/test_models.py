import uuid
from django.test import TestCase
from patient.models import Patient, Adresse, Nationalite, Contact, PersonneAPrevenir, LienParenteType

class PatientExpandedModelTest(TestCase):
    """Tests des nouveaux modèles satellites de l'application Patient."""

    def setUp(self):
        # Création d'une base commune
        self.adresse = Adresse.objects.create(
            ville="Douala", quartier="Akwa", pays="Cameroun"
        )
        self.patient = Patient.objects.create(
            matricule="P_EXP",
            nom="Expanded",
            sexe="F",
            date_naissance="1995-01-01",
            lieu_naissance="Yaoundé",
            profession="Comptable",
            statut_matrimonial="CELIBATAIRE",
            numero_securite_sociale="EXP-001",
            adresse=self.adresse
        )

    def test_patient_address_link(self):
        """Vérification : Le patient est correctement lié à son adresse."""
        self.assertEqual(self.patient.adresse.ville, "Douala")
        self.assertEqual(self.adresse.resident_patient, self.patient)

    def test_nationalites_multiple(self):
        """Vérification : Un patient peut posséder plusieurs nationalités."""
        nat1 = Nationalite.objects.create(libelle="Camerounaise")
        nat2 = Nationalite.objects.create(libelle="Française")
        self.patient.nationalites.add(nat1, nat2)
        self.assertEqual(self.patient.nationalites.count(), 2)

    def test_contact_relationship(self):
        """Vérification : On peut ajouter des contacts à un patient."""
        Contact.objects.create(
            patient=self.patient, 
            type="TELEPHONE", 
            numero="+237600000000"
        )
        self.assertEqual(self.patient.contacts.count(), 1)

    def test_emergency_contact_and_kinship(self):
        """Vérification : Le lien de parenté avec une personne à prévenir est fonctionnel."""
        urgence = PersonneAPrevenir.objects.create(nom="Mère de Test")
        lien = PersonneAPrevenir.objects.create(nom="Père de Test")
        
        # Création du lien via le modèle through
        PersonneAPrevenir.objects.create(nom="Frère de Test") # Non lié
        
        self.patient.personnes_a_prevenir.add(
            urgence, 
            through_defaults={'relation': 'MERE'}
        )
        
        self.assertEqual(self.patient.personnes_a_prevenir.count(), 1)
        self.assertEqual(
            self.patient.personnes_a_prevenir.first().nom, 
            "Mère de Test"
        )

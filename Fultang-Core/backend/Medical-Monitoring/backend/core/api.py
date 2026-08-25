from django.urls import path, include
from rest_framework.routers import DefaultRouter

# App: Patient (Civilité)
from patient.views import (
    PatientViewSet, AdresseViewSet, ContactViewSet, 
    NationaliteViewSet, PersonneAPrevenirViewSet,
    LienParenteViewSet
)

# App: Medical Workflow (Opérationnel)
from medical_workflow.views import (
    VisiteViewSet, ConsultationViewSet, 
    ExamenViewSet,
    HospitalisationViewSet,
    MedicamentPrescritViewSet,
    AnomaliePrescriptionViewSet, DelivranceMedicamentViewSet,
    ConciliationMedicamenteuseViewSet, PrelevementViewSet, ValeurCritiqueViewSet
)

# App: Patient Informations (Santé & Vie)
from patient_informations.views import (
    DonneesCliniquesViewSet, AntecedentViewSet, AllergieViewSet,
    MaladieViewSet, TraitementViewSet, ModeDeVieViewSet,
    VoyageViewSet, ActivitePhysiqueViewSet, AddictionViewSet,
    RendezVousViewSet
)

router = DefaultRouter()

# Patient (Identity)
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'adresses', AdresseViewSet, basename='adresse')
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'nationalites', NationaliteViewSet, basename='nationalite')
router.register(r'personnes-a-prevenir', PersonneAPrevenirViewSet, basename='personne-a-prevenir')
router.register(r'liens-parente', LienParenteViewSet, basename='lien-parente')

# Consultations & Workflow
router.register(r'visites', VisiteViewSet, basename='visite')
router.register(r'consultations', ConsultationViewSet, basename='consultation')
router.register(r'examens', ExamenViewSet, basename='examen')
router.register(r'hospitalisations', HospitalisationViewSet, basename='hospitalisation')
router.register(r'prescriptions', MedicamentPrescritViewSet, basename='prescription')

# Pharmacy
router.register(r'pharmacie/anomalies', AnomaliePrescriptionViewSet, basename='pharmacie-anomalie')
router.register(r'pharmacie/delivrances', DelivranceMedicamentViewSet, basename='pharmacie-delivrance')
router.register(r'pharmacie/conciliations', ConciliationMedicamenteuseViewSet, basename='pharmacie-conciliation')

# Laboratory
router.register(r'laboratoire/prelevements', PrelevementViewSet, basename='laboratoire-prelevement')
router.register(r'laboratoire/valeurs-critiques', ValeurCritiqueViewSet, basename='laboratoire-valeur-critique')

# Patient Health Folder (Dossier Médical)
router.register(r'patient/clinique', DonneesCliniquesViewSet, basename='donnees-cliniques')
router.register(r'patient/antecedents', AntecedentViewSet, basename='antecedent')
router.register(r'patient/allergies', AllergieViewSet, basename='allergie')
router.register(r'patient/maladies', MaladieViewSet, basename='maladie')
router.register(r'patient/traitements', TraitementViewSet, basename='traitement')
router.register(r'patient/mode-de-vie', ModeDeVieViewSet, basename='mode-de-vie')
router.register(r'patient/voyages', VoyageViewSet, basename='voyages')
router.register(r'patient/activites', ActivitePhysiqueViewSet, basename='activites-physiques')
router.register(r'patient/addictions', AddictionViewSet, basename='addictions')
router.register(r'patient/rendez-vous', RendezVousViewSet, basename='rendez-vous')

urlpatterns = [
    path('', include(router.urls)),
]

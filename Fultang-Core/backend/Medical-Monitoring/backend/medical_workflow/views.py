from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import HasFunctionalServiceEnabled
from .models import (
    Consultation, Symptome, Diagnostic, MedicamentPrescrit,
    Examen, ResultatExamen,
    Hospitalisation, SoinAdministre, Visite,
    AnomaliePrescription, DelivranceMedicament, ConciliationMedicamenteuse,
    Prelevement, ValeurCritique
)
from .serializers import (
    ConsultationSerializer, SymptomeSerializer, DiagnosticSerializer, 
    MedicamentPrescritSerializer, ExamenSerializer, ResultatExamenSerializer,
    HospitalisationSerializer, SoinAdministreSerializer, VisiteSerializer,
    AnomaliePrescriptionSerializer, DelivranceMedicamentSerializer,
    ConciliationMedicamenteuseSerializer, PrelevementSerializer, ValeurCritiqueSerializer
)

# --- ViewSets pour les Visites et Consultations ---

class VisiteViewSet(viewsets.ModelViewSet):
    """
    Dossier de visite regroupant toutes les prestations.
    Permet d'ouvrir une consultation liée via /visites/{id}/consultations/

    `ouvrir_consultation` crée directement un `Consultation` (le même
    modèle que `ConsultationViewSet.create`, déjà gaté pour
    MEDECINE_GENERALE) — sans le contrôle équivalent, cette action
    contournait entièrement la désactivation de ce service. Seule cette
    action précise est gatée (via `get_permissions`) : le reste de ce
    ViewSet (liste/détail des visites) est partagé par plusieurs rôles
    (médecin ET infirmier, entre autres) et doit rester accessible
    indépendamment de MEDECINE_GENERALE.
    """
    queryset = Visite.objects.all()
    serializer_class = VisiteSerializer

    def get_permissions(self):
        permissions = super().get_permissions()
        if self.action == 'ouvrir_consultation':
            permissions = list(permissions) + [HasFunctionalServiceEnabled.for_service('MEDECINE_GENERALE')()]
        return permissions

    @action(detail=True, methods=['post'], url_path='consultations')
    def ouvrir_consultation(self, request, pk=None):
        """Ouvre une consultation liée à cette visite."""
        visite = self.get_object()
        data = request.data.copy()
        data['visite'] = visite.id
        data['patient'] = visite.patient.id
        
        user_id = request.META.get('HTTP_X_USER_ID') or request.headers.get('X-User-Id')
        if user_id:
            data['medecin_charge'] = user_id
        
        serializer = ConsultationSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='hospitalisations')
    def hospitaliser(self, request, pk=None):
        """Lance une hospitalisation liée à cette visite."""
        visite = self.get_object()
        data = request.data.copy()
        data['visite'] = visite.id
        data['patient'] = visite.patient.id
        
        user_id = request.META.get('HTTP_X_USER_ID')
        if user_id:
            data['doctor_id'] = user_id
        
        serializer = HospitalisationSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ConsultationViewSet(viewsets.ModelViewSet):
    """
    Accès aux consultations (inclut les symptômes/diagnostics en lecture).

    Activation/désactivation de service réellement effective (MEDECINE_GENERALE)
    — même mécanisme générique que Pharmacie/Laboratoire, appliqué ici à
    titre d'exemple supplémentaire (architecture générique, voir
    core/permissions.py::HasFunctionalServiceEnabled) : cette phase ne
    requiert pas un test approfondi de ce service en particulier.
    """
    queryset = Consultation.objects.all()
    serializer_class = ConsultationSerializer
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('MEDECINE_GENERALE')]

    def perform_create(self, serializer):
        user_id = self.request.META.get('HTTP_X_USER_ID') or self.request.headers.get('X-User-Id')
        if user_id:
            serializer.save(medecin_charge=user_id)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], url_path='symptomes')
    def enregistrer_symptome(self, request, pk=None):
        """Enregistre un symptôme pour cette consultation."""
        consultation = self.get_object()
        data = request.data.copy()
        data['consultation'] = consultation.id
        
        serializer = SymptomeSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='diagnostics')
    def enregistrer_diagnostic(self, request, pk=None):
        """Enregistre un diagnostic pour cette consultation."""
        consultation = self.get_object()
        data = request.data.copy()
        data['consultation'] = consultation.id
        
        serializer = DiagnosticSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='examens')
    def prescrire_examen(self, request, pk=None):
        """Prescrit un examen pour cette consultation."""
        consultation = self.get_object()
        data = request.data.copy()
        data['consultation'] = consultation.id
        
        serializer = ExamenSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='prescriptions')
    def ajouter_prescription(self, request, pk=None):
        """Ajoute une prescription de médicament pour cette consultation."""
        consultation = self.get_object()
        data = request.data.copy()
        data['consultation'] = consultation.id
        
        serializer = MedicamentPrescritSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- ViewSets pour les Examens ---

from .models import Examen
from .models.choices import StatutExamen

class ExamenViewSet(viewsets.ModelViewSet):
    """
    Gestion des examens et de leurs résultats.

    `resultat`, `prelevement`, `valider` et `signaler_critique` créent ou
    modifient directement les mêmes modèles que `PrelevementViewSet`/
    `ValeurCritiqueViewSet` (déjà gatés pour LABORATOIRE) — sans le
    contrôle équivalent ici, ces actions contournaient entièrement la
    désactivation de ce service. Seules ces actions sont gatées (via
    `get_permissions`) : le CRUD de base d'`Examen` (list/create/detail)
    reste accessible — utilisé par `ConsultationViewSet.prescrire_examen`
    (déjà gaté pour MEDECINE_GENERALE) côté médecin, une préoccupation
    distincte de LABORATOIRE.
    """
    queryset = Examen.objects.all()
    serializer_class = ExamenSerializer

    _LABORATOIRE_ACTIONS = {'resultat', 'prelevement', 'valider', 'signaler_critique'}

    def get_permissions(self):
        permissions = super().get_permissions()
        if self.action in self._LABORATOIRE_ACTIONS:
            permissions = list(permissions) + [HasFunctionalServiceEnabled.for_service('LABORATOIRE')()]
        return permissions

    @action(detail=True, methods=['get', 'post'], url_path='resultat')
    def resultat(self, request, pk=None):
        """
        GET: Retourne le résultat technique de l'examen s'il existe.
        POST: Enregistre le résultat technique d'un examen et met à jour son statut.
        """
        from .serializers import ResultatExamenSerializer
        examen = self.get_object()
        
        if request.method == 'GET':
            try:
                resultat = examen.resultat
                serializer = ResultatExamenSerializer(resultat)
                return Response(serializer.data)
            except ResultatExamen.DoesNotExist:
                return Response(
                    {"detail": "Aucun résultat enregistré pour cet examen."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Logique POST
        data = request.data.copy()
        data['examen'] = examen.id
        
        serializer = ResultatExamenSerializer(data=data)
        if serializer.is_valid():
            # 1. Enregistrement du résultat
            serializer.save()
            
            # 2. Mise à jour du statut de l'examen
            examen.statut = StatutExamen.REALISE
            examen.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='prelevement')
    def prelevement(self, request, pk=None):
        from .serializers import PrelevementSerializer
        examen = self.get_object()
        data = request.data.copy()
        data['examen'] = examen.id
        serializer = PrelevementSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            examen.statut = StatutExamen.PRELEVE
            examen.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='valider')
    def valider(self, request, pk=None):
        examen = self.get_object()
        examen.statut = StatutExamen.VALIDE
        examen.save()
        return Response({"status": "Examen validé avec succès"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='signaler-critique')
    def signaler_critique(self, request, pk=None):
        from .serializers import ValeurCritiqueSerializer
        examen = self.get_object()
        if not hasattr(examen, 'resultat'):
            return Response({"detail": "Pas de résultat pour cet examen"}, status=status.HTTP_400_BAD_REQUEST)
        data = request.data.copy()
        data['resultat'] = examen.resultat.id
        data['laborantin_id'] = data.get('laborantin_id', '00000000-0000-0000-0000-000000000000') # fallback
        serializer = ValeurCritiqueSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




# --- ViewSets pour les Examens ---



# --- ViewSets pour les Hospitalisations et Soins ---

class HospitalisationViewSet(viewsets.ModelViewSet):
    """Suivi complet des hospitalisations et des chambres."""
    queryset = Hospitalisation.objects.all()
    serializer_class = HospitalisationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['patient__nom', 'patient__prenom', 'patient__matricule']

    def get_queryset(self):
        """Permet de filtrer globalement par statut (ex: EN_COURS)."""
        queryset = super().get_queryset()
        statut = self.request.query_params.get('statut')
        if statut:
            queryset = queryset.filter(statut=statut)
        return queryset


class MedicamentPrescritViewSet(viewsets.ModelViewSet):
    """
    Accès aux médicaments prescrits lors des consultations.

    `signaler_anomalie` et `delivrer` créent directement les mêmes
    modèles que `AnomaliePrescriptionViewSet`/`DelivranceMedicamentViewSet`
    (déjà gatés pour PHARMACIE) — sans le contrôle équivalent ici, ces
    actions contournaient entièrement la désactivation de ce service.
    Seules ces deux actions (réellement pharmacien) sont gatées (via
    `get_permissions`) : le CRUD de base (list/detail/statut) reste
    accessible — prescrit par le médecin (`ConsultationViewSet.prescrire_
    prescription`, déjà gaté MEDECINE_GENERALE) et consulté par plusieurs
    rôles.
    """
    queryset = MedicamentPrescrit.objects.all()
    serializer_class = MedicamentPrescritSerializer

    _PHARMACIE_ACTIONS = {'signaler_anomalie', 'delivrer'}

    def get_permissions(self):
        permissions = super().get_permissions()
        if self.action in self._PHARMACIE_ACTIONS:
            permissions = list(permissions) + [HasFunctionalServiceEnabled.for_service('PHARMACIE')()]
        return permissions

    def get_queryset(self):
        """Permet de filtrer par patient ou par statut."""
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get('patient')
        statut = self.request.query_params.get('statut')
        if patient_id:
            queryset = queryset.filter(consultation__patient_id=patient_id)
        if statut:
            queryset = queryset.filter(statut=statut)
        return queryset

    @action(detail=True, methods=['post'], url_path='anomalie')
    def signaler_anomalie(self, request, pk=None):
        from .serializers import AnomaliePrescriptionSerializer
        med = self.get_object()
        data = request.data.copy()
        data['medicament'] = med.id
        data['pharmacien_id'] = data.get('pharmacien_id', '00000000-0000-0000-0000-000000000000') # fallback
        serializer = AnomaliePrescriptionSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            med.statut = 'ANOMALIE'
            med.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='delivrer')
    def delivrer(self, request, pk=None):
        from .serializers import DelivranceMedicamentSerializer
        med = self.get_object()
        data = request.data.copy()
        data['medicament'] = med.id
        data['pharmacien_id'] = data.get('pharmacien_id', '00000000-0000-0000-0000-000000000000') # fallback
        serializer = DelivranceMedicamentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            med.statut = 'DELIVREE'
            med.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- ViewSets pour la Pharmacie ---

class AnomaliePrescriptionViewSet(viewsets.ModelViewSet):
    """
    Activation/désactivation de service réellement effective (cycle de vie
    du tenant, Phase 2, §12-15) : bloqué si PHARMACIE est désactivé pour
    le tenant courant — jamais un simple masquage frontend.
    """
    queryset = AnomaliePrescription.objects.all()
    serializer_class = AnomaliePrescriptionSerializer
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('PHARMACIE')]

    def perform_create(self, serializer):
        # Mettre à jour le statut du médicament
        anomalie = serializer.save()
        med = anomalie.medicament
        med.statut = 'ANOMALIE'
        med.save()

class DelivranceMedicamentViewSet(viewsets.ModelViewSet):
    """Même contrôle que AnomaliePrescriptionViewSet (voir sa docstring)."""
    queryset = DelivranceMedicament.objects.all()
    serializer_class = DelivranceMedicamentSerializer
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('PHARMACIE')]

    def perform_create(self, serializer):
        # Mettre à jour le statut du médicament
        delivrance = serializer.save()
        med = delivrance.medicament
        med.statut = 'DELIVREE'
        med.save()

class ConciliationMedicamenteuseViewSet(viewsets.ModelViewSet):
    """Même contrôle que AnomaliePrescriptionViewSet (PHARMACIE) — n'avait aucun contrôle jusqu'ici."""
    queryset = ConciliationMedicamenteuse.objects.all()
    serializer_class = ConciliationMedicamenteuseSerializer
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('PHARMACIE')]

# --- ViewSets pour le Laboratoire ---

class PrelevementViewSet(viewsets.ModelViewSet):
    """Activation/désactivation de service réellement effective (LABORATOIRE) — voir AnomaliePrescriptionViewSet."""
    queryset = Prelevement.objects.all()
    serializer_class = PrelevementSerializer
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('LABORATOIRE')]

    def perform_create(self, serializer):
        prelevement = serializer.save()
        examen = prelevement.examen
        examen.statut = 'PRELEVE'
        examen.save()

class ValeurCritiqueViewSet(viewsets.ModelViewSet):
    """Même contrôle que PrelevementViewSet (LABORATOIRE)."""
    queryset = ValeurCritique.objects.all()
    serializer_class = ValeurCritiqueSerializer
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('LABORATOIRE')]




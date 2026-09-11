from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Consultation, Symptome, Diagnostic, MedicamentPrescrit,
    Examen, ResultatExamen,
    Hospitalisation, SoinAdministre, Visite,
    AnomaliePrescription, DelivranceMedicament, ConciliationMedicamenteuse,
    Prelevement, ValeurCritique,
    InterventionChirurgicale, MembreEquipeOperatoire,
)
from .serializers import (
    ConsultationSerializer, SymptomeSerializer, DiagnosticSerializer, 
    MedicamentPrescritSerializer, ExamenSerializer, ResultatExamenSerializer,
    HospitalisationSerializer, SoinAdministreSerializer, VisiteSerializer,
    AnomaliePrescriptionSerializer, DelivranceMedicamentSerializer,
    ConciliationMedicamenteuseSerializer, PrelevementSerializer, ValeurCritiqueSerializer,
    InterventionChirurgicaleSerializer, MembreEquipeOperatoireSerializer,
)

# --- ViewSets pour les Visites et Consultations ---

class VisiteViewSet(viewsets.ModelViewSet):
    """
    Dossier de visite regroupant toutes les prestations.
    Permet d'ouvrir une consultation liée via /visites/{id}/consultations/
    """
    queryset = Visite.objects.all()
    serializer_class = VisiteSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['patient', 'statut', 'paiement_valide', 'medecin_oriente_id']
    ordering = ['-date_heure']

    def _exiger_paiement(self, visite):
        if visite.mode_urgence:
            return None
        if not visite.paiement_est_actif():
            code = 'PAIEMENT_EXPIRE' if visite.paiement_valide else 'PAIEMENT_REQUIS'
            detail = (
                'Le délai de validité du paiement est expiré — le patient doit repasser à la caisse.'
                if visite.paiement_valide else
                'Le paiement de la consultation doit être enregistré à la caisse avant cette action.'
            )
            return Response(
                {
                    'error': detail,
                    'code': code,
                    'visite_id': str(visite.id),
                    'paiement_expire_le': (
                        visite.paiement_expire_le.isoformat()
                        if visite.paiement_expire_le else None
                    ),
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        return None

    def partial_update(self, request, *args, **kwargs):
        visite = self.get_object()
        new_statut = request.data.get('statut')
        if new_statut == 'TERMINE':
            blocked = self._exiger_paiement(visite)
            if blocked:
                return blocked
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='confirmer-paiement')
    def confirmer_paiement(self, request, pk=None):
        """Marque la visite comme payée (appelé par la caisse après validation quittance)."""
        visite = self.get_object()
        visite.paiement_valide = True
        visite.date_paiement = timezone.now()
        visite.save(update_fields=['paiement_valide', 'date_paiement'])
        return Response(VisiteSerializer(visite).data)

    @action(detail=True, methods=['post'], url_path='prendre-en-charge')
    def prendre_en_charge(self, request, pk=None):
        """Verrouillage infirmier — CORR-A3-007."""
        import uuid as uuid_lib
        visite = self.get_object()
        user_id = request.META.get('HTTP_X_USER_ID') or request.headers.get('X-User-Id')
        if not user_id:
            return Response({'error': 'Identifiant infirmier requis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            nurse_uuid = uuid_lib.UUID(str(user_id))
        except ValueError:
            nurse_uuid = uuid_lib.uuid5(uuid_lib.NAMESPACE_DNS, str(user_id))
        if visite.infirmier_en_charge_id and visite.infirmier_en_charge_id != nurse_uuid:
            return Response(
                {
                    'error': 'Ce patient est déjà pris en charge par un autre infirmier.',
                    'code': 'VISITE_VERROUILLEE',
                },
                status=status.HTTP_409_CONFLICT,
            )
        visite.infirmier_en_charge_id = nurse_uuid
        visite.save(update_fields=['infirmier_en_charge_id'])
        return Response(VisiteSerializer(visite).data)

    @action(detail=True, methods=['post'], url_path='confirmer-parametres')
    def confirmer_parametres(self, request, pk=None):
        """Marque le triage infirmier terminé — sync salle d'attente médecin (CORR-A3-004)."""
        visite = self.get_object()
        visite.parametres_complets = True
        visite.save(update_fields=['parametres_complets'])
        return Response(VisiteSerializer(visite).data)

    @action(detail=True, methods=['post'], url_path='consultations')
    def ouvrir_consultation(self, request, pk=None):
        """Ouvre une consultation liée à cette visite."""
        visite = self.get_object()
        blocked = self._exiger_paiement(visite)
        if blocked:
            return blocked
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
        data.pop('room_id', None)

        user_id = request.META.get('HTTP_X_USER_ID')
        if user_id:
            data['doctor_id'] = user_id
        
        serializer = HospitalisationSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ConsultationViewSet(viewsets.ModelViewSet):
    """Accès aux consultations (inclut les symptômes/diagnostics en lecture)."""
    queryset = Consultation.objects.all()
    serializer_class = ConsultationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['visite', 'patient', 'medecin_charge']
    ordering = ['-date_heure']
    ordering_fields = ['date_heure']

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

    @action(detail=True, methods=['post'], url_path='orientations')
    def orienter_specialiste(self, request, pk=None):
        """Prescription d'orientation vers un spécialiste (CORR-A2-016)."""
        from .serializers import OrientationSpecialisteSerializer
        consultation = self.get_object()
        data = request.data.copy()
        data['consultation'] = consultation.id
        serializer = OrientationSpecialisteSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- ViewSets pour les Examens ---

from .models import Examen
from .models.choices import StatutExamen

class ExamenViewSet(viewsets.ModelViewSet):
    """Gestion des examens et de leurs résultats."""
    queryset = Examen.objects.all()
    serializer_class = ExamenSerializer

    def get_queryset(self):
        queryset = super().get_queryset().select_related('consultation')
        statut = self.request.query_params.get('statut')
        medecin = self.request.query_params.get('medecin')
        if statut:
            queryset = queryset.filter(statut=statut)
        if medecin:
            queryset = queryset.filter(consultation__medecin_charge=str(medecin))
        return queryset

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

    def partial_update(self, request, *args, **kwargs):
        if 'room_id' in request.data:
            return Response(
                {
                    'error': 'Utilisez l\'action assigner-chambre pour attribuer un lit.',
                    'code': 'ASSIGNATION_CHAMBRE_DEDIEE',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='assigner-chambre')
    def assigner_chambre(self, request, pk=None):
        """Attribution salle + lit par l'infirmier(ère) (CORR-A2-009)."""
        from .models.choices import StatutHospitalisation
        hosp = self.get_object()
        room_id = request.data.get('room_id')
        numero_lit = (request.data.get('numero_lit') or '').strip()
        if not room_id:
            return Response({'error': 'room_id requis.'}, status=status.HTTP_400_BAD_REQUEST)
        if hosp.statut not in (StatutHospitalisation.EN_ATTENTE_LIT, StatutHospitalisation.EN_COURS):
            return Response(
                {'error': 'Cette hospitalisation ne peut plus recevoir de chambre.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hosp.room_id = room_id
        hosp.numero_lit = numero_lit
        hosp.statut = StatutHospitalisation.EN_COURS
        hosp.save(update_fields=['room_id', 'numero_lit', 'statut'])
        return Response(HospitalisationSerializer(hosp, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='demander-sortie')
    def demander_sortie(self, request, pk=None):
        from .models.choices import StatutHospitalisation
        hosp = self.get_object()
        if hosp.statut != StatutHospitalisation.EN_COURS:
            return Response({'error': 'Seul un séjour en cours peut entrer en sortie.'}, status=400)
        hosp.statut = StatutHospitalisation.EN_SORTIE
        hosp.save(update_fields=['statut'])
        return Response(HospitalisationSerializer(hosp, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='valider-sortie-medicale')
    def valider_sortie_medicale(self, request, pk=None):
        """Validation médicale de sortie — CORR-A2-003 / A2-004."""
        from .models.choices import StatutHospitalisation, TypeSortie
        hosp = self.get_object()
        if hosp.statut != StatutHospitalisation.EN_SORTIE:
            return Response({'error': 'Demandez d\'abord la sortie du patient.'}, status=400)
        type_sortie = request.data.get('type_sortie', TypeSortie.AUTORISEE)
        notes = request.data.get('notes_sortie', '')
        if type_sortie in (TypeSortie.CONTRE_AVIS, TypeSortie.EVASION) and not str(notes).strip():
            return Response(
                {'error': 'Notes obligatoires pour une sortie contre avis ou une évasion.'},
                status=400,
            )
        hosp.validation_medicale = True
        hosp.date_validation_medicale = timezone.now()
        hosp.type_sortie = type_sortie
        hosp.notes_sortie = notes
        hosp.save(update_fields=[
            'validation_medicale', 'date_validation_medicale', 'type_sortie', 'notes_sortie',
        ])
        if hosp.validation_financiere:
            hosp.statut = StatutHospitalisation.TERMINE
            hosp.save(update_fields=['statut'])
        return Response(HospitalisationSerializer(hosp, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='valider-sortie-financiere')
    def valider_sortie_financiere(self, request, pk=None):
        """Validation financière de sortie — CORR-A2-003."""
        from .models.choices import StatutHospitalisation
        hosp = self.get_object()
        if hosp.statut != StatutHospitalisation.EN_SORTIE:
            return Response({'error': 'Le patient doit être en cours de sortie.'}, status=400)
        if not hosp.validation_medicale:
            return Response(
                {'error': 'La validation médicale de sortie est requise avant le règlement.'},
                status=400,
            )
        hosp.validation_financiere = True
        hosp.date_validation_financiere = timezone.now()
        hosp.statut = StatutHospitalisation.TERMINE
        hosp.save(update_fields=[
            'validation_financiere', 'date_validation_financiere', 'statut',
        ])
        return Response(HospitalisationSerializer(hosp, context={'request': request}).data)


class MedicamentPrescritViewSet(viewsets.ModelViewSet):
    """Accès aux médicaments prescrits lors des consultations."""
    queryset = MedicamentPrescrit.objects.all()
    serializer_class = MedicamentPrescritSerializer

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
            delivrance = serializer.save()
            med.statut = 'DELIVREE'
            med.save()
            patient_id = None
            try:
                patient_id = str(med.consultation.patient_id)
            except Exception:
                pass
            return Response({
                **DelivranceMedicamentSerializer(delivrance).data,
                'circuit_financier': {
                    'action': 'CREER_QUITTANCE_CAISSE',
                    'patient_id': patient_id,
                    'medicament': med.nom,
                    'montant_fcfa': data.get('montant_fcfa'),
                    'message': (
                        'CORR-A3-008 : orientez le patient vers la caisse pour règlement pharmacie.'
                    ),
                },
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class InterventionChirurgicaleViewSet(viewsets.ModelViewSet):
    """Interventions chirurgicales — CORR-A3-013/014/015."""
    queryset = InterventionChirurgicale.objects.all().prefetch_related('equipe')
    serializer_class = InterventionChirurgicaleSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['patient', 'statut', 'urgence']
    ordering = ['-date_creation']

    @action(detail=True, methods=['post'], url_path='enregistrer-acompte')
    def enregistrer_acompte(self, request, pk=None):
        """Enregistre l'acompte et calcule la dette restante (CORR-A3-014)."""
        intervention = self.get_object()
        montant_total = request.data.get('montant_total')
        acompte = request.data.get('acompte_montant')
        if montant_total is None or acompte is None:
            return Response(
                {'error': 'montant_total et acompte_montant requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            total = float(montant_total)
            verse = float(acompte)
        except (TypeError, ValueError):
            return Response({'error': 'Montants invalides.'}, status=status.HTTP_400_BAD_REQUEST)
        intervention.acompte_montant = verse
        intervention.dette_restante = max(total - verse, 0)
        if intervention.urgence and intervention.dette_restante > 0:
            intervention.notes = (intervention.notes or '') + '\n[URGENCE] Dette autorisée en attente de règlement.'
        intervention.save(update_fields=['acompte_montant', 'dette_restante', 'notes'])
        return Response(InterventionChirurgicaleSerializer(intervention).data)

    @action(detail=True, methods=['post'], url_path='equipe')
    def ajouter_equipe(self, request, pk=None):
        """Ajoute un membre à l'équipe opératoire (CORR-A3-015)."""
        intervention = self.get_object()
        data = request.data.copy()
        data['intervention'] = intervention.id
        serializer = MembreEquipeOperatoireSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- ViewSets pour la Pharmacie ---

class AnomaliePrescriptionViewSet(viewsets.ModelViewSet):
    queryset = AnomaliePrescription.objects.all()
    serializer_class = AnomaliePrescriptionSerializer

    def perform_create(self, serializer):
        # Mettre à jour le statut du médicament
        anomalie = serializer.save()
        med = anomalie.medicament
        med.statut = 'ANOMALIE'
        med.save()

class DelivranceMedicamentViewSet(viewsets.ModelViewSet):
    queryset = DelivranceMedicament.objects.all()
    serializer_class = DelivranceMedicamentSerializer

    def perform_create(self, serializer):
        # Mettre à jour le statut du médicament
        delivrance = serializer.save()
        med = delivrance.medicament
        med.statut = 'DELIVREE'
        med.save()

class ConciliationMedicamenteuseViewSet(viewsets.ModelViewSet):
    queryset = ConciliationMedicamenteuse.objects.all()
    serializer_class = ConciliationMedicamenteuseSerializer

# --- ViewSets pour le Laboratoire ---

class PrelevementViewSet(viewsets.ModelViewSet):
    queryset = Prelevement.objects.all()
    serializer_class = PrelevementSerializer

    def perform_create(self, serializer):
        prelevement = serializer.save()
        examen = prelevement.examen
        examen.statut = 'PRELEVE'
        examen.save()

class ValeurCritiqueViewSet(viewsets.ModelViewSet):
    queryset = ValeurCritique.objects.all()
    serializer_class = ValeurCritiqueSerializer




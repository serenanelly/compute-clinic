from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import HasFunctionalServiceEnabled
from .pagination import PatientPagePagination
from .models import (
    Patient, Adresse, Contact, Nationalite, 
    PersonneAPrevenir, LienParente
)
from .serializers import (
    PatientSerializer, PatientListSerializer, AdresseSerializer, 
    ContactSerializer, NationaliteSerializer, PersonneAPrevenirSerializer,
    LienParenteSerializer
)

class PatientViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer le CRUD complet des Patients."""
    queryset = Patient.objects.select_related('adresse').prefetch_related('contacts')
    serializer_class = PatientSerializer
    pagination_class = PatientPagePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom', 'prenom', 'matricule', 'code_identifiant']
    ordering_fields = ['nom', 'prenom', 'date_naissance', 'created_at']
    ordering = ['nom', 'prenom']

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        birth_year = params.get('birth_year')
        birth_month = params.get('birth_month')
        birth_day = params.get('birth_day')
        if birth_year:
            qs = qs.filter(date_naissance__year=birth_year)
        if birth_month:
            qs = qs.filter(date_naissance__month=birth_month)
        if birth_day:
            qs = qs.filter(date_naissance__day=birth_day)

        created_year = params.get('created_year')
        created_month = params.get('created_month')
        created_day = params.get('created_day')
        if created_year:
            qs = qs.filter(created_at__year=created_year)
        if created_month:
            qs = qs.filter(created_at__month=created_month)
        if created_day:
            qs = qs.filter(created_at__day=created_day)

        return qs

    def get_serializer_class(self):
        """Utilise un serializer allégé pour la liste complète."""
        if self.action == 'list':
            return PatientListSerializer
        return super().get_serializer_class()

    def get_permissions(self):
        """
        Cycle de vie du tenant, Phase 3 (§12-15, cas "Infirmerie") : ce
        ViewSet est partagé par plusieurs rôles (médecins, infirmiers...)
        pour des opérations générales (lecture/écriture d'un Patient) —
        le gater dans son ensemble avec SOINS_INFIRMIERS bloquerait aussi
        les médecins, ce qui serait une erreur. Seule l'action
        `enregistrer_soin` (POST .../soins/) est un geste métier
        RÉELLEMENT propre au rôle infirmier (elle crée un
        `SoinAdministre`) — c'est la seule à porter ce contrôle
        supplémentaire, via l'architecture générique déjà en place
        (`HasFunctionalServiceEnabled.for_service`), jamais une règle
        codée en dur spécifique à ce ViewSet.

        Limite documentée honnêtement : les endpoints généraux partagés
        de ce ViewSet (liste/lecture d'un patient, dossier, examens...)
        restent accessibles même si SOINS_INFIRMIERS est désactivé pour
        le tenant, faute d'un moyen propre de distinguer "un infirmier
        les utilise" de "un médecin les utilise" au niveau actuel du
        modèle de données.
        """
        permissions = super().get_permissions()
        if self.action == 'enregistrer_soin':
            permissions = list(permissions) + [HasFunctionalServiceEnabled.for_service('SOINS_INFIRMIERS')()]
        return permissions

    @action(detail=False, methods=['get'], url_path='prochain-matricule')
    def prochain_matricule(self, request):
        """Retourne le prochain matricule disponible pour un nouveau patient."""
        next_matricule = Patient.generate_next_matricule()
        return Response({"prochain_matricule": next_matricule})

    @action(detail=True, methods=['get'])
    def dossier(self, request, pk=None):
        """Retourne une vue agrégée du dossier médical complet."""
        from patient_informations.serializers import PatientDossierSerializer
        patient = self.get_object()
        serializer = PatientDossierSerializer(patient)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='soins')
    def enregistrer_soin(self, request, pk=None):
        """Enregistre un soin administré à ce patient."""
        from medical_workflow.serializers import SoinAdministreSerializer
        patient = self.get_object()
        data = request.data.copy()
        data['patient'] = patient.id
        
        serializer = SoinAdministreSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='examens')
    def obtenir_examens(self, request, pk=None):
        """Retourne la liste des examens prescrits à ce patient."""
        from medical_workflow.models import Examen
        from medical_workflow.serializers import ExamenSerializer

        patient = self.get_object()
        statut = request.query_params.get('statut')
        examens = Examen.objects.filter(consultation__patient=patient).select_related(
            'consultation'
        ).prefetch_related('prelevements', 'resultat')

        if statut:
            examens = examens.filter(statut=statut)

        serializer = ExamenSerializer(
            examens,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='exporter-medical')
    def exporter_donnees_medicales(self, request):
        """
        Exporte les cas cliniques anonymisés depuis la BD tampon (via le Clinical Agent).
        Cette approche isole le système central des requêtes d'export massif :
        les données sont lues depuis la BD tampon sans impacter la BD principale.

        Paramètres de filtre supportés (transmis à l'agent) :
          ?skip=0&limit=100&sexe=M&groupe_sanguin=A&age_min=18&age_max=65
        """
        import os
        import urllib.request
        import urllib.parse
        import urllib.error
        import json

        agent_url = os.getenv("CLINICAL_AGENT_URL", "http://fultang-clinical-agent:9000")
        params = request.query_params.dict()
        query_string = urllib.parse.urlencode(params) if params else ""
        target = f"{agent_url}/export"
        if query_string:
            target = f"{target}?{query_string}"

        try:
            req = urllib.request.Request(target, method="GET")
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            response = Response(data)
            response["Content-Disposition"] = 'attachment; filename="export_medical_tampon.json"'
            return response

        except urllib.error.URLError as e:
            return Response(
                {
                    "error": "Clinical Agent indisponible. Veuillez réessayer dans quelques instants.",
                    "detail": str(e),
                    "hint": "Vérifiez que le service fultang-clinical-agent est démarré.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


    @action(detail=True, methods=['post'], url_path='rendez-vous')
    def fixer_rendez_vous(self, request, pk=None):
        """Fixe un rendez-vous pour ce patient."""
        from patient_informations.serializers import RendezVousSerializer
        patient = self.get_object()
        data = request.data.copy()
        data['patient'] = patient.id
        
        serializer = RendezVousSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdresseViewSet(viewsets.ModelViewSet):
    """Gestion des adresses physiques."""
    queryset = Adresse.objects.all()
    serializer_class = AdresseSerializer

class ContactViewSet(viewsets.ModelViewSet):
    """Gestion des moyens de contact (WhatsApp/Téléphone)."""
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

class NationaliteViewSet(viewsets.ModelViewSet):
    """Gestion des nationalités."""
    queryset = Nationalite.objects.all()
    serializer_class = NationaliteSerializer

class PersonneAPrevenirViewSet(viewsets.ModelViewSet):
    """Gestion des contacts d'urgence."""
    queryset = PersonneAPrevenir.objects.all()
    serializer_class = PersonneAPrevenirSerializer

class LienParenteViewSet(viewsets.ModelViewSet):
    """Gestion des liens de parenté entre Patients et Personnes à Prévenir."""
    queryset = LienParente.objects.all()
    serializer_class = LienParenteSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'personne_a_prevenir']

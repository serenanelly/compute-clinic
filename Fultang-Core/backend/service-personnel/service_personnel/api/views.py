from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import (
    Service, Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, 
    ComptableFinancier, ComptableMatiere, Laborantin, 
    Pharmacien, Directeur, Admin, Prime
)
from .serializers import (
    ServiceSerializer, MedecinSerializer, MedecinGeneralisteSerializer, InfirmiereSerializer, ReceptionnisteSerializer, 
    ComptableFinancierSerializer, ComptableMatiereSerializer, LaborantinSerializer, 
    PharmacienSerializer, DirecteurSerializer, AdminSerializer, PrimeSerializer
)
from rest_framework.views import APIView
from rest_framework import status
from django.contrib.auth.hashers import check_password

from .permissions import IsInternalService
from .tenant_routing.context import set_tenant_context
from .tenant_routing.pool_registry import DatabaseProvisioningError, provision_database

@extend_schema_view(
    list=extend_schema(summary="Lister tous les services", description="Récupère la liste de tous les services médicaux et administratifs de l'hôpital."),
    retrieve=extend_schema(summary="Récupérer un service", description="Récupère les détails d'un service spécifique de l'hôpital."),
    create=extend_schema(summary="Créer un service", description="Ajoute un nouveau service à l'hôpital Fultang."),
    update=extend_schema(summary="Modifier un service", description="Met à jour l'intégralité des informations d'un service existant."),
    partial_update=extend_schema(summary="Modifier partiellement un service", description="Met à jour certains champs d'un service existant."),
    destroy=extend_schema(summary="Supprimer un service", description="Supprime un service de la base de données de l l'hôpital.")
)
@extend_schema(tags=['Départements'])
class ServiceViewSet(viewsets.ModelViewSet):
    """
    CRUD complet pour les services hospitaliers.
    """
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    pagination_class = None

    @extend_schema(
        summary="Récupérer les médecins d'un service",
        description="Renvoie la liste de tous les médecins affectés à ce service spécifique.",
        responses={200: MedecinSerializer(many=True)}
    )
    @action(detail=True, methods=['get'])
    def medecins(self, request, pk=None):
        service = self.get_object()
        medecins = Medecin.objects.filter(service=service)
        serializer = MedecinSerializer(medecins, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Récupérer les infirmières d'un service",
        description="Renvoie la liste de toutes les infirmières affectées à ce service spécifique.",
        responses={200: InfirmiereSerializer(many=True)}
    )
    @action(detail=True, methods=['get'])
    def infirmieres(self, request, pk=None):
        service = self.get_object()
        infirmieres = Infirmiere.objects.filter(service=service)
        serializer = InfirmiereSerializer(infirmieres, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Récupérer tout le personnel d'un service",
        description="Liste polymorphe de tous les membres affectés à ce service.",
    )
    @action(detail=True, methods=['get'])
    def personnel(self, request, pk=None):
        service = self.get_object()
        personnel_models = [
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste,
            ComptableFinancier, ComptableMatiere, Laborantin,
            Pharmacien, Directeur, Admin,
        ]
        results = []
        for model in personnel_models:
            for instance in model.objects.filter(service=service):
                results.append(serialize_personnel(instance, model))
        return Response(results)

@extend_schema_view(
    list=extend_schema(summary="Lister tous les médecins", description="Récupère la liste complète des médecins de l'hôpital Fultang."),
    retrieve=extend_schema(summary="Récupérer un médecin", description="Obtenir les informations détaillées d'un médecin spécifique (spécialité, n° d'ordre, infos personnelles)."),
    create=extend_schema(summary="Ajouter un médecin", description="Créer un profil pour un nouveau médecin. La spécialité et le numéro d'ordre sont requis."),
    update=extend_schema(summary="Mettre à jour un médecin", description="Met à jour la totalité des données du profil d'un médecin de l'hôpital."),
    partial_update=extend_schema(summary="Patch d'un profil médecin", description="Appliquer une mise à jour partielle (ex: changer d'adresse ou de grade) pour un profil médecin."),
    destroy=extend_schema(summary="Renvoi/Suppression médecin", description="Supprime les données et l'accès d'un médecin du système.")
)
@extend_schema(tags=['Corps Médical - Médecins'])
class MedecinViewSet(viewsets.ModelViewSet):
    """
    CRUD complet pour le corps médical : les Médecins.
    """
    queryset = Medecin.objects.all()
    serializer_class = MedecinSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister tous les médecins généralistes", description="Récupère la liste complète des médecins généralistes de l'hôpital Fultang."),
    retrieve=extend_schema(summary="Récupérer un médecin généraliste", description="Obtenir les informations détaillées d'un généraliste (zone couverte, n° d'ordre, infos personnelles)."),
    create=extend_schema(summary="Ajouter un médecin généraliste", description="Créer un profil pour un nouveau médecin généraliste. Le numéro d'ordre et la zone couverte sont requis/recommandés."),
    update=extend_schema(summary="Mettre à jour un médecin généraliste", description="Met à jour la totalité des données du profil d'un généraliste."),
    partial_update=extend_schema(summary="Patch d'un profil généraliste", description="Appliquer une mise à jour partielle pour un profil médecin généraliste."),
    destroy=extend_schema(summary="Renvoi/Suppression généraliste", description="Supprime les données et l'accès d'un généraliste du système.")
)
@extend_schema(tags=['Corps Médical - Médecins Généralistes'])
class MedecinGeneralisteViewSet(viewsets.ModelViewSet):
    """
    CRUD complet pour les Médecins Généralistes.
    """
    queryset = MedecinGeneraliste.objects.all()
    serializer_class = MedecinGeneralisteSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister les infirmières", description="Consulter le registre du personnel infirmier (dont IDE, ASP, anesthésistes)."),
    retrieve=extend_schema(summary="Inspecter une infirmière", description="Récupérer un dossier spécifique au personnel infirmier (grade, adresse interne, contact)."),
    create=extend_schema(summary="Enregistrer une infirmière", description="Nouvelle affectation d'une infirmière (requiert la sélection d'un grade d'accréditation)."),
    update=extend_schema(summary="Renouveler infos infirmière", description="Enregistrer une mise à jour complète du profil de l'infirmière."),
    partial_update=extend_schema(summary="Axe d'une infirmière", description="Mise à jour minime et unitaire pour l'infirmière (ex: statut de congé ou numéro d'appel)."),
    destroy=extend_schema(summary="Licenciement infirmière", description="Radier le profil médical de la base.")
)
@extend_schema(tags=['Corps Médical - Infirmières'])
class InfirmiereViewSet(viewsets.ModelViewSet):
    """
    Gestion complète pour les infirmières avec grade (Enum).
    """
    queryset = Infirmiere.objects.all()
    serializer_class = InfirmiereSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister réceptionnistes", description="Toutes les personnes assignées aux tâches de réception."),
    retrieve=extend_schema(summary="Détail réceptionniste", description="Informations sur la réceptionniste."),
    create=extend_schema(summary="Embaucher réceptionniste", description="Créer un profil de réceptionniste en précisant les langues maitrisées."),
    update=extend_schema(summary="Modifier réceptionniste", description="Mise à jour complète."),
    partial_update=extend_schema(summary="Mise à jour partielle réceptionniste", description="Modification partielle des coordonnées ou des compétences linguistiques."),
    destroy=extend_schema(summary="Retirer réceptionniste", description="Dissoudre la présence métier de cette personne dans la base de réception.")
)
@extend_schema(tags=['Administration - Réception'])
class ReceptionnisteViewSet(viewsets.ModelViewSet):
    """
    Gestion des accueils et de la réception.
    """
    queryset = Receptionniste.objects.all()
    serializer_class = ReceptionnisteSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister les comptables financiers", description="Consultation de la masse comptable financière de l'hôpital."),
    retrieve=extend_schema(summary="Vue comptable financier", description="Ressources détaillées."),
    create=extend_schema(summary="Nouveau comptable financier", description="Inscription (niveau accréditation comptable requis)."),
    update=extend_schema(summary="Mettre à jour financier", description="Re-saisie complète des informations."),
    partial_update=extend_schema(summary="Éditer financier", description="Mise à jour ciblée."),
    destroy=extend_schema(summary="Supprimer comptable fm", description="Éviction du poste.")
)
@extend_schema(tags=['Administration - Comptabilité'])
class ComptableFinancierViewSet(viewsets.ModelViewSet):
    """
    Responsabilités budgétaires majeures (cadres).
    """
    queryset = ComptableFinancier.objects.all()
    serializer_class = ComptableFinancierSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister comptables matière", description="Logs des responsables matériel hospitalier."),
    retrieve=extend_schema(summary="Détail comptable matière", description="Accès détaillé."),
    create=extend_schema(summary="Créer comptable matière", description="Nouveau profil gestion inventaire."),
    update=extend_schema(summary="Changer comptable matière", description="Remplacement des informations RH complet."),
    partial_update=extend_schema(summary="Axe comptable matière", description="Patch partiel."),
    destroy=extend_schema(summary="Supprimer comptable matière", description="Supression du service de l l'utilisateur.")
)
@extend_schema(tags=['Administration - Comptabilité'])
class ComptableMatiereViewSet(viewsets.ModelViewSet):
    """
    Logistique et stocks hospitaliers.
    """
    queryset = ComptableMatiere.objects.all()
    serializer_class = ComptableMatiereSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister laborantins", description="Profils travaillant aux biologies et virologies cliniques."),
    retrieve=extend_schema(summary="Détail profil laborantin", description="Spécialités labo (hématologie, etc)."),
    create=extend_schema(summary="Nouveau laborantin", description="Ajout dans la spécialité indiquée."),
    update=extend_schema(summary="Modifier laborantin", description="Changements généraux complets."),
    partial_update=extend_schema(summary="Axe laborantin", description="Modifications d'attributs de l l'employé (statut)."),
    destroy=extend_schema(summary="Supprimer profil laborantin", description="Retrait de service de labo.")
)
@extend_schema(tags=['Technique - Laboratoire'])
class LaborantinViewSet(viewsets.ModelViewSet):
    """
    Spécialités de type Enum en base (Virologie, hématologie).
    """
    queryset = Laborantin.objects.all()
    serializer_class = LaborantinSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister pharmaciens", description="Inventaire des employés pharmaciens en vigueur."),
    retrieve=extend_schema(summary="Pharmacien profil complet", description="Licences des pharmaciens listées individuellement."),
    create=extend_schema(summary="Ajouter un pharmacien", description="Profil et numéro de licence obligatoire."),
    update=extend_schema(summary="Modifier profil pharmacien", description="Mise à jour base de données complète pour ce praticien."),
    partial_update=extend_schema(summary="Patch pharmacien", description="Changement rapide."),
    destroy=extend_schema(summary="Supprimer le pharmacien", description="Le pharmacien quitte Fultang.")
)
@extend_schema(tags=['Technique - Pharmacie'])
class PharmacienViewSet(viewsets.ModelViewSet):
    """
    Le personnel qui gère la pharmacie avec leur licence.
    """
    queryset = Pharmacien.objects.all()
    serializer_class = PharmacienSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister directions", description="Tout le bureau directorial Fultang."),
    retrieve=extend_schema(summary="Détails directeurs", description="Aperçu."),
    create=extend_schema(summary="Nommer directeur", description="Prise en charge d'un nouveau directeur."),
    update=extend_schema(summary="Mise à jour direction", description="Toutes données."),
    partial_update=extend_schema(summary="Mettre à jour direction partiel", description="Détails à vérifier/éditer."),
    destroy=extend_schema(summary="Révoquer direction", description="Changement au conseil d'établissement.")
)
@extend_schema(tags=['Direction - Exécutif'])
class DirecteurViewSet(viewsets.ModelViewSet):
    """
    La direction de l'hôpital.
    """
    queryset = Directeur.objects.all()
    serializer_class = DirecteurSerializer

@extend_schema_view(
    list=extend_schema(summary="Lister sys-admins", description="Les administrateurs des systèmes backend hospitaliers."),
    retrieve=extend_schema(summary="Détails de l'Admin", description="Infos compte."),
    create=extend_schema(summary="Créer Admin système", description="Nouveau DSI."),
    update=extend_schema(summary="Mettre à jour l l'Admin", description="Changement informations complet."),
    partial_update=extend_schema(summary="Patch d'Admin", description="Nouveau password ou statut."),
    destroy=extend_schema(summary="Retirer accès d'Admin", description="Désactivation compte superutilisateur backend.")
)
@extend_schema(tags=['Système - Administration'])
class AdminViewSet(viewsets.ModelViewSet):
    """
    Les administrateurs en charge d'ajouter, éditer les profils globaux de l l'hôpital.
    """
    queryset = Admin.objects.all()
    serializer_class = AdminSerializer

class AuthVerifyView(APIView):
    """
    Vérifie des identifiants dans le contexte d'un tenant (Phase Tenant-Aware
    Authentication).

    `tenant_id` est fourni par la Gateway, qui l'a elle-même obtenu via la
    Tenant Resolution (hostname → Tenant Registry) — jamais du client
    directement. `tenant_id` absent/null = pool non assigné (comptes créés
    avant l'introduction du multitenant, ou environnement de développement
    local sans sous-domaine de tenant) : ce service ne fait ici que
    respecter le tenant_id qu'on lui donne, il ne le devine jamais.

    Le même email peut désormais exister dans deux tenants différents : ce
    sont deux comptes distincts, la recherche est donc systématiquement
    scopée par (email, tenant_id).

    Phase 6 (Dynamic Database Routing) : ce endpoint précède toute
    authentification DRF (authentication_classes = []), donc
    GatewayHeaderAuthentication ne s'exécute jamais ici — c'est pourquoi
    le Tenant Context est établi EXPLICITEMENT ci-dessous, à partir du
    même `tenant_id` que la Gateway a résolu par Tenant Resolution
    (jamais un paramètre libre : c'est la même valeur de confiance que
    reçoit AuthVerifyView depuis toujours, voir Phase 3).
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        tenant_id = request.data.get('tenant_id')  # None = pool non assigné

        if not email or not password:
            return Response({"detail": "Email et mot de passe requis"}, status=status.HTTP_400_BAD_REQUEST)

        # Doit être fait AVANT tout accès ORM ci-dessous (y compris les
        # logs de debug qui suivent) — voir tenant_routing/router.py.
        # Les exceptions de routage (base indisponible/non provisionnée,
        # Registry injoignable) ne sont PAS interceptées ici : le
        # gestionnaire d'exceptions global (api.exceptions, EXCEPTION_HANDLER)
        # les traduit uniformément en 503, pour cette vue comme pour
        # toutes les autres — jamais de repli vers une autre base.
        set_tenant_context(tenant_id)

        # DEBUG LOGS
        print(f"Tentative de connexion pour: {email} (tenant_id={tenant_id})")
        from .models import Admin, Directeur
        print(f"Nombre d'Admins en base: {Admin.objects.count()}")
        print(f"Nombre de Directeurs en base: {Directeur.objects.count()}")

        # Liste des modèles de personnel à vérifier
        personnel_models = [
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, ComptableFinancier,
            ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin
        ]

        user = None
        user_role = None

        for model in personnel_models:
            try:
                user = model.objects.get(email=email, tenant_id=tenant_id)
                user_role = model.__name__
                break
            except model.DoesNotExist:
                continue
            except model.MultipleObjectsReturned:
                # Ne devrait pas arriver grâce à UniqueConstraint(tenant_id, email) —
                # sauf pour tenant_id=NULL, où Postgres n'impose pas l'unicité entre
                # plusieurs NULL. On refuse plutôt que de choisir arbitrairement.
                continue

        if user is not None and check_password(password, user.mot_de_passe):
            # Rôles canoniques pour les comptes de démo (évite les doublons multi-tables)
            CANONICAL_ROLES = {
                'i.njoya@fultang.local': 'ComptableFinancier',
                'paul.talla@fultang.local': 'ComptableFinancier',
                'a.matiere@fultang.local': 'ComptableMatiere',
            }
            canonical = CANONICAL_ROLES.get((email or '').lower())
            if canonical:
                user_role = canonical

            return Response({
                "id": user.id_personnel,
                "email": user.email,
                "roles": [user_role],
                "nom": user.nom,
                "prenom": user.prenom
            })
        
        return Response({"detail": "Identifiants invalides"}, status=status.HTTP_401_UNAUTHORIZED)

import random
from django.utils import timezone
from django.contrib.auth.hashers import make_password

POSTE_MODEL_MAP = {
    'medecin': Medecin,
    'infirmier': Infirmiere,
    'receptioniste': Receptionniste,
    'caissier': ComptableFinancier,
    'comptable': ComptableMatiere,
    'laborantin': Laborantin,
    'pharmacien': Pharmacien,
    'directeur': Directeur,
    'admin': Admin,
}

CATEGORIE_POSTES = {
    'medical': {'medecin', 'infirmier', 'laborantin', 'pharmacien'},
    'admin': {'receptioniste', 'caissier', 'comptable', 'directeur', 'admin'},
}


def resolve_service(service_id):
    """Retourne le Service ou lève ValueError si l'ID est invalide (CORR-A5-003)."""
    if service_id in (None, '', 0, '0'):
        return None
    try:
        return Service.objects.get(id_service=int(service_id))
    except (Service.DoesNotExist, ValueError, TypeError) as exc:
        raise ValueError(f"Service introuvable (id={service_id}).") from exc

def generate_matricule(poste):
    prefix = "FULT-" + (poste[:3].upper() if poste else "PER")
    random_num = random.randint(1000, 9999)
    return f"{prefix}-{random_num}"

def serialize_personnel(instance, model_class):
    poste = 'autre'
    for k, v in POSTE_MODEL_MAP.items():
        if v == model_class:
            poste = k
            break
    if model_class == MedecinGeneraliste:
        poste = 'medecin'

    data = {
        'id': str(instance.id_personnel),
        'nom': instance.nom,
        'prenom': instance.prenom,
        'date_naissance': str(instance.date_naissance) if instance.date_naissance else None,
        'adresse': instance.adresse,
        'email': instance.email,
        'contact': instance.contact,
        'matricule': instance.matricule,
        'date_embauche': str(instance.date_embauche) if instance.date_embauche else None,
        'date_joined': str(instance.date_embauche) if instance.date_embauche else None,
        'statut': instance.statut,
        'service': instance.service.id_service if instance.service else None,
        'service_nom': instance.service.nom_service if instance.service and hasattr(instance.service, 'nom_service') else None,
        'poste': poste,
    }

    if model_class == Medecin:
        data['specialite'] = instance.specialite
        data['numero_ordre'] = instance.numero_ordre
    elif model_class == MedecinGeneraliste:
        data['numero_ordre'] = instance.numero_ordre
        data['zone_couverte'] = instance.zone_couverte
    elif model_class == Infirmiere:
        data['grade'] = instance.grade
    elif model_class == Receptionniste:
        data['langues_parlees'] = instance.langues_parlees
    elif model_class == ComptableFinancier:
        data['niveau_accreditation'] = instance.niveau_accreditation
    elif model_class == Laborantin:
        data['specialite_labo'] = instance.specialite_labo
    elif model_class == Pharmacien:
        data['numero_licence'] = instance.numero_licence

    return data

@extend_schema(exclude=True)
class PersonnelViewSet(viewsets.ViewSet):
    """
    ViewSet polymorphe pour gerer tout le personnel hospitalier.
    """
    def get_user_and_model(self, pk):
        personnel_models = [
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, ComptableFinancier, 
            ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin
        ]
        for model in personnel_models:
            try:
                user = model.objects.get(id_personnel=pk)
                return user, model
            except (model.DoesNotExist, ValueError):
                continue
        return None, None

    def list(self, request):
        personnel_models = [
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, ComptableFinancier, 
            ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin
        ]
        results = []
        service_id = request.query_params.get('service')
        poste_filter = request.query_params.get('poste')
        statut_filter = request.query_params.get('statut')
        categorie_filter = request.query_params.get('categorie')
        allowed_postes = CATEGORIE_POSTES.get(categorie_filter) if categorie_filter else None
        
        for model in personnel_models:
            queryset = model.objects.all()
            if service_id:
                queryset = queryset.filter(service_id=service_id)
            if statut_filter:
                queryset = queryset.filter(statut=statut_filter)
            for instance in queryset:
                serialized = serialize_personnel(instance, model)
                if poste_filter and serialized.get('poste') != poste_filter:
                    continue
                if allowed_postes and serialized.get('poste') not in allowed_postes:
                    continue
                results.append(serialized)
        return Response(results)

    def retrieve(self, request, pk=None):
        user, model = self.get_user_and_model(pk)
        if not user:
            return Response({"detail": "Personnel introuvable"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serialize_personnel(user, model))

    def create(self, request):
        data = request.data
        poste = (data.get('poste') or '').strip().lower()
        if not poste:
            return Response(
                {"poste": ["Ce champ est obligatoire."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not data.get('date_embauche'):
            return Response(
                {"date_embauche": ["La date d'embauche est obligatoire (CORR-A4-006)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        model_class = POSTE_MODEL_MAP.get(poste)
        if model_class is None:
            return Response(
                {"poste": [
                    f"Poste invalide '{poste}'. "
                    f"Valeurs autorisées : {', '.join(POSTE_MODEL_MAP.keys())}."
                ]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        create_data = {
            'nom': data.get('nom'),
            'prenom': data.get('prenom', ''),
            'date_naissance': data.get('date_naissance'),
            'adresse': data.get('adresse', ''),
            'email': data.get('email'),
            'contact': data.get('contact', ''),
            'matricule': data.get('matricule') or generate_matricule(poste),
            'date_embauche': data.get('date_embauche'),
            'statut': data.get('statut', 'Actif'),
            'mot_de_passe': make_password(data.get('mot_de_passe') or 'Fultang@123'),
        }
        
        service_id = data.get('service')
        if service_id:
            try:
                create_data['service'] = resolve_service(service_id)
            except ValueError as exc:
                return Response(
                    {"service": [str(exc)]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
                
        if model_class == Medecin:
            create_data['specialite'] = data.get('specialite') or 'Medecine Generale'
            create_data['numero_ordre'] = data.get('numero_ordre') or f"ONMC-{random.randint(1000, 9999)}-X"
        elif model_class == Infirmiere:
            create_data['grade'] = data.get('grade') or 'AUTRE'
        elif model_class == Receptionniste:
            create_data['langues_parlees'] = data.get('langues_parlees') or ["FRANCAIS"]
        elif model_class == ComptableFinancier:
            create_data['niveau_accreditation'] = data.get('niveau_accreditation') or 'AUTRE'
        elif model_class == Laborantin:
            create_data['specialite_labo'] = data.get('specialite_labo') or 'AUTRE'
        elif model_class == Pharmacien:
            create_data['numero_licence'] = data.get('numero_licence') or f"PH-CMR-{random.randint(10000, 99999)}"
            
        instance = model_class.objects.create(**create_data)
        return Response(serialize_personnel(instance, model_class), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        user, model = self.get_user_and_model(pk)
        if not user:
            return Response({"detail": "Personnel introuvable"}, status=status.HTTP_404_NOT_FOUND)
            
        data = request.data
        user.nom = data.get('nom', user.nom)
        user.prenom = data.get('prenom', user.prenom)
        if 'date_naissance' in data:
            user.date_naissance = data.get('date_naissance')
        user.adresse = data.get('adresse', user.adresse)
        user.email = data.get('email', user.email)
        user.contact = data.get('contact', user.contact)
        user.statut = data.get('statut', user.statut)
        
        if 'service' in data:
            service_id = data.get('service')
            if service_id:
                try:
                    user.service = resolve_service(service_id)
                except ValueError as exc:
                    return Response(
                        {"service": [str(exc)]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                user.service = None
                
        if 'mot_de_passe' in data:
            user.mot_de_passe = make_password(data.get('mot_de_passe'))
            
        if model == Medecin:
            user.specialite = data.get('specialite', user.specialite)
            user.numero_ordre = data.get('numero_ordre', user.numero_ordre)
        elif model == Infirmiere:
            user.grade = data.get('grade', user.grade)
        elif model == Receptionniste:
            user.langues_parlees = data.get('langues_parlees', user.langues_parlees)
        elif model == ComptableFinancier:
            user.niveau_accreditation = data.get('niveau_accreditation', user.niveau_accreditation)
        elif model == Laborantin:
            user.specialite_labo = data.get('specialite_labo', user.specialite_labo)
        elif model == Pharmacien:
            user.numero_licence = data.get('numero_licence', user.numero_licence)
            
        user.save()
        return Response(serialize_personnel(user, model))

    def partial_update(self, request, pk=None):
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        user, model = self.get_user_and_model(pk)
        if not user:
            return Response({"detail": "Personnel introuvable"}, status=status.HTTP_404_NOT_FOUND)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='reset-password')
    def reset_password(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"detail": "Email requis"}, status=status.HTTP_400_BAD_REQUEST)
            
        personnel_models = [
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, ComptableFinancier, 
            ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin
        ]
        for model in personnel_models:
            try:
                user = model.objects.get(email=email)
                new_pass = "Fultang@" + str(random.randint(100, 999))
                user.mot_de_passe = make_password(new_pass)
                user.save()
                return Response({"detail": "Mot de passe reinitialise", "new_password": new_pass})
            except model.DoesNotExist:
                continue
        return Response({"detail": "Email introuvable"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        email = request.data.get('email')
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not email or not old_password or not new_password:
            return Response({"detail": "Email, ancien et nouveau mot de passe requis"}, status=status.HTTP_400_BAD_REQUEST)
            
        personnel_models = [
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, ComptableFinancier, 
            ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin
        ]
        for model in personnel_models:
            try:
                user = model.objects.get(email=email)
                if check_password(old_password, user.mot_de_passe):
                    user.mot_de_passe = make_password(new_password)
                    user.save()
                    return Response({"detail": "Mot de passe modifie avec succes"})
                else:
                    return Response({"detail": "Ancien mot de passe incorrect"}, status=status.HTTP_400_BAD_REQUEST)
            except model.DoesNotExist:
                continue
        return Response({"detail": "Email introuvable"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def dependencies(self, request, pk=None):
        return Response({
            "sessions": 0,
            "consultations": 0,
            "rendezvous": 0
        })


@extend_schema(tags=['Administration - Primes'])
class PrimeViewSet(viewsets.ModelViewSet):
    """Primes multi-services pour le personnel (CORR-A5-008)."""
    queryset = Prime.objects.select_related('service').all()
    serializer_class = PrimeSerializer
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        personnel_id = self.request.query_params.get('personnel_id')
        service_id = self.request.query_params.get('service')
        if personnel_id:
            qs = qs.filter(personnel_id=personnel_id)
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs


class ProvisionDatabaseView(APIView):
    """
    POST /api/internal/provision-database/ — Tenant Provisioning (Phase 7).

    Endpoint interne symétrique de `tenant-service`'s
    `POST /tenants/{id}/provision/` : tenant-service appelle CE endpoint
    pour déclencher la création physique réelle de la base PostgreSQL
    d'un tenant pour ce service, puis l'initialisation de son schéma.

    Comme `AuthVerifyView`, ce endpoint ne passe jamais par
    `GatewayHeaderAuthentication` (il n'est pas appelé via la Gateway,
    mais directement par tenant-service — communication service-to-service
    directe, décision déjà actée en Phase 4/6) : l'autorisation repose
    entièrement sur `IsInternalService` (jeton partagé
    TENANT_SERVICE_INTERNAL_TOKEN, même mécanisme que
    `tenant_routing/registry_client.py` dans l'autre sens).

    Ne reçoit QUE `tenant_id` — jamais un nom de base fourni par
    l'appelant : ce service dérive lui-même le nom physique (voir
    `pool_registry.provision_database`), il ne fait jamais confiance à
    une chaîne SQL reçue par le réseau, même d'un appelant de confiance.
    """
    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request):
        tenant_id = request.data.get('tenant_id')
        if not tenant_id:
            return Response({'detail': "Le champ 'tenant_id' est requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = provision_database(tenant_id)
        except DatabaseProvisioningError as exc:
            return Response(
                {'detail': "Provisioning physique échoué.", 'error': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(result, status=status.HTTP_200_OK)

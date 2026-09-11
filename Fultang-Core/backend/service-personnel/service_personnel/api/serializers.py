from django.contrib.auth.hashers import make_password
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer, OpenApiExample
from .models import (
    Service, Medecin, MedecinGeneraliste, Infirmiere, Receptionniste,
    ComptableFinancier, ComptableMatiere, Laborantin,
    Pharmacien, Directeur, Admin,
    GradeInfirmier, Langue, NiveauAccreditation, SpecialiteLabo, Statut
)
from .tenant_routing.context import get_current_tenant_context
from .utils import generate_temporary_password

class BasePersonnelSerializer(serializers.ModelSerializer):
    mot_de_passe = serializers.CharField(write_only=True, required=False)

    class Meta:
        fields = '__all__'

    def create(self, validated_data):
        """
        Génère un mot de passe temporaire (réel, jamais un champ laissé
        vide/en clair) si l'appelant n'en fournit pas un explicitement, et
        hashe systématiquement la valeur retenue avant sauvegarde.

        AVANT ce correctif : cette classe déclarait `mot_de_passe` en
        écriture mais ne le hashait JAMAIS (l'implémentation par défaut de
        `ModelSerializer.create` sauvegarde la valeur telle quelle) — tout
        `ModelViewSet` basé dessus (MedecinViewSet, PharmacienViewSet...)
        stockait donc soit un mot de passe en clair (si fourni), soit une
        chaîne vide (si omis, cas du frontend actuel), rendant le compte
        créé inutilisable pour se connecter.

        `self.temporary_password` est lu par `TemporaryPasswordResponseMixin`
        (views.py) pour l'inclure UNE SEULE FOIS dans la réponse HTTP de
        création — jamais renvoyé par la suite (list/retrieve), jamais
        stocké en clair nulle part.
        """
        provided_password = validated_data.pop('mot_de_passe', None)
        self.temporary_password = provided_password or generate_temporary_password()
        validated_data['mot_de_passe'] = make_password(self.temporary_password)

        # Correctif critique : `tenant_id` (editable=False, donc absent de
        # `validated_data` — DRF exclut les champs non éditables) n'était
        # JAMAIS renseigné par ce chemin de création, alors que
        # AuthVerifyView filtre explicitement par (email, tenant_id) —
        # un compte créé sans tenant_id ne pouvait donc JAMAIS se
        # connecter, quel que soit le mot de passe. La base physique de
        # destination était déjà correcte (routée par tenant_id via le
        # Database Router) ; seule la COLONNE tenant_id manquait sur la
        # ligne elle-même. Toujours pris du Tenant Context courant — la
        # même source de vérité que le Router lui-même — jamais d'une
        # valeur fournie par le client.
        tenant_context = get_current_tenant_context()
        validated_data['tenant_id'] = tenant_context.tenant_id if tenant_context else None

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Même correctif que create() : ne jamais persister mot_de_passe en clair sur une mise à jour."""
        new_password = validated_data.get('mot_de_passe')
        if new_password:
            validated_data['mot_de_passe'] = make_password(new_password)
        else:
            validated_data.pop('mot_de_passe', None)
        return super().update(instance, validated_data)

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple de Service',
            summary='Service de chirurgie',
            description='Un département typique hospitalier avec son code analytique de facturation.',
            value={
                "id_service": 1,
                "nom_service": "Chirurgie Cardiaque",
                "code_analytique": "CHIR-CARD-001"
            }
        )
    ]
)
class ServiceSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='id_service', read_only=True)
    code_analytique = serializers.CharField(required=False, allow_blank=True)
    chef_service_details = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = ['id', 'id_service', 'nom_service', 'code_analytique', 'desc_service', 'chef_service_id', 'chef_service_details']

    def validate(self, attrs):
        # 1. Génération automatique du code analytique si absent
        if not attrs.get('code_analytique'):
            nom = attrs.get('nom_service', '')
            import uuid
            prefix = "".join([c for c in nom if c.isalnum()]).upper()[:4]
            if not prefix:
                prefix = "SRV"
            attrs['code_analytique'] = f"{prefix}-{str(uuid.uuid4())[:8].upper()}"

        # 2. Résolution du chef_email en chef_service_id si fourni
        chef_email = self.initial_data.get('chef_email')
        if chef_email is not None:
            chef_email = chef_email.strip()
            if chef_email == "":
                attrs['chef_service_id'] = None
            else:
                from .models import (
                    Medecin, MedecinGeneraliste, Infirmiere, Receptionniste,
                    ComptableFinancier, ComptableMatiere, Laborantin,
                    Pharmacien, Directeur, Admin
                )
                personnel_models = [
                    Medecin, MedecinGeneraliste, Infirmiere, Receptionniste, ComptableFinancier, 
                    ComptableMatiere, Laborantin, Pharmacien, Directeur, Admin
                ]
                found = False
                for model in personnel_models:
                    try:
                        user = model.objects.get(email__iexact=chef_email)
                        attrs['chef_service_id'] = user.id_personnel
                        found = True
                        break
                    except model.DoesNotExist:
                        continue
                if not found:
                    raise serializers.ValidationError(
                        {"chef_email": f"Aucun personnel trouvé avec l'adresse email '{chef_email}'."}
                    )
        return attrs

    def get_chef_service_details(self, obj):
        if not obj.chef_service_id:
            return None
        from .models import (
            Medecin, MedecinGeneraliste, Infirmiere, Receptionniste,
            ComptableFinancier, ComptableMatiere, Laborantin,
            Pharmacien, Directeur, Admin
        )
        POSTE_MAP = {
            Medecin: 'medecin', MedecinGeneraliste: 'medecin',
            Infirmiere: 'infirmier', Receptionniste: 'receptioniste',
            ComptableFinancier: 'comptable_financier', ComptableMatiere: 'compta_matiere',
            Laborantin: 'laborantin', Pharmacien: 'pharmacien',
            Directeur: 'directeur', Admin: 'admin',
        }
        for model_class, poste in POSTE_MAP.items():
            try:
                p = model_class.objects.get(id_personnel=obj.chef_service_id)
                return {
                    'id': str(p.id_personnel),
                    'nom': p.nom,
                    'prenom': p.prenom,
                    'poste': poste,
                    'email': p.email,
                    'matricule': p.matricule,
                }
            except model_class.DoesNotExist:
                continue
        return None

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple de Médecin',
            summary='Profil de Cardiologue',
            description='Création ou modification d\'un médecin avec sa spécialité et son numéro de l\'ordre des médecins.',
            value={
                "id_personnel": 101,
                "nom": "Dupont",
                "prenom": "Jean",
                "date_naissance": "1980-05-15",
                "adresse": "123 Avenue des Champs, Yaoundé",
                "email": "jean.dupont@fultang.local",
                "contact": "+237699999999",
                "matricule": "MED-2023-001",
                "date_embauche": "2023-01-10",
                "statut": "Actif",
                "service": 1,
                "specialite": "Cardiologie",
                "numero_ordre": "ONMC-8374-X"
            }
        )
    ]
)
class MedecinSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Medecin
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple de Médecin Généraliste',
            summary='Profil de Généraliste',
            description='Création ou modification d\'un médecin généraliste avec sa zone couverte et son numéro de l\'ordre.',
            value={
                "id_personnel": 110,
                "nom": "Kengne",
                "prenom": "Alain",
                "date_naissance": "1985-04-12",
                "adresse": "Quartier Bastos, Yaoundé",
                "email": "alain.kengne@fultang.local",
                "contact": "+237699999998",
                "matricule": "MGEN-2024-001",
                "date_embauche": "2024-02-15",
                "statut": "Actif",
                "service": 1,
                "numero_ordre": "ONMC-9988-G",
                "zone_couverte": "Bastos, Yaoundé"
            }
        )
    ]
)
class MedecinGeneralisteSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = MedecinGeneraliste
        fields = '__all__'


@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple d\'Infirmière',
            summary='Infirmière Diplômée d\'État (IDE)',
            value={
                "id_personnel": 102,
                "nom": "Ateba",
                "prenom": "Marie",
                "date_naissance": "1990-11-22",
                "adresse": "Quartier Essos, Yaoundé",
                "email": "marie.ateba@fultang.local",
                "contact": "+237688888888",
                "matricule": "INF-2021-045",
                "date_embauche": "2021-06-01",
                "statut": "Actif",
                "service": 1,
                "grade": "IDE"
            }
        )
    ]
)
class InfirmiereSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Infirmiere
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple de Réceptionniste',
            summary='Hôtesse d\'accueil polyglotte',
            value={
                "id_personnel": 103,
                "nom": "Biyong",
                "prenom": "Claire",
                "date_naissance": "1995-03-10",
                "adresse": "Bonamoussadi, Douala",
                "email": "claire.b@fultang.local",
                "contact": "+237677777777",
                "matricule": "REC-2023-002",
                "date_embauche": "2023-02-15",
                "statut": "Actif",
                "service": 1,
                "langues_parlees": ["FRANCAIS", "ANGLAIS"]
            }
        )
    ]
)
class ReceptionnisteSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Receptionniste
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple Comptable Financier',
            summary='Expert Comptable',
            value={
                "id_personnel": 104,
                "nom": "Talla",
                "prenom": "Paul",
                "date_naissance": "1982-08-30",
                "adresse": "Makepe, Douala",
                "email": "paul.talla@fultang.local",
                "contact": "+237666666666",
                "matricule": "CFI-2015-011",
                "date_embauche": "2015-09-01",
                "statut": "Actif",
                "service": 1,
                "niveau_accreditation": "EXPERT_COMPTABLE"
            }
        )
    ]
)
class ComptableFinancierSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = ComptableFinancier
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple Comptable Matière',
            summary='Gestionnaire de Stock',
            value={
                "id_personnel": 105,
                "nom": "Njoya",
                "prenom": "Ibrahim",
                "date_naissance": "1988-12-05",
                "adresse": "Deido, Douala",
                "email": "i.njoya@fultang.local",
                "contact": "+237655555555",
                "matricule": "CMA-2018-022",
                "date_embauche": "2018-04-10",
                "statut": "Actif",
                "service": 1
            }
        )
    ]
)
class ComptableMatiereSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = ComptableMatiere
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple Laborantin',
            summary='Technicien en Hématologie',
            value={
                "id_personnel": 106,
                "nom": "Kamga",
                "prenom": "Luc",
                "date_naissance": "1992-07-14",
                "adresse": "Bastos, Yaoundé",
                "email": "luc.kamga@fultang.local",
                "contact": "+237644444444",
                "matricule": "LAB-2020-008",
                "date_embauche": "2020-01-20",
                "statut": "Actif",
                "service": 1,
                "specialite_labo": "HEMATOLOGIE"
            }
        )
    ]
)
class LaborantinSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Laborantin
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple Pharmacien',
            summary='Pharmacien Titulaire',
            value={
                "id_personnel": 107,
                "nom": "Ekani",
                "prenom": "Sylvie",
                "date_naissance": "1985-02-28",
                "adresse": "Mvog-Ada, Yaoundé",
                "email": "sylvie.ekani@fultang.local",
                "contact": "+237633333333",
                "matricule": "PHA-2019-030",
                "date_embauche": "2019-11-15",
                "statut": "Actif",
                "service": 1,
                "numero_licence": "PH-CMR-93822"
            }
        )
    ]
)
class PharmacienSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Pharmacien
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple Directeur',
            summary='Directeur Général',
            value={
                "id_personnel": 108,
                "nom": "Fouda",
                "prenom": "Robert",
                "date_naissance": "1970-01-10",
                "adresse": "Quartier du Lac, Yaoundé",
                "email": "dg@fultang.local",
                "contact": "+237622222222",
                "matricule": "DIR-2010-001",
                "date_embauche": "2010-01-01",
                "statut": "Actif",
                "service": 1
            }
        )
    ]
)
class DirecteurSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Directeur
        fields = '__all__'

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Exemple Admin',
            summary='Administrateur Système (DSI)',
            value={
                "id_personnel": 109,
                "nom": "Mballa",
                "prenom": "Cédric",
                "date_naissance": "1994-09-18",
                "adresse": "Damas, Yaoundé",
                "email": "admin.sys@fultang.local",
                "contact": "+237611111111",
                "matricule": "ADM-2022-005",
                "date_embauche": "2022-03-12",
                "statut": "Actif",
                "service": 1
            }
        )
    ]
)
class AdminSerializer(BasePersonnelSerializer):
    class Meta(BasePersonnelSerializer.Meta):
        model = Admin
        fields = '__all__'

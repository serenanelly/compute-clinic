from datetime import date
from rest_framework import serializers
from .models import (
    DonneesCliniques, Allergie, Maladie, Traitement, Antecedent,
    ModeDeVie, Voyage, ActivitePhysique, Addiction, RendezVous
)
 
class AntecedentSerializer(serializers.ModelSerializer):
    """
    Serializer pour les antécédents médicaux et familiaux.
    """
    class Meta:
        model = Antecedent
        fields = '__all__'

class TraitementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Traitement
        fields = '__all__'

class MaladieSerializer(serializers.ModelSerializer):
    traitements = TraitementSerializer(many=True, read_only=True)
    class Meta:
        model = Maladie
        fields = '__all__'

class DonneesCliniquesSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonneesCliniques
        fields = '__all__'

    def validate(self, attrs):
        from .vital_thresholds import validate_clinical_data
        merged = {**getattr(self, 'initial_data', {}), **attrs}
        try:
            validate_clinical_data(merged)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))
        return attrs

class AllergieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergie
        fields = '__all__'

class ModeDeVieSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModeDeVie
        fields = '__all__'

class VoyageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Voyage
        fields = '__all__'

class ActivitePhysiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivitePhysique
        fields = '__all__'

class AddictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Addiction
        fields = '__all__'

class RendezVousSerializer(serializers.ModelSerializer):
    class Meta:
        model = RendezVous
        fields = '__all__'
        extra_kwargs = {
            'statut': {'required': False}
        }

from medical_workflow.serializers import ConsultationSerializer
from patient.models import Patient
from patient.models.emergency import LienParente
from patient.serializers import (
    AdresseSerializer, ContactSerializer, NationaliteSerializer,
    PersonneAPrevenirSerializer
)

class PatientDossierSerializer(serializers.ModelSerializer):
    """
    Consolidation de TOUT le dossier patient : Identité, Clinique, Lifestyle et Consultations.
    """
    donnees_cliniques = DonneesCliniquesSerializer(read_only=True)
    allergies = AllergieSerializer(many=True, read_only=True)
    maladies = MaladieSerializer(many=True, read_only=True)
    mode_de_vie = ModeDeVieSerializer(read_only=True)
    antecedents = AntecedentSerializer(many=True, read_only=True)
    voyages = VoyageSerializer(many=True, read_only=True)
    activites_physiques = ActivitePhysiqueSerializer(many=True, read_only=True)
    addictions = AddictionSerializer(many=True, read_only=True)
    rendez_vous = RendezVousSerializer(many=True, read_only=True)
    
    # Intégration des consultations (App medical_workflow)
    consultations = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    
    # Données identitaires (Phase 1)
    adresse = AdresseSerializer(read_only=True)
    contacts = ContactSerializer(many=True, read_only=True)
    nationalites = NationaliteSerializer(many=True, read_only=True)
    personnes_a_prevenir = serializers.SerializerMethodField()

    def get_personnes_a_prevenir(self, patient):
        """
        Retourne les personnes à prévenir avec leur lien de parenté
        spécifique à CE patient (via la table pivot LienParente).
        """
        liens = LienParente.objects.filter(patient=patient).select_related('personne_a_prevenir__adresse')
        result = []
        for lien in liens:
            pap = lien.personne_a_prevenir
            contacts = pap.contacts.all()
            result.append({
                'id': str(pap.id),
                'nom': pap.nom,
                'prenom': pap.prenom,
                'relation': lien.relation,
                'relation_autre': lien.relation_autre,
                'adresse': AdresseSerializer(pap.adresse).data if pap.adresse else None,
                'contacts': ContactSerializer(contacts, many=True).data,
            })
        return result

    class Meta:
        model = Patient
        fields = [
            'id', 'matricule', 'nom', 'prenom', 'sexe', 'date_naissance',
            'lieu_naissance', 'profession', 'statut_matrimonial', 'courriel',
            'numero_securite_sociale', 'nombre_enfants', 'photo',
            'adresse', 'contacts', 'nationalites', 'personnes_a_prevenir',
            'donnees_cliniques', 'allergies', 'maladies', 'antecedents',
            'mode_de_vie', 'voyages', 'activites_physiques',
            'addictions', 'rendez_vous', 'consultations',
        ]

# --- Serializers d'Exportation (Anonymisés) ---

class AnonymousConsultationSerializer(ConsultationSerializer):
    """Consultation sans identifiants personnels ni liés aux visites."""
    class Meta(ConsultationSerializer.Meta):
        fields = [
            'id', 'medecin_charge', 'date_heure', 'motif', 
            'symptomes', 'diagnostics', 'prescriptions', 'examens'
        ]

class PatientMedicalExportSerializer(serializers.ModelSerializer):
    """Exportation globale des données médicales d'un patient (Sans PII)."""
    age = serializers.SerializerMethodField()
    donnees_cliniques = DonneesCliniquesSerializer(read_only=True)
    consultations = AnonymousConsultationSerializer(many=True, read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'age', 'sexe', 'statut_matrimonial', 'nombre_enfants', 
            'profession', 'donnees_cliniques', 'consultations'
        ]

    def get_age(self, obj):
        if not obj.date_naissance:
            return None
        today = date.today()
        return today.year - obj.date_naissance.year - (
            (today.month, today.day) < (obj.date_naissance.month, obj.date_naissance.day)
        )

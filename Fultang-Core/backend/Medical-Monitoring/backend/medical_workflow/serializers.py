from rest_framework import serializers
from .models import (
    Consultation, Symptome, Diagnostic, MedicamentPrescrit,
    Examen, ResultatExamen,
    Hospitalisation, SoinAdministre, Visite,
    AnomaliePrescription, DelivranceMedicament, ConciliationMedicamenteuse,
    Prelevement, ValeurCritique, OrientationSpecialiste,
    InterventionChirurgicale, MembreEquipeOperatoire,
)

# --- Serializers Enfants ---

class SymptomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Symptome
        fields = [
            'id', 'consultation', 'nom', 'localisation', 'date_debut', 
            'frequence', 'duree', 'evolution', 'activite_declencheuse'
        ]

class DiagnosticSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnostic
        fields = [
            'id', 'consultation', 'libelle', 'description', 'conclusion',
            'niveau_certitude', 'type_diagnostic',
        ]

class PrelevementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prelevement
        fields = '__all__'

class ValeurCritiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValeurCritique
        fields = '__all__'

class AnomaliePrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnomaliePrescription
        fields = '__all__'

class DelivranceMedicamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DelivranceMedicament
        fields = '__all__'

class ConciliationMedicamenteuseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConciliationMedicamenteuse
        fields = '__all__'

class MedicamentPrescritSerializer(serializers.ModelSerializer):
    anomalies = AnomaliePrescriptionSerializer(many=True, read_only=True)
    delivrances = DelivranceMedicamentSerializer(many=True, read_only=True)
    patient_info = serializers.SerializerMethodField()
    medecin = serializers.SerializerMethodField()
    date_heure = serializers.SerializerMethodField()

    class Meta:
        model = MedicamentPrescrit
        fields = [
            'id', 'consultation', 'nom', 'quantite', 'type_medicament', 
            'posologie', 'statut', 'anomalies', 'delivrances',
            'patient_info', 'medecin', 'date_heure'
        ]

    def get_patient_info(self, obj):
        try:
            patient = obj.consultation.patient
            first_name = patient.prenom or ""
            last_name = patient.nom or ""
            fullName = f"{last_name} {first_name}".strip()
            initials = (last_name[0] if last_name else "?") + (first_name[0] if first_name else "")
            return {
                "mat": patient.matricule,
                "fullName": fullName,
                "initials": initials.upper()
            }
        except Exception:
            return None

    def get_date_heure(self, obj):
        try:
            return obj.consultation.date_heure.isoformat()
        except Exception:
            return None

    def get_medecin(self, obj):
        try:
            doc_id = obj.consultation.medecin_charge
            if not doc_id:
                return "Non spécifié"
            
            import urllib.request
            import json
            headers = {}
            request_obj = self.context.get('request') if hasattr(self, 'context') else None
            if request_obj:
                user_id = request_obj.META.get('HTTP_X_USER_ID') or request_obj.headers.get('X-User-Id')
                user_roles = request_obj.META.get('HTTP_X_USER_ROLES') or request_obj.headers.get('X-User-Roles')
                if user_id:
                    headers['X-User-Id'] = user_id
                if user_roles:
                    headers['X-User-Roles'] = user_roles

            req = urllib.request.Request(
                f"http://fultang-personnel:8000/api/personnel/{doc_id}/",
                headers=headers
            )
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    return f"Dr. {data.get('nom', '')} {data.get('prenom', '')}".strip()
        except Exception:
            pass
        return f"Dr. {obj.consultation.medecin_charge[:8] if obj.consultation.medecin_charge else 'Inconnu'}"

class ResultatExamenSerializer(serializers.ModelSerializer):
    valeurs_critiques = ValeurCritiqueSerializer(many=True, read_only=True)

    class Meta:
        model = ResultatExamen
        fields = ['id', 'examen', 'doctor_id', 'observations', 'resultats', 'interpretation', 'valeurs_critiques']

class VisiteSerializer(serializers.ModelSerializer):
    paiement_actif = serializers.SerializerMethodField()
    paiement_expire_le = serializers.SerializerMethodField()

    class Meta:
        model = Visite
        fields = '__all__'
        read_only_fields = ('id', 'date_heure')

    def get_paiement_actif(self, obj):
        return obj.paiement_est_actif()

    def get_paiement_expire_le(self, obj):
        exp = obj.paiement_expire_le
        return exp.isoformat() if exp else None


class OrientationSpecialisteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrientationSpecialiste
        fields = ['id', 'consultation', 'specialite', 'motif', 'date_heure']
        read_only_fields = ('id', 'date_heure')



# --- Serializers Principaux ---

class ExamenSerializer(serializers.ModelSerializer):
    resultat = ResultatExamenSerializer(read_only=True)
    prelevements = PrelevementSerializer(many=True, read_only=True)
    medecin_prescripteur_id = serializers.SerializerMethodField()
    date_prescription = serializers.SerializerMethodField()

    class Meta:
        model = Examen
        fields = [
            'id', 'consultation', 'nom', 'categorie', 'motif', 'anatomie', 'statut',
            'resultat', 'prelevements', 'medecin_prescripteur_id', 'date_prescription',
        ]
        read_only_fields = ('id',)
        extra_kwargs = {'categorie': {'required': True}}

    def get_medecin_prescripteur_id(self, obj):
        try:
            return obj.consultation.medecin_charge
        except Exception:
            return None

    def get_date_prescription(self, obj):
        try:
            return obj.consultation.date_heure.isoformat()
        except Exception:
            return None

class ConsultationSerializer(serializers.ModelSerializer):
    symptomes = SymptomeSerializer(many=True, read_only=True)
    diagnostics = DiagnosticSerializer(many=True, read_only=True)
    prescriptions = MedicamentPrescritSerializer(many=True, read_only=True)
    examens = ExamenSerializer(many=True, read_only=True)
    orientations = OrientationSpecialisteSerializer(many=True, read_only=True)

    class Meta:
        model = Consultation
        fields = [
            'id', 'patient', 'visite', 'medecin_charge', 'date_heure', 'motif',
            'examen_physique', 'champs_specialite',
            'symptomes', 'diagnostics', 'prescriptions', 'examens', 'orientations',
        ]
        read_only_fields = ('id', 'date_heure')


class HospitalisationSerializer(serializers.ModelSerializer):
    patient_details = serializers.SerializerMethodField()
    medecin_details = serializers.SerializerMethodField()

    class Meta:
        model = Hospitalisation
        fields = [
            'id', 'patient', 'visite', 'room_id', 'numero_lit', 'doctor_id', 'motif',
            'service', 'duree_prevue', 'statut',
            'validation_medicale', 'date_validation_medicale',
            'validation_financiere', 'date_validation_financiere',
            'type_sortie', 'notes_sortie',
            'patient_details', 'medecin_details',
        ]
        read_only_fields = ('id',)

    def validate(self, attrs):
        from .models.choices import StatutHospitalisation
        if self.instance is None:
            attrs.pop('room_id', None)
            attrs['statut'] = StatutHospitalisation.EN_ATTENTE_LIT
        return attrs

    def get_patient_details(self, obj):
        try:
            return {
                "id": obj.patient.id,
                "nom": obj.patient.nom,
                "prenom": obj.patient.prenom
            }
        except Exception:
            return None

    def get_medecin_details(self, obj):
        if not obj.doctor_id:
            return None
        if not hasattr(self, '_medecin_cache'):
            self._medecin_cache = {}
        
        doc_id_str = str(obj.doctor_id)
        if doc_id_str in self._medecin_cache:
            return self._medecin_cache[doc_id_str]

        import urllib.request
        import json
        headers = {}
        request_obj = self.context.get('request') if hasattr(self, 'context') else None
        if request_obj:
            user_id = request_obj.META.get('HTTP_X_USER_ID') or request_obj.headers.get('X-User-Id')
            user_roles = request_obj.META.get('HTTP_X_USER_ROLES') or request_obj.headers.get('X-User-Roles')
            if user_id:
                headers['X-User-Id'] = user_id
            if user_roles:
                headers['X-User-Roles'] = user_roles

        try:
            req = urllib.request.Request(
                f"http://fultang-personnel:8000/api/personnel/{doc_id_str}/",
                headers=headers
            )
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    details = {
                        "nom": data.get("nom", ""),
                        "prenom": data.get("prenom", "")
                    }
                    self._medecin_cache[doc_id_str] = details
                    return details
        except Exception as e:
            pass
            
        return {"nom": "Médecin", "prenom": doc_id_str[:8]}

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if not ret.get('service') and instance.doctor_id:
            doc_id_str = str(instance.doctor_id)
            import urllib.request
            import json
            headers = {}
            request_obj = self.context.get('request') if hasattr(self, 'context') else None
            if request_obj:
                user_id = request_obj.META.get('HTTP_X_USER_ID') or request_obj.headers.get('X-User-Id')
                user_roles = request_obj.META.get('HTTP_X_USER_ROLES') or request_obj.headers.get('X-User-Roles')
                if user_id:
                    headers['X-User-Id'] = user_id
                if user_roles:
                    headers['X-User-Roles'] = user_roles
            try:
                req = urllib.request.Request(
                    f"http://fultang-personnel:8000/api/personnel/{doc_id_str}/",
                    headers=headers
                )
                with urllib.request.urlopen(req, timeout=2) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode('utf-8'))
                        service_id = data.get("service")
                        if service_id:
                            services_map = {
                                1: "Chirurgie",
                                2: "Radiologie",
                                3: "Pharmacie",
                                4: "Neurologie",
                                5: "Laboratoire",
                                6: "Maternité",
                                7: "Pédiatrie",
                                8: "Urgences",
                                9: "Consultation générale",
                                10: "Administration",
                            }
                            ret['service'] = services_map.get(service_id)
            except Exception:
                pass
        if not ret.get('service'):
            ret['service'] = "Chirurgie"
        return ret

class SoinAdministreSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoinAdministre
        fields = '__all__'
        read_only_fields = ('id', 'date_heure')


class MembreEquipeOperatoireSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembreEquipeOperatoire
        fields = ['id', 'intervention', 'personnel_id', 'role']
        read_only_fields = ('id',)


class InterventionChirurgicaleSerializer(serializers.ModelSerializer):
    equipe = MembreEquipeOperatoireSerializer(many=True, read_only=True)

    class Meta:
        model = InterventionChirurgicale
        fields = [
            'id', 'patient', 'visite', 'medecin_chirurgien_id', 'libelle', 'urgence',
            'statut', 'acompte_montant', 'dette_restante', 'date_intervention',
            'notes', 'date_creation', 'equipe',
        ]
        read_only_fields = ('id', 'date_creation')

"""
Sérialiseurs pour les modèles de matériel.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import Materiel, MaterielMedical, MaterielDurable


# ======================
# MATERIEL (Base)
# ======================

class MaterielSerializer(serializers.ModelSerializer):
    """Sérialiseur complet pour la lecture des matériels."""
    
    class Meta:
        model = Materiel
        fields = '__all__'
        read_only_fields = ['idMateriel', 'date_derniere_modification']


class MaterielCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la création d'un matériel."""
    
    class Meta:
        model = Materiel
        fields = ['code_materiel', 'nom_Materiel', 'prix_achat_unitaire', 'quantite_stock']
    
    def validate_prix_achat_unitaire(self, value):
        """Valider que le prix est positif."""
        if value <= 0:
            raise serializers.ValidationError("Le prix d'achat doit être supérieur à 0.")
        return value
    
    def validate_quantite_stock(self, value):
        """Valider que la quantité est positive ou nulle."""
        if value < 0:
            raise serializers.ValidationError("La quantité en stock ne peut pas être négative.")
        return value


class MaterielUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la mise à jour d'un matériel."""
    
    class Meta:
        model = Materiel
        fields = ['nom_Materiel', 'prix_achat_unitaire', 'quantite_stock']
    
    def validate_prix_achat_unitaire(self, value):
        if value and value <= 0:
            raise serializers.ValidationError("Le prix d'achat doit être supérieur à 0.")
        return value
    
    def validate_quantite_stock(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("La quantité en stock ne peut pas être négative.")
        return value


# ======================
# MATERIEL MEDICAL
# ======================

class MaterielMedicalSerializer(serializers.ModelSerializer):
    """Sérialiseur complet pour la lecture des matériels médicaux."""
    
    categorie_display = serializers.CharField(source='get_categorie_display', read_only=True)
    unite_mesure_display = serializers.CharField(source='get_unite_mesure_display', read_only=True)
    marge = serializers.SerializerMethodField()
    taux_marge = serializers.SerializerMethodField()
    
    class Meta:
        model = MaterielMedical
        fields = '__all__'
        read_only_fields = ['idMateriel', 'date_derniere_modification']
    
    def get_marge(self, obj):
        """Retourner la marge bénéficiaire."""
        return obj.calculer_marge()
    
    def get_taux_marge(self, obj):
        """Retourner le taux de marge en pourcentage."""
        return round(obj.calculer_taux_marge(), 2)


class MaterielMedicalCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la création d'un matériel médical."""
    
    class Meta:
        model = MaterielMedical
        fields = [
            'materiel_ptr_id',  # ID retourné après création
            'code_materiel',
            'nom_Materiel',
            'prix_achat_unitaire',
            'quantite_stock',
            'categorie',
            'unite_mesure',
            'prix_vente_unitaire'
        ]
        read_only_fields = ['materiel_ptr_id']
    
    def validate_prix_achat_unitaire(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le prix d'achat doit être supérieur à 0.")
        return value
    
    def validate_prix_vente_unitaire(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le prix de vente doit être supérieur à 0.")
        return value
    
    def validate_quantite_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("La quantité en stock ne peut pas être négative.")
        return value
    
    def validate(self, data):
        """Validation globale."""
        # On autorise la vente à perte si nécessaire
        return data


class MaterielMedicalUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la mise à jour d'un matériel médical."""
    
    class Meta:
        model = MaterielMedical
        fields = [
            'nom_Materiel',
            'prix_achat_unitaire',
            'quantite_stock',
            'categorie',
            'unite_mesure',
            'prix_vente_unitaire'
        ]


# ======================
# MATERIEL DURABLE
# ======================

class MaterielDurableSerializer(serializers.ModelSerializer):
    """Sérialiseur complet pour la lecture des matériels durables."""
    
    Etat_display = serializers.CharField(source='get_Etat_display', read_only=True)
    est_operationnel = serializers.SerializerMethodField()
    
    class Meta:
        model = MaterielDurable
        fields = '__all__'
        read_only_fields = ['idMateriel', 'date_derniere_modification', 'date_Enregistrement']
    
    def get_est_operationnel(self, obj):
        """Indique si le matériel est opérationnel."""
        return obj.est_en_bon_etat()


class MaterielDurableCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la création d'un matériel durable."""
    
    class Meta:
        model = MaterielDurable
        fields = [
            'materiel_ptr_id',  # ID retourné après création
            'code_materiel',
            'nom_Materiel',
            'prix_achat_unitaire',
            'quantite_stock',
            'Etat',
            'localisation'
        ]
        read_only_fields = ['materiel_ptr_id']
    
    def validate_prix_achat_unitaire(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le prix d'achat doit être supérieur à 0.")
        return value
    
    def validate_quantite_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("La quantité en stock ne peut pas être négative.")
        return value
    
    def validate_localisation(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("La localisation ne peut pas être vide.")
        return value.strip()


class MaterielDurableUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la mise à jour d'un matériel durable."""
    
    class Meta:
        model = MaterielDurable
        fields = [
            'nom_Materiel',
            'prix_achat_unitaire',
            'quantite_stock',
            'Etat',
            'localisation'
        ]

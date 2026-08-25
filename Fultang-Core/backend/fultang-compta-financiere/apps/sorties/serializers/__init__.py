"""Serializers de l'app Sorties."""
from rest_framework import serializers
from apps.comptabilite.models import CompteComptable
from apps.sorties.models import (
    CategorieSortie, Fournisseur,
    DemandeAchat, BonCommande, LigneBonCommande,
    Facture, LigneFacture, OrdrePaiement,
    PaiementSalaire, ChargeSociale,
)


class CategorieSortieSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategorieSortie
        fields = ['id', 'code', 'libelle', 'description', 'type_categorie', 'compte_comptable']


class FournisseurSerializer(serializers.ModelSerializer):
    compte_comptable = serializers.PrimaryKeyRelatedField(
        queryset=CompteComptable.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Fournisseur
        fields = ['id', 'raison_sociale', 'niu', 'telephone', 'email', 'rib',
                  'adresse', 'compte_comptable', 'actif', 'date_creation']
        read_only_fields = ['id', 'date_creation']

    def validate(self, attrs):
        if not attrs.get('compte_comptable') and not self.instance:
            default = CompteComptable.objects.filter(
                numero_compte__startswith='401', actif=True,
            ).order_by('numero_compte').first()
            if not default:
                raise serializers.ValidationError({
                    'compte_comptable': 'Aucun compte fournisseur (401) dans le plan comptable. Créez-le d\'abord.',
                })
            attrs['compte_comptable'] = default
        return attrs


class LigneBonCommandeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneBonCommande
        fields = ['id', 'designation', 'quantite', 'prix_unitaire', 'montant']
        read_only_fields = ['id', 'montant']


class BonCommandeSerializer(serializers.ModelSerializer):
    lignes = LigneBonCommandeSerializer(many=True, required=False)
    fournisseur_nom = serializers.SerializerMethodField()

    class Meta:
        model = BonCommande
        fields = ['id', 'numero', 'demande_achat', 'fournisseur', 'fournisseur_nom',
                  'montant_total', 'statut', 'date_creation', 'lignes']
        read_only_fields = ['id', 'numero', 'date_creation']

    def get_fournisseur_nom(self, obj):
        return obj.fournisseur.raison_sociale if obj.fournisseur else None

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes', [])
        bc = BonCommande.objects.create(**validated_data)
        total = 0
        for l in lignes_data:
            ligne = LigneBonCommande.objects.create(bon_commande=bc, **l)
            total += ligne.montant
        bc.montant_total = total
        bc.save()
        return bc


class DemandeAchatSerializer(serializers.ModelSerializer):
    class Meta:
        model = DemandeAchat
        fields = [
            'id', 'numero', 'service_demandeur_id', 'demandeur_id',
            'montant_estime', 'priorite', 'est_banque_de_sang',
            'avis_comptable', 'commentaire_budgetaire', 'statut',
            'description', 'date_creation',
        ]
        read_only_fields = ['id', 'numero', 'date_creation']


class LigneFactureSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneFacture
        fields = ['id', 'designation', 'quantite', 'prix_unitaire', 'taux_tva']


class FactureSerializer(serializers.ModelSerializer):
    lignes = LigneFactureSerializer(many=True, required=False)
    fournisseur_nom = serializers.SerializerMethodField()

    class Meta:
        model = Facture
        fields = ['id', 'bon_commande', 'fournisseur', 'fournisseur_nom',
                  'numero_facture', 'montant_ht', 'montant_ttc',
                  'est_payee', 'est_comptabilisee', 'date_echeance',
                  'date_reception', 'lignes']
        read_only_fields = ['id', 'date_reception', 'est_comptabilisee']

    def get_fournisseur_nom(self, obj):
        return obj.fournisseur.raison_sociale if obj.fournisseur else None

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes', [])
        facture = Facture.objects.create(**validated_data)
        for l in lignes_data:
            LigneFacture.objects.create(facture=facture, **l)
        return facture


class OrdrePaiementSerializer(serializers.ModelSerializer):
    ecriture_generee = serializers.SerializerMethodField()

    class Meta:
        model = OrdrePaiement
        fields = [
            'id', 'numero', 'facture', 'type_sortie', 'montant',
            'mode_paiement', 'statut', 'est_comptabilise', 'ecriture_generee',
            'beneficiaire', 'date_creation', 'date_execution',
        ]
        read_only_fields = ['id', 'numero', 'date_creation', 'date_execution', 'ecriture_generee']

    def get_ecriture_generee(self, obj):
        from apps.comptabilite.models import EcritureComptable
        return EcritureComptable.objects.filter(ordre_paiement_id=obj.id).exists()


class ChargeSocialeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChargeSociale
        fields = ['id', 'paiement_salaire', 'type_charge', 'montant', 'date_creation']
        read_only_fields = ['id', 'date_creation']


class PaiementSalaireSerializer(serializers.ModelSerializer):
    charges_sociales = ChargeSocialeSerializer(many=True, read_only=True)

    class Meta:
        model = PaiementSalaire
        fields = [
            'id', 'mois', 'annee', 'personnel_id', 'nom_personnel', 'matricule', 'poste',
            'salaire_brut', 'retenue_cnps', 'retenue_impots', 'deduction_ecart_caisse',
            'salaire_net', 'est_paye', 'date_paiement', 'date_creation', 'charges_sociales',
        ]
        read_only_fields = ['id', 'salaire_net', 'date_creation']

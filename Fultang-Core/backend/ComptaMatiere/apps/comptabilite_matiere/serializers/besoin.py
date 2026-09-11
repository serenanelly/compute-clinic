"""
Sérialiseurs pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import Besoin


class BesoinCreateSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la création d'un besoin.
    
    Accepte uniquement le motif et l'idPersonnel_emetteur.
    Le statut est automatiquement mis à NON_TRAITE et la date de création
    est automatiquement définie.
    """
    
    idPersonnel_emetteur = serializers.CharField(
        help_text="Identifiant du personnel ayant émis le besoin"
    )
    
    class Meta:
        model = Besoin
        fields = ['motif', 'idPersonnel_emetteur', 'fournisseur_souhaite']
    
    def create(self, validated_data):
        """
        Créer un besoin avec le statut NON_TRAITE par défaut.
        """
        # Le statut NON_TRAITE est déjà défini par défaut dans le modèle
        # La date de création est aussi automatique
        return Besoin.objects.create(**validated_data)




class BesoinSerializer(serializers.ModelSerializer):
    """
    Sérialiseur complet pour la lecture des besoins.
    
    Inclut tous les champs et des informations détaillées sur le personnel émetteur.
    """
    
    idPersonnel_emetteur_details = serializers.SerializerMethodField()
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite = serializers.SerializerMethodField()

    class Meta:
        model = Besoin
        fields = [
            'idBesoin',
            'date_creation_besoin',
            'idPersonnel_emetteur',
            'idPersonnel_emetteur_details',
            'motif',
            'statut',
            'statut_display',
            'priorite',
            'fournisseur_souhaite',
            'date_traitement_directeur',
            'commentaire_directeur',
        ]
        read_only_fields = [
            'idBesoin',
            'date_creation_besoin',
            'date_traitement_directeur',
        ]

    def get_idPersonnel_emetteur_details(self, obj):
        """Retourner l'ID du personnel émetteur (détail non disponible car backend séparé)."""
        return obj.idPersonnel_emetteur

    def get_priorite(self, obj):
        """
        Priorité globale du besoin = priorité maximale parmi ses lignes.
        La priorité n'existe que sur les lignes (LigneBesoin) ; on l'agrège ici
        pour que le directeur et le comptable financier puissent la tracer.
        """
        ordre = {'LOW': 0, 'NORMAL': 1, 'HIGH': 2}
        priorites = [l.priorite for l in obj.lignes.all()]
        if not priorites:
            return 'NORMAL'
        return max(priorites, key=lambda p: ordre.get(p, 1))


class BesoinUpdateSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la mise à jour d'un besoin (principalement pour le directeur).
    
    Permet de modifier le statut, le commentaire du directeur.
    """
    
    class Meta:
        model = Besoin
        fields = [
            'statut',
            'commentaire_directeur',
        ]
    
    def validate_statut(self, value):
        """Valider le changement de statut."""
        if value not in dict(Besoin.StatutChoices.choices):
            raise serializers.ValidationError(f"Statut invalide: {value}")
        return value


class CommentaireDirecteurSerializer(serializers.Serializer):
    """
    Sérialiseur pour ajouter le commentaire du directeur.
    
    La date de traitement est automatiquement définie lors de l'ajout du commentaire.
    """
    
    commentaire_directeur = serializers.CharField(
        required=True,
        allow_blank=False,
        min_length=5,
        max_length=1000,
        error_messages={
            'required': 'Le commentaire du directeur est requis.',
            'blank': 'Le commentaire ne peut pas être vide.',
            'min_length': 'Le commentaire doit contenir au moins 5 caractères.',
            'max_length': 'Le commentaire ne peut pas dépasser 1000 caractères.',
        }
    )
    
    def validate_commentaire_directeur(self, value):
        """Validation supplémentaire du commentaire."""
        if not value or not value.strip():
            raise serializers.ValidationError("Le commentaire ne peut pas être vide ou contenir uniquement des espaces.")
        return value.strip()
    
    def update(self, instance, validated_data):
        """
        Met à jour le besoin avec le commentaire et la date de traitement.
        """
        from django.utils import timezone
        
        instance.commentaire_directeur = validated_data['commentaire_directeur']
        instance.date_traitement_directeur = timezone.now()
        instance.save(update_fields=['commentaire_directeur', 'date_traitement_directeur'])
        return instance


class ModifierStatutSerializer(serializers.Serializer):
    """
    Sérialiseur pour modifier uniquement le statut d'un besoin.
    
    La date de traitement est automatiquement mise à jour si le statut
    passe à TRAITE ou REJETE.
    """
    
    statut = serializers.ChoiceField(
        choices=Besoin.StatutChoices.choices,
        required=True,
        error_messages={
            'required': 'Le statut est requis.',
            'invalid_choice': 'Statut invalide. Valeurs autorisées : NON_TRAITE, EN_COURS, TRAITE, REJETE.'
        }
    )
    
    def validate_statut(self, value):
        """Validation supplémentaire du statut."""
        instance = self.instance
        
        # Vérifier que le statut change vraiment
        if instance and instance.statut == value:
            raise serializers.ValidationError(f"Le besoin a déjà le statut '{instance.get_statut_display()}'.")
        
        # Double Validation : Un besoin ne peut être clôturé (TRAITE/REJETE) que si un commentaire est présent
        if value in [Besoin.StatutChoices.TRAITE, Besoin.StatutChoices.REJETE]:
            if not instance.commentaire_directeur:
                raise serializers.ValidationError("Un commentaire du directeur est obligatoire pour valider ou rejeter un besoin.")
        
        return value
    
    def update(self, instance, validated_data):
        """
        Met à jour le statut du besoin.
        
        Si le statut devient TRAITE ou REJETE, la date de traitement
        est automatiquement définie (logique dans le modèle).
        """
        instance.statut = validated_data['statut']
        instance.save(update_fields=['statut', 'date_traitement_directeur'])
        return instance

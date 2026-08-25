from rest_framework import serializers
from .models import (
    Patient, Adresse, Contact, Nationalite, 
    PersonneAPrevenir, LienParente
)

class AdresseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Adresse
        fields = ['id', 'pays', 'ville', 'quartier', 'rue', 'code_postal']

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'type', 'numero', 'patient', 'personne_a_prevenir']

class NationaliteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nationalite
        fields = ['id', 'libelle']

class LienParenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LienParente
        fields = ['id', 'patient', 'personne_a_prevenir', 'relation', 'relation_autre']

class PersonneAPrevenirSerializer(serializers.ModelSerializer):
    adresse = serializers.PrimaryKeyRelatedField(
        queryset=Adresse.objects.all(), required=False, allow_null=True
    )
    contacts = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Contact.objects.all(), required=False
    )
    relation = serializers.SerializerMethodField()

    class Meta:
        model = PersonneAPrevenir
        fields = ['id', 'nom', 'prenom', 'adresse', 'contacts', 'relation']

    def get_relation(self, instance):
        """Retourne la relation (lien de parenté) depuis la table pivot LienParente."""
        lien = instance.lienparente_set.first()
        return lien.relation if lien else None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['adresse'] = AdresseSerializer(instance.adresse).data if instance.adresse else None
        ret['contacts'] = ContactSerializer(instance.contacts.all(), many=True).data
        return ret

class PatientListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste — inclut contact et ville sans nested complet.
    """
    contact_principal = serializers.SerializerMethodField()
    ville = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'matricule', 'nom', 'prenom', 'sexe',
            'date_naissance', 'lieu_naissance', 'profession',
            'statut_matrimonial', 'courriel', 'numero_securite_sociale',
            'nombre_enfants', 'photo', 'created_at', 'updated_at',
            'contact_principal', 'ville',
        ]
        read_only_fields = ('id', 'matricule', 'created_at', 'updated_at')

    def get_contact_principal(self, obj):
        contact = obj.contacts.first()
        return contact.numero if contact else None

    def get_ville(self, obj):
        if obj.adresse_id and obj.adresse:
            return obj.adresse.ville
        return None

class PatientSerializer(serializers.ModelSerializer):
    """
    Serializer complet pour le Patient avec ses données satellites.
    Supporte l'écriture par ID (PK) et la lecture par objet imbriqué.
    """
    adresse = serializers.PrimaryKeyRelatedField(
        queryset=Adresse.objects.all(), required=False, allow_null=True
    )
    nationalites = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Nationalite.objects.all(), required=False
    )
    contacts = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Contact.objects.all(), required=False
    )
    personnes_a_prevenir = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PersonneAPrevenir.objects.all(), required=False
    )
    
    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ('id', 'matricule', 'created_at', 'updated_at')

    def to_representation(self, instance):
        """Surcharge pour retourner les objets complets en lecture."""
        ret = super().to_representation(instance)
        # Inclusion des données satellites détaillées
        ret['adresse'] = AdresseSerializer(instance.adresse).data if instance.adresse else None
        ret['nationalites'] = NationaliteSerializer(instance.nationalites.all(), many=True).data
        ret['contacts'] = ContactSerializer(instance.contacts.all(), many=True).data
        ret['personnes_a_prevenir'] = PersonneAPrevenirSerializer(instance.personnes_a_prevenir.all(), many=True).data
        return ret

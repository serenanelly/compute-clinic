from rest_framework import serializers

from .models import Tenant, TenantStatus


class TenantSerializer(serializers.ModelSerializer):
    """Représentation d'un tenant pour la lecture et la création.

    `id`, `status` et `created_at` sont en lecture seule à la création :
    le statut initial d'un tenant est toujours ACTIVE et son id est généré
    par le registre.
    """

    class Meta:
        model = Tenant
        fields = ['id', 'name', 'identifier', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class TenantStatusUpdateSerializer(serializers.Serializer):
    """Payload attendu par PATCH /tenants/{tenant_id}/status."""

    status = serializers.ChoiceField(choices=TenantStatus.choices)

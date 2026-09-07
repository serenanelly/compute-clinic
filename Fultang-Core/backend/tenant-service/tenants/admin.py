from django.contrib import admin

from .models import PlatformAdmin, PlatformService, Tenant, TenantDatabase


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'identifier', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'identifier')
    readonly_fields = ('id', 'created_at')


@admin.register(PlatformService)
class PlatformServiceAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('code', 'name')
    readonly_fields = ('created_at',)


@admin.register(TenantDatabase)
class TenantDatabaseAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'service', 'database_name', 'host', 'port', 'status')
    list_filter = ('status', 'service')
    search_fields = ('database_name', 'host', 'tenant__identifier')
    readonly_fields = ('id', 'created_at', 'updated_at')
    # secret_reference n'est jamais un credential, mais reste réservé à
    # l'admin Django (accès superuser uniquement) plutôt qu'à l'API grand public.


@admin.register(PlatformAdmin)
class PlatformAdminAdmin(admin.ModelAdmin):
    list_display = ('email', 'nom', 'prenom', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('email',)
    readonly_fields = ('id', 'created_at', 'password')  # hashé — jamais modifiable en clair depuis l'admin

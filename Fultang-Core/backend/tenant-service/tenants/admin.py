from django.contrib import admin

from .models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'identifier', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'identifier')
    readonly_fields = ('id', 'created_at')

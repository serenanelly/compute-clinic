from django.contrib import admin
from .models import (
    Consultation, Symptome, Diagnostic, MedicamentPrescrit,
    Examen, ResultatExamen,
    Hospitalisation, SoinAdministre, Visite
)

# ----------------------------------------------------------------
# INLINES (Pour une saisie groupée)
# ----------------------------------------------------------------

class SymptomeInline(admin.TabularInline):
    model = Symptome
    extra = 1

class DiagnosticInline(admin.TabularInline):
    model = Diagnostic
    extra = 1

class MedicamentPrescritInline(admin.TabularInline):
    model = MedicamentPrescrit
    extra = 1

class ResultatExamenInline(admin.StackedInline):
    model = ResultatExamen
    can_delete = False

# ----------------------------------------------------------------
# CONFIGURATIONS ADMIN
# ----------------------------------------------------------------

@admin.register(Visite)
class VisiteAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'date_heure', 'statut')
    list_filter = ('statut', 'date_heure')
    search_fields = ('patient__nom', 'patient__matricule')

@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'visite', 'date_heure', 'medecin_charge')
    list_filter = ('date_heure',)
    search_fields = ('patient__nom', 'patient__matricule', 'medecin_charge')
    inlines = [SymptomeInline, DiagnosticInline, MedicamentPrescritInline]

@admin.register(Examen)
class ExamenAdmin(admin.ModelAdmin):
    list_display = ('nom', 'consultation', 'statut')
    list_filter = ('statut',)
    inlines = [ResultatExamenInline]

@admin.register(Hospitalisation)
class HospitalisationAdmin(admin.ModelAdmin):
    list_display = ('patient', 'room_id', 'statut', 'doctor_id')
    list_filter = ('statut',)
    search_fields = ('patient__nom', 'room_id', 'doctor_id')

@admin.register(SoinAdministre)
class SoinAdministreAdmin(admin.ModelAdmin):
    list_display = ('nom', 'patient', 'type_soin', 'responsible_person_id')
    list_filter = ('type_soin',)
    search_fields = ('patient__nom', 'nom', 'responsible_person_id')

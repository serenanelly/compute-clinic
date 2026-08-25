"""
Permissions pour l'API comptabilite_matiere.

Toujours IsAuthenticated — l'authentification est gérée par la Gateway
qui injecte les headers X-User-ID / X-User-Roles.
"""
from rest_framework.permissions import IsAuthenticated


# Alias conservé pour la compatibilité des imports dans les views existantes
DevelopmentOrAuthenticated = IsAuthenticated

"""
tenant_routing — Dynamic Database Routing (Phase 6).

Sous-package regroupant tout le mécanisme permettant à service-personnel
d'utiliser une base PostgreSQL différente selon le tenant courant :

  - context.py         : Tenant Context (contextvar), établi par le
                          mécanisme d'authentification déjà présent.
  - registry_client.py : appel HTTP interne vers tenant-service pour
                          résoudre (tenant, service) → informations de
                          connexion (source de vérité : Tenant Registry).
  - cache.py            : cache TTL en mémoire du résultat de résolution,
                          pour éviter d'interroger le Registry à chaque
                          requête.
  - pool_registry.py    : enregistrement des connexions Django par
                          tenant (alias dynamique), verrouillage de la
                          création concurrente.
  - router.py            : le DATABASE_ROUTER Django lui-même.
  - middleware.py         : nettoyage du Tenant Context après chaque
                          requête (isolation stricte entre requêtes).

Voir MULTITENANT_ARCHITECTURE.md, section Phase 6, pour la documentation
complète des décisions et limites.
"""

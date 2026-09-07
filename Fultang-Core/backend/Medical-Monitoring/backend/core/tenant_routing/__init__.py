"""
tenant_routing — Dynamic Database Routing pour Medical-Monitoring.

Copie adaptée de `service-personnel/service_personnel/api/tenant_routing`
(Phase 6/7 de l'architecture multitenant FullTang) — même patron déjà
établi dans ce projet pour du code transverse dupliqué-adapté par
service (ex: `GatewayHeaderAuthentication`, présente indépendamment dans
6 services). Aucune bibliothèque partagée n'existe entre les projets
Django de ce monorepo : dupliquer-adapter est le choix délibéré,
documenté, pas un oubli de factorisation.

Sous-package :
  - context.py         : Tenant Context (contextvar), établi par le
                          mécanisme d'authentification déjà présent —
                          contenu IDENTIQUE à service-personnel (aucune
                          logique spécifique au service).
  - registry_client.py : appel HTTP interne vers tenant-service pour
                          résoudre (tenant, service=MEDICAL) → infos de
                          connexion. SERVICE_CODE="MEDICAL" est la seule
                          différence de fond avec service-personnel.
  - cache.py            : cache TTL en mémoire — contenu IDENTIQUE.
  - pool_registry.py    : alias de connexion par tenant + provisioning
                          physique. Adapté : `_alias_for` produit un
                          suffixe `_medical`, et le provisioning migre
                          les 3 apps tenant-scopées de ce service
                          (patient, medical_workflow, patient_informations)
                          au lieu d'une seule.
  - router.py           : le DATABASE_ROUTER Django. Adapté :
                          TENANT_SCOPED_APPS = {patient, medical_workflow,
                          patient_informations} au lieu de {api}.
  - middleware.py       : nettoyage du Tenant Context après chaque
                          requête — contenu IDENTIQUE.

Voir MULTITENANT_ARCHITECTURE.md pour la documentation complète des
décisions et limites de ce mécanisme.
"""

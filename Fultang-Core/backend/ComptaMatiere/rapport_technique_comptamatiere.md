# Rapport Technique : API de Gestion de la Comptabilité Matière (Hôpital Fultang)

## 1. IMPLÉMENTATION

### Technologies utilisées
L'API a été conçue avec une pile technologique moderne et robuste, garantissant la sécurité et l'extensibilité du système :
- **Langage de programmation** : **Python 3.12+**, choisi pour sa syntaxe claire et sa puissance dans le traitement des données.
- **Framework** : **Django 4.2+** avec **Django REST Framework (DRF)**.
- **Base de données** : **PostgreSQL**, sélectionné pour sa gestion avancée des types de données et sa conformité ACID.
- **Outils** : Git, Postman, Pip, SimpleJWT.

### Architecture du système
L'API suit une architecture **multicouche (Layered Architecture)** :
- **Models** : Structure des données et contraintes d'intégrité.
- **Serializers** : Transformation JSON et validation des données.
- **Views (ViewSets)** : Logique de traitement et orchestration.
- **Routes (URLConf)** : Points d'entrée de l'API (/api/compta_matiere/...).

### Modules développés
- **Gestion du Catalogue** : Matériels médicaux et durables.
- **Flux de Stock** : Automatisation des entrées (Livraisons) et sorties.
- **Gestion des Demandes** : Cycle de vie des besoins (Non traité, En cours, Traité).
- **Reporting** : Rapports et archivage des inventaires.

### Choix techniques
- **Django/DRF** : Sécurité intégrée (protection contre injection SQL, CSRF) et gain de productivité.
- **PostgreSQL** : Fiabilité transactionnelle pour les données de stock.
- **JWT (JSON Web Token)** : Standard moderne pour l'authentification Stateless, idéal pour les SPA (Single Page Applications).

---

## 2. TESTS

### Types de tests réalisés
- **Tests unitaires** : Validation des modèles et calculs internes (marge, statuts).
- **Tests d'intégration** : Vérification de la propagation des mouvements (Ligne Livraison -> Stock Materiel).
- **Tests fonctionnels** : Validation des codes HTTP et de l'authentification.

### Outils utilisés
- **Django TestCase** : Environnement de test isolé avec base de données en mémoire.
- **APITestCase** : Simulation de requêtes client vers les endpoints.

### Scénarios de test
- **Nominal** : Saisie d'une livraison standard (+100 au stock).
- **Erreur** : Tentative de sortie supérieure au stock disponible (Erreur 400).
- **Limite** : Mise à jour d'une ligne de livraison existante (ajustement différentiel du stock).

### Résultats obtenus
| N° | Fonctionnalité | Type de test | Outil | Résultat | Observations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Création Matériel | Unitaire | TestCase | ✅ Succès | Intégrité validée |
| 2 | Flux Livraison | Intégration | TestCase | ✅ Succès | Stock auto-incrémenté |
| 3 | Flux Sortie | Intégration | TestCase | ✅ Succès | Stock auto-décrémenté |
| 4 | Sécurité Stock | Fonctionnel | TestCase | ✅ Succès | Blocage si stock < 0 |
| 5 | Auth JWT | Intégration | APITestCase | ✅ Succès | Protection des routes |
| 6 | API Endpoints | Fonctionnel | APITestCase | ✅ Succès | Codes 200/201 validés |

---
*Fait le 01 Mai 2026*

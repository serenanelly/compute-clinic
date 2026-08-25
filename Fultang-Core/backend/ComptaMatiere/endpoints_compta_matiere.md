# Fin des Endpoints de la Comptabilité Matière (Ancien Backend)

Ce document recense tous les endpoints de l'application `comptabilite_matiere` extraits du backend principal (`fultang-backend`). Tous les chemins ci-dessous sont préfixés par `/api/`.

## Résumé des Ressources

| Préfixe | Modèle | Actions Personnalisées |
| :--- | :--- | :--- |
| `besoins/` | Besoin | `ajouter_commentaire` (POST), `modifier_statut` (PATCH), `mes_besoins` (GET), `par_statut` (GET) |
| `lignes-besoin/` | LigneBesoin | Standard CRUD |
| `materiels/` | Materiel | `stock_faible` (GET) |
| `materiels-medicaux/` | MaterielMedical | `par_categorie` (GET), `stock_faible` (GET) |
| `materiels-durables/` | MaterielDurable | `mettre_en_reparation` (POST), `remettre_en_service` (POST), `en_reparation` (GET), `par_localisation` (GET) |
| `livraisons/` | Livraison | `par_fournisseur` (GET), `statistiques` (GET) |
| `sorties/` | Sortie | `par_motif` (GET), `mes_sorties` (GET), `statistiques` (GET) |
| `lignes-sortie/` | LigneSortie | Standard CRUD |
| `archives-inventaire/` | ArchiveInventaire | `terminer` (POST), `ancien_stock` (GET), `nouveau_stock` (GET), `differences` (GET), `recent` (GET) |
| `lignes-archive/` | LigneArchiveInventaire | `batch_update` (PUT) |
| `rapports/` | Rapport | `mark-read` (POST), `sent` (GET), `received` (GET), `received/unread` (GET) |
| `pieces-jointes/` | PieceJointeRapport | Standard CRUD |
| `lignes-livraison/` | LigneLivraison | Standard CRUD |

---

## Détails des Endpoints par Ressource

### 1. Besoins (`besoins/`)
- `GET /api/besoins/` : Liste tous les besoins
- `POST /api/besoins/` : Créer un nouveau besoin
- `GET /api/besoins/{id}/` : Détails d'un besoin
- `PUT /api/besoins/{id}/` : Mise à jour complète
- `PATCH /api/besoins/{id}/` : Mise à jour partielle
- `DELETE /api/besoins/{id}/` : Supprimer un besoin
- `POST /api/besoins/{id}/ajouter_commentaire/` : Ajouter le commentaire du directeur
- `PATCH /api/besoins/{id}/modifier_statut/` : Modifier le statut (NON_TRAITE, EN_COURS, TRAITE, REJETE)
- `GET /api/besoins/mes_besoins/` : Besoins de l'utilisateur connecté
- `GET /api/besoins/par_statut/` : Groupement par statut

### 2. Matériels Médicaux (`materiels-medicaux/`)
- `GET /api/materiels-medicaux/` : Liste tous les matériels médicaux
- `GET /api/materiels-medicaux/par_categorie/` : Groupement par catégorie
- `GET /api/materiels-medicaux/stock_faible/` : Matériels avec stock < 20

### 3. Matériels Durables (`materiels-durables/`)
- `GET /api/materiels-durables/` : Liste tous les matériels durables
- `POST /api/materiels-durables/{id}/mettre_en_reparation/` : Change l'état en "En réparation"
- `POST /api/materiels-durables/{id}/remettre_en_service/` : Change l'état en "Bon état"
- `GET /api/materiels-durables/en_reparation/` : Liste des matériels en réparation
- `GET /api/materiels-durables/par_localisation/` : Groupement par salle/localisation

### 4. Livraisons (`livraisons/`)
- `GET /api/livraisons/` : Liste des livraisons
- `GET /api/livraisons/par_fournisseur/` : Groupement par fournisseur
- `GET /api/livraisons/statistiques/` : Somme montants, nombre total, moyenne

### 5. Sorties (`sorties/`)
- `GET /api/sorties/` : Liste des sorties
- `GET /api/sorties/par_motif/` : Groupement par motif (CONSOMMATION, PERTE, CASSE, REBUT, DON)
- `GET /api/sorties/mes_sorties/` : Sorties effectuées par l'utilisateur
- `GET /api/sorties/statistiques/` : Stats par motif

### 6. Archives d'Inventaire (`archives-inventaire/`)
- `GET /api/archives-inventaire/` : Liste des inventaires
- `POST /api/archives-inventaire/{id}/terminer/` : Clôturer l'inventaire et calculer les différences
- `GET /api/archives-inventaire/{id}/ancien_stock/` : État du stock au début
- `GET /api/archives-inventaire/{id}/nouveau_stock/` : État du stock saisi
- `GET /api/archives-inventaire/{id}/differences/` : Écarts constatés
- `GET /api/archives-inventaire/recent/` : 10 dernières archives

### 7. Rapports (`rapports/`)
- `GET /api/rapports/` : Liste des rapports
- `POST /api/rapports/{id}/mark-read/` : Marquer comme lu
- `GET /api/rapports/sent/` : Rapports envoyés
- `GET /api/rapports/received/` : Rapports reçus
- `GET /api/rapports/received/unread/` : Rapports reçus non lus

### 8. Autres (Standard CRUD)
- `lignes-besoin/`
- `lignes-sortie/`
- `lignes-livraison/`
- `lignes-archive/` (avec `PUT batch_update/`)
- `pieces-jointes/`
- `materiels/` (Base commune)

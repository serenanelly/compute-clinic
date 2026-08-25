# Scénarios de Test - Traitements (Phase 2.6)

Ce document décrit les cas de test pour le recueil des traitements en cours, liés obligatoirement à une maladie.

**Endpoint ciblé :** `POST /api/medical-monitoring/patient/traitements/`

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **TRT_VAL_1** | **Traitement valide** | Enregistrement d'un médicament lié à une maladie existante. |
| **TRT_ERR_1** | **Maladie manquante** | Rejet (400) si le champ `maladie` est absent ou invalide. |
| **TRT_VAL_2** | **Accès via Dossier** | Un patient peut voir ses traitements regroupés sous chaque maladie dans son dossier. |

## Scénarios de Test

### SC_TRT_01 : Traitement Mbarga (Amlodipine)
1. Créer un patient.
2. Créer une maladie "Hypertension artérielle" pour ce patient.
3. Envoyer un POST au point `traitements` :
    - `maladie`: ID_MALADIE
    - `nom_medicament`: "Amlodipine"
    - `type`: "Oral"
    - `posologie`: "5mg par jour"
4. Vérifier code 201.

### SC_TRT_02 : Rejet sans maladie
1. Envoyer un POST sans l'ID de la maladie.
2. Vérifier code 400 (Field mandatory).

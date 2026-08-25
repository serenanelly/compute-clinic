# Scénarios de Test - Liens de Parenté (Phase 1.4)

Ce document décrit les cas de test pour l'établissement de liens entre un patient et ses contacts d'urgence via l'API `liens-parente/`.

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **LNK_VAL_1** | **Relation standard** | Création valide avec un type prédéfini (ex: CONJOINT). |
| **LNK_VAL_2** | **Relation personnalisée** | Utilisation du type `AUTRE` avec une précision dans `relation_autre`. |
| **LNK_ERR_1** | **Doublon de lien** | Tentative de créer un lien entre le même patient et la même personne. Rejet (400). |
| **LNK_ERR_2** | **Données obligatoires** | Rejet (400) si le patient ou la personne à prévenir sont manquants. |
| **LNK_ERR_3** | **IDs inexistants** | Rejet (400) si l'UUID du patient ou de la personne est erroné. |

## Scénarios de Test

### SC_EMER_01 : Flux Nominal Mbarga (Lien Conjoint)
1. Créer un patient.
2. Créer une personne à prévenir (Mme Solange Mbarga).
3. Créer un lien de parenté entre les deux avec la relation `CONJOINT`.
4. Vérifier que le lien est bien créé et qu'il apparaît dans le dossier du patient.

### SC_EMER_02 : Gestion des doublons
1. Tenter de recréer exactement le même lien que dans SC_EMER_01.
2. Vérifier que l'API renvoie une erreur 400.

### SC_EMER_03 : Précision "Autre"
1. Créer un lien avec `relation="AUTRE"` et `relation_autre="Voisin"`.
2. Vérifier que la précision est enregistrée.

### SC_EMER_04 : Détails complets du contact d'urgence
1. Créer une adresse.
2. Créer un contact (Téléphone).
3. Créer une personne à prévenir en lui liant l'adresse et le contact.
4. Vérifier que `GET /personnes-a-prevenir/{id}/` renvoie les détails complets.

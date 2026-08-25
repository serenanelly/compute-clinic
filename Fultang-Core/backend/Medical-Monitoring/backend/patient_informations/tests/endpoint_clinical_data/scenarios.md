# Scénarios de Test - Enregistrement des données cliniques de base

Ce document décrit les cas de test pour le recueil initial des constantes vitales et caractéristiques sanguines du patient, généralement effectué par l'infirmière.

**Endpoint ciblé :** `POST /api/medical-monitoring/patient/clinique/`

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **CLIN_VAL_1** | **Données valides (1ère fois)** | Les données cliniques sont attachées au patient et renvoyées dans le dossier avec succès (201). |
| **CLIN_ERR_1** | **Contrainte d'unicité (Doublon)** | Tenter de recréer une deuxième fiche clinique avec `POST` pour le même patient doit renvoyer une erreur explicite ou être rejeté à cause du OneToOneField. (Remplacement ou Patch recommandé). |
| **CLIN_ERR_2** | **Validation Choix** | Soumettre un groupe sanguin ou facteur rhésus hors des choix définis (ex: `groupe_sanguin: Z`) doit renvoyer une erreur `400 Bad Request`. |

## Scénarios de Test

### SC_CLIN_01 : Flux Nominal (Mbarga)
1. Créer un patient Mbarga (ou simuler son existence).
2. Vérifier que son dossier indique `"donnees_cliniques": null`.
3. Envoyer le payload de constantes avec son ID.
4. Vérifier que la réponse est 201.
5. Vérifier que le prochain appel au dossier renvoie bien ce bloc de constantes.

### SC_CLIN_02 : Doublon de création
1. Reprendre SC_CLIN_01.
2. Refaire un POST avec des données différentes.
3. Obtenir un code 400 lié à l'unicité (Un patient ne doit avoir qu'une structurer *DonneesCliniques*).

### SC_CLIN_03 : Rejet sur mauvaises valeurs
1. POST des données cliniques avec `groupe_sanguin = "X"` ou `facteur_rhesus = "INCONNU"`.
2. L'API doit retourner des erreurs de validation sur ces champs.

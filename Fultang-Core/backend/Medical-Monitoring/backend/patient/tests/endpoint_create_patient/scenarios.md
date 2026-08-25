# Scénarios de Test - Endpoint Création Patient

**Endpoint :** `POST /api/medical-monitoring/patients/`

Ce document définit les cas de test basés sur les classes d'équivalences pour la création d'un nouveau patient.

## Classes d'équivalences

### 1. Succès (Données Valides)
| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **VAL_1** | **Données minimales** | Création réussie avec uniquement les champs obligatoires. |
| **VAL_2** | **Données complètes** | Création réussie avec tous les champs (requis + optionnels). |
| **VAL_3** | **Limites de caractères** | Acceptation des chaînes de 100 caractères pour le nom/prénom. |

### 2. Erreurs de Validation (Code 400)
| ID | Classe d'équivalence | Erreur attendue |
| :--- | :--- | :--- |
| **ERR_1** | **Champs obligatoires manquants** | Rejet si `nom`, `sexe`, `date_naissance`, etc. sont absents. |
| **ERR_2** | **Format Date invalide** | Rejet si `date_naissance` n'est pas au format `AAAA-MM-JJ`. |
| **ERR_3** | **Format Email invalide** | Rejet si `courriel` est mal formé. |
| **ERR_4** | **Choix invalide** | Rejet si `sexe` ou `statut_matrimonial` ne sont pas dans la liste autorisée. |
| **ERR_5** | **Longueur excessive** | Rejet si le `nom` dépasse 100 caractères. |
| **ERR_6** | **Type de donnée erroné** | Rejet si `nombre_enfants` n'est pas un entier. |
| **ERR_7** | **Entier négatif** | Rejet si `nombre_enfants` < 0. |

### 3. Conflits d'Unicité (Code 400)
| ID | Classe d'équivalence | Erreur attendue |
| :--- | :--- | :--- |
| **CON_1** | **Doublon Sécurité Sociale** | Rejet si le `numero_securite_sociale` existe déjà. |

> [!NOTE]
> Le champ `matricule` est maintenant auto-généré et en lecture seule; il n'est donc pas inclus dans les cas de test d'erreur de saisie.

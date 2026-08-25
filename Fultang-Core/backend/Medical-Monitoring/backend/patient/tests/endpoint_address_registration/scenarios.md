# Scénarios de Test - Enregistrement et Liaison d'Adresse

Ce document décrit les cas de test pour la création d'adresses et leur association aux dossiers patients.

## Classes d'équivalences

### 1. Création d'Adresse (POST /adresses/)
| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **ADR_VAL_1** | **Minimaliste** | Succès (201). La ville et le quartier sont requis. Le pays devient "Cameroun" par défaut. |
| **ADR_VAL_2** | **Données complètes** | Succès (201). Tous les champs (rue, code postal, pays personnalisé) sont enregistrés. |
| **ADR_ERR_1** | **Champs obligatoires manquants** | Rejet (400) si la ville ou le quartier manquent. |
| **ADR_ERR_2** | **Dépassement de longueur** | Rejet (400) si la ville dépasse 100 caractères. |

### 2. Liaison au Patient (PATCH /patients/{id}/)
| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **LNK_VAL_1** | **Liaison valide** | Succès (200). Le patient pointe désormais vers l'ID de l'adresse créée. |
| **LNK_ERR_1** | **Adresse inexistante** | Rejet (400) si l'UUID de l'adresse fournie n'existe pas en base. |

## Scénarios de Test

### SC_ADDR_01 : Flux Nominal (Flux Mbarga)
1. Créer un patient.
2. Créer une adresse.
3. Lier l'adresse au patient.
4. Vérifier que `GET /patients/{id}/` (ou le dossier) contient bien l'objet adresse complet.

### SC_ADDR_02 : Erreurs de validation
1. Tenter de créer une adresse sans les champs requis.
2. Tenter de lier une adresse imaginaire (UUID aléatoire) à un patient.

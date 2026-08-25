# Scénarios de Test - Automatisation du Matricule Patient

Ce document décrit les cas de test pour l'auto-génération du matricule au format `YYFNNNN` et l'endpoint de récupération du prochain matricule.

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **MAT_1** | **Premier matricule de l'année** | Si aucun patient n'existe pour l'année en cours (ex: 2026), le matricule généré doit être `26F0000`. |
| **MAT_2** | **Incrémentation séquentielle** | Si le dernier matricule est `26F0010`, le prochain doit être `26F0011`. |
| **MAT_3** | **Ignorer le matricule fourni lors du POST** | Si un matricule est fourni dans le corps du POST, il doit être ignoré au profit de l'auto-génération. |
| **MAT_4** | **Endpoint de consultation** | L'endpoint `/prochain-matricule/` doit retourner la même valeur que celle qui serait générée lors d'une création immédiate. |
| **MAT_5** | **Robustesse (Format altéré)** | Si un matricule manuel mal formé existe (ex: `26FABC`), le système doit pouvoir repartir sur une base saine ou ignorer l'erreur. |

## Scénarios de Test

### SC_MAT_01 : Génération lors de la création (POST)
1. Appeler `POST /api/medical-monitoring/patients/` sans le champ `matricule`.
2. Vérifier que la réponse (201) contient un `matricule` au format `YYF0000`.

### SC_MAT_02 : Vérification de l'incrémentation
1. Créer un premier patient.
2. Créer un second patient.
3. Vérifier que le second matricule est l'incrément exact du premier.

### SC_MAT_03 : Consultation du prochain matricule
1. Appeler `GET /api/medical-monitoring/patients/prochain-matricule/`.
2. Vérifier la valeur retournée.
3. Créer un patient.
4. Rappeler l'endpoint et vérifier que la valeur a été incrémentée.

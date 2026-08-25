# Scénarios de Test - Antécédents (Phase 2.4 / 2.5)

Ce document décrit les cas de test pour le recueil des antécédents médicaux et familiaux.

**Endpoint ciblé :** `POST /api/medical-monitoring/patient/antecedents/`

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **ANT_VAL_1** | **Antécédent Familial** | Enregistrement valide d'un antécédent lié à un membre de la famille. |
| **ANT_VAL_2** | **Antécédent Médical** | Enregistrement valide d'un antécédent médical personnel. |
| **ANT_VAL_3** | **Enregistrement Multiple** | Un patient peut avoir plusieurs antécédents de types différents. |
| **ANT_ERR_1** | **Données obligatoires** | Rejet (400) si le nom, le type ou la date sont manquants. |

## Scénarios de Test

### SC_ANT_01 : Recueil complet Mbarga (Familial)
1. Créer un patient (ou simuler existence).
2. Envoyer un POST : type `FAMILIAL`, nom `Infarctus du myocarde`, date `2000-01-01`.
3. Vérifier code 201.

### SC_ANT_02 : Recueil complet Mbarga (Médical)
1. Envoyer un POST : type `MEDICAL`, nom `Hypertension artérielle`, date `2023-06-15`.
2. Vérifier code 201.

### SC_ANT_03 : Consultation via Dossier Médical
1. Appeler l'endpoint `GET /api/medical-monitoring/patients/{id}/dossier/`.
2. Vérifier que la liste `antecedents` contient les 2 entrées créées ci-dessus.

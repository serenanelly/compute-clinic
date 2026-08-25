# Scénarios de Test - Récupération de l'identité du patient

L'objectif de cet ensemble de tests est de s'assurer de l'étanchéité des données sur le point de terminaison de consultation de l'identité d'un patient. 
Il vérifie que les données purement administratives sont renvoyées et que les données médicales confidentielles sont bloquées sur cet endpoint.

**Endpoint testé :** `GET /api/medical-monitoring/patients/{id}/`

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **GET_ID_1** | **Présence de données identitaires** | La réponse doit contenir correctement l'adresse et les contacts du patient de manière imbriquée. |
| **GET_ID_2** | **Absence stricte de données médicales** | Si un patient a des maladies, des allergies ou des données cliniques enregistrées, la requête ne doit retourner *aucune* de ces clés dans son dictionnaire JSON. |

## Scénarios de Test

### SC_GET_ID_01 : Isolation des données médicales
1. Créer un patient avec des données de contact et son adresse.
2. Lui assigner délibérément des données médicales (ex: une Allergie via `Allergie.objects.create(...)`).
3. Appeler le point de terminaison `GET /api/medical-monitoring/patients/{id}/`.
4. Vérifier que la clé `"adresse"` existe.
5. Vérifier que la clé `"allergies"` n'existe pas.
6. Comparer éventuellement cette isolation avec le point de terminaison complet `/dossier/`.

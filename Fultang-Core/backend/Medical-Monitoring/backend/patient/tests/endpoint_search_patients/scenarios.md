# Scénarios de Test - Endpoint Recherche Patient

**Endpoint :** `GET /api/medical-monitoring/patients/?search={query}`

L'objectif de cet ensemble de tests est de vérifier la robustesse et l'exactitude de l'endpoint de recherche de patients. Les tests sont classés par scénarios correspondant aux différentes classes d'équivalences.

## Classes d'équivalences et Scénarios

| ID Scénario | Classe d'équivalence (Cas à tester) | Résultat attendu                                                                                 |
| :--- | :--- | :--- |
| **CE_1**    | Chaîne vide ou paramètre absent                       | Doit retourner tous les patients paginés (pas de filtrage).                                          |
| **CE_2**    | Correspondance exacte sur le NOM                      | Doit retourner le patient dont le nom correspond (insensible à la casse).                            |
| **CE_3**    | Correspondance exacte ou partielle sur le PRÉNOM      | Doit retourner le patient dont le prénom contient la chaîne.                                         |
| **CE_4**    | Correspondance exacte sur le MATRICULE                | Doit retourner le patient unique correspondant à ce matricule.                                       |
| **CE_5**    | Correspondance croisée sur champs multiples           | (Ex: "nom_patient prenom") Le système DRF sépare les termes et cherche une intersection sur les champs. |
| **CE_6**    | Correspondance stricte partielle                      | (Ex: "Mbar" pour "Mbarga") Doit trouver la correspondance via la fonction `icontains`.             |
| **CE_7**    | Requête sans résultat (Absurdité)                     | Doit retourner une liste vide `[]` sans générer d'erreur serveur (Code HTTP 200).                    |
| **CE_8**    | Caractères spéciaux et encodage                       | (Ex: "Jean-Claude" ou "René") Doit gérer correctement l'encodage URL et l'UTF-8.                   |

Ces scénarios sont implémentés dans le fichier `test_search_patients.py`.

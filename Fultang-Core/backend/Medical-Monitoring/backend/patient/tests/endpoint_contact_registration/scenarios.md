# Scénarios de Test - Enregistrement des Contacts

Ce document décrit les cas de test pour l'ajout de moyens de contact (Téléphone, WhatsApp) aux patients.

## Classes d'équivalences

| ID | Classe d'équivalence | Comportement attendu |
| :--- | :--- | :--- |
| **CON_VAL_1** | **Contact unique** | Création et liaison d'un numéro de téléphone à un patient. |
| **CON_VAL_2** | **Contacts multiples** | Liaison de plusieurs types de contacts (WhatsApp + Téléphone) à un même patient. |
| **CON_ERR_1** | **Format de type** | Rejet si le type n'est pas autorisé (ex: "EMAIL" dans ce champ spécifique). |
| **CON_ERR_2** | **Numéro manquant** | Rejet (400) si le champ `numero` est absent. |

## Scénarios de Test

### SC_CON_01 : Ajout multi-contacts Patient
1. Créer un patient.
2. Créer un contact 1 (Type: TELEPHONE).
3. Créer un contact 2 (Type: WHATSAPP).
4. Lier les deux contacts au patient (soit via le champ `patient` du contact, soit via le champ `contacts` du patient).
5. Vérifier que le dossier du patient contient les deux numéros.

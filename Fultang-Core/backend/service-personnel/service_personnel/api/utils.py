"""
utils.py — Petits utilitaires partagés du module `api`, sans dépendance
circulaire entre `serializers.py` et `views.py`.
"""
import random


def generate_temporary_password():
    """
    Mot de passe temporaire — même style que celui déjà utilisé par
    `reset_password` (views.py) et par la création du compte administrateur
    initial d'un tenant (`CreateFirstAdminView`) : un seul mécanisme de
    génération de mot de passe temporaire dans tout ce service, jamais
    dupliqué avec une logique différente.
    """
    return "Fultang@" + str(random.randint(100, 999))

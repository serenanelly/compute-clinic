from .settings import *

# Utiliser SQLite en mémoire pour les tests pour éviter les problèmes de droits Postgres
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Désactiver les middlewares inutiles pour accélérer les tests si besoin
# MIDDLEWARE = [m for m in MIDDLEWARE if 'corsheaders' not in m]

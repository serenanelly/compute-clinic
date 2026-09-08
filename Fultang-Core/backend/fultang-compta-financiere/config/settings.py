"""
Configuration Django pour le Service Comptabilité Financière.
Polyclinique Fultang — Architecture Microservices.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

# En production/derrière Gateway on autorise tout, en dev local on filtre
if os.getenv('RUNNING_BEHIND_GATEWAY', 'True') == 'True' or os.getenv('DB_HOST') == 'postgres' or os.getenv('DB_HOST') == 'compta-financiere-db':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0').split(',')

# ====== APPLICATIONS ======
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'django_filters',
    'corsheaders',
    'drf_spectacular',
    # Nos apps
    'apps.comptabilite',
    'apps.caisse',
    'apps.sorties',
    'apps.messaging.apps.MessagingConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # DOIT rester en DERNIER : englobe tout le cycle de la requête, y
    # compris l'authentification DRF (qui a lieu pendant get_response),
    # pour garantir qu'un Tenant Context établi pendant une requête ne
    # survit jamais jusqu'à la requête suivante traitée par le même
    # thread (voir config/tenant_routing/middleware.py).
    'config.tenant_routing.middleware.TenantContextCleanupMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ====== BASE DE DONNÉES ======
if os.getenv('DB_NAME'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ====== TENANT ROUTING (Database per Tenant per Service) ======
# `default` reste la base historique partagée — sert exclusivement le
# "pool non assigné" (tenant_id=None, voir config/tenant_routing/context.py)
# et les tables système de ce service (auth, admin, sessions,
# contenttypes). Chaque tenant réel obtient une base PostgreSQL séparée,
# créée à la demande sur CE MÊME serveur PostgreSQL (voir
# config/tenant_routing/pool_registry.py). `default` n'est jamais
# modifiée/réinitialisée par ce mécanisme.
DATABASE_ROUTERS = ['config.tenant_routing.router.TenantDatabaseRouter']

TENANT_SERVICE_URL = os.getenv('TENANT_SERVICE_URL', 'http://fultang-tenant-web:8000')
TENANT_SERVICE_INTERNAL_TOKEN = os.getenv('TENANT_SERVICE_INTERNAL_TOKEN', '')
TENANT_SERVICE_TIMEOUT_SECONDS = int(os.getenv('TENANT_SERVICE_TIMEOUT_SECONDS', '5'))
TENANT_DB_CACHE_TTL_SECONDS = int(os.getenv('TENANT_DB_CACHE_TTL_SECONDS', '300'))
TENANT_DB_CONN_MAX_AGE = int(os.getenv('TENANT_DB_CONN_MAX_AGE', '60'))
TENANT_DB_USER = os.getenv('TENANT_DB_USER', os.getenv('DB_USER', 'fultang_user'))
TENANT_DB_PASSWORD = os.getenv('TENANT_DB_PASSWORD', os.getenv('DB_PASSWORD', ''))

# ====== VALIDATION MOT DE PASSE ======
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

# ====== INTERNATIONALISATION ======
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Douala'
USE_I18N = True
USE_TZ = True

# ====== FICHIERS STATIQUES ======
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ====== DJANGO REST FRAMEWORK ======
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# Détecter si on utilise l'authentification par confiance API Gateway
if os.getenv('RUNNING_BEHIND_GATEWAY', 'True') == 'True' or os.getenv('DB_HOST') == 'compta-financiere-db':
    REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] = [
        'rest_framework.permissions.IsAuthenticated',
    ]
    REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = [
        'config.authentication.GatewayHeaderAuthentication',
    ]
else:
    REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] = [
        'rest_framework.permissions.AllowAny',  # En dev local — à restreindre en prod
    ]
    REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ]

# ====== JWT ======
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Secret partagé avec l'API Gateway (décode Bearer si X-User-ID absent)
GATEWAY_JWT_SECRET = os.getenv(
    'GATEWAY_JWT_SECRET',
    'supersecretkey_change_me_in_production',
)

# ====== DRF SPECTACULAR (Swagger) ======
SPECTACULAR_SETTINGS = {
    'TITLE': 'API Comptabilité Financière — Fultang',
    'DESCRIPTION': 'Service de comptabilité financière de la Polyclinique Fultang. '
                   'Gère la caisse, la comptabilité OHADA et les sorties (dépenses).',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

if os.getenv('RUNNING_BEHIND_GATEWAY', 'True') == 'True' or os.getenv('DB_HOST') == 'compta-financiere-db':
    SPECTACULAR_SETTINGS['SERVERS'] = [
        {
            'url': 'http://localhost:8080/compta-financiere',
            'description': 'API Gateway',
        },
    ]
    SPECTACULAR_SETTINGS['SECURITY'] = [{'BearerAuth': []}]
    SPECTACULAR_SETTINGS['SECURITY_DEFINITIONS'] = {
        'BearerAuth': {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }
    }

# ====== CORS ======
CORS_ALLOW_ALL_ORIGINS = DEBUG
if not DEBUG:
    CORS_ALLOWED_ORIGINS = os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:9000,http://127.0.0.1:9000',
    ).split(',')

# ====== KAFKA ======
USE_KAFKA = os.getenv('USE_KAFKA', 'False') == 'True'
KAFKA_BROKER_URL = os.getenv('KAFKA_BROKER_URL', 'fultang-kafka:9092')
KAFKA_CONSUMER_GROUP = os.getenv('KAFKA_CONSUMER_GROUP', 'compta-financiere-group')
KAFKA_TOPICS_PRODUCE = ['quittance.validee', 'caisse.fermee', 'ordre_paiement.execute']
KAFKA_TOPICS_CONSUME = ['patient.cree', 'quittance.validee', 'caisse.fermee', 'ordre_paiement.execute']

# ====== INTÉGRATION SERVICES ======
SERVICE_MEDICAL_URL = os.getenv('SERVICE_MEDICAL_URL', 'http://fultang-medical-backend:8000')
MEDICAL_GATEWAY_URL = os.getenv('MEDICAL_GATEWAY_URL', 'http://api-gateway:8080/medical')

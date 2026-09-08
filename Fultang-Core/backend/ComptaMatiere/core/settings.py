import os
from pathlib import Path
import environ

# Initialize environment variables
env = environ.Env(
    DJANGO_DEBUG=(bool, True)
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Read .env file
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('DJANGO_SECRET_KEY', default='django-insecure-default-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DJANGO_DEBUG')

ALLOWED_HOSTS = ['*']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    'django_filters',
    'drf_spectacular',

    # Local apps
    'apps.comptabilite_matiere',
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
    # Doit rester DERNIER : englobe tout le cycle de requête, y compris
    # l'authentification DRF qui établit le Tenant Context pendant
    # get_response (voir core/tenant_routing/middleware.py).
    'core.tenant_routing.middleware.TenantContextCleanupMiddleware',
]

ROOT_URLCONF = 'core.urls'

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

WSGI_APPLICATION = 'core.wsgi.application'

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
DATABASES = {
    'default': env.db('DATABASE_URL', default='postgres://{user}:{password}@{host}:{port}/{name}'.format(
        user=env('DB_USER'),
        password=env('DB_PASSWORD'),
        host=env('DB_HOST'),
        port=env('DB_PORT'),
        name=env('DB_NAME')
    ))
}

# ============================================================
# TENANT ROUTING (Database per Tenant per Service)
# ============================================================
# Même patron que service-personnel et Medical-Monitoring (voir
# core/tenant_routing/) : le Router n'active le routage par tenant QUE
# pour l'app métier (comptabilite_matiere) — 'default' (ci-dessus)
# continue de servir les apps système (auth, admin, sessions) ET tout
# tenant "pool non assigné" (tenant_id=None).
DATABASE_ROUTERS = ['core.tenant_routing.router.TenantDatabaseRouter']

# URL/jeton du Tenant Registry — mêmes noms de variables que
# service-personnel, Medical-Monitoring et tenant-service, même jeton
# partagé.
TENANT_SERVICE_URL = env('TENANT_SERVICE_URL', default='http://fultang-tenant-web:8000')
TENANT_SERVICE_INTERNAL_TOKEN = env('TENANT_SERVICE_INTERNAL_TOKEN', default='')
TENANT_SERVICE_TIMEOUT_SECONDS = env.int('TENANT_SERVICE_TIMEOUT_SECONDS', default=5)

# Cache TTL du mapping tenant → base (voir tenant_routing/cache.py).
TENANT_DB_CACHE_TTL_SECONDS = env.int('TENANT_DB_CACHE_TTL_SECONDS', default=300)

# "Pool" de connexion (CONN_MAX_AGE — voir tenant_routing/pool_registry.py
# pour l'explication honnête de ce que Django appelle réellement un pool).
TENANT_DB_CONN_MAX_AGE = env.int('TENANT_DB_CONN_MAX_AGE', default=60)

# Credentials PostgreSQL pour TOUTES les bases tenant de ce service dans
# cette phase (compte partagé, pas de Secret Manager — même limite déjà
# documentée pour service-personnel/Medical-Monitoring). Défaut : mêmes
# valeurs que le compte applicatif de la base 'default' de ce service.
TENANT_DB_USER = env('TENANT_DB_USER', default=env('DB_USER', default='nehemie'))
TENANT_DB_PASSWORD = env('TENANT_DB_PASSWORD', default=env('DB_PASSWORD', default=''))

# Test runner tenant-aware — voir core/test_runner.py pour la
# justification détaillée (spécifique à ce service : une migration
# historique avec RunPython touchant directement le modèle Materiel).
# N'affecte jamais le comportement de production (uniquement consulté
# par `manage.py test`).
TEST_RUNNER = 'core.test_runner.TenantAwareTestRunner'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = env('TZ', default='Africa/Douala')
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.GatewayHeaderAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

CORS_ALLOW_ALL_ORIGINS = True

# ==================================================
# DRF-SPECTACULAR (Swagger/OpenAPI) CONFIGURATION
# ==================================================
SPECTACULAR_SETTINGS = {
    'TITLE': 'Comptabilité Matière API',
    'DESCRIPTION': 'API autonome de gestion de la comptabilité matière — Hôpital Fultang (ENSPY)',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/',
    'SERVERS': [
        {
            'url': 'http://localhost:8080/compta-matiere',
            'description': 'API Gateway',
        },
    ],
    'SECURITY': [{'BearerAuth': []}],
    'SECURITY_DEFINITIONS': {
        'BearerAuth': {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }
    },
    'CONTACT': {
        'name': 'DeDjomo',
        'email': 'dedjomokarlyn@gmail.com',
    },
    'LICENSE': {
        'name': 'Proprietary - ENSPY',
    },
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'jwtAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
    'SECURITY': [{'jwtAuth': []}],
    'SWAGGER_UI_SETTINGS': {
        'persistAuthorization': True,
    },
}

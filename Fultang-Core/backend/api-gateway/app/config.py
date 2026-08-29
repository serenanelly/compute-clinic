from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Fultang API Gateway"
    SECRET_KEY: str = "supersecretkey_change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Microservices URLs
    SERVICE_PERSONNEL_URL: str = "http://fultang-personnel:8000"
    SERVICE_MEDICAL_URL: str = "http://fultang-medical-backend:8000"
    SERVICE_INFRASTRUCTURE_URL: str = "http://fultang-infrastructure-web:8000"
    SERVICE_COMPTA_FINANCIERE_URL: str = "http://fultang-compta-financiere-backend:8000"
    SERVICE_COMPTA_MATIERE_URL: str = "http://fultang-compta-matiere-backend:8000"
    SERVICE_TENANT_URL: str = "http://fultang-tenant-web:8000"

    # Domaine racine utilisé pour la résolution de tenant par sous-domaine
    # (Phase 2.1) : <tenant_identifier>.TENANT_ROOT_DOMAIN
    TENANT_ROOT_DOMAIN: str = "fulltang.com"

    # Jeton partagé prouvant au Tenant Service que l'appelant est la
    # Gateway (communication interne, GET /tenants/resolve/). Pas de valeur
    # en dur : doit être fourni via variable d'environnement / secret, et
    # identique à TENANT_SERVICE_INTERNAL_TOKEN côté tenant-service.
    TENANT_SERVICE_INTERNAL_TOKEN: str = ""

    class Config:
        env_file = ".env"

settings = Settings()

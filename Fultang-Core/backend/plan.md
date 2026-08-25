# Plan Technique Détaillé : Intégration API Gateway

Ce document fournit les instructions techniques exactes (code source, configuration Docker) pour intégrer les 3 microservices (**Personnel**, **Medical-Monitoring**, **Gestion-Infrastructures**) derrière l'**API Gateway**.

---

## Phase 1 : Configuration du Réseau Docker

Actuellement, les services sont répartis dans différents fichiers `docker-compose.yml`. Pour que la Gateway (située dans le fichier racine) puisse communiquer avec les autres services, ils doivent partager un réseau Docker commun.

**1. Créer le réseau partagé (à exécuter une fois) :**
```bash
docker network create fultang_shared_network
```

**2. Modifier le `docker-compose.yml` racine (API Gateway & Personnel) :**
Ajouter la configuration réseau en bas du fichier et l'affecter aux services :
```yaml
networks:
  default:
    name: fultang_shared_network
    external: true
```

**3. Modifier `Medical-Monitoring/docker-compose.yml` :**
Mettre à jour le réseau pour utiliser le réseau partagé et s'assurer que le nom du conteneur est explicite.
```yaml
networks:
  fultang_network:
    name: fultang_shared_network
    external: true
# Le conteneur backend s'appelle déjà 'fultang_medical_backend'
```

**4. Modifier `Gestion-Infrastructures/docker-compose.yml` :**
Ajouter un nom de conteneur explicite et le réseau partagé.
```yaml
services:
  web:
    container_name: fultang_infrastructure_web
    # ... reste de la config ...
    networks:
      - default
      
networks:
  default:
    name: fultang_shared_network
    external: true
```

---

## Phase 2 : Configuration de l'API Gateway

### 1. Variables d'Environnement (`api-gateway/app/config.py`)

Ajouter les URLs de résolution interne Docker pour les nouveaux services.

```python
class Settings(BaseSettings):
    # ... existant ...
    SERVICE_PERSONNEL_URL: str = "http://fultang-personnel:8000" # Assurez-vous du nom du conteneur
    SERVICE_MEDICAL_URL: str = "http://fultang_medical_backend:8000"
    SERVICE_INFRASTRUCTURE_URL: str = "http://fultang_infrastructure_web:8000"
```

### 2. Routage Dynamique (`api-gateway/app/main.py`)

Remplacer la fonction `proxy_catch_all` pour gérer les préfixes spécifiques de chaque service et réécrire l'URL interne correctement.

```python
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"], tags=["Proxy Microservices"])
async def proxy_catch_all(path: str, request: Request):
    target_url = None
    
    # 1. Routage Service Personnel (/personnel/...) -> /api/...
    if path.startswith("personnel"):
        sub_path = path[len("personnel"):].lstrip("/")
        internal_path = sub_path if sub_path.startswith("api") else f"api/{sub_path}"
        target_url = f"{settings.SERVICE_PERSONNEL_URL}/{internal_path}"
        
    # 2. Routage Medical Monitoring (/medical/...) -> /api/medical-monitoring/...
    elif path.startswith("medical"):
        sub_path = path[len("medical"):].lstrip("/")
        internal_path = f"api/medical-monitoring/{sub_path}".replace("//", "/")
        target_url = f"{settings.SERVICE_MEDICAL_URL}/{internal_path}"
        
    # 3. Routage Gestion Infrastructures (/infrastructure/...) -> /api/...
    elif path.startswith("infrastructure"):
        sub_path = path[len("infrastructure"):].lstrip("/")
        internal_path = sub_path if sub_path.startswith("api") else f"api/{sub_path}"
        target_url = f"{settings.SERVICE_INFRASTRUCTURE_URL}/{internal_path}"
    
    if not target_url:
        raise HTTPException(status_code=404, detail=f"Route '{path}' non trouvée sur la Gateway.")

    # ... (Le reste du code pour injecter X-User-ID et faire la requête via httpx reste identique)
```

### 3. Proxy des Documentations Swagger (`api-gateway/app/main.py`)

Pour que les interfaces Swagger (qui chargent des fichiers CSS/JS et des schémas JSON) fonctionnent, la méthode `smart_schema_proxy` doit être mise à jour pour intercepter le bon schéma selon le `referer`.

```python
@app.get("/api/schema/", tags=["Proxy Microservices"], include_in_schema=False)
@app.get("/api/medical-monitoring/schema/", include_in_schema=False) # Route spécifique pour medical
async def smart_schema_proxy(request: Request):
    referer = request.headers.get("referer", "")
    target_url = None

    if "personnel" in referer:
        target_url = f"{settings.SERVICE_PERSONNEL_URL}/api/schema/"
    elif "medical" in referer:
        target_url = f"{settings.SERVICE_MEDICAL_URL}/api/medical-monitoring/schema/"
    elif "infrastructure" in referer:
        target_url = f"{settings.SERVICE_INFRASTRUCTURE_URL}/api/schema/"
        
    if target_url:
        async with httpx.AsyncClient() as client:
            resp = await client.get(target_url)
            return Response(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))
            
    raise HTTPException(status_code=404, detail="Schéma OpenAPI non trouvé")
```

---

## Phase 3 : Déploiement et Tests

**1. Redémarrer l'infrastructure complète :**
```bash
# Lancer les bases de données d'abord
docker-compose -f docker-compose.yml up -d postgres
docker-compose -f Medical-Monitoring/docker-compose.yml up -d db
docker-compose -f Gestion-Infrastructures/docker-compose.yml up -d db

# Lancer les backends et la gateway
docker-compose -f docker-compose.yml up -d --build
docker-compose -f Medical-Monitoring/docker-compose.yml up -d --build
docker-compose -f Gestion-Infrastructures/docker-compose.yml up -d --build
```

**2. Tests des API via la Gateway (Port 8080) :**
- **Personnel** : `curl http://localhost:8080/personnel/medecins/`
- **Medical** : `curl http://localhost:8080/medical/patients/`
- **Infrastructure** : `curl http://localhost:8080/infrastructure/batiments/`

**3. Tests des Documentations :**
Ouvrir dans le navigateur :
- `http://localhost:8080/personnel/docs/`
- `http://localhost:8080/medical/docs/`
- `http://localhost:8080/infrastructure/docs/`

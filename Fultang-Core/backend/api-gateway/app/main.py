import httpx
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth.jwt_handler import decode_token, create_access_token, create_refresh_token
from app.tenant.resolver import (
    TenantInactiveError,
    TenantNotFoundError,
    TenantResolutionError,
    TenantResolver,
)
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

class LoginCredentials(BaseModel):
    email: str = Field(..., example="admin@fultang.local")
    password: str = Field(..., example="adminpass")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    ## Fultang API Gateway
    
    Cette passerelle est le point d'entrée unique pour l'écosystème Fultang.
    Elle gère :
    * **L'Authentification Centralisée** (JWT)
    * **Le Routage Microservices** :
      - `/personnel/**` → Service Personnel
      - `/medical/**` → Medical Monitoring
      - `/infrastructure/**` → Gestion Infrastructures
      - `/tenants/**` → Tenant Management (Phase 1 — Tenant Registry)
    * **Le Rate Limiting** pour la sécurité
    
    ### Documentation des services
    - [Service Personnel](/personnel/docs/)
    - [Medical Monitoring](/medical/docs/)
    - [Gestion Infrastructures](/infrastructure/docs/)
    - [Comptabilité Financière](/compta-financiere/docs/)
    - [Comptabilité Matière](/compta-matiere/docs/)
    """,
    version="1.0.0",
    contact={
        "name": "Équipe de Développement Fultang",
        "email": "dev@fultang.local",
    }
)

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared HTTP client for proxying
client = httpx.AsyncClient()

# Résolution hostname → tenant (Phase 2.1). Le Tenant Service reste la
# seule source de vérité — voir app/tenant/resolver.py.
tenant_resolver = TenantResolver(
    client,
    settings.SERVICE_TENANT_URL,
    settings.TENANT_ROOT_DOMAIN,
    settings.TENANT_SERVICE_INTERNAL_TOKEN,
)


@app.get("/", response_class=HTMLResponse, tags=["Hub"])
async def root_hub():
    """
    Page d'accueil de la Gateway (Dashboard Développeur).
    Rend une interface premium pour accéder aux spécifications Swagger de chaque microservice.
    """
    html_content = """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fultang Developer Gateway Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #080710;
            --card-bg: rgba(255, 255, 255, 0.03);
            --card-border: rgba(255, 255, 255, 0.08);
            --primary: #8a2be2;
            --primary-glow: rgba(138, 43, 226, 0.4);
            --success: #00ffcc;
            --success-glow: rgba(0, 255, 204, 0.3);
            --error: #ff4a5a;
            --text-main: #f5f5f7;
            --text-muted: #86868b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(138, 43, 226, 0.15) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(0, 255, 204, 0.1) 0%, transparent 40%);
        }

        header {
            text-align: center;
            margin: 60px 20px 40px;
            max-width: 800px;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 3.2rem;
            font-weight: 800;
            letter-spacing: -0.03em;
            background: linear-gradient(135deg, #ffffff 30%, #a25df2 70%, #00ffcc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 16px;
        }

        .subtitle {
            font-size: 1.15rem;
            color: var(--text-muted);
            line-height: 1.6;
            font-weight: 300;
        }

        .container {
            max-width: 1200px;
            width: 100%;
            padding: 0 24px;
            margin-bottom: 80px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            padding: 32px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(130deg, transparent 40%, rgba(255, 255, 255, 0.03) 60%, transparent 80%);
            transform: translateX(-100%);
            transition: transform 0.6s ease;
        }

        .card:hover {
            transform: translateY(-6px);
            border-color: rgba(138, 43, 226, 0.3);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(138, 43, 226, 0.1);
        }

        .card:hover::before {
            transform: translateX(100%);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
        }

        .service-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.45rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 6px;
        }

        .service-prefix {
            font-size: 0.85rem;
            color: var(--primary);
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.05em;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 30px;
            font-size: 0.8rem;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--text-muted);
        }

        .status-badge.online .status-dot {
            background-color: var(--success);
            box-shadow: 0 0 10px var(--success);
        }

        .status-badge.offline .status-dot {
            background-color: var(--error);
            box-shadow: 0 0 10px var(--error);
        }

        .service-desc {
            font-size: 0.95rem;
            color: var(--text-muted);
            line-height: 1.5;
            margin-bottom: 32px;
            flex-grow: 1;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px 20px;
            border-radius: 14px;
            font-size: 0.95rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
        }

        .btn-primary {
            background: var(--primary);
            color: #ffffff;
            box-shadow: 0 4px 15px var(--primary-glow);
        }

        .btn-primary:hover {
            background: #993ffc;
            box-shadow: 0 6px 20px rgba(138, 43, 226, 0.6);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--card-border);
            color: var(--text-main);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        footer {
            margin-top: auto;
            margin-bottom: 30px;
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        .badge-dns-test {
            margin-top: 20px;
            background: rgba(138, 43, 226, 0.1);
            border: 1px solid rgba(138, 43, 226, 0.2);
            padding: 12px 24px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .badge-dns-test:hover {
            background: rgba(138, 43, 226, 0.2);
        }
    </style>
</head>
<body>
    <header>
        <h1>Fultang Developer Gateway Hub</h1>
        <p class="subtitle">Bienvenue sur le portail central des développeurs de la Polyclinique Fultang. Accédez d'ici à toutes les documentations interactives Swagger de vos microservices.</p>
        
        <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
            <a href="/docs" class="badge-dns-test" style="text-decoration: none; color: inherit;">
                🛡️ Consulter la doc globale de la Gateway (/docs)
            </a>
            <div id="dns-trigger" class="badge-dns-test">
                ⚡ Tester la connectivité DNS de l'infrastructure
            </div>
        </div>
    </header>

    <div class="container">
        <div class="grid">
            <!-- Service Personnel -->
            <div class="card">
                <div>
                    <div class="card-header">
                        <div>
                            <span class="service-prefix">auth & users</span>
                            <h2 class="service-title">Service Personnel</h2>
                        </div>
                        <div class="status-badge" id="badge-fultang-personnel">
                            <span class="status-dot"></span>
                            <span class="status-text">Vérification...</span>
                        </div>
                    </div>
                    <p class="service-desc">Gère l'authentification centralisée, les utilisateurs (médecins, infirmiers, administratifs), et les profils.</p>
                </div>
                <a href="/personnel/docs/" target="_blank" class="btn btn-primary">Consulter Swagger UI ➔</a>
            </div>

            <!-- Medical Monitoring -->
            <div class="card">
                <div>
                    <div class="card-header">
                        <div>
                            <span class="service-prefix">monitoring</span>
                            <h2 class="service-title">Medical Monitoring</h2>
                        </div>
                        <div class="status-badge" id="badge-fultang-medical-backend">
                            <span class="status-dot"></span>
                            <span class="status-text">Vérification...</span>
                        </div>
                    </div>
                    <p class="service-desc">Prend en charge le suivi médical des patients, les constantes vitales, les visites médicales et les dossiers médicaux.</p>
                </div>
                <a href="/medical/docs/" target="_blank" class="btn btn-primary">Consulter Swagger UI ➔</a>
            </div>

            <!-- Gestion Infrastructures -->
            <div class="card">
                <div>
                    <div class="card-header">
                        <div>
                            <span class="service-prefix">infrastructures</span>
                            <h2 class="service-title">Gestion Infrastructures</h2>
                        </div>
                        <div class="status-badge" id="badge-fultang-infrastructure-web">
                            <span class="status-dot"></span>
                            <span class="status-text">Vérification...</span>
                        </div>
                    </div>
                    <p class="service-desc">Supervise la logistique, l'état des bâtiments hospitaliers, l'occupation des lits et la gestion des salles de soin.</p>
                </div>
                <a href="/infrastructure/docs/" target="_blank" class="btn btn-primary">Consulter Swagger UI ➔</a>
            </div>

            <!-- Comptabilité Financière -->
            <div class="card">
                <div>
                    <div class="card-header">
                        <div>
                            <span class="service-prefix">finance</span>
                            <h2 class="service-title">Comptabilité Financière</h2>
                        </div>
                        <div class="status-badge" id="badge-fultang-compta-financiere-backend">
                            <span class="status-dot"></span>
                            <span class="status-text">Vérification...</span>
                        </div>
                    </div>
                    <p class="service-desc">Assure la gestion financière de l'hôpital, le suivi de la caisse centrale, les dépenses courantes et le plan de compte OHADA.</p>
                </div>
                <a href="/compta-financiere/docs/" target="_blank" class="btn btn-primary">Consulter Swagger UI ➔</a>
            </div>

            <!-- Comptabilité Matière -->
            <div class="card">
                <div>
                    <div class="card-header">
                        <div>
                            <span class="service-prefix">matière & stocks</span>
                            <h2 class="service-title">Comptabilité Matière</h2>
                        </div>
                        <div class="status-badge" id="badge-fultang-compta-matiere-backend">
                            <span class="status-dot"></span>
                            <span class="status-text">Vérification...</span>
                        </div>
                    </div>
                    <p class="service-desc">Pilote les flux de matériels médicaux, les stocks durables, les inventaires périodiques et les bons de livraison fournisseurs.</p>
                </div>
                <a href="/compta-matiere/docs/" target="_blank" class="btn btn-primary">Consulter Swagger UI ➔</a>
            </div>

            <!-- Tenant Management -->
            <div class="card">
                <div>
                    <div class="card-header">
                        <div>
                            <span class="service-prefix">multitenant</span>
                            <h2 class="service-title">Tenant Management</h2>
                        </div>
                        <div class="status-badge" id="badge-fultang-tenant-web">
                            <span class="status-dot"></span>
                            <span class="status-text">Vérification...</span>
                        </div>
                    </div>
                    <p class="service-desc">Tient le registre des établissements de santé (tenants) de l'écosystème FullTang — métadonnées uniquement.</p>
                </div>
                <a href="/tenants/docs/" target="_blank" class="btn btn-primary">Consulter Swagger UI ➔</a>
            </div>
        </div>
    </div>

    <footer>
        &copy; 2026 Polyclinique Fultang — Tous droits réservés.
    </footer>

    <script>
        async function checkDNS() {
            try {
                const res = await fetch('/debug-dns');
                const data = await res.json();
                
                Object.keys(data).forEach(host => {
                    const status = data[host];
                    const badge = document.getElementById('badge-' + host);
                    if (badge) {
                        if (status.startsWith('OK')) {
                            badge.className = 'status-badge online';
                            badge.querySelector('.status-text').innerText = 'En ligne';
                        } else {
                            badge.className = 'status-badge offline';
                            badge.querySelector('.status-text').innerText = 'Hors ligne';
                        }
                    }
                });
            } catch (err) {
                console.error("Impossible de joindre l'endpoint DNS", err);
            }
        }

        document.getElementById('dns-trigger').addEventListener('click', () => {
            document.querySelectorAll('.status-text').forEach(t => t.innerText = 'Vérification...');
            checkDNS();
        });

        // Premier chargement automatique
        checkDNS();
    </script>
</body>
</html>"""
    return HTMLResponse(content=html_content)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _inject_user_headers(headers: dict, token: str) -> dict:
    """Décode le JWT et injecte X-User-* dans les headers."""
    try:
        payload = decode_token(token)
        if payload:
            headers["X-User-ID"] = str(payload.get("sub", ""))
            headers["X-User-Roles"] = ",".join(payload.get("roles", []) or [])
            if payload.get("email"):
                headers["X-User-Email"] = str(payload["email"])
            if payload.get("nom"):
                headers["X-User-Nom"] = str(payload["nom"])
            if payload.get("prenom"):
                headers["X-User-Prenom"] = str(payload["prenom"])
    except Exception:
        pass
    return headers


async def _forward(request: Request, target_url: str) -> Response:
    """Relaie la requête vers target_url et retourne la réponse brute."""
    method = request.method
    content = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)

    # Injection des données utilisateur si un Bearer token est présent
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        headers = _inject_user_headers(headers, token)

    try:
        response = await client.request(
            method,
            target_url,
            headers=headers,
            content=content,
            params=request.query_params,
            follow_redirects=True,
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur de communication avec le service : {exc}")


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@app.post("/auth/login", response_model=TokenResponse, tags=["Authentification"], summary="Connexion utilisateur")
@limiter.limit("5/minute")
async def login(credentials: LoginCredentials, request: Request):
    """
    Authentifie un utilisateur via le Service Personnel et génère des tokens JWT.

    - **email**: Email de l'utilisateur (Médecin, Admin, etc.)
    - **password**: Mot de passe associé
    """
    try:
        response = await client.post(
            f"{settings.SERVICE_PERSONNEL_URL}/api/auth/verify/",
            json=credentials.dict()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Identifiants invalides")

        user_data = response.json()

        token_claims = {
            "sub": str(user_data["id"]),
            "roles": user_data.get("roles") or [],
            "email": user_data.get("email") or "",
            "nom": user_data.get("nom") or "",
            "prenom": user_data.get("prenom") or "",
        }
        access_token = create_access_token(data=token_claims)
        refresh_token = create_refresh_token(data={
            "sub": str(user_data["id"]),
            "roles": user_data.get("roles") or [],
            "email": user_data.get("email") or "",
            "nom": user_data.get("nom") or "",
            "prenom": user_data.get("prenom") or "",
        })

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user_data
        }
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Service Personnel indisponible")


@app.post("/auth/refresh", response_model=TokenRefreshResponse, tags=["Authentification"], summary="Rafraîchir l'access token")
async def refresh_token(body: RefreshRequest):
    """Renouvelle l'access token à partir d'un refresh token valide."""
    refresh_token = body.refresh_token
    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token invalide ou expiré")

    user_id = payload.get("sub")
    new_access_token = create_access_token(data={
        "sub": user_id,
        "roles": payload.get("roles", []),
        "email": payload.get("email") or "",
        "nom": payload.get("nom") or "",
        "prenom": payload.get("prenom") or "",
    })

    return {"access_token": new_access_token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Proxy Schemas (OpenAPI / Swagger UI support)
# Les clients Swagger envoient le referer qui permet d'identifier le service.
# ---------------------------------------------------------------------------

@app.get("/debug-dns")
async def debug_dns():
    import socket
    results = {}
    for host in ["fultang-personnel", "fultang-medical-backend", "fultang-infrastructure-web", "fultang-compta-financiere-backend", "fultang-compta-matiere-backend", "fultang-tenant-web"]:
        try:
            ip = socket.gethostbyname(host)
            results[host] = f"OK ({ip})"
        except Exception as e:
            results[host] = f"ERROR: {str(e)}"
    return results

@app.get("/api/schema/", include_in_schema=False, tags=["Proxy Microservices"])
@app.get("/api/medical-monitoring/schema/", include_in_schema=False, tags=["Proxy Microservices"])
async def smart_schema_proxy(request: Request):
    """
    Renvoie le schéma OpenAPI du microservice approprié selon le header Referer.
    Permet à l'interface Swagger de fonctionner derrière la Gateway.
    """
    referer = request.headers.get("referer", "").lower()
    target_url = None

    if "personnel" in referer:
        target_url = f"{settings.SERVICE_PERSONNEL_URL}/api/schema/"
    elif "medical" in referer:
        target_url = f"{settings.SERVICE_MEDICAL_URL}/api/medical-monitoring/schema/"
    elif "infrastructure" in referer:
        target_url = f"{settings.SERVICE_INFRASTRUCTURE_URL}/api/schema/"
    elif "compta-financiere" in referer:
        target_url = f"{settings.SERVICE_COMPTA_FINANCIERE_URL}/api/schema/"
    elif "compta-matiere" in referer:
        target_url = f"{settings.SERVICE_COMPTA_MATIERE_URL}/api/schema/"
    elif "tenants" in referer:
        target_url = f"{settings.SERVICE_TENANT_URL}/api/schema/"

    if target_url:
        async with httpx.AsyncClient() as c:
            resp = await c.get(target_url)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )

    raise HTTPException(status_code=404, detail="Schéma OpenAPI non trouvé. Vérifiez le header Referer.")


# ---------------------------------------------------------------------------
# Catch-all Proxy
# Routage :
#   /personnel/**  → SERVICE_PERSONNEL_URL  → /api/**
#   /medical/**    → SERVICE_MEDICAL_URL    → /api/medical-monitoring/**
#   /infrastructure/** → SERVICE_INFRASTRUCTURE_URL → /api/**
# ---------------------------------------------------------------------------

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"], tags=["Proxy Microservices"], summary="Routage vers les microservices")
async def proxy_catch_all(path: str, request: Request):
    """
    Route toutes les requêtes vers les microservices correspondants.

    ### Routage actuel :
    - `/personnel/**` → **Service Personnel** (`/api/**`)
    - `/medical/**` → **Medical Monitoring** (`/api/medical-monitoring/**`)
    - `/infrastructure/**` → **Gestion Infrastructures** (`/api/**`)
    - `/tenants/**` → **Tenant Management** (`/api/**`)

    ### Exemples :
    - `GET /personnel/medecins/` → `GET http://fultang-personnel:8000/api/medecins/`
    - `GET /medical/patients/` → `GET http://fultang_medical_backend:8000/api/medical-monitoring/patients/`
    - `GET /infrastructure/batiments/` → `GET http://fultang_infrastructure_web:8000/api/batiments/`

    ### Headers injectés par la Gateway :
    - `X-User-ID`: ID de l'utilisateur (si authentifié)
    - `X-User-Roles`: Rôles de l'utilisateur (si authentifié)

    ### Tenant Resolution (Phase 2.1) :
    Le hostname de la requête (`<tenant_identifier>.fulltang.com`) est
    résolu auprès du Tenant Service avant le routage. Un hostname hors
    convention (ex: `localhost`, utilisé en développement) n'est PAS une
    erreur : la requête continue simplement sans contexte tenant, comme
    avant cette phase.
    """
    # --- Tenant Resolution : hostname → TenantContext -------------------
    # Résultat disponible pour la suite du traitement de la requête
    # (request.state) — pas encore propagé aux microservices ni utilisé
    # pour une vérification d'autorisation utilisateur (Phase 2.2).
    hostname = request.headers.get("host", "")
    try:
        request.state.tenant_context = await tenant_resolver.resolve(hostname)
    except TenantNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except TenantInactiveError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except TenantResolutionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    target_url = None

    # --- Service Personnel : /personnel/<sub_path> → /api/<sub_path>
    if path.startswith("personnel"):
        sub_path = path[len("personnel"):].lstrip("/")
        # Si sub_path est vide, on renvoie vers la racine /api/
        internal_path = sub_path if sub_path.startswith("api") else f"api/{sub_path}"
        target_url = f"{settings.SERVICE_PERSONNEL_URL}/{internal_path}"

    # --- Medical Monitoring : /medical/<sub_path> → /api/medical-monitoring/<sub_path>
    elif path.startswith("medical"):
        sub_path = path[len("medical"):].lstrip("/")
        internal_path = f"api/medical-monitoring/{sub_path}".rstrip("/") + "/"
        internal_path = internal_path.replace("//", "/")
        target_url = f"{settings.SERVICE_MEDICAL_URL}/{internal_path}"

    # --- Gestion Infrastructures : /infrastructure/<sub_path> → /api/<sub_path>
    elif path.startswith("infrastructure"):
        sub_path = path[len("infrastructure"):].lstrip("/")
        internal_path = sub_path if sub_path.startswith("api") else f"api/{sub_path}"
        target_url = f"{settings.SERVICE_INFRASTRUCTURE_URL}/{internal_path}"

    # --- Comptabilité Financière : /compta-financiere/<sub_path> → /api/<sub_path>
    elif path.startswith("compta-financiere"):
        sub_path = path[len("compta-financiere"):].lstrip("/")
        internal_path = sub_path if sub_path.startswith("api") else f"api/{sub_path}"
        target_url = f"{settings.SERVICE_COMPTA_FINANCIERE_URL}/{internal_path}"

    # --- Comptabilité Matière : /compta-matiere/<sub_path> → /api/compta_matiere/<sub_path>
    elif path.startswith("compta-matiere"):
        sub_path = path[len("compta-matiere"):].lstrip("/")
        if sub_path.startswith("api/compta_matiere"):
            internal_path = sub_path
        elif sub_path.startswith("api"):
            internal_path = f"api/compta_matiere/{sub_path[len('api'):].lstrip('/')}"
        else:
            internal_path = f"api/compta_matiere/{sub_path}"
        target_url = f"{settings.SERVICE_COMPTA_MATIERE_URL}/{internal_path}"

    # --- Tenant Management : /tenants/<sub_path> → /api/<sub_path>
    elif path.startswith("tenants"):
        sub_path = path[len("tenants"):].lstrip("/")
        internal_path = sub_path if sub_path.startswith("api") else f"api/{sub_path}"
        target_url = f"{settings.SERVICE_TENANT_URL}/{internal_path}"

    if not target_url:
        raise HTTPException(
            status_code=404,
            detail=f"Route '/{path}' introuvable. Préfixes valides : /personnel/, /medical/, /infrastructure/, /compta-financiere/, /compta-matiere/, /tenants/"
        )

    return await _forward(request, target_url)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("shutdown")
async def shutdown_event():
    await client.aclose()

"""
context.py — Tenant Context.

Représente "quel tenant est traité par la requête en cours", établi
UNIQUEMENT par le mécanisme d'authentification déjà présent — ce module
ne décode aucun JWT, ne contacte aucun service, et n'accepte aucune
valeur arbitraire fournie par le client :

  - `GatewayHeaderAuthentication.authenticate()` l'établit à partir de
    `X-Tenant-ID`, un header que la Gateway construit exclusivement à
    partir du JWT qu'elle a elle-même validé — un client ne peut jamais
    le forger, la Gateway le supprime systématiquement avant réinjection
    (voir api-gateway/app/main.py::_strip_client_identity_headers).

Implémenté avec `contextvars.ContextVar` plutôt que `threading.local` :
sémantique de reset précise (retour exact à l'état antérieur via un
token), et comportement correct si Medical-Monitoring migre un jour vers
un serveur ASGI/async (threading.local ne survit pas un changement de
thread au sein d'une même requête asynchrone, contextvars si).

ATTENTION particulière à ce service (voir signal `post_save` sur
`Visite`, medical_workflow/signals.py) : un `threading.Thread` NE
HÉRITE PAS du contextvar du thread appelant (vérifié empiriquement lors
du chantier multitenant service-personnel) — tout code qui a besoin du
tenant courant DANS un thread séparé doit le capturer explicitement
AVANT de créer ce thread et le transmettre en paramètre, jamais en
comptant sur `get_current_tenant_context()` à l'intérieur du thread.

Isolation stricte entre requêtes : `TenantContextCleanupMiddleware`
(middleware.py) réinitialise ce contexte après CHAQUE requête, y compris
en cas d'exception — un worker/thread réutilisé pour la requête suivante
ne peut jamais hériter du tenant de la requête précédente.
"""
import contextvars
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class TenantContext:
    """
    tenant_id=None est un état EXPLICITE et valide : "pool non assigné"
    (comptes/données créés avant l'introduction du multitenant, ou
    environnement de développement local sans sous-domaine de tenant).
    Ce n'est PAS la même chose qu'une absence totale de contexte (voir
    TenantContextMissingError ci-dessous), qui signale un bug ou un
    accès hors du cycle requête/réponse normal.
    """
    tenant_id: Optional[str]


class TenantContextMissingError(Exception):
    """
    Levée quand du code tenant-scopé s'exécute sans qu'aucun Tenant
    Context n'ait jamais été établi pour cette requête.

    Ce n'est PAS la même chose que "tenant_id=None" (pool non assigné,
    un état valide) : c'est l'absence totale de décision, qui ne doit
    JAMAIS entraîner un accès silencieux à une base par défaut. Voir
    TenantDatabaseRouter (router.py) pour l'usage de cette exception
    dans le refus explicite.
    """


_current_tenant_context: contextvars.ContextVar[Optional[TenantContext]] = contextvars.ContextVar(
    "fultang_medical_current_tenant_context", default=None
)


def set_tenant_context(tenant_id: Optional[str]) -> contextvars.Token:
    """Établit le Tenant Context pour la suite du traitement de la requête courante.

    Retourne un token à repasser à `reset_tenant_context()` pour revenir
    précisément à l'état antérieur (utilisé par le middleware de nettoyage).
    """
    return _current_tenant_context.set(TenantContext(tenant_id=tenant_id))


def reset_tenant_context(token: contextvars.Token) -> None:
    """Restaure l'état antérieur au `set_tenant_context()` correspondant."""
    _current_tenant_context.reset(token)


def get_current_tenant_context() -> Optional[TenantContext]:
    """Retourne le TenantContext courant, ou None si aucun n'a jamais été établi."""
    return _current_tenant_context.get()


def require_tenant_context() -> TenantContext:
    """Comme get_current_tenant_context(), mais lève si aucun contexte n'a été établi.

    Utilisé par le Database Router : un modèle tenant-scopé ne doit
    jamais être interrogé en dehors d'un contexte de requête authentifié
    (voir TenantContextMissingError).
    """
    ctx = get_current_tenant_context()
    if ctx is None:
        raise TenantContextMissingError(
            "Aucun Tenant Context n'a été établi pour cette requête — "
            "accès refusé (voir GatewayHeaderAuthentication)."
        )
    return ctx

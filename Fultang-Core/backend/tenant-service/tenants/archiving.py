"""
archiving.py — Archivage des données d'un tenant avant sa suppression
définitive (Suppression définitive de tenant).

Réutilise EXACTEMENT la même carte de services que le provisioning
(`provisioning.PROVISIONING_CAPABLE_SERVICES` — mêmes URLs de base déjà
correctement préfixées par service) et le même mécanisme d'appel interne
(`internal_clients.call_internal_service`) : aucune seconde table de
configuration, aucun nouveau protocole.

Stockage : `settings.ARCHIVE_ROOT`, un répertoire local sur le disque du
container tenant-service, bind-monté comme le reste du projet (même
mécanisme déjà utilisé pour `MEDIA_ROOT`/les logos uploadés — voir
LogoUploader.jsx/EstablishmentDetailPage.jsx) — PAS une base de données,
donc structurellement hors des 5 bases qui seront supprimées. Aucune
nouvelle infrastructure de stockage introduite (vérifié avant ce choix
que `pg_dump` n'est disponible que dans l'image d'un seul des 5 services
— voir MULTITENANT_ARCHITECTURE.md).

Format : un fichier JSON par service (sortie de `dumpdata`, déjà du JSON
valide) + un `manifest.json` décrivant l'ensemble (checksums, tailles,
métadonnées de rétention).
"""
import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from uuid import UUID

from django.conf import settings

from .internal_clients import InternalServiceCallError, call_internal_service
from .provisioning import PROVISIONING_CAPABLE_SERVICES

logger = logging.getLogger("tenants.archiving")

ARCHIVE_MANIFEST_VERSION = "1"


class ArchivingError(Exception):
    """Échec de l'archivage d'un ou plusieurs services — aucune suppression ne doit suivre."""


class ArchiveValidationError(Exception):
    """L'archive existante ne passe pas la validation d'intégrité — aucune suppression ne doit suivre."""


@dataclass
class ServiceArchiveResult:
    service_code: str
    file_name: str
    database_name: Optional[str]
    app_labels: List[str] = field(default_factory=list)
    object_count: Optional[int] = None
    size_bytes: int = 0
    checksum_sha256: str = ""
    pool_leftover_accounts: List[dict] = field(default_factory=list)


def _archive_dir(tenant_id: UUID) -> Path:
    return Path(settings.ARCHIVE_ROOT) / f"tenant_{tenant_id.hex}"


def _sha256_of_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def archive_tenant_data(
    tenant_id: UUID, *, tenant_identifier: str, tenant_name: str,
    service_codes: Optional[List[str]] = None,
) -> Dict:
    """
    Appelle, pour CHAQUE service demandé (par défaut : tous les services
    provisionnables — `PROVISIONING_CAPABLE_SERVICES`, la même liste que
    le provisioning), son endpoint interne `internal/archive-tenant-data/`
    (lecture seule côté service — voir ArchiveTenantDataView), écrit
    chaque dump reçu dans un fichier local sous `_archive_dir`, puis un
    `manifest.json` récapitulatif.

    Échec sur UN SEUL service → `ArchivingError` immédiate (aucun fichier
    partiel n'est laissé pour un archivage considéré en échec — le
    répertoire est nettoyé) : l'appelant (`TenantDeletionService`) ne
    doit jamais poursuivre vers une suppression destructive sur un
    archivage incomplet.

    Ne touche à AUCUNE ressource opérationnelle — purement en lecture
    côté services métier, purement en écriture locale côté tenant-service.
    """
    codes = service_codes or sorted(PROVISIONING_CAPABLE_SERVICES.keys())
    archive_dir = _archive_dir(tenant_id)
    archive_dir.mkdir(parents=True, exist_ok=True)

    results: List[ServiceArchiveResult] = []
    try:
        for code in codes:
            base_url = PROVISIONING_CAPABLE_SERVICES.get(code)
            if not base_url:
                raise ArchivingError(f"Service inconnu du provisioning : {code}")

            try:
                response = call_internal_service(
                    base_url, "internal/archive-tenant-data/", {"tenant_id": str(tenant_id)},
                    timeout=settings.TENANT_DELETION_TIMEOUT_SECONDS,
                )
            except InternalServiceCallError as exc:
                raise ArchivingError(f"Archivage de {code} échoué : {exc}") from exc

            dump_text = response.get("data", "")
            file_name = f"{code.lower()}.json"
            file_path = archive_dir / file_name
            file_path.write_text(dump_text, encoding="utf-8")

            pool_leftover = response.get("pool_leftover_accounts") or []
            result = ServiceArchiveResult(
                service_code=code,
                file_name=file_name,
                database_name=response.get("database_name"),
                app_labels=response.get("app_labels") or [],
                object_count=response.get("object_count"),
                size_bytes=file_path.stat().st_size,
                checksum_sha256=_sha256_of_text(dump_text),
                pool_leftover_accounts=pool_leftover,
            )
            if result.size_bytes == 0:
                # Un dump vide (0 octet) reste distinct de "0 objet" (une
                # base vide produit `[]`, 2 octets non nuls) : un fichier
                # réellement vide ne peut être qu'un échec d'écriture.
                raise ArchivingError(f"Archive de {code} vide (0 octet) — écriture probablement échouée.")
            if pool_leftover:
                # Comptes du tenant égarés dans le pool partagé (voir
                # ArchiveTenantDataView de service-personnel) : STOP —
                # jamais ignorés, jamais supprimés à l'aveugle (§7/§8 de
                # la tâche). L'opérateur doit traiter ce cas avant de
                # pouvoir relancer la suppression.
                raise ArchivingError(
                    f"{code} : {len(pool_leftover)} compte(s) de ce tenant détecté(s) dans le pool partagé "
                    f"(hors de sa base dédiée) — suppression refusée tant que ce cas n'est pas traité "
                    f"manuellement. Comptes : {pool_leftover}"
                )
            results.append(result)
            logger.info(
                "Archivé %s pour tenant_id=%s : %s objets, %s octets",
                code, tenant_id, result.object_count, result.size_bytes,
            )
    except ArchivingError:
        _cleanup_archive_dir(archive_dir)
        raise

    manifest = {
        "manifest_version": ARCHIVE_MANIFEST_VERSION,
        "tenant_id": str(tenant_id),
        "tenant_identifier": tenant_identifier,
        "tenant_name": tenant_name,
        "archived_at": datetime.now(timezone.utc).isoformat(),
        "services": [
            {
                "service_code": r.service_code,
                "file_name": r.file_name,
                "database_name": r.database_name,
                "app_labels": r.app_labels,
                "object_count": r.object_count,
                "size_bytes": r.size_bytes,
                "checksum_sha256": r.checksum_sha256,
                "pool_leftover_accounts_count": len(r.pool_leftover_accounts),
            }
            for r in results
        ],
    }
    manifest_path = archive_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    # Chemin RELATIF à ARCHIVE_ROOT (jamais un chemin absolu — portable
    # entre environnements, voir TenantDeletionRecord.archive_reference).
    archive_reference = archive_dir.name
    return {"archive_reference": archive_reference, "manifest": manifest}


def _cleanup_archive_dir(archive_dir: Path) -> None:
    """Retire un répertoire d'archive partiel/en échec — jamais laissé comme si c'était une archive valide."""
    if not archive_dir.exists():
        return
    for child in archive_dir.iterdir():
        try:
            child.unlink()
        except OSError:
            logger.warning("Impossible de nettoyer le fichier d'archive partiel %s", child)
    try:
        archive_dir.rmdir()
    except OSError:
        logger.warning("Impossible de nettoyer le répertoire d'archive partiel %s", archive_dir)


def validate_archive(tenant_id: UUID, archive_reference: str, *, expected_service_codes: Optional[List[str]] = None) -> Dict:
    """
    Relit le manifest + chaque fichier de dump référencé et vérifie :

    - le manifest existe et est un JSON valide ;
    - chaque service attendu (par défaut : tous ceux de
      `PROVISIONING_CAPABLE_SERVICES`) est couvert par le manifest ;
    - chaque fichier de dump référencé existe, n'est pas vide, et son
      checksum SHA-256 correspond exactement à celui enregistré dans le
      manifest au moment de l'archivage (détecte toute corruption/
      modification depuis l'écriture initiale).

    Lève `ArchiveValidationError` au premier problème rencontré — jamais
    une validation partielle silencieuse. Ne modifie rien.
    """
    expected = set(expected_service_codes or PROVISIONING_CAPABLE_SERVICES.keys())
    archive_dir = Path(settings.ARCHIVE_ROOT) / archive_reference

    # Défense en profondeur : `archive_reference` doit rester strictement
    # sous ARCHIVE_ROOT (jamais de traversée de répertoire), même si sa
    # seule origine actuelle est notre propre génération déterministe
    # (`tenant_<hex>`).
    try:
        archive_dir.resolve().relative_to(Path(settings.ARCHIVE_ROOT).resolve())
    except ValueError as exc:
        raise ArchiveValidationError(f"Référence d'archive invalide : {archive_reference}") from exc

    manifest_path = archive_dir / "manifest.json"
    if not manifest_path.exists():
        raise ArchiveValidationError(f"Manifest introuvable : {manifest_path}")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArchiveValidationError(f"Manifest illisible/corrompu : {exc}") from exc

    if str(manifest.get("tenant_id")) != str(tenant_id):
        raise ArchiveValidationError(
            f"Le manifest référence un autre tenant ({manifest.get('tenant_id')} != {tenant_id})."
        )

    covered_codes = {entry.get("service_code") for entry in manifest.get("services", [])}
    missing = expected - covered_codes
    if missing:
        raise ArchiveValidationError(f"Services absents de l'archive : {sorted(missing)}")

    for entry in manifest.get("services", []):
        file_path = archive_dir / entry["file_name"]
        if not file_path.exists():
            raise ArchiveValidationError(f"Fichier d'archive manquant : {file_path}")
        content = file_path.read_text(encoding="utf-8")
        if not content:
            raise ArchiveValidationError(f"Fichier d'archive vide : {file_path}")
        actual_checksum = _sha256_of_text(content)
        if actual_checksum != entry.get("checksum_sha256"):
            raise ArchiveValidationError(
                f"Checksum invalide pour {file_path} (attendu {entry.get('checksum_sha256')}, obtenu {actual_checksum})."
            )

    logger.info("Archive %s validée pour tenant_id=%s (%d services)", archive_reference, tenant_id, len(covered_codes))
    return manifest

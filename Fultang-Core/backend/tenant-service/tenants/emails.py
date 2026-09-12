"""
emails.py — Email d'accès du compte administrateur du tenant (Cycle de
vie du tenant, Phase 2).

Aucun système d'envoi n'existait nulle part dans FullTang avant cette
phase (audit complet du dépôt — aucun `send_mail`, aucun SMTP configuré,
voir MULTITENANT_ARCHITECTURE.md). Ce module utilise l'API Django
standard (`django.core.mail.send_mail`), backée par `EMAIL_BACKEND`
(voir config/settings.py — backend console en développement local, un
vrai SMTP se branche uniquement par variable d'environnement, jamais en
dur ici).

Ne réutilise PAS un mot de passe permanent : le mot de passe transmis
est explicitement temporaire (même mécanisme de génération que
`service-personnel/api/views.py::reset_password`, déjà existant) — le
destinataire est invité à le changer via le mécanisme existant
"mot de passe oublié", seul mécanisme de changement de mot de passe
self-service actuellement disponible dans FullTang (aucun nouveau
système d'authentification introduit ici).
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger("tenants.emails")


def send_tenant_admin_welcome_email(
    *, tenant_name: str, establishment_url: str, admin_email: str, temporary_password: str,
) -> None:
    """
    Envoie l'email d'accès au compte administrateur nouvellement créé.

    Ne capture AUCUNE exception : un échec d'envoi doit remonter tel
    quel à l'appelant (`TenantViewSet.provision_admin`), qui le reporte
    comme un sous-échec explicite de la séquence de création — jamais un
    "email envoyé" affiché sans que l'opération d'envoi ait réellement
    été déclenchée avec succès.
    """
    subject = f"Accès à votre établissement ComputeClinic — {tenant_name}"
    message = (
        f"Bonjour,\n\n"
        f"Votre établissement « {tenant_name} » est prêt sur ComputeClinic.\n\n"
        f"Adresse de votre établissement :\n{establishment_url}\n\n"
        f"Votre compte administrateur :\n"
        f"  Identifiant (email) : {admin_email}\n"
        f"  Mot de passe temporaire : {temporary_password}\n\n"
        "Merci de vous connecter puis de changer ce mot de passe dès que "
        "possible depuis l'écran « Mot de passe oublié ».\n\n"
        "— L'équipe ComputeClinic"
    )
    send_mail(
        subject, message, settings.DEFAULT_FROM_EMAIL, [admin_email],
        fail_silently=False,
    )
    logger.info("Email d'accès envoyé à %s pour l'établissement « %s ».", admin_email, tenant_name)

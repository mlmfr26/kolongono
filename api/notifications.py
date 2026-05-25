"""
SantéDirect — Push notifications via Firebase Cloud Messaging (FCM Legacy API).
Dégradation gracieuse : si FIREBASE_SERVER_KEY absent ou token vide, ne lève pas d'exception.
"""
import os
import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)

FCM_URL = "https://fcm.googleapis.com/fcm/send"
FCM_KEY = os.getenv("FIREBASE_SERVER_KEY", "")

# Stockage in-memory des tokens FCM (user_id → fcm_token)
# En production : stocker en base PostgreSQL dans la table users.
_fcm_tokens: dict[str, str] = {}


def register_token(user_id: str, token: str) -> None:
    """Enregistre ou met à jour le token FCM d'un utilisateur."""
    if token:
        _fcm_tokens[user_id] = token


def get_token(user_id: str) -> str:
    return _fcm_tokens.get(user_id, "")


async def send_fcm(token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Envoie une notification push via FCM Legacy API.
    Retourne True si réussi, False sinon (dégradation gracieuse — ne lève jamais).
    """
    if not FCM_KEY or not token:
        logger.debug("FCM non configuré ou token absent — notification ignorée.")
        return False

    payload = {
        "to": token,
        "notification": {
            "title": title,
            "body": body,
            "sound": "default",
            "badge": "1",
        },
        "data": data or {},
        "priority": "high",
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                FCM_URL,
                json=payload,
                headers={
                    "Authorization": f"key={FCM_KEY}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code == 200:
                result = r.json()
                if result.get("failure", 0) == 0:
                    logger.info(f"FCM OK — {title!r} → {token[:20]}…")
                    return True
                logger.warning(f"FCM rejeté — {result}")
                return False
            logger.warning(f"FCM HTTP {r.status_code} — {r.text[:200]}")
            return False
    except Exception as exc:
        logger.warning(f"FCM erreur réseau — {exc}")
        return False


async def notify_rdv_confirme(
    patient_id: str,
    medecin_id: str,
    medecin_nom: str,
    date: str,
    heure: str,
    rdv_id: str,
) -> None:
    """Notifie patient et médecin quand un RDV est confirmé."""
    patient_token = get_token(patient_id)
    medecin_token = get_token(medecin_id)

    await asyncio.gather(
        send_fcm(
            patient_token,
            title="RDV confirmé — SantéDirect",
            body=f"Votre téléconsultation avec {medecin_nom} est confirmée le {date} à {heure}.",
            data={"type": "rdv_confirme", "rdv_id": rdv_id},
        ),
        send_fcm(
            medecin_token,
            title="Nouveau RDV — SantéDirect",
            body=f"Téléconsultation programmée le {date} à {heure}.",
            data={"type": "nouveau_rdv", "rdv_id": rdv_id},
        ),
    )


async def notify_consultation_cloturee(
    patient_id: str,
    medecin_nom: str,
    ordonnance_id: str,
    rdv_id: str,
) -> None:
    """Notifie le patient quand la consultation est clôturée et l'ordonnance disponible."""
    patient_token = get_token(patient_id)
    await send_fcm(
        patient_token,
        title="Consultation terminée — SantéDirect",
        body=(
            f"Votre consultation avec {medecin_nom} est terminée. "
            "Votre ordonnance est disponible."
        ),
        data={
            "type": "consultation_cloturee",
            "rdv_id": rdv_id,
            "ordonnance_id": ordonnance_id,
        },
    )


async def notify_rappel_rdv(
    patient_id: str,
    auxiliaire_id: str,
    medecin_nom: str,
    date: str,
    heure: str,
    rdv_id: str,
) -> None:
    """Rappel 15 min avant la consultation (à déclencher via tâche planifiée)."""
    patient_token = get_token(patient_id)
    aux_token = get_token(auxiliaire_id)

    await asyncio.gather(
        send_fcm(
            patient_token,
            title="Rappel RDV — dans 15 min",
            body=f"Votre consultation avec {medecin_nom} commence à {heure}. Tenez-vous prêt.",
            data={"type": "rappel_rdv", "rdv_id": rdv_id},
        ),
        send_fcm(
            aux_token,
            title="Rappel RDV — dans 15 min",
            body=f"Préparez les signes vitaux du patient. Consultation {medecin_nom} à {heure}.",
            data={"type": "rappel_rdv_aux", "rdv_id": rdv_id},
        ),
    )

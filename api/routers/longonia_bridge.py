"""
SantéDirect — Kolongono : Pont API Longonia
Proxy sécurisé entre Kolongono (port 8002) et Longonia (port 8000/8001).
Inclut le mécanisme block-slot anti double-réservation croisée.
"""
import os
import httpx
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt

# ─── Config Longonia ──────────────────────────────────────────────────────────

LONGONIA_URL     = os.getenv("LONGONIA_API_URL",   "http://localhost:8000")
LONGONIA_SANTE   = os.getenv("LONGONIA_SANTE_URL", "http://localhost:8001")
LONGONIA_KEY     = os.getenv("LONGONIA_API_KEY",   "")
LONGONIA_TIMEOUT = float(os.getenv("LONGONIA_TIMEOUT", "5.0"))

SECRET_KEY = os.getenv("SECRET_KEY", "kolongono-dev-secret-change-me")
ALGORITHM  = "HS256"
http_bearer = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/longonia", tags=["Pont Longonia"])


# ─── Auth ────────────────────────────────────────────────────────────────────

async def _get_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        return jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token invalide")


# ─── Client Longonia ──────────────────────────────────────────────────────────

def _headers() -> dict:
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if LONGONIA_KEY:
        h["X-API-Key"] = LONGONIA_KEY
    return h


async def _longonia_get(path: str, base: str = LONGONIA_URL) -> dict:
    """GET vers Longonia avec timeout et dégradation gracieuse."""
    try:
        async with httpx.AsyncClient(timeout=LONGONIA_TIMEOUT) as client:
            r = await client.get(f"{base}{path}", headers=_headers())
            r.raise_for_status()
            return {"ok": True, "data": r.json(), "status": r.status_code}
    except httpx.TimeoutException:
        return {"ok": False, "error": "timeout", "data": None}
    except httpx.HTTPStatusError as exc:
        return {"ok": False, "error": str(exc), "status": exc.response.status_code, "data": None}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "data": None}


async def _longonia_post(path: str, body: dict, base: str = LONGONIA_URL) -> dict:
    """POST vers Longonia avec timeout et dégradation gracieuse."""
    try:
        async with httpx.AsyncClient(timeout=LONGONIA_TIMEOUT) as client:
            r = await client.post(f"{base}{path}", json=body, headers=_headers())
            if r.status_code == 409:
                return {"ok": False, "conflict": True, "status": 409, "data": r.json()}
            r.raise_for_status()
            return {"ok": True, "data": r.json(), "status": r.status_code}
    except httpx.TimeoutException:
        return {"ok": False, "error": "timeout", "data": None}
    except httpx.HTTPStatusError as exc:
        return {"ok": False, "error": str(exc), "status": exc.response.status_code, "data": None}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "data": None}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class BlockSlotRequest(BaseModel):
    medecin_id:  str
    date_rdv:    str  # ISO YYYY-MM-DD
    heure_debut: str  # HH:MM
    heure_fin:   str  # HH:MM
    adherent_id: str
    motif:       Optional[str] = ""

class DebitMutuelleRequest(BaseModel):
    adherent_id:     str
    montant_fc:      float
    motif:           str
    rdv_id:          Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/status", summary="Statut de la connexion Longonia")
async def longonia_status(_: dict = Depends(_get_user)):
    """Vérifie que Longonia est joignable."""
    result = await _longonia_get("/health")
    if result["ok"]:
        return {
            "longonia_accessible": True,
            "longonia_url": LONGONIA_URL,
            "checked_at": datetime.now().isoformat(),
        }
    return {
        "longonia_accessible": False,
        "longonia_url": LONGONIA_URL,
        "error": result.get("error"),
        "checked_at": datetime.now().isoformat(),
    }


@router.get("/verify-adherent/{adherent_id}", summary="Vérifier adhésion Longonia")
async def verify_adherent(adherent_id: str, _: dict = Depends(_get_user)):
    """Interroge Longonia pour valider l'éligibilité d'un adhérent."""
    result = await _longonia_get(f"/api/adherents/{adherent_id}/eligibilite")
    if not result["ok"]:
        if result.get("error") == "timeout":
            # Dégradation gracieuse : Longonia inaccessible → ne pas bloquer
            return {
                "eligible": True,
                "longonia_sync": False,
                "warning": "Longonia inaccessible — éligibilité non vérifiée côté Longonia",
                "adherent_id": adherent_id,
            }
        raise HTTPException(502, f"Longonia inaccessible : {result.get('error')}")

    data = result["data"]
    return {
        "eligible": data.get("eligible", False),
        "longonia_sync": True,
        "solde_fc": data.get("solde_fc"),
        "mois_dus": data.get("mois_dus", []),
        "adherent_id": adherent_id,
    }


@router.get("/planning/{medecin_id}", summary="Planning médecin (proxy Longonia)")
async def get_planning(medecin_id: str, date: Optional[str] = None, _: dict = Depends(_get_user)):
    """Récupère le planning d'un médecin depuis Longonia."""
    path = f"/api/medecins/{medecin_id}/planning"
    if date:
        path += f"?date={date}"
    result = await _longonia_get(path, base=LONGONIA_SANTE)
    if not result["ok"]:
        if result.get("error") == "timeout":
            return {"longonia_sync": False, "creneaux": [], "warning": "Planning Longonia indisponible"}
        raise HTTPException(502, f"Longonia inaccessible : {result.get('error')}")
    return {"longonia_sync": True, "creneaux": result["data"].get("creneaux", []), "medecin_id": medecin_id}


@router.post("/block-slot", summary="Réserver créneau (verrou croisé Longonia)")
async def block_slot(data: BlockSlotRequest, _: dict = Depends(_get_user)):
    """
    Pose un verrou croisé sur le créneau dans le système Longonia.
    409 = créneau déjà pris côté Longonia → refus dur.
    Timeout / erreur = dégradation gracieuse (on laisse passer avec avertissement).
    """
    result = await _longonia_post(
        "/api/planning/block-slot",
        {
            "medecin_id":  data.medecin_id,
            "date":        data.date_rdv,
            "heure_debut": data.heure_debut,
            "heure_fin":   data.heure_fin,
            "source":      "kolongono",
            "reference":   data.adherent_id,
            "motif":       data.motif,
        },
        base=LONGONIA_SANTE,
    )

    if result.get("conflict"):
        detail = result.get("data") or {}
        raise HTTPException(409, detail={
            "code": "creneau_bloque_longonia",
            "message": detail.get("message", "Ce créneau est réservé dans le système Longonia."),
            "medecin_id": data.medecin_id,
            "date": data.date_rdv,
            "heure": f"{data.heure_debut} – {data.heure_fin}",
        })

    if not result["ok"]:
        # Timeout ou erreur réseau : dégradation gracieuse
        return {
            "longonia_sync": False,
            "longonia_warning": (
                f"Longonia inaccessible ({result.get('error', 'erreur réseau')}) — "
                "créneau réservé dans Kolongono uniquement."
            ),
        }

    return {
        "longonia_sync": True,
        "longonia_slot_id": result["data"].get("slot_id"),
    }


@router.post("/debit-mutuelle", summary="Débiter solde mutuelle Longonia")
async def debit_mutuelle(data: DebitMutuelleRequest, _: dict = Depends(_get_user)):
    """Débite le solde mutuelle de l'adhérent dans Longonia."""
    result = await _longonia_post(
        "/api/mutuelle/debit",
        {
            "adherent_id": data.adherent_id,
            "montant_fc":  data.montant_fc,
            "motif":       data.motif,
            "rdv_id":      data.rdv_id,
            "source":      "kolongono",
            "timestamp":   datetime.now().isoformat(),
        },
    )

    if not result["ok"]:
        if result.get("error") == "timeout":
            return {
                "success": False,
                "longonia_sync": False,
                "warning": "Longonia inaccessible — débit en attente de synchronisation",
            }
        code = result.get("status", 0)
        if code == 402:
            raise HTTPException(402, detail={
                "code": "solde_insuffisant",
                "message": "Solde Longonia insuffisant pour ce débit.",
            })
        raise HTTPException(502, f"Erreur Longonia : {result.get('error')}")

    return {
        "success": True,
        "longonia_sync": True,
        "transaction_id": result["data"].get("transaction_id"),
        "solde_restant_fc": result["data"].get("solde_restant_fc"),
    }


@router.get("/medecins", summary="Médecins partagés Longonia–Kolongono")
async def get_medecins_longonia(_: dict = Depends(_get_user)):
    """Récupère les médecins référencés dans Longonia SantéDirect."""
    result = await _longonia_get("/api/medecins", base=LONGONIA_SANTE)
    if not result["ok"]:
        if result.get("error") == "timeout":
            return {"longonia_sync": False, "medecins": [], "warning": "Longonia inaccessible"}
        raise HTTPException(502, f"Longonia inaccessible : {result.get('error')}")
    return {"longonia_sync": True, "medecins": result["data"]}

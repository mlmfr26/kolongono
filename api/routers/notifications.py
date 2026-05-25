"""
SantéDirect — Notifications temps réel par rôle.
Génère les alertes depuis les données réelles (stock, demandes, RDV, cotisations).
Pas d'auth requise : données non-sensibles (comptages uniquement).
"""
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db_sync

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _item(id_: str, type_: str, titre: str, corps: str, severite: str = "info") -> dict:
    return {
        "id": id_,
        "type": type_,
        "titre": titre,
        "corps": corps,
        "severite": severite,  # urgent | warning | info
    }


@router.get("", summary="Alertes temps réel par rôle")
def get_notifications(
    role: str = Query("adherent"),
    centre_id: Optional[str] = Query(None),
    db: Session = Depends(get_db_sync),
) -> dict:
    """
    Retourne les alertes actives pour un rôle donné.
    - superadmin : tout le système
    - admin      : un centre précis (centre_id requis)
    - auxiliaire : demandes à prendre en charge + RDV du jour
    - medecin    : consultations planifiées + ordonnances en attente
    - adherent   : ordonnances disponibles
    """
    items: List[dict] = []
    today = date.today().isoformat()

    try:
        if role in ("superadmin", "admin"):
            _notifs_admin(db, items, role, centre_id, today)

        elif role == "auxiliaire":
            _notifs_auxiliaire(db, items, today)

        elif role == "medecin":
            _notifs_medecin(db, items, today)

        elif role == "adherent":
            _notifs_adherent(db, items)

    except Exception:
        pass  # DB non dispo ou tables manquantes → réponse vide propre

    return {"count": len(items), "items": items}


def _notifs_admin(db: Session, items: list, role: str, centre_id: Optional[str], today: str):
    # ── Ruptures stock pharmacie centres ─────────────────────────────────────
    try:
        from models import StockPharmacieCentre
        q = db.query(StockPharmacieCentre).filter(
            StockPharmacieCentre.stock <= StockPharmacieCentre.seuil,
            StockPharmacieCentre.seuil > 0,
        )
        if centre_id and role == "admin":
            q = q.filter(StockPharmacieCentre.centre_id == centre_id)
        ruptures = q.all()
        if ruptures:
            noms = ", ".join(r.nom for r in ruptures[:3])
            suffix = f" (+{len(ruptures) - 3} autres)" if len(ruptures) > 3 else ""
            items.append(_item(
                "rupture_stock", "rupture_stock",
                f"{len(ruptures)} produit(s) en rupture de stock",
                f"{noms}{suffix} — réapprovisionner",
                "urgent",
            ))
    except Exception:
        pass

    # ── Demandes urgentes non traitées ────────────────────────────────────────
    try:
        from models import Demande
        urgentes = db.query(Demande).filter(
            Demande.statut == "en_attente",
            Demande.urgence.in_(["haute", "urgente"]),
        ).count()
        if urgentes:
            items.append(_item(
                "demandes_urgentes", "consultation",
                f"{urgentes} demande(s) urgente(s) en attente",
                "Patient(s) à prendre en charge immédiatement",
                "urgent",
            ))
    except Exception:
        pass

    # ── Cotisations impayées (superadmin uniquement) ──────────────────────────
    if role == "superadmin":
        try:
            from models import Cotisation
            impayes = db.query(Cotisation).filter(
                Cotisation.statut == "en_attente"
            ).count()
            if impayes:
                items.append(_item(
                    "cotisations_impayes", "paiement",
                    f"{impayes} cotisation(s) impayée(s)",
                    "Relancer les adhérents concernés pour recouvrement",
                    "warning",
                ))
        except Exception:
            pass

    # ── Admissions en attente du centre ──────────────────────────────────────
    if centre_id:
        try:
            from models import Admission
            attente = db.query(Admission).filter(
                Admission.centre_id == centre_id,
                Admission.date == today,
                Admission.statut == "en_attente",
            ).count()
            if attente:
                items.append(_item(
                    "admissions_en_attente", "consultation",
                    f"{attente} patient(s) en attente d'admission",
                    "File de triage — orienter vers le bon service",
                    "warning",
                ))
        except Exception:
            pass


def _notifs_auxiliaire(db: Session, items: list, today: str):
    # ── Demandes en attente à prendre en charge ───────────────────────────────
    try:
        from models import Demande
        en_attente = db.query(Demande).filter(
            Demande.statut == "en_attente"
        ).count()
        if en_attente:
            items.append(_item(
                "demandes_en_attente", "consultation",
                f"{en_attente} demande(s) à traiter",
                "Prendre en charge et orienter le(s) patient(s)",
                "warning",
            ))
    except Exception:
        pass

    # ── RDV du jour planifiés ─────────────────────────────────────────────────
    try:
        from models import RendezVous
        rdv_count = db.query(RendezVous).filter(
            RendezVous.date == today,
            RendezVous.statut.in_(["confirme", "planifie"]),
        ).count()
        if rdv_count:
            items.append(_item(
                "rdv_jour", "rdv",
                f"{rdv_count} RDV aujourd'hui",
                "Préparer la pré-consultation pour chaque rendez-vous",
                "info",
            ))
    except Exception:
        pass


def _notifs_medecin(db: Session, items: list, today: str):
    # ── Consultations planifiées aujourd'hui ──────────────────────────────────
    try:
        from models import RendezVous
        rdv_count = db.query(RendezVous).filter(
            RendezVous.date == today,
            RendezVous.statut.in_(["confirme", "planifie"]),
        ).count()
        if rdv_count:
            items.append(_item(
                "rdv_jour", "rdv",
                f"{rdv_count} consultation(s) planifiée(s) aujourd'hui",
                "Vérifier les fiches pré-consultation avant l'appel",
                "info",
            ))
    except Exception:
        pass

    # ── Ordonnances en attente de dispensation ────────────────────────────────
    try:
        from models import Ordonnance
        ord_attente = db.query(Ordonnance).filter(
            Ordonnance.statut == "en_attente_pharmacie"
        ).count()
        if ord_attente:
            items.append(_item(
                "ordonnances_attente", "ordonnance",
                f"{ord_attente} ordonnance(s) en attente pharmacie",
                "Confirmer la dispensation des médicaments",
                "warning",
            ))
    except Exception:
        pass


def _notifs_adherent(db: Session, items: list):
    # ── Ordonnances nouvelles disponibles ─────────────────────────────────────
    try:
        from models import Ordonnance
        disponibles = db.query(Ordonnance).filter(
            Ordonnance.statut == "en_attente_pharmacie"
        ).count()
        if disponibles:
            items.append(_item(
                "ordonnance_dispo", "ordonnance",
                "Ordonnance disponible",
                "Un médecin a émis une ordonnance — récupérer à la pharmacie",
                "info",
            ))
    except Exception:
        pass

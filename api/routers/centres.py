"""
SANTÉ DIRECT — KOLONGONO
Router : Centres de santé partenaires (PostgreSQL — SQLAlchemy async)

Hiérarchie des rôles :
  superadmin       → accès total à tous les centres
  admin            → accès total à son centre uniquement (admin local)
  gestionnaire     → gestion opérationnelle (comptabilité, stocks)
  personnel_interne→ personnel soignant interne (lecture + saisie limitée)
  personnel_externe→ personnel externe / visiteur (lecture seule)
  responsable_centre → alias legacy de admin
"""
from datetime import datetime, date
from typing import Optional
import uuid as _uuid

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import os

from database import get_db
from models import (
    Centre, PersonnelCentre, Admission, RepasCentre,
    RessourceSD, PersonnelRole, RevenuCentre, DepenseCentre,
    StockPharmacieCentre, MouvementStockCentre,
)

SECRET_KEY = os.getenv("SECRET_KEY", "kolongono-dev-secret-change-me")
ALGORITHM  = "HS256"
_bearer    = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/centres", tags=["Centres de santé"])

# ── Niveaux d'accès ───────────────────────────────────────────────────────────
_ACCESS_LEVEL = {
    "superadmin":         5,
    "admin":              4,
    "responsable_centre": 4,
    "gestionnaire":       3,
    "personnel_interne":  2,
    "personnel_externe":  1,
}
_REQUIRED = {"read": 1, "write": 2, "manage": 3, "full": 4}

# Données statiques (référentiel, ne changent pas en cours d'exécution)
ROLES_CENTRE = {
    "admin":             {"label": "Administrateur local",  "acces": "full",   "couleur": "#1D4ED8", "peut": ["tout"]},
    "gestionnaire":      {"label": "Gestionnaire",          "acces": "manage", "couleur": "#7C3AED", "peut": ["comptabilite", "stock", "rapports", "personnel"]},
    "personnel_interne": {"label": "Personnel interne",     "acces": "write",  "couleur": "#059669", "peut": ["admissions", "dossiers", "pharmacie_lecture"]},
    "personnel_externe": {"label": "Personnel externe",     "acces": "read",   "couleur": "#D97706", "peut": ["admissions_lecture"]},
}

HISTORIQUE_IMPACT_SD = {
    "CTR-001": [
        {"mois": "Février 2026",  "consultations": 28, "revenus_usd":  50},
        {"mois": "Mars 2026",     "consultations": 42, "revenus_usd":  75},
        {"mois": "Avril 2026",    "consultations": 51, "revenus_usd":  91},
        {"mois": "Mai 2026",      "consultations": 47, "revenus_usd":  84},
    ]
}

HISTORIQUE_COMPTABLE = {
    "CTR-001": [
        {"mois": "Janv. 2026", "revenus_usd": 221, "depenses_usd": 211},
        {"mois": "Fév. 2026",  "revenus_usd": 245, "depenses_usd": 220},
        {"mois": "Mars 2026",  "revenus_usd": 264, "depenses_usd": 224},
        {"mois": "Avr. 2026",  "revenus_usd": 290, "depenses_usd": 237},
        {"mois": "Mai 2026",   "revenus_usd": 321, "depenses_usd": 457},
    ]
}

ACCORD_PARTENARIAT = {
    "CTR-001": {
        "date_signature": "2026-01-15",
        "referent_sd":    "Admin KOLONGONO",
        "contact_sd":     "admin@sante-direct-kolongono.cd",
        "conditions":     "Partage de ressources (auxiliaire + salle). Rémunération : $1.80/consultation via SantéDirect. Révisable trimestriellement.",
    }
}


# ── Auth helpers ──────────────────────────────────────────────────────────────

async def _get_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        return jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token invalide")


def _check_centre_access(current: dict, centre_id: str, access: str = "read"):
    role     = current.get("role", "")
    user_ctr = current.get("centre_id")
    level    = _ACCESS_LEVEL.get(role, 0)
    required = _REQUIRED.get(access, 1)

    if role == "superadmin":
        return

    if user_ctr != centre_id:
        raise HTTPException(403, "Accès refusé — ce centre n'est pas dans votre périmètre")

    if level < required:
        raise HTTPException(403, f"Droits insuffisants : rôle '{role}' ne permet pas '{access}'")


def _row(obj) -> dict:
    """Convertit un modèle SQLAlchemy en dict sérialisable."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Endpoints : centre ────────────────────────────────────────────────────────

@router.get("/{centre_id}", summary="Profil d'un centre de santé")
async def get_centre(
    centre_id: str,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    result = await db.execute(select(Centre).where(Centre.id == centre_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Centre introuvable")
    return _row(c)


@router.get("/{centre_id}/stats", summary="KPIs du jour")
async def get_stats(
    centre_id: str,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)

    today = date.today().isoformat()

    admissions_res = await db.execute(
        select(Admission).where(Admission.centre_id == centre_id, Admission.date == today)
    )
    admissions_jour = admissions_res.scalars().all()

    personnel_res = await db.execute(
        select(PersonnelCentre).where(
            PersonnelCentre.centre_id == centre_id,
            PersonnelCentre.statut == "actif",
        )
    )
    personnel_actif = personnel_res.scalars().all()

    ressources_res = await db.execute(
        select(RessourceSD).where(
            RessourceSD.centre_id == centre_id,
            RessourceSD.statut == "actif",
        )
    )
    ressources_sd = ressources_res.scalars().all()

    centre_res = await db.execute(select(Centre).where(Centre.id == centre_id))
    centre = centre_res.scalar_one_or_none()
    nb_lits = centre.nb_lits if centre else 0

    return {
        "admissions_jour":        len(admissions_jour),
        "en_attente_triage":      sum(1 for a in admissions_jour if a.statut == "en_attente"),
        "orientes":               sum(1 for a in admissions_jour if a.statut == "oriente"),
        "admis":                  sum(1 for a in admissions_jour if a.statut == "admis"),
        "sortis":                 sum(1 for a in admissions_jour if a.statut == "sorti"),
        "personnel_present":      len(personnel_actif),
        "lits_occupes":           sum(1 for a in admissions_jour if a.statut == "admis"),
        "lits_total":             nb_lits,
        "consultations_sd_mois":  sum(r.consultations_mois for r in ressources_sd if r.type != "salle"),
        "revenus_sd_mois_usd":    sum(r.revenus_mois_usd for r in ressources_sd),
        "auxiliaires_sd":         sum(1 for r in ressources_sd if r.type == "auxiliaire"),
        "salles_sd":              sum(1 for r in ressources_sd if r.type == "salle"),
        "medecins_sd":            sum(1 for r in ressources_sd if r.type == "medecin"),
    }


# ── Endpoints : personnel ─────────────────────────────────────────────────────

@router.get("/{centre_id}/personnel", summary="Liste du personnel")
async def get_personnel(
    centre_id: str,
    fonction: Optional[str] = Query(None),
    affecte_sd: Optional[bool] = Query(None),
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    q = select(PersonnelCentre).where(PersonnelCentre.centre_id == centre_id)
    if fonction:
        q = q.where(PersonnelCentre.fonction == fonction)
    if affecte_sd is not None:
        q = q.where(PersonnelCentre.affecte_sd == affecte_sd)
    result = await db.execute(q)
    rows = [_row(p) for p in result.scalars().all()]
    return {"personnel": rows, "total": len(rows)}


@router.patch("/{centre_id}/personnel/{personnel_id}/affectation-sd", summary="Affecter / retirer un membre à SantéDirect")
async def toggle_affectation_sd(
    centre_id: str,
    personnel_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    result = await db.execute(
        select(PersonnelCentre).where(
            PersonnelCentre.id == personnel_id,
            PersonnelCentre.centre_id == centre_id,
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Membre du personnel introuvable")

    p.affecte_sd = body.get("affecte_sd", not p.affecte_sd)
    if p.affecte_sd:
        p.date_affectation_sd = date.today().isoformat()
    else:
        p.date_affectation_sd     = None
        p.consultations_sd_mois   = 0

    await db.commit()
    return {"success": True, "personnel": _row(p)}


# ── Endpoints : admissions ────────────────────────────────────────────────────

@router.get("/{centre_id}/admissions", summary="Liste des admissions")
async def get_admissions(
    centre_id: str,
    statut: Optional[str] = Query(None),
    date_filtre: Optional[str] = Query(None, alias="date"),
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    q = select(Admission).where(Admission.centre_id == centre_id)
    if statut:
        q = q.where(Admission.statut == statut)
    if date_filtre:
        q = q.where(Admission.date == date_filtre)
    q = q.order_by(Admission.heure_arrivee.desc())
    result = await db.execute(q)
    rows = [_row(a) for a in result.scalars().all()]
    return {"admissions": rows, "total": len(rows)}


@router.post("/{centre_id}/admissions", summary="Enregistrer un nouveau patient")
async def creer_admission(
    centre_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    admission = Admission(
        id           = f"ADM-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        centre_id    = centre_id,
        patient_nom  = body.get("patient_nom", "Patient inconnu"),
        motif        = body.get("motif", ""),
        type         = body.get("type", "consultation"),
        triage       = None,
        statut       = "en_attente",
        heure_arrivee= datetime.now().strftime("%H:%M"),
        orientation  = None,
        via_sd       = False,
        date         = date.today().isoformat(),
    )
    db.add(admission)
    await db.commit()
    return {"success": True, "admission": _row(admission)}


@router.patch("/{centre_id}/admissions/{admission_id}/triage", summary="Triage et orientation d'un patient")
async def trier_patient(
    centre_id: str,
    admission_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    triage      = body.get("triage")
    orientation = body.get("orientation")
    statut      = body.get("statut", "oriente")

    if triage not in ("vert", "jaune", "rouge"):
        raise HTTPException(400, "Triage invalide. Valeurs acceptées : vert, jaune, rouge")

    result = await db.execute(
        select(Admission).where(
            Admission.id == admission_id,
            Admission.centre_id == centre_id,
        )
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Admission introuvable")

    a.triage      = triage
    a.statut      = statut
    a.orientation = orientation
    if orientation and "SD" in orientation:
        a.via_sd = True

    await db.commit()
    return {"success": True, "admission": _row(a)}


# ── Endpoints : réfectoire ────────────────────────────────────────────────────

@router.get("/{centre_id}/refectoire", summary="Historique réfectoire")
async def get_refectoire(
    centre_id: str,
    date_debut: Optional[str] = Query(None),
    date_fin: Optional[str] = Query(None),
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    q = select(RepasCentre).where(RepasCentre.centre_id == centre_id)
    if date_debut:
        q = q.where(RepasCentre.date >= date_debut)
    if date_fin:
        q = q.where(RepasCentre.date <= date_fin)
    q = q.order_by(RepasCentre.date.desc(), RepasCentre.type_repas)
    result = await db.execute(q)
    rows = [_row(r) for r in result.scalars().all()]
    total_couverts = sum(r["nb_personnel"] + r["nb_patients"] + r["nb_accompagnants"] for r in rows)
    total_cout = sum(r["cout_fc"] for r in rows)
    return {"repas": rows, "total_couverts": total_couverts, "total_cout_fc": total_cout}


@router.post("/{centre_id}/refectoire", summary="Enregistrer un repas")
async def enregistrer_repas(
    centre_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)
    repas = RepasCentre(
        id              = f"REF-{_uuid.uuid4().hex[:8].upper()}",
        centre_id       = centre_id,
        date            = body.get("date", date.today().isoformat()),
        type_repas      = body.get("type_repas", "dejeuner"),
        nb_personnel    = int(body.get("nb_personnel", 0)),
        nb_patients     = int(body.get("nb_patients", 0)),
        nb_accompagnants= int(body.get("nb_accompagnants", 0)),
        menu            = body.get("menu", ""),
        cout_fc         = int(body.get("cout_fc", 0)),
    )
    db.add(repas)
    await db.commit()
    return {"success": True, "repas": _row(repas)}


# ── Endpoints : impact SantéDirect ───────────────────────────────────────────

@router.get("/{centre_id}/impact-sante-direct", summary="Impact de l'activité SantéDirect sur le centre")
async def get_impact_sd(
    centre_id: str,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id)

    res_ress = await db.execute(
        select(RessourceSD).where(RessourceSD.centre_id == centre_id)
    )
    ressources = [_row(r) for r in res_ress.scalars().all()]

    res_adm = await db.execute(
        select(Admission).where(Admission.centre_id == centre_id, Admission.via_sd == True)
    )
    admissions_via_sd = res_adm.scalars().all()

    return {
        "ressources_pretees":        ressources,
        "nb_ressources_actives":     sum(1 for r in ressources if r["statut"] == "actif"),
        "consultations_via_sd_jour": len(admissions_via_sd),
        "consultations_total":       sum(r["consultations_total"] for r in ressources if r["type"] != "salle"),
        "revenus_total_usd":         sum(r["revenus_total_usd"] for r in ressources),
        "revenus_mois_usd":          sum(r["revenus_mois_usd"] for r in ressources),
        "historique_mensuel":        HISTORIQUE_IMPACT_SD.get(centre_id, []),
        "accord_partenariat":        ACCORD_PARTENARIAT.get(centre_id, {}),
    }


# ── Endpoints : rôles ─────────────────────────────────────────────────────────

@router.get("/{centre_id}/roles", summary="Définitions des rôles du centre")
async def get_roles(centre_id: str, current: dict = Depends(_get_user)):
    _check_centre_access(current, centre_id, "read")
    return {"roles": ROLES_CENTRE}


@router.get("/{centre_id}/personnel-roles", summary="Rôles assignés au personnel")
async def get_personnel_roles(
    centre_id: str,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "read")
    result = await db.execute(
        select(PersonnelRole).where(PersonnelRole.centre_id == centre_id)
    )
    rows = [_row(pr) for pr in result.scalars().all()]
    return {"personnel_roles": rows, "total": len(rows)}


@router.patch("/{centre_id}/personnel/{personnel_id}/role", summary="Modifier le rôle d'un membre")
async def update_personnel_role(
    centre_id: str,
    personnel_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "full")
    nouveau_role = body.get("role_centre")
    if nouveau_role not in ROLES_CENTRE:
        raise HTTPException(400, f"Rôle invalide. Valeurs : {', '.join(ROLES_CENTRE.keys())}")

    result = await db.execute(
        select(PersonnelRole).where(
            PersonnelRole.personnel_id == personnel_id,
            PersonnelRole.centre_id == centre_id,
        )
    )
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(404, "Membre introuvable dans ce centre")

    pr.role_centre = nouveau_role
    await db.commit()
    return {"success": True, "personnel_role": _row(pr)}


# ── Endpoints : comptabilité ──────────────────────────────────────────────────

@router.get("/{centre_id}/comptabilite", summary="Résumé comptable du mois courant")
async def get_comptabilite(
    centre_id: str,
    mois: Optional[str] = Query(None, description="Format YYYY-MM"),
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "manage")
    mois_cible = mois or date.today().strftime("%Y-%m")

    res_rev = await db.execute(
        select(RevenuCentre).where(
            RevenuCentre.centre_id == centre_id,
            RevenuCentre.mois == mois_cible,
        )
    )
    revenus_rows = [_row(r) for r in res_rev.scalars().all()]

    res_dep = await db.execute(
        select(DepenseCentre).where(
            DepenseCentre.centre_id == centre_id,
            DepenseCentre.mois == mois_cible,
        )
    )
    depenses_rows = [_row(d) for d in res_dep.scalars().all()]

    total_rev = sum(r["montant_usd"] for r in revenus_rows)
    total_dep = sum(d["montant_usd"] for d in depenses_rows)

    return {
        "mois":               mois_cible,
        "revenus_total_usd":  total_rev,
        "depenses_total_usd": total_dep,
        "benefice_usd":       total_rev - total_dep,
        "taux_couverture_pct": round(total_rev / total_dep * 100, 1) if total_dep else 0,
        "revenus_detail":    revenus_rows,
        "depenses_detail":   depenses_rows,
        "historique":        HISTORIQUE_COMPTABLE.get(centre_id, []),
    }


@router.post("/{centre_id}/comptabilite/depenses", summary="Ajouter une dépense")
async def ajouter_depense(
    centre_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "manage")
    mois_cible = body.get("mois", date.today().strftime("%Y-%m"))
    depense = DepenseCentre(
        id          = f"DEP-{_uuid.uuid4().hex[:6].upper()}",
        centre_id   = centre_id,
        mois        = mois_cible,
        categorie   = body.get("categorie", "Divers"),
        montant_usd = float(body.get("montant_usd", 0)),
        sous_detail = body.get("sous_detail", ""),
        date        = body.get("date", date.today().isoformat()),
    )
    db.add(depense)
    await db.commit()
    return {"success": True, "depense": _row(depense)}


@router.post("/{centre_id}/comptabilite/revenus", summary="Ajouter un revenu")
async def ajouter_revenu(
    centre_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "manage")
    mois_cible = body.get("mois", date.today().strftime("%Y-%m"))
    revenu = RevenuCentre(
        id          = f"REV-{_uuid.uuid4().hex[:6].upper()}",
        centre_id   = centre_id,
        mois        = mois_cible,
        categorie   = body.get("categorie", "Divers"),
        montant_usd = float(body.get("montant_usd", 0)),
        date        = body.get("date", date.today().isoformat()),
    )
    db.add(revenu)
    await db.commit()
    return {"success": True, "revenu": _row(revenu)}


# ── Endpoints : stock pharmacie ───────────────────────────────────────────────

@router.get("/{centre_id}/stock", summary="Stock complet de la pharmacie du centre")
async def get_stock(
    centre_id: str,
    categorie: Optional[str] = Query(None),
    alerte_seulement: Optional[bool] = Query(False),
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "read")
    q = select(StockPharmacieCentre).where(StockPharmacieCentre.centre_id == centre_id)
    if categorie:
        q = q.where(StockPharmacieCentre.categorie.ilike(f"%{categorie}%"))
    if alerte_seulement:
        q = q.where(StockPharmacieCentre.stock <= StockPharmacieCentre.seuil)
    result = await db.execute(q)
    rows = [_row(s) for s in result.scalars().all()]
    total_valeur = sum(s["stock"] * s["prix_vente_usd"] for s in rows)
    nb_alertes   = sum(1 for s in rows if s["stock"] <= s["seuil"])
    return {
        "stock":            rows,
        "total":            len(rows),
        "valeur_totale_usd":total_valeur,
        "nb_alertes":       nb_alertes,
        "nb_critique":      sum(1 for s in rows if s["stock"] <= s["seuil"] // 2),
    }


@router.post("/{centre_id}/stock/entree", summary="Enregistrer une entrée de stock")
async def entree_stock(
    centre_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "write")
    stock_id = body.get("stock_id")
    quantite = int(body.get("quantite", 0))
    if quantite <= 0:
        raise HTTPException(400, "Quantité doit être > 0")

    result = await db.execute(
        select(StockPharmacieCentre).where(
            StockPharmacieCentre.id == stock_id,
            StockPharmacieCentre.centre_id == centre_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Référence de stock introuvable")

    item.stock += quantite
    mouvement = MouvementStockCentre(
        id         = f"MOV-{_uuid.uuid4().hex[:6].upper()}",
        centre_id  = centre_id,
        stock_id   = stock_id,
        type       = "entree",
        quantite   = quantite,
        motif      = body.get("motif", "Réapprovisionnement"),
        agent      = body.get("agent", "Système"),
        patient    = None,
        date       = date.today().isoformat(),
    )
    db.add(mouvement)
    await db.commit()
    return {"success": True, "stock_apres": item.stock, "mouvement": _row(mouvement)}


@router.post("/{centre_id}/stock/sortie", summary="Enregistrer une sortie de stock (dispensation)")
async def sortie_stock(
    centre_id: str,
    body: dict,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "write")
    stock_id = body.get("stock_id")
    quantite = int(body.get("quantite", 0))
    if quantite <= 0:
        raise HTTPException(400, "Quantité doit être > 0")

    result = await db.execute(
        select(StockPharmacieCentre).where(
            StockPharmacieCentre.id == stock_id,
            StockPharmacieCentre.centre_id == centre_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Référence de stock introuvable")

    if item.stock < quantite:
        raise HTTPException(409, f"Stock insuffisant : {item.stock} disponibles, {quantite} demandés")

    item.stock -= quantite
    mouvement = MouvementStockCentre(
        id        = f"MOV-{_uuid.uuid4().hex[:6].upper()}",
        centre_id = centre_id,
        stock_id  = stock_id,
        type      = "sortie",
        quantite  = quantite,
        motif     = body.get("motif", "Dispensation"),
        agent     = body.get("agent", ""),
        patient   = body.get("patient", ""),
        date      = date.today().isoformat(),
    )
    db.add(mouvement)
    await db.commit()
    return {"success": True, "stock_apres": item.stock, "mouvement": _row(mouvement)}


@router.get("/{centre_id}/stock/mouvements", summary="Historique des mouvements de stock")
async def get_mouvements(
    centre_id: str,
    type_mouvement: Optional[str] = Query(None, alias="type"),
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    _check_centre_access(current, centre_id, "read")
    q = select(MouvementStockCentre).where(MouvementStockCentre.centre_id == centre_id)
    if type_mouvement:
        q = q.where(MouvementStockCentre.type == type_mouvement)
    q = q.order_by(MouvementStockCentre.date.desc())
    result = await db.execute(q)
    rows = [_row(m) for m in result.scalars().all()]
    return {"mouvements": rows, "total": len(rows)}

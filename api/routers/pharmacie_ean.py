"""
Gestion EAN médicaments — lookup, enregistrement, mouvements de stock
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
import json, os

from database import get_db_sync as get_db

router = APIRouter(prefix="/api/pharmacie", tags=["Pharmacie EAN"])


# ─── Schémas ────────────────────────────────────────────────────────────────

class MedicamentCreate(BaseModel):
    ean: Optional[str] = None
    code_interne: Optional[str] = None
    nom: str
    dci: Optional[str] = None
    dosage: Optional[str] = None
    forme: Optional[str] = None
    unite_boite: Optional[int] = 1
    fabricant: Optional[str] = None
    categorie: Optional[str] = None
    prescription: bool = False
    prix_usd: Optional[float] = None
    source: str = "manuel"          # 'manuel' | 'scan_ean' | 'import_csv' | 'api_fr'
    cree_par: Optional[str] = None  # centre_id

class EntreeStockRequest(BaseModel):
    centre_id: str
    ean: Optional[str] = None
    code_interne: Optional[str] = None
    quantite: int
    date_peremption: Optional[date] = None
    numero_lot: Optional[str] = None
    fournisseur: Optional[str] = None
    prix_unitaire: Optional[float] = None
    operateur: str

class SortieStockRequest(BaseModel):
    centre_id: str
    ean: Optional[str] = None
    code_interne: Optional[str] = None
    quantite: int
    motif: str          # 'ordonnance' | 'urgence' | 'perimé' | 'casse' | 'autre'
    reference: Optional[str] = None   # ex: "ORD-042" si lié à une ordonnance
    operateur: str


# ─── Lookup EAN ─────────────────────────────────────────────────────────────

@router.get("/ean/search")
def search_medicament(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db)
):
    """Recherche textuelle par nom ou DCI (pour saisie manuelle assistée)."""
    from models import MedicamentEAN
    results = (
        db.query(MedicamentEAN)
        .filter(
            MedicamentEAN.nom.ilike(f"%{q}%") |
            MedicamentEAN.dci.ilike(f"%{q}%")
        )
        .limit(10)
        .all()
    )
    return results


@router.get("/ean/list")
def list_medicaments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=200),
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from models import MedicamentEAN, StockPharmacie
    from sqlalchemy import func

    query = db.query(MedicamentEAN)
    if q:
        query = query.filter(
            MedicamentEAN.nom.ilike(f"%{q}%") |
            MedicamentEAN.dci.ilike(f"%{q}%") |
            MedicamentEAN.categorie.ilike(f"%{q}%")
        )
    total = query.count()
    meds = query.order_by(MedicamentEAN.nom).offset(skip).limit(limit).all()

    codes = [m.code_interne for m in meds]
    stock_map = {}
    if codes:
        rows = (
            db.query(StockPharmacie.medicament_code, func.sum(StockPharmacie.quantite).label("total"))
            .filter(StockPharmacie.medicament_code.in_(codes))
            .group_by(StockPharmacie.medicament_code)
            .all()
        )
        stock_map = {r.medicament_code: int(r.total) for r in rows}

    items = [
        {
            "code":         m.code_interne,
            "ean":          m.ean,
            "nom":          m.nom,
            "dci":          m.dci,
            "dosage":       m.dosage,
            "forme":        m.forme,
            "categorie":    m.categorie,
            "prescription": m.prescription,
            "prix_usd":     m.prix_usd,
            "stock_total":  stock_map.get(m.code_interne, 0),
        }
        for m in meds
    ]
    return {"total": total, "items": items, "skip": skip, "limit": limit}


@router.get("/ean/{code}")
def lookup_ean(code: str, db: Session = Depends(get_db)):
    """
    Lookup par EAN-13 ou code_interne (QR Code maison).
    Retourne le médicament si connu, 404 sinon (→ l'app propose la saisie).
    """
    from models import MedicamentEAN
    med = (
        db.query(MedicamentEAN)
        .filter(
            (MedicamentEAN.ean == code) |
            (MedicamentEAN.code_interne == code)
        )
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="EAN inconnu — enregistrement requis")
    return med


# ─── Enregistrement d'un nouveau médicament ─────────────────────────────────

@router.post("/ean", status_code=201)
def creer_medicament(payload: MedicamentCreate, db: Session = Depends(get_db)):
    """
    Crée une nouvelle référence médicament (appelé quand EAN inconnu).
    Le code_interne est généré automatiquement si absent.
    """
    from models import MedicamentEAN

    # Vérifier doublon EAN
    if payload.ean:
        existing = db.query(MedicamentEAN).filter(MedicamentEAN.ean == payload.ean).first()
        if existing:
            raise HTTPException(status_code=409, detail="EAN déjà enregistré")

    # Générer code_interne si absent
    code_interne = payload.code_interne
    if not code_interne:
        count = db.query(MedicamentEAN).count()
        code_interne = f"MED-{count + 1:03d}"

    med = MedicamentEAN(
        ean=payload.ean,
        code_interne=code_interne,
        nom=payload.nom,
        dci=payload.dci,
        dosage=payload.dosage,
        forme=payload.forme,
        unite_boite=payload.unite_boite or 1,
        fabricant=payload.fabricant,
        categorie=payload.categorie,
        prescription=payload.prescription,
        prix_usd=payload.prix_usd,
        source=payload.source,
        cree_par=payload.cree_par,
        cree_le=datetime.utcnow()
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


# ─── Mouvements de stock ─────────────────────────────────────────────────────

@router.post("/stock/entree")
def entree_stock(payload: EntreeStockRequest, db: Session = Depends(get_db)):
    """Réceptionner un lot de médicaments (scan ou saisie manuelle)."""
    from models import MedicamentEAN, StockPharmacie, MouvementStock

    # Identifier le médicament
    code = payload.ean or payload.code_interne
    med = (
        db.query(MedicamentEAN)
        .filter(
            (MedicamentEAN.ean == code) |
            (MedicamentEAN.code_interne == code)
        )
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Médicament non trouvé")

    # Créer ou mettre à jour le stock du centre
    stock = (
        db.query(StockPharmacie)
        .filter(
            StockPharmacie.centre_id == payload.centre_id,
            StockPharmacie.medicament_code == med.code_interne
        )
        .first()
    )
    if stock:
        stock.quantite += payload.quantite
        if payload.date_peremption:
            stock.date_peremption = payload.date_peremption
        if payload.prix_unitaire:
            stock.prix_unitaire = payload.prix_unitaire
        stock.derniere_maj = datetime.utcnow()
    else:
        stock = StockPharmacie(
            centre_id=payload.centre_id,
            medicament_code=med.code_interne,
            quantite=payload.quantite,
            date_peremption=payload.date_peremption,
            prix_unitaire=payload.prix_unitaire or med.prix_usd,
            derniere_maj=datetime.utcnow()
        )
        db.add(stock)

    # Tracer le mouvement
    mvt = MouvementStock(
        centre_id=payload.centre_id,
        medicament_code=med.code_interne,
        type="entree",
        quantite=payload.quantite,
        motif=f"Livraison — lot {payload.numero_lot or '—'} — {payload.fournisseur or '—'}",
        operateur=payload.operateur,
        horodatage=datetime.utcnow()
    )
    db.add(mvt)
    db.commit()

    return {
        "status": "ok",
        "medicament": med.nom,
        "nouveau_stock": stock.quantite
    }


@router.post("/stock/sortie")
def sortie_stock(payload: SortieStockRequest, db: Session = Depends(get_db)):
    """Enregistrer une sortie de stock (dispensation, perte, péremption)."""
    from models import MedicamentEAN, StockPharmacie, MouvementStock

    code = payload.ean or payload.code_interne
    med = (
        db.query(MedicamentEAN)
        .filter(
            (MedicamentEAN.ean == code) |
            (MedicamentEAN.code_interne == code)
        )
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Médicament non trouvé")

    stock = (
        db.query(StockPharmacie)
        .filter(
            StockPharmacie.centre_id == payload.centre_id,
            StockPharmacie.medicament_code == med.code_interne
        )
        .first()
    )
    if not stock or stock.quantite < payload.quantite:
        raise HTTPException(status_code=400, detail="Stock insuffisant")

    stock.quantite -= payload.quantite
    stock.derniere_maj = datetime.utcnow()

    mvt = MouvementStock(
        centre_id=payload.centre_id,
        medicament_code=med.code_interne,
        type="sortie",
        quantite=payload.quantite,
        motif=f"{payload.motif} — {payload.reference or '—'}",
        operateur=payload.operateur,
        horodatage=datetime.utcnow()
    )
    db.add(mvt)
    db.commit()

    return {
        "status": "ok",
        "medicament": med.nom,
        "stock_restant": stock.quantite,
        "alerte": stock.quantite <= (stock.seuil_alerte or 5)
    }


@router.get("/stock/{centre_id}")
def get_stock_centre(centre_id: str, db: Session = Depends(get_db)):
    """Stock complet d'un centre avec alertes."""
    from models import StockPharmacie, MedicamentEAN
    from sqlalchemy import join

    rows = (
        db.query(StockPharmacie, MedicamentEAN)
        .join(MedicamentEAN, StockPharmacie.medicament_code == MedicamentEAN.code_interne)
        .filter(StockPharmacie.centre_id == centre_id)
        .all()
    )

    result = []
    today = date.today()
    for stock, med in rows:
        jours_peremption = None
        if stock.date_peremption:
            jours_peremption = (stock.date_peremption - today).days

        result.append({
            "code": med.code_interne,
            "ean": med.ean,
            "nom": med.nom,
            "dci": med.dci,
            "dosage": med.dosage,
            "forme": med.forme,
            "quantite": stock.quantite,
            "seuil_alerte": stock.seuil_alerte,
            "prix_unitaire": stock.prix_unitaire,
            "date_peremption": stock.date_peremption,
            "jours_peremption": jours_peremption,
            "alerte_stock": stock.quantite <= (stock.seuil_alerte or 5),
            "alerte_peremption": jours_peremption is not None and jours_peremption <= 30,
        })

    return result


@router.get("/stock/{centre_id}/mouvements")
def get_mouvements(
    centre_id: str,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Historique des mouvements de stock (traçabilité)."""
    from models import MouvementStock, MedicamentEAN

    rows = (
        db.query(MouvementStock, MedicamentEAN)
        .join(MedicamentEAN, MouvementStock.medicament_code == MedicamentEAN.code_interne)
        .filter(MouvementStock.centre_id == centre_id)
        .order_by(MouvementStock.horodatage.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": mvt.id,
            "type": mvt.type,
            "medicament": med.nom,
            "quantite": mvt.quantite,
            "motif": mvt.motif,
            "operateur": mvt.operateur,
            "horodatage": mvt.horodatage,
        }
        for mvt, med in rows
    ]


# ─── Import base de départ ────────────────────────────────────────────────────

@router.post("/ean/import-base", status_code=201)
def importer_base_medicaments(db: Session = Depends(get_db)):
    """
    Charge les 50 médicaments de base depuis api/data/medicaments_base.json.
    À appeler une seule fois au déploiement initial.
    """
    from models import MedicamentEAN

    json_path = os.path.join(os.path.dirname(__file__), "..", "data", "medicaments_base.json")
    with open(json_path, encoding="utf-8") as f:
        medicaments = json.load(f)

    created, skipped = 0, 0
    for m in medicaments:
        existing = db.query(MedicamentEAN).filter(
            MedicamentEAN.code_interne == m["code_interne"]
        ).first()
        if existing:
            skipped += 1
            continue
        med = MedicamentEAN(
            code_interne=m["code_interne"],
            ean=m.get("ean") or None,
            nom=m["nom"],
            dci=m.get("dci"),
            dosage=m.get("dosage"),
            forme=m.get("forme"),
            unite_boite=m.get("unite_boite", 1),
            fabricant=m.get("fabricant"),
            categorie=m.get("categorie"),
            prescription=m.get("prescription", False),
            prix_usd=m.get("prix_usd"),
            source="import_csv",
            cree_par="system",
            cree_le=datetime.utcnow()
        )
        db.add(med)
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped}

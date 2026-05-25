"""
Unités sanitaires partenaires — dispensaires, cliniques, centres de santé.
Gestion administrative complète : personnel, stock, activité.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/unites", tags=["Unités Sanitaires"])

# ─── Modèles ─────────────────────────────────────────────────────────────────

class UniteCreate(BaseModel):
    nom: str
    type: str           # dispensaire | clinique | centre_sante | pharmacie_partenaire | poste_sante
    zone: str           # Quartier / commune
    adresse: str
    telephone: str
    responsable_nom: str
    capacite_lits: int = 0
    services: List[str] = []

class UniteUpdate(BaseModel):
    nom: Optional[str]            = None
    telephone: Optional[str]      = None
    adresse: Optional[str]        = None
    services: Optional[List[str]] = None
    statut: Optional[str]         = None
    capacite_lits: Optional[int]  = None

class PersonnelAssign(BaseModel):
    utilisateur_id: int
    role: str   # auxiliaire | medecin | responsable | pharmacien

class MouvementStockCreate(BaseModel):
    produit_id: int
    unite_id: Optional[int]     = None
    type_mouvement: str          # entree | sortie | inventaire | transfert | peremption
    quantite: int
    motif: Optional[str]        = None
    ordonnance_id: Optional[int] = None
    scan_qr: bool = False

# ─── Données démo ─────────────────────────────────────────────────────────────

_UNITES: list = [
    {
        "id": 1, "nom": "Dispensaire Kolongono Centre",
        "type": "dispensaire", "zone": "Kolongono Centre",
        "adresse": "Avenue de la Santé, Q. Centre, Kolongono",
        "telephone": "+243 81 000 0001",
        "responsable_nom": "Inf. Marie Mukeba", "responsable_id": 10,
        "statut": "actif", "capacite_lits": 8,
        "services": ["teleconsultation", "soins_primaires", "vaccinations", "pharmacie", "maternite"],
        "qr_code": "KOLO:UNITE:1",
        "horaires": {"lun_ven": "07h–18h", "sam": "07h–13h", "dim": "Fermé"},
        "stats": {"consultations_mois": 47, "medicaments_dispenses": 134, "personnel_actif": 3},
        "created_at": "2026-01-10T08:00:00",
    },
    {
        "id": 2, "nom": "Clinique Sainte-Anne",
        "type": "clinique", "zone": "Kolongono Nord",
        "adresse": "Boulevard Lumumba 42, Kolongono Nord",
        "telephone": "+243 81 000 0002",
        "responsable_nom": "Dr. Jean Kabila", "responsable_id": 11,
        "statut": "actif", "capacite_lits": 20,
        "services": ["teleconsultation", "soins_primaires", "chirurgie_mineure", "pharmacie", "radiologie"],
        "qr_code": "KOLO:UNITE:2",
        "horaires": {"lun_ven": "06h–20h", "sam": "07h–16h", "dim": "07h–12h"},
        "stats": {"consultations_mois": 89, "medicaments_dispenses": 267, "personnel_actif": 6},
        "created_at": "2026-01-15T08:00:00",
    },
    {
        "id": 3, "nom": "Poste de santé Kibali",
        "type": "poste_sante", "zone": "Kibali",
        "adresse": "Route de Kibali, Kolongono Est",
        "telephone": "+243 97 000 0003",
        "responsable_nom": "Inf. Paul Mwamba", "responsable_id": 12,
        "statut": "actif", "capacite_lits": 4,
        "services": ["soins_primaires", "vaccinations", "pharmacie"],
        "qr_code": "KOLO:UNITE:3",
        "horaires": {"lun_sam": "07h–15h", "dim": "Urgences seulement"},
        "stats": {"consultations_mois": 28, "medicaments_dispenses": 61, "personnel_actif": 2},
        "created_at": "2026-02-01T08:00:00",
    },
    {
        "id": 4, "nom": "Pharmacie Croix-Verte",
        "type": "pharmacie_partenaire", "zone": "Marché Central",
        "adresse": "Av. Commerce 17, Marché Central",
        "telephone": "+243 81 000 0004",
        "responsable_nom": "Pharm. Solange Tshimu", "responsable_id": 13,
        "statut": "actif", "capacite_lits": 0,
        "services": ["pharmacie", "conseil_medicament"],
        "qr_code": "KOLO:UNITE:4",
        "horaires": {"lun_sam": "08h–20h", "dim": "09h–14h"},
        "stats": {"consultations_mois": 0, "medicaments_dispenses": 412, "personnel_actif": 2},
        "created_at": "2026-03-01T08:00:00",
    },
]

_PERSONNEL: list = [
    {"id": 1, "unite_id": 1, "utilisateur_id": 10, "nom": "Marie Mukeba",    "role": "responsable",  "telephone": "+243 81 000 0010", "statut": "actif"},
    {"id": 2, "unite_id": 1, "utilisateur_id": 20, "nom": "Antoine Banza",   "role": "auxiliaire",   "telephone": "+243 81 000 0020", "statut": "actif"},
    {"id": 3, "unite_id": 1, "utilisateur_id": 21, "nom": "Cécile Nkusu",    "role": "auxiliaire",   "telephone": "+243 97 000 0021", "statut": "actif"},
    {"id": 4, "unite_id": 2, "utilisateur_id": 11, "nom": "Jean Kabila",     "role": "medecin",      "telephone": "+243 81 000 0011", "statut": "actif"},
    {"id": 5, "unite_id": 2, "utilisateur_id": 22, "nom": "Bernadette Ilunga","role": "auxiliaire",  "telephone": "+243 81 000 0022", "statut": "actif"},
    {"id": 6, "unite_id": 3, "utilisateur_id": 12, "nom": "Paul Mwamba",     "role": "responsable",  "telephone": "+243 97 000 0012", "statut": "actif"},
]

_MOUVEMENTS: list = [
    {"id": 1, "produit_id": 1, "produit_nom": "Paracétamol 500mg", "unite_id": 1,
     "type_mouvement": "entree", "quantite": 200, "quantite_avant": 50, "quantite_apres": 250,
     "motif": "Réapprovisionnement mensuel", "utilisateur_nom": "Inf. Mukeba",
     "scan_qr": True, "created_at": "2026-05-20T09:00:00"},
    {"id": 2, "produit_id": 3, "produit_nom": "Amoxicilline 500mg", "unite_id": 1,
     "type_mouvement": "sortie", "quantite": 12, "quantite_avant": 80, "quantite_apres": 68,
     "motif": "Dispensation ordonnance #ORD-2026-045", "utilisateur_nom": "Inf. Banza",
     "scan_qr": True, "created_at": "2026-05-21T11:30:00"},
    {"id": 3, "produit_id": 5, "produit_nom": "Artemether+Luméfantrine", "unite_id": 2,
     "type_mouvement": "entree", "quantite": 100, "quantite_avant": 20, "quantite_apres": 120,
     "motif": "Réapprovisionnement", "utilisateur_nom": "Pharm. Tshimu",
     "scan_qr": False, "created_at": "2026-05-21T14:00:00"},
    {"id": 4, "produit_id": 2, "produit_nom": "SRO / Sels réhydratation", "unite_id": 3,
     "type_mouvement": "sortie", "quantite": 5, "quantite_avant": 30, "quantite_apres": 25,
     "motif": "Dispensation patient", "utilisateur_nom": "Inf. Mwamba",
     "scan_qr": True, "created_at": "2026-05-22T08:15:00"},
    {"id": 5, "produit_id": 6, "produit_nom": "TDR Paludisme", "unite_id": 1,
     "type_mouvement": "inventaire", "quantite": -5, "quantite_avant": 45, "quantite_apres": 40,
     "motif": "Correction inventaire mensuel", "utilisateur_nom": "Inf. Mukeba",
     "scan_qr": False, "created_at": "2026-05-22T09:00:00"},
]

_next_unite_id   = 5
_next_perso_id   = 7
_next_mouv_id    = 6

# ─── Endpoints — Unités ───────────────────────────────────────────────────────

@router.get("")
def lister_unites(type: Optional[str] = None, statut: Optional[str] = "actif"):
    result = _UNITES
    if type:
        result = [u for u in result if u["type"] == type]
    if statut:
        result = [u for u in result if u["statut"] == statut]
    return {"unites": result, "total": len(result)}


@router.post("", status_code=201)
def creer_unite(data: UniteCreate):
    global _next_unite_id
    unite_id = _next_unite_id
    _next_unite_id += 1
    unite = {
        "id": unite_id,
        "nom": data.nom,
        "type": data.type,
        "zone": data.zone,
        "adresse": data.adresse,
        "telephone": data.telephone,
        "responsable_nom": data.responsable_nom,
        "responsable_id": None,
        "statut": "actif",
        "capacite_lits": data.capacite_lits,
        "services": data.services,
        "qr_code": f"KOLO:UNITE:{unite_id}",
        "horaires": {},
        "stats": {"consultations_mois": 0, "medicaments_dispenses": 0, "personnel_actif": 0},
        "created_at": datetime.now().isoformat(),
    }
    _UNITES.append(unite)
    return unite


@router.get("/{unite_id}")
def detail_unite(unite_id: int):
    unite = next((u for u in _UNITES if u["id"] == unite_id), None)
    if not unite:
        raise HTTPException(404, "Unité non trouvée")
    return unite


@router.put("/{unite_id}")
def modifier_unite(unite_id: int, data: UniteUpdate):
    unite = next((u for u in _UNITES if u["id"] == unite_id), None)
    if not unite:
        raise HTTPException(404, "Unité non trouvée")
    update = data.model_dump(exclude_none=True)
    unite.update(update)
    return unite


@router.delete("/{unite_id}/archiver")
def archiver_unite(unite_id: int):
    unite = next((u for u in _UNITES if u["id"] == unite_id), None)
    if not unite:
        raise HTTPException(404, "Unité non trouvée")
    unite["statut"] = "archive"
    return {"message": "Unité archivée", "id": unite_id}


# ─── Personnel d'une unité ───────────────────────────────────────────────────

@router.get("/{unite_id}/personnel")
def personnel_unite(unite_id: int):
    staff = [p for p in _PERSONNEL if p["unite_id"] == unite_id]
    return {"personnel": staff, "total": len(staff)}


@router.post("/{unite_id}/personnel", status_code=201)
def affecter_personnel(unite_id: int, data: PersonnelAssign):
    global _next_perso_id
    if not any(u["id"] == unite_id for u in _UNITES):
        raise HTTPException(404, "Unité non trouvée")
    entry = {
        "id": _next_perso_id,
        "unite_id": unite_id,
        "utilisateur_id": data.utilisateur_id,
        "nom": f"Utilisateur #{data.utilisateur_id}",
        "role": data.role,
        "telephone": "",
        "statut": "actif",
    }
    _next_perso_id += 1
    _PERSONNEL.append(entry)
    return entry


@router.delete("/{unite_id}/personnel/{utilisateur_id}")
def retirer_personnel(unite_id: int, utilisateur_id: int):
    global _PERSONNEL
    _PERSONNEL = [p for p in _PERSONNEL if not (p["unite_id"] == unite_id and p["utilisateur_id"] == utilisateur_id)]
    return {"message": "Personnel retiré"}


# ─── Stock d'une unité ────────────────────────────────────────────────────────

@router.get("/{unite_id}/stock")
def stock_unite(unite_id: int):
    mouvements = [m for m in _MOUVEMENTS if m.get("unite_id") == unite_id]
    # Calculer stock par produit depuis les mouvements
    stock_map: dict = {}
    for m in sorted(mouvements, key=lambda x: x["created_at"]):
        pid = m["produit_id"]
        stock_map[pid] = {
            "produit_id": pid,
            "produit_nom": m["produit_nom"],
            "quantite": m["quantite_apres"],
            "dernier_mouvement": m["created_at"],
        }
    stock = list(stock_map.values())
    return {"unite_id": unite_id, "stock": stock, "nb_produits": len(stock)}


# ─── Activité d'une unité ────────────────────────────────────────────────────

@router.get("/{unite_id}/stats")
def stats_unite(unite_id: int):
    unite = next((u for u in _UNITES if u["id"] == unite_id), None)
    if not unite:
        raise HTTPException(404, "Unité non trouvée")
    mouvements = [m for m in _MOUVEMENTS if m.get("unite_id") == unite_id]
    return {
        "unite_id": unite_id,
        "stats_mois": unite.get("stats", {}),
        "mouvements_recents": mouvements[-5:][::-1],
        "nb_personnel": len([p for p in _PERSONNEL if p["unite_id"] == unite_id]),
    }


# ─── Endpoints — Mouvements de stock (déplacés ici car liés aux unités) ───────

movements_router = APIRouter(prefix="/api/pharmacie", tags=["Pharmacie — Stock"])


@movements_router.get("/mouvements")
def lister_mouvements(
    unite_id: Optional[int]   = None,
    produit_id: Optional[int] = None,
    type_mouvement: Optional[str] = None,
    limit: int = 50,
):
    result = _MOUVEMENTS
    if unite_id:
        result = [m for m in result if m.get("unite_id") == unite_id]
    if produit_id:
        result = [m for m in result if m["produit_id"] == produit_id]
    if type_mouvement:
        result = [m for m in result if m["type_mouvement"] == type_mouvement]
    return {"mouvements": result[::-1][:limit], "total": len(result)}


@movements_router.post("/mouvements", status_code=201)
def creer_mouvement(data: MouvementStockCreate):
    global _next_mouv_id
    mouv = {
        "id": _next_mouv_id,
        "produit_id": data.produit_id,
        "produit_nom": f"Produit #{data.produit_id}",
        "unite_id": data.unite_id,
        "type_mouvement": data.type_mouvement,
        "quantite": data.quantite,
        "quantite_avant": 0,   # calculé en prod via DB
        "quantite_apres": 0,
        "motif": data.motif or "",
        "utilisateur_nom": "Admin",
        "ordonnance_id": data.ordonnance_id,
        "scan_qr": data.scan_qr,
        "created_at": datetime.now().isoformat(),
    }
    _next_mouv_id += 1
    _MOUVEMENTS.append(mouv)
    return mouv


@movements_router.post("/qr/decode")
def decoder_qr(payload: dict):
    """Décode un QR code Kolongono et retourne l'entité correspondante."""
    raw = payload.get("raw", "")
    import re
    match = re.match(r'^KOLO:(PROD|ORD|PAT|UNITE):(\d+)(?::(.+))?$', raw)
    if not match:
        if re.match(r'^\d{8,14}$', raw):
            return {"type": "barcode", "code": raw, "message": "Code-barre EAN — recherche produit nécessaire"}
        raise HTTPException(400, "Format QR non reconnu")

    type_map = {"PROD": "produit", "ORD": "ordonnance", "PAT": "patient", "UNITE": "unite"}
    entity_type = type_map[match.group(1)]
    entity_id   = int(match.group(2))

    if entity_type == "unite":
        unite = next((u for u in _UNITES if u["id"] == entity_id), None)
        if not unite:
            raise HTTPException(404, "Unité non trouvée")
        return {"type": "unite", "id": entity_id, "data": unite}

    return {"type": entity_type, "id": entity_id, "raw": raw}

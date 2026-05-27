"""
SANTÉ DIRECT — KOLONGONO
API de santé communautaire : téléconsultation + mutuelle + pharmacie
Port : 8002
"""
import os
import uuid
import time
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db, AsyncSessionLocal
from models import User, RendezVous, Ordonnance, Abonnement, Cotisation, Diagnostic, RevenuCentre, DepenseCentre

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "kolongono-dev-secret-change-me")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

# Jitsi Meet — utiliser meet.jit.si (public) ou auto-héberger sur jitsi.santedirect-kolongono.cd
JITSI_DOMAIN = os.getenv("JITSI_DOMAIN", "meet.jit.si")


def _create_video_room(room_name: str) -> str:
    """URL de salle Jitsi Meet — pas de token requis, accès libre par nom de salle."""
    return f"https://{JITSI_DOMAIN}/{room_name}"

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer   = HTTPBearer(auto_error=False)

# ─── WebSocket signaling (fallback si Jitsi indisponible côté réseau) ────────

class SignalingRoom:
    def __init__(self):
        self.participants: dict[str, WebSocket] = {}
        self.started_at = datetime.now()

class SignalingServer:
    def __init__(self):
        self.rooms: dict[str, SignalingRoom] = {}

    def get_or_create(self, room_id: str) -> SignalingRoom:
        if room_id not in self.rooms:
            self.rooms[room_id] = SignalingRoom()
        return self.rooms[room_id]

    def room_count(self) -> int:
        return len(self.rooms)

signaling = SignalingServer()


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def create_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        return decode_token(creds.credentials)
    except JWTError:
        raise HTTPException(401, "Token invalide")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SantéDirect — Kolongono",
    description="API de santé communautaire : mutuelle, téléconsultation, pharmacie en ligne",
    version="1.1.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://santedirect.kolongono.org",
        "https://longonia.org",
        "http://localhost:3000",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def seed_demo_users():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            return
        for u in USERS_DEMO:
            db.add(User(
                id=u["id"], email=u["email"], password_hash=u["password"],
                nom=u["nom"], prenom=u["prenom"], role=u["role"],
                centre_id=u.get("centre_id"), plan=u.get("plan"), actif=u.get("actif", True),
            ))
        await db.commit()

# ─── Données démo (à migrer vers PostgreSQL) ──────────────────────────────────

USERS_DEMO = [
    {"id": "ADH-001",      "prenom": "Marie",    "nom": "KABONGO",  "email": "marie@test.cd",    "role": "adherent",           "password": pwd_context.hash("demo1234"),  "plan": "famille", "actif": True,  "centre_id": None},
    {"id": "AUX-001",      "prenom": "Jean",     "nom": "MUKEBA",   "email": "jean@test.cd",     "role": "auxiliaire",         "password": pwd_context.hash("demo1234"),  "plan": None,      "actif": True,  "centre_id": None},
    {"id": "MED-001",      "prenom": "Emmanuel", "nom": "LUKUSA",   "email": "dr.lukusa@test.cd","role": "medecin",            "password": pwd_context.hash("demo1234"),  "plan": None,      "actif": True,  "centre_id": None},
    {"id": "ADM-001",      "prenom": "Admin",       "nom": "KOLONGONO", "email": "admin@test.cd",       "role": "superadmin",        "password": pwd_context.hash("admin1234"), "plan": None, "actif": True, "centre_id": None},
    {"id": "CTR-ADM-001",  "prenom": "Monique",     "nom": "NDAYA",     "email": "centre@test.cd",      "role": "admin",             "password": pwd_context.hash("admin1234"), "plan": None, "actif": True, "centre_id": "CTR-001"},
    {"id": "CTR-GES-001",  "prenom": "Joseph",      "nom": "MBUYI",     "email": "gest.ctr@test.cd",    "role": "gestionnaire",      "password": pwd_context.hash("demo1234"),  "plan": None, "actif": True, "centre_id": "CTR-001"},
    {"id": "CTR-INT-001",  "prenom": "Marie-Claire","nom": "NZINGA",    "email": "mc.nzinga@test.cd",   "role": "personnel_interne", "password": pwd_context.hash("demo1234"),  "plan": None, "actif": True, "centre_id": "CTR-001"},
    {"id": "CTR-EXT-001",  "prenom": "Dr. André",   "nom": "MBEKI",     "email": "dr.mbeki@test.cd",    "role": "personnel_externe", "password": pwd_context.hash("demo1234"),  "plan": None, "actif": True, "centre_id": "CTR-001"},
]

MEDECINS_DEMO = [
    {"id": "MED-001", "prenom": "Emmanuel", "nom": "LUKUSA",    "specialite": "Médecine générale", "disponible": True,  "prochainCreneau": "Aujourd'hui 18h00", "langues": ["Français", "Lingala"],              "note": 4.8, "pays": "CD", "nb_consultations": 847,  "tarif": 0},
    {"id": "MED-002", "prenom": "Béatrice", "nom": "MWAMBA",    "specialite": "Pédiatrie",         "disponible": True,  "prochainCreneau": "Demain 09h30",      "langues": ["Français", "Lingala", "Swahili"],  "note": 4.9, "pays": "CD", "nb_consultations": 1203, "tarif": 0},
    {"id": "MED-003", "prenom": "Sylvain",  "nom": "TSHIMANGA", "specialite": "Médecine générale", "disponible": False, "prochainCreneau": "Lundi 14h00",       "langues": ["Français", "Swahili"],             "note": 4.7, "pays": "CD", "nb_consultations": 562,  "tarif": 0},
    {"id": "MED-004", "prenom": "Esther",   "nom": "KASONGO",   "specialite": "Psychiatrie",       "disponible": True,  "prochainCreneau": "Aujourd'hui 20h00", "langues": ["Français", "Lingala"],             "note": 4.9, "pays": "CD", "nb_consultations": 334,  "tarif": 0},
    {"id": "MED-005", "prenom": "Pierre",   "nom": "DUPONT",    "specialite": "Médecine générale", "disponible": True,  "prochainCreneau": "Demain 10h00",      "langues": ["Français"],                         "note": 4.6, "pays": "BE", "nb_consultations": 289,  "tarif": 0},
]

PRODUITS_DEMO = [
    {"id": "PROD-001", "nom": "Paracétamol 500mg",    "categorie": "Analgésiques",    "prix_usd": 0.20, "stock": 250, "unite": "boîte 20 cp", "ordonnance_requise": False, "description": "Traitement de la fièvre et douleurs légères"},
    {"id": "PROD-002", "nom": "Amoxicilline 500mg",   "categorie": "Antibiotiques",   "prix_usd": 0.90, "stock": 80,  "unite": "boîte 16 gél","ordonnance_requise": True,  "description": "Antibiotique large spectre — sur ordonnance"},
    {"id": "PROD-003", "nom": "Artéméther/Luméfantrine","categorie": "Antipaludéens", "prix_usd": 1.25, "stock": 120, "unite": "boîte 24 cp", "ordonnance_requise": True,  "description": "Traitement du paludisme — sur ordonnance"},
    {"id": "PROD-004", "nom": "Sérum de réhydratation","categorie": "Réhydratation",  "prix_usd": 0.10, "stock": 500, "unite": "sachet",      "ordonnance_requise": False, "description": "Prévention et traitement déshydratation"},
    {"id": "PROD-005", "nom": "Ciprofloxacine 500mg",  "categorie": "Antibiotiques",  "prix_usd": 0.65, "stock": 60,  "unite": "boîte 10 cp", "ordonnance_requise": True,  "description": "Traitement infections — sur ordonnance"},
    {"id": "PROD-006", "nom": "Vitamine C 500mg",      "categorie": "Vitamines",      "prix_usd": 0.30, "stock": 200, "unite": "boîte 20 cp", "ordonnance_requise": False, "description": "Supplémentation vitaminique"},
    {"id": "PROD-007", "nom": "Kit test paludisme",    "categorie": "Diagnostics",    "prix_usd": 0.55, "stock": 300, "unite": "kit TDR",     "ordonnance_requise": False, "description": "Test rapide paludisme — résultat en 5 min"},
    {"id": "PROD-008", "nom": "Kit test typhoïde",     "categorie": "Diagnostics",    "prix_usd": 0.70, "stock": 150, "unite": "kit TDR",     "ordonnance_requise": False, "description": "Test rapide fièvre typhoïde"},
]

PLANS_ABONNEMENT = {
    "solidaire": {"nom": "Solidaire", "prix_usd": 1,  "consultations": 2,  "hospitalisation": False, "membres": 1,  "description": "Pour les foyers les plus modestes"},
    "standard":  {"nom": "Standard",  "prix_usd": 2,  "consultations": 5,  "hospitalisation": False, "membres": 1,  "description": "Accès soins individuels complet"},
    "famille":   {"nom": "Famille",   "prix_usd": 5,  "consultations": 10, "hospitalisation": False, "membres": 6,  "description": "Jusqu'à 6 membres de la famille"},
    "premium":   {"nom": "Premium",   "prix_usd": 10, "consultations": 999,"hospitalisation": True,  "membres": 6,  "description": "Tout inclus + hospitalisation partenaire"},
}

# ─── Modèles Pydantic ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nom: str
    prenom: str
    role: str = "adherent"
    centre_id: Optional[str] = None

class ReservationRequest(BaseModel):
    medecin_id: str
    patient_id: str
    motif: str
    date_souhaitee: Optional[str] = None
    langue: str = "français"

class SignesVitauxRequest(BaseModel):
    consultation_id: str
    temperature: float
    tension_systolique: int
    tension_diastolique: int
    pouls: int
    saturation_o2: Optional[float] = None
    poids: Optional[float] = None
    observation_langue: Optional[str] = None
    observation_teint: Optional[str] = None
    observation_cou: Optional[str] = None
    observations_generales: Optional[str] = None

class OrdonnanceRequest(BaseModel):
    consultation_id: str
    patient_id: str
    diagnostic: str
    produits: List[dict]
    posologie: str
    duree_traitement: str
    recommandations: str
    rapport: str

class CommandePharmacieRequest(BaseModel):
    patient_id: str
    ordonnance_id: Optional[str] = None
    produits: List[dict]
    mode_livraison: str = "domicile"
    adresse_livraison: Optional[str] = None

class AbonnementRequest(BaseModel):
    patient_id: str
    plan: str
    mode_paiement: str = "mobile_money"
    numero_paiement: Optional[str] = None

# ─── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/status")
async def root():
    return {
        "service": "SantéDirect — Kolongono",
        "version": "1.0.0",
        "status": "running",
        "salles_actives": signaling.room_count(),
        "proverbe": "Bidimu m'bupita buanga — Mieux vaut prévenir que guérir",
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "jitsi_domain": JITSI_DOMAIN,
        "jitsi_mode": "self-hosted" if JITSI_DOMAIN != "meet.jit.si" else "public",
        "salles_ws_fallback": signaling.room_count(),
    }


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", tags=["Auth"])
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    token = create_token({"sub": user.id, "role": user.role, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "prenom": user.prenom, "nom": user.nom,
            "email": user.email, "role": user.role, "plan": user.plan,
        },
    }

@app.post("/api/auth/register", tags=["Auth"])
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(409, "Email déjà utilisé")
    user = User(
        id=f"USR-{uuid.uuid4().hex[:8].upper()}",
        email=data.email,
        password_hash=pwd_context.hash(data.password),
        nom=data.nom,
        prenom=data.prenom,
        role=data.role,
        centre_id=data.centre_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_token({"sub": user.id, "role": user.role, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "prenom": user.prenom, "nom": user.nom,
            "email": user.email, "role": user.role, "plan": user.plan,
        },
    }


@app.post("/api/auth/refresh", tags=["Auth"])
async def refresh_token(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.actif:
        raise HTTPException(401, "Compte inactif ou introuvable")
    token = create_token({"sub": user.id, "role": user.role, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "prenom": user.prenom, "nom": user.nom, "email": user.email, "role": user.role, "plan": user.plan},
    }


# ── Adhérents ─────────────────────────────────────────────────────────────────

@app.get("/api/adherents/{patient_id}", tags=["Adhérents"])
async def get_adherent(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == patient_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Adhérent introuvable")
    abo_result = await db.execute(select(Abonnement).where(Abonnement.patient_id == patient_id))
    abo = abo_result.scalar_one_or_none()
    plan_key = abo.plan if abo else (user.plan or "")
    plan_info = PLANS_ABONNEMENT.get(plan_key, {})
    return {
        "id": user.id,
        "prenom": user.prenom,
        "nom": user.nom,
        "email": user.email,
        "plan": plan_key or None,
        "plan_info": plan_info,
        "consultations_restantes": plan_info.get("consultations", 0),
        "actif": user.actif,
    }


# ── Médecins ──────────────────────────────────────────────────────────────────

@app.get("/api/medecins/disponibles", tags=["Médecins"])
async def get_medecins(
    specialite: Optional[str] = Query(None),
    langue: Optional[str] = Query(None),
    disponible: Optional[bool] = Query(None),
):
    medecins = list(MEDECINS_DEMO)
    if specialite:
        medecins = [m for m in medecins if specialite.lower() in m["specialite"].lower()]
    if langue:
        medecins = [m for m in medecins if any(langue.lower() in l.lower() for l in m["langues"])]
    if disponible is not None:
        medecins = [m for m in medecins if m["disponible"] == disponible]
    return {"medecins": medecins, "total": len(medecins)}


# ── Consultations ─────────────────────────────────────────────────────────────

@app.post("/api/consultations/reserver", tags=["Consultations"])
async def reserver_consultation(data: ReservationRequest, db: AsyncSession = Depends(get_db)):
    medecin = next((m for m in MEDECINS_DEMO if m["id"] == data.medecin_id), None)
    if not medecin:
        raise HTTPException(404, f"Médecin '{data.medecin_id}' introuvable")

    consultation_id = f"CONS-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
    room_name = f"kolongono-{uuid.uuid4().hex[:10]}"

    base_url = _create_video_room(room_name)
    lien_patient    = f"{base_url}#userInfo.displayName=\"Patient\""
    lien_auxiliaire = f"{base_url}#userInfo.displayName=\"Auxiliaire\""
    lien_medecin    = f"{base_url}#userInfo.displayName=\"Dr.%20{medecin['nom']}\""

    now = datetime.now()
    if data.date_souhaitee:
        try:
            dt_rdv = datetime.fromisoformat(data.date_souhaitee)
        except ValueError:
            dt_rdv = now
    else:
        dt_rdv = now

    rdv = RendezVous(
        id=consultation_id,
        medecin_id=data.medecin_id,
        patient_id=data.patient_id,
        date=dt_rdv.strftime("%Y-%m-%d"),
        heure_debut=dt_rdv.strftime("%H:%M"),
        heure_fin=(dt_rdv + timedelta(minutes=30)).strftime("%H:%M"),
        motif=data.motif,
        statut="planifie",
        room=room_name,
        lien_patient=lien_patient,
        lien_auxiliaire=lien_auxiliaire,
        lien_medecin=lien_medecin,
    )
    db.add(rdv)
    await db.commit()

    signaling.get_or_create(room_name)

    return {
        "consultation_id": consultation_id,
        "room_id": room_name,
        "medecin": {k: medecin[k] for k in ("id","prenom","nom","specialite")},
        "patient_id": data.patient_id,
        "motif": data.motif,
        "statut": "planifie",
        "date_heure": dt_rdv.isoformat(),
        "webrtc_provider": "jitsi",
        "liens": {
            "patient":    lien_patient,
            "auxiliaire": lien_auxiliaire,
            "medecin":    lien_medecin,
        },
        "pre_consultation_requise": True,
        "delai_avant_appel_minutes": 15,
    }


@app.post("/api/consultations/{consultation_id}/signes-vitaux", tags=["Consultations"])
async def saisir_signes_vitaux(consultation_id: str, data: SignesVitauxRequest, db: AsyncSession = Depends(get_db)):
    import json as _json
    alerte = (
        "FIÈVRE ÉLEVÉE — Informer immédiatement le médecin" if data.temperature >= 39.5
        else "HYPOTENSION — Surveiller" if data.tension_systolique < 90
        else None
    )
    signes = {
        "temperature": data.temperature,
        "tension": f"{data.tension_systolique}/{data.tension_diastolique}",
        "pouls": data.pouls,
        "saturation_o2": data.saturation_o2,
        "poids": data.poids,
        "observation_langue": data.observation_langue,
        "observation_teint": data.observation_teint,
        "observation_cou": data.observation_cou,
        "observations_generales": data.observations_generales,
        "alerte": alerte,
        "heure_saisie": datetime.now().isoformat(),
    }
    existing = (await db.execute(select(Diagnostic).where(Diagnostic.rdv_id == consultation_id))).scalar_one_or_none()
    if existing:
        existing.notes_confidentielles = _json.dumps(signes, ensure_ascii=False)
    else:
        db.add(Diagnostic(
            id=f"DIAG-{uuid.uuid4().hex[:8].upper()}",
            rdv_id=consultation_id,
            patient_id=data.consultation_id,
            notes_confidentielles=_json.dumps(signes, ensure_ascii=False),
        ))
    await db.commit()
    return {
        "consultation_id": consultation_id,
        "signes_enregistres": True,
        "heure_saisie": signes["heure_saisie"],
        "temperature": data.temperature,
        "tension": signes["tension"],
        "pouls": data.pouls,
        "saturation_o2": data.saturation_o2,
        "observations": {
            "langue": data.observation_langue,
            "teint": data.observation_teint,
            "cou": data.observation_cou,
            "generales": data.observations_generales,
        },
        "alerte": alerte,
    }


@app.post("/api/consultations/{consultation_id}/ordonnance", tags=["Consultations"])
async def emettre_ordonnance(consultation_id: str, data: OrdonnanceRequest, db: AsyncSession = Depends(get_db)):
    ordonnance_id = f"ORD-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
    prescriptions_txt = f"{data.posologie} — {data.duree_traitement}"
    ord_obj = Ordonnance(
        id=ordonnance_id,
        rdv_id=consultation_id,
        date=datetime.now().strftime("%Y-%m-%d"),
        patient_id=data.patient_id,
        diagnostic=data.diagnostic,
        prescriptions_texte=prescriptions_txt,
        produits=data.produits,
        recommandations=data.recommandations,
        statut="emise",
    )
    db.add(ord_obj)
    await db.commit()
    return {
        "ordonnance_id": ordonnance_id,
        "consultation_id": consultation_id,
        "patient_id": data.patient_id,
        "diagnostic": data.diagnostic,
        "produits": data.produits,
        "posologie": data.posologie,
        "duree": data.duree_traitement,
        "recommandations": data.recommandations,
        "rapport": data.rapport,
        "date_emission": datetime.now().isoformat(),
        "statut": "emise",
        "pharmacie_notifiee": True,
    }


@app.get("/api/consultations/{consultation_id}", tags=["Consultations"])
async def get_consultation(consultation_id: str, db: AsyncSession = Depends(get_db)):
    rdv = await db.get(RendezVous, consultation_id)
    if not rdv:
        raise HTTPException(404, "Consultation introuvable")
    import json as _json
    diag = (await db.execute(select(Diagnostic).where(Diagnostic.rdv_id == consultation_id))).scalar_one_or_none()
    signes = _json.loads(diag.notes_confidentielles) if diag and diag.notes_confidentielles else None
    return {
        "consultation_id": consultation_id,
        "statut": rdv.statut,
        "medecin_id": rdv.medecin_id,
        "patient_id": rdv.patient_id,
        "date": rdv.date,
        "heure_debut": rdv.heure_debut,
        "motif": rdv.motif,
        "room": rdv.room,
        "lien_patient": rdv.lien_patient,
        "signes_vitaux": signes,
    }


# ── Pharmacie ─────────────────────────────────────────────────────────────────

@app.get("/api/pharmacie/produits", tags=["Pharmacie"])
async def get_produits(
    categorie: Optional[str] = Query(None),
    recherche: Optional[str] = Query(None),
    ordonnance_requise: Optional[bool] = Query(None),
):
    produits = list(PRODUITS_DEMO)
    if categorie:
        produits = [p for p in produits if categorie.lower() in p["categorie"].lower()]
    if recherche:
        produits = [p for p in produits if recherche.lower() in p["nom"].lower()]
    if ordonnance_requise is not None:
        produits = [p for p in produits if p["ordonnance_requise"] == ordonnance_requise]
    return {"produits": produits, "total": len(produits)}


FOURNITURES_PREMIER_SECOURS = [
    {"id": "FOUR-001", "nom": "Alcool iodé 5%",             "categorie": "Antiseptiques",   "unite": "flacon 250 ml", "prix_usd": 0.30, "stock": 40},
    {"id": "FOUR-002", "nom": "Mercurochrome 2%",           "categorie": "Antiseptiques",   "unite": "flacon 30 ml",  "prix_usd": 0.20, "stock": 55},
    {"id": "FOUR-003", "nom": "Gaze stérile 10×10 cm",      "categorie": "Pansements",      "unite": "sachet 5 pcs",  "prix_usd": 0.20, "stock": 120},
    {"id": "FOUR-004", "nom": "Bande de gaze 5 cm",         "categorie": "Pansements",      "unite": "rouleau",       "prix_usd": 0.15, "stock": 90},
    {"id": "FOUR-005", "nom": "Bandelettes adhésives",      "categorie": "Pansements",      "unite": "boîte 20 pcs",  "prix_usd": 0.25, "stock": 60},
    {"id": "FOUR-006", "nom": "Gants latex non stériles",   "categorie": "Protection",      "unite": "paire",         "prix_usd": 0.10, "stock": 200},
    {"id": "FOUR-007", "nom": "Thermomètre digital",        "categorie": "Matériel",        "unite": "unité",         "prix_usd": 1.80, "stock": 10},
    {"id": "FOUR-008", "nom": "Coton hydrophile",           "categorie": "Pansements",      "unite": "rouleau 100g",  "prix_usd": 0.20, "stock": 80},
    {"id": "FOUR-009", "nom": "Seringues 5 ml",             "categorie": "Injection",       "unite": "sachet 10 pcs", "prix_usd": 0.45, "stock": 30},
    {"id": "FOUR-010", "nom": "Paracétamol 500mg",          "categorie": "Analgésiques",    "unite": "boîte 20 cp",   "prix_usd": 0.20, "stock": 250},
]

DEMO_LIVRAISONS = [
    {
        "id": "LIV-001",
        "ordonnance_id": "ORD-2026-DEMO01",
        "date_commande": "2026-05-23T10:30:00",
        "statut": "en_cours_livraison",
        "medecin": "Dr. Emmanuel LUKUSA",
        "diagnostic": "Paludisme simple",
        "produits": [
            {"nom": "Artéméther/Luméfantrine 20/120mg", "quantite": 2, "posologie": "4 cp matin et soir · 3 jours"},
            {"nom": "Paracétamol 500mg", "quantite": 1, "posologie": "2 cp toutes les 6h si fièvre"},
        ],
        "livreur": "Jean-Pierre M.",
        "date_livraison": None,
    }
]


@app.get("/api/pharmacie/livraisons", tags=["Pharmacie"])
async def get_livraisons(patient_id: str = Query(...)):
    livraisons = [l for l in DEMO_LIVRAISONS if True]
    return {"livraisons": livraisons, "total": len(livraisons)}


@app.get("/api/pharmacie/fournitures", tags=["Pharmacie"])
async def get_fournitures(categorie: Optional[str] = Query(None)):
    result = list(FOURNITURES_PREMIER_SECOURS)
    if categorie:
        result = [f for f in result if categorie.lower() in f["categorie"].lower()]
    return {"fournitures": result, "total": len(result)}


@app.post("/api/pharmacie/commandes", tags=["Pharmacie"])
async def passer_commande(data: CommandePharmacieRequest):
    commande_id = f"CMD-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
    total_usd = sum(
        next((p["prix_usd"] for p in PRODUITS_DEMO if p["id"] == item.get("produit_id")), 0) * item.get("quantite", 1)
        for item in data.produits
    )
    return {
        "commande_id": commande_id,
        "patient_id": data.patient_id,
        "ordonnance_id": data.ordonnance_id,
        "produits": data.produits,
        "total_usd": total_usd,
        "mode_livraison": data.mode_livraison,
        "adresse_livraison": data.adresse_livraison,
        "statut": "validee",
        "date_commande": datetime.now().isoformat(),
        "delai_livraison_estime": "2-4 heures" if data.mode_livraison == "domicile" else "Disponible sur place",
        "livreur_assigne": None,
        "couvert_mutuelle": True,
    }


# ── Abonnements mutuelle ──────────────────────────────────────────────────────

USD_FC_RATE = 2800

@app.get("/api/abonnements/plans", tags=["Abonnements"])
async def get_plans():
    plans = {k: {**v, "prix_fc": round(v["prix_usd"] * USD_FC_RATE)} for k, v in PLANS_ABONNEMENT.items()}
    return {"plans": plans}


@app.post("/api/abonnements", tags=["Abonnements"])
async def souscrire_abonnement(data: AbonnementRequest, db: AsyncSession = Depends(get_db)):
    plan = PLANS_ABONNEMENT.get(data.plan)
    if not plan:
        raise HTTPException(400, f"Plan invalide — choisir parmi : {', '.join(PLANS_ABONNEMENT.keys())}")
    existing = (await db.execute(select(Abonnement).where(Abonnement.patient_id == data.patient_id))).scalar_one_or_none()
    now_str = datetime.now().strftime("%Y-%m-%d")
    if existing:
        existing.plan = data.plan
        existing.statut = "actif"
        existing.date_debut = now_str
    else:
        db.add(Abonnement(patient_id=data.patient_id, plan=data.plan, statut="actif", date_debut=now_str))
    mois_str = datetime.now().strftime("%Y-%m")
    montant_fc = round(plan["prix_usd"] * 2800)
    cot_existing = (await db.execute(
        select(Cotisation).where(Cotisation.patient_id == data.patient_id, Cotisation.mois == mois_str)
    )).scalar_one_or_none()
    if not cot_existing:
        db.add(Cotisation(patient_id=data.patient_id, mois=mois_str, montant_fc=montant_fc, statut="paye", mode_paiement=data.mode_paiement))
    await db.commit()
    return {
        "patient_id": data.patient_id,
        "plan": data.plan,
        "plan_info": plan,
        "prix_usd": plan["prix_usd"],
        "mode_paiement": data.mode_paiement,
        "statut": "actif",
        "date_debut": datetime.now().isoformat(),
        "prochain_renouvellement": (datetime.now() + timedelta(days=30)).isoformat(),
        "consultations_restantes": plan["consultations"],
    }


@app.get("/api/abonnements/{patient_id}", tags=["Abonnements"])
async def get_abonnement(patient_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func as sqlfunc
    abo = (await db.execute(select(Abonnement).where(Abonnement.patient_id == patient_id))).scalar_one_or_none()
    if not abo or abo.statut != "actif":
        return {"patient_id": patient_id, "actif": False, "plan": None}
    plan = PLANS_ABONNEMENT.get(abo.plan, {})
    nb_cons = (await db.execute(
        select(sqlfunc.count()).select_from(RendezVous)
        .where(RendezVous.patient_id == patient_id, RendezVous.statut != "annule")
    )).scalar() or 0
    nb_impaye = (await db.execute(
        select(sqlfunc.count()).select_from(Cotisation)
        .where(Cotisation.patient_id == patient_id, Cotisation.statut == "en_attente")
    )).scalar() or 0
    return {
        "patient_id": patient_id,
        "actif": True,
        "plan": abo.plan,
        "plan_info": plan,
        "consultations_restantes": max(0, plan.get("consultations", 0) - nb_cons),
        "consultations_utilisees": nb_cons,
        "prix_usd": plan.get("prix_usd", 0),
        "date_debut": abo.date_debut,
        "prochain_renouvellement": (datetime.now() + timedelta(days=30)).isoformat(),
        "nb_mois_impaye": nb_impaye,
    }


# ── Dossiers médicaux ─────────────────────────────────────────────────────────

@app.get("/api/dossiers/{patient_id}", tags=["Dossiers"])
async def get_dossier(patient_id: str, db: AsyncSession = Depends(get_db)):
    from routers.consultations import MEDECINS as _MED_LIST
    _med_map = {m["id"]: f"Dr. {m['prenom']} {m['nom']}" for m in _MED_LIST}

    rdv_rows = (await db.execute(
        select(RendezVous)
        .where(RendezVous.patient_id == patient_id)
        .order_by(RendezVous.date.desc())
        .limit(20)
    )).scalars().all()

    diag_by_rdv: dict = {}
    if rdv_rows:
        rdv_ids = [r.id for r in rdv_rows]
        diags = (await db.execute(
            select(Diagnostic).where(Diagnostic.rdv_id.in_(rdv_ids))
        )).scalars().all()
        diag_by_rdv = {d.rdv_id: d for d in diags}

    historique_consultations = [
        {
            "id": r.id,
            "date": r.date,
            "motif": r.motif,
            "medecin": _med_map.get(r.medecin_id, r.medecin_id),
            "diagnostic": diag_by_rdv[r.id].diagnostic if r.id in diag_by_rdv else None,
            "statut": r.statut,
        }
        for r in rdv_rows
    ]

    ordonnances = (await db.execute(
        select(Ordonnance)
        .where(Ordonnance.patient_id == patient_id)
        .order_by(Ordonnance.date.desc())
        .limit(20)
    )).scalars().all()

    historique_ordonnances = [
        {
            "id": o.id,
            "date": o.date,
            "diagnostic": o.diagnostic,
            "medecin": o.medecin or _med_map.get(o.medecin_id or "", ""),
            "statut": o.statut,
        }
        for o in ordonnances
    ]

    return {
        "patient_id": patient_id,
        "groupe_sanguin": None,
        "allergies": [],
        "traitements_en_cours": [],
        "antecedents": [],
        "vaccinations": [],
        "historique_consultations": historique_consultations,
        "historique_ordonnances": historique_ordonnances,
    }


# ── Pont Longonia ─────────────────────────────────────────────────────────────

@app.get("/api/longonia/verify-adherent/{longonia_id}", tags=["Longonia Bridge"])
async def verify_longonia_adherent(longonia_id: str):
    import httpx
    longonia_url = os.getenv("LONGONIA_API_URL", "http://localhost:8000")
    longonia_key = os.getenv("LONGONIA_API_KEY", "")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{longonia_url}/api/eleves/{longonia_id}",
                headers={"X-API-Key": longonia_key} if longonia_key else {},
            )
            if r.status_code == 200:
                return {"found": True, "data": r.json()}
    except Exception:
        pass
    return {"found": False, "longonia_id": longonia_id}


@app.post("/api/longonia/debit-mutuelle", tags=["Longonia Bridge"])
async def debit_mutuelle_longonia(body: dict):
    """Débite le solde cantine Longonia pour payer la mutuelle Kolongono."""
    import httpx
    longonia_url = os.getenv("LONGONIA_API_URL", "http://localhost:8000")
    longonia_key = os.getenv("LONGONIA_API_KEY", "")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                f"{longonia_url}/api/paiements/debit-sante",
                headers={"Authorization": f"Bearer {longonia_key}"},
                json=body,
            )
            if r.status_code == 200:
                return {"success": True, "data": r.json()}
    except Exception:
        pass
    return {"success": False, "reason": "Longonia API indisponible — paiement manuel requis"}


# ── WebRTC Signaling WebSocket (fallback) ─────────────────────────────────────

@app.websocket("/ws/{room_id}")
async def websocket_signaling(
    ws: WebSocket,
    room_id: str,
    role: str = Query("patient", pattern="^(medecin|patient|auxiliaire)$"),
):
    await ws.accept()
    room = signaling.get_or_create(room_id)
    room.participants[role] = ws

    # Notifier les autres participants
    for r, other_ws in list(room.participants.items()):
        if r != role:
            try:
                await other_ws.send_json({"type": "peer_joined", "role": role})
            except Exception:
                pass
    try:
        while True:
            data = await ws.receive_json()
            # Relayer le message à tous les autres participants
            for r, other_ws in list(room.participants.items()):
                if r != role:
                    try:
                        await other_ws.send_json({**data, "from": role})
                    except Exception:
                        room.participants.pop(r, None)
    except WebSocketDisconnect:
        room.participants.pop(role, None)
        for r, other_ws in list(room.participants.items()):
            try:
                await other_ws.send_json({"type": "peer_left", "role": role})
            except Exception:
                pass
        if not room.participants:
            signaling.rooms.pop(room_id, None)


# ── Admin ─────────────────────────────────────────────────────────────────────

PLANS_PRIX = {"solidaire": 1.0, "standard": 2.0, "famille": 5.0, "premium": 10.0}

@app.get("/api/admin/users", tags=["Admin"])
async def list_users_admin(
    role: Optional[str] = Query(None),
    actif: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    from sqlalchemy import select, func as sqlfunc
    q = select(User)
    cq = select(sqlfunc.count()).select_from(User)
    if role:
        q = q.where(User.role == role)
        cq = cq.where(User.role == role)
    if actif is not None:
        q = q.where(User.actif == actif)
        cq = cq.where(User.actif == actif)
    total = (await db.execute(cq)).scalar()
    users = (await db.execute(q.order_by(User.nom).offset(skip).limit(limit))).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": u.id,
                "nom": u.nom,
                "prenom": u.prenom,
                "nom_complet": f"{u.nom} {u.prenom}",
                "email": u.email,
                "role": u.role,
                "plan": u.plan,
                "prix_usd": PLANS_PRIX.get(u.plan or "", 0),
                "actif": u.actif,
                "statut": "actif" if u.actif else "inactif",
                "centre_id": u.centre_id,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@app.get("/api/admin/stats", tags=["Admin"])
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    from sqlalchemy import select, func as sqlfunc
    rows = (await db.execute(
        select(User.role, sqlfunc.count(User.id)).group_by(User.role)
    )).all()
    par_role = {r: c for r, c in rows}
    adherents_actifs = (await db.execute(
        select(sqlfunc.count()).select_from(User)
        .where(User.role == "adherent", User.actif == True)
    )).scalar()
    return {
        "par_role": par_role,
        "total": sum(par_role.values()),
        "adherents_actifs": adherents_actifs,
        "adherents_inactifs": par_role.get("adherent", 0) - adherents_actifs,
    }


@app.get("/api/admin/consultations", tags=["Admin"])
async def list_consultations_admin(
    statut: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    medecin_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    from sqlalchemy import select, func as sqlfunc
    q = select(RendezVous)
    cq = select(sqlfunc.count()).select_from(RendezVous)
    if statut:
        q = q.where(RendezVous.statut == statut)
        cq = cq.where(RendezVous.statut == statut)
    if patient_id:
        q = q.where(RendezVous.patient_id == patient_id)
        cq = cq.where(RendezVous.patient_id == patient_id)
    if medecin_id:
        q = q.where(RendezVous.medecin_id == medecin_id)
        cq = cq.where(RendezVous.medecin_id == medecin_id)
    total = (await db.execute(cq)).scalar()
    rows = (await db.execute(q.order_by(RendezVous.date.desc(), RendezVous.heure_debut.desc()).offset(skip).limit(limit))).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "patient_id": r.patient_id,
                "medecin_id": r.medecin_id,
                "date": r.date,
                "heure_debut": r.heure_debut,
                "heure_fin": r.heure_fin,
                "motif": r.motif,
                "statut": r.statut,
                "room": r.room,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@app.get("/api/admin/medecins", tags=["Admin"])
async def admin_medecins(
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    from sqlalchemy import select, func as sqlfunc
    from routers.consultations import MEDECINS
    rows = (await db.execute(
        select(RendezVous.medecin_id, sqlfunc.count(RendezVous.id))
        .where(RendezVous.statut != "annule")
        .group_by(RendezVous.medecin_id)
    )).all()
    nb_map = {mid: cnt for mid, cnt in rows}
    result = []
    for m in MEDECINS:
        nb = nb_map.get(m["id"], 0)
        result.append({
            "id": m["id"],
            "nom": f"Dr. {m['prenom']} {m['nom']}",
            "specialite": m["specialite"],
            "pays": m["pays"],
            "ville": m["ville"],
            "disponible": m["disponible"],
            "note": m.get("note"),
            "nb_consultations_total": m.get("consultations", 0),
            "nb_consultations_via_sd": nb,
        })
    return {"medecins": result, "total": len(result)}


@app.get("/api/admin/revenus", tags=["Admin"])
async def admin_revenus(
    mois: Optional[str] = Query(None, description="Format YYYY-MM"),
    centre_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    from sqlalchemy import select, func as sqlfunc
    q_rev = select(RevenuCentre)
    q_dep = select(DepenseCentre)
    if mois:
        q_rev = q_rev.where(RevenuCentre.mois == mois)
        q_dep = q_dep.where(DepenseCentre.mois == mois)
    if centre_id:
        q_rev = q_rev.where(RevenuCentre.centre_id == centre_id)
        q_dep = q_dep.where(DepenseCentre.centre_id == centre_id)
    revenus = (await db.execute(q_rev)).scalars().all()
    depenses = (await db.execute(q_dep)).scalars().all()
    total_revenus = sum(r.montant_usd for r in revenus)
    total_depenses = sum(d.montant_usd for d in depenses)
    cotisations = (await db.execute(
        select(sqlfunc.sum(Cotisation.montant_fc)).where(Cotisation.statut == "paye")
    )).scalar() or 0.0
    return {
        "total_revenus_usd": total_revenus,
        "total_depenses_usd": total_depenses,
        "solde_usd": total_revenus - total_depenses,
        "cotisations_fc": cotisations,
        "cotisations_usd": round(cotisations / 2800, 2),
        "revenus": [
            {"id": r.id, "centre_id": r.centre_id, "mois": r.mois, "categorie": r.categorie, "montant_usd": r.montant_usd}
            for r in revenus
        ],
        "depenses": [
            {"id": d.id, "centre_id": d.centre_id, "mois": d.mois, "categorie": d.categorie, "montant_usd": d.montant_usd}
            for d in depenses
        ],
    }


# ── Routers externes ──────────────────────────────────────────────────────────

from routers.unites import router as unites_router, movements_router
from routers.consultations import router as consultations_router
from routers.longonia_bridge import router as longonia_router
from routers.centres import router as centres_router
from routers.rh import router as rh_router
from routers.pharmacie_ean import router as pharmacie_ean_router
from routers.notifications import router as notifications_router
app.include_router(unites_router)
app.include_router(movements_router)
app.include_router(consultations_router)
app.include_router(longonia_router)
app.include_router(centres_router)
app.include_router(rh_router)
app.include_router(pharmacie_ean_router)
app.include_router(notifications_router)

# ── Interface web navigateur ──────────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles as _StaticFiles
import os as _os
if _os.path.exists("web"):
    app.mount("/", _StaticFiles(directory="web", html=True), name="web")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)

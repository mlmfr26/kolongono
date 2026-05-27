"""
SantéDirect — Kolongono : Router Consultations
Triage IA · Planning 50+ médecins · RDV · Eligibilité · Soldes
PostgreSQL via SQLAlchemy 2.0 async (asyncpg)
"""
import os
import uuid
import json
import asyncio
import httpx
from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update
from sqlalchemy.dialects.postgresql import insert as pg_insert

# ─── Notifications push FCM ───────────────────────────────────────────────────
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
from notifications import notify_rdv_confirme, notify_consultation_cloturee, register_token
from database import get_db
from models import (
    RendezVous, Abonnement, Cotisation, SoldePatient,
    Diagnostic, Demande, Ordonnance, User,
)

# ─── Longonia block-slot ──────────────────────────────────────────────────────

LONGONIA_SANTE   = os.getenv("LONGONIA_SANTE_URL", "http://localhost:8001")
LONGONIA_KEY     = os.getenv("LONGONIA_API_KEY",   "")
LONGONIA_TIMEOUT = float(os.getenv("LONGONIA_TIMEOUT", "5.0"))


async def _block_slot_longonia(
    medecin_id: str,
    date_rdv: str,
    heure_debut: str,
    heure_fin: str,
    adherent_id: str,
    motif: str = "",
) -> dict:
    """
    Pose un verrou croisé sur le créneau dans Longonia SantéDirect.
    Retourne {"ok": True}  si accepté ou si Longonia est inaccessible (dégradation).
    Retourne {"ok": False, "detail": {...}}  si Longonia répond 409 (conflit dur).
    """
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if LONGONIA_KEY:
        headers["X-API-Key"] = LONGONIA_KEY

    body = {
        "medecin_id":  medecin_id,
        "date":        date_rdv,
        "heure_debut": heure_debut,
        "heure_fin":   heure_fin,
        "source":      "kolongono",
        "reference":   adherent_id,
        "motif":       motif,
    }

    try:
        async with httpx.AsyncClient(timeout=LONGONIA_TIMEOUT) as client:
            r = await client.post(
                f"{LONGONIA_SANTE}/api/planning/block-slot",
                json=body,
                headers=headers,
            )
            if r.status_code == 409:
                data = r.json()
                return {
                    "ok": False,
                    "detail": {
                        "code": "creneau_bloque_longonia",
                        "message": data.get("message", "Ce créneau est réservé dans le système Longonia."),
                        "medecin_id": medecin_id,
                        "date": date_rdv,
                        "heure": f"{heure_debut} – {heure_fin}",
                    },
                }
            r.raise_for_status()
            data = r.json()
            return {"ok": True, "longonia_sync": True, "longonia_slot_id": data.get("slot_id")}

    except httpx.TimeoutException:
        return {
            "ok": True,
            "longonia_sync": False,
            "longonia_warning": "Longonia inaccessible (timeout) — créneau réservé dans Kolongono uniquement.",
        }
    except Exception as exc:
        return {
            "ok": True,
            "longonia_sync": False,
            "longonia_warning": f"Longonia inaccessible ({exc}) — créneau réservé dans Kolongono uniquement.",
        }

# ─── Auth (dupliqué ici pour autonomie du router) ────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "kolongono-dev-secret-change-me")
ALGORITHM  = "HS256"
http_bearer = HTTPBearer(auto_error=False)
JITSI_DOMAIN = os.getenv("JITSI_DOMAIN", "meet.jit.si")


async def _get_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        return jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token invalide")


def _jitsi_url(room: str, display_name: str) -> str:
    return f"https://{JITSI_DOMAIN}/{room}#userInfo.displayName=%22{display_name.replace(' ', '%20')}%22"


router = APIRouter(prefix="/api/consultations", tags=["Consultations"])

# ─── 50+ médecins partenaires ─────────────────────────────────────────────────

MEDECINS = [
    # ── République Démocratique du Congo — Kinshasa ──
    {"id": "MED-K01", "prenom": "Emmanuel", "nom": "LUKUSA",       "specialite": "Médecine générale",              "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala", "kikongo"],          "disponible": True,  "note": 4.8, "consultations": 1247, "tarif_usd": 0.0,  "bio": "Médecin généraliste, fondateur du réseau SantéDirect Kolongono. Expérience 18 ans.",                             "tel": "+243 81 234 5678"},
    {"id": "MED-K02", "prenom": "Béatrice", "nom": "MWAMBA",       "specialite": "Pédiatrie",                      "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala"],                     "disponible": True,  "note": 4.9, "consultations": 1803, "tarif_usd": 0.0,  "bio": "Pédiatre, spécialiste nutrition infantile et maladies tropicales de l'enfant.",                                  "tel": "+243 85 987 6543"},
    {"id": "MED-K03", "prenom": "Sylvain",  "nom": "TSHIMANGA",    "specialite": "Chirurgie générale",             "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala", "swahili"],          "disponible": True,  "note": 4.7, "consultations": 562,  "tarif_usd": 0.0,  "bio": "Chirurgien, téléconsultation préopératoire et suivi post-opératoire à distance.",                                "tel": "+243 99 567 8901"},
    {"id": "MED-K04", "prenom": "Esther",   "nom": "KASONGO",      "specialite": "Psychiatrie & Santé mentale",   "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala"],                     "disponible": True,  "note": 4.9, "consultations": 434,  "tarif_usd": 0.0,  "bio": "Psychiatre, prise en charge du traumatisme, dépression post-partum, troubles anxieux.",                          "tel": "+243 82 345 6789"},
    {"id": "MED-K05", "prenom": "Albert",   "nom": "NGOMA",        "specialite": "Gynécologie-Obstétrique",        "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala"],                     "disponible": True,  "note": 4.8, "consultations": 892,  "tarif_usd": 0.0,  "bio": "Gynécologue-obstétricien. Suivi grossesse, planning familial, santé reproductive.",                              "tel": "+243 81 890 1234"},
    {"id": "MED-K06", "prenom": "Joséphine","nom": "KABILA",       "specialite": "Médecine interne",               "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala", "kikongo"],          "disponible": False, "note": 4.7, "consultations": 631,  "tarif_usd": 0.0,  "bio": "Interniste spécialisée hypertension, diabète, maladies chroniques en contexte tropical.",                        "tel": "+243 84 123 4567"},
    {"id": "MED-K07", "prenom": "Christian","nom": "BANZA",        "specialite": "Cardiologie",                    "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala"],                     "disponible": True,  "note": 4.8, "consultations": 378,  "tarif_usd": 0.0,  "bio": "Cardiologue, HTA, arythmies, insuffisance cardiaque. Formation Bruxelles 2005.",                                 "tel": "+243 81 456 7890"},
    {"id": "MED-K08", "prenom": "Pascale",  "nom": "MUAMBA",       "specialite": "Dermatologie & Maladies infect.", "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala"],                     "disponible": True,  "note": 4.6, "consultations": 519,  "tarif_usd": 0.0,  "bio": "Dermatologue. Maladies tropicales de la peau, onchocercose, lèpre, plaies chroniques.",                          "tel": "+243 85 678 9012"},
    {"id": "MED-K09", "prenom": "Isaac",    "nom": "ILUNGA",       "specialite": "ORL",                            "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala", "swahili"],          "disponible": True,  "note": 4.5, "consultations": 287,  "tarif_usd": 0.0,  "bio": "ORL, pathologies otorhinolaryngologiques courantes, surdité, sinusites chroniques.",                             "tel": "+243 82 789 0123"},
    {"id": "MED-K10", "prenom": "Micheline","nom": "NTUMBA",       "specialite": "Neurologie",                     "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala"],                     "disponible": True,  "note": 4.8, "consultations": 298,  "tarif_usd": 0.0,  "bio": "Neurologue. Épilepsie, AVC, céphalées chroniques. Téléconsultation neurologique en Afrique subsaharienne.",      "tel": "+243 99 890 1234"},
    {"id": "MED-K11", "prenom": "Théodore", "nom": "NKOSI",        "specialite": "Médecine tropicale",             "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala", "anglais"],          "disponible": True,  "note": 4.9, "consultations": 743,  "tarif_usd": 0.0,  "bio": "Spécialiste médecine tropicale. Paludisme sévère, trypanosomiase, fièvres hémorragiques.",                       "tel": "+243 81 012 3456"},
    {"id": "MED-K12", "prenom": "Bernadette","nom": "KABASELE",    "specialite": "Nutrition & Diététique",         "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "lingala", "kikongo"],          "disponible": True,  "note": 4.7, "consultations": 412,  "tarif_usd": 0.0,  "bio": "Nutritionniste. Malnutrition aiguë sévère, MAS, alimentation thérapeutique, PECIMA.",                           "tel": "+243 82 234 5678"},
    {"id": "MED-K13", "prenom": "Victor",   "nom": "LUBOYA",       "specialite": "Épidémiologie & Santé publique", "pays": "CD", "ville": "Kinshasa",   "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.8, "consultations": 201,  "tarif_usd": 0.0,  "bio": "Épidémiologiste. Surveillance des épidémies (mpox, choléra, Ebola), vaccination.",                              "tel": "+243 81 345 6789"},
    # ── RDC — Lubumbashi ──
    {"id": "MED-L01", "prenom": "Jacques",  "nom": "MUTOMBO",      "specialite": "Médecine générale",              "pays": "CD", "ville": "Lubumbashi", "langues": ["français", "swahili", "tshiluba"],         "disponible": True,  "note": 4.7, "consultations": 934,  "tarif_usd": 0.0,  "bio": "Médecin généraliste, 22 ans à l'hôpital Sendwe. Spécialiste VIH/SIDA, tuberculose.",                            "tel": "+243 97 456 7890"},
    {"id": "MED-L02", "prenom": "Claudine", "nom": "KILONGA",      "specialite": "Pédiatrie",                      "pays": "CD", "ville": "Lubumbashi", "langues": ["français", "swahili"],                     "disponible": True,  "note": 4.8, "consultations": 678,  "tarif_usd": 0.0,  "bio": "Pédiatre, urgences pédiatriques, drépanocytose, malnutrition sévère de l'enfant.",                               "tel": "+243 81 567 8901"},
    {"id": "MED-L03", "prenom": "Patrick",  "nom": "KYUNGU",       "specialite": "Orthopédie & Traumatologie",     "pays": "CD", "ville": "Lubumbashi", "langues": ["français", "swahili"],                     "disponible": False, "note": 4.6, "consultations": 342,  "tarif_usd": 0.0,  "bio": "Orthopédiste. Fractures, traumatismes articulaires, suivi post-fracture à distance.",                            "tel": "+243 97 678 9012"},
    {"id": "MED-L04", "prenom": "Angélique","nom": "KABANGA",      "specialite": "Gynécologie-Obstétrique",        "pays": "CD", "ville": "Lubumbashi", "langues": ["français", "swahili", "tshiluba"],         "disponible": True,  "note": 4.9, "consultations": 521,  "tarif_usd": 0.0,  "bio": "Gynécologue. Suivi grossesse à haut risque, fistule obstétricale, mortalité maternelle.",                        "tel": "+243 82 789 0123"},
    {"id": "MED-L05", "prenom": "Maurice",  "nom": "NSENGA",       "specialite": "Médecine tropicale",             "pays": "CD", "ville": "Lubumbashi", "langues": ["français", "swahili", "anglais"],          "disponible": True,  "note": 4.7, "consultations": 456,  "tarif_usd": 0.0,  "bio": "Médecine tropicale, filariose, bilharziose, leptospirose. PHD santé publique.",                                 "tel": "+243 81 890 1234"},
    # ── RDC — Goma ──
    {"id": "MED-G01", "prenom": "Alexis",   "nom": "RUTEBUKA",     "specialite": "Médecine d'urgence",             "pays": "CD", "ville": "Goma",       "langues": ["français", "swahili", "kinyarwanda"],      "disponible": True,  "note": 4.9, "consultations": 1102, "tarif_usd": 0.0,  "bio": "Urgentiste. Gestion des crises humanitaires, traumatismes de guerre, triage massif.",                            "tel": "+243 99 123 4567"},
    {"id": "MED-G02", "prenom": "Diane",    "nom": "HABIMANA",     "specialite": "Pédiatrie & Néonatologie",       "pays": "CD", "ville": "Goma",       "langues": ["français", "swahili", "kinyarwanda"],      "disponible": True,  "note": 4.8, "consultations": 789,  "tarif_usd": 0.0,  "bio": "Pédiatre-néonatologue. Soins intensifs néonataux, grand prématuré, détresse néonatale.",                         "tel": "+243 81 234 5678"},
    {"id": "MED-G03", "prenom": "Christophe","nom": "BARAKA",      "specialite": "Chirurgie humanitaire",          "pays": "CD", "ville": "Goma",       "langues": ["français", "swahili"],                     "disponible": False, "note": 4.7, "consultations": 398,  "tarif_usd": 0.0,  "bio": "Chirurgien MSF. Chirurgie de guerre, blessures balistiques, reconstructions.",                                  "tel": "+243 85 345 6789"},
    # ── RDC — Bukavu ──
    {"id": "MED-B01", "prenom": "Flore",    "nom": "CIRIMWAMI",    "specialite": "Médecine générale",              "pays": "CD", "ville": "Bukavu",     "langues": ["français", "swahili", "mashi"],            "disponible": True,  "note": 4.6, "consultations": 678,  "tarif_usd": 0.0,  "bio": "Médecine générale, pathologies chroniques, accompagnement des femmes victimes de violences.",                    "tel": "+243 99 456 7890"},
    {"id": "MED-B02", "prenom": "Norbert",  "nom": "KASEREKA",     "specialite": "Ophtalmologie",                  "pays": "CD", "ville": "Bukavu",     "langues": ["français", "swahili"],                     "disponible": True,  "note": 4.8, "consultations": 312,  "tarif_usd": 0.0,  "bio": "Ophtalmologiste. Cataracte, glaucome, onchocercose oculaire, chirurgie de la vue en zones rurales.",            "tel": "+243 81 567 8901"},
    # ── France — Paris ──
    {"id": "MED-P01", "prenom": "Jean-Pierre","nom": "MWAMBA-MARTIN","specialite": "Médecine générale",            "pays": "FR", "ville": "Paris",      "langues": ["français", "lingala", "anglais"],          "disponible": True,  "note": 4.8, "consultations": 1412, "tarif_usd": 15.0, "bio": "Médecin généraliste retraité AP-HP. 28 ans d'expérience. Spécialiste pathologies tropicales.",                  "tel": "+33 6 12 34 56 78"},
    {"id": "MED-P02", "prenom": "Chantal",  "nom": "DUBOIS-LEMAIRE","specialite": "Pédiatrie",                    "pays": "FR", "ville": "Paris",      "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.9, "consultations": 987,  "tarif_usd": 18.0, "bio": "Pédiatre retraitée AP-HP Necker. Urgences pédiatriques, pathologies tropicales de l'enfant.",                   "tel": "+33 6 98 76 54 32"},
    {"id": "MED-P03", "prenom": "Marc",     "nom": "LEBLANC",      "specialite": "Endocrinologie & Diabète",       "pays": "FR", "ville": "Paris",      "langues": ["français"],                                "disponible": True,  "note": 4.7, "consultations": 534,  "tarif_usd": 20.0, "bio": "Endocrinologue retraité. Diabète type 2 en Afrique, obésité, dysthyroïdies tropicales.",                         "tel": "+33 6 23 45 67 89"},
    {"id": "MED-P04", "prenom": "Sylvie",   "nom": "MOREAU-NGANDU","specialite": "Gynécologie-Obstétrique",        "pays": "FR", "ville": "Paris",      "langues": ["français", "lingala"],                     "disponible": False, "note": 4.8, "consultations": 412,  "tarif_usd": 18.0, "bio": "Gynécologue. Planning familial, contraception, ménopause. Bénévole AMREF Africa.",                              "tel": "+33 7 11 22 33 44"},
    {"id": "MED-P05", "prenom": "Antoine",  "nom": "PICHON",       "specialite": "Cardiologie",                    "pays": "FR", "ville": "Paris",      "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.9, "consultations": 289,  "tarif_usd": 22.0, "bio": "Cardiologue retraité HEGP. Téléconsultation cardiologique Afrique subsaharienne depuis 2017.",                  "tel": "+33 6 55 66 77 88"},
    # ── France — Lyon ──
    {"id": "MED-LY1", "prenom": "Emmanuel", "nom": "BAUDOUIN",     "specialite": "Médecine interne & Cardiologie", "pays": "FR", "ville": "Lyon",       "langues": ["français"],                                "disponible": True,  "note": 4.9, "consultations": 756,  "tarif_usd": 20.0, "bio": "Cardiologue interniste retraité CHU Lyon. Bénévole santé communautaire Afrique centrale.",                       "tel": "+33 4 78 12 34 56"},
    {"id": "MED-LY2", "prenom": "Isabelle", "nom": "DUPONT-KANDO", "specialite": "Médecine tropicale",             "pays": "FR", "ville": "Lyon",       "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.8, "consultations": 398,  "tarif_usd": 17.0, "bio": "Médecin tropicaliste. Bilharziose, paludisme grave, fièvres de retour. Bénévole Médecins du Monde.",             "tel": "+33 4 72 23 45 67"},
    {"id": "MED-LY3", "prenom": "François", "nom": "RENAUD",       "specialite": "Neurologie",                     "pays": "FR", "ville": "Lyon",       "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.7, "consultations": 278,  "tarif_usd": 21.0, "bio": "Neurologue retraité. Épilepsie en zone tropicale, AVC, complications neurologiques paludisme sévère.",          "tel": "+33 6 34 56 78 90"},
    # ── France — Marseille ──
    {"id": "MED-MA1", "prenom": "Nathalie", "nom": "FERRARI-BONI", "specialite": "Médecine tropicale",             "pays": "FR", "ville": "Marseille",  "langues": ["français", "anglais", "arabe"],            "disponible": True,  "note": 4.8, "consultations": 621,  "tarif_usd": 16.0, "bio": "Spécialiste médecine des voyages et tropicale, CHU La Timone. Paludisme, arboviroses, choléra.",                "tel": "+33 4 91 12 34 56"},
    {"id": "MED-MA2", "prenom": "Éric",     "nom": "LAMBERT",      "specialite": "Médecine générale",              "pays": "FR", "ville": "Marseille",  "langues": ["français"],                                "disponible": True,  "note": 4.6, "consultations": 445,  "tarif_usd": 14.0, "bio": "Généraliste retraité avec 10 ans de missions ONG en Afrique centrale et de l'Ouest.",                           "tel": "+33 6 44 55 66 77"},
    # ── Belgique — Bruxelles ──
    {"id": "MED-BR1", "prenom": "Marc",     "nom": "DEFAYS-LUMBU", "specialite": "Médecine générale",              "pays": "BE", "ville": "Bruxelles",  "langues": ["français", "néerlandais", "lingala"],      "disponible": True,  "note": 4.8, "consultations": 912,  "tarif_usd": 15.0, "bio": "Médecin généraliste bruxellois d'origine congolaise. Diaspora engagée dans la santé communautaire RDC.",        "tel": "+32 2 123 4567"},
    {"id": "MED-BR2", "prenom": "Sophie",   "nom": "VANDERBERG",   "specialite": "Pédiatrie",                      "pays": "BE", "ville": "Bruxelles",  "langues": ["français", "néerlandais", "anglais"],      "disponible": True,  "note": 4.9, "consultations": 567,  "tarif_usd": 17.0, "bio": "Pédiatre UCL Bruxelles. Malnutrition enfant, maladies infectieuses pédiatriques tropicales.",                   "tel": "+32 478 12 34 56"},
    {"id": "MED-BR3", "prenom": "Patrick",  "nom": "NGOY-CLAES",   "specialite": "Psychiatrie",                    "pays": "BE", "ville": "Bruxelles",  "langues": ["français", "lingala", "anglais"],          "disponible": False, "note": 4.7, "consultations": 234,  "tarif_usd": 19.0, "bio": "Psychiatre. Santé mentale diaspora africaine, PTSD, troubles bipolaires, schizophrénie.",                       "tel": "+32 477 23 45 67"},
    # ── Suisse — Genève ──
    {"id": "MED-GE1", "prenom": "François", "nom": "NKOSI",        "specialite": "Psychiatrie & Psychologie",      "pays": "CH", "ville": "Genève",     "langues": ["français", "anglais", "swahili"],          "disponible": True,  "note": 4.7, "consultations": 398,  "tarif_usd": 22.0, "bio": "Psychiatre anciennement OMS Genève. Santé mentale en zones de conflit et pauvreté extrême.",                   "tel": "+41 79 234 56 78"},
    {"id": "MED-GE2", "prenom": "Claire",   "nom": "BONNET",       "specialite": "Épidémiologie & Santé publique", "pays": "CH", "ville": "Genève",     "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.8, "consultations": 189,  "tarif_usd": 20.0, "bio": "Épidémiologiste OMS retraitée. Programmes vaccination, surveillance épidémique, VIH.",                          "tel": "+41 22 345 6789"},
    # ── Maroc — Casablanca ──
    {"id": "MED-CA1", "prenom": "Amina",    "nom": "RACHID",       "specialite": "Dermatologie & Maladies infect.", "pays": "MA", "ville": "Casablanca", "langues": ["français", "arabe", "anglais"],            "disponible": True,  "note": 4.6, "consultations": 843,  "tarif_usd": 14.0, "bio": "Dermatologue. 20 ans maladies tropicales cutanées. Active en télémédecine Afrique subsaharienne.",              "tel": "+212 6 12 345 678"},
    {"id": "MED-CA2", "prenom": "Youssef",  "nom": "BENALI",       "specialite": "Médecine interne",               "pays": "MA", "ville": "Casablanca", "langues": ["français", "arabe"],                       "disponible": True,  "note": 4.7, "consultations": 456,  "tarif_usd": 13.0, "bio": "Interniste. HTA, diabète, insuffisance rénale chronique. Expert médecine communautaire Afrique.",               "tel": "+212 5 22 345 678"},
    # ── Sénégal — Dakar ──
    {"id": "MED-DK1", "prenom": "Moussa",   "nom": "DIALLO",       "specialite": "Médecine générale & VIH/SIDA",   "pays": "SN", "ville": "Dakar",      "langues": ["français", "wolof", "anglais"],            "disponible": True,  "note": 4.8, "consultations": 789,  "tarif_usd": 12.0, "bio": "Généraliste, expert VIH/SIDA en Afrique subsaharienne. Protocoles OMS ARV.",                                   "tel": "+221 77 123 4567"},
    {"id": "MED-DK2", "prenom": "Fatou",    "nom": "NDIAYE",       "specialite": "Gynécologie-Obstétrique",        "pays": "SN", "ville": "Dakar",      "langues": ["français", "wolof"],                       "disponible": True,  "note": 4.9, "consultations": 634,  "tarif_usd": 12.0, "bio": "Gynécologue. Mortalité maternelle, accouchements à risque, fistules obstétricales.",                            "tel": "+221 78 234 5678"},
    # ── Cameroun ──
    {"id": "MED-CM1", "prenom": "Paul",     "nom": "ENYEGUE",      "specialite": "Médecine générale",              "pays": "CM", "ville": "Douala",     "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.7, "consultations": 567,  "tarif_usd": 10.0, "bio": "Généraliste, 15 ans dans les hôpitaux de district du Cameroun. Pathologies tropicales.",                       "tel": "+237 6 12 345 678"},
    # ── Côte d'Ivoire ──
    {"id": "MED-CI1", "prenom": "Awa",      "nom": "KOUASSI",      "specialite": "Pédiatrie & Nutrition",          "pays": "CI", "ville": "Abidjan",    "langues": ["français", "dioula"],                      "disponible": True,  "note": 4.8, "consultations": 423,  "tarif_usd": 11.0, "bio": "Pédiatre-nutritionniste. Protocoles PECIMA, PEC malnutrition aiguë, CNA/CRENAS.",                               "tel": "+225 07 12 345 678"},
    # ── RDC — Mbuji-Mayi ──
    {"id": "MED-M01", "prenom": "Célestin", "nom": "MUKENDI",      "specialite": "Médecine générale",              "pays": "CD", "ville": "Mbuji-Mayi", "langues": ["français", "tshiluba"],                    "disponible": True,  "note": 4.7, "consultations": 891,  "tarif_usd": 0.0,  "bio": "Généraliste, grand Kasaï. Paludisme, typhoïde, anémie drépanocytaire, hygiène rurale.",                         "tel": "+243 81 456 7890"},
    {"id": "MED-M02", "prenom": "Thérèse",  "nom": "TSHIBANGU",    "specialite": "Gynécologie & Maternité",        "pays": "CD", "ville": "Mbuji-Mayi", "langues": ["français", "tshiluba"],                    "disponible": True,  "note": 4.8, "consultations": 712,  "tarif_usd": 0.0,  "bio": "Gynécologue. Maternité rurale, accouchements à domicile surveillés, contraception.",                            "tel": "+243 82 567 8901"},
    {"id": "MED-M03", "prenom": "Dieudonné","nom": "KALONJI",      "specialite": "Médecine tropicale",             "pays": "CD", "ville": "Mbuji-Mayi", "langues": ["français", "tshiluba", "swahili"],         "disponible": False, "note": 4.6, "consultations": 534,  "tarif_usd": 0.0,  "bio": "Tropicaliste. Fièvres hémorragiques, mpox, maladie du sommeil (HAT).",                                           "tel": "+243 99 678 9012"},
    {"id": "MED-M04", "prenom": "Yvonne",   "nom": "KABAMBA",      "specialite": "Pédiatrie",                      "pays": "CD", "ville": "Mbuji-Mayi", "langues": ["français", "tshiluba"],                    "disponible": True,  "note": 4.9, "consultations": 623,  "tarif_usd": 0.0,  "bio": "Pédiatre. Malnutrition sévère, paludisme pédiatrique, rougeole, PEV.",                                          "tel": "+243 81 789 0123"},
    # ── France — Bordeaux ──
    {"id": "MED-BO1", "prenom": "Laurent",  "nom": "ROUSSEAU",     "specialite": "Hépato-Gastro-Entérologie",      "pays": "FR", "ville": "Bordeaux",   "langues": ["français"],                                "disponible": True,  "note": 4.7, "consultations": 312,  "tarif_usd": 19.0, "bio": "Hépatologue. Hépatites B/C, cirrhose, parasitoses digestives (amibiase, giardiase).",                           "tel": "+33 5 57 12 34 56"},
    {"id": "MED-BO2", "prenom": "Hélène",   "nom": "GARNIER",      "specialite": "Ophtalmologie",                  "pays": "FR", "ville": "Bordeaux",   "langues": ["français", "anglais"],                     "disponible": True,  "note": 4.8, "consultations": 245,  "tarif_usd": 18.0, "bio": "Ophtalmologiste. Trachome, onchocercose, cataracte, dépistage glaucome à distance.",                           "tel": "+33 6 67 78 89 90"},
    # ── Suisse — Lausanne ──
    {"id": "MED-LA1", "prenom": "Jean-Louis","nom": "BLANC",       "specialite": "Cardiologie & Médecine interne", "pays": "CH", "ville": "Lausanne",   "langues": ["français", "anglais", "allemand"],         "disponible": True,  "note": 4.9, "consultations": 423,  "tarif_usd": 23.0, "bio": "Cardiologue CHUV retraité. Insuffisance cardiaque, RHD (rhumatisme articulaire), HTA sévère.",                  "tel": "+41 21 456 7890"},
    # ── France — Toulouse & Strasbourg ──
    {"id": "MED-TO1", "prenom": "Marie-Claire","nom": "FONTAINE",  "specialite": "Médecine générale",              "pays": "FR", "ville": "Toulouse",   "langues": ["français"],                                "disponible": True,  "note": 4.6, "consultations": 389,  "tarif_usd": 14.0, "bio": "Généraliste retraitée. Médecine préventive, dépistage cancers, maladies chroniques.",                           "tel": "+33 5 61 12 34 56"},
    {"id": "MED-ST1", "prenom": "Klaus",     "nom": "WEBER-DUPONT","specialite": "Endocrinologie",                 "pays": "FR", "ville": "Strasbourg", "langues": ["français", "allemand", "anglais"],         "disponible": True,  "note": 4.7, "consultations": 267,  "tarif_usd": 18.0, "bio": "Endocrinologue. Diabète, thyroïde, iode en zones de carence. Formation OMS Genève.",                           "tel": "+33 3 88 12 34 56"},
    # ── Belgique — Liège ──
    {"id": "MED-LG1", "prenom": "Rosette",  "nom": "PEETERS",      "specialite": "Médecine générale & Pédiatrie",  "pays": "BE", "ville": "Liège",      "langues": ["français", "néerlandais"],                  "disponible": True,  "note": 4.7, "consultations": 478,  "tarif_usd": 15.0, "bio": "Généraliste-pédiatre retraitée ULg. Tropicaliste bénévole, missions Congo 1990-2010.",                          "tel": "+32 4 312 3456"},
    # ── Maroc — Rabat ──
    {"id": "MED-RB1", "prenom": "Karim",    "nom": "EL MANSOURI",  "specialite": "Médecine interne & Rhumatologie","pays": "MA", "ville": "Rabat",      "langues": ["français", "arabe", "anglais"],            "disponible": True,  "note": 4.7, "consultations": 312,  "tarif_usd": 13.0, "bio": "Interniste-rhumatologue. Polyarthrite rhumatoïde, lupus, maladies rares en Afrique.",                           "tel": "+212 5 37 123 456"},
]

# ─── Règles de disponibilité (sante_planning) ─────────────────────────────────
PLANNING_RULES: dict[str, list[dict]] = {
    "MED-K01": [{"jours": [1,2,3,4,5],  "h_debut": 18*60, "h_fin": 22*60, "duree": 30}],
    "MED-K02": [{"jours": [1,2,3,4,5],  "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-K03": [{"jours": [2,4,6],       "h_debut": 15*60, "h_fin": 19*60, "duree": 30}],
    "MED-K04": [{"jours": [1,3,5],       "h_debut": 19*60, "h_fin": 22*60, "duree": 30}],
    "MED-K05": [{"jours": [1,2,3,4,5],  "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-K07": [{"jours": [2,4,6],       "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-K08": [{"jours": [1,3,5],       "h_debut": 15*60, "h_fin": 19*60, "duree": 30}],
    "MED-K09": [{"jours": [1,2,3,4,5],  "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-K10": [{"jours": [2,4,6],       "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-K11": [{"jours": [1,2,3,4,5,6],"h_debut": 8*60,  "h_fin": 12*60, "duree": 30}],
    "MED-K12": [{"jours": [1,3,5],       "h_debut": 9*60,  "h_fin": 13*60, "duree": 30}],
    "MED-K13": [{"jours": [2,4],         "h_debut": 10*60, "h_fin": 13*60, "duree": 30}],
    "MED-L01": [{"jours": [1,2,3,4,5],  "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-L02": [{"jours": [2,4,6],       "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-L04": [{"jours": [1,3,5],       "h_debut": 15*60, "h_fin": 19*60, "duree": 30}],
    "MED-L05": [{"jours": [2,4,6],       "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-G01": [{"jours": [1,2,3,4,5],  "h_debut": 18*60, "h_fin": 22*60, "duree": 30}],
    "MED-G02": [{"jours": [1,3,5],       "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-B01": [{"jours": [2,4,6],       "h_debut": 15*60, "h_fin": 19*60, "duree": 30}],
    "MED-B02": [{"jours": [1,3,5],       "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-P01": [{"jours": [1,2,3,4,5],  "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-P02": [{"jours": [2,4,6],       "h_debut": 14*60, "h_fin": 19*60, "duree": 30}],
    "MED-P03": [{"jours": [1,3,5],       "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-P05": [{"jours": [2,4,6],       "h_debut": 18*60, "h_fin": 22*60, "duree": 30}],
    "MED-LY1": [{"jours": [1,2,3,4,5,6],"h_debut": 7*60,  "h_fin": 10*60, "duree": 30}],
    "MED-LY2": [{"jours": [1,3,5],       "h_debut": 8*60,  "h_fin": 12*60, "duree": 30}],
    "MED-LY3": [{"jours": [2,4],         "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-MA1": [{"jours": [1,2,3,4,5],  "h_debut": 9*60,  "h_fin": 13*60, "duree": 30}],
    "MED-MA2": [{"jours": [2,4,6],       "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-BR1": [{"jours": [1,2,3,4,5],  "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-BR2": [{"jours": [2,4,6],       "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-GE1": [{"jours": [3,5],         "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-GE2": [{"jours": [1,3,5],       "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-CA1": [{"jours": [1,3,5],       "h_debut": 15*60, "h_fin": 20*60, "duree": 30}],
    "MED-CA2": [{"jours": [2,4,6],       "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-DK1": [{"jours": [1,2,3,4,5],  "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-DK2": [{"jours": [2,4,6],       "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-CM1": [{"jours": [1,3,5],       "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-CI1": [{"jours": [2,4,6],       "h_debut": 15*60, "h_fin": 19*60, "duree": 30}],
    "MED-M01": [{"jours": [1,2,3,4,5],  "h_debut": 18*60, "h_fin": 22*60, "duree": 30}],
    "MED-M02": [{"jours": [1,3,5],       "h_debut": 16*60, "h_fin": 20*60, "duree": 30}],
    "MED-M04": [{"jours": [2,4,6],       "h_debut": 17*60, "h_fin": 21*60, "duree": 30}],
    "MED-BO1": [{"jours": [1,3,5],       "h_debut": 8*60,  "h_fin": 12*60, "duree": 30}],
    "MED-BO2": [{"jours": [2,4,6],       "h_debut": 9*60,  "h_fin": 13*60, "duree": 30}],
    "MED-LA1": [{"jours": [1,2,3],       "h_debut": 7*60,  "h_fin": 11*60, "duree": 30}],
    "MED-TO1": [{"jours": [1,3,5],       "h_debut": 9*60,  "h_fin": 13*60, "duree": 30}],
    "MED-ST1": [{"jours": [2,4],         "h_debut": 8*60,  "h_fin": 12*60, "duree": 30}],
    "MED-LG1": [{"jours": [2,4,6],       "h_debut": 14*60, "h_fin": 18*60, "duree": 30}],
    "MED-RB1": [{"jours": [1,3,5],       "h_debut": 15*60, "h_fin": 19*60, "duree": 30}],
}

PLANS_FC = {
    "solidaire": {"nom": "Solidaire",  "prix_fc": 2000,  "consultations": 2,  "membres": 1},
    "standard":  {"nom": "Standard",   "prix_fc": 5000,  "consultations": 5,  "membres": 1},
    "famille":   {"nom": "Famille",    "prix_fc": 12000, "consultations": 10, "membres": 6},
    "premium":   {"nom": "Premium",    "prix_fc": 20000, "consultations": 999,"membres": 6},
}

# ─── Helpers stateless ────────────────────────────────────────────────────────

def _medecin_by_id(mid: str) -> Optional[dict]:
    return next((m for m in MEDECINS if m["id"] == mid), None)


def _generate_slots(
    rules: list[dict],
    filter_start: date,
    filter_end: date,
    booked_set: set[str],
) -> list[dict]:
    slots = []
    current = filter_start
    while current <= filter_end:
        dow = current.isoweekday()
        for rule in rules:
            if dow not in rule["jours"]:
                continue
            sm = rule["h_debut"]
            while sm + rule["duree"] <= rule["h_fin"]:
                hd = f"{sm // 60:02d}:{sm % 60:02d}"
                he = f"{(sm + rule['duree']) // 60:02d}:{(sm + rule['duree']) % 60:02d}"
                key = f"{current.isoformat()}_{hd}"
                slots.append({
                    "date": current.isoformat(),
                    "heure_debut": hd,
                    "heure_fin": he,
                    "statut": "reserve" if key in booked_set else "libre",
                    "duree_min": rule["duree"],
                })
                sm += rule["duree"]
        current += timedelta(days=1)
    slots.sort(key=lambda x: (x["date"], x["heure_debut"]))
    return slots


# ─── Helpers DB ───────────────────────────────────────────────────────────────

async def _ensure_abonnement(db: AsyncSession, patient_id: str) -> dict:
    ab = await db.get(Abonnement, patient_id)
    if ab is None:
        today_str = date.today().isoformat()
        mois = date.today().strftime("%Y-%m")
        ab = Abonnement(
            patient_id=patient_id,
            plan="standard",
            statut="actif",
            date_debut=today_str,
        )
        db.add(ab)
        # Premier mois exonéré
        stmt_cot = (
            pg_insert(Cotisation)
            .values(patient_id=patient_id, mois=mois, montant_fc=0.0, statut="exonere")
            .on_conflict_do_nothing(constraint="uq_cotisation_patient_mois")
        )
        await db.execute(stmt_cot)
        await db.commit()
        await db.refresh(ab)
    return {"plan": ab.plan, "statut": ab.statut, "date_debut": ab.date_debut}


async def _check_eligibilite(db: AsyncSession, patient_id: str) -> dict:
    ab = await _ensure_abonnement(db, patient_id)
    plan_info = PLANS_FC.get(ab["plan"], PLANS_FC["standard"])
    montant_mensuel = plan_info["prix_fc"]

    today = date.today()
    mois_recents = []
    for i in range(3):
        m, y = today.month - i, today.year
        if m <= 0:
            m += 12
            y -= 1
        mois_recents.append(f"{y}-{m:02d}")

    # Récupérer cotisations existantes
    res = await db.execute(
        select(Cotisation).where(
            Cotisation.patient_id == patient_id,
            Cotisation.mois.in_(mois_recents),
        )
    )
    existing = {c.mois: c for c in res.scalars().all()}

    # Créer les mois manquants avec on_conflict_do_nothing (race-safe)
    needs_requery = False
    for mois in mois_recents:
        if mois not in existing:
            stmt_ins = (
                pg_insert(Cotisation)
                .values(patient_id=patient_id, mois=mois, montant_fc=montant_mensuel, statut="en_attente")
                .on_conflict_do_nothing(constraint="uq_cotisation_patient_mois")
            )
            await db.execute(stmt_ins)
            needs_requery = True

    if needs_requery:
        await db.commit()
        res2 = await db.execute(
            select(Cotisation).where(
                Cotisation.patient_id == patient_id,
                Cotisation.mois.in_(mois_recents),
            )
        )
        existing = {c.mois: c for c in res2.scalars().all()}

    cots = {m: existing[m].statut for m in mois_recents if m in existing}

    nb_consecutifs = 0
    mois_dus = []
    for mois in mois_recents:
        st = cots.get(mois, "en_attente")
        if st in ("en_attente", "echec"):
            nb_consecutifs += 1
            mois_dus.append(mois)
        else:
            break

    if nb_consecutifs >= 2:
        montant_du = len(mois_dus) * montant_mensuel
        return {
            "eligible": False,
            "statut": "impaye",
            "plan": ab["plan"],
            "montant_du_fc": montant_du,
            "mois_dus": mois_dus,
            "nb_mois_impaye": nb_consecutifs,
            "message": f"{nb_consecutifs} mois consécutifs impayés — régularisation requise.",
            "action_requise": "regulariser",
        }

    solde_row = await db.get(SoldePatient, patient_id)
    solde = solde_row.solde_fc if solde_row else 0.0
    return {
        "eligible": True,
        "statut": "ok",
        "plan": ab["plan"],
        "prix_fc": montant_mensuel,
        "solde_fc": solde,
        "mois_en_attente": nb_consecutifs,
        "message": (
            "Compte santé en ordre."
            if nb_consecutifs == 0
            else "1 mois en attente — régularisation conseillée."
        ),
    }


def _rdv_to_dict(r: RendezVous) -> dict:
    return {
        "id": r.id,
        "medecin_id": r.medecin_id,
        "patient_id": r.patient_id,
        "auxiliaire_id": r.auxiliaire_id,
        "date": r.date,
        "heure_debut": r.heure_debut,
        "heure_fin": r.heure_fin,
        "motif": r.motif,
        "triage_id": r.triage_id,
        "demande_id": r.demande_id,
        "statut": r.statut,
        "room": r.room,
        "lien_patient": r.lien_patient,
        "lien_auxiliaire": r.lien_auxiliaire,
        "lien_medecin": r.lien_medecin,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _ordonnance_to_dict(o: Ordonnance) -> dict:
    return {
        "id": o.id,
        "rdv_id": o.rdv_id,
        "date": o.date,
        "medecin_id": o.medecin_id,
        "medecin": o.medecin,
        "patient_id": o.patient_id,
        "diagnostic": o.diagnostic,
        "prescriptions_texte": o.prescriptions_texte,
        "produits": o.produits or [],
        "recommandations": o.recommandations,
        "statut": o.statut,
        "renouvellement_autorise": o.renouvellement_autorise,
        "nb_renouvellements_restants": o.nb_renouvellements_restants,
        "date_expiration": o.date_expiration,
        "renouvelle_depuis": o.renouvelle_depuis,
        "auxiliaire_renouvellement": o.auxiliaire_renouvellement,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


# ─── Triage fallback (sans API key Anthropic) ────────────────────────────────

def _triage_fallback(symptomes: list, urgence_percue: str) -> dict:
    syms = " ".join(symptomes).lower()
    is_urgent = urgence_percue in ("urgent", "tres_urgent") or any(
        k in syms for k in [
            "thoracique", "respiration", "convulsion", "hémorragie",
            "perte de connaissance", "malaise", "saignement abondant",
        ]
    )
    is_benin = not is_urgent and any(
        k in syms for k in [
            "écorchure", "plaie superficielle", "rhume", "nausée légère",
            "fatigue", "maux de tête légère", "bobo", "égratignure", "toux légère",
        ]
    ) and urgence_percue == "normale"

    if any(k in syms for k in ["anxiété", "insomnie", "tristesse", "comportement", "stress"]):
        mid, spec = "MED-K04", "Psychiatrie & Santé mentale"
    elif any(k in syms for k in ["peau", "éruption", "démangeaisons", "boutons", "jaunissement"]):
        mid, spec = "MED-K08", "Dermatologie"
    elif any(k in syms for k in ["cœur", "thoracique", "cardiaque", "essoufflement", "palpitation"]):
        mid, spec = "MED-K07", "Cardiologie"
    elif any(k in syms for k in ["enfant", "bébé", "nourrisson", "pédiatrique"]):
        mid, spec = "MED-K02", "Pédiatrie"
    elif any(k in syms for k in ["grossesse", "accouchement", "gynéco", "menstruation"]):
        mid, spec = "MED-K05", "Gynécologie-Obstétrique"
    elif any(k in syms for k in ["paludisme", "fièvre", "malaria", "frissons"]):
        mid, spec = "MED-K11", "Médecine tropicale"
    elif any(k in syms for k in ["ventre", "diarrhée", "vomissement", "foie", "intestin"]):
        mid, spec = "MED-BO1", "Hépato-Gastro-Entérologie"
    else:
        mid, spec = "MED-K01", "Médecine générale"

    med = _medecin_by_id(mid)
    nom = f"Dr. {med['prenom']} {med['nom']}" if med else "Dr. à déterminer"

    if is_benin:
        return {
            "niveau_severite": "benin",
            "gestion_locale": True,
            "rdv_recommande": False,
            "rdv_delai": "non_necessaire",
            "specialite_recommandee": None,
            "medecin_recommande_id": None,
            "medecin_recommande_nom": None,
            "urgence_couleur": "vert",
            "urgence_message": "Cas bénin — prise en charge locale suffisante.",
            "analyse": f"Les symptômes décrits ({', '.join(symptomes[:2]) if symptomes else 'décrits'}) ne nécessitent pas de consultation médicale. Une prise en charge par l'auxiliaire est appropriée.",
            "actions_immediates": [
                "Installer le patient confortablement, au calme",
                "Prendre les constantes (température, pouls) et les noter",
                "Appliquer le traitement de base adapté (antiseptique, paracétamol si fièvre légère)",
                "Faire boire de l'eau, surveiller pendant 1 heure",
                "Contacter la famille et informer",
            ],
            "conseil_immediat": "Surveiller l'évolution. Consulter un médecin si les symptômes persistent au-delà de 48h ou s'aggravent.",
            "questions_complementaires": ["Depuis combien de temps ?", "Antécédents connus ?"],
            "orientation_hopital": False,
            "orientation_hopital_motif": "",
        }

    rdv_delai = "immediat" if is_urgent else "dans_la_semaine"
    return {
        "niveau_severite": "urgent" if is_urgent else "modere",
        "gestion_locale": False,
        "rdv_recommande": True,
        "rdv_delai": rdv_delai,
        "specialite_recommandee": spec,
        "medecin_recommande_id": mid,
        "medecin_recommande_nom": nom,
        "urgence_couleur": "rouge" if is_urgent else "orange",
        "urgence_message": "Consultation médicale urgente requise." if is_urgent
                           else "Consultation recommandée dans la semaine.",
        "analyse": f"Sur la base des symptômes signalés, une consultation en {spec} est recommandée. L'auxiliaire doit préparer le dossier patient.",
        "actions_immediates": [
            "Mettre le patient au repos immédiatement",
            "Surveiller les constantes toutes les 15 min",
            "Ne rien administrer sans avis médical",
            "Préparer la fiche patient pour le médecin",
        ],
        "conseil_immediat": "Préparer le dossier patient. En cas d'aggravation soudaine, orienter vers le dispensaire le plus proche.",
        "questions_complementaires": ["Depuis combien de temps ?", "Médicaments pris récemment ?", "Antécédents ?"],
        "orientation_hopital": is_urgent,
        "orientation_hopital_motif": "Symptômes nécessitant une prise en charge hospitalière immédiate." if is_urgent else "",
    }


# ─── Modèles Pydantic ────────────────────────────────────────────────────────

class TriageImage(BaseModel):
    base64: str
    type: str = "image/jpeg"


class TriageInput(BaseModel):
    patient_id: str
    symptomes: List[str]
    description: str = ""
    voice_transcript: str = ""
    urgence_percue: str = "normale"
    age_patient: Optional[int] = None
    images: Optional[List[TriageImage]] = None


class DemandeConsultationCreate(BaseModel):
    patient_id: str
    motif: str
    symptomes: str
    urgence: str = "faible"


class RendezVousCreate(BaseModel):
    medecin_id: str
    patient_id: str
    auxiliaire_id: Optional[str] = None
    date: str
    heure_debut: str
    heure_fin: str
    motif: Optional[str] = None
    triage_id: Optional[str] = None
    demande_id: Optional[str] = None


class DiagnosticCreate(BaseModel):
    diagnostic: str
    prescriptions: Optional[str] = None
    recommandations: Optional[str] = None
    prochain_rdv: Optional[str] = None
    notes_confidentielles: Optional[str] = None


class RechargeCompte(BaseModel):
    patient_id: str
    montant_fc: float
    mode: str = "mpesa"


class FcmTokenUpdate(BaseModel):
    fcm_token: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/fcm-token", summary="Enregistrer le token FCM de l'utilisateur")
async def update_fcm_token(data: FcmTokenUpdate, current: dict = Depends(_get_user)):
    user_id = current.get("id") or current.get("sub", "")
    register_token(user_id, data.fcm_token)
    return {"ok": True, "user_id": user_id}


@router.get("/medecins", summary="Liste des médecins partenaires")
async def list_medecins(
    disponible: Optional[bool] = Query(None),
    pays: Optional[str] = Query(None),
    specialite: Optional[str] = Query(None),
    _: dict = Depends(_get_user),
):
    result = MEDECINS
    if disponible is not None:
        result = [m for m in result if m["disponible"] == disponible]
    if pays:
        result = [m for m in result if pays.upper() in m["pays"].upper()]
    if specialite:
        result = [m for m in result if specialite.lower() in m["specialite"].lower()]
    return {
        "medecins": result,
        "total": len(result),
        "disponibles": sum(1 for m in result if m["disponible"]),
    }


@router.get("/medecins/{medecin_id}", summary="Profil d'un médecin")
async def get_medecin(medecin_id: str, _: dict = Depends(_get_user)):
    med = _medecin_by_id(medecin_id)
    if not med:
        raise HTTPException(404, f"Médecin '{medecin_id}' introuvable")
    rules = PLANNING_RULES.get(medecin_id, [])
    jours_noms = {1:"Lun",2:"Mar",3:"Mer",4:"Jeu",5:"Ven",6:"Sam",7:"Dim"}
    planning_lisible = [
        f"{' · '.join(jours_noms[j] for j in r['jours'])} "
        f"{r['h_debut']//60:02d}h{r['h_debut']%60:02d}–{r['h_fin']//60:02d}h{r['h_fin']%60:02d} "
        f"(créneaux {r['duree']} min)"
        for r in rules
    ]
    return {**med, "planning_rules": planning_lisible}


@router.get("/planning/{medecin_id}", summary="Créneaux disponibles d'un médecin (1 à 6 mois)")
async def get_planning_medecin(
    medecin_id: str,
    mois: Optional[str] = Query(None, description="YYYY-MM (mois de départ)"),
    nb_mois: int = Query(1, ge=1, le=6),
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    import calendar as _cal
    today = date.today()
    if mois:
        start_year, start_month = map(int, mois.split("-"))
    else:
        start_year, start_month = today.year, today.month

    rules = PLANNING_RULES.get(medecin_id, [])
    if not rules:
        return {
            "medecin_id": medecin_id, "mois": f"{start_year:04d}-{start_month:02d}",
            "nb_mois": nb_mois, "creneaux": [], "libres": 0, "reserves": 0,
            "total": 0, "mois_data": [],
        }

    # Calculer la plage de dates couverte
    raw_end = start_month + nb_mois - 1
    end_year = start_year + (raw_end - 1) // 12
    end_month = ((raw_end - 1) % 12) + 1
    d1_global = date(start_year, start_month, 1)
    d2_global = date(end_year, end_month, _cal.monthrange(end_year, end_month)[1])

    # Récupérer tous les RDV réservés dans la plage en une seule requête
    res = await db.execute(
        select(RendezVous.date, RendezVous.heure_debut).where(
            RendezVous.medecin_id == medecin_id,
            RendezVous.statut != "annule",
            RendezVous.date >= d1_global.isoformat(),
            RendezVous.date <= d2_global.isoformat(),
        )
    )
    all_booked: set[str] = {f"{r.date}_{r.heure_debut}" for r in res.all()}

    all_creneaux: list[dict] = []
    mois_data: list[dict] = []

    for offset in range(nb_mois):
        raw_m = start_month + offset
        y = start_year + (raw_m - 1) // 12
        m = ((raw_m - 1) % 12) + 1
        d1 = date(y, m, 1)
        d2 = date(y, m, _cal.monthrange(y, m)[1])
        mois_key = f"{y:04d}-{m:02d}"

        booked = {k for k in all_booked if k.startswith(mois_key)}
        creneaux_m = _generate_slots(rules, d1, d2, booked)
        libres_m = sum(1 for c in creneaux_m if c["statut"] == "libre")
        mois_data.append({
            "mois": mois_key,
            "creneaux": creneaux_m,
            "total": len(creneaux_m),
            "libres": libres_m,
            "reserves": len(creneaux_m) - libres_m,
        })
        all_creneaux.extend(creneaux_m)

    total_libres = sum(1 for c in all_creneaux if c["statut"] == "libre")
    return {
        "medecin_id": medecin_id,
        "mois": f"{start_year:04d}-{start_month:02d}",
        "nb_mois": nb_mois,
        "creneaux": all_creneaux,
        "total": len(all_creneaux),
        "libres": total_libres,
        "reserves": len(all_creneaux) - total_libres,
        "mois_data": mois_data,
    }


@router.get("/planning", summary="Vue calendrier multi-médecins")
async def get_planning_all(
    date_debut: str = Query(...),
    date_fin: str = Query(...),
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    d1 = date.fromisoformat(date_debut)
    d2 = date.fromisoformat(date_fin)

    res = await db.execute(
        select(RendezVous.medecin_id, RendezVous.date, RendezVous.heure_debut).where(
            RendezVous.statut != "annule",
            RendezVous.date >= d1.isoformat(),
            RendezVous.date <= d2.isoformat(),
        )
    )
    all_booked_rows = res.all()

    result = []
    for med in MEDECINS:
        if not med["disponible"]:
            continue
        mid = med["id"]
        rules = PLANNING_RULES.get(mid, [])
        if not rules:
            continue
        booked = {f"{r.date}_{r.heure_debut}" for r in all_booked_rows if r.medecin_id == mid}
        creneaux = _generate_slots(rules, d1, d2, booked)
        libres = sum(1 for c in creneaux if c["statut"] == "libre")
        result.append({
            "medecin_id": mid,
            "medecin_nom": f"Dr. {med['prenom']} {med['nom']}",
            "specialite": med["specialite"],
            "pays": med["pays"],
            "ville": med["ville"],
            "libres": libres,
            "reserves": len(creneaux) - libres,
            "total": len(creneaux),
            "creneaux": creneaux,
        })
    return {"medecins": result, "periode": f"{date_debut} → {date_fin}"}


@router.post("/triage", summary="Triage IA — orientation vers le médecin approprié")
async def triage_ia(data: TriageInput, _: dict = Depends(_get_user)):
    ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    result: dict = {}

    patient_info = f"Patient ID : {data.patient_id}"
    if data.age_patient:
        patient_info += f", {data.age_patient} ans"

    if ANTHROPIC_KEY:
        try:
            import anthropic as _anthropic
            syms = ", ".join(data.symptomes)
            full_desc = data.description or ""
            if data.voice_transcript:
                full_desc += f"\n\n[Message vocal transcrit] {data.voice_transcript}"

            text_block = {
                "type": "text",
                "text": f"""Tu es un assistant médical de triage pour une mutuelle de santé communautaire en RDC.
TON RÔLE PREMIER : gérer les cas bénins avec des instructions concrètes que l'auxiliaire de santé peut exécuter sur place, SANS médecin.
Les téléconsultations sont réservées aux cas modérés à urgents. Ne propose pas de RDV pour les cas bénins courants.

{patient_info}
Symptômes signalés : {syms}
Niveau d'urgence perçu : {data.urgence_percue}
Description : {full_desc or "(aucune)"}

Médecins disponibles pour téléconsultation :
- MED-K01 — Dr. Emmanuel LUKUSA — Médecine générale (Kinshasa)
- MED-K02 — Dr. Béatrice MWAMBA — Pédiatrie (Kinshasa) — enfants
- MED-K04 — Dr. Esther KASONGO — Psychiatrie & Santé mentale (Kinshasa)
- MED-K05 — Dr. Albert NGOMA — Gynécologie-Obstétrique (Kinshasa)
- MED-K07 — Dr. Christian BANZA — Cardiologie (Kinshasa)
- MED-K08 — Dr. Pascale MUAMBA — Dermatologie & Maladies infectieuses (Kinshasa)
- MED-K10 — Dr. Micheline NTUMBA — Neurologie (Kinshasa)
- MED-K11 — Dr. Théodore NKOSI — Médecine tropicale (Kinshasa)
- MED-P01 — Dr. Jean-Pierre MWAMBA-MARTIN — Médecine générale (Paris)
- MED-P02 — Dr. Chantal DUBOIS-LEMAIRE — Pédiatrie (Paris)
- MED-GE1 — Dr. François NKOSI — Psychiatrie (Genève)
- MED-CA1 — Dr. Amina RACHID — Dermatologie (Casablanca)
- MED-LY1 — Dr. Emmanuel BAUDOUIN — Cardiologie (Lyon)
- MED-BO1 — Dr. Laurent ROUSSEAU — Hépato-Gastro-Entérologie (Bordeaux)

Réponds UNIQUEMENT avec un JSON valide (sans markdown ni backticks) :
{{"niveau_severite":"benin|modere|serieux|urgent","gestion_locale":true|false,"rdv_recommande":true|false,"rdv_delai":"non_necessaire|au_besoin|dans_la_semaine|dans_24h|immediat","specialite_recommandee":"...","medecin_recommande_id":"MED-XXX ou null","medecin_recommande_nom":"Dr. ... ou null","urgence_couleur":"vert|orange|rouge","urgence_message":"message court","analyse":"2-3 phrases max, langage simple","actions_immediates":["geste précis 1","geste précis 2","geste précis 3"],"conseil_immediat":"...","questions_complementaires":["?","?"],"orientation_hopital":false,"orientation_hopital_motif":""}}

RÈGLES IMPÉRATIVES :
- BÉNIN (écorchure, légère céphalée, nausée passagère, petit rhume, fatigue légère, bobo) : gestion_locale=true, rdv_recommande=false. actions_immediates : 3-5 gestes concrets.
- MODÉRÉ (fièvre > 38.5°C persistante, douleur abdominale, éruption, céphalée intense, diarrhée sévère) : rdv_recommande=true, rdv_delai="dans_la_semaine".
- SÉRIEUX (fièvre > 39.5°C, vomissements répétés, détresse) : rdv_delai="dans_24h".
- URGENT (douleur thoracique, difficultés respiratoires, perte de connaissance, hémorragie, convulsions, paludisme grave) : rdv_delai="immediat", orientation_hopital=true si transfert nécessaire."""
            }

            content: list = []
            if data.images:
                for img in data.images[:3]:
                    mt = img.type if img.type in ("image/jpeg","image/png","image/gif","image/webp") else "image/jpeg"
                    content.append({"type": "image", "source": {"type": "base64", "media_type": mt, "data": img.base64}})
            content.append(text_block)

            client = _anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": content}],
            )
            raw = resp.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw)
        except Exception:
            result = _triage_fallback(data.symptomes, data.urgence_percue)
    else:
        result = _triage_fallback(data.symptomes, data.urgence_percue)

    triage_id = str(uuid.uuid4())[:12]
    result["triage_id"] = triage_id
    result["patient_id"] = data.patient_id
    result["symptomes"] = data.symptomes
    result["timestamp"] = datetime.now().isoformat()
    return result


@router.post("/demande", summary="Adhérent — soumettre une demande de consultation")
async def creer_demande(
    data: DemandeConsultationCreate,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if current.get("role") not in ("adherent", "famille", "auxiliaire", "admin"):
        raise HTTPException(403, "Accès réservé aux adhérents")

    demande_id = "DEM-" + str(uuid.uuid4())[:8].upper()
    dem = Demande(
        id=demande_id,
        patient_id=data.patient_id,
        motif=data.motif,
        symptomes=data.symptomes,
        urgence=data.urgence,
        statut="en_attente",
    )
    db.add(dem)
    await db.commit()
    return {
        "demande_id": demande_id,
        "statut": "en_attente",
        "message": "Demande reçue. Votre auxiliaire de santé vous contactera très prochainement.",
    }


@router.get("/demandes/mes", summary="Adhérent — mes demandes de consultation")
async def mes_demandes(current: dict = Depends(_get_user), db: AsyncSession = Depends(get_db)):
    patient_id = current.get("id") or current.get("sub")
    res = await db.execute(
        select(Demande)
        .where(Demande.patient_id == patient_id)
        .order_by(Demande.created_at.desc())
    )
    mes = [
        {
            "id": d.id, "patient_id": d.patient_id, "motif": d.motif,
            "symptomes": d.symptomes, "urgence": d.urgence, "statut": d.statut,
            "prise_en_charge_par": d.prise_en_charge_par,
            "prise_en_charge_at": d.prise_en_charge_at.isoformat() if d.prise_en_charge_at else None,
            "rdv_id": d.rdv_id,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in res.scalars().all()
    ]
    return {"demandes": mes}


@router.get("/demandes", summary="Auxiliaire — toutes les demandes en attente")
async def toutes_demandes(
    statut: Optional[str] = None,
    urgence: Optional[str] = None,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if current.get("role") not in ("auxiliaire", "admin"):
        raise HTTPException(403, "Accès réservé aux auxiliaires et administrateurs")

    stmt = select(Demande)
    if statut:
        stmt = stmt.where(Demande.statut == statut)
    if urgence:
        stmt = stmt.where(Demande.urgence == urgence)

    res = await db.execute(stmt)
    rows = res.scalars().all()

    urgence_order = {"eleve": 0, "modere": 1, "faible": 2}
    result = sorted(
        rows,
        key=lambda d: (urgence_order.get(d.urgence, 3), d.created_at or datetime.min),
    )
    return {
        "demandes": [
            {
                "id": d.id, "patient_id": d.patient_id, "motif": d.motif,
                "symptomes": d.symptomes, "urgence": d.urgence, "statut": d.statut,
                "prise_en_charge_par": d.prise_en_charge_par,
                "rdv_id": d.rdv_id,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in result
        ],
        "total": len(result),
    }


@router.patch("/demandes/{demande_id}/prendre-en-charge", summary="Auxiliaire — prendre en charge une demande")
async def prendre_en_charge(
    demande_id: str,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if current.get("role") not in ("auxiliaire", "admin"):
        raise HTTPException(403, "Accès réservé aux auxiliaires")
    dem = await db.get(Demande, demande_id)
    if not dem:
        raise HTTPException(404, "Demande introuvable")
    dem.statut = "en_cours"
    dem.prise_en_charge_par = current.get("id") or current.get("sub")
    dem.prise_en_charge_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "demande_id": demande_id, "statut": "en_cours"}


@router.post("/rdv", summary="Auxiliaire — programmer un rendez-vous médecin")
async def prendre_rdv(
    data: RendezVousCreate,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if current.get("role") not in ("auxiliaire", "admin"):
        raise HTTPException(403, "Seul un auxiliaire de santé peut programmer un rendez-vous médecin.")
    med = _medecin_by_id(data.medecin_id)
    if not med:
        raise HTTPException(404, f"Médecin '{data.medecin_id}' introuvable")
    if not med["disponible"]:
        raise HTTPException(409, f"Dr {med['nom']} n'est pas disponible actuellement")

    elig = await _check_eligibilite(db, data.patient_id)
    if not elig.get("eligible"):
        raise HTTPException(402, detail={
            "code": "cotisation_impayee",
            "message": elig.get("message"),
            "montant_du_fc": elig.get("montant_du_fc"),
            "mois_dus": elig.get("mois_dus", []),
            "action_requise": "regulariser",
        })

    # Vérifier conflit horaire
    res = await db.execute(
        select(RendezVous).where(
            RendezVous.medecin_id == data.medecin_id,
            RendezVous.date == data.date,
            RendezVous.heure_debut == data.heure_debut,
            RendezVous.statut != "annule",
        )
    )
    if res.scalars().first():
        raise HTTPException(409, "Ce créneau est déjà réservé — choisissez un autre.")

    # Verrou croisé Longonia
    slot = await _block_slot_longonia(
        medecin_id=data.medecin_id,
        date_rdv=data.date,
        heure_debut=data.heure_debut,
        heure_fin=data.heure_fin,
        adherent_id=data.patient_id,
        motif=data.motif or "",
    )
    if not slot["ok"]:
        raise HTTPException(409, detail=slot["detail"])

    rdv_id = str(uuid.uuid4())
    room = f"kolo-{rdv_id[:10]}"
    lien_patient    = _jitsi_url(room, "Patient")
    lien_auxiliaire = _jitsi_url(room, "Auxiliaire")
    lien_medecin    = _jitsi_url(room, f"Dr {med['nom']}")

    rdv = RendezVous(
        id=rdv_id,
        medecin_id=data.medecin_id,
        patient_id=data.patient_id,
        auxiliaire_id=data.auxiliaire_id or current.get("id") or current.get("sub"),
        date=data.date,
        heure_debut=data.heure_debut,
        heure_fin=data.heure_fin,
        motif=data.motif,
        triage_id=data.triage_id,
        demande_id=data.demande_id,
        statut="confirme",
        room=room,
        lien_patient=lien_patient,
        lien_auxiliaire=lien_auxiliaire,
        lien_medecin=lien_medecin,
    )
    db.add(rdv)

    # Lier la demande originale au RDV
    if data.demande_id:
        await db.execute(
            sql_update(Demande)
            .where(Demande.id == data.demande_id)
            .values(rdv_id=rdv_id, statut="en_cours")
        )

    await db.commit()

    response = {
        "rdv_id": rdv_id,
        "statut": "confirme",
        "medecin": f"Dr. {med['prenom']} {med['nom']}",
        "specialite": med["specialite"],
        "ville": med["ville"],
        "pays": med["pays"],
        "date": data.date,
        "heure": f"{data.heure_debut} – {data.heure_fin}",
        "lien_patient": lien_patient,
        "lien_auxiliaire": lien_auxiliaire,
        "lien_medecin": lien_medecin,
        "instructions": "Rejoindre la salle vidéo 5 minutes avant l'heure convenue. L'auxiliaire doit préparer les signes vitaux.",
        "longonia_sync": slot.get("longonia_sync", False),
    }
    if not slot.get("longonia_sync"):
        response["longonia_warning"] = slot.get("longonia_warning")

    asyncio.create_task(notify_rdv_confirme(
        patient_id=data.patient_id,
        medecin_id=data.medecin_id,
        medecin_nom=f"Dr. {med['prenom']} {med['nom']}",
        date=data.date,
        heure=f"{data.heure_debut} – {data.heure_fin}",
        rdv_id=rdv_id,
    ))
    return response


@router.get("/rdv", summary="Liste des rendez-vous")
async def list_rdv(
    medecin_id: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    auxiliaire_id: Optional[str] = Query(None),
    mois: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    statut: Optional[str] = Query(None),
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RendezVous)
    if medecin_id:
        stmt = stmt.where(RendezVous.medecin_id == medecin_id)
    if patient_id:
        stmt = stmt.where(RendezVous.patient_id == patient_id)
    if auxiliaire_id:
        stmt = stmt.where(RendezVous.auxiliaire_id == auxiliaire_id)
    if date:
        stmt = stmt.where(RendezVous.date == date)
    elif mois:
        stmt = stmt.where(RendezVous.date.like(f"{mois}%"))
    if statut:
        stmt = stmt.where(RendezVous.statut == statut)
    stmt = stmt.order_by(RendezVous.date.asc(), RendezVous.heure_debut.asc())

    res = await db.execute(stmt)
    rows = res.scalars().all()

    # batch-load all patient/auxiliaire IDs to avoid N+1
    ids = set()
    for r in rows:
        if r.patient_id: ids.add(r.patient_id)
        if r.auxiliaire_id: ids.add(r.auxiliaire_id)
    user_map: dict[str, User] = {}
    if ids:
        u_res = await db.execute(select(User).where(User.id.in_(ids)))
        for u in u_res.scalars().all():
            user_map[u.id] = u

    enriched = []
    for r in rows:
        med = _medecin_by_id(r.medecin_id)
        d = _rdv_to_dict(r)
        d["medecin_nom"] = f"Dr. {med['prenom']} {med['nom']}" if med else r.medecin_id
        d["specialite"] = med["specialite"] if med else ""
        pat = user_map.get(r.patient_id)
        d["patient_nom"] = f"{pat.prenom} {pat.nom}" if pat else r.patient_id or "—"
        aux = user_map.get(r.auxiliaire_id) if r.auxiliaire_id else None
        d["auxiliaire_nom"] = f"{aux.prenom} {aux.nom}" if aux else "—"
        enriched.append(d)
    return {"rendez_vous": enriched, "total": len(enriched)}


@router.get("/rdv/{rdv_id}", summary="Détail d'un rendez-vous")
async def get_rdv(rdv_id: str, _: dict = Depends(_get_user), db: AsyncSession = Depends(get_db)):
    rdv = await db.get(RendezVous, rdv_id)
    if not rdv:
        raise HTTPException(404, "Rendez-vous introuvable")
    med = _medecin_by_id(rdv.medecin_id)

    res_diag = await db.execute(select(Diagnostic).where(Diagnostic.rdv_id == rdv_id))
    diag_obj = res_diag.scalars().first()
    diag = None
    if diag_obj:
        diag = {
            "id": diag_obj.id, "diagnostic": diag_obj.diagnostic,
            "prescriptions": diag_obj.prescriptions, "recommandations": diag_obj.recommandations,
            "prochain_rdv": diag_obj.prochain_rdv,
            "created_at": diag_obj.created_at.isoformat() if diag_obj.created_at else None,
        }

    d = _rdv_to_dict(rdv)
    d["medecin_nom"] = f"Dr. {med['prenom']} {med['nom']}" if med else rdv.medecin_id
    d["specialite"] = med["specialite"] if med else ""
    d["diagnostic"] = diag
    return d


@router.delete("/rdv/{rdv_id}", summary="Annuler un rendez-vous")
async def annuler_rdv(rdv_id: str, _: dict = Depends(_get_user), db: AsyncSession = Depends(get_db)):
    rdv = await db.get(RendezVous, rdv_id)
    if not rdv:
        raise HTTPException(404, "Rendez-vous introuvable")
    if rdv.statut == "annule":
        raise HTTPException(400, "Rendez-vous déjà annulé")
    rdv.statut = "annule"
    rdv.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "annulé", "rdv_id": rdv_id}


@router.put("/rdv/{rdv_id}/statut", summary="Mettre à jour le statut d'un RDV")
async def update_statut_rdv(
    rdv_id: str,
    statut: str = Query(...),
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    valid = {"programmee", "confirme", "en_cours", "termine", "annule"}
    if statut not in valid:
        raise HTTPException(400, f"Statut invalide. Valeurs : {', '.join(valid)}")
    rdv = await db.get(RendezVous, rdv_id)
    if not rdv:
        raise HTTPException(404, "Rendez-vous introuvable")
    rdv.statut = statut
    rdv.updated_at = datetime.utcnow()
    await db.commit()
    return {"rdv_id": rdv_id, "statut": statut}


@router.post("/rdv/{rdv_id}/cloturer", summary="Clôturer — saisir le diagnostic")
async def cloturer_rdv(
    rdv_id: str,
    data: DiagnosticCreate,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if current.get("role") not in ("medecin", "admin"):
        raise HTTPException(403, "Réservé aux médecins")
    rdv = await db.get(RendezVous, rdv_id)
    if not rdv:
        raise HTTPException(404, "Rendez-vous introuvable")

    diag_id = str(uuid.uuid4())[:12]
    diag = Diagnostic(
        id=diag_id,
        rdv_id=rdv_id,
        medecin_id=rdv.medecin_id,
        patient_id=rdv.patient_id,
        diagnostic=data.diagnostic,
        prescriptions=data.prescriptions,
        recommandations=data.recommandations,
        prochain_rdv=data.prochain_rdv,
        notes_confidentielles=data.notes_confidentielles,
    )
    db.add(diag)
    rdv.statut = "termine"
    rdv.updated_at = datetime.utcnow()

    # Création automatique de l'ordonnance numérique
    ordonnance_id = "ORD-" + str(uuid.uuid4())[:10].upper()
    med = _medecin_by_id(rdv.medecin_id)
    medecin_nom = f"Dr. {med['prenom']} {med['nom']}" if med else rdv.medecin_id
    ordo = Ordonnance(
        id=ordonnance_id,
        rdv_id=rdv_id,
        date=date.today().isoformat(),
        medecin_id=rdv.medecin_id,
        medecin=medecin_nom,
        patient_id=rdv.patient_id,
        diagnostic=data.diagnostic,
        prescriptions_texte=data.prescriptions or "",
        produits=[],
        recommandations=data.recommandations or "",
        statut="en_attente_pharmacie",
    )
    db.add(ordo)
    await db.commit()

    asyncio.create_task(notify_consultation_cloturee(
        patient_id=rdv.patient_id,
        medecin_nom=medecin_nom,
        ordonnance_id=ordonnance_id,
        rdv_id=rdv_id,
    ))

    return {
        "diagnostic_id": diag_id,
        "ordonnance_id": ordonnance_id,
        "statut": "terminé",
        "prochain_rdv": data.prochain_rdv,
        "message": "Consultation clôturée. Ordonnance transmise à la pharmacie.",
    }


# ─── Ordonnances ─────────────────────────────────────────────────────────────

@router.get("/ordonnances/detail/{ordonnance_id}", summary="Détail d'une ordonnance")
async def get_ordonnance(
    ordonnance_id: str,
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    ordo = await db.get(Ordonnance, ordonnance_id)
    if not ordo:
        raise HTTPException(404, "Ordonnance introuvable")
    return _ordonnance_to_dict(ordo)


@router.get("/ordonnances", summary="Ordonnances d'un patient")
async def get_ordonnances(
    patient_id: str = Query(...),
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Ordonnance)
        .where(Ordonnance.patient_id == patient_id)
        .order_by(Ordonnance.date.desc())
    )
    return {"ordonnances": [_ordonnance_to_dict(o) for o in res.scalars().all()]}


@router.post("/ordonnances/{ordonnance_id}/renouveler", summary="Auxiliaire — renouveler une ordonnance")
async def renouveler_ordonnance(
    ordonnance_id: str,
    current: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if current.get("role") not in ("auxiliaire", "admin"):
        raise HTTPException(403, "Seul un auxiliaire de santé peut renouveler une ordonnance.")
    ord_ = await db.get(Ordonnance, ordonnance_id)
    if not ord_:
        raise HTTPException(404, "Ordonnance introuvable")
    if not ord_.renouvellement_autorise:
        raise HTTPException(403, "Le médecin n'a pas autorisé le renouvellement de cette ordonnance.")
    restants = ord_.nb_renouvellements_restants
    if restants <= 0:
        raise HTTPException(409, "Aucun renouvellement restant pour cette ordonnance.")
    if ord_.date_expiration and ord_.date_expiration < date.today().isoformat():
        raise HTTPException(409, "Cette ordonnance est expirée.")

    nouveau_id = "ORD-" + str(uuid.uuid4())[:8].upper()
    ord_.nb_renouvellements_restants = restants - 1

    nouvel_ordo = Ordonnance(
        id=nouveau_id,
        rdv_id=ord_.rdv_id,
        date=date.today().isoformat(),
        medecin_id=ord_.medecin_id,
        medecin=ord_.medecin,
        patient_id=ord_.patient_id,
        diagnostic=ord_.diagnostic,
        prescriptions_texte=ord_.prescriptions_texte,
        produits=ord_.produits,
        recommandations=ord_.recommandations,
        statut="emise",
        renouvelle_depuis=ordonnance_id,
        renouvellement_autorise=restants - 1 > 0,
        nb_renouvellements_restants=max(restants - 2, 0),
        auxiliaire_renouvellement=current.get("id") or current.get("sub"),
    )
    db.add(nouvel_ordo)
    await db.commit()

    return {
        "ok": True,
        "ordonnance_id": nouveau_id,
        "ordonnance_origine": ordonnance_id,
        "renouvellements_restants": restants - 1,
        "message": "Ordonnance renouvelée. Une commande pharmacie va être transmise.",
    }


# ─── Compte & Solde ──────────────────────────────────────────────────────────

@router.get("/compte/{patient_id}", summary="Compte santé — solde et cotisations")
async def get_compte(
    patient_id: str,
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    ab = await _ensure_abonnement(db, patient_id)
    plan_info = PLANS_FC.get(ab["plan"], PLANS_FC["standard"])
    elig = await _check_eligibilite(db, patient_id)

    res_cots = await db.execute(
        select(Cotisation)
        .where(Cotisation.patient_id == patient_id)
        .order_by(Cotisation.mois.desc())
        .limit(6)
    )
    cots = [
        {"mois": c.mois, "montant_fc": c.montant_fc, "statut": c.statut}
        for c in res_cots.scalars().all()
    ]

    res_rdv = await db.execute(
        select(RendezVous)
        .where(RendezVous.patient_id == patient_id)
        .order_by(RendezVous.date.desc(), RendezVous.heure_debut.desc())
        .limit(5)
    )
    rdv_patient = [
        {"id": r.id, "medecin_id": r.medecin_id, "date": r.date, "heure_debut": r.heure_debut, "statut": r.statut}
        for r in res_rdv.scalars().all()
    ]

    solde_row = await db.get(SoldePatient, patient_id)
    solde_fc = solde_row.solde_fc if solde_row else 0.0

    return {
        "patient_id": patient_id,
        "abonnement": {
            "plan": ab["plan"],
            "plan_nom": plan_info["nom"],
            "prix_fc": plan_info["prix_fc"],
            "consultations_incluses": plan_info["consultations"],
            "statut": ab["statut"],
            "date_debut": ab["date_debut"],
        },
        "solde_fc": solde_fc,
        "eligibilite": elig,
        "cotisations": cots,
        "rendez_vous_recents": rdv_patient,
    }


@router.post("/compte/recharger", summary="Recharger le solde (Mobile Money)")
async def recharger_compte(
    data: RechargeCompte,
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    if data.montant_fc <= 0:
        raise HTTPException(400, "Montant doit être positif")

    # Upsert solde
    stmt_s = (
        pg_insert(SoldePatient)
        .values(patient_id=data.patient_id, solde_fc=data.montant_fc, updated_at=datetime.utcnow())
        .on_conflict_do_update(
            index_elements=["patient_id"],
            set_={"solde_fc": SoldePatient.solde_fc + data.montant_fc, "updated_at": datetime.utcnow()},
        )
    )
    await db.execute(stmt_s)
    await db.flush()

    # Solde courant
    solde_row = await db.get(SoldePatient, data.patient_id)
    solde_courant = solde_row.solde_fc if solde_row else data.montant_fc

    # Régularisation automatique des cotisations en_attente
    ab = await _ensure_abonnement(db, data.patient_id)
    plan_info = PLANS_FC.get(ab["plan"], PLANS_FC["standard"])

    res_cots = await db.execute(
        select(Cotisation)
        .where(Cotisation.patient_id == data.patient_id, Cotisation.statut == "en_attente")
        .order_by(Cotisation.mois.asc())
    )
    cots = res_cots.scalars().all()

    solde_restant = solde_courant
    regularises = []
    for c in cots:
        if solde_restant >= plan_info["prix_fc"]:
            c.statut = "paye"
            c.mode_paiement = data.mode
            solde_restant -= plan_info["prix_fc"]
            regularises.append(c.mois)
        else:
            break

    if regularises:
        await db.execute(
            sql_update(SoldePatient)
            .where(SoldePatient.patient_id == data.patient_id)
            .values(solde_fc=solde_restant, updated_at=datetime.utcnow())
        )

    await db.commit()

    # Relit le solde final
    solde_row = await db.get(SoldePatient, data.patient_id)
    nouveau_solde = solde_row.solde_fc if solde_row else solde_restant

    return {
        "patient_id": data.patient_id,
        "montant_recharge_fc": data.montant_fc,
        "mode": data.mode,
        "nouveau_solde_fc": nouveau_solde,
        "mois_regularises": regularises,
        "message": (
            f"Rechargement de {data.montant_fc:,.0f} FC effectué via {data.mode.replace('_', ' ')}."
            + (f" Cotisations régularisées : {', '.join(regularises)}." if regularises else "")
        ),
    }


@router.post("/compte/cotisation/payer", summary="Payer une cotisation mensuelle")
async def payer_cotisation(
    patient_id: str,
    mois: str = Query(..., description="YYYY-MM"),
    mode: str = Query("mpesa"),
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    ab = await _ensure_abonnement(db, patient_id)
    plan_info = PLANS_FC.get(ab["plan"], PLANS_FC["standard"])

    res = await db.execute(
        select(Cotisation).where(Cotisation.patient_id == patient_id, Cotisation.mois == mois)
    )
    existing = res.scalars().first()
    if existing:
        existing.statut = "paye"
        existing.mode_paiement = mode
    else:
        db.add(Cotisation(
            patient_id=patient_id,
            mois=mois,
            montant_fc=plan_info["prix_fc"],
            statut="paye",
            mode_paiement=mode,
        ))
    await db.commit()
    return {"status": "payé", "mois": mois, "montant_fc": plan_info["prix_fc"], "mode": mode}


@router.get("/eligibilite/{patient_id}", summary="Vérifier l'éligibilité aux soins")
async def check_eligibilite_endpoint(
    patient_id: str,
    _: dict = Depends(_get_user),
    db: AsyncSession = Depends(get_db),
):
    return await _check_eligibilite(db, patient_id)

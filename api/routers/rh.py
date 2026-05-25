"""
SANTÉ DIRECT — KOLONGONO
Département Administratif : Ressources Humaines
- Rémunérations (paiements via Mobile Money — sans exception)
- Contrats & arrangements prestataires
Accès : superadmin (réseau complet) / admin (réplique centre, déblocage à distance)
"""
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
import os, uuid

SECRET_KEY = os.getenv("SECRET_KEY", "kolongono-dev-secret-change-me")
ALGORITHM  = "HS256"
_bearer    = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/rh", tags=["RH — Ressources Humaines"])


async def _get_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        return jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token invalide")


def _check_rh_access(current: dict, centre_id: str | None = None):
    """superadmin → accès total. admin → accès son centre uniquement."""
    role = current.get("role", "")
    if role == "superadmin":
        return
    if role == "admin":
        if centre_id and current.get("centre_id") != centre_id:
            raise HTTPException(403, "Accès refusé — hors périmètre centre")
        return
    raise HTTPException(403, "Module RH réservé au département administratif (superadmin / admin centre)")


# ── Operateurs Mobile Money par pays ──────────────────────────────────────────

MM_PAR_PAYS = {
    "CD": ["M-Pesa", "Orange Money CD", "Airtel Money"],
    "FR": ["Orange Money FR"],          # virement international Orange → RDC natif
    "BE": ["Orange Money BE"],          # Bancontact + pont Orange international
    "CH": ["Orange Money (Lydia/Twint equiv.)"],
    "MA": ["Orange Money MA"],          # Orange international MA → CD
    "SN": ["Orange Money SN"],          # réseau Orange Afrique
    "CM": ["Orange Money CM"],
    "CI": ["Orange Money CI"],
    "NL": ["Orange Money (Tikkie equiv.)"],
}

# ── Données démo — Intervenants rémunérables ──────────────────────────────────

INTERVENANTS = [

    # ═══ MÉDECINS — Kinshasa (13) ═════════════════════════════════════════════
    # salaire_usd = salaire mensuel fixe (200–450 USD selon spécialité)
    # consultations_mois = KPI activité (informatif, ne détermine PAS le salaire)
    {"id":"MED-K01","prenom":"Dr. Emmanuel","nom":"LUKUSA",       "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x01","consultations_mois":47,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-K02","prenom":"Dr. Béatrice","nom":"MWAMBA",      "type":"medecin","specialite":"Pédiatrie",         "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":240,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x02","consultations_mois":38,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-K03","prenom":"Dr. Sylvain", "nom":"TSHIMANGA",   "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x03","consultations_mois":22,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-K04","prenom":"Dr. Esther",  "nom":"KASONGO",     "type":"medecin","specialite":"Psychiatrie",       "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":270,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x04","consultations_mois":15,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-K05","prenom":"Dr. Célestin","nom":"NGANDU",      "type":"medecin","specialite":"Cardiologie",       "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x05","consultations_mois":31,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-K06","prenom":"Dr. Agnès",   "nom":"MBALA",       "type":"medecin","specialite":"Gynécologie-Obstétrique","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":270,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x06","consultations_mois":29,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-K07","prenom":"Dr. Victor",  "nom":"LUBOYA",      "type":"medecin","specialite":"Dermatologie",      "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x07","consultations_mois":18,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-K08","prenom":"Dr. Rose",    "nom":"KALUMBA",     "type":"medecin","specialite":"Médecine interne",  "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x08","consultations_mois":24,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-K09","prenom":"Dr. Patrice", "nom":"NZINGA",      "type":"medecin","specialite":"Chirurgie générale","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x09","consultations_mois":12,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-K10","prenom":"Dr. Joséphine","nom":"ILUNGA",     "type":"medecin","specialite":"Ophtalmologie",     "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":260,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x10","consultations_mois":8,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-K11","prenom":"Dr. André",   "nom":"MUTOMBO",     "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x11","consultations_mois":33,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-K12","prenom":"Dr. Claudette","nom":"KABILA",     "type":"medecin","specialite":"Endocrinologie",    "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":260,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x12","consultations_mois":6,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-K13","prenom":"Dr. Théodore","nom":"BANZA",       "type":"medecin","specialite":"Neurologie",        "pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":270,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x13","consultations_mois":19,"statut_paiement":"en_attente","centre_id":None},

    # ═══ MÉDECINS — Lubumbashi (5) ════════════════════════════════════════════
    {"id":"MED-L01","prenom":"Dr. Godefroid","nom":"KABAMBA",    "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Lubumbashi",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x14","consultations_mois":28,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-L02","prenom":"Dr. Thérèse", "nom":"MULUMBA",    "type":"medecin","specialite":"Pédiatrie",         "pays":"CD","ville":"Lubumbashi",
     "mode_paiement":"mensuel","salaire_usd":240,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x15","consultations_mois":17,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-L03","prenom":"Dr. Pascal",  "nom":"TSHIMUANGA", "type":"medecin","specialite":"Médecine interne",  "pays":"CD","ville":"Lubumbashi",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x16","consultations_mois":11,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-L04","prenom":"Dr. Chantal", "nom":"MBUYI",      "type":"medecin","specialite":"Gynécologie",       "pays":"CD","ville":"Lubumbashi",
     "mode_paiement":"mensuel","salaire_usd":270,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x17","consultations_mois":9,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-L05","prenom":"Dr. Romuald", "nom":"KAZADI",     "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Lubumbashi",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x18","consultations_mois":22,"statut_paiement":"en_attente","centre_id":None},

    # ═══ MÉDECINS — Goma (3) ══════════════════════════════════════════════════
    {"id":"MED-G01","prenom":"Dr. Dieudonné","nom":"BULAMBO",   "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Goma",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x19","consultations_mois":14,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-G02","prenom":"Dr. Julienne","nom":"KYUNGU",     "type":"medecin","specialite":"Pédiatrie",         "pays":"CD","ville":"Goma",
     "mode_paiement":"mensuel","salaire_usd":240,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x20","consultations_mois":9,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-G03","prenom":"Dr. Fiston",  "nom":"MAKELELE",  "type":"medecin","specialite":"Chirurgie",          "pays":"CD","ville":"Goma",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x21","consultations_mois":5,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Bukavu (2) ════════════════════════════════════════════════
    {"id":"MED-B01","prenom":"Dr. Honoré",  "nom":"BAHATI",     "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Bukavu",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x22","consultations_mois":11,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-B02","prenom":"Dr. Yvonne",  "nom":"NTABOBA",   "type":"medecin","specialite":"Gynécologie",        "pays":"CD","ville":"Bukavu",
     "mode_paiement":"mensuel","salaire_usd":270,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x23","consultations_mois":7,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Mbuji-Mayi (4) ═══════════════════════════════════════════
    {"id":"MED-M01","prenom":"Dr. Alphonse","nom":"TSHIBOLA",   "type":"medecin","specialite":"Médecine générale","pays":"CD","ville":"Mbuji-Mayi",
     "mode_paiement":"mensuel","salaire_usd":220,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x24","consultations_mois":16,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-M02","prenom":"Dr. Marie-Thérèse","nom":"KABONGO","type":"medecin","specialite":"Pédiatrie",        "pays":"CD","ville":"Mbuji-Mayi",
     "mode_paiement":"mensuel","salaire_usd":240,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x25","consultations_mois":12,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-M03","prenom":"Dr. Gaston",  "nom":"KABUYA",    "type":"medecin","specialite":"Médecine interne",   "pays":"CD","ville":"Mbuji-Mayi",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x26","consultations_mois":8,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-M04","prenom":"Dr. Christiane","nom":"TSHILOMBO","type":"medecin","specialite":"Gynécologie",       "pays":"CD","ville":"Mbuji-Mayi",
     "mode_paiement":"mensuel","salaire_usd":270,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x27","consultations_mois":5,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Paris (5) ═════════════════════════════════════════════════
    {"id":"MED-P01","prenom":"Dr. Pierre",  "nom":"DUPONT",    "type":"medecin","specialite":"Médecine générale","pays":"FR","ville":"Paris",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x01","consultations_mois":23,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-P02","prenom":"Dr. Sophie",  "nom":"MARTIN",    "type":"medecin","specialite":"Pédiatrie",         "pays":"FR","ville":"Paris",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x02","consultations_mois":19,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-P03","prenom":"Dr. Marc",    "nom":"LEROY",     "type":"medecin","specialite":"Médecine interne",  "pays":"FR","ville":"Paris",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x03","consultations_mois":11,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-P04","prenom":"Dr. Amélie",  "nom":"GIRARD",   "type":"medecin","specialite":"Dermatologie",       "pays":"FR","ville":"Paris",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x04","consultations_mois":7,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-P05","prenom":"Dr. Jean-Paul","nom":"MOREAU",   "type":"medecin","specialite":"Cardiologie",       "pays":"FR","ville":"Paris",
     "mode_paiement":"mensuel","salaire_usd":320,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x05","consultations_mois":14,"statut_paiement":"en_attente","centre_id":None},

    # ═══ MÉDECINS — Lyon (3) ══════════════════════════════════════════════════
    {"id":"MED-LY1","prenom":"Dr. Nathalie","nom":"FONTAINE",  "type":"medecin","specialite":"Médecine générale","pays":"FR","ville":"Lyon",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x06","consultations_mois":8,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-LY2","prenom":"Dr. François","nom":"BERNARD",   "type":"medecin","specialite":"Psychiatrie",       "pays":"FR","ville":"Lyon",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x07","consultations_mois":6,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-LY3","prenom":"Dr. Claire",  "nom":"THOMAS",   "type":"medecin","specialite":"Gynécologie",        "pays":"FR","ville":"Lyon",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x08","consultations_mois":10,"statut_paiement":"en_attente","centre_id":None},

    # ═══ MÉDECINS — Marseille (2) ═════════════════════════════════════════════
    {"id":"MED-MA1","prenom":"Dr. Antoine", "nom":"LEFEBVRE",  "type":"medecin","specialite":"Médecine générale","pays":"FR","ville":"Marseille",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x09","consultations_mois":9,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-MA2","prenom":"Dr. Isabelle","nom":"ROBERT",    "type":"medecin","specialite":"Pédiatrie",         "pays":"FR","ville":"Marseille",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x10","consultations_mois":5,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Bordeaux (2) ══════════════════════════════════════════════
    {"id":"MED-BO1","prenom":"Dr. Thomas",  "nom":"PETIT",    "type":"medecin","specialite":"Médecine générale","pays":"FR","ville":"Bordeaux",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x11","consultations_mois":7,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-BO2","prenom":"Dr. Élise",   "nom":"DUBOIS",  "type":"medecin","specialite":"Médecine interne",   "pays":"FR","ville":"Bordeaux",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x12","consultations_mois":4,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Toulouse / Strasbourg ════════════════════════════════════
    {"id":"MED-TO1","prenom":"Dr. Nicolas", "nom":"RICHARD",  "type":"medecin","specialite":"Médecine générale","pays":"FR","ville":"Toulouse",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x13","consultations_mois":6,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-ST1","prenom":"Dr. Camille", "nom":"LAURENT",  "type":"medecin","specialite":"Pédiatrie",         "pays":"FR","ville":"Strasbourg",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x14","consultations_mois":3,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Bruxelles (3) + Liège (1) ════════════════════════════════
    {"id":"MED-BR1","prenom":"Dr. Michel",  "nom":"DUPUIS",   "type":"medecin","specialite":"Médecine générale","pays":"BE","ville":"Bruxelles",
     "mode_paiement":"mensuel","salaire_usd":280,"operateur_mm":"Orange Money BE","numero_mm":"+32 4xx xxx x01","consultations_mois":12,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-BR2","prenom":"Dr. Véronique","nom":"PEETERS", "type":"medecin","specialite":"Pédiatrie",         "pays":"BE","ville":"Bruxelles",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money BE","numero_mm":"+32 4xx xxx x02","consultations_mois":8,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-BR3","prenom":"Dr. Jacques", "nom":"MAES",     "type":"medecin","specialite":"Médecine interne",  "pays":"BE","ville":"Bruxelles",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money BE","numero_mm":"+32 4xx xxx x03","consultations_mois":6,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-LG1","prenom":"Dr. Annick",  "nom":"LAMBERT",  "type":"medecin","specialite":"Gynécologie",       "pays":"BE","ville":"Liège",
     "mode_paiement":"mensuel","salaire_usd":300,"operateur_mm":"Orange Money BE","numero_mm":"+32 4xx xxx x04","consultations_mois":4,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Genève (2) + Lausanne (1) ════════════════════════════════
    {"id":"MED-GE1","prenom":"Dr. Frédéric","nom":"MULLER",   "type":"medecin","specialite":"Médecine générale","pays":"CH","ville":"Genève",
     "mode_paiement":"mensuel","salaire_usd":290,"operateur_mm":"Orange Money (Lydia/Twint equiv.)","numero_mm":"+41 7x xxx xx01","consultations_mois":9,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-GE2","prenom":"Dr. Christine","nom":"WEBER",   "type":"medecin","specialite":"Cardiologie",       "pays":"CH","ville":"Genève",
     "mode_paiement":"mensuel","salaire_usd":320,"operateur_mm":"Orange Money (Lydia/Twint equiv.)","numero_mm":"+41 7x xxx xx02","consultations_mois":5,"statut_paiement":"paye","centre_id":None},
    {"id":"MED-LA1","prenom":"Dr. Sylvain", "nom":"FAVRE",    "type":"medecin","specialite":"Psychiatrie",       "pays":"CH","ville":"Lausanne",
     "mode_paiement":"mensuel","salaire_usd":310,"operateur_mm":"Orange Money (Lydia/Twint equiv.)","numero_mm":"+41 7x xxx xx03","consultations_mois":3,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Rotterdam (1) ═════════════════════════════════════════════
    {"id":"MED-RB1","prenom":"Dr. Jan",     "nom":"VANDENBERG","type":"medecin","specialite":"Médecine générale","pays":"NL","ville":"Rotterdam",
     "mode_paiement":"mensuel","salaire_usd":290,"operateur_mm":"Orange Money (Tikkie equiv.)","numero_mm":"+31 6xx xxx x01","consultations_mois":2,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Casablanca (2) ═══════════════════════════════════════════
    {"id":"MED-CA1","prenom":"Dr. Fatima",  "nom":"BENALI",   "type":"medecin","specialite":"Médecine générale","pays":"MA","ville":"Casablanca",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"Orange Money MA","numero_mm":"+212 6xx xxx x01","consultations_mois":7,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-CA2","prenom":"Dr. Ahmed",   "nom":"TAZI",     "type":"medecin","specialite":"Pédiatrie",         "pays":"MA","ville":"Casablanca",
     "mode_paiement":"mensuel","salaire_usd":260,"operateur_mm":"Orange Money MA","numero_mm":"+212 6xx xxx x02","consultations_mois":5,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Dakar (2) ════════════════════════════════════════════════
    {"id":"MED-DK1","prenom":"Dr. Moussa",  "nom":"DIALLO",   "type":"medecin","specialite":"Médecine générale","pays":"SN","ville":"Dakar",
     "mode_paiement":"mensuel","salaire_usd":240,"operateur_mm":"Orange Money SN","numero_mm":"+221 7x xxx xx01","consultations_mois":9,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-DK2","prenom":"Dr. Aminata", "nom":"FALL",     "type":"medecin","specialite":"Gynécologie",       "pays":"SN","ville":"Dakar",
     "mode_paiement":"mensuel","salaire_usd":260,"operateur_mm":"Orange Money SN","numero_mm":"+221 7x xxx xx02","consultations_mois":6,"statut_paiement":"paye","centre_id":None},

    # ═══ MÉDECINS — Douala (1) + Abidjan (1) ════════════════════════════════
    {"id":"MED-CM1","prenom":"Dr. Bruno",   "nom":"MBARGA",   "type":"medecin","specialite":"Médecine générale","pays":"CM","ville":"Douala",
     "mode_paiement":"mensuel","salaire_usd":240,"operateur_mm":"Orange Money CM","numero_mm":"+237 6xx xxx x01","consultations_mois":8,"statut_paiement":"en_attente","centre_id":None},
    {"id":"MED-CI1","prenom":"Dr. Kofi",    "nom":"KOUASSI",  "type":"medecin","specialite":"Pédiatrie",         "pays":"CI","ville":"Abidjan",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"Orange Money CI","numero_mm":"+225 07x xxx x01","consultations_mois":7,"statut_paiement":"paye","centre_id":None},

    # ═══ AUXILIAIRES DE SANTÉ ════════════════════════════════════════════════
    {"id":"AUX-001","prenom":"Jean",       "nom":"MUKEBA",    "type":"auxiliaire","specialite":"Auxiliaire de santé","pays":"CD","ville":"Kolongono",
     "mode_paiement":"mensuel","salaire_usd":85,"operateur_mm":"M-Pesa",        "numero_mm":"+243 81x xxx x01","statut_paiement":"paye","centre_id":"CTR-001"},
    {"id":"AUX-002","prenom":"Grâce",      "nom":"KABONGO",   "type":"auxiliaire","specialite":"Auxiliaire de santé","pays":"CD","ville":"Kolongono",
     "mode_paiement":"mensuel","salaire_usd":85,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x28","statut_paiement":"en_attente","centre_id":"CTR-001"},
    {"id":"AUX-003","prenom":"Bernadette", "nom":"LUFUTA",    "type":"auxiliaire","specialite":"Auxiliaire de santé","pays":"CD","ville":"Kolongono",
     "mode_paiement":"mensuel","salaire_usd":85,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x29","statut_paiement":"paye","centre_id":"CTR-001"},

    # ═══ PERSONNEL ADMINISTRATIF RÉSEAU ══════════════════════════════════════
    {"id":"ADM-RH-01","prenom":"Admin",    "nom":"KOLONGONO", "type":"admin","specialite":"Super Administration","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":250,"operateur_mm":"M-Pesa",       "numero_mm":"+243 99x xxx x99","statut_paiement":"paye","centre_id":None},

    # ═══ PERSONNEL CENTRES — CTR-001 ═════════════════════════════════════════
    {"id":"CTR-ADM-001","prenom":"Monique","nom":"NDAYA",     "type":"personnel_centre","specialite":"Admin local","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":72,"operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x30","statut_paiement":"paye","centre_id":"CTR-001"},
    {"id":"CTR-GES-001","prenom":"Joseph", "nom":"MBUYI",     "type":"personnel_centre","specialite":"Gestionnaire","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":54,"operateur_mm":"M-Pesa",        "numero_mm":"+243 99x xxx x31","statut_paiement":"en_attente","centre_id":"CTR-001"},
    {"id":"CTR-INT-001","prenom":"Marie-Claire","nom":"NZINGA","type":"personnel_centre","specialite":"Infirmier","pays":"CD","ville":"Kinshasa",
     "mode_paiement":"mensuel","salaire_usd":43,"operateur_mm":"Airtel Money",   "numero_mm":"+243 97x xxx x32","statut_paiement":"paye","centre_id":"CTR-001"},
]

# ── Contrats & Arrangements prestataires ──────────────────────────────────────

CONTRATS = [
    {"id":"CONT-001","prestataire":"OVH Cloud","type":"Hébergement & infrastructure","description":"Serveurs VPS — API FastAPI + base de données PostgreSQL + Nginx",
     "montant_usd":45.00,"frequence":"mensuel","echeance":"2026-12-31","statut":"actif","responsable":"Admin KOLONGONO","centre_id":None},
    {"id":"CONT-002","prestataire":"Anthropic (Claude API)","type":"Intelligence artificielle","description":"Triage IA — Claude Haiku par consultation (facturation à l'usage)",
     "montant_usd":30.00,"frequence":"mensuel_variable","echeance":"2027-01-31","statut":"actif","responsable":"Admin KOLONGONO","centre_id":None},
    {"id":"CONT-003","prestataire":"Firebase (Google Cloud)","type":"Notifications push (FCM)","description":"Push notifications — RDV confirmé, rappel médecin, alertes critiques",
     "montant_usd":0.00,"frequence":"usage_gratuit","echeance":"2026-12-31","statut":"actif","responsable":"Admin KOLONGONO","centre_id":None},
    {"id":"CONT-004","prestataire":"Jitsi Meet (auto-hébergé)","type":"Vidéoconférence","description":"Stack Jitsi 4 services Docker — jitsi-web, prosody, jicofo, jvb — serveur propre",
     "montant_usd":0.00,"frequence":"inclus_infra","echeance":"2027-06-30","statut":"actif","responsable":"Admin KOLONGONO","centre_id":None},
    {"id":"CONT-005","prestataire":"Pharmacie Centrale Kinshasa","type":"Fourniture médicaments","description":"Approvisionnement mensuel médicaments essentiels — liste OMS + antipaludiques",
     "montant_usd":200.00,"frequence":"mensuel","echeance":"2026-12-31","statut":"actif","responsable":"Admin KOLONGONO","centre_id":"CTR-001"},
    {"id":"CONT-006","prestataire":"TechKin SARL","type":"Maintenance IT locale","description":"Support technique réseau local, terminaux, tablettes — centres CTR-001",
     "montant_usd":150.00,"frequence":"trimestriel","echeance":"2027-03-31","statut":"actif","responsable":"Monique NDAYA","centre_id":"CTR-001"},
    {"id":"CONT-007","prestataire":"Traducteur LUBA-LINGALA","type":"Localisation contenu","description":"Traduction interface app mobile + documents patients en lingala et tshiluba",
     "montant_usd":80.00,"frequence":"forfait","echeance":"2026-06-30","statut":"termine","responsable":"Admin KOLONGONO","centre_id":None},
    {"id":"CONT-008","prestataire":"Assurance RC Médicale (SONAS)","type":"Assurance professionnelle","description":"Responsabilité civile médicale — couverture téléconsultations réseau RDC",
     "montant_usd":120.00,"frequence":"annuel","echeance":"2026-12-31","statut":"actif","responsable":"Admin KOLONGONO","centre_id":None},
    {"id":"CONT-009","prestataire":"DataProtect RDC","type":"Conformité données de santé","description":"Audit et conformité traitement données patients — RGPD / droit congolais",
     "montant_usd":250.00,"frequence":"annuel","echeance":"2027-01-15","statut":"actif","responsable":"Admin KOLONGONO","centre_id":None},
]

# ── Historique paiements (démo) ────────────────────────────────────────────────

HISTORIQUE_PAIEMENTS = [
    {"id":"PAY-001","date":"2026-04-30","destinataire":"Dr. Emmanuel LUKUSA","type":"medecin","montant_usd":220.00,"nb_consult":47,
     "operateur_mm":"M-Pesa","numero_mm":"+243 99x xxx x01","reference_mm":"MP2604301x001","statut":"confirme","centre_id":None},
    {"id":"PAY-002","date":"2026-04-30","destinataire":"Dr. Béatrice MWAMBA","type":"medecin","montant_usd":240.00,"nb_consult":38,
     "operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x02","reference_mm":"OM2604302x002","statut":"confirme","centre_id":None},
    {"id":"PAY-003","date":"2026-04-30","destinataire":"Jean MUKEBA","type":"auxiliaire","montant_usd":85.00,"nb_consult":None,
     "operateur_mm":"M-Pesa","numero_mm":"+243 81x xxx x01","reference_mm":"MP2604303x003","statut":"confirme","centre_id":"CTR-001"},
    {"id":"PAY-004","date":"2026-04-30","destinataire":"Dr. Pierre DUPONT","type":"medecin","montant_usd":280.00,"nb_consult":23,
     "operateur_mm":"Orange Money FR","numero_mm":"+33 6xx xxx x01","reference_mm":"OMF2604304x004","statut":"confirme","centre_id":None},
    {"id":"PAY-005","date":"2026-04-30","destinataire":"OVH Cloud","type":"prestataire","montant_usd":45.00,"nb_consult":None,
     "operateur_mm":"Virement","numero_mm":"IBAN FR76xxxx","reference_mm":"VIR2604305x005","statut":"confirme","centre_id":None},
    {"id":"PAY-006","date":"2026-03-31","destinataire":"Dr. Emmanuel LUKUSA","type":"medecin","montant_usd":220.00,"nb_consult":43,
     "operateur_mm":"M-Pesa","numero_mm":"+243 99x xxx x01","reference_mm":"MP2603301x001","statut":"confirme","centre_id":None},
    {"id":"PAY-007","date":"2026-03-31","destinataire":"Grâce KABONGO","type":"auxiliaire","montant_usd":85.00,"nb_consult":None,
     "operateur_mm":"Orange Money CD","numero_mm":"+243 84x xxx x28","reference_mm":"OM2603307x028","statut":"confirme","centre_id":"CTR-001"},
    {"id":"PAY-008","date":"2026-03-31","destinataire":"Anthropic (Claude API)","type":"prestataire","montant_usd":27.40,"nb_consult":None,
     "operateur_mm":"Carte bancaire","numero_mm":"VISA xxxx","reference_mm":"ANTH26033x008","statut":"confirme","centre_id":None},
]

# ── Modèles Pydantic ──────────────────────────────────────────────────────────

class MobileMoneyUpdate(BaseModel):
    operateur_mm: str
    numero_mm: str

class PaiementRequest(BaseModel):
    intervenant_ids: List[str]
    mois: str                     # "2026-05"
    note: Optional[str] = None

class ContratCreate(BaseModel):
    prestataire: str
    type: str
    description: str
    montant_usd: float
    frequence: str
    echeance: str
    responsable: str
    centre_id: Optional[str] = None

class ContratUpdate(BaseModel):
    statut: Optional[str] = None
    montant_usd: Optional[float] = None
    echeance: Optional[str] = None
    description: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/intervenants")
async def list_intervenants(
    type: Optional[str]      = Query(None, description="medecin | auxiliaire | personnel_centre | admin"),
    pays: Optional[str]      = Query(None, description="Code ISO pays — CD, FR, BE…"),
    statut: Optional[str]    = Query(None, description="en_attente | paye"),
    centre_id: Optional[str] = Query(None),
    current: dict            = Depends(_get_user),
):
    _check_rh_access(current, centre_id)
    data = INTERVENANTS[:]
    if type:      data = [i for i in data if i["type"] == type]
    if pays:      data = [i for i in data if i["pays"] == pays]
    if statut:    data = [i for i in data if i["statut_paiement"] == statut]
    if centre_id: data = [i for i in data if i.get("centre_id") == centre_id]

    for i in data:
        i["montant_du_usd"] = i.get("salaire_usd", 0)
    return {"total": len(data), "intervenants": data}


@router.get("/intervenants/{intervenant_id}")
async def get_intervenant(intervenant_id: str, current: dict = Depends(_get_user)):
    _check_rh_access(current)
    item = next((i for i in INTERVENANTS if i["id"] == intervenant_id), None)
    if not item:
        raise HTTPException(404, f"Intervenant {intervenant_id} introuvable")
    item = dict(item)
    item["montant_du_usd"] = item.get("salaire_usd", 0)
    return item


@router.patch("/intervenants/{intervenant_id}/mobile-money")
async def update_mobile_money(
    intervenant_id: str,
    data: MobileMoneyUpdate,
    current: dict = Depends(_get_user),
):
    _check_rh_access(current)
    item = next((i for i in INTERVENANTS if i["id"] == intervenant_id), None)
    if not item:
        raise HTTPException(404, f"Intervenant {intervenant_id} introuvable")
    item["operateur_mm"] = data.operateur_mm
    item["numero_mm"]    = data.numero_mm
    return {"message": f"Compte Mobile Money mis à jour — {data.operateur_mm} {data.numero_mm}"}


@router.get("/paie/resume")
async def resume_paie(mois: str = Query("2026-05"), current: dict = Depends(_get_user)):
    _check_rh_access(current)
    medecins    = [i for i in INTERVENANTS if i["type"] == "medecin"]
    autres      = [i for i in INTERVENANTS if i["type"] != "medecin"]
    en_attente  = [i for i in INTERVENANTS if i["statut_paiement"] == "en_attente"]
    total_consult = sum(i.get("consultations_mois", 0) for i in medecins)
    total_med   = sum(i.get("salaire_usd", 0) for i in medecins)
    total_autres= sum(i.get("salaire_usd", 0) for i in autres)
    total_global= round(total_med + total_autres, 2)
    montant_attente = sum(i.get("salaire_usd", 0) for i in en_attente)
    return {
        "mois": mois,
        "nb_intervenants": len(INTERVENANTS),
        "nb_medecins": len(medecins),
        "nb_autres": len(autres),
        "nb_en_attente": len(en_attente),
        "total_consultations_mois": total_consult,
        "masse_salariale_medecins_usd": round(total_med, 2),
        "masse_salariale_autres_usd": round(total_autres, 2),
        "masse_salariale_totale_usd": total_global,
        "montant_en_attente_usd": round(montant_attente, 2),
        "operateurs": list(MM_PAR_PAYS.keys()),
    }


@router.post("/paie/declencher")
async def declencher_paiements(req: PaiementRequest, current: dict = Depends(_get_user)):
    if current.get("role") != "superadmin":
        raise HTTPException(403, "Déclenchement paiements — superadmin uniquement")
    resultats = []
    for iid in req.intervenant_ids:
        item = next((i for i in INTERVENANTS if i["id"] == iid), None)
        if not item:
            resultats.append({"id": iid, "statut": "introuvable"})
            continue
        if item["statut_paiement"] == "paye":
            resultats.append({"id": iid, "statut": "deja_paye", "destinataire": f"{item['prenom']} {item['nom']}"})
            continue
        montant = item.get("salaire_usd", 0)
        ref_mm = f"SD{req.mois.replace('-','')}{iid[-3:]}"
        HISTORIQUE_PAIEMENTS.append({
            "id":           f"PAY-{uuid.uuid4().hex[:6].upper()}",
            "date":         datetime.now().date().isoformat(),
            "destinataire": f"{item['prenom']} {item['nom']}",
            "type":         item["type"],
            "montant_usd":  round(montant, 2),
            "nb_consult":   item.get("consultations_mois"),
            "operateur_mm": item["operateur_mm"],
            "numero_mm":    item["numero_mm"],
            "reference_mm": ref_mm,
            "statut":       "confirme",
            "centre_id":    item.get("centre_id"),
        })
        item["statut_paiement"] = "paye"
        resultats.append({"id": iid, "statut": "paye", "destinataire": f"{item['prenom']} {item['nom']}",
                          "montant_usd": round(montant, 2), "reference_mm": ref_mm,
                          "operateur_mm": item["operateur_mm"]})
    nb_ok = sum(1 for r in resultats if r["statut"] == "paye")
    return {"mois": req.mois, "traites": len(resultats), "payes": nb_ok, "resultats": resultats}


@router.post("/paie/{intervenant_id}/payer")
async def payer_intervenant(intervenant_id: str, mois: str = "2026-05", current: dict = Depends(_get_user)):
    _check_rh_access(current)
    item = next((i for i in INTERVENANTS if i["id"] == intervenant_id), None)
    if not item:
        raise HTTPException(404, "Intervenant introuvable")
    if item["statut_paiement"] == "paye":
        raise HTTPException(409, "Déjà payé ce mois")
    montant = item.get("salaire_usd", 0)
    ref_mm = f"SD{mois.replace('-','')}{intervenant_id[-3:]}"
    HISTORIQUE_PAIEMENTS.append({
        "id": f"PAY-{uuid.uuid4().hex[:6].upper()}",
        "date": datetime.now().date().isoformat(),
        "destinataire": f"{item['prenom']} {item['nom']}",
        "type": item["type"],
        "montant_usd": round(montant, 2),
        "nb_consult": item.get("consultations_mois"),
        "operateur_mm": item["operateur_mm"],
        "numero_mm": item["numero_mm"],
        "reference_mm": ref_mm,
        "statut": "confirme",
        "centre_id": item.get("centre_id"),
    })
    item["statut_paiement"] = "paye"
    return {"message": f"Paiement envoyé — {item['operateur_mm']} → {item['numero_mm']}",
            "montant_usd": round(montant, 2), "reference_mm": ref_mm}


@router.get("/historique")
async def historique_paiements(
    type: Optional[str]      = Query(None),
    centre_id: Optional[str] = Query(None),
    current: dict            = Depends(_get_user),
):
    _check_rh_access(current, centre_id)
    data = HISTORIQUE_PAIEMENTS[:]
    if type:      data = [p for p in data if p["type"] == type]
    if centre_id: data = [p for p in data if p.get("centre_id") == centre_id]
    data.sort(key=lambda p: p["date"], reverse=True)
    return {"total": len(data), "paiements": data}


@router.get("/contrats")
async def list_contrats(
    statut: Optional[str]    = Query(None, description="actif | termine | suspendu"),
    centre_id: Optional[str] = Query(None),
    current: dict            = Depends(_get_user),
):
    _check_rh_access(current, centre_id)
    data = CONTRATS[:]
    if statut:    data = [c for c in data if c["statut"] == statut]
    if centre_id: data = [c for c in data if c.get("centre_id") == centre_id]
    return {"total": len(data), "contrats": data}


@router.post("/contrats")
async def create_contrat(data: ContratCreate, current: dict = Depends(_get_user)):
    if current.get("role") != "superadmin":
        raise HTTPException(403, "Création contrat — superadmin uniquement")
    new_id = f"CONT-{uuid.uuid4().hex[:6].upper()}"
    contrat = {"id": new_id, **data.dict(), "statut": "actif", "date_creation": datetime.now().isoformat()}
    CONTRATS.append(contrat)
    return contrat


@router.patch("/contrats/{contrat_id}")
async def update_contrat(contrat_id: str, data: ContratUpdate, current: dict = Depends(_get_user)):
    _check_rh_access(current)
    c = next((x for x in CONTRATS if x["id"] == contrat_id), None)
    if not c:
        raise HTTPException(404, "Contrat introuvable")
    if data.statut is not None:    c["statut"]       = data.statut
    if data.montant_usd is not None: c["montant_usd"] = data.montant_usd
    if data.echeance is not None:  c["echeance"]     = data.echeance
    if data.description is not None: c["description"] = data.description
    return c


@router.get("/operateurs-mm")
async def operateurs_mobile_money(pays: Optional[str] = Query(None), current: dict = Depends(_get_user)):
    _check_rh_access(current)
    if pays:
        return {"pays": pays, "operateurs": MM_PAR_PAYS.get(pays.upper(), [])}
    return MM_PAR_PAYS

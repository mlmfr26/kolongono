"""
SantéDirect — Kolongono : Initialisation de la base de données
Crée toutes les tables et insère les données de démonstration.

Usage :
    python create_tables.py

À exécuter une seule fois avant le démarrage de l'API.
Sûr à relancer (on_conflict_do_nothing sur les données demo).
"""
import asyncio
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import engine, Base, AsyncSessionLocal
from models import (
    RendezVous, Abonnement, Cotisation, SoldePatient,
    Diagnostic, Demande, Ordonnance,
    Centre, PersonnelCentre, Admission, RepasCentre,
    RessourceSD, PersonnelRole, RevenuCentre, DepenseCentre,
    StockPharmacieCentre, MouvementStockCentre,
)


async def create_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Tables créées (ou déjà existantes).")


async def seed_centres():
    """Insère les données de démonstration pour les centres de santé."""
    today = datetime.now().date().isoformat()
    async with AsyncSessionLocal() as db:

        # ── Centres ───────────────────────────────────────────────────────────
        centres = [
            {"id": "CTR-001", "nom": "Centre de Santé Mama Béatrice", "type": "dispensaire",
             "adresse": "Avenue Lubefu 12, Quartier Binza, Kinshasa",
             "telephone": "+243 81 234 5678", "email": "centre@mamabeatrice.cd",
             "responsable_id": "CTR-RESP-001", "responsable_nom": "Monique NDAYA",
             "statut_partenariat": "actif", "date_partenariat": "2026-01-15",
             "nb_lits": 12, "services": ["consultations", "maternite", "soins_infirmiers"],
             "created_at": "2026-01-10"},
        ]
        for c in centres:
            await db.execute(
                pg_insert(Centre).values(**c).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Personnel ─────────────────────────────────────────────────────────
        personnel = [
            {"id": "PER-001", "centre_id": "CTR-001", "prenom": "Jean",    "nom": "BOLAMBA",  "fonction": "auxiliaire",    "statut": "actif", "affecte_sd": True,  "date_affectation_sd": "2026-02-01", "consultations_sd_mois": 47},
            {"id": "PER-002", "centre_id": "CTR-001", "prenom": "Cécile",  "nom": "NGALULA",  "fonction": "infirmier",     "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
            {"id": "PER-003", "centre_id": "CTR-001", "prenom": "Patrick", "nom": "KABILA",   "fonction": "aide_soignant", "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
            {"id": "PER-004", "centre_id": "CTR-001", "prenom": "Marie",   "nom": "TSHIABA",  "fonction": "sage_femme",    "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
            {"id": "PER-005", "centre_id": "CTR-001", "prenom": "André",   "nom": "MUTOMBO",  "fonction": "administratif", "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
            {"id": "PER-006", "centre_id": "CTR-001", "prenom": "Esther",  "nom": "LUBAMBA",  "fonction": "infirmier",     "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
            {"id": "PER-007", "centre_id": "CTR-001", "prenom": "David",   "nom": "NKOSI",    "fonction": "aide_soignant", "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
            {"id": "PER-008", "centre_id": "CTR-001", "prenom": "Pauline", "nom": "ILUNGA",   "fonction": "administratif", "statut": "actif", "affecte_sd": False, "date_affectation_sd": None,         "consultations_sd_mois": 0},
        ]
        for p in personnel:
            await db.execute(
                pg_insert(PersonnelCentre).values(**p).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Admissions ────────────────────────────────────────────────────────
        admissions = [
            {"id": "ADM-001", "centre_id": "CTR-001", "patient_nom": "Josephine MBUYI",  "motif": "Fièvre persistante",    "type": "consultation", "triage": "jaune", "statut": "en_attente", "heure_arrivee": "08:45", "orientation": None,                  "via_sd": False, "date": today},
            {"id": "ADM-002", "centre_id": "CTR-001", "patient_nom": "Thomas KALOMBO",   "motif": "Douleur thoracique",    "type": "urgence",      "triage": "rouge", "statut": "en_attente", "heure_arrivee": "09:10", "orientation": None,                  "via_sd": False, "date": today},
            {"id": "ADM-003", "centre_id": "CTR-001", "patient_nom": "Claire TSHIBALA",  "motif": "Suivi grossesse",       "type": "consultation", "triage": "vert",  "statut": "en_attente", "heure_arrivee": "09:30", "orientation": None,                  "via_sd": False, "date": today},
            {"id": "ADM-004", "centre_id": "CTR-001", "patient_nom": "Paul NKEMBA",      "motif": "Hypertension suivi",    "type": "consultation", "triage": "vert",  "statut": "oriente",    "heure_arrivee": "08:00", "orientation": "Téléconsultation SD", "via_sd": True,  "date": today},
            {"id": "ADM-005", "centre_id": "CTR-001", "patient_nom": "Ève MULUMBA",      "motif": "Paludisme suspecté",    "type": "urgence",      "triage": "jaune", "statut": "oriente",    "heure_arrivee": "07:30", "orientation": "Médecin sur place",   "via_sd": False, "date": today},
            {"id": "ADM-006", "centre_id": "CTR-001", "patient_nom": "Jean-Pierre LELO", "motif": "Blessure accidentelle", "type": "urgence",      "triage": "jaune", "statut": "admis",      "heure_arrivee": "07:00", "orientation": "Soins infirmiers",    "via_sd": False, "date": today},
            {"id": "ADM-007", "centre_id": "CTR-001", "patient_nom": "Marie KABONGO",    "motif": "Consultation générale", "type": "consultation", "triage": "vert",  "statut": "sorti",      "heure_arrivee": "06:45", "orientation": "Téléconsultation SD", "via_sd": True,  "date": today},
        ]
        for a in admissions:
            await db.execute(
                pg_insert(Admission).values(**a).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Réfectoire ────────────────────────────────────────────────────────
        repas = [
            {"id": "REF-001", "centre_id": "CTR-001", "date": today,        "type_repas": "dejeuner",       "nb_personnel": 11, "nb_patients": 14, "nb_accompagnants": 6, "menu": "Riz sauce tomate + poulet",  "cout_fc": 87000},
            {"id": "REF-002", "centre_id": "CTR-001", "date": today,        "type_repas": "petit_dejeuner", "nb_personnel": 8,  "nb_patients": 10, "nb_accompagnants": 4, "menu": "Pain + café + lait",          "cout_fc": 32000},
            {"id": "REF-003", "centre_id": "CTR-001", "date": "2026-05-23", "type_repas": "dejeuner",       "nb_personnel": 11, "nb_patients": 18, "nb_accompagnants": 9, "menu": "Fufu + pondu + poisson",      "cout_fc": 95000},
            {"id": "REF-004", "centre_id": "CTR-001", "date": "2026-05-23", "type_repas": "diner",          "nb_personnel": 6,  "nb_patients": 8,  "nb_accompagnants": 3, "menu": "Riz + haricots",              "cout_fc": 45000},
            {"id": "REF-005", "centre_id": "CTR-001", "date": "2026-05-22", "type_repas": "dejeuner",       "nb_personnel": 10, "nb_patients": 16, "nb_accompagnants": 7, "menu": "Riz sauce arachide",          "cout_fc": 82000},
            {"id": "REF-006", "centre_id": "CTR-001", "date": "2026-05-22", "type_repas": "petit_dejeuner", "nb_personnel": 7,  "nb_patients": 9,  "nb_accompagnants": 3, "menu": "Pain + beurre + thé",         "cout_fc": 28000},
            {"id": "REF-007", "centre_id": "CTR-001", "date": "2026-05-21", "type_repas": "dejeuner",       "nb_personnel": 11, "nb_patients": 20, "nb_accompagnants": 8, "menu": "Saka-saka + riz + viande",   "cout_fc": 102000},
        ]
        for r in repas:
            await db.execute(
                pg_insert(RepasCentre).values(**r).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Ressources SD ─────────────────────────────────────────────────────
        ressources = [
            {"id": "RES-001", "centre_id": "CTR-001", "type": "auxiliaire", "ressource_id": "PER-001",  "nom_ressource": "Jean BOLAMBA",        "date_debut": "2026-02-01", "date_fin": None, "statut": "actif", "consultations_mois": 47, "consultations_total": 189, "revenus_mois_usd": 84, "revenus_total_usd": 338, "impact_centre": "partiel", "notes": "Disponible du lundi au vendredi, retour au centre le soir"},
            {"id": "RES-002", "centre_id": "CTR-001", "type": "salle",      "ressource_id": "SALLE-B", "nom_ressource": "Salle B — Consultation","date_debut": "2026-02-01", "date_fin": None, "statut": "actif", "consultations_mois": 47, "consultations_total": 189, "revenus_mois_usd": 0,  "revenus_total_usd": 0,   "impact_centre": "partiel", "notes": "Réservée les mardis et jeudis 14h–18h"},
        ]
        for r in ressources:
            await db.execute(
                pg_insert(RessourceSD).values(**r).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Rôles personnel ───────────────────────────────────────────────────
        pers_roles = [
            {"personnel_id": "PER-001", "centre_id": "CTR-001", "role_centre": "gestionnaire",      "type": "interne", "salaire_usd": 54, "statut_salaire": "paye"},
            {"personnel_id": "PER-002", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 43, "statut_salaire": "paye"},
            {"personnel_id": "PER-003", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 39, "statut_salaire": "paye"},
            {"personnel_id": "PER-004", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 29, "statut_salaire": "paye"},
            {"personnel_id": "PER-005", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 46, "statut_salaire": "paye"},
            {"personnel_id": "PER-006", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 29, "statut_salaire": "paye"},
            {"personnel_id": "PER-007", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 32, "statut_salaire": "paye"},
            {"personnel_id": "PER-008", "centre_id": "CTR-001", "role_centre": "personnel_interne", "type": "interne", "salaire_usd": 39, "statut_salaire": "paye"},
        ]
        for pr in pers_roles:
            await db.execute(
                pg_insert(PersonnelRole).values(**pr).on_conflict_do_nothing(
                    index_elements=["personnel_id", "centre_id"]
                )
            )

        # ── Comptabilité : revenus ────────────────────────────────────────────
        revenus = [
            {"id": "REV-01", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "SantéDirect — retour partenariat", "montant_usd":  84.0, "date": "2026-05-24"},
            {"id": "REV-02", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Consultations directes",            "montant_usd":  65.0, "date": "2026-05-24"},
            {"id": "REV-03", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Pharmacie d'appoint",               "montant_usd":  34.0, "date": "2026-05-24"},
            {"id": "REV-04", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Hospitalisations",                  "montant_usd": 115.0, "date": "2026-05-24"},
            {"id": "REV-05", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Réfectoire — recettes",             "montant_usd":   9.0, "date": "2026-05-24"},
            {"id": "REV-06", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Autres recettes",                   "montant_usd":  14.0, "date": "2026-05-24"},
        ]
        for r in revenus:
            await db.execute(
                pg_insert(RevenuCentre).values(**r).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Comptabilité : dépenses ───────────────────────────────────────────
        depenses = [
            {"id": "DEP-01", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Salaires personnels",    "montant_usd": 311.0, "sous_detail": "8 employés internes",        "date": "2026-05-01"},
            {"id": "DEP-02", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Médicaments — achats",   "montant_usd":  66.0, "sous_detail": "réapprovisionnement mai",     "date": "2026-05-10"},
            {"id": "DEP-03", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Réfectoire — coûts",     "montant_usd":  31.0, "sous_detail": "7 repas comptabilisés",       "date": "2026-05-24"},
            {"id": "DEP-04", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Charges fixes",           "montant_usd":  30.0, "sous_detail": "loyer + électricité + eau",   "date": "2026-05-01"},
            {"id": "DEP-05", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Matériel médical",        "montant_usd":  13.0, "sous_detail": "consommables stérilisation",  "date": "2026-05-15"},
            {"id": "DEP-06", "centre_id": "CTR-001", "mois": "2026-05", "categorie": "Entretien & nettoyage",   "montant_usd":   6.0, "sous_detail": "prestataire externe",         "date": "2026-05-20"},
        ]
        for d in depenses:
            await db.execute(
                pg_insert(DepenseCentre).values(**d).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Stock pharmacie ───────────────────────────────────────────────────
        stock = [
            {"id": "SP-001", "centre_id": "CTR-001", "nom": "Paracétamol 500mg",       "categorie": "Analgésique",       "stock": 142, "seuil": 20,  "unite": "cp",        "prix_achat_usd": 0.04, "prix_vente_usd": 0.05, "peremption": "2026-12-31", "fournisseur": "Pharmacia Congo"},
            {"id": "SP-002", "centre_id": "CTR-001", "nom": "Amoxicilline 500mg",       "categorie": "Antibiotique",      "stock":  48, "seuil": 30,  "unite": "gél",       "prix_achat_usd": 0.09, "prix_vente_usd": 0.13, "peremption": "2026-08-15", "fournisseur": "MedImport RDC"},
            {"id": "SP-003", "centre_id": "CTR-001", "nom": "Artéméther-Luméfantrine",  "categorie": "Antipaludique",     "stock":  12, "seuil": 15,  "unite": "cp",        "prix_achat_usd": 0.23, "prix_vente_usd": 0.30, "peremption": "2026-09-30", "fournisseur": "WHO Supply"},
            {"id": "SP-004", "centre_id": "CTR-001", "nom": "Métronidazole 250mg",      "categorie": "Anti-infectieux",   "stock":  78, "seuil": 25,  "unite": "cp",        "prix_achat_usd": 0.05, "prix_vente_usd": 0.07, "peremption": "2027-03-20", "fournisseur": "Pharmacia Congo"},
            {"id": "SP-005", "centre_id": "CTR-001", "nom": "Ibuprofène 400mg",         "categorie": "Anti-inflammatoire","stock":  95, "seuil": 20,  "unite": "cp",        "prix_achat_usd": 0.06, "prix_vente_usd": 0.09, "peremption": "2027-01-15", "fournisseur": "MedImport RDC"},
            {"id": "SP-006", "centre_id": "CTR-001", "nom": "Chloroquine 150mg",        "categorie": "Antipaludique",     "stock":   8, "seuil": 20,  "unite": "cp",        "prix_achat_usd": 0.03, "prix_vente_usd": 0.04, "peremption": "2026-07-31", "fournisseur": "WHO Supply"},
            {"id": "SP-007", "centre_id": "CTR-001", "nom": "SRO — sachets 500ml",      "categorie": "Réhydratation",     "stock":  34, "seuil": 15,  "unite": "sachet",    "prix_achat_usd": 0.04, "prix_vente_usd": 0.06, "peremption": "2027-06-30", "fournisseur": "UNICEF Supply"},
            {"id": "SP-008", "centre_id": "CTR-001", "nom": "Vitamine C 500mg",         "categorie": "Supplément",        "stock": 200, "seuil": 30,  "unite": "cp",        "prix_achat_usd": 0.02, "prix_vente_usd": 0.04, "peremption": "2027-02-28", "fournisseur": "Pharmacia Congo"},
            {"id": "SP-009", "centre_id": "CTR-001", "nom": "Doxycycline 100mg",        "categorie": "Antibiotique",      "stock":  22, "seuil": 20,  "unite": "gél",       "prix_achat_usd": 0.08, "prix_vente_usd": 0.11, "peremption": "2026-11-20", "fournisseur": "MedImport RDC"},
            {"id": "SP-010", "centre_id": "CTR-001", "nom": "Furosémide 40mg",          "categorie": "Diurétique",        "stock":  45, "seuil": 15,  "unite": "cp",        "prix_achat_usd": 0.07, "prix_vente_usd": 0.10, "peremption": "2027-04-10", "fournisseur": "Pharmacia Congo"},
            {"id": "SP-011", "centre_id": "CTR-001", "nom": "Amlodipine 5mg",           "categorie": "Antihypertenseur",  "stock":  60, "seuil": 20,  "unite": "cp",        "prix_achat_usd": 0.05, "prix_vente_usd": 0.08, "peremption": "2027-05-31", "fournisseur": "MedImport RDC"},
            {"id": "SP-012", "centre_id": "CTR-001", "nom": "Acide folique 5mg",        "categorie": "Supplément",        "stock":  88, "seuil": 25,  "unite": "cp",        "prix_achat_usd": 0.02, "prix_vente_usd": 0.03, "peremption": "2027-08-15", "fournisseur": "UNICEF Supply"},
            {"id": "SP-013", "centre_id": "CTR-001", "nom": "Gants latex non stériles", "categorie": "Consommables",      "stock": 400, "seuil": 100, "unite": "paire",     "prix_achat_usd": 0.07, "prix_vente_usd": 0.11, "peremption": "2028-01-01", "fournisseur": "MedEquip RDC"},
            {"id": "SP-014", "centre_id": "CTR-001", "nom": "Seringues 5 ml",           "categorie": "Consommables",      "stock":  80, "seuil": 50,  "unite": "sachet 10", "prix_achat_usd": 0.32, "prix_vente_usd": 0.43, "peremption": "2028-01-01", "fournisseur": "MedEquip RDC"},
        ]
        for s in stock:
            await db.execute(
                pg_insert(StockPharmacieCentre).values(**s).on_conflict_do_nothing(index_elements=["id"])
            )

        # ── Mouvements stock ──────────────────────────────────────────────────
        mouvements = [
            {"id": "MOV-001", "centre_id": "CTR-001", "stock_id": "SP-003", "type": "sortie",  "quantite":  6, "motif": "Ordonnance SD · Sylvie MUKEBA",  "agent": "Jean BOLAMBA",     "patient": "Sylvie MUKEBA",   "date": today},
            {"id": "MOV-002", "centre_id": "CTR-001", "stock_id": "SP-007", "type": "sortie",  "quantite":  3, "motif": "Urgence · Gaston NTUMBA",        "agent": "MC. NZINGA",       "patient": "Gaston NTUMBA",   "date": today},
            {"id": "MOV-003", "centre_id": "CTR-001", "stock_id": "SP-001", "type": "entree",  "quantite": 50, "motif": "Réapprovisionnement mai",         "agent": "Josephine TSHALA", "patient": None,              "date": "2026-05-10"},
            {"id": "MOV-004", "centre_id": "CTR-001", "stock_id": "SP-002", "type": "entree",  "quantite": 30, "motif": "Réapprovisionnement mai",         "agent": "Josephine TSHALA", "patient": None,              "date": "2026-05-10"},
        ]
        for m in mouvements:
            await db.execute(
                pg_insert(MouvementStockCentre).values(**m).on_conflict_do_nothing(index_elements=["id"])
            )

        await db.commit()
    print("[OK] Données centres, personnel, admissions, stock, réfectoire insérées.")


async def seed_demo():
    async with AsyncSessionLocal() as db:
        demo_ordonnances = [
            {
                "id": "ORD-2026-DEMO01",
                "rdv_id": None,
                "date": "2026-04-15",
                "medecin_id": "MED-K01",
                "medecin": "Dr. Emmanuel LUKUSA",
                "patient_id": "ADH-001",
                "diagnostic": "Paludisme simple",
                "prescriptions_texte": "Artéméther/Luméfantrine 20/120mg · Paracétamol 500mg",
                "produits": [
                    {
                        "nom": "Artéméther/Luméfantrine 20/120mg",
                        "posologie": "4 cp matin et soir pendant 3 jours",
                        "quantite": 2,
                    },
                    {
                        "nom": "Paracétamol 500mg",
                        "posologie": "2 cp toutes les 6h si fièvre",
                        "quantite": 1,
                    },
                ],
                "recommandations": (
                    "Repos au lit. Boire beaucoup d'eau. Éviter le soleil. "
                    "Revenir si fièvre persiste après 48h."
                ),
                "statut": "delivree",
                "renouvellement_autorise": False,
                "nb_renouvellements_restants": 0,
                "date_expiration": None,
                "renouvelle_depuis": None,
                "auxiliaire_renouvellement": None,
                "created_at": datetime(2026, 4, 15, 10, 0, 0),
            },
            {
                "id": "ORD-2026-DEMO02",
                "rdv_id": None,
                "date": "2026-05-10",
                "medecin_id": "MED-K02",
                "medecin": "Dr. Béatrice MWAMBA",
                "patient_id": "ADH-001",
                "diagnostic": "Hypertension artérielle",
                "prescriptions_texte": "Amlodipine 5mg",
                "produits": [
                    {
                        "nom": "Amlodipine 5mg",
                        "posologie": "1 cp par jour le matin",
                        "quantite": 3,
                    },
                ],
                "recommandations": (
                    "Contrôle tension chaque semaine. Régime pauvre en sel. "
                    "Activité physique légère."
                ),
                "statut": "delivree",
                "renouvellement_autorise": True,
                "nb_renouvellements_restants": 2,
                "date_expiration": "2026-08-10",
                "renouvelle_depuis": None,
                "auxiliaire_renouvellement": None,
                "created_at": datetime(2026, 5, 10, 14, 30, 0),
            },
        ]

        for data in demo_ordonnances:
            stmt = (
                pg_insert(Ordonnance)
                .values(**data)
                .on_conflict_do_nothing(index_elements=["id"])
            )
            await db.execute(stmt)

        await db.commit()
    print("[OK] Données de démonstration insérées (ordonnances DEMO01 + DEMO02).")


async def main():
    await create_schema()
    await seed_centres()
    await seed_demo()
    await engine.dispose()
    print("[OK] Base de données prête.")


if __name__ == "__main__":
    asyncio.run(main())

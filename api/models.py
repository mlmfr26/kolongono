"""
SantéDirect — Kolongono : Modèles SQLAlchemy (PostgreSQL 16)

Tables :
  rendez_vous              — RDV téléconsultation
  abonnements              — plan mutuelle par patient
  cotisations              — historique mensuel des cotisations
  soldes_patients          — solde FC disponible
  diagnostics              — rapport médecin après consultation
  demandes                 — demandes de consultation (adhérent → auxiliaire)
  ordonnances              — ordonnances numériques (auto-créées à la clôture)
  centres                  — centres de santé partenaires
  personnel_centres        — personnel de chaque centre
  admissions               — admissions / triage journalier
  repas_centres            — réfectoire par centre
  ressources_sd            — ressources prêtées à SantéDirect par un centre
  personnel_roles_centres  — rôles et salaires du personnel par centre
  revenus_centres          — revenus comptables par centre/mois
  depenses_centres         — dépenses comptables par centre/mois
  stock_pharmacie_centres  — catalogue stock pharmacie d'un centre
  mouvements_stock_centres — historique entrées/sorties stock
"""
from __future__ import annotations
from datetime import datetime
from datetime import date
from sqlalchemy import (
    String, Float, Integer, Text, Boolean, DateTime, Date, JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class RendezVous(Base):
    __tablename__ = "rendez_vous"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    medecin_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    auxiliaire_id: Mapped[str | None] = mapped_column(String)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    heure_debut: Mapped[str] = mapped_column(String(5), nullable=False)
    heure_fin: Mapped[str] = mapped_column(String(5), nullable=False)
    motif: Mapped[str | None] = mapped_column(String)
    triage_id: Mapped[str | None] = mapped_column(String)
    demande_id: Mapped[str | None] = mapped_column(String)
    statut: Mapped[str] = mapped_column(String, default="confirme", index=True)
    room: Mapped[str | None] = mapped_column(String)
    lien_patient: Mapped[str | None] = mapped_column(Text)
    lien_auxiliaire: Mapped[str | None] = mapped_column(Text)
    lien_medecin: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)


class Abonnement(Base):
    __tablename__ = "abonnements"

    patient_id: Mapped[str] = mapped_column(String, primary_key=True)
    plan: Mapped[str] = mapped_column(String, default="standard")
    statut: Mapped[str] = mapped_column(String, default="actif")
    date_debut: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Cotisation(Base):
    __tablename__ = "cotisations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    mois: Mapped[str] = mapped_column(String(7), nullable=False)
    montant_fc: Mapped[float] = mapped_column(Float, default=0.0)
    statut: Mapped[str] = mapped_column(String, default="en_attente")
    mode_paiement: Mapped[str | None] = mapped_column(String)

    __table_args__ = (
        UniqueConstraint("patient_id", "mois", name="uq_cotisation_patient_mois"),
    )


class SoldePatient(Base):
    __tablename__ = "soldes_patients"

    patient_id: Mapped[str] = mapped_column(String, primary_key=True)
    solde_fc: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Diagnostic(Base):
    __tablename__ = "diagnostics"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    rdv_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    medecin_id: Mapped[str | None] = mapped_column(String)
    patient_id: Mapped[str | None] = mapped_column(String, index=True)
    diagnostic: Mapped[str | None] = mapped_column(Text)
    prescriptions: Mapped[str | None] = mapped_column(Text)
    recommandations: Mapped[str | None] = mapped_column(Text)
    prochain_rdv: Mapped[str | None] = mapped_column(String)
    notes_confidentielles: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Demande(Base):
    __tablename__ = "demandes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    motif: Mapped[str | None] = mapped_column(String)
    symptomes: Mapped[str | None] = mapped_column(String)
    urgence: Mapped[str] = mapped_column(String, default="faible", index=True)
    statut: Mapped[str] = mapped_column(String, default="en_attente", index=True)
    prise_en_charge_par: Mapped[str | None] = mapped_column(String)
    prise_en_charge_at: Mapped[datetime | None] = mapped_column(DateTime)
    rdv_id: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Ordonnance(Base):
    __tablename__ = "ordonnances"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    rdv_id: Mapped[str | None] = mapped_column(String, index=True)
    date: Mapped[str | None] = mapped_column(String(10))
    medecin_id: Mapped[str | None] = mapped_column(String)
    medecin: Mapped[str | None] = mapped_column(String)
    patient_id: Mapped[str | None] = mapped_column(String, index=True)
    diagnostic: Mapped[str | None] = mapped_column(Text)
    prescriptions_texte: Mapped[str | None] = mapped_column(Text)
    produits: Mapped[list | None] = mapped_column(JSON)
    recommandations: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(String, default="en_attente_pharmacie")
    renouvellement_autorise: Mapped[bool] = mapped_column(Boolean, default=False)
    nb_renouvellements_restants: Mapped[int] = mapped_column(Integer, default=0)
    date_expiration: Mapped[str | None] = mapped_column(String(10))
    renouvelle_depuis: Mapped[str | None] = mapped_column(String)
    auxiliaire_renouvellement: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Centres de santé ─────────────────────────────────────────────────────────

class Centre(Base):
    __tablename__ = "centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, default="dispensaire")
    adresse: Mapped[str | None] = mapped_column(String)
    telephone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    responsable_id: Mapped[str | None] = mapped_column(String)
    responsable_nom: Mapped[str | None] = mapped_column(String)
    statut_partenariat: Mapped[str] = mapped_column(String, default="actif")
    date_partenariat: Mapped[str | None] = mapped_column(String(10))
    nb_lits: Mapped[int] = mapped_column(Integer, default=0)
    services: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[str | None] = mapped_column(String(10))


class PersonnelCentre(Base):
    __tablename__ = "personnel_centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    prenom: Mapped[str] = mapped_column(String, nullable=False)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    fonction: Mapped[str] = mapped_column(String, nullable=False)
    statut: Mapped[str] = mapped_column(String, default="actif")
    affecte_sd: Mapped[bool] = mapped_column(Boolean, default=False)
    date_affectation_sd: Mapped[str | None] = mapped_column(String(10))
    consultations_sd_mois: Mapped[int] = mapped_column(Integer, default=0)


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_nom: Mapped[str] = mapped_column(String, nullable=False)
    motif: Mapped[str | None] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, default="consultation")
    triage: Mapped[str | None] = mapped_column(String)
    statut: Mapped[str] = mapped_column(String, default="en_attente", index=True)
    heure_arrivee: Mapped[str] = mapped_column(String(5), nullable=False)
    orientation: Mapped[str | None] = mapped_column(String)
    via_sd: Mapped[bool] = mapped_column(Boolean, default=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)


class RepasCentre(Base):
    __tablename__ = "repas_centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    type_repas: Mapped[str] = mapped_column(String, nullable=False)
    nb_personnel: Mapped[int] = mapped_column(Integer, default=0)
    nb_patients: Mapped[int] = mapped_column(Integer, default=0)
    nb_accompagnants: Mapped[int] = mapped_column(Integer, default=0)
    menu: Mapped[str | None] = mapped_column(String)
    cout_fc: Mapped[int] = mapped_column(Integer, default=0)


class RessourceSD(Base):
    __tablename__ = "ressources_sd"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    ressource_id: Mapped[str] = mapped_column(String, nullable=False)
    nom_ressource: Mapped[str] = mapped_column(String, nullable=False)
    date_debut: Mapped[str | None] = mapped_column(String(10))
    date_fin: Mapped[str | None] = mapped_column(String(10))
    statut: Mapped[str] = mapped_column(String, default="actif")
    consultations_mois: Mapped[int] = mapped_column(Integer, default=0)
    consultations_total: Mapped[int] = mapped_column(Integer, default=0)
    revenus_mois_usd: Mapped[float] = mapped_column(Float, default=0.0)
    revenus_total_usd: Mapped[float] = mapped_column(Float, default=0.0)
    impact_centre: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)


class PersonnelRole(Base):
    __tablename__ = "personnel_roles_centres"

    personnel_id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, primary_key=True)
    role_centre: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, default="interne")
    salaire_usd: Mapped[float] = mapped_column(Float, default=0.0)
    statut_salaire: Mapped[str] = mapped_column(String, default="en_attente")


class RevenuCentre(Base):
    __tablename__ = "revenus_centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    mois: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    categorie: Mapped[str] = mapped_column(String, nullable=False)
    montant_usd: Mapped[float] = mapped_column(Float, default=0.0)
    date: Mapped[str | None] = mapped_column(String(10))


class DepenseCentre(Base):
    __tablename__ = "depenses_centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    mois: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    categorie: Mapped[str] = mapped_column(String, nullable=False)
    montant_usd: Mapped[float] = mapped_column(Float, default=0.0)
    sous_detail: Mapped[str | None] = mapped_column(String)
    date: Mapped[str | None] = mapped_column(String(10))


class StockPharmacieCentre(Base):
    __tablename__ = "stock_pharmacie_centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    categorie: Mapped[str | None] = mapped_column(String)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    seuil: Mapped[int] = mapped_column(Integer, default=0)
    unite: Mapped[str | None] = mapped_column(String)
    prix_achat_usd: Mapped[float] = mapped_column(Float, default=0.0)
    prix_vente_usd: Mapped[float] = mapped_column(Float, default=0.0)
    peremption: Mapped[str | None] = mapped_column(String(10))
    fournisseur: Mapped[str | None] = mapped_column(String)


class MouvementStockCentre(Base):
    __tablename__ = "mouvements_stock_centres"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    stock_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    quantite: Mapped[int] = mapped_column(Integer, nullable=False)
    motif: Mapped[str | None] = mapped_column(String)
    agent: Mapped[str | None] = mapped_column(String)
    patient: Mapped[str | None] = mapped_column(String)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)


# ── Module Scanner EAN ────────────────────────────────────────────────────────

class MedicamentEAN(Base):
    __tablename__ = "medicaments_ean"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code_interne: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    ean: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    dci: Mapped[str | None] = mapped_column(String)
    dosage: Mapped[str | None] = mapped_column(String)
    forme: Mapped[str | None] = mapped_column(String)
    unite_boite: Mapped[int] = mapped_column(Integer, default=1)
    fabricant: Mapped[str | None] = mapped_column(String)
    categorie: Mapped[str | None] = mapped_column(String)
    prescription: Mapped[bool] = mapped_column(Boolean, default=False)
    prix_usd: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String, default="manuel")
    cree_par: Mapped[str | None] = mapped_column(String)
    cree_le: Mapped[datetime | None] = mapped_column(DateTime)


# ── Authentification ──────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    prenom: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="adherent")
    centre_id: Mapped[str | None] = mapped_column(String)
    plan: Mapped[str | None] = mapped_column(String)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StockPharmacie(Base):
    __tablename__ = "stock_pharmacie"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    medicament_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    quantite: Mapped[int] = mapped_column(Integer, default=0)
    seuil_alerte: Mapped[int | None] = mapped_column(Integer, default=5)
    prix_unitaire: Mapped[float | None] = mapped_column(Float)
    date_peremption: Mapped[date | None] = mapped_column(Date)
    derniere_maj: Mapped[datetime | None] = mapped_column(DateTime)

    __table_args__ = (
        UniqueConstraint("centre_id", "medicament_code", name="uq_stock_centre_med"),
    )


class MouvementStock(Base):
    __tablename__ = "mouvements_stock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    centre_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    medicament_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    quantite: Mapped[int] = mapped_column(Integer, nullable=False)
    motif: Mapped[str | None] = mapped_column(String)
    operateur: Mapped[str | None] = mapped_column(String)
    horodatage: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

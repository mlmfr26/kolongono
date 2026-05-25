# SANTÉ DIRECT — KOLONGONO

Application mobile de santé communautaire pour zones à faibles revenus.
Stack : FastAPI (port 8002) + React Native (iOS & Android).

## Concept

SantéDirect–Kolongono est une **mutuelle de santé numérique** centrée sur :
- L'**auxiliaire de santé** : relais terrain entre le patient et le médecin distant
- La **téléconsultation** avec médecin qualifié (vidéo WebRTC)
- La **pharmacie intégrée** : ordonnance numérique → livraison domicile
- La **prévention** : proverbe Luba — *"Bidimu m'bupita buanga"* (mieux vaut prévenir que guérir)

Connexion API avec l'application **LONGONIA** (port 8000/8001) pour la gestion des abonnements et paiements.

## Architecture

```
SANTE DIRECT - KOLONGONO/
├── api/                         # FastAPI — Port 8002
│   ├── main.py                  # App principale + routers
│   ├── database.py              # SQLAlchemy + PostgreSQL
│   ├── requirements.txt
│   └── routers/
│       ├── adherents.py         # Adhérents (individuel/famille)
│       ├── auxiliaires.py       # Auxiliaires de santé
│       ├── medecins.py          # Médecins partenaires
│       ├── consultations.py     # Téléconsultations + WebRTC
│       ├── pharmacie.py         # Pharmacie en ligne (e-commerce)
│       ├── abonnements.py       # Mutuelle / forfaits
│       ├── dossiers.py          # Dossiers médicaux
│       └── longonia_bridge.py   # Pont API → Longonia
│
└── mobile/                      # React Native — iOS & Android
    ├── App.tsx                  # Navigation principale
    ├── index.js
    ├── components/
    │   ├── AuthContext.tsx       # Auth JWT + état global
    │   ├── theme.ts             # Design system (couleurs, spacing)
    │   └── api.ts               # Client HTTP
    └── screens/
        ├── LoginScreen.tsx
        ├── RegisterScreen.tsx
        ├── DashboardScreen.tsx
        ├── PreConsultationScreen.tsx   # Formulaire signes vitaux
        ├── ConsultationScreen.tsx      # Prise de RDV médecin
        ├── TeleconsultationScreen.tsx  # Vidéo Jitsi Meet (react-native-webview)
        ├── PharmacieScreen.tsx         # Pharmacie en ligne
        ├── DossierScreen.tsx           # Dossier médical patient
        ├── AbonnementScreen.tsx        # Plans mutuelle
        ├── OrdonnanceScreen.tsx        # Ordonnances reçues
        ├── ProfileScreen.tsx
        ├── auxiliaire/
        │   ├── AuxiliaireHomeScreen.tsx
        │   ├── SaisieSignesVitauxScreen.tsx
        │   └── SuiviPatientScreen.tsx
        ├── medecin/
        │   ├── MedecinDashboardScreen.tsx
        │   ├── ConsultationEnCoursScreen.tsx
        │   └── OrdonnanceDigitaleScreen.tsx
        └── admin/
            ├── AdminDashboardScreen.tsx
            ├── PharmacieAdminScreen.tsx
            └── AbonnementsAdminScreen.tsx
```

## Démarrage rapide

### API (port 8002)
```bash
cd api
pip install -r requirements.txt
cp ../.env.example ../.env
uvicorn main:app --reload --port 8002
# Docs : http://localhost:8002/docs
```

### App Mobile
```bash
cd mobile
npm install
npx react-native start
npx react-native run-android   # ou run-ios
```

## Rôles utilisateurs

| Rôle | Description |
|------|-------------|
| `adherent` | Patient individuel (adhérent de la mutuelle) |
| `famille` | Adhérent avec membres de famille rattachés |
| `auxiliaire` | Auxiliaire de santé / infirmier terrain |
| `medecin` | Médecin partenaire (téléconsultation) |
| `admin` | Gestionnaire du système |
| `livreur` | Livreur de médicaments |

## Plans mutuelle (abonnements)

| Plan | Prix/mois | Consultations | Hospitalisation |
|------|-----------|---------------|-----------------|
| Solidaire | 2.000 FC | 2/mois | Non |
| Standard | 5.000 FC | 5/mois | Non |
| Famille | 12.000 FC | 10/mois (famille) | Non |
| Premium | 20.000 FC | Illimité | Oui (partenaire) |

Paiement : Mobile Money (M-Pesa, Orange Money) + déduction automatique solde LONGONIA.

## Workflow téléconsultation

```
1. Adhérent → prise RDV (app)
2. Auxiliaire → pré-consultation (signes vitaux : T°, tension, pouls, langue)
3. Auxiliaire → saisit fiche patient dans l'app (15 min avant appel)
4. Médecin → appel vidéo Jitsi Meet (WebRTC, 3 participants max) + fallback WebSocket local
5. Médecin → ordonnance numérique → pharmacie en ligne
6. Pharmacie → commande automatique → livraison
7. Médecin → rapport de consultation
```

## Connexion Longonia

- `GET /api/longonia/verify-adherent/{id}` — Vérifier adhésion Longonia
- `POST /api/longonia/debit-mutuelle` — Débiter solde cantine pour mutuelle
- `GET /api/longonia/medecins` — Médecins partagés avec Longonia SantéDirect

## Endpoints API principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/adherents/{id}` | Profil adhérent |
| POST | `/api/consultations/reserver` | Réserver téléconsultation |
| GET | `/api/consultations/{id}` | Détail consultation |
| POST | `/api/consultations/{id}/signes-vitaux` | Saisir signes vitaux |
| GET | `/api/medecins/disponibles` | Médecins disponibles |
| POST | `/api/pharmacie/commandes` | Passer commande pharmacie |
| GET | `/api/pharmacie/produits` | Catalogue médicaments |
| GET | `/api/dossiers/{id}` | Dossier médical |
| POST | `/api/abonnements` | Souscrire mutuelle |
| GET | `/api/abonnements/{id}` | Statut abonnement |

## Variables d'environnement

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kolongono
DB_USER=kolongono
DB_PASSWORD=

SECRET_KEY=
ANTHROPIC_API_KEY=

# Jitsi Meet (auto-hébergé)
JITSI_DOMAIN=meet.jit.si
JITSI_SERVER_IP=YOUR_SERVER_IP
JICOFO_AUTH_PASSWORD=
JVB_AUTH_PASSWORD=

# Longonia bridge
LONGONIA_API_URL=http://localhost:8000
LONGONIA_API_KEY=
LONGONIA_SANTE_URL=http://localhost:8001

# Mobile Money
MPESA_API_KEY=
ORANGE_MONEY_API_KEY=

# Firebase
FIREBASE_SERVER_KEY=

# Email / SMS
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
SMS_API_KEY=
```

## Stack technique

| Couche | Technologie |
|--------|------------|
| API REST | FastAPI 0.110 + Pydantic v2 |
| Base de données | PostgreSQL 16 + SQLAlchemy |
| App mobile | React Native 0.73 (iOS + Android) |
| Téléconsultation | Jitsi Meet (WebRTC self-hosted) + WebSocket fallback |
| Jitsi stack | jitsi-web + prosody + jicofo + jvb (Docker) |
| Mobile WebView | react-native-webview (embed Jitsi) |
| Paiements | Mobile Money + Longonia bridge |
| Push notifications | Firebase FCM |
| Auth | JWT (python-jose) + bcrypt |

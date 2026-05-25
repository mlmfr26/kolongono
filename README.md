# SantéDirect — Kolongono

**Mutuelle de santé numérique pour zones à faibles revenus (RDC)**

> *"Bidimu m'bupita buanga"* — mieux vaut prévenir que guérir *(proverbe Luba)*

SantéDirect–Kolongono connecte les communautés rurales et péri-urbaines à des médecins qualifiés via un **auxiliaire de santé local** qui joue le rôle de relais terrain. Ce n'est pas une simple appli de télémédecine : l'auxiliaire est au centre de chaque consultation.

---

## Pourquoi un auxiliaire au centre ?

Dans les zones sans infrastructure médicale, l'adhérent ne peut pas gérer seul une téléconsultation. L'auxiliaire :
- dispose du matériel de mesure (tensiomètre, thermomètre)
- sait effectuer un triage clinique de base
- facilite la communication avec le médecin
- assure le relais pour la pharmacie et les médicaments

---

## Workflow réel

```
ADHERENT                  AUXILIAIRE                  MEDECIN
   |                          |                           |
   |-- Demande consultation -->|                           |
   |   (symptômes, urgence)   |                           |
   |                          |-- Triage IA (Claude) ---  |
   |                          |-- Signes vitaux saisis    |
   |                          |-- Programme le RDV ------>|
   |                          |                           |
   |<=========== Consultation vidéo Jitsi Meet ==========>|
   |                          |                           |
   |                          |         Ordonnance ------>|
   |                          |     (médicaments panier)  |
   |                          |-- Commande pharmacie auto |
   |                          |                           |
   |<-- Suivi livraison (lecture seule)                   |
```

Points importants :
- L'**adhérent soumet une demande**, il ne prend **pas** de RDV directement avec le médecin
- L'**auxiliaire programme le RDV** après évaluation (triage IA + signes vitaux)
- La **consultation vidéo** réunit 3 participants : médecin + auxiliaire + adhérent
- L'**ordonnance** est émise par le médecin ; l'auxiliaire sélectionne les médicaments dans un panier → commande automatique envoyée à la pharmacie
- L'auxiliaire peut **renouveler une ordonnance** uniquement si le médecin a explicitement accordé cette autorisation
- L'adhérent **suit ses livraisons en lecture seule** — il ne commande pas lui-même

---

## Architecture

Mono-repo organisé en trois parties :

```
SANTE DIRECT - KOLONGONO/
├── api/          # FastAPI — port 8002 (backend REST + IA triage)
├── mobile/       # React Native 0.73 — iOS & Android
└── web/          # Dashboard admin HTML (gestion abonnements, pharmacie)
```

Pour la structure détaillée fichier par fichier, voir [CLAUDE.md](CLAUDE.md).

---

## Rôles

| Rôle | Qui | Ce qu'il peut faire |
|------|-----|---------------------|
| `adherent` | Patient individuel | Soumettre des demandes, voir son dossier, suivre les livraisons |
| `famille` | Adhérent avec ayants droit | Idem + gérer les membres rattachés |
| `auxiliaire` | Infirmier / agent terrain | Triage, signes vitaux, prise de RDV, relais pharmacie |
| `medecin` | Médecin partenaire | Consulter, rédiger ordonnances, autoriser renouvellements |
| `admin` | Gestionnaire | Abonnements, catalogue pharmacie, tableaux de bord |
| `livreur` | Agent de livraison | Confirmer les livraisons de médicaments |

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| API REST | FastAPI 0.110 + Pydantic v2 |
| Base de données | PostgreSQL 16 + SQLAlchemy |
| App mobile | React Native 0.73 (iOS + Android) |
| Triage IA | Anthropic Claude (API) |
| Téléconsultation | Jitsi Meet self-hosted (WebRTC) + fallback TCP |
| Mobile WebView | react-native-webview |
| Push notifications | Firebase FCM |
| Paiements | Mobile Money (M-Pesa, Orange Money) |
| Auth | JWT (python-jose) + bcrypt |
| Bridge abonnements | Longonia (port 8000/8001) |

---

## Pont Longonia

SantéDirect se connecte à l'application **Longonia** pour partager les abonnements et les paiements Mobile Money.

| Endpoint | Rôle |
|----------|------|
| `GET /api/longonia/verify-adherent/{id}` | Vérifier qu'un adhérent est actif dans Longonia |
| `POST /api/longonia/debit-mutuelle` | Débiter le solde cantine pour la cotisation mutuelle |
| `GET /api/longonia/medecins` | Récupérer la liste des médecins partagés |

**Verrou croisé anti double-réservation** : avant de confirmer un créneau médecin, le pont interroge Longonia pour vérifier qu'aucune autre application n'a déjà bloqué ce créneau. Si Longonia est inaccessible, l'API répond avec une **erreur gracieuse** (pas de crash) — la consultation peut être tentée à nouveau plus tard. Ce comportement est validé en checklist de déploiement.

---

## Endpoints API clés

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/api/auth/login` | Connexion (retourne JWT) |
| POST | `/api/consultations/demandes` | Adhérent soumet une demande |
| PATCH | `/api/consultations/{id}/triage` | Auxiliaire saisit triage IA + signes vitaux |
| POST | `/api/consultations/reserver` | Auxiliaire programme le RDV médecin |
| GET | `/api/medecins/disponibles` | Créneaux médecins disponibles |
| GET | `/api/consultations/{id}` | Détail consultation (liens Jitsi inclus) |
| POST | `/api/pharmacie/commandes` | Commande pharmacie (déclenchée par auxiliaire) |
| GET | `/api/pharmacie/produits` | Catalogue médicaments |
| GET | `/api/dossiers/{id}` | Dossier médical (lecture tous rôles autorisés) |
| POST | `/api/abonnements` | Souscrire à un plan mutuelle |
| POST | `/api/ordonnances/{id}/renouveler` | Renouveler (auxiliaire, si médecin a autorisé) |

Documentation Swagger interactive : `http://localhost:8002/docs`

---

## Démarrage rapide (développement)

**Prérequis** : Python 3.11+, Node 18+, PostgreSQL 16, une clé API Anthropic.

```bash
# 1 — Copier et remplir les variables d'environnement
cp .env.example .env

# 2 — API
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8002

# 3 — App mobile (autre terminal)
cd mobile
npm install
npx react-native start
npx react-native run-android   # ou run-ios
```

Vérification rapide :
```bash
curl http://localhost:8002/health
# {"status":"healthy","jitsi_domain":"meet.jit.si","jitsi_mode":"self-hosted"}
```

Pour le déploiement complet en production (Docker, Nginx, SSL, Jitsi self-hosted), voir [DEPLOIEMENT.md](DEPLOIEMENT.md).

---

## Variables d'environnement clés

Le fichier `.env` complet est documenté dans [CLAUDE.md](CLAUDE.md). Les variables **critiques** à renseigner avant tout test :

| Variable | Rôle |
|----------|------|
| `ANTHROPIC_API_KEY` | Triage IA des demandes de consultation |
| `LONGONIA_API_KEY` | Authentification auprès du pont Longonia |
| `LONGONIA_API_URL` | URL du serveur Longonia (`http://IP:8000`) |
| `FIREBASE_SERVER_KEY` | Push notifications (alertes auxiliaire, livraisons) |
| `MPESA_API_KEY` | Paiements M-Pesa (cotisations mutuelle) |
| `ORANGE_MONEY_API_KEY` | Paiements Orange Money |
| `SECRET_KEY` | Signature JWT — générer avec `openssl rand -hex 32` |
| `DB_PASSWORD` | PostgreSQL — mot de passe fort obligatoire |

> Ne jamais commiter `.env` — il est dans `.gitignore`.

---

## Plans mutuelle

| Plan | Prix/mois | Consultations | Notes |
|------|-----------|---------------|-------|
| Solidaire | 2 000 FC | 2/mois | Entrée de gamme |
| Standard | 5 000 FC | 5/mois | Usage courant |
| Famille | 12 000 FC | 10/mois | Tous les ayants droit |
| Premium | 20 000 FC | Illimité | Hospitalisation partenaire |

Paiement via M-Pesa, Orange Money, ou déduction automatique du solde Longonia.

---

## Documentation complémentaire

| Fichier | Contenu |
|---------|---------|
| [CLAUDE.md](CLAUDE.md) | Structure détaillée du code, stack, endpoints, variables d'environnement complètes |
| [DEPLOIEMENT.md](DEPLOIEMENT.md) | Guide pas-à-pas : serveur, DNS, SSL, Docker, Jitsi, checklist de lancement |

---

*Projet développé pour améliorer l'accès aux soins dans les zones à faibles revenus de la RDC.*

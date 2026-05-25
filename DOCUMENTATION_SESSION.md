# Documentation de session — SantéDirect Kolongono
**Date :** 24 mai 2026  
**Durée :** Sessions 10 à 12 (contexte compressé)  
**Modèle :** Claude Sonnet 4.6

---

## 0. Réponse rapide — SSH ou PowerShell ?

| Commande | Où l'exécuter |
|----------|--------------|
| `npx expo install expo-camera expo-barcode-scanner @react-native-community/datetimepicker` | **PowerShell local** — sur votre machine de développement Windows, dans le dossier `mobile/` |
| `curl -X POST https://votre-domaine.com/api/pharmacie/ean/import-base` | **SSH sur le serveur Hetzner #2** — après déploiement complet, ou depuis PowerShell local si le serveur est accessible |
| Modifier `App.tsx` | **VS Code / éditeur local** — fichier source React Native |

Règle générale :
- **PowerShell local** = tout ce qui touche au code, npm/expo, build
- **SSH (Hetzner)** = tout ce qui touche au serveur, systemd, nginx, PostgreSQL, Python

---

## 1. Architecture globale du projet

### Stack technique

| Couche | Technologie | Port | Statut |
|--------|------------|------|--------|
| Interface de démonstration | HTML/CSS/JS statique | — | ✅ Complet |
| API principale | FastAPI (Python 3.11) + Uvicorn | 8002 | 🔧 En cours |
| Base de données | PostgreSQL 16 + SQLAlchemy | 5432 | 🔧 Schéma partiel |
| App mobile | React Native (Expo) | — | 🔧 En cours |
| Téléconsultation | Jitsi Meet (WebRTC) | — | ⏳ À configurer |
| Bridge Longonia | HTTP client → longonia.org | HTTPS | 🔧 À câbler |
| Paiements | Mobile Money (M-Pesa, Orange) | — | ⏳ À intégrer |

### Infrastructure serveurs (configuration de test actuelle)

```
Machine locale (Windows)
  └── Dev : PowerShell, VS Code, Expo CLI

Hetzner CX23 UNIQUE — une seule machine, trois applications
  ├── Longonia          (déjà en production)  :8000 ou :8001
  ├── LX                (déjà en production)  :PORT_LX
  └── SantéDirect       (à ajouter)           :8002
  │
  ├── PostgreSQL partagé :5432
  │     ├── DB longonia  (existante — ne pas toucher)
  │     ├── DB lx        (existante — ne pas toucher)
  │     └── DB santesd   (à créer)
  │
  ├── nginx partagé :80/:443
  │     ├── longonia.org       (existant — ne pas toucher)
  │     ├── <domaine_lx>       (existant — ne pas toucher)
  │     └── <domaine_santesd>  (à ajouter)
  │
  └── Certbot Let's Encrypt (déjà installé — ajouter le domaine SantéDirect)

Principe production (quand app prête) : 1 serveur = 1 application
```

### Communication Longonia → SantéDirect (même serveur)

```
SantéDirect FastAPI (:8002)
  └── longonia_bridge.py
       └── HTTP → http://127.0.0.1:PORT_LONGONIA/api/...
            └── Header: Authorization: Bearer LONGONIA_API_KEY
```

Longonia est sur le **même serveur physique** — utiliser `127.0.0.1` et non `https://longonia.org`. C'est plus rapide (pas de sortie réseau) et évite une dépendance DNS inutile en interne.

---

## 2. Interface de démonstration — centre.html

### Pages et leur état visuel

Toutes les pages du dashboard centre utilisent désormais le pattern **`db-banner`** uniforme :
- Banner colorée (couleur dynamique par centre via `CENTRE.couleur_banner`)
- Eyelet animé (point pulsant blanc)
- Titre de page + sous-titre dynamique
- Strip de 4 KPI cards (fond blanc, coins arrondis, ombres)

| Page (`id`) | Banner ID | KPIs | Données dynamiques |
|-------------|-----------|------|--------------------|
| `page-tableau-bord` | `db-banner-bg` | Admissions / Attente / Personnel / Lits | ✅ Calculées depuis JS |
| `page-personnel` | `db-banner-personnel` | Total / Présents / Absents / Affectés SD | ✅ |
| `page-pharmacie` | `db-banner-pharmacie` | Références / Alertes / Valeur / Dispensations | ✅ |
| `page-impact-sd` | `db-banner-impactsd` | Ressources / Consultations / Revenus / Taux | ✅ |
| `page-refectoire` | `db-banner-refectoire` | Repas / Coût total / Couverts/jour / Coût moy. | ✅ |
| `page-comptabilite` | `db-banner-comptabilite` | Revenus / Dépenses / Bénéfice / Couverture | ✅ |
| `page-roles` | `db-banner-roles` | (Englobement des 4 cartes de rôles) | N/A |
| `page-admissions` | — | Ancien pattern stat-card | ⏳ Non migré |
| `page-dossiers` | — | Ancien pattern | ⏳ Non migré |
| `page-parametres` | — | Pas de KPIs | — |

### Couleurs banner par centre

```javascript
'CTR-001': { couleur_banner: '#3B82F6' }   // Bleu (Centre Mama Béatrice)
'CTR-002': { couleur_banner: '#b4d8ce' }   // Vert-gris doux (Centre Benjamin)
'CTR-003': { couleur_banner: '#8B5CF6' }   // Violet (Centre Kilua)
```

### Corrections apportées en session

| Problème | Cause | Correction |
|----------|-------|-----------|
| Mots "jaune" / "vert" dans Dernières admissions | `triageBadge()` retournait texte brut | Remplacé par point coloré (8px) dans `renderTimeline()` uniquement |
| Alerte triage non visible | `display:''` ne fonctionne pas sur flex | Remplacé par `display='flex'` explicite |
| Banner CTR-002 trop similaire au logo | `#10B981` trop proche du teal SantéDirect | Changé en `#b4d8ce` |
| `kpi-alertes-delta` classe incorrecte | Référençait `stat-delta warn` (ancien pattern) | Migré vers `db-kpi-delta db-kpi-delta-amber` |
| Bénéfice comptabilité — logique couleur cassée | Ciblait `stat-card` className (supprimé) | Refactorisé avec `compta-benefice-icon` + `compta-benefice-delta` |

---

## 3. Module Scanner Pharmacie

### Fichiers créés

```
api/
  data/
    medicaments_base.json          ← 50 médicaments essentiels RDC
  routers/
    pharmacie_ean.py               ← Endpoints EAN + mouvements stock

mobile/
  screens/
    pharmacie/
      ScannerStockScreen.tsx       ← Caméra + détection code-barres
      MedicamentInconnuScreen.tsx  ← Formulaire enregistrement one-time
      FormulaireStockScreen.tsx    ← Saisie quantité + détails
      README.md                    ← Instructions d'intégration
```

### Flux utilisateur complet

```
Agent terrain → ouvre app → "Réception stock" ou "Dispensation"
  └── ScannerStockScreen (caméra plein écran)
       ├── Scan EAN-13 ou QR Code
       │    ├── Code CONNU (base locale)
       │    │    └── FormulaireStockScreen
       │    │         ├── ENTRÉE : quantité + lot + date péremption + fournisseur
       │    │         │    └── POST /api/pharmacie/stock/entree → stock++
       │    │         └── SORTIE : quantité + motif (ordonnance SD, urgence, périmé...)
       │    │              └── POST /api/pharmacie/stock/sortie → stock--
       │    └── Code INCONNU (première fois)
       │         └── MedicamentInconnuScreen (formulaire one-time)
       │              └── POST /api/pharmacie/ean → médicament enregistré
       │                   └── FormulaireStockScreen (suite normale)
       └── Saisie manuelle (bouton fallback)
```

### Endpoints FastAPI ajoutés

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/pharmacie/ean/{code}` | Lookup EAN-13 ou code_interne |
| GET | `/api/pharmacie/ean/search?q=` | Recherche textuelle |
| POST | `/api/pharmacie/ean` | Créer nouveau médicament |
| POST | `/api/pharmacie/stock/entree` | Réceptionner un lot |
| POST | `/api/pharmacie/stock/sortie` | Dispenser / déduire stock |
| GET | `/api/pharmacie/stock/{centre_id}` | Stock complet + alertes |
| GET | `/api/pharmacie/stock/{centre_id}/mouvements` | Historique traçabilité |
| POST | `/api/pharmacie/ean/import-base` | Charger les 50 médicaments de base |

### Base de 50 médicaments

Catégories couvertes, adaptées au terrain RDC :

| Catégorie | Références |
|-----------|-----------|
| Antipaludéens | Coartem, Artésunate inj., Quinine |
| Antibiotiques | Amoxicilline, Cotrimoxazole, Métronidazole, Doxycycline, Ciprofloxacine, Ceftriaxone inj., Ampicilline inj., Gentamicine inj. |
| Antalgiques | Paracétamol, Paracétamol pédiatrique, Ibuprofène, Tramadol |
| Réhydratation | SRO/ORS, Zinc sulfate |
| Antiparasitaires | Mébendazole, Albendazole |
| Vitamines | Vitamine A, Fer+Acide folique, Vitamine B complexe |
| Corticoïdes | Prednisolone, Dexaméthasone inj., Hydrocortisone inj. |
| Respiratoire | Salbutamol inhalateur, Aminophylline inj. |
| Cardiovasculaire | Furosémide, Amlodipine, Captopril, Hydrochlorothiazide |
| Diabète | Metformine, Glibenclamide, Insuline NPH |
| Neurologie | Diazépam inj., Phénobarbital |
| Obstétrique | Sulfate de magnésium inj., Ocytocine inj., Misoprostol |
| Anesthésie | Kétamine inj., Lidocaïne inj. |
| Solutés | NaCl 0,9%, Ringer Lactate, Glucose 5%, Glucose 10%, Eau pour injection |
| Diagnostic | Test grossesse, TDR paludisme |
| Consommables | Gants d'examen latex |

**Note importante :** Les champs `ean` sont tous vides (`""`). Ils se remplissent automatiquement au premier scan physique de chaque boîte sur le terrain. C'est intentionnel : les codes EAN varient selon le fabricant, le lot, le pays d'importation.

---

## 4. Procédure de déploiement — Hetzner CX23 partagé (contexte réel)

### Contexte important

> **Configuration de test** : Un seul Hetzner CX23 héberge **trois applications** :
> - **Longonia** (déjà en production)
> - **LX** (déjà en production)
> - **SantéDirect Kolongono** (à ajouter)
>
> C'est une contrainte budgétaire temporaire. Dès que l'application sera prête pour la production, chaque app aura son propre serveur dédié (principe : **1 serveur = 1 app**).

### Conséquences architecturales du serveur partagé

| Aspect | Impact |
|--------|--------|
| nginx | Déjà installé et configuré pour Longonia + LX. **Ajouter uniquement un nouveau `server_name` block.** Ne jamais toucher aux blocs existants. |
| PostgreSQL | Déjà installé. **Créer seulement une nouvelle base `santesd`.** L'instance tourne déjà. |
| systemd | Déjà utilisé par Longonia et LX. **Ajouter seulement `santesd.service`.** |
| Certbot | Déjà installé. **Ajouter le domaine SantéDirect** à la commande certbot. |
| RAM (4 GB) | Partagée entre 3 apps + PostgreSQL + nginx. Uvicorn avec **`--workers 1`** pour SantéDirect en phase test. |
| Longonia bridge | Longonia est sur le **même serveur** → utiliser `http://127.0.0.1:PORT_LONGONIA` au lieu de `https://longonia.org` (plus rapide, pas de sortie réseau). |

### Prérequis
- Accès SSH au serveur existant (vous y avez déjà accès via Longonia)
- Nom de domaine pour SantéDirect pointant vers la même IP Hetzner
- Code source sur GitHub ou transféré par SFTP

---

### ÉTAPE 0 — Se connecter au serveur existant (PowerShell local → SSH)

```powershell
# Depuis PowerShell sur votre machine Windows
ssh votre_user@<IP_DU_SERVEUR_HETZNER>
# Le serveur tourne déjà — nginx, PostgreSQL, certbot sont installés
```

```bash
# Vérifier l'état de ce qui tourne déjà (SSH)
sudo systemctl status nginx postgresql
sudo systemctl list-units --type=service --state=running | grep -E "longonia|lx|nginx|postgres"

# Vérifier les ports déjà occupés
sudo ss -tlnp | grep -E "80|443|8000|8001|8002|5432"

# Vérifier l'espace disque restant
df -h
free -h   # RAM disponible
```

> Note les ports utilisés par Longonia et LX — SantéDirect utilisera le port **8002**.
> Si 8002 est déjà pris, choisir 8003.

---

### ÉTAPE 1 — Vérifier / installer Python 3.11 (SSH)

```bash
# Python est peut-être déjà là
python3.11 --version

# Si absent uniquement :
sudo apt install -y python3.11 python3.11-venv python3-pip build-essential
```

---

### ÉTAPE 2 — Créer la base de données PostgreSQL (SSH)

> PostgreSQL tourne déjà pour Longonia et LX. On ajoute juste une nouvelle base.

```bash
sudo -u postgres psql

-- Créer l'utilisateur et la base SantéDirect uniquement
-- Ne pas toucher aux users/bases existants (longonia, lx)
CREATE USER kolongono_sd WITH PASSWORD 'MotDePasseForTresComplexe2026!';
CREATE DATABASE santesd OWNER kolongono_sd;
GRANT ALL PRIVILEGES ON DATABASE santesd TO kolongono_sd;
\q

# Tester
psql -U kolongono_sd -d santesd -h localhost
# → \q pour quitter
```

---

### ÉTAPE 3 — Déployer le code (SSH)

```bash
# Choisir un emplacement qui ne chevauche pas Longonia et LX
# Adapter selon la structure existante du serveur
mkdir -p /var/www/santesd
cd /var/www/santesd

# Cloner le repo
git clone https://github.com/VOTRE_COMPTE/kolongono.git .

# Créer un environnement Python isolé (indépendant de Longonia/LX)
cd "SANTE DIRECT - KOLONGONO/api"
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

**Contenu minimal de `requirements.txt` :**
```
fastapi==0.110.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.29
psycopg2-binary==2.9.9
pydantic==2.7.0
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
python-multipart==0.0.9
alembic==1.13.1
```

---

### ÉTAPE 4 — Fichier d'environnement (SSH)

```bash
nano "/var/www/santesd/SANTE DIRECT - KOLONGONO/.env"
```

```env
# Base de données — instance PostgreSQL partagée, base dédiée
DB_HOST=localhost
DB_PORT=5432
DB_NAME=santesd
DB_USER=kolongono_sd
DB_PASSWORD=MotDePasseForTresComplexe2026!

# Sécurité
SECRET_KEY=générer-avec-openssl-rand-hex-32-ici
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Longonia bridge — MÊME SERVEUR → localhost (pas https://longonia.org)
# Vérifier le port exact de Longonia avec : sudo ss -tlnp
LONGONIA_API_URL=http://127.0.0.1:8000
LONGONIA_API_KEY=clé-à-obtenir-auprès-de-longonia

# Jitsi Meet (public pour les tests)
JITSI_DOMAIN=meet.jit.si

# Anthropic (si usage IA futur)
ANTHROPIC_API_KEY=sk-ant-...

# Mobile Money (à configurer plus tard)
MPESA_API_KEY=
ORANGE_MONEY_API_KEY=

# Firebase (push notifications — à configurer plus tard)
FIREBASE_SERVER_KEY=
```

```bash
# Générer une SECRET_KEY solide (SSH)
openssl rand -hex 32
# → Copier le résultat dans SECRET_KEY ci-dessus
```

---

### ÉTAPE 5 — Migrations base de données (SSH)

```bash
cd "/var/www/santesd/SANTE DIRECT - KOLONGONO/api"
source venv/bin/activate

# Initialiser Alembic (si pas encore fait)
alembic init alembic

# Créer et appliquer les migrations
alembic revision --autogenerate -m "initial schema"
alembic upgrade head

deactivate
```

---

### ÉTAPE 6 — Service systemd FastAPI (SSH)

> Longonia et LX ont leurs propres services. On ajoute uniquement `santesd.service`.
> `--workers 1` pour économiser la RAM sur le serveur partagé (passer à 2 sur serveur dédié).

```bash
sudo nano /etc/systemd/system/santesd.service
```

```ini
[Unit]
Description=SantéDirect Kolongono — FastAPI (test)
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/var/www/santesd/SANTE DIRECT - KOLONGONO/api
ExecStart=/var/www/santesd/SANTE DIRECT - KOLONGONO/api/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002 --workers 1 --log-level info
Restart=always
RestartSec=5
EnvironmentFile=/var/www/santesd/SANTE DIRECT - KOLONGONO/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable santesd
sudo systemctl start santesd

# Vérifier
sudo systemctl status santesd
sudo journalctl -u santesd -f    # logs en temps réel
```

---

### ÉTAPE 8 — nginx reverse proxy (SSH)

```bash
sudo nano /etc/nginx/sites-available/santesd
```

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    # Fichiers statiques (démo HTML/CSS/JS)
    root /home/kolongono/apps/kolongono/SANTE DIRECT - KOLONGONO/web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # API FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8002/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Docs API (désactiver en prod si nécessaire)
    location /docs {
        proxy_pass http://127.0.0.1:8002/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8002/openapi.json;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/santesd /etc/nginx/sites-enabled/
# ⚠️ NE PAS supprimer sites-enabled/default si Longonia et LX l'utilisent
# Vérifier ce qui existe avant de toucher quoi que ce soit :
ls /etc/nginx/sites-enabled/
sudo nginx -t                               # vérifier la syntaxe
sudo systemctl reload nginx
```

---

### ÉTAPE 9 — HTTPS avec Let's Encrypt (SSH)

```bash
# IMPORTANT : le domaine doit déjà pointer vers l'IP du serveur (DNS propagé)
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

Certbot modifie nginx automatiquement pour rediriger HTTP → HTTPS.

**Pourquoi c'est obligatoire :** Le scanner caméra (`getUserMedia` dans le navigateur, `expo-camera` dans React Native) est bloqué sur HTTP. HTTPS est requis sans exception.

---

### ÉTAPE 10 — Charger la base de médicaments (SSH ou PowerShell)

```bash
# Sur le serveur (SSH) — après que le service tourne
curl -X POST https://votre-domaine.com/api/pharmacie/ean/import-base

# OU depuis PowerShell local (si le serveur est accessible)
Invoke-RestMethod -Method POST -Uri "https://votre-domaine.com/api/pharmacie/ean/import-base"
```

Réponse attendue : `{"created": 50, "skipped": 0}`

---

### ÉTAPE 11 — Configurer le CORS côté Longonia (même serveur SSH)

> Longonia tourne sur le **même CX23**. Pas besoin d'une second connexion SSH.

```bash
# Toujours connecté au même serveur
# Dans le code FastAPI de Longonia, ajouter SantéDirect aux origines autorisées :
# allow_origins=["https://votre-domaine-santesd.com"]

# Éditer le fichier Longonia concerné (adapter le chemin réel)
nano /var/www/longonia/api/main.py   # ou le chemin réel de Longonia

# Puis redémarrer uniquement le service Longonia (sans toucher aux autres)
sudo systemctl restart longonia
sudo systemctl status longonia   # vérifier qu'il a bien redémarré
```

---

### Commandes de maintenance courantes (SSH)

```bash
# Voir les logs FastAPI
sudo journalctl -u santesd -n 100 --no-pager

# Redémarrer après mise à jour du code
git pull
sudo systemctl restart santesd

# Vérifier l'état de tous les services
sudo systemctl status santesd nginx postgresql

# Espace disque
df -h

# RAM et CPU
htop
```

---

### Intégration mobile — ce qui se fait en local (PowerShell)

```powershell
# Dans le dossier mobile/
cd "d:\PROJET AGENTS 2026\MORE\KOLONGONO\SANTE DIRECT - KOLONGONO\mobile"

# Installer les dépendances scanner
npx expo install expo-camera expo-barcode-scanner
npx expo install @react-native-community/datetimepicker

# Lancer le serveur de développement
npx expo start

# Build production Android
npx expo build:android
# ou avec EAS (recommandé)
npx eas build --platform android
```

---

## 5. Pièces manquantes — Ce qui reste à faire

### 5.1 Côté API (critique — bloque le déploiement)

| Fichier | Ce qui manque | Priorité |
|---------|--------------|----------|
| `api/models.py` | Modèles SQLAlchemy : `MedicamentEAN`, `StockPharmacie`, `MouvementStock` | 🔴 Bloquant |
| `api/main.py` | Enregistrer `pharmacie_ean.router` | 🔴 Bloquant |
| `api/database.py` | Fonction `get_db`, connexion SQLAlchemy | 🔴 Bloquant |
| `api/routers/longonia_bridge.py` | Câblage vers `https://longonia.org` | 🟠 Important |
| `api/alembic/` | Migrations base de données | 🟠 Important |

### 5.2 Côté mobile

| Fichier | Ce qui manque | Priorité |
|---------|--------------|----------|
| `mobile/App.tsx` | Ajouter les 3 screens scanner dans le navigator | 🔴 Bloquant |
| `mobile/components/theme.ts` | Vérifier que `colors.blueSoft`, `colors.border`, `colors.textMuted` existent | 🟠 Important |
| `mobile/components/api.ts` | Vérifier que `apiClient` exporte `.get()` et `.post()` avec la bonne base URL | 🟠 Important |
| `mobile/screens/admin/PharmacieAdminScreen.tsx` | Ajouter les boutons "Scanner entrée" / "Scanner sortie" | 🟡 Normal |

### 5.3 Infrastructure

| Tâche | Priorité |
|-------|----------|
| Choisir le domaine pour SantéDirect | 🔴 Bloquant |
| Générer et partager `LONGONIA_API_KEY` avec l'équipe Longonia | 🔴 Bloquant |
| Configurer CORS sur longonia.org | 🟠 Important |
| Configurer Firebase pour les notifications push | 🟡 Normal |
| Configurer Jitsi Meet auto-hébergé | 🟡 Normal |

---

## 6. Bilan réaliste

### Ce qui fonctionne vraiment bien ✅

**Interface de démonstration (centre.html)**
- Complète, cohérente, visuellement solide
- Toutes les 8 pages principales ont leur banner colorée dynamique
- Les données JS simulées couvrent 3 centres avec des scénarios réalistes
- Navigable depuis n'importe quel navigateur, partageable via Netlify Drop en 30 secondes
- Adapté mobile (responsive)

**Architecture technique**
- Les choix sont solides : FastAPI, PostgreSQL, React Native, Jitsi Meet
- La séparation Longonia / SantéDirect est propre
- Le pattern API REST est bien structuré
- La stratégie scanner (QR maison + EAN progressif) est pragmatique et adaptée au terrain

**Base médicaments**
- 50 références pertinentes pour le contexte RDC
- Structure propre, extensible
- Couverture des pathologies prioritaires (paludisme, infections, malnutrition, obstétrique)

---

### Ce qui est incomplet et doit être honnêtement évalué ⚠️

**Le fossé démo ↔ production est significatif**

La démo `centre.html` est entièrement en JavaScript statique. Toutes les "données" sont des tableaux JS codés en dur. Il n'y a aucune connexion réelle à une base de données. Passer de la démo à une application fonctionnelle représente plusieurs semaines de développement.

**Ce qui n'existe pas encore :**
- Authentification JWT (login, sessions, tokens)
- Modèles SQLAlchemy complets pour tous les domaines
- Migrations Alembic
- Les routers FastAPI pour admissions, dossiers, personnel, comptabilité, réfectoire
- L'intégration Jitsi Meet dans React Native
- L'intégration Mobile Money (M-Pesa, Orange Money)
- Les notifications push Firebase
- Le bridge Longonia câblé en production
- Les tests (unitaires, intégration)
- La gestion des erreurs en production

**Estimation réaliste du travail restant pour un MVP fonctionnel :**

| Domaine | Effort estimé |
|---------|--------------|
| Models + migrations PostgreSQL | 3-4 jours |
| Auth JWT complet | 2-3 jours |
| Routers FastAPI (tous domaines) | 2-3 semaines |
| App mobile (tous les screens) | 3-4 semaines |
| Intégration Jitsi Meet | 3-5 jours |
| Intégration Mobile Money | 1-2 semaines |
| Bridge Longonia | 3-4 jours |
| Scanner pharmacie (mobile) | 3-4 jours |
| Tests + stabilisation | 1-2 semaines |
| Déploiement + configuration prod | 2-3 jours |
| **Total MVP** | **~10-12 semaines** (développeur expérimenté, temps plein) |

**Ce qui est critique et risqué :**

1. **Mobile Money en RDC** — Les APIs M-Pesa et Orange Money RDC ont des documentations insuffisantes, des environnements de test instables, et des délais d'intégration imprévisibles. Prévoir un buffer important.

2. **Connectivité terrain** — L'application doit fonctionner en mode offline partiel (SQLite local + sync quand connexion disponible). Ce n'est pas encore architecturé.

3. **Jitsi Meet auto-hébergé** — Sur un CX23, les appels vidéo à 3 participants consomment beaucoup de ressources. À charge normale (< 5 appels simultanés), ça devrait tenir. Mais nécessite du monitoring.

4. **Réglementation santé RDC** — Le stockage de dossiers médicaux numériques est soumis à des obligations légales. À vérifier avec le Ministère de la Santé avant le déploiement public.

---

### Recommandation de prochaines étapes (ordre de priorité)

1. **Immédiat** : Créer `models.py` et `database.py` — les modèles SQLAlchemy sont le socle de tout
2. **Semaine 1** : Auth JWT + router adhérents/centres fonctionnel
3. **Semaine 2** : Déploiement Hetzner CX23 #2 avec juste l'API de base + la démo statique
4. **Semaine 3-4** : Scanner pharmacie mobile opérationnel
5. **Mois 2** : App mobile complète (screens principaux)
6. **Mois 3** : Jitsi + Mobile Money + tests terrain

---

## 7. Règles de développement figées (à ne jamais remettre en question)

Ces règles ont été définies par le client et sont non-négociables :

- Répondre **toujours en français**
- **Pas d'emojis** — SVG stroke icons exclusivement
- Vidéo : **Jitsi Meet exclusivement** (jamais Daily.co ou autre)
- Stack : **FastAPI port 8002 + React Native**
- Paiements : **Mobile Money exclusivement** — aucune carte bancaire, aucun Stripe
- Devise : **USD** pour médecins et admin ; **FC (Francs Congolais)** pour le patient
- Médecins : **salaire mensuel fixe** (200-450 USD) — **jamais rémunérés à la consultation**

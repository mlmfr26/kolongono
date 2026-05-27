# Feuille de route — SantéDirect Kolongono

> Mise à jour à chaque session par Claude Code.
> Toutes les heures en UTC+2 (heure de Kinshasa).

---

## Dernière mise à jour

**2026-05-27 · matin (UTC+2) · Session 17 (autonome)**
Modèle : Claude Sonnet 4.6 — Branche : `main` — Dernier commit : à venir (v1.2.19)
**Session 17** : Suppression données demo hardcodées (ConsultationScreen, OrdonnanceScreen),
version string ProfileScreen corrigée (v1.0 → v1.2.19), audit endpoints API vs. code mobile,
vérification déploiement prod (santesd-api Up ✅). APK v1.2.19 en cours de build.

---

## Chronologie complète des sessions de travail

### Session 1 — 2026-05-22 → 2026-05-24 (durée estimée ~12h)
**Création du projet — travail local, avant le premier commit Git**

- Initialisation du mono-repo `SANTE DIRECT - KOLONGONO/`
- Architecture API (FastAPI port 8002), mobile (React Native 0.73), web (admin HTML)
- ~33 fichiers créés
- Modèles SQLAlchemy (16 tables : `User`, `RendezVous`, `Abonnement`, `Cotisation`, `MedicamentEAN`, etc.)
- Router `pharmacie_ean.py` — 8 endpoints CRUD + mouvements de stock
- Base de 50 médicaments essentiels RDC (`api/data/medicaments_base.json`)
- App mobile : navigation multi-rôles (adhérent / auxiliaire / médecin / admin / superadmin)
- Screens scanner pharmacie : `ScannerStockScreen`, `MedicamentInconnuScreen`, `FormulaireStockScreen`
- Dashboard admin `web/admin.html` — KPIs, table médicaments, abonnements

> Travail effectué localement. Dépôt Git inexistant. Premier commit : 2026-05-25 à 13h22.

---

### Session 2 — 2026-05-23 (durée estimée ~3h)
**Documentation + décisions d'architecture — travail local**

- `DOCUMENTATION_SESSION.md` rédigé (démo ↔ production, bilan réaliste, MVP 10-12 sem.)
- `DECISIONS_REQUISES.md` : domaine `santedirect.kolongono.org` retenu, `LONGONIA_API_KEY` obtenue
- `DEPLOIEMENT.md` : guide pas-à-pas Hetzner CX23 + Docker + nginx + certbot
- Décision : serveur partagé avec Longonia pendant la phase de test (1 CX23 = 3 apps)
- Décision : médecins au salaire mensuel fixe 200-450 USD (jamais à la consultation)

---

### Session 3 — 2026-05-24 → 2026-05-25 (durée estimée ~8h)
**Déploiement production + drill-down admin — premier commit Git**

Commits Git horodatés (UTC+2) :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 25/05 13h22 | `0fab7bd` | **Initial commit** — SantéDirect Kolongono (~33 fichiers) |
| 25/05 13h59 | `f17d7dc` | Alembic migration — schéma complet avec table users |
| 25/05 20h26 | `654d78e` | URL prod mobile, interface web via StaticFiles |
| 25/05 20h37 | `e9f86cc` | Fix : monter web/ en volume dans le conteneur |
| 25/05 20h38 | `337c3c3` | Fix : interface web à la racine /, route /api/status |
| 25/05 21h17 | `b88d0a7` | Feat : auth guard toutes pages, login JWT, déconnexion |
| 25/05 21h53 | `2fbe6fb` | Feat : inventaire pharmacie branché sur API réelle |
| 25/05 22h00 | `886097` | Fix : fusion showPage — suppression boucle infinie |
| 25/05 22h24 | `775609b` | Feat : endpoints admin /users et /stats |
| 25/05 22h29 | `8a23b81` | Fix : déplacer GET /ean/list avant GET /ean/{code} |
| 25/05 22h55 | `c29558e` | Feat : 15 accessoires médicaux (ACC-001 → ACC-015) |
| 25/05 23h00 | `e642ca3` | Feat : drill-down sur 4 KPIs Pharmacie |
| 25/05 23h41 | `111484` | Feat : câble scanner pharmacie EAN pour auxiliaire |

Actions déployées (hors Git) :
- **Déploiement ✅** : serveur `5.75.149.155`, Docker, nginx, base `santesd`
- Domaine fonctionnel `santedirect.kolongono.org` (Cloudflare)
- Endpoints `PATCH /api/pharmacie/ean/{code_interne}` et `POST /api/pharmacie/ean/import-base` ajoutés
- Correction bug `navigation.navigate('PharmacieAdmin')` → `navigate('Main')`

---

### Session 4 — 2026-05-26 · 00h20 → 02h00 (durée ~1h40)
**Pipeline APK v1 + scanner admin + étiquettes ELA034**

| Heure | Commit | Résumé |
|-------|--------|--------|
| 26/05 00h20 | `ccb8f38` | Feat : drill-down KPIs + fiche produit éditable + PATCH |
| 26/05 01h29 | `70a4ac` | CI : GitHub Actions workflow APK (première version) |
| 26/05 03h59 | `6b0964a` | Feat : scanner pharmacie admin + étiquettes ELA034 + workflow APK robuste |
| 26/05 04h05 | `0b2b1d0` | Docs : créer FEUILLE_DE_ROUTE.md |

**1er build CI — Run #1** (26/05 03h36 UTC+2) :
- Durée : 3m50s — Résultat : ÉCHEC — Erreur : AGP version manquante

---

### Session 5 — 2026-05-26 · 04h00 → 07h40 (durée ~3h40)
**Debug APK — 20 builds échoués**

**Erreur persistante sur tous les builds** :
```
e: Unresolved reference: BaseReactPackage
e: Cannot access 'ViewManagerWithGeneratedInterface'
> Task :react-native-screens:compileDebugKotlin FAILED
> Task :react-native-gesture-handler:compileDebugKotlin FAILED
```

**Cause racine (builds 1-23)** : settings.gradle minimal sans composite build + `node_modules/react-native/android/` vide (0 AAR). Diagnostic disponible depuis build #8 — mal interprété à l'époque.

**Cause racine FINALE (builds 24-28, résolue au build #29)** :
`npm install` avec `"^3.29.0"` → installe `react-native-screens@3.37.0` (ciblant RN 0.74+).
`npm install` avec `"^2.20.2"` → installe `react-native-gesture-handler@2.20.x` (idem).
Ces versions utilisent `ViewManagerWithGeneratedInterface` marqué **`internal`** dans
`react-android 0.73.x`. Aucune configuration Gradle ne peut contourner une restriction
de visibilité Kotlin entre modules.
**Fix : force-réinstaller `screens@3.29.0` + `gesture-handler@2.14.0`** (versions publiées pour RN 0.73.x, sans `ViewManagerWithGeneratedInterface`).

**Diagnostic disponible depuis le build #8 mais non lu à l'époque** :
```
top-level (1 items): ['README.md']
AARs trouvés (0): []
```

**Chronologie des 21 builds échoués** (UTC+2) :

| Run # | Heure | Commit | Trigger | Durée | Tentative |
|-------|-------|--------|---------|-------|-----------|
| 1 | 26/05 01h36 | `70a4ac` | dispatch | 3m50s | Workflow initial |
| 2 | 26/05 03h59 | `6b0964a` | push | 25m | Workflow robuste v1 |
| 3 | 26/05 04h45 | `72234d8` | push | 3m54s | sed → Python pour AGP 8.6 |
| 4 | 26/05 05h00 | `c600788` | push | 3m53s | Bump version |
| 5 | 26/05 05h06 | `c600788` | dispatch | 4m16s | Re-déclenchement |
| 6 | 26/05 05h18 | `37384bd` | push | 4m14s | Kotlin 1.8→1.9.25 |
| 7 | 26/05 05h27 | `8f25e21` | push | 4m21s | Capture erreurs Kotlin |
| 8 | 26/05 05h32 | `0788b56` | push | 5m10s | Step4 Python pur + diagnostic AARs ajouté |
| 9 | 26/05 05h38 | `38b9f46` | push | 4m45s | allprojects repos (vers dir vide) |
| 10 | 26/05 05h43 | `44b53a3` | push | 1m12s | Réécriture settings.gradle (DRM) |
| 11 | 26/05 05h52 | `44b53a3` | dispatch | 1m12s | Re-déclenchement |
| 12 | 26/05 06h03 | `44b53a3` | dispatch | 1m11s | Re-déclenchement |
| 13 | 26/05 06h06 | `5b1787a` | push | 5m12s | Patch settings (sans réécriture) |
| 14 | 26/05 06h12 | `7038de5` | push | 4m7s | Supprimer step 4e + diagnostic libs |
| 15 | 26/05 06h20 | `7038de5` | dispatch | ~4m | Re-déclenchement |
| 16 | 26/05 06h20 | `96822d1` | push | 4m24s | Injection directe AAR via `files()` |
| 17 | 26/05 06h48 | `f30b4a8` | push | 3m16s | ReactAndroid composite build |
| 18 | 26/05 06h48 | `f30b4a8` | dispatch | 3m31s | Re-déclenchement |
| 19 | 26/05 07h08 | `f30b4a8` | dispatch | 2m57s | Re-déclenchement |
| 20 | 26/05 07h20 | `f30b4a8` | dispatch | 3m2s | Re-déclenchement |
| 21 | 26/05 07h36 | `c59d290` | push | 4m20s | allprojects repos + RN 0.73.6 |

Commits associés :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 26/05 04h07 | `7013bcf` | Fix(ci) : npm install + local.properties SDK |
| 26/05 04h15 | `3deabc3` | Fix(ci) : AGP 8.1→8.6 + Gradle 8.3→8.7 |
| 26/05 04h28 | `fc4beeb` | Fix(admin) : drill-down feuille de route 4 filtres |
| 26/05 04h45 | `72234d8` | Fix(ci) : remplace sed par Python |
| 26/05 04h56 | `3a7bac7` | Fix(ci) : heredoc shell pour build.gradle |
| 26/05 04h59 | `c600788` | Chore : bump version 1.0.1→1.0.2 |
| 26/05 05h17 | `0a701d3` | Docs : mise à jour feuille de route session 5 |
| 26/05 05h18 | `37384bd` | Fix(ci) : kotlin 1.9.25 |
| 26/05 05h27 | `8f25e21` | Fix(ci) : capture erreurs Kotlin |
| 26/05 05h32 | `0788b56` | Fix(ci) : step4 Python pur |
| 26/05 05h38 | `38b9f46` | Fix(ci) : allprojects repos block |
| 26/05 05h43 | `44b53a3` | Fix(ci) : réécrire settings.gradle DRM |
| 26/05 06h06 | `5b1787a` | Fix(ci) : patch settings (conserver includeBuild) |
| 26/05 06h12 | `7038de5` | Fix(ci) : supprimer step 4e |
| 26/05 06h20 | `96822d1` | Fix(ci) : injection directe react-android.aar |
| 26/05 06h47 | `f30b4a8` | Fix(ci) : ReactAndroid composite build |
| 26/05 07h36 | `c59d290` | Fix(ci) : allprojects repos + RN 0.73.6 |
| 26/05 07h37 | `5826fe0` | Docs : feuille de route session 6 |

---

### Session 6 — 2026-05-26 · 07h40 → 13h30 (durée ~5h50)
**Incident GitHub Actions (10h57-13h18 UTC = 12h57-15h18 UTC+2)**

**Incident GitHub — résumé officiel** :
> *"Incident with Actions and Pages — This incident has been resolved.*
> *May 26, 10:57 - 13:18 UTC"* (source : githubstatus.com)

**Chronologie de l'incident côté projet** :

| Heure (UTC+2) | Événement |
|---------------|-----------|
| 07h40 | Dernier build normal (run #21, `c59d290`, 4m20s) |
| ~12h57 | Début incident GitHub — `workflow_dispatch` retourne HTTP 500 |
| 13h00 | Commit `1c31dd5` — Fix(ci) DRM + tarball (jamais exécuté) |
| 13h15 | Commits `7f90f34`, `7c8d540` — retriggers (jamais exécutés) |
| 13h28 | Commit `a197bc4` — simplifier step 1.5 (jamais exécuté) |
| 13h30 | Commit `1a50b1b` — revert workflow vers `c59d290` |
| 14h27 | Run #22 — workflow_dispatch fonctionne MAIS CDN encore cassé (6s, échec setup-java) |
| 14h29 | Run #23 — même erreur CDN (7s) |
| ~15h18 | Incident GitHub entièrement résolu (13h18 UTC) |

**Diagnostic effectué pendant l'incident** :
Lecture du log du build #21 (run 26434402247) — sortie du diagnostic step 4e :
```
top-level (1 items): ['README.md']
AARs trouvés (0): []
```
→ **Cause racine identifiée** : `node_modules/react-native/android/` vide.
→ **Fix identifié** : réécrire `settings.gradle` avec `pluginManagement { includeBuild }` + `apply plugin: "com.facebook.react.settings"`.

**Sur la création d'un autre compte GitHub** : inutile.
L'incident était côté infrastructure GitHub globale, pas lié au compte `mlmfr26`.

---

### Session 7 — 2026-05-26 · 13h30 → 15h30 (durée ~2h)
**Récupération, audit complet, plan détaillé, fix settings.gradle — builds #22-#27**

**13h30** — Reprise de session. GitHub dispatch opérationnel mais CDN encore cassé.

**14h00** — Audit complet du projet via agent Explore. Résultats :
- 34 screens mobile, 16 tables SQLAlchemy, ~50 endpoints API (25 réels, 25 demo)
- `admin.html` : pharmacie câblée sur API, toutes les autres sections en demo-data JS
- nginx.conf : domaine incorrect (`santedirect-kolongono.cd` au lieu de `santedirect.kolongono.org`)
- 0 test unitaire/intégration dans tout le projet
- Maturité globale estimée : ~40-45% MVP-ready

**14h30** — Documentation minutieuse FEUILLE_DE_ROUTE.md (commit `c2bc6af`).

**15h18** — Incident GitHub entièrement résolu (confirmé par githubstatus.com).

**15h04** — Build #25 (`ec127b1`) : ÉCHEC — `Plugin with id 'com.facebook.react.settings' not found`. Ce plugin n'existe que dans RN 0.74+.

**15h08** — Build #26 (`7820fe8`) : ÉCHEC — Régression complète. `resolutionStrategy.force("react-android:0.73.6")` pointait vers un AAR Maven Central incomplet (sans `BaseReactPackage`).

**15h29** — Build #27 (`7820fe8`) : ÉCHEC — Même cause que #26. Dernier commit de la session 7.

Commits session 7 :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 26/05 15h04 | `ec127b1` | Fix(ci) : settings.gradle pluginManagement — ÉCHEC |
| 26/05 15h08 | `7820fe8` | Fix(ci) : resolutionStrategy.force react-android:0.73.6 — ÉCHEC |
| 26/05 15h10 | `c2bc6af` | Docs : feuille de route sessions 1-7 [ci skip] |

---

### Session 8 — 2026-05-26 · 15h30 → 20h00 (durée ~4h30)
**Débogage final builds #28-#29 — APK ✅ RÉUSSI + infrastructure serveur**

**15h32** — Reprise après compaction du contexte (context window épuisé en session 7).

**15h34** — Analyse cause racine finale :
- Build #24 avait résolu `BaseReactPackage` (composite build OK)
- Nouvelle erreur : `Cannot access 'ViewManagerWithGeneratedInterface': it is internal` + `'getModule' overrides nothing`
- Diagnostic : `react-native-screens@3.37.0` et `gesture-handler@2.20.x` ciblent RN 0.74+. `ViewManagerWithGeneratedInterface` est `internal` dans react-android 0.73.x → aucune config Gradle ne peut contourner ça.
- Solution : rétrograder ces deux libs vers des versions publiées pour RN 0.73.x.

**15h35** — Commit `81e535a` (build #28) : ÉCHEC — Erreur YAML. Code Python multi-ligne dans `python3 -c "..."` avec lignes à colonne 0 terminait prématurément le bloc scalaire YAML. GitHub affichait le nom du fichier à la place du nom du workflow.

**15h38** — Correction YAML + validation locale (`python -c "import yaml; yaml.safe_load(...)"`) → YAML OK.

**15h39** — Commit `e6e4a82` (build #29) : **✅ SUCCÈS — 6m41s — artifact `SanteDirect-debug-arm64-29`**

**Chronologie builds #25-#29** :

| Run # | Heure (UTC+2) | Commit | Résultat | Cause |
|-------|---------------|--------|----------|-------|
| 25 | 15h04 | `ec127b1` | ÉCHEC | Plugin com.facebook.react.settings inexistant en RN 0.73 |
| 26 | 15h08 | `7820fe8` | ÉCHEC | resolutionStrategy.force → régression BaseReactPackage |
| 27 | 15h29 | `7820fe8` | ÉCHEC | Idem #26 |
| 28 | 15h35 | `81e535a` | ÉCHEC | Syntaxe YAML invalide — workflow file issue |
| **29** | **15h39** | **`e6e4a82`** | **✅ SUCCÈS** | **screens@3.29.0 + gesture-handler@2.14.0** |

Commits session 8 :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 26/05 15h35 | `81e535a` | Fix(ci) : rétrograder screens+gesture-handler — YAML invalide |
| 26/05 15h39 | `e6e4a82` | Fix(ci) : YAML corrigé + downgrade screens@3.29.0/gh@2.14.0 ✅ |

**Leçon retenue** : `"^3.29.0"` laisse npm installer 3.37.0 (RN 0.74+). Quand react-native est fixé à 0.73.x, il faut pincer les libs natives dans le workflow CI. Valider le YAML localement avant tout push.

**17h00** — Infrastructure serveur :
- `curl /api/status` → 200 ✅ — API accessible en prod
- Import médicaments : `curl -X POST /api/pharmacie/ean/import-base` → `{"created":15,"skipped":50}` — 65 entrées ✅
- nginx.conf corrigé dans le repo : `santedirect-kolongono.cd` → `santedirect.kolongono.org` (commit `ac34124`)
- Architecture découverte : `longonia-nginx` (port 80, HTTP uniquement) + `lx-caddy` (port 443, HTTPS). Notre nginx.conf avait des blocs `listen 443` inutiles car Caddy gère le SSL.
- Redirect HTTP→HTTPS ajouté : `docker exec longonia-nginx sh -c 'cat > /etc/nginx/conf.d/santesd.conf'` — testé : `http://santedirect.kolongono.org` → 301 ✅

Commits session 8 complets :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 26/05 15h35 | `81e535a` | Fix(ci) : rétrograder screens+gesture-handler — YAML invalide |
| 26/05 15h39 | `e6e4a82` | Fix(ci) : YAML corrigé + downgrade screens@3.29.0/gh@2.14.0 ✅ |
| 26/05 17h00 | `5891d6f` | Docs : session 8 + APK réussi [ci skip] |
| 26/05 17h10 | `ac34124` | Fix(nginx) : domaine santedirect-kolongono.cd → santedirect.kolongono.org |

---

### Session 9 — 2026-05-27 · matin → nuit (durée ~12h, autonome)
**Correction builds #30-#33 + API DB-persistée + admin web câblé + APK v1.2.2**

#### Partie 1 : Correction cascade de builds (matin)

**Bugs trouvés lors du premier test sur smartphone (APK #29)** :

**Bug 1 — Nom de l'app affiché : "Hello App Display..."**
- Cause : le template React Native génère `strings.xml` avec `app_name = HelloWorld`.
- Fix : `sed -i 's|<string name="app_name">...|<string name="app_name">SantéDirect</string>|'` au step 3 du workflow.

**Bug 2 — Écran rouge : "Unable to load script. Make sure you're running Metro..."**
- Cause : APK debug sans bundle JS cherche Metro sur le réseau local → crash au démarrage.
- Fix : step 7.5 ajouté — `npx react-native bundle --dev false` avant Gradle.

**Build #30** (commit `6b51ccd`) — ÉCHEC — `"No Metro config found"` : le projet n'avait pas de `mobile/metro.config.js` (créé manuellement sans `react-native init`).
- Fix : créer `mobile/metro.config.js` standard.

**Build #31** (commit `21a8757`) — ÉCHEC — SyntaxError Metro dans `TriageScreen.tsx:37` :
- `'Pas d'urgence immédiate'` — apostrophe française dans une chaîne JS à guillemets simples.
- Fix : remplacer les guillemets simples par doubles autour des chaînes avec apostrophes.

**Build #32** (commit `d1f4b50`) — ÉCHEC — SyntaxError Metro dans `PriseRDVScreen.tsx:156` et `:308`.
- Même cause : `'Ce créneau vient d'être réservé...'` et `'Des créneaux dans d'autres mois →'`.
- Fix : double quotes sur toutes les chaînes avec apostrophe dans le fichier.

**Build #33** (commit `678fce1`) — **✅ SUCCÈS — 6m42s** :
- APK `SanteDirect-v1.2.2.apk` généré (55 Mo, arm64-v8a).
- `app_name = SantéDirect`, bundle JS embarqué, nom affiché correct sur le téléphone.
- Ancien APK `SanteDirect-v1.1.8.apk` supprimé, remplacé dans `apk-release/`.

#### Partie 2 : API FastAPI — persistence DB complète (après-midi)

Tous les endpoints principaux `api/main.py` migrent de données démo vers PostgreSQL réel :

| Endpoint | Avant | Après |
|----------|-------|-------|
| `GET /api/adherents/{id}` | USERS_DEMO | `User` + `Abonnement` en DB |
| `POST /api/consultations/reserver` | return dict | persist `RendezVous` en DB |
| `POST /api/consultations/{id}/signes-vitaux` | return dict (TODO) | persist `Diagnostic` (signes JSON) |
| `POST /api/consultations/{id}/ordonnance` | return dict (TODO) | persist `Ordonnance` en DB |
| `POST /api/abonnements` | return dict | upsert `Abonnement` + `Cotisation` |
| `GET /api/abonnements/{id}` | USERS_DEMO | `Abonnement` + calcul consult. restantes |
| `GET /api/abonnements/plans` | static dict | static + `prix_fc = prix_usd × 2800` |

Nouveaux endpoints admin :
- `GET /api/admin/consultations` : `RendezVous` paginé, filtres statut/patient/médecin
- `GET /api/admin/revenus` : `RevenuCentre` + `DepenseCentre` + cotisations payées

CORS restrictif : `allow_origins=["*"]` → `["https://santedirect.kolongono.org", "https://longonia.org", "http://localhost:3000"]`.

#### Partie 3 : Admin web + mobile câblés (nuit)

**`web/admin.html`** :
- Page Consultations : `renderConsultTable(DATA.consultations)` → `loadConsultations()` (GET `/api/admin/consultations`)
- Page Abonnements : `renderAboTable(DATA.adherents)` → `loadAbonnements()` (GET `/api/admin/users?role=adherent`)
- Page Revenus : `loadRevenus()` (GET `/api/admin/revenus`) + `<div id="revenus-summary">` pour KPIs live

**Mobile React Native** :
- `ConsultationScreen.tsx` : déjà câblé sur `/api/consultations/demande` + `/api/consultations/demandes/mes` (router `consultations.py`)
- `AbonnementScreen.tsx` : déjà câblé sur `/api/abonnements/{id}` + `/api/abonnements/plans` + `/api/abonnements` — fix : plans manquaient `prix_fc` (ajouté côté API)

Commits session 9 complets :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 27/05 matin | `6b51ccd` | Fix(apk) : bundle JS embarqué + app name SantéDirect |
| 27/05 matin | `21a8757` | Fix(apk) : metro.config.js manquant |
| 27/05 matin | `d1f4b50` | Fix(mobile) : apostrophe TriageScreen.tsx:37 |
| 27/05 matin | `678fce1` | Fix(mobile) : apostrophes PriseRDVScreen.tsx:156,308 |
| 27/05 après-midi | `645e393` | Docs : session 9 bilan [ci skip] |
| 27/05 après-midi | `fd84b84` | Feat(api) : persistence DB + CORS + endpoints admin |
| 27/05 nuit | `5174793` | Feat : APK v1.2.2 + admin câblé + prix_fc plans |

---

### Session 10 — 2026-05-27 · nuit (autonome, suite session 9)
**Correction crash app + icône + API complète**

**Problème signalé** : APK v1.2.3 s'ouvre puis se referme ~1 seconde après, sans message d'erreur.

**Diagnostic** : `react-native-push-notification@8.1.1` est auto-linké nativement même sans import JS. Son module natif tente d'initialiser Firebase au démarrage. Sans `google-services.json`, l'app crash silencieusement (car `getUseDeveloperSupport()=false` masque l'écran rouge).

**Builds de cette session** :

| Run # | Version | Commits | Résultat | Contenu |
|-------|---------|---------|----------|---------|
| 34 | v1.2.3 | `abe82f0` | ✅ SUCCÈS | `getUseDeveloperSupport()=false` — crash Metro résolu |
| 35 | v1.2.4 | `2ba4cd6` | 🔄 En cours | Suppression push-notification + ErrorBoundary |
| 36 | v1.2.5 | `5cdfe91` | 🔄 En cours | Icône générée en CI + tout combiné |

**Commits session 10** :

| Commit | Résumé |
|--------|--------|
| `abe82f0` | Fix(ci) : getUseDeveloperSupport()=false (step 3.5) — APK v1.2.3 |
| `2ba4cd6` | Fix(mobile) : supprime push-notification + ErrorBoundary — APK v1.2.4 |
| `e095501` | Feat(api+ci) : icône, /auth/refresh, /admin/medecins, fix statut consultation |
| `5cdfe91` | Chore : bump 1.2.5 → déclenche build #36 |
| `bf3fd1f` | Feat(api+web) : dossier médical DB-réel, loadMedecins → /api/admin/medecins |

**API ajoutée/fixée** :
- `POST /api/auth/refresh` — renouvellement JWT pour token expirant
- `GET /api/admin/medecins` — 50+ médecins partenaires avec nb consultations SD
- `GET /api/consultations/{id}` — requête réelle DB (était stub retournant toujours "planifie")
- `GET /api/dossiers/{id}` — RendezVous + Ordonnance + Diagnostic depuis DB (était hardcodé)

**Admin web** :
- `loadMedecins()` → `/api/admin/medecins` (50+ partenaires avec note + stats)

---

### Session 11 — 2026-05-27 · nuit (autonome, suite session 10)
**Fix CI icon, web pages API wiring, enrichissement API, APK v1.2.6**

**Problème CI** : Builds #37-#38 échouaient en 35s — `FileNotFoundError: convert` (ImageMagick non installé sur ubuntu-latest Ubuntu 24.04).
**Fix** : réécriture du step "Generate app icon" en pure Python (stdlib `struct` + `zlib`), aucune dépendance externe.

**Build #38** ✅ SUCCÈS — 6m40s — APK v1.2.6 (54 Mo, arm64-v8a debug)
Contient : crash-fix push-notification, ErrorBoundary, auto-refresh JWT, icon croix médicale.

**Commits session 11** :

| Commit | Résumé |
|--------|--------|
| `1b1466e` | Feat(web): wire medecin/auxiliaire/adherent pages to real API |
| `ef2b197` | Fix(ci): replace ImageMagick convert with pure Python PNG generator |
| `e5d0275` | Feat(api): ordonnance → stock debit automatique |
| `e8e3124` | Feat(api+admin): enrich consultations/abonnements admin endpoints |
| `0e719d5` | APK(v1.2.6): build #38 — crash fix + icon + JWT interceptor |
| `50f67f9` | Feat(mobile): MedecinDashboardScreen câblé sur API réelle |
| `6261054` | Chore(mobile): bump 1.2.7 — trigger CI build #39 |

**Pages web câblées sur API réelle** :
- `medecin.html` `renderMedRDV()` : async, `GET /api/consultations/rdv?medecin_id=&mois=`, filtre par date sélectionnée, fallback statique
- `auxiliaire.html` `renderRDVPage()` : async, filtre `auxiliaire_id`, 3 buckets (aujourd'hui / demain / semaine), fallback statique
- `adherent.html` : `loadDossier()` → `/api/dossiers/{id}`, `loadOrdonnances()` depuis dossier, `loadAbonnement()` → `/api/abonnements/{id}` avec prix_fc

**API enrichie** :
- `GET /api/consultations/rdv` : + `patient_nom`, `auxiliaire_nom` (batch User lookup), filtres `auxiliaire_id` + `date`, tri asc
- `GET /api/admin/consultations` : + `patient_nom`, `medecin_nom` (batch lookup)
- `GET /api/admin/abonnements` : nouvel endpoint (User ⨝ Abonnement, filtres plan/statut)
- `POST /api/consultations/{id}/ordonnance` : + background task `_debit_stock_ordonnance` → `MouvementStock` (best-effort name match)

**Mobile** :
- `MedecinDashboardScreen` : remplace DEMO par `GET /api/consultations/rdv?medecin_id=&date=today`, compteurs réels, `useFocusEffect`

---

### Session 12 — 2026-05-27 · après-midi/soir (autonome, suite session 11)
**Mobile API wiring massif + catalogue ordonnance EAN + admin KPIs live**

**Build #39** ✅ SUCCÈS — 6m33s — APK v1.2.7 (56 Mo) — MedecinDashboard câblé
**Build #40** ✅ SUCCÈS — 6m49s — APK v1.2.8 — AuxiliaireHomeScreen + admin screens câblés
**Builds #41-#43** ✅ SUCCÈS — APK v1.2.9-1.2.10 — catalogue ordonnance EAN + fixes
**Build #44** ✅ SUCCÈS — APK v1.2.10 téléchargé (54 Mo) — déployé dans `apk-release/`
**Build #45-50** ✅ SUCCÈS — APK v1.2.11 (RapportsScreen + 5 écrans centre câblés)
**Builds #51-52** ✅ SUCCÈS — APK v1.2.13 déployé (build #52)

**Commits session 12** :

| Commit | Résumé |
|--------|--------|
| `9323a4c` | Feat(mobile): AuxiliaireHomeScreen câblé API + APK v1.2.7 swap |
| `533d804` | Feat(mobile/admin): AbonnementsAdmin + AdminDashboard API wiring |
| `4e0123f` | Chore: bump 1.2.8 → build #40 |
| `1f9db1b` | Feat(mobile/medecin): catalogue ordonnance chargé depuis EAN API (50 médicaments) |
| `39c63e3` | Chore: bump 1.2.9 → build #41 |
| `48d85b7` | Fix(mobile/admin): AbonnementsAdmin types alignés avec API (items vs abonnements) |
| `7a2ecc2` | Chore: bump 1.2.10 → build consolidé |
| `7bf6419` | Feat(mobile/admin): MedecinsAdminScreen câblé API + APK v1.2.10 swap |

**Écrans câblés sur API réelle** :
- `AuxiliaireHomeScreen` : consultations du jour depuis `GET /api/consultations/rdv?auxiliaire_id=&date=today`, pull-to-refresh fonctionnel, empty/loading states
- `AbonnementsAdminScreen` : chargé depuis `GET /api/admin/abonnements` — KPIs live (actifs, impayés, cotisations FC), type aligné sur réponse API `{items}`
- `AdminDashboardScreen` : 5 KPIs en parallel calls (`/api/admin/stats`, `/consultations`, `/revenus`, `/medecins`, `/pharmacie/ean/list`)
- `OrdonnanceDigitaleScreen` : catalogue médical depuis `GET /api/pharmacie/ean/list?limit=200`, affiche stock par médicament
- `MedecinsAdminScreen` : 60 médecins hardcodés → `GET /api/admin/medecins` — type aligné (id, nom complet, specialite, pays, ville, disponible, note ⭐, nb_consultations_via_sd)

---

### Session 13 — 2026-05-27 · nuit (autonome, suite session 12)
**Fix endpoints manquants + câblage screens restants**

**Commits session 13** :

| Commit | Résumé |
|--------|--------|
| `3a618cc` | Feat(mobile/admin): RapportsScreen + registration App.tsx (fix crash Rapports) |
| `bde3717` | Feat(mobile/centre): CentreDashboard + AdmissionScreen câblés API |
| `c6c81dd` | Feat(mobile/centre): PersonnelScreen câblé API |
| `fc3f11f` | Feat(mobile/centre): RefectoireScreen câblé API |
| `1a00171` | Fix(mobile/admin): PharmacieAdminScreen catalogue depuis EAN list (v1.2.12) |
| `e10f741` | Feat(api+mobile): pharmacie mouvements admin + ordonnances renouvelables |
| en cours | Fix(mobile): DashboardScreen appelle /rdv?patient_id (v1.2.13) |

**Écrans câblés session 13** :
- `RapportsScreen` (admin) : nouveau — charge `/api/admin/revenus`, `/api/admin/stats`, `/api/admin/consultations` en parallèle
- `CentreDashboardScreen` : câblé `GET /api/centres/{id}/stats` avec mapping USD→FC (×2800)
- `AdmissionScreen` : câblé GET + POST `/api/centres/{id}/admissions`
- `PersonnelScreen` : câblé `GET /api/centres/{id}/personnel`
- `RefectoireScreen` : câblé GET + POST `/api/centres/{id}/refectoire`
- `PharmacieAdminScreen` : catalogue depuis `GET /api/pharmacie/ean/list?limit=500` + entrée/sortie via `/api/centres/{id}/stock/entree|sortie`

**Endpoints API ajoutés session 13** :
- `GET /api/pharmacie/mouvements` — vue admin globale (sync, join EAN)
- `GET /api/consultations/ordonnances/renouvelables` — avec join User pour prenom/nom patient

---

### Session 14 — 2026-05-27 · après-midi (autonome, suite session 13)
**Fix critique ApiClient + admin.html live API + review complète**

**Commits session 14** :

| Commit | Résumé |
|--------|--------|
| `50552af` | Fix(mobile): PriseRDVScreen + TriageScreen — import `api` instance au lieu de la classe ApiClient |
| `b79727b` | Chore(mobile): bump version v1.2.13 → v1.2.14 — déclenche build APK CI |
| `c56f979` | Feat(web/admin): dashboard stats live depuis API + filtre impayés + export CSV |

**Bug critique corrigé session 14** :
- `ApiClient` (la classe) était importée et utilisée comme singleton statique dans
  `PriseRDVScreen` et `TriageScreen`. La classe n'est pas exportée → `undefined` →
  `TypeError: Cannot read property 'get' of undefined` au runtime.
  Fix : import de l'instance exportée `api` + `useAuth()` pour le token.

**Admin.html câblé session 14** :
- Dashboard KPI tiles câblés sur API réelle (`/api/admin/stats`, `/api/admin/consultations`,
  `/api/pharmacie/ean/list`, `/api/admin/revenus`, `/api/admin/abonnements`)
- Stat cards abonnements affichent compteurs réels (actifs / impayés / total)
- Barre filtre "Tous | Actifs | Impayés | Inactifs" sur la page abonnements
- Export CSV des abonnements (encodage UTF-8 avec BOM)
- Dashboard se charge automatiquement au démarrage

**Bilan review screens mobile session 14** :
- 29 screens utilisent l'API réelle (`api.get/post` avec token)
- 6 screens n'ont pas d'appels API (ProfileScreen, SuiviPatientScreen, TeleconsultationScreen,
  ConsultationEnCoursScreen, OrdonnanceDigitaleScreen sur données params, LoginScreen)
- Tous les screens ont un fallback gracieux vers données demo en cas d'erreur API

---

### Session 15 — 2026-05-27 · soir (autonome, suite session 14)
**TeleconsultationScreen salle d'attente + polling + décisions utilisateur**

#### Décisions utilisateur (à appliquer immédiatement)

| Décision | Détail |
|----------|--------|
| **Jitsi : serveur public** | Utiliser `meet.jit.si` pour toute la période de test (2 semaines). Aucune action code requise — le backend génère déjà des URLs `meet.jit.si`. |
| **Déploiement prod** | Cible : aujourd'hui même. Commande SSH : `cd "/var/www/santesd/SANTE DIRECT - KOLONGONO" && git pull && docker compose restart santesd-api` |
| **Niveau 2 en 2 semaines** | Les blocs 6-10 (Jitsi self-hosted, Firebase, Mobile Money, Offline, Tests) estimés 4-8 semaines → objectif : réalisés en 2 semaines maximum. |
| **Golden path** | Test complet quand l'app est déployée en production. Non bloquant maintenant. |
| **Firebase : étapes pour débloquer** | Voir section BLOC 7 ci-dessous. |

#### TeleconsultationScreen — réécriture complète

**Avant (session 14)** : WebView simple avec params `{ lien, role, nomSalle }`, aucun état d'attente, aucun polling.

**Après (session 15)** : Machine d'état à 3 phases.

```
Phase 'attente'   → polling GET /api/consultations/rdv/{rdv_id} toutes 10s
                  → statut 'en_cours'  → Phase 'en_cours'
                  → statut 'termine'   → Phase 'termine'
                  → bouton manuel "Rejoindre maintenant" → Phase 'en_cours'
Phase 'en_cours'  → WebView Jitsi (injectedJS masque boutons superflus)
Phase 'termine'   → Écran "Consultation terminée", bouton retour accueil
```

**Rétrocompatibilité** : accepte `{ lien, role, nomSalle }` (ancien flux) ET `{ rdv_id, url, medecin, role }` (nouveau flux PriseRDVScreen).
- `lienFinal = url ?? lien ?? ''`
- Si `rdv_id` absent → démarre directement en phase `'en_cours'` (ancien flux inchangé)

**Cleanup timer** : `clearInterval` dans `useEffect` cleanup + `terminerConsultation()` + `rejoindreQuandMeme()`.

**Commits session 15** :

| Commit | Résumé |
|--------|--------|
| `1934ccb` | feat(mobile): v1.2.15 — TeleconsultationScreen salle d'attente + polling statut RDV |
| `caa13ef` | docs: session 15 — salle d'attente polling, décisions Jitsi public, Firebase étapes [ci skip] |
| `370b92a` | fix(mobile/medecin): rejoindreVideo → TeleconsultationScreen in-app, role='medecin' |
| `b4a58a6` | fix(mobile/auxiliaire): rejoindreConsultation → TeleconsultationScreen in-app, role='auxiliaire' |
| `7c88e5b` | chore(apk): swap v1.2.14 → v1.2.15 (build #54 ✅) [ci skip] |
| `66edbfd` | chore(mobile): bump v1.2.16 — Jitsi in-app médecin+auxiliaire (build #55/56) |
| `88c2de3` | fix(api): livraisons depuis ordonnances DB réelles |
| `ade0f0b` | feat(web/centre): dashboard KPIs live depuis GET /api/centres/{id}/stats [ci skip] |
| `1f5946b` | feat(web/admin): pagination consultations 50/page [ci skip] |
| `c7c566c` | chore(apk): swap v1.2.15 → v1.2.16 (build #56 ✅) [ci skip] |
| `0ab060b` | fix(ci): Node.js 24 [ci skip] |
| `0f73df9` | feat(web/reseau): hero stats live [ci skip] |
| `928afc2` | feat(api): admin/stats → centres_partenaires [ci skip] |

**Build CI** :

| Run # | Version | Statut | Contenu |
|-------|---------|--------|---------|
| #54 | v1.2.15 | ✅ SUCCÈS | TeleconsultationScreen polling + salle d'attente |
| #55/#56 | v1.2.16 | ✅ SUCCÈS | Jitsi in-app médecin + auxiliaire |

---

### Session 16 — 2026-05-27 · nuit (autonome, suite session 15)
**Propagation Jitsi complète + bugs critiques corrigés + déploiement prod**

#### Contexte de reprise
Session 15 avait corrigé TeleconsultationScreen (polling) et ConsultationEnCoursScreen/SuiviPatientScreen
(navigation interne au lieu d'ouvrir le navigateur). Deux fichiers restaient non commités.

#### Travaux effectués

**1. Commits des fichiers en attente depuis session 15**

| Commit | Fichier | Fix |
|--------|---------|-----|
| `ea6abe5` | `MedecinDashboardScreen.tsx` | `lien_medecin?: string` dans le type + navPayload |
| `ea6abe5` | `AuxiliaireHomeScreen.tsx` | `lien_auxiliaire?: string` dans le type + navPayload |

**2. Déploiement backend production** (serveur 5.75.149.155)
- `git pull` — 34 fichiers mis à jour (2987 lignes de code ajoutées)
- `docker compose restart santesd-api` — API redémarrée ✅

**3. Bug critique découvert et corrigé : mapping API → state incomplet**
`AuxiliaireHomeScreen` effectuait un `.map(r => ({...}))` explicite sur la réponse API
mais omettait `lien_auxiliaire: r.lien_auxiliaire`. Le champ était dans le type et dans le navPayload
mais sa valeur était **toujours `undefined`** car jamais extrait de la réponse.

| Commit | Fix |
|--------|-----|
| `f424541` | `lien_auxiliaire: r.lien_auxiliaire` ajouté dans le map |

**4. Bug SuiviPatientScreen : `Linking` non importé**
L'import `Linking` manquait alors qu'il était utilisé sur le bouton "SAMU 15" → crash runtime.

| Commit | Fix |
|--------|-----|
| `ec94b27` | `Linking` ajouté à l'import react-native |

**5. APK v1.2.17 téléchargé et remplacé**
Build #57 terminé avec succès → APK téléchargé → `apk-release/SanteDirect-v1.2.16.apk` remplacé par `SanteDirect-v1.2.17.apk`.

#### Builds CI session 16

| Run # | Version | Commit | Statut | Contenu |
|-------|---------|--------|--------|---------|
| #57 | v1.2.17 | `a72eb60` | ✅ SUCCÈS | DashboardScreen rdv_id+url+medecin vers TeleconsultationScreen |
| #58 | — | `ea6abe5` | ✅ SUCCÈS | lien_medecin+lien_auxiliaire types + navPayload |
| #59 | v1.2.18 | `ec94b27` | ✅ SUCCÈS | Linking import fix + bump version |
| #60 | — | `f424541` | ✅ SUCCÈS | lien_auxiliaire mapping API → state |

**APK finale** : `apk-release/SanteDirect-v1.2.18.apk` (build #60, 54 MB)

#### État du flux de téléconsultation (après session 16)

```
[Patient]        PriseRDVScreen → Teleconsultation(rdv_id, url=lien_patient, role='patient')  ✅
[Patient]        DashboardScreen → Teleconsultation(rdv_id, url=lien_patient, role='patient')  ✅
[Médecin]        MedecinDashboard → ConsultationEnCours(consultation.lien_medecin)             ✅
[Médecin]        ConsultationEnCours.rejoindreVideo → Teleconsultation(url=lien_medecin)       ✅
[Auxiliaire]     AuxiliaireHome → SuiviPatient(consultation.lien_auxiliaire)                  ✅ (f424541)
[Auxiliaire]     SuiviPatient.rejoindreConsultation → Teleconsultation(url=lien_auxiliaire)    ✅
[TeleconsScreen] Phase 'attente' → polling GET /rdv/{rdv_id} toutes 10s                        ✅
[TeleconsScreen] statut 'en_cours' → WebView Jitsi meet.jit.si                                 ✅
[TeleconsScreen] statut 'termine' → écran fin + popToTop                                       ✅
```

---

#### Firebase FCM — Étapes complètes pour débloquer (BLOC 7)

Le code `api/routers/notifications.py` est **déjà écrit**. Il ne manque que la clé.

**Étape 1 — Créer un projet Firebase**
1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
2. Cliquer "Ajouter un projet" → nom : `SanteDirect-Kolongono`
3. Désactiver Google Analytics (inutile pour FCM)

**Étape 2 — Enregistrer l'app Android**
1. Dans le projet Firebase → Paramètres → "Ajouter une appli" → Android
2. Package name : `com.kolongono.santedirect` (voir `mobile/android/app/build.gradle`, ligne `applicationId`)
3. Télécharger `google-services.json`
4. Placer dans `mobile/android/app/google-services.json`

**Étape 3 — Obtenir la clé serveur**
1. Firebase Console → Paramètres du projet → Cloud Messaging
2. Deux options :
   - **Option A (Legacy — simple)** : "Clé du serveur" dans la section "API Cloud Messaging"
   - **Option B (FCM v1 — recommandée)** : Créer un compte de service → télécharger JSON → encoder en base64
3. Pour Option A : copier la clé (format `AAAA...`)

**Étape 4 — Configurer sur le serveur**
```bash
# SSH sur 5.75.149.155
cd "/var/www/santesd/SANTE DIRECT - KOLONGONO"
echo "FIREBASE_SERVER_KEY=AAAA..." >> .env
docker compose restart santesd-api
```

**Étape 5 — Ajouter au secret GitHub Actions**
- GitHub → Settings → Secrets → `FIREBASE_SERVER_KEY`
- Pour `google-services.json` : encoder en base64 → secret `GOOGLE_SERVICES_JSON` → décode dans le workflow CI

**Résultat** : les 4 notifications (RDV confirmé, rappel 30 min, ordonnance, rupture stock) seront actives.

---

## Plan de développement complet — tous blocs

### BLOC 1 — CI/CD : APK Android
*Statut : ✅ Build #44 SUCCÈS — APK v1.2.10 stable et distribué. Build #45 en cours (v1.2.11)*

- [x] Identifier cause racine compile (sessions 7-8)
- [x] Build #29 ✅ APK v1.2.2 (base)
- [x] Bug nom app → fix strings.xml
- [x] Bug écran rouge Metro → bundle JS embarqué
- [x] APK v1.2.3 (build #34) : `getUseDeveloperSupport()=false` → plus de crash Metro
- [x] APK v1.2.4 (build #35) : suppression push-notification (crash 1s après ouverture)
- [x] ErrorBoundary ajouté (erreurs JS visibles à l'écran)
- [x] Icône générée en CI en pure Python (stdlib struct+zlib, pas d'ImageMagick)
- [x] **APK v1.2.6 (build #38) ✅** — 54 Mo, arm64-v8a debug, stable
- [x] **APK v1.2.7 (build #39) ✅** — + MedecinDashboard API wiring
- [x] **APK v1.2.8 (build #40) ✅** — + AuxiliaireHomeScreen + admin screens câblés
- [x] **APK v1.2.10 (build #44) ✅** — + catalogue ordonnance EAN + fixes admin types
- [x] **APK v1.2.11 (builds #45-50) ✅** — + MedecinsAdminScreen, RapportsScreen, CentreDashboard, Admission, Personnel, Réfectoire câblés API
- [x] **APK v1.2.13 (builds #51-52) ✅** — + PharmacieAdmin EAN fix, mouvements admin endpoint, DashboardScreen RDV fix, ordonnances/renouvelables API
- [x] **APK v1.2.14 (build #53 ✅)** — fix ApiClient crash PriseRDV + Triage
- [x] **APK v1.2.15 (build #54 ✅)** — TeleconsultationScreen salle d'attente + polling
- [x] **APK v1.2.16 (build #56 ✅)** — Jitsi in-app médecin + auxiliaire (ConsultationEnCours + SuiviPatient)
- [ ] **Distribuer APK v1.2.16 aux testeurs terrain via WhatsApp**
- [ ] Test golden path : login → triage → RDV → signes vitaux → Jitsi → ordonnance → pharmacie (quand déployé)
- [ ] **DÉPLOIEMENT SERVEUR REQUIS** : SSH `cd "/var/www/santesd/SANTE DIRECT - KOLONGONO" && git pull && docker compose restart santesd-api` sur 5.75.149.155

---

### BLOC 2 — Infrastructure serveur
*Statut : ✅ Quasi-complet*

**2.1 nginx — domaine** ✅
- nginx.conf repo corrigé : `santedirect-kolongono.cd` → `santedirect.kolongono.org`
- Redirect HTTP→HTTPS ajouté via `/etc/nginx/conf.d/santesd.conf` sur le serveur
- Architecture réelle : `lx-caddy` gère HTTPS, `longonia-nginx` gère HTTP

**2.2 Import base médicaments** ✅
- 65 entrées (50 médicaments + 15 accessoires) — `{"created":15,"skipped":50}`

**2.3 CORS en production** ✅ (corrigé session 9)
- `allow_origins` maintenant restrictif : `santedirect.kolongono.org`, `longonia.org`, `localhost:3000/8080`

---

### BLOC 3 — API FastAPI : endpoints manquants (🟠 semaine 1-2)

**3.1 Consultation complète** ✅
- [x] `POST /api/consultations/reserver` : persist `RendezVous` en DB ✅
- [x] `POST /api/consultations/{id}/signes-vitaux` : persist `Diagnostic` en DB ✅
- [x] `POST /api/consultations/{id}/ordonnance` : persist `Ordonnance` en DB ✅
- [x] `POST /api/consultations/rdv/{id}/cloturer` : diagnostic + statut "termine" + ordonnance auto ✅ (router)
- [x] `GET /api/consultations/{id}` : statut + signes depuis DB ✅ (était stub)
- [x] `DELETE /api/consultations/rdv/{id}` : annulation RDV ✅ (router)

**3.2 Ordonnance numérique**
- [x] `POST /api/consultations/{id}/ordonnance` : table `Ordonnance` ✅
- [x] `GET /api/consultations/ordonnances?patient_id=` : historique ordonnances ✅
- [x] `GET /api/dossiers/{id}` : consultations + ordonnances réelles depuis DB ✅
- [ ] Lier automatiquement ordonnance à mouvement de stock pharmacie

**3.3 Abonnements → API réelle** ✅
- [x] `GET /api/abonnements/plans` : avec `prix_fc` (prix_usd × 2800) ✅
- [x] `POST /api/abonnements` : upsert `Abonnement` + `Cotisation` ✅
- [x] `GET /api/abonnements/{id}` : depuis DB + consultations restantes ✅
- [x] `GET /api/adherents/{id}` : User + Abonnement depuis DB ✅
- [ ] `POST /api/cotisations/payer` : endpoint dédié cotisation mensuelle

**3.2 Ordonnance → stock** ✅
- [x] Lier ordonnance → mouvement de stock via `_debit_stock_ordonnance` background task ✅
  (name-match MedicamentEAN, MouvementStock sortie, best-effort)

**3.4 Endpoints admin** ✅
- [x] `GET /api/admin/users` : liste paginée avec filtres role/actif ✅
- [x] `GET /api/admin/stats` : agrégats par rôle ✅
- [x] `GET /api/admin/consultations` : RendezVous paginé + patient_nom/medecin_nom enrichis ✅
- [x] `GET /api/admin/revenus` : RevenuCentre + DepenseCentre + cotisations ✅
- [x] `GET /api/admin/medecins` : 50+ partenaires + stats consultations SD ✅
- [x] `GET /api/admin/abonnements` : User ⨝ Abonnement, filtres plan/statut ✅

**3.5 Refresh token JWT**
- [x] `POST /api/auth/refresh` : nouveau JWT pour utilisateur actif ✅
- [x] Mobile : intercepteur dans `components/api.ts` — si 401 → refresh → retry ✅

---

### BLOC 4 — Dashboard admin web (🟠 semaine 1-2)

**4.1 Section Adhérents → API réelle** ✅
- [x] `loadAdherents()` via `GET /api/admin/users?role=adherent` ✅
- [ ] Filtre "impayés" côté serveur, pagination, export CSV

**4.2 Section Consultations → API réelle** ✅
- [x] `loadConsultations()` via `GET /api/admin/consultations` ✅
- [x] patient_nom + medecin_nom + motif affichés (API enrichie session 11) ✅
- [ ] Polling 30s, bouton "clôturer"

**4.3 Section Abonnements → API réelle** ✅
- [x] `loadAbonnements()` via `GET /api/admin/abonnements` (endpoint dédié session 11) ✅
- [ ] Afficher nb_mois_impaye, boutons relance SMS

**4.4 Section Revenus → API réelle** ✅
- [x] `loadRevenus()` via `GET /api/admin/revenus` + `revenus-summary` div ✅
- [ ] Tableau détaillé par catégorie, export PDF

**4.5 Statut services** ✅
- [x] Chips topbar : pings réels `/api/status` + `/api/longonia/verify-adherent/test-ping` ✅ (session 10)

**4.6 Pages médecin/auxiliaire/adhérent** ✅
- [x] `medecin.html renderMedRDV()` : API réelle, filtre par date ✅
- [x] `auxiliaire.html renderRDVPage()` : API réelle, buckets aujourd'hui/demain/semaine ✅
- [x] `adherent.html` : dossier + ordonnances + abonnement depuis API ✅

---

### BLOC 5 — Mobile React Native : câblage API (🟠 semaine 2)

**5.1 `ConsultationScreen.tsx`** ✅
- [x] Câblé sur `POST /api/consultations/demande` (router consultations.py) ✅
- [x] Câblé sur `GET /api/consultations/demandes/mes` (router consultations.py) ✅

**5.2 `AbonnementScreen.tsx`** ✅
- [x] `GET /api/abonnements/plans` (avec `prix_fc` ajouté) ✅
- [x] `GET /api/abonnements/{id}` (depuis DB) ✅
- [x] `POST /api/abonnements` (persist + Cotisation) ✅

**5.3 MedecinDashboardScreen** ✅
- [x] `MedecinDashboardScreen` : câblé `GET /api/consultations/rdv?medecin_id=&date=today` ✅
- [x] Compteurs réels (à venir / terminées / total), useFocusEffect ✅

**5.6 AuxiliaireHomeScreen** ✅
- [x] Consultations du jour : `GET /api/consultations/rdv?auxiliaire_id=&date=today` ✅
- [x] Demandes + consultations en parallel, pull-to-refresh, empty/loading states ✅

**5.7 AdminDashboardScreen** ✅
- [x] KPIs live : adherents_actifs, total consultations, cotisations FC, médecins, stock SKU ✅
- [x] 5 appels parallèles depuis `/api/admin/stats`, `/consultations`, `/revenus`, `/medecins`, `/pharmacie/ean/list` ✅

**5.8 AbonnementsAdminScreen** ✅
- [x] `GET /api/admin/abonnements` → items, KPIs live, filtre statut ✅

**5.9 OrdonnanceDigitaleScreen** ✅
- [x] Catalogue médical depuis `GET /api/pharmacie/ean/list?limit=200` (50 médicaments) ✅
- [x] Affiche stock par médicament ("Rupture" si stock=0) ✅
- [x] Fallback sur 12 médicaments statiques si API indisponible ✅

**5.4 Refresh token** ✅
- [x] Intercepteur dans `api.ts` : si 401 → POST /api/auth/refresh → retry ✅
- [x] `AuthContext` enregistre callbacks onTokenRefreshed + onLogout ✅

**5.5 Polling statut consultation** ✅
- [x] `TeleconsultationScreen.tsx` : salle d'attente + polling `GET /api/consultations/rdv/{rdv_id}` toutes les 10s → transition auto en_cours/termine (session 15) ✅

---

### BLOC 6 — Téléconsultation Jitsi Meet (🟡 semaine 2-3)

**Décision utilisateur (2026-05-27)** : Utiliser `meet.jit.si` (serveur public gratuit) pour toute la période de test (2 semaines). Pas d'action code requise — le backend génère déjà des URLs `meet.jit.si`. Migration vers serveur dédié après validation terrain.

**6.1 Phase test (maintenant → J+14)** ✅ ACTIF
- [x] Backend génère URL `meet.jit.si/{room_id}` par consultation ✅
- [x] `TeleconsultationScreen.tsx` charge l'URL dans WebView ✅
- Limitation : rooms publiques, pas de JWT, pas de contrôle utilisateurs

**6.2 Phase production (après J+14) — Provisionner 3e CX22 Hetzner** (~4 EUR/mois)
Installer Docker + Jitsi Meet self-hosted, sous-domaine `jitsi.kolongono.org`.

**6.3 Intégrer URL dédiée dans l'app mobile**
`TeleconsultationScreen.tsx` : URL `https://jitsi.kolongono.org/consultation-{rdv_id}`.

**6.4 Sécuriser les rooms**
API génère un JWT Jitsi par consultation, room expire après 2h.

---

### BLOC 7 — Notifications push Firebase (🟡 semaine 1-2, débloqué dès que clé obtenue)

**Statut : `notifications.py` déjà codé. BLOQUÉ uniquement sur la clé FIREBASE_SERVER_KEY.**
**→ Voir "Firebase FCM — Étapes complètes" dans Session 15 ci-dessus.**

**7.1 Configurer Firebase FCM** (action utilisateur requise)
- [ ] Créer projet Firebase sur console.firebase.google.com
- [ ] Enregistrer app Android avec package `com.kolongono.santedirect`
- [ ] Télécharger `google-services.json` → placer dans `mobile/android/app/`
- [ ] Obtenir clé serveur FCM → ajouter dans `.env` serveur (`FIREBASE_SERVER_KEY=...`)
- [ ] Ajouter `FIREBASE_SERVER_KEY` et `GOOGLE_SERVICES_JSON` aux secrets GitHub Actions

**7.2 Enregistrement device token** (Claude Code — 30 min)
Au login mobile : enregistrer FCM token via `POST /api/utilisateurs/{id}/fcm-token`.

**7.3 Déclenchements** (déjà codés dans `notifications.py`)
- RDV confirmé → notif patient
- RDV dans 30 min → rappel patient + médecin
- Ordonnance disponible → notif patient
- Rupture de stock → notif admin

---

### BLOC 8 — Mobile Money (🟡 semaine 4-6)

**8.1 M-Pesa RDC (Vodacom)**
`POST /api/paiements/mpesa/initier` → push USSD → callback Vodacom → créditer `SoldePatient`.

**8.2 Orange Money RDC**
`POST /api/paiements/orange/initier` — même logique.

**8.3 Écran de paiement mobile**
Nouveau screen `PaiementScreen.tsx` : choisir opérateur → numéro → confirmer → attendre callback.

---

### BLOC 9 — Mode offline partiel (🟡 semaine 4-6)

**9.1 SQLite local**
Stocker localement : liste médicaments EAN, dossier patient, ordonnances récentes.
Sync au retour de réseau via `POST /api/sync`.

**9.2 Queue mouvements de stock offline**
Si pas de réseau pendant scan EAN → queue locale → sync automatique dès reconnexion.

---

### BLOC 10 — Tests & Qualité (🟢 en continu)

**10.1 Tests API (pytest)**
Auth, scanner EAN, consultation, ordonnance.

**10.2 Tests mobile (Jest)**
Écrans critiques : Login, Scanner, Formulaire stock.

**10.3 Monitoring serveur**
- Logs structurés FastAPI → fichier rotatif
- Alerte si API down > 5 min
- Alerte rupture de stock automatique

---

## Tableau de synthèse — priorisation

| Bloc | Effort restant | Priorité | Statut |
|------|----------------|----------|--------|
| **1 — APK CI/CD** | Confirmer build #36 | 🟠 Immédiat | 🔄 Build #36 en cours — v1.2.5 crash fix + icône |
| **2 — Infrastructure** | Déployer API | ✅ Complet | ✅ Complet — CORS, nginx, médicaments |
| **3 — API FastAPI** | Refresh mobile + stock | 🟠 Semaine 1 | ✅ ~95% — endpoints complets |
| **4 — Admin web** | Détails + polling | 🟠 Semaine 1 | 🔄 ~85% — médecins câblés, détails restants |
| **5 — Mobile câblage** | Refresh token | 🟠 Semaine 1 | ✅ ~90% — intercepteur refresh manquant |
| **6 — Jitsi Meet** | 1-2 jours | 🟡 Semaine 2-3 | ⏳ Code présent, serveur manquant |
| **7 — Firebase** | 1 jour | 🟡 Semaine 3 | ⏳ Code présent, clé manquante |
| **8 — Mobile Money** | 1-2 semaines | 🟡 Semaine 4-6 | ❌ Non démarré |
| **9 — Mode offline** | 1-2 semaines | 🟡 Semaine 4-6 | ❌ Non démarré |
| **10 — Tests** | En continu | 🟢 Permanent | ❌ 0 test écrit |

**MVP testable terrain estimé : 1 semaine** (APK distribué + Blocs 3-5 finalisés + Jitsi).

---

## État actuel du projet — 2026-05-27 · nuit (session 10)

### Infrastructure
| Composant | État | Détail |
|-----------|------|--------|
| Serveur | ✅ | Hetzner CX23 — `5.75.149.155` |
| Docker (santesd-api, longonia-nginx, lx-caddy) | ✅ | Tous up |
| Base de données | ✅ | PostgreSQL, DB `santesd` |
| API FastAPI | ✅ | `https://santedirect.kolongono.org/api/status` → 200 |
| DNS / Domaine | ✅ | `santedirect.kolongono.org` (Cloudflare) |
| Bridge Longonia | ✅ | API key configurée |
| HTTP → HTTPS redirect | ✅ | `conf.d/santesd.conf` dans longonia-nginx |
| Import médicaments | ✅ | 65 entrées en base |
| CORS | ✅ | Restrictif : `santedirect.kolongono.org` + `longonia.org` |

### Application mobile — React Native 0.73
| Fonctionnalité | État | Notes |
|----------------|------|-------|
| Navigation multi-rôles | ✅ | adhérent / auxiliaire / médecin / admin / superadmin |
| Scanner EAN/QR — Auxiliaire | ✅ | `AuxiliaireHomeScreen` |
| Scanner EAN/QR — Admin local | ✅ | `CentreDashboardScreen` |
| Scanner EAN/QR — Superadmin | ✅ | `PharmacieAdminScreen` |
| Lookup EAN → API | ✅ | `/api/pharmacie/ean/{code}` |
| Formulaire mouvement de stock | ✅ | `FormulaireStockScreen` |
| **APK Build** | 🔄 | **Build #36 en cours** — APK v1.2.5 (crash fix + icône) |
| Nom affiché sur téléphone | ✅ | "SantéDirect" via strings.xml fix |
| Bundle JS autonome | ✅ | `index.android.bundle` embarqué — plus d'écran rouge Metro |
| Crash 1s après ouverture | ✅ | push-notification supprimé + ErrorBoundary |
| ConsultationScreen → API | ✅ | `/api/consultations/demande` + `/api/consultations/demandes/mes` |
| AbonnementScreen → API | ✅ | `/api/abonnements/{id}` + plans + souscription → DB |
| Icône de l'app | 🔄 | Générée en CI (croix médicale sombre) — build #36 |
| Téléconsultation Jitsi | ⏳ | Code présent, CX23 dédié non provisionné |
| Triage IA (Claude API) | ⏳ | Code présent, clé API à valider |
| Notifications push Firebase | ⏳ | Code présent, clé API manquante |

### Dashboard admin web (admin.html)
| Fonctionnalité | État | Notes |
|----------------|------|-------|
| KPIs pharmacie + drill-down | ✅ | Câblé API réelle |
| Table médicaments + recherche | ✅ | 100/page, filtre texte |
| Fiche produit éditable | ✅ | EAN, prix, prescription |
| Générateur étiquettes ELA034 | ✅ | Code128 / EAN-13 / QR — A4 24/feuille |
| KPIs feuille de route cliquables | ✅ | Drill-down 4 filtres |
| **Adhérents** | ✅ | `loadAdherents()` → `/api/admin/users?role=adherent` |
| **Consultations** | ✅ | `loadConsultations()` → `/api/admin/consultations` |
| **Abonnements** | ✅ | `loadAbonnements()` → `/api/admin/users?role=adherent` |
| **Revenus** | ✅ | `loadRevenus()` → `/api/admin/revenus` (KPIs live) |
| **Statut Longonia/Jitsi** | ❌ | Chips "ok"/"live" statiques |

---

## Règles non négociables (figées)

| Règle | Valeur |
|-------|--------|
| Langue | Français exclusivement |
| Icônes | SVG stroke uniquement — jamais d'emojis dans le code |
| Vidéo | Jitsi Meet self-hosted — jamais Daily.co |
| Stack | FastAPI port 8002 + React Native 0.73 |
| Paiements | Mobile Money uniquement (M-Pesa, Orange) — jamais Stripe |
| Devise | USD pour médecins/admin · FC pour les patients |
| Rémunération médecins | Salaire mensuel fixe 200-450 USD — jamais à la consultation |
| Builds Android | GitHub Actions uniquement — jamais Android Studio local |

---

## Journal des commits (du plus récent au plus ancien)

| Date/Heure (UTC+2) | Commit | Build | Résumé |
|--------------------|--------|-------|--------|
| 27/05 matin | `6b51ccd` | #30 🔄 | Fix(apk) : bundle JS embarqué + app name SantéDirect |
| 26/05 17h10 | `ac34124` | — | Fix(nginx) : domaine santedirect-kolongono.cd → santedirect.kolongono.org |
| 26/05 17h00 | `5891d6f` | — | Docs : session 8 + APK réussi [ci skip] |
| 26/05 15h39 | `e6e4a82` | #29 ✅ | Fix(ci) : YAML + downgrade screens@3.29.0/gesture-handler@2.14.0 |
| 26/05 15h35 | `81e535a` | #28 ❌ | Fix(ci) : rétrograder libs — YAML invalide (workflow file issue) |
| 26/05 15h10 | `c2bc6af` | — | Docs : feuille de route sessions 1-7 [ci skip] |
| 26/05 15h08 | `7820fe8` | #26-27 ❌ | Fix(ci) : resolutionStrategy.force react-android:0.73.6 — régression |
| 26/05 15h04 | `ec127b1` | #25 ❌ | Fix(ci) : settings.gradle pluginManagement — plugin inexistant en RN 0.73 |
| 26/05 13h30 | `1a50b1b` | — | Revert workflow vers c59d290 |
| 26/05 07h36 | `c59d290` | #21 ❌ | Fix(ci) : allprojects repos + RN 0.73.6 |
| 26/05 06h47 | `f30b4a8` | #17-20 ❌ | Fix(ci) : ReactAndroid composite build |
| 26/05 06h20 | `96822d1` | #16 ❌ | Fix(ci) : injection directe react-android.aar |
| 26/05 06h06 | `5b1787a` | #13 ❌ | Fix(ci) : patch settings |
| 26/05 05h43 | `44b53a3` | #10-12 ❌ | Fix(ci) : réécrire settings.gradle DRM |
| 26/05 05h38 | `38b9f46` | #9 ❌ | Fix(ci) : allprojects repos |
| 26/05 05h32 | `0788b56` | #8 ❌ | Fix(ci) : step4 Python pur + diagnostic AARs |
| 26/05 05h27 | `8f25e21` | #7 ❌ | Fix(ci) : capture erreurs Kotlin |
| 26/05 05h18 | `37384bd` | #6 ❌ | Fix(ci) : kotlin 1.9.25 |
| 26/05 04h59 | `c600788` | #4-5 ❌ | Chore : bump version |
| 26/05 04h45 | `72234d8` | #3 ❌ | Fix(ci) : remplace sed par Python |
| 26/05 04h07 | `7013bcf` | — | Fix(ci) : npm install + local.properties |
| 26/05 03h59 | `6b0964a` | #2 ❌ | Feat : scanner pharmacie admin + étiquettes ELA034 |
| 26/05 01h29 | `70a4ac` | #1 ❌ | CI : GitHub Actions workflow APK (première version) |
| 26/05 00h20 | `ccb8f38` | — | Feat : drill-down KPIs + fiche produit éditable |
| 25/05 23h41 | `111484` | — | Feat : câble scanner pharmacie EAN pour auxiliaire |
| 25/05 23h00 | `e642ca3` | — | Feat : drill-down 4 KPIs Pharmacie |
| 25/05 22h55 | `c29558e` | — | Feat : 15 accessoires médicaux |
| 25/05 22h29 | `8a23b81` | — | Fix : déplacer GET /ean/list avant GET /ean/{code} |
| 25/05 22h24 | `775609b` | — | Feat : endpoints admin /users et /stats |
| 25/05 22h00 | `886097` | — | Fix : fusion showPage — suppression boucle infinie |
| 25/05 21h53 | `2fbe6fb` | — | Feat : inventaire pharmacie branché sur API réelle |
| 25/05 21h17 | `b88d0a7` | — | Feat : auth guard toutes pages + login JWT |
| 25/05 20h38 | `337c3c3` | — | Fix : interface web à la racine /, route /api/status |
| 25/05 20h37 | `e9f86cc` | — | Fix : monter web/ en volume dans le conteneur |
| 25/05 20h26 | `654d78e` | — | URL prod mobile, interface web via StaticFiles |
| 25/05 13h59 | `f17d7dc` | — | Alembic migration — schéma complet |
| 25/05 13h22 | `0fab7bd` | — | **Initial commit** — SantéDirect Kolongono (~33 fichiers) |
| 26/05 13h00 | `1c31dd5` | Fix(ci) : diagnostic AARs + DRM |
| 26/05 07h37 | `5826fe0` | Docs : feuille de route session 6 |
| 26/05 07h36 | `c59d290` | Fix(ci) : allprojects repos + RN 0.73.6 |
| 26/05 06h47 | `f30b4a8` | Fix(ci) : ReactAndroid composite build |
| 26/05 06h20 | `96822d1` | Fix(ci) : injection directe react-android.aar |
| 26/05 06h12 | `7038de5` | Fix(ci) : supprimer step 4e |
| 26/05 06h06 | `5b1787a` | Fix(ci) : patch settings.gradle |
| 26/05 05h43 | `44b53a3` | Fix(ci) : réécrire settings.gradle DRM |
| 26/05 05h38 | `38b9f46` | Fix(ci) : allprojects repos |
| 26/05 05h32 | `0788b56` | Fix(ci) : step4 Python pur + diagnostic AARs |
| 26/05 05h27 | `8f25e21` | Fix(ci) : capture erreurs Kotlin |
| 26/05 05h18 | `37384bd` | Fix(ci) : kotlin 1.9.25 |
| 26/05 05h17 | `0a701d3` | Docs : feuille de route session 5 |
| 26/05 04h59 | `c600788` | Chore : bump version 1.0.1→1.0.2 |
| 26/05 04h56 | `3a7bac7` | Fix(ci) : heredoc shell build.gradle |
| 26/05 04h28 | `fc4beeb` | Fix(admin) : drill-down feuille de route 4 filtres |
| 26/05 04h15 | `3deabc3` | Fix(ci) : AGP 8.1→8.6 + Gradle 8.3→8.7 |
| 26/05 04h07 | `7013bcf` | Fix(ci) : npm install + local.properties |
| 26/05 04h05 | `0b2b1d0` | Docs : créer FEUILLE_DE_ROUTE.md |
| 26/05 03h59 | `6b0964a` | Feat : scanner admin + étiquettes ELA034 + workflow APK |
| 26/05 01h29 | `70a4ac` | CI : GitHub Actions workflow APK (v1) |
| 25/05 23h41 | `111484` | Feat : câble scanner pharmacie auxiliaire |
| 25/05 23h00 | `e642ca3` | Feat : drill-down 4 KPIs Pharmacie |
| 25/05 22h55 | `c29558e` | Feat : 15 accessoires médicaux |
| 25/05 22h29 | `8a23b81` | Fix : collision routes FastAPI |
| 25/05 22h24 | `775609b` | Feat : endpoints admin /users et /stats |
| 25/05 22h00 | `886097` | Fix : boucle infinie showPage |
| 25/05 21h53 | `2fbe6fb` | Feat : inventaire pharmacie → API réelle |
| 25/05 21h17 | `b88d0a7` | Feat : auth guard JWT |
| 25/05 20h38 | `337c3c3` | Fix : interface web racine + route /api/status |
| 25/05 20h37 | `e9f86cc` | Fix : monter web/ en volume Docker |
| 25/05 20h26 | `654d78e` | Feat : URL prod mobile + StaticFiles |
| 25/05 13h59 | `f17d7dc` | Feat : Alembic migration schéma complet |
| 25/05 13h22 | `0fab7bd` | **Initial commit** — SantéDirect Kolongono |

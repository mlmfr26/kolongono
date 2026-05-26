# Feuille de route — SantéDirect Kolongono

> Mise à jour à chaque session par Claude Code.
> Toutes les heures en UTC+2 (heure de Kinshasa).

---

## Dernière mise à jour

**2026-05-27 · matin (UTC+2) · Session 9**
Modèle : Claude Sonnet 4.6 — Branche : `main` — Dernier commit : `6b51ccd`
**Build #30 en cours** — Fix bundle JS + app name. APK #29 testait sur device → 2 bugs corrigés.

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

### Session 9 — 2026-05-27 · matin (durée en cours)
**Test APK sur device — 2 bugs trouvés et corrigés — Build #30**

**Bugs trouvés lors du premier test sur smartphone (APK #29)** :

**Bug 1 — Nom de l'app affiché : "Hello App Display..."**
- Cause : le template React Native génère `strings.xml` avec `app_name = HelloWorld` (ou variante). On corrigeait le package name mais pas le label affiché.
- Fix : `sed -i 's|<string name="app_name">...|<string name="app_name">SantéDirect</string>|' strings.xml` ajouté au step 3 du workflow.

**Bug 2 — Écran rouge : "Unable to load script. Make sure you're running Metro..."**
- Cause : un APK debug React Native cherche par défaut le bundle JS sur un serveur Metro (port 8081) au lieu de l'embarquer. Sans Metro sur le réseau local, l'app crashe immédiatement.
- Fix : step 7.5 ajouté dans le workflow — exécute `npx react-native bundle` avant Gradle pour embarquer `index.android.bundle` dans les assets de l'APK.

```yaml
# Step 7.5 ajouté
- name: Bundle JS into APK assets
  working-directory: mobile
  run: |
    mkdir -p android/app/src/main/assets
    npx react-native bundle \
      --platform android --dev false \
      --entry-file index.js \
      --bundle-output android/app/src/main/assets/index.android.bundle \
      --assets-dest android/app/src/main/res/
```

**Note sur la méthode de test** : la méthode professionnelle serait `npx react-native run-android` via USB (mode développeur). Non utilisée ici faute d'environnement Android Studio local. Investissement matériel prévu prochainement.

**Build #30** (commit `6b51ccd`) — en cours au moment de cette mise à jour.

Commits session 9 :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 27/05 matin | `6b51ccd` | Fix(apk) : bundle JS embarqué + app name SantéDirect |

---

## Plan de développement complet — tous blocs

### BLOC 1 — CI/CD : APK Android
*Statut : 🔄 Build #30 en cours — corrections bugs device*

- [x] Identifier cause racine compile (sessions 7-8)
- [x] Build #29 réussi (6m41s) — artifact `SanteDirect-debug-arm64-29`
- [x] APK #29 testé sur device → 2 bugs identifiés
- [x] Bug nom app "Hello App..." → fix strings.xml (commit `6b51ccd`)
- [x] Bug écran rouge Metro → fix bundle JS embarqué (commit `6b51ccd`)
- [ ] **Build #30 réussit → APK fonctionnel à distribuer**
- [ ] Distribuer aux testeurs terrain via WhatsApp
- [ ] Test golden path : login → scan EAN → mouvement stock → vérif admin.html
- [ ] Icône de l'app (actuellement icône React Native par défaut)

---

### BLOC 2 — Infrastructure serveur
*Statut : ✅ Quasi-complet*

**2.1 nginx — domaine** ✅
- nginx.conf repo corrigé : `santedirect-kolongono.cd` → `santedirect.kolongono.org`
- Redirect HTTP→HTTPS ajouté via `/etc/nginx/conf.d/santesd.conf` sur le serveur
- Architecture réelle : `lx-caddy` gère HTTPS, `longonia-nginx` gère HTTP

**2.2 Import base médicaments** ✅
- 65 entrées (50 médicaments + 15 accessoires) — `{"created":15,"skipped":50}`

**2.3 CORS en production** ❌ (à faire)
- `api/main.py` : `allow_origins=["*"]` → `["https://santedirect.kolongono.org", "https://longonia.org"]`
- Impact : actuellement toute origine est acceptée — risque sécurité mineur en phase de test

---

### BLOC 3 — API FastAPI : endpoints manquants (🟠 semaine 1-2)

**3.1 Consultation complète**
- `POST /api/consultations/reserver` : écrire en table `RendezVous` (actuellement demo)
- `POST /api/consultations/{id}/signes-vitaux` : enregistrer en base (TODO ligne ~356 main.py)
- `POST /api/consultations/{id}/rapport` : clôturer + générer ordonnance
- `GET /api/consultations/{id}/statut` : polling mobile
- `DELETE /api/consultations/{id}` : annulation RDV

**3.2 Ordonnance numérique**
- `POST /api/consultations/{id}/ordonnance` : créer table `Ordonnance` (TODO ligne ~382 main.py)
- Lier automatiquement à mouvement de stock si médicament disponible
- `GET /api/adherents/{id}/ordonnances` : historique dossier patient

**3.3 Abonnements → API réelle**
- `GET /api/abonnements/plans` : retourner les 4 plans depuis DB (pas hardcodé)
- `POST /api/abonnements/souscrire` : créer `Abonnement` en base
- `GET /api/adherents/{id}/abonnement` : état abonnement actuel
- `POST /api/cotisations/payer` : enregistrer paiement → `Cotisation`

**3.4 Endpoints admin**
- `GET /api/admin/adherents` : liste paginée + filtres (statut, centre, impayés)
- `GET /api/admin/consultations` : toutes consultations filtrables
- `GET /api/admin/revenus` : agrégats mensuels depuis `RevenuCentre` + `Cotisation`
- `GET /api/admin/medecins` : liste médecins + stats (consultations/mois)

**3.5 Refresh token JWT**
- `POST /api/auth/refresh` : nouveau token si l'ancien expire dans < 24h
- Mobile : intercepteur dans `components/api.ts` pour refresh automatique

---

### BLOC 4 — Dashboard admin web (🟠 semaine 1-2)

**4.1 Section Adhérents → API réelle**
Remplacer tableau statique `[{ id: "ADH-001"... }]` par `fetch('/api/admin/adherents')`.
Ajouter : filtre "impayés", pagination côté serveur, export CSV.

**4.2 Section Consultations → API réelle**
Remplacer mock par `fetch('/api/admin/consultations?date=today')`.
Ajouter : polling 30s pour consultations en cours, bouton "clôturer".

**4.3 Section Abonnements → API réelle**
Remplacer barres statiques par `fetch('/api/admin/stats/abonnements')`.

**4.4 Section Revenus → API réelle**
Remplacer `$400 USD / mois` par `fetch('/api/admin/revenus?mois=2026-05')`.

**4.5 Statut services**
Remplacer chips "ok"/"live" statiques par pings réels (Longonia, Jitsi).

---

### BLOC 5 — Mobile React Native : câblage API (🟠 semaine 2)

**5.1 `ConsultationScreen.tsx`**
Câbler `POST /api/consultations/reserver` — actuellement prend un RDV sans appel API.

**5.2 `AbonnementScreen.tsx`**
Câbler `GET /api/abonnements/plans` + `POST /api/abonnements/souscrire`.

**5.3 Polling statut consultation**
`TeleconsultationScreen.tsx` : polling `GET /api/consultations/{id}/statut` toutes les 10s.

**5.4 Refresh token**
Intercepteur dans `api.ts` : si 401, tenter refresh avant de déconnecter.

---

### BLOC 6 — Téléconsultation Jitsi Meet (🟡 semaine 2-3)

**6.1 Provisionner 3e CX23 Hetzner** (~5 EUR/mois)
Installer Docker + Jitsi Meet self-hosted, sous-domaine `jitsi.kolongono.org`.

**6.2 Intégrer dans l'app mobile**
`TeleconsultationScreen.tsx` : URL `https://jitsi.kolongono.org/consultation-{rdv_id}`.

**6.3 Sécuriser les rooms**
API génère un JWT Jitsi par consultation, room expire après 2h.

---

### BLOC 7 — Notifications push Firebase (🟡 semaine 3)

**7.1 Configurer Firebase FCM**
- Créer projet Firebase, obtenir `FIREBASE_SERVER_KEY`
- Ajouter dans `.env` serveur + secret GitHub Actions
- `notifications.py` est déjà codé — il faut seulement la clé

**7.2 Enregistrement device token**
Au login mobile : enregistrer FCM token via `POST /api/utilisateurs/{id}/fcm-token`.

**7.3 Déclenchements**
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
| **1 — APK CI/CD** | ~1h (build #30) | 🔴 Immédiat | 🔄 Build #30 en cours |
| **2 — Infrastructure** | 30min (CORS) | 🔴 Immédiat | ✅ 90% — CORS seul restant |
| **3 — API FastAPI** | 3-5 jours | 🟠 Semaine 1-2 | ❌ ~50% endpoints demo |
| **4 — Admin web** | 2-3 jours | 🟠 Semaine 1-2 | ❌ 4 sections statiques |
| **5 — Mobile câblage** | 2-3 jours | 🟠 Semaine 2 | ❌ 2 screens non câblés |
| **6 — Jitsi Meet** | 1-2 jours | 🟡 Semaine 2-3 | ⏳ Code présent, serveur manquant |
| **7 — Firebase** | 1 jour | 🟡 Semaine 3 | ⏳ Code présent, clé manquante |
| **8 — Mobile Money** | 1-2 semaines | 🟡 Semaine 4-6 | ❌ Non démarré |
| **9 — Mode offline** | 1-2 semaines | 🟡 Semaine 4-6 | ❌ Non démarré |
| **10 — Tests** | En continu | 🟢 Permanent | ❌ 0 test écrit |

**MVP testable terrain estimé : 2-3 semaines** (APK fonctionnel + Blocs 3-5).

---

## État actuel du projet — 2026-05-27 · matin

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
| CORS | ❌ | `allow_origins=["*"]` — à restreindre |

### Application mobile — React Native 0.73
| Fonctionnalité | État | Notes |
|----------------|------|-------|
| Navigation multi-rôles | ✅ | adhérent / auxiliaire / médecin / admin / superadmin |
| Scanner EAN/QR — Auxiliaire | ✅ | `AuxiliaireHomeScreen` |
| Scanner EAN/QR — Admin local | ✅ | `CentreDashboardScreen` |
| Scanner EAN/QR — Superadmin | ✅ | `PharmacieAdminScreen` |
| Lookup EAN → API | ✅ | `/api/pharmacie/ean/{code}` |
| Formulaire mouvement de stock | ✅ | `FormulaireStockScreen` |
| **APK Build** | 🔄 | **Build #30 en cours** — bundle JS + app name fixés |
| Nom affiché sur téléphone | 🔄 | Était "Hello App..." → corrigé en "SantéDirect" (build #30) |
| Bundle JS autonome | 🔄 | Écran rouge Metro corrigé (build #30) |
| Icône de l'app | ❌ | Icône React Native par défaut |
| ConsultationScreen → API | ❌ | Écran présent, pas d'appel API réel |
| AbonnementScreen → API | ❌ | Données hardcodées |
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
| **Adhérents** | ❌ | Données statiques JS |
| **Consultations** | ❌ | Données mock |
| **Abonnements** | ❌ | Barres hardcodées |
| **Revenus** | ❌ | `$400 USD / mois` statique |
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

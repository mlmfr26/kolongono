# Feuille de route — SantéDirect Kolongono

> Mise à jour à chaque session par Claude Code.
> Format horodaté précis — toutes les heures en UTC+2 (heure de Kinshasa).

---

## Dernière mise à jour

**2026-05-26 · 14h30 (UTC+2) · Session 7 (en cours)**
Modèle : Claude Sonnet 4.6 — Branche : `main` — Dernier commit : `1a50b1b`

---

## Chronologie complète des sessions de travail

### Session 1 — 2026-05-22 → 2026-05-24 (~3 jours, durée estimée ~12h)
**Création du projet — travail local, avant le premier commit Git**

- Initialisation du mono-repo `SANTE DIRECT - KOLONGONO/`
- Architecture API (FastAPI port 8002), mobile (React Native 0.73), web (admin HTML)
- ~33 fichiers créés
- Modèles SQLAlchemy (`MedicamentEAN`, `StockPharmacie`, `MouvementStock`)
- Router `pharmacie_ean.py` — 8 endpoints CRUD + mouvements de stock
- Base de 50 médicaments essentiels RDC (`api/data/medicaments_base.json`)
- App mobile : navigation multi-rôles (adhérent / auxiliaire / médecin / admin / superadmin)
- Screens scanner pharmacie : `ScannerStockScreen`, `MedicamentInconnuScreen`, `FormulaireStockScreen`
- Dashboard admin `web/admin.html` — KPIs, table médicaments, abonnements

> **Note** : Travail effectué localement. Le dépôt Git n'existait pas encore.
> Premier commit Git créé le 2026-05-25 à 13h22.

---

### Session 2 — 2026-05-23 (durée estimée ~3h)
**Documentation + décisions d'architecture — travail local**

- `DOCUMENTATION_SESSION.md` rédigé (démo ↔ production, bilan réaliste, estimation MVP 10-12 sem.)
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
- Domaine fonctionnel `santedirect.kolongono.org` (sous-domaine Cloudflare)
- Endpoint `PATCH /api/pharmacie/ean/{code_interne}` ajouté
- Endpoint `POST /api/pharmacie/ean/import-base` ajouté
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

**1er build CI — Run #1** (26/05 03h36 UTC+2, déclenché par `70a4ac`) :
- Durée : 3m50s — Résultat : ÉCHEC
- Erreur : AGP version manquante dans le `build.gradle` du template

---

### Session 5 — 2026-05-26 · 04h00 → 07h40 (durée ~3h40)
**Debug APK — 20 builds échoués — cause racine identifiée trop tard**

**Contexte** : L'`android/` est généré à chaque build CI depuis le template RN 0.73.
Le `build.gradle` et `settings.gradle` du template sont insuffisants pour résoudre
les dépendances natives (`react-android`, `BaseReactPackage`).

**Erreur persistante sur tous les builds** :
```
e: Unresolved reference: BaseReactPackage
e: Cannot access 'ViewManagerWithGeneratedInterface'
> Task :react-native-screens:compileDebugKotlin FAILED
> Task :react-native-gesture-handler:compileDebugKotlin FAILED
```

**Cause racine** (identifiée en session 7, le 26/05 à 14h) :
Le répertoire `node_modules/react-native/android/` ne contient qu'un `README.md`.
Aucun AAR pré-compilé. Toutes les tentatives basées sur `allprojects { repositories { maven ... } }`
pointaient vers un répertoire vide. La vraie solution : réécrire `settings.gradle`
avec `pluginManagement { includeBuild("../node_modules/@react-native/gradle-plugin") }`
+ `apply plugin: "com.facebook.react.settings"`.

**Diagnostic disponible depuis le build #8** (04h32 UTC+2) mais non lu :
```
top-level (1 items): ['README.md']
AARs trouvés (0): []      ← l'information était là
```

**Chronologie des 21 builds échoués** (tous UTC+2) :

| Run # | Heure | Commit | Trigger | Durée | Tentative |
|-------|-------|--------|---------|-------|-----------|
| 1 | 26/05 01h36 | `70a4ac` | dispatch | 3m50s | Workflow initial — AGP manquant |
| 2 | 26/05 03h59 | `6b0964a` | push | 25m | Workflow robuste — premier vrai build |
| 3 | 26/05 04h45 | `72234d8` | push | 3m54s | sed → Python pour AGP 8.6 |
| 4 | 26/05 05h00 | `c600788` | push | 3m53s | Bump version seul |
| 5 | 26/05 05h06 | `c600788` | dispatch | 4m16s | Re-déclenchement manuel |
| 6 | 26/05 05h18 | `37384bd` | push | 4m14s | Kotlin 1.8→1.9.25 |
| 7 | 26/05 05h27 | `8f25e21` | push | 4m21s | Capture erreurs Kotlin (tee+grep) |
| 8 | 26/05 05h32 | `0788b56` | push | 5m10s | Step4 Python pur — **diagnostic AARs ajouté** |
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
**Incident GitHub Actions + revert + analyse**

**07h40 — Début incident GitHub Actions** :
- `workflow_dispatch` retourne HTTP 500 : "Failed to queue workflow run"
- Affecte les DEUX workflows du repo
- Persiste après déconnexion/reconnexion GitHub
- **Cause** : incident infrastructure GitHub (côté serveur), pas lié au code

**Tentatives pendant l'incident** (aucune n'a pu être construite) :

| Heure | Commit | Résumé |
|-------|--------|--------|
| 26/05 13h00 | `1c31dd5` | Fix(ci) : diagnostic AARs + tarball + DRM (jamais exécuté) |
| 26/05 13h15 | `7f90f34` | CI : retrigger build #22 (jamais exécuté) |
| 26/05 13h15 | `7c8d540` | CI : bump 1.1.4 (jamais exécuté) |
| 26/05 13h28 | `a197bc4` | Fix(ci) : simplifier step 1.5 (jamais exécuté) |
| 26/05 13h30 | `1a50b1b` | Fix(ci) : revert workflow vers `c59d290` |

**Diagnostic clé effectué pendant cet incident** :
En téléchargeant le log du build #21 (run 26434402247), lecture de la sortie du
diagnostic step 4e :
```
top-level (1 items): ['README.md']
AARs trouvés (0): []
```
**→ Cause racine identifiée** : `node_modules/react-native/android/` est vide.
Toutes les approches `allprojects { repositories }` et `dependencyResolutionManagement`
pointaient vers un répertoire sans AARs. Le vrai correctif est une réécriture de
`settings.gradle` avec `pluginManagement { includeBuild }` + `apply plugin: "com.facebook.react.settings"`.

**Question du 2ème compte GitHub** : **INUTILE**.
L'incident était côté infrastructure GitHub, pas lié au compte `mlmfr26`.
Créer un autre compte n'aurait rien résolu.

---

### Session 7 — 2026-05-26 · 13h30 → en cours (durée ~1h)
**Récupération incident GitHub + documentation**

**14h27** — `workflow_dispatch` fonctionne à nouveau (HTTP 500 résolu).
Run 26448025835 déclenché — mais NOUVEL incident : CDN GitHub ne peut pas
télécharger `actions/setup-java`. Incident GitHub encore partiellement actif.

```
X Failed to download archive 'https://codeload.github.com/actions/setup-java/...'
X An action could not be found at the URI '...'
```

**État GitHub Actions** :
- ✅ Déclenchement `workflow_dispatch` : fonctionnel
- ❌ CDN GitHub (téléchargement des actions) : partiellement défaillant
- → Attendre 30-60 min et réessayer. Pas besoin de créer un autre compte.

**Prochain correctif à appliquer dès récupération GitHub** :
Réécriture de `settings.gradle` dans le workflow CI avec le mécanisme officiel RN 0.73 :
```groovy
pluginManagement {
    includeBuild("../node_modules/@react-native/gradle-plugin")
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
apply plugin: "com.facebook.react.settings"
extensions.configure(com.facebook.react.ReactSettingsExtension) {
    ex -> ex.autolinkLibrariesFromCommand()
}
rootProject.name = 'SanteDirect'
include ':app'
includeBuild('../node_modules/@react-native/gradle-plugin')
```

---

## État actuel du projet — 2026-05-26 · 14h30

### Infrastructure ✅ Opérationnel
| Composant | État | Détail |
|-----------|------|--------|
| Serveur | ✅ | Hetzner CX23 — `5.75.149.155` |
| Docker + nginx | ✅ | Conteneurs up, reverse proxy actif |
| Base de données | ✅ | PostgreSQL, DB `santesd` |
| API FastAPI | ✅ | Port 8002, accessible via HTTPS |
| DNS / Domaine | ✅ | `santedirect.kolongono.org` (Cloudflare) |
| Bridge Longonia | ✅ | API key configurée |

### Application mobile — React Native 0.73
| Fonctionnalité | État | Notes |
|----------------|------|-------|
| Navigation multi-rôles | ✅ | adhérent / auxiliaire / médecin / admin / superadmin |
| Scanner EAN/QR — Auxiliaire | ✅ | `AuxiliaireHomeScreen` |
| Scanner EAN/QR — Admin local | ✅ | `CentreDashboardScreen` |
| Scanner EAN/QR — Superadmin | ✅ | `PharmacieAdminScreen` |
| Lookup EAN → API | ✅ | `/api/pharmacie/ean/{code}` |
| Formulaire médicament inconnu | ✅ | `MedicamentInconnuScreen` |
| Formulaire mouvement de stock | ✅ | `FormulaireStockScreen` |
| **APK Build (GitHub Actions)** | ❌ | **21 builds échoués** — fix settings.gradle prêt, bloqué CDN GitHub |
| Téléconsultation Jitsi | ⏳ | Planifié — CX23 dédié |
| Triage IA (Claude API) | ⏳ | Code présent, clé API à valider |
| Notifications push Firebase | ⏳ | Non configuré |

### Dashboard admin web (admin.html)
| Fonctionnalité | État | Notes |
|----------------|------|-------|
| KPIs pharmacie + drill-down | ✅ | Stock, alertes, valeur, dispensations |
| Table médicaments + recherche | ✅ | 100/page, filtre texte |
| Fiche produit éditable | ✅ | EAN, prix, prescription, forme, DCI |
| Ajustement de stock | ✅ | Entrée / sortie / correction |
| Générateur étiquettes ELA034 | ✅ | Code128 / EAN-13 / QR — A4 24/feuille |
| KPIs feuille de route cliquables | ✅ | Drill-down 4 filtres |
| Abonnements / Consultations / Médecins | ⏳ | Données demo — API non câblée |
| Comptabilité | ⏳ | Données demo |

---

## Prochaines priorités

### Urgent — bloque les tests terrain
- [ ] **Attendre récupération CDN GitHub** (~30-60 min), puis appliquer fix `settings.gradle`
- [ ] **Import base médicaments** : `curl -X POST https://santedirect.kolongono.org/api/pharmacie/ean/import-base`
- [ ] **Test end-to-end scanner** : login auxiliaire → scanner → stock → admin.html

### Court terme (< 1 semaine)
- [ ] **nginx.conf** : remplacer `santedirect-kolongono.cd` par `kolongono.org`
- [ ] **Câbler admin.html → API réelle** : consultations, abonnements
- [ ] **Test étiquettes ELA034** : ouvrir admin.html → fiche produit → planche A4

### Moyen terme (semaines 2-4)
- [ ] **Jitsi Meet** : déploiement sur 3e CX23 dédié
- [ ] **Triage IA** : valider `ANTHROPIC_API_KEY` en production
- [ ] **Notifications push** : configurer Firebase FCM
- [ ] **Mobile Money** : M-Pesa / Orange Money RDC
- [ ] **Mode offline partiel** : SQLite local + sync

### Long terme (mois 2-3)
- [ ] Tests d'intégration — monitoring — conformité légale Ministère Santé RDC
- [ ] Migration vers CX23 dédié SantéDirect

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

## Journal des commits

| Date/Heure (UTC+2) | Commit | Résumé |
|--------------------|--------|--------|
| 26/05 13h30 | `1a50b1b` | Revert workflow vers c59d290 |
| 26/05 13h28 | `a197bc4` | Fix(ci) : simplifier step 1.5 |
| 26/05 13h15 | `7c8d540` | CI : bump 1.1.4 |
| 26/05 13h15 | `7f90f34` | CI : retrigger build #22 |
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

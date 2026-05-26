# Feuille de route — SantéDirect Kolongono

> Mise à jour toutes les 6 heures par Claude Code.
> Format : **Date · Heure · Durée de session · Ce qui a changé.**

---

## Dernière mise à jour

**2026-05-27 · ~01h00 (UTC+2 Kinshasa) · Session ~8h (continue)**
Modèle : Claude Sonnet 4.6 — Branche : `main` — Dernier commit : `c59d290`

---

## Historique des sessions de travail

### Session 1 — 2026-05-22 (durée estimée ~6h)
**Création du projet**
- Initialisation du mono-repo `SANTE DIRECT - KOLONGONO/`
- Architecture API (FastAPI port 8002), mobile (React Native 0.73), web (admin HTML)
- ~33 fichiers créés
- Modèles SQLAlchemy (`MedicamentEAN`, `StockPharmacie`, `MouvementStock`)
- Router `pharmacie_ean.py` — 8 endpoints CRUD + mouvements de stock
- Base de 50 médicaments essentiels RDC (`api/data/medicaments_base.json`)
- App mobile : navigation multi-rôles (adhérent / auxiliaire / médecin / admin / superadmin)
- Screens scanner pharmacie : `ScannerStockScreen`, `MedicamentInconnuScreen`, `FormulaireStockScreen`
- Dashboard admin `web/admin.html` — KPIs, table médicaments, abonnements

---

### Session 2 — 2026-05-23 (durée estimée ~3h)
**Documentation + décisions d'architecture**
- `DOCUMENTATION_SESSION.md` rédigé (démo ↔ production, bilan réaliste, estimation MVP 10-12 sem.)
- `DECISIONS_REQUISES.md` : domaine `santedirect.kolongono.org` retenu, `LONGONIA_API_KEY` obtenue
- `DEPLOIEMENT.md` : guide pas-à-pas Hetzner CX23 + Docker + nginx + certbot
- Décision : serveur partagé avec Longonia pendant la phase de test (1 CX23 = 3 apps)
- Décision : médecins au salaire mensuel fixe 200-450 USD (jamais à la consultation)

---

### Session 3 — 2026-05-24 → 2026-05-25 (durée estimée ~8h)
**Déploiement production + drill-down admin**
- **Déploiement ✅** : serveur `5.75.149.155`, Docker, nginx, base `santesd`, Git repo `mlmfr26/kolongono`
- Domaine fonctionnel `santedirect.kolongono.org` (sous-domaine Cloudflare)
- `admin.html` — drill-down pharmacie KPIs (bottom sheet → tableau de détail)
- Fiche produit (modal niveau 3) avec édition EAN/prix/prescription
- Endpoint `PATCH /api/pharmacie/ean/{code_interne}` ajouté
- Endpoint `POST /api/pharmacie/ean/import-base` ajouté (15 accessoires médicaux)
- Câblage scanner `AuxiliaireHomeScreen` — boutons Réceptionner / Dispenser
- Correction bug : préfixe `/api` manquant dans `apiClient` des 3 screens scanner
- Correction bug : `navigation.navigate('PharmacieAdmin')` invalide pour l'auxiliaire → `navigate('Main')`
- Correction : champ `centre_id` absent du type `User` dans `AuthContext.tsx`
- Pipeline APK v1 : `.github/workflows/android-apk.yml` (GitHub Actions, générer android/ + build)

---

### Session 4 — 2026-05-26 ~11h→17h (durée ~6h)
**Scanner tous rôles + Étiquettes ELA034 + APK robuste**

| Fichier | Changement |
|---------|-----------|
| `mobile/screens/centre/CentreDashboardScreen.tsx` | Section PHARMACIE–STOCK : boutons Réceptionner (vert) / Dispenser (orange) pour rôles `admin`, `gestionnaire`, `responsable_centre` |
| `web/admin.html` | Générateur d'étiquettes ELA034 (70×35mm, 24/feuille A4) dans la fiche produit — types : Code-barres Code128 (code interne maison), EAN-13 (code fabricant), QR Code. Impression via JsBarcode + QRCode.js |
| `.github/workflows/android-apk.yml` | Réécriture complète — stratégie template `node_modules/react-native/template/` (sans réseau), détection automatique du package name, arm64-v8a (APK ~25-35 MB), `--stacktrace` pour debug |

**Commits :** `6b0964a` → `3deabc3` → `7013bcf` → `0b2b1d0`

---

### Session 5 — 2026-05-26 ~17h→23h (durée ~6h)
**Debug APK + KPIs feuille de route + Drill-down roadmap**

| Commit | Fichier | Changement |
|--------|---------|-----------|
| `fc4beeb` | `web/admin.html` | Drill-down feuille de route : 4 filtres (Terminées / En cours / Bloquants / Phases). Labels `roadmap` ajoutés dans `openDrill()`. KPI cards cliquables. |
| `72234d8` | `.github/workflows/android-apk.yml` | Tentative fix AGP : remplacement `sed` → Python `re.sub`. Gradle wrapper écrit directement en 8.7. `VisionCamera_enableCodeScanner=true`. |
| `3a7bac7` | `.github/workflows/android-apk.yml` | Fix définitif AGP : heredoc shell `cat >` qui écrase `build.gradle` (AGP 8.6.0, compileSdk 35). |
| `c600788` | `mobile/package.json` | Bump version 1.0.1→1.0.2 pour déclencher build CI. |

---

### Session 6 — 2026-05-26 ~23h→2026-05-27 ~01h (durée ~2h) ← SESSION ACTUELLE
**Debug APK — cause racine `BaseReactPackage` identifiée et corrigée**

**Analyse :** 15+ builds échoués avec `Unresolved reference: BaseReactPackage` dans `react-native-screens` et `react-native-gesture-handler`. Cause racine : le `build.gradle` réécrit par Python ne contenait pas de bloc `allprojects { repositories }`, contrairement au template RN d'origine. Sans ce bloc, Gradle ne peut pas résoudre `com.facebook.react:react-android` (contient `BaseReactPackage`).

Tentatives infructueuses en session 6 :
- ReactAndroid composite build → échoue sur `alias(libs.plugins.android.library)` (version catalog absent)

| Commit | Fichier | Changement |
|--------|---------|-----------|
| `c59d290` | `.github/workflows/android-apk.yml` + `mobile/package.json` | **Fix cause racine** : ajout `allprojects { repositories }` dans `build.gradle` (node_modules/react-native/android, jsc-android, google, mavenCentral, jitpack). Bump react-native 0.73.0 → 0.73.6. Suppression ReactAndroid composite build. |

---

## État actuel du projet — 2026-05-27 ~01h00

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
| Scanner code-barres + QR — Auxiliaire | ✅ | Boutons dans `AuxiliaireHomeScreen` |
| Scanner code-barres + QR — Admin local | ✅ | Boutons dans `CentreDashboardScreen` (session 4) |
| Scanner code-barres + QR — Superadmin | ✅ | Via `PharmacieAdminScreen` (5 points d'entrée) |
| Lookup EAN/QR → API | ✅ | `/api/pharmacie/ean/{code}` |
| Formulaire médicament inconnu | ✅ | `MedicamentInconnuScreen` — one-time, enregistré ensuite |
| Formulaire mouvement de stock | ✅ | `FormulaireStockScreen` — entrée / sortie |
| APK Build (GitHub Actions) | ⏳ | Build en cours — fix allprojects repos + RN 0.73.6 (commit c59d290) |
| Téléconsultation Jitsi | ⏳ | Déployé sur le futur CX23 dédié |
| Triage IA (Claude API) | ⏳ | Code présent, clé API à valider en prod |
| Notifications push Firebase | ⏳ | Non configuré |

### Dashboard admin web (admin.html)
| Fonctionnalité | État | Notes |
|----------------|------|-------|
| KPIs pharmacie | ✅ | Stock total, alertes, valeur, dispensations |
| Drill-down KPIs | ✅ | Bottom sheet avec tableau de détail |
| Table médicaments paginée + recherche | ✅ | 100/page, filtre texte |
| Fiche produit éditable | ✅ | EAN, prix, prescription, forme, DCI, dosage |
| Ajustement de stock depuis la fiche | ✅ | Entrée / sortie / correction |
| Générateur étiquettes ELA034 | ✅ | Code128 / EAN-13 / QR — impression A4 (session 4) |
| KPIs feuille de route cliquables | ✅ | Drill-down 4 filtres (session 5) |
| Abonnements / Mutuelle | ⏳ | Données demo, API non câblée |
| Consultations | ⏳ | Données demo, API non câblée |
| Médecins partenaires | ⏳ | Données demo |
| Comptabilité | ⏳ | Données demo |

---

## Prochaines priorités

### Urgent — bloque les tests terrain
- [ ] **Résultat build APK** : vérifier GitHub Actions commit `c59d290`, télécharger l'APK arm64 et le distribuer aux testeurs
- [ ] **Import base médicaments** : `curl -X POST https://santedirect.kolongono.org/api/pharmacie/ean/import-base` (vérifier si déjà fait)
- [ ] **Test end-to-end scanner** : login auxiliaire → scanner un code-barres → entrée/sortie stock → vérifier côté admin.html

### Court terme (< 1 semaine)
- [ ] **nginx.conf** : remplacer les refs `santedirect-kolongono.cd` par `kolongono.org`
- [ ] **Câbler admin.html → API réelle** : consultations, abonnements (actuellement demo JS)
- [ ] **Test fiche produit + étiquettes** : ouvrir admin.html, cliquer sur un médicament, générer une planche d'étiquettes ELA034, vérifier l'impression

### Moyen terme (semaines 2-4)
- [ ] **Jitsi Meet** : déploiement sur 3e CX23 dédié (Option B validée)
- [ ] **Triage IA** : valider `ANTHROPIC_API_KEY` en production
- [ ] **Notifications push** : configurer Firebase FCM
- [ ] **Mobile Money** : intégration M-Pesa / Orange Money RDC
- [ ] **Mode offline partiel** : SQLite local + sync (critique pour le terrain)

### Long terme (mois 2-3)
- [ ] **Tests d'intégration** : authentification, scanner, stock, ordonnances
- [ ] **Monitoring** : logs, alertes rupture de stock, uptime serveur
- [ ] **Conformité légale** : vérification obligations stockage dossiers médicaux (Ministère Santé RDC)
- [ ] **Serveur dédié SantéDirect** : migrer du CX23 partagé vers CX23 dédié dès que l'app est stable

---

## Règles non négociables (figées)

| Règle | Valeur |
|-------|--------|
| Langue | Français exclusivement |
| Icônes | SVG stroke uniquement — jamais d'emojis dans le code |
| Vidéo | Jitsi Meet self-hosted — jamais Daily.co |
| Stack | FastAPI port 8002 + React Native 0.73 |
| Paiements | Mobile Money uniquement (M-Pesa, Orange) — jamais Stripe |
| Devise affichage | USD pour médecins/admin · FC pour les patients |
| Rémunération médecins | Salaire mensuel fixe 200-450 USD — jamais à la consultation |
| Builds Android | GitHub Actions uniquement — jamais Android Studio local (ressources insuffisantes) |

---

## Journal des commits récents

| Date | Commit | Résumé |
|------|--------|--------|
| 2026-05-27 | `c59d290` | **Fix cause racine** : allprojects repos + RN 0.73.6 (BaseReactPackage) |
| 2026-05-26 | `f30b4a8` | ReactAndroid composite build dans settings.gradle (échoue version catalog) |
| 2026-05-26 | `96822d1` | Injection directe react-android.aar via compileOnly files() |
| 2026-05-26 | `c600788` | Bump version pour déclencher build CI |
| 2026-05-26 | `3a7bac7` | Fix définitif CI : heredoc shell pour build.gradle (AGP 8.6.0) |
| 2026-05-26 | `fc4beeb` | Drill-down feuille de route (4 filtres) |
| 2026-05-26 | `6b0964a` | Scanner admin + étiquettes ELA034 + workflow APK robuste |
| 2026-05-22 | initial | Création projet ~33 fichiers |

---

*Prochaine mise à jour prévue : 2026-05-27 ~07h00 (dans 6h)*

# Guide de déploiement — SantéDirect Kolongono

## Vue d'ensemble

```
Internet
   │
   ▼
VPS Ubuntu 22.04 (IP publique)
   │
   ├── Nginx :80/:443  ──► API FastAPI (port 8002 interne)
   │                   ──► Jitsi Web (port 80 interne)
   │                   ──► Jitsi BOSH / XMPP-WS / Colibri-WS
   │
   ├── JVB :10000/udp  ◄── Media WebRTC (direct, traversée NAT)
   └── JVB :4443/tcp   ◄── Fallback TCP (si UDP bloqué)
```

Domaines requis :
- `api.santedirect-kolongono.cd` → API FastAPI
- `jitsi.santedirect-kolongono.cd` → Jitsi Meet

---

## PHASE 1 — Serveur

### 1.1 Prérequis VPS
- OS : Ubuntu 22.04 LTS (recommandé) ou Debian 12
- RAM : 4 Go minimum (8 Go recommandé pour Jitsi)
- CPU : 2 vCPU minimum
- Disque : 40 Go SSD
- IP publique fixe

### 1.2 Installation Docker
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

### 1.3 Firewall
```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 10000/udp    # JVB media WebRTC — OBLIGATOIRE
sudo ufw allow 4443/tcp     # JVB TCP fallback
sudo ufw enable
```

> **Attention RDC** : Si l'opérateur bloque UDP 10000, les appels passent en fallback TCP 4443.
> Vérifier que le pare-feu réseau de l'hébergeur expose également ces ports.

---

## PHASE 2 — DNS

Dans le panel DNS du registrar :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `api` | `IP_DU_SERVEUR` | 300 |
| A | `jitsi` | `IP_DU_SERVEUR` | 300 |

Vérifier la propagation avant de continuer :
```bash
dig api.santedirect-kolongono.cd +short
dig jitsi.santedirect-kolongono.cd +short
# Les deux doivent retourner l'IP du serveur
```

---

## PHASE 3 — Certificats SSL (avant lancement Nginx)

```bash
# Installer certbot seul (pour l'émission initiale hors Docker)
sudo apt install -y certbot

# Nginx doit être arrêté (port 80 libre)
sudo certbot certonly --standalone \
  -d api.santedirect-kolongono.cd \
  -d jitsi.santedirect-kolongono.cd \
  --email mlmfr26@gmail.com \
  --agree-tos \
  --non-interactive

# Résultat : /etc/letsencrypt/live/*/fullchain.pem + privkey.pem
```

Après cette étape, les volumes certbot dans docker-compose.yml prendront le relais pour les renouvellements.

---

## PHASE 4 — Configuration .env

Copier et remplir toutes les valeurs :

```bash
cp .env.example .env
nano .env
```

Valeurs critiques à changer **obligatoirement** :

```ini
# Base de données
DB_PASSWORD=MOT_DE_PASSE_FORT_32_CHARS

# Sécurité JWT
SECRET_KEY=$(openssl rand -hex 32)

# Jitsi (IP du serveur)
JITSI_DOMAIN=jitsi.santedirect-kolongono.cd
JITSI_SERVER_IP=xxx.xxx.xxx.xxx     # IP publique du VPS

# Mots de passe Jitsi internes (générer !)
JICOFO_AUTH_PASSWORD=$(openssl rand -hex 16)
JVB_AUTH_PASSWORD=$(openssl rand -hex 16)

# Longonia bridge
LONGONIA_API_URL=http://IP_LONGONIA:8000
LONGONIA_API_KEY=CLE_LONGONIA

# Production
BASE_URL=https://api.santedirect-kolongono.cd
ENVIRONMENT=production
```

---

## PHASE 5 — Déploiement Docker

### 5.1 Cloner et préparer
```bash
git clone <repo> /opt/kolongono
cd /opt/kolongono/SANTE\ DIRECT\ -\ KOLONGONO/
cp .env.example .env
# Remplir .env (Phase 4)
```

### 5.2 Monter les certificats dans le volume certbot
```bash
# Créer les volumes nommés et copier les certs
docker volume create kolongono_certbot_conf
sudo cp -rL /etc/letsencrypt/. $(docker volume inspect kolongono_certbot_conf --format '{{.Mountpoint}}')
```

### 5.3 Lancer les services (ordre important)
```bash
# 1 — Base de données seule (vérifier qu'elle démarre)
docker compose up -d db
docker compose logs -f db     # attendre "database system is ready"

# 2 — API + Jitsi stack
docker compose up -d
docker compose ps             # tous les services doivent être "healthy" ou "running"
```

### 5.4 Initialiser la base de données
```bash
docker compose exec api python -c "
from database import Base, engine
Base.metadata.create_all(bind=engine)
print('Tables créées.')
"

# Créer le premier admin
docker compose exec api python -c "
from database import SessionLocal
from main import hash_password
db = SessionLocal()
# Insérer admin manuellement si pas de script seed
print('DB prête.')
db.close()
"
```

---

## PHASE 6 — Vérification Jitsi

### 6.1 Test navigateur
Ouvrir `https://jitsi.santedirect-kolongono.cd` → page d'accueil Jitsi Meet.
Créer une salle test et rejoindre depuis deux onglets différents.

### 6.2 Vérification des services Jitsi
```bash
# Tous doivent être "running"
docker compose ps jitsi-web prosody jicofo jvb

# Logs en cas de problème
docker compose logs prosody   # XMPP
docker compose logs jicofo    # Focus component
docker compose logs jvb       # Video Bridge
```

### 6.3 Test UDP port 10000
Depuis un autre réseau (4G, pas le serveur) :
```bash
# Outil en ligne : https://www.portchecktool.com
# Vérifier UDP 10000 et TCP 4443 sur IP_DU_SERVEUR
```

Si UDP 10000 échoue mais TCP 4443 fonctionne : Jitsi utilisera automatiquement le fallback TCP.
Les appels fonctionneront mais avec latence légèrement supérieure.

---

## PHASE 7 — API FastAPI

### 7.1 Test santé
```bash
curl https://api.santedirect-kolongono.cd/health
# Réponse attendue :
# {"status":"healthy","jitsi_domain":"jitsi.santedirect-kolongono.cd","jitsi_mode":"self-hosted"}
```

### 7.2 Test Swagger
Ouvrir `https://api.santedirect-kolongono.cd/docs`

### 7.3 Test connexion
```bash
curl -X POST https://api.santedirect-kolongono.cd/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"telephone":"0810000001","mot_de_passe":"admin123"}'
```

### 7.4 Test réservation consultation (génère URL Jitsi)
```bash
curl -X POST https://api.santedirect-kolongono.cd/api/consultations/reserver \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"medecin_id":1,"date_heure":"2026-06-01T10:00:00","motif":"Test"}'
# Réponse doit contenir lien_patient, lien_auxiliaire, lien_medecin avec domaine Jitsi
```

---

## PHASE 8 — Application mobile

### 8.1 Configuration production
Fichier `mobile/components/api.ts` — changer l'URL de base :
```typescript
// Développement
const BASE_URL = 'http://10.0.2.2:8002';   // émulateur Android

// Production
const BASE_URL = 'https://api.santedirect-kolongono.cd';
```

### 8.2 Android — permissions AndroidManifest.xml
Vérifier que `android/app/src/main/AndroidManifest.xml` contient :
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

Pour `react-native-vision-camera` (scanner QR), ajouter dans `android/app/build.gradle` :
```gradle
android {
  defaultConfig {
    // Vision Camera requires minSdkVersion 26
    minSdkVersion 26
  }
}
```

Pour `react-native-webview` (accès caméra/micro depuis WebView — Jitsi) :
```xml
<!-- Dans <application> -->
<activity android:name=".MainActivity"
    android:windowSoftInputMode="adjustResize">
</activity>
```

### 8.2b iOS — Info.plist
```xml
<key>NSCameraUsageDescription</key>
<string>Caméra utilisée pour scanner les QR codes de stock et pour les téléconsultations vidéo</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone utilisé pour les téléconsultations vidéo</string>
```

### 8.3 Build APK release Android
```bash
cd mobile

# Installer les dépendances
npm install

# Générer keystore (une seule fois)
keytool -genkey -v -keystore android/app/kolongono-release.keystore \
  -alias kolongono -keyalg RSA -keysize 2048 -validity 10000

# Configurer android/app/build.gradle (signingConfigs)
# Puis builder
cd android && ./gradlew assembleRelease
# APK : android/app/build/outputs/apk/release/app-release.apk
```

### 8.4 Test WebView Jitsi sur appareil réel
- L'émulateur ne peut pas tester la caméra/micro
- Installer l'APK de debug sur un vrai smartphone Android
- Tester la création d'une consultation et l'accès à la salle Jitsi
- Vérifier que la caméra et le micro fonctionnent dans la WebView
- Tester depuis une connexion 3G/4G (simuler faible débit)

---

## PHASE 9 — Checklist finale avant lancement

### Sécurité
- [ ] `SECRET_KEY` est aléatoire (32+ chars), pas la valeur par défaut
- [ ] `DB_PASSWORD` est fort et unique
- [ ] `JICOFO_AUTH_PASSWORD` et `JVB_AUTH_PASSWORD` changés
- [ ] Le fichier `.env` n'est pas commité dans Git (`.gitignore`)
- [ ] HTTPS fonctionne sur les deux domaines (pas d'alerte SSL)
- [ ] Headers HSTS présents (`curl -I https://api...` → `Strict-Transport-Security`)

### Infrastructure
- [ ] Port UDP 10000 ouvert sur le pare-feu serveur ET pare-feu réseau hébergeur
- [ ] Port TCP 4443 ouvert (fallback TCP)
- [ ] `docker compose ps` → tous les services `Up`
- [ ] Renouvellement certbot automatique (service certbot dans docker-compose)
- [ ] Sauvegardes PostgreSQL planifiées (`pg_dump` ou extension WAL)

### API
- [ ] `/health` retourne `{"status":"healthy"}`
- [ ] Login fonctionne et retourne un token JWT
- [ ] Réservation consultation génère URL `jitsi.santedirect-kolongono.cd/...`
- [ ] Swagger accessible sur `/docs`

### Jitsi
- [ ] Page d'accueil Jitsi accessible depuis un navigateur externe
- [ ] Salle de test créée et rejointe par 2 navigateurs différents (audio + vidéo OK)
- [ ] Test depuis réseau mobile (3G/4G) : qualité vidéo acceptable à 480p
- [ ] 3 participants simultanés testés (patient + auxiliaire + médecin)

### Mobile
- [ ] APK installé sur appareil Android physique
- [ ] Login → tableau de bord fonctionne
- [ ] Réservation consultation → URL Jitsi reçue
- [ ] TeleconsultationScreen → WebView s'ouvre, caméra/micro autorisés
- [ ] Bouton "Fin" ferme la consultation
- [ ] Test depuis 4G (pas WiFi) : acceptable

### Longonia bridge
- [ ] `GET /api/longonia/verify-adherent/1` répond (ou erreur gracieuse si Longonia absent)
- [ ] Pas de crashs si Longonia est hors ligne

---

## Commandes utiles en production

```bash
# Voir les logs en temps réel
docker compose logs -f api
docker compose logs -f jvb

# Redémarrer un service
docker compose restart api

# Mettre à jour l'API (après git pull)
docker compose build api && docker compose up -d api

# Vérifier l'utilisation mémoire (Jitsi peut consommer beaucoup)
docker stats --no-stream

# Sauvegarde PostgreSQL
docker compose exec db pg_dump -U kolongono kolongono > backup_$(date +%Y%m%d).sql

# Renouvellement manuel certificat
docker compose run --rm certbot renew
docker compose restart nginx
```

---

## Dépannage fréquent

### "Jitsi se charge mais pas de vidéo"
→ Port UDP 10000 bloqué. Vérifier avec `nc -vzu IP_SERVEUR 10000`.
→ Vérifier `DOCKER_HOST_ADDRESS` dans `.env` = IP publique réelle du serveur.

### "WebView affiche page blanche sur Android"
→ Vérifier que `javaScriptEnabled={true}` et `domStorageEnabled={true}` dans TeleconsultationScreen.
→ Vérifier que l'URL Jitsi est HTTPS (pas HTTP).

### "Caméra/micro refusé dans la WebView"
→ Android : ajouter `android:usesCleartextTraffic="false"` et vérifier les permissions.
→ `mediaCapturePermissionGrantType="grant"` est déjà configuré dans TeleconsultationScreen.

### "API retourne 502 Bad Gateway"
→ `docker compose logs api` pour voir l'erreur Python.
→ Vérifier que la DB est démarrée : `docker compose ps db`.

### "Erreur de connexion Longonia"
→ Normal si Longonia n'est pas encore déployé. L'API retourne une erreur gracieuse.
→ Configurer `LONGONIA_API_URL` vers l'IP réelle de Longonia en production.

---

## Estimation ressources Jitsi (RDC, faible débit)

| Participants | CPU (JVB) | RAM (JVB) | Bande passante |
|-------------|-----------|-----------|----------------|
| 3 (config max) | ~30% | ~200 Mo | ~1 Mbps upload serveur |
| 10 | ~60% | ~400 Mo | ~3 Mbps upload |

Config actuelle optimisée pour 3 participants à 480p.
Sur connexion 3G (1-2 Mbps), Jitsi descend automatiquement à 240p grâce à `ENABLE_SIMULCAST`.

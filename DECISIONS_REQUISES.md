# Décisions requises — SantéDirect Kolongono

## 1. Nom de domaine — DÉCIDÉ ✓

**Domaine retenu :** `santedirect.kolongono.org`
**Registrar :** Cloudflare (kolongono.org déjà enregistré)
**Coût :** gratuit (sous-domaine du domaine existant)

### Configuration DNS Cloudflare (à faire)

1. Se connecter à Cloudflare → domaine `kolongono.org` → DNS
2. Ajouter un enregistrement A :
   ```
   Type : A
   Nom  : santedirect
   IPv4 : <IP_DU_SERVEUR_HETZNER>
   Proxy: Activé (nuage orange) — recommandé pour SSL automatique
   ```
3. Attendre la propagation DNS (5 min avec Cloudflare)
4. Vérifier : `ping santedirect.kolongono.org`
5. Déployer : `export SANTESD_DOMAIN=santedirect.kolongono.org && bash deploy-server.sh`

> **Note SSL :** Avec Cloudflare en mode proxy, le certificat SSL est géré automatiquement.
> Certbot reste optionnel (origin certificate Cloudflare recommandé en prod).

---

## 2. LONGONIA_API_KEY — OBTENUE ✓

**Action :** clé reçue au format `X-API-Key: lk_live_...`

### Comment renseigner la clé dans .env

> Le format "X-API-Key: lk_live_..." signifie :
> - `X-API-Key` = nom du header HTTP (déjà géré dans le code)
> - `lk_live_...` = **valeur à mettre dans .env**

### Configuration

1. Sur le serveur (SSH) :
   ```bash
   nano "/var/www/santesd/SANTE DIRECT - KOLONGONO/.env"
   # Modifier la ligne :
   LONGONIA_API_KEY=la-clé-fournie-par-longonia
   ```
2. Vérifier le port exact de Longonia :
   ```bash
   sudo ss -tlnp | grep -E "8000|8001"
   ```
3. Si le port est différent de 8000, mettre à jour :
   ```bash
   LONGONIA_API_URL=http://127.0.0.1:PORT_REEL
   ```
4. Redémarrer SantéDirect :
   ```bash
   sudo systemctl restart santesd
   ```
5. Tester le bridge :
   ```bash
   # Récupérer un token de test
   TOKEN=$(curl -s -X POST http://127.0.0.1:8002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.cd","password":"admin1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
   
   # Tester la connexion Longonia
   curl -s http://127.0.0.1:8002/api/longonia/status \
     -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
   ```
   Réponse attendue : `{"longonia_accessible": true, ...}`

---

## 3. Configuration CORS côté Longonia

**À faire en même temps que la clé API.**

Une fois le domaine choisi (ex: `santedirect-kolongono.cd`), demander à l'équipe Longonia d'ajouter ce domaine aux origines CORS autorisées dans leur FastAPI.

Ou, si vous avez accès au code Longonia sur le serveur :
```bash
# Sur le serveur, dans le code Longonia
nano /var/www/longonia/api/main.py

# Trouver la section CORSMiddleware et ajouter :
allow_origins=[
    "https://santedirect-kolongono.cd",
    "https://www.santedirect-kolongono.cd",
    # ... origines existantes
]

sudo systemctl restart longonia
```

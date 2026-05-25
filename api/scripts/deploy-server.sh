#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SantéDirect Kolongono — Script de déploiement serveur Hetzner CX23 partagé
#
# À exécuter en SSH sur le serveur Hetzner :
#   bash deploy-server.sh
#
# Ce script ne touche pas à Longonia ni LX.
# Il ajoute uniquement : base santesd + venv + systemd santesd + nginx block
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="/var/www/santesd/SANTE DIRECT - KOLONGONO/api"
VENV="$APP_DIR/venv"
SERVICE="santesd"
DOMAIN="${SANTESD_DOMAIN:-santedirect.kolongono.org}"  # surcharger avec export SANTESD_DOMAIN=...

echo "=== SantéDirect — Déploiement serveur partagé CX23 ==="
echo "Domaine : $DOMAIN"
echo ""

# ── ÉTAPE 0 : Vérifier l'existant ────────────────────────────────────────────
echo "[0] Vérification des services existants..."
sudo systemctl list-units --type=service --state=running | grep -E "longonia|lx|nginx|postgres" || true
echo ""
echo "Ports occupés :"
sudo ss -tlnp | grep -E "80|443|8000|8001|8002|5432"
echo ""

# ── ÉTAPE 1 : Python 3.11 ────────────────────────────────────────────────────
echo "[1] Vérification Python 3.11..."
if python3.11 --version 2>/dev/null; then
  echo "[OK] Python 3.11 déjà présent."
else
  sudo apt update -qq
  sudo apt install -y python3.11 python3.11-venv python3-pip build-essential
fi

# ── ÉTAPE 2 : Base de données PostgreSQL (instance partagée) ─────────────────
echo "[2] Création base de données santesd..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = 'kolongono_sd'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER kolongono_sd WITH PASSWORD '${DB_PASSWORD:-CHANGER_CE_MOT_DE_PASSE}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'santesd'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE santesd OWNER kolongono_sd;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE santesd TO kolongono_sd;" 2>/dev/null || true
echo "[OK] Base santesd prête."

# ── ÉTAPE 3 : Déploiement du code ────────────────────────────────────────────
echo "[3] Déploiement du code..."
sudo mkdir -p "/var/www/santesd"
cd "/var/www/santesd"

if [ -d ".git" ]; then
  git pull
else
  git clone https://github.com/VOTRE_COMPTE/kolongono.git .
fi

# Environnement Python isolé
cd "$APP_DIR"
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate
echo "[OK] Venv et dépendances installés."

# ── ÉTAPE 4 : Fichier .env ────────────────────────────────────────────────────
echo "[4] Configuration .env..."
ENV_FILE="/var/www/santesd/SANTE DIRECT - KOLONGONO/.env"
if [ ! -f "$ENV_FILE" ]; then
  SECRET=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=santesd
DB_USER=kolongono_sd
DB_PASSWORD=${DB_PASSWORD:-CHANGER_CE_MOT_DE_PASSE}
SECRET_KEY=$SECRET
ACCESS_TOKEN_EXPIRE_MINUTES=480
LONGONIA_API_URL=http://127.0.0.1:8000
LONGONIA_API_KEY=${LONGONIA_API_KEY:-}
JITSI_DOMAIN=meet.jit.si
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
ENVIRONMENT=production
EOF
  echo "[OK] .env créé avec SECRET_KEY générée."
  echo "[WARN] Renseigner LONGONIA_API_KEY dans $ENV_FILE"
else
  echo "[OK] .env déjà présent — non écrasé."
fi

# ── ÉTAPE 5 : Migrations Alembic ─────────────────────────────────────────────
echo "[5] Migrations base de données (Alembic)..."
cd "$APP_DIR"
source venv/bin/activate

# Charger les variables d'environnement
set -a; source "$ENV_FILE"; set +a

# Générer la migration initiale si aucune n'existe
if [ ! "$(ls -A alembic/versions/*.py 2>/dev/null)" ]; then
  alembic revision --autogenerate -m "schema initial"
  echo "[OK] Migration initiale générée."
fi

alembic upgrade head
echo "[OK] Base de données migrée."
deactivate

# ── ÉTAPE 6 : Charger les 50 médicaments de base ─────────────────────────────
echo "[6] Import médicaments de base..."
# Attendre que le service soit up pour cette étape (faire après l'étape 8)
echo "[INFO] À exécuter APRÈS démarrage du service :"
echo "       curl -X POST http://127.0.0.1:8002/api/pharmacie/ean/import-base"

# ── ÉTAPE 7 : Service systemd ─────────────────────────────────────────────────
echo "[7] Création du service systemd santesd..."
sudo tee /etc/systemd/system/santesd.service > /dev/null <<EOF
[Unit]
Description=SantéDirect Kolongono — FastAPI (test CX23 partagé)
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=$APP_DIR
ExecStart=$VENV/bin/uvicorn main:app --host 127.0.0.1 --port 8002 --workers 1 --log-level info
Restart=always
RestartSec=5
EnvironmentFile=/var/www/santesd/SANTE DIRECT - KOLONGONO/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable santesd
sudo systemctl start santesd
sleep 2
sudo systemctl status santesd --no-pager
echo "[OK] Service santesd démarré."

# ── ÉTAPE 8 : Import médicaments (maintenant que le service tourne) ───────────
echo "[8] Import des 50 médicaments de base..."
curl -s -X POST http://127.0.0.1:8002/api/pharmacie/ean/import-base | python3 -m json.tool || true

# ── ÉTAPE 9 : nginx — nouveau server block ────────────────────────────────────
echo "[9] Configuration nginx (nouveau bloc uniquement)..."
WEB_ROOT="/var/www/santesd/SANTE DIRECT - KOLONGONO/web"

sudo tee /etc/nginx/sites-available/santesd > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8002/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8002/docs;
        proxy_set_header Host \$host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8002/openapi.json;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/santesd /etc/nginx/sites-enabled/santesd
echo "Blocs nginx actifs :"
ls /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
echo "[OK] nginx configuré."

# ── ÉTAPE 10 : HTTPS Let's Encrypt ────────────────────────────────────────────
echo ""
echo "=== ÉTAPE MANUELLE : HTTPS ==="
echo "Après avoir vérifié que le DNS $DOMAIN pointe vers ce serveur :"
echo ""
echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  sudo certbot renew --dry-run   # tester le renouvellement auto"
echo ""
echo "=== Déploiement terminé ==="
echo ""
echo "Vérifications finales :"
echo "  curl http://127.0.0.1:8002/health"
echo "  curl http://$DOMAIN"
echo "  sudo journalctl -u santesd -n 50 --no-pager"

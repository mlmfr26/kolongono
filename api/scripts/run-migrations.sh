#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SantéDirect — Migrations Alembic (à exécuter sur le serveur via SSH)
# ─────────────────────────────────────────────────────────────────────────────

APP_DIR="/var/www/santesd/SANTE DIRECT - KOLONGONO/api"
ENV_FILE="/var/www/santesd/SANTE DIRECT - KOLONGONO/.env"

cd "$APP_DIR"
source venv/bin/activate

# Charger les variables d'environnement
set -a; source "$ENV_FILE"; set +a

echo "=== Alembic — SantéDirect ==="
echo "DB : $DB_NAME @ $DB_HOST:$DB_PORT (user: $DB_USER)"
echo ""

# Vérifier la connexion à la base
python3 -c "
import psycopg2, os
conn = psycopg2.connect(
    host=os.environ['DB_HOST'], port=os.environ['DB_PORT'],
    dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD']
)
conn.close()
print('[OK] Connexion PostgreSQL réussie.')
"

# Générer la migration initiale si aucune version n'existe
VERSIONS_DIR="$APP_DIR/alembic/versions"
EXISTING=$(ls "$VERSIONS_DIR"/*.py 2>/dev/null | grep -v .gitkeep | wc -l)

if [ "$EXISTING" -eq 0 ]; then
  echo "Génération de la migration initiale..."
  alembic revision --autogenerate -m "schema initial"
  echo "[OK] Fichier de migration généré dans alembic/versions/"
else
  echo "[OK] $EXISTING migration(s) existante(s) — skip génération."
fi

# Appliquer toutes les migrations en attente
echo "Application des migrations..."
alembic upgrade head
echo "[OK] Base de données à jour."

# Afficher l'état actuel
echo ""
echo "État actuel des migrations :"
alembic current
alembic history --verbose | head -20

deactivate
echo ""
echo "=== Migrations terminées ==="

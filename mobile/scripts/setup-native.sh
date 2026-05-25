#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SantéDirect Kolongono — Initialisation des répertoires natifs Android & iOS
#
# À exécuter UNE SEULE FOIS depuis le dossier mobile/ :
#   chmod +x scripts/setup-native.sh
#   bash scripts/setup-native.sh
#
# Prérequis :
#   - Node.js 18+ installé
#   - Pour Android : Android Studio + SDK + JAVA_HOME configuré
#   - Pour iOS (Mac uniquement) : Xcode + CocoaPods installés
# ─────────────────────────────────────────────────────────────────────────────

set -e
APP_NAME="SanteDirectKolongono"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== SantéDirect — Setup natif ==="
echo "Dossier mobile : $MOBILE_DIR"
echo ""

# ── 1. Générer les répertoires natifs ────────────────────────────────────────
if [ -d "$MOBILE_DIR/android" ] && [ -d "$MOBILE_DIR/ios" ]; then
  echo "[OK] Répertoires android/ et ios/ déjà présents — skip init."
else
  echo "[1/4] Génération des répertoires natifs React Native..."
  # Crée un projet temporaire dans /tmp pour récupérer android/ et ios/
  TMP_DIR=$(mktemp -d)
  cd "$TMP_DIR"
  npx --yes react-native@0.73.0 init "$APP_NAME" --skip-install --template react-native-template-typescript
  cp -r "$TMP_DIR/$APP_NAME/android" "$MOBILE_DIR/android"
  cp -r "$TMP_DIR/$APP_NAME/ios"     "$MOBILE_DIR/ios"
  rm -rf "$TMP_DIR"
  cd "$MOBILE_DIR"
  echo "[OK] android/ et ios/ copiés."
fi

# ── 2. Renommer l'app (app.json → natif) ────────────────────────────────────
echo "[2/4] Application du nom de l'app..."
# Android : strings.xml
STRINGS_XML="$MOBILE_DIR/android/app/src/main/res/values/strings.xml"
if [ -f "$STRINGS_XML" ]; then
  sed -i "s/<string name=\"app_name\">.*<\/string>/<string name=\"app_name\">SantéDirect<\/string>/" "$STRINGS_XML"
  echo "[OK] android strings.xml mis à jour."
fi

# ── 3. Permissions caméra Android ────────────────────────────────────────────
echo "[3/4] Ajout des permissions caméra Android..."
MANIFEST="$MOBILE_DIR/android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  # Ajouter la permission CAMERA si absente
  if ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
    sed -i '/<manifest/a\    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />' "$MANIFEST"
    echo "[OK] Permission CAMERA ajoutée au AndroidManifest.xml."
  else
    echo "[OK] Permission CAMERA déjà présente."
  fi
else
  echo "[WARN] AndroidManifest.xml introuvable — permission à ajouter manuellement."
  echo "       Fichier attendu : $MANIFEST"
fi

# ── 4. Permissions caméra iOS ────────────────────────────────────────────────
echo "[4/4] Ajout des permissions caméra iOS..."
INFO_PLIST="$MOBILE_DIR/ios/$APP_NAME/Info.plist"
if [ -f "$INFO_PLIST" ]; then
  if ! grep -q "NSCameraUsageDescription" "$INFO_PLIST"; then
    # Insérer avant </dict> final
    sed -i 's|</dict>|    <key>NSCameraUsageDescription</key>\n    <string>Accès caméra nécessaire pour scanner les codes-barres médicaments</string>\n</dict>|' "$INFO_PLIST"
    echo "[OK] NSCameraUsageDescription ajouté à Info.plist."
  else
    echo "[OK] NSCameraUsageDescription déjà présent."
  fi
else
  echo "[WARN] Info.plist introuvable — permission à ajouter manuellement."
  echo "       Fichier attendu : $INFO_PLIST"
fi

# ── 5. iOS : CocoaPods ───────────────────────────────────────────────────────
if [ "$(uname)" = "Darwin" ]; then
  echo ""
  echo "[5/5] Installation des pods iOS..."
  cd "$MOBILE_DIR/ios"
  pod install
  cd "$MOBILE_DIR"
  echo "[OK] CocoaPods installés."
fi

echo ""
echo "=== Setup terminé ==="
echo ""
echo "Commandes pour lancer l'app :"
echo "  Android : npx react-native run-android"
echo "  iOS     : npx react-native run-ios"
echo ""
echo "Si la caméra ne fonctionne pas :"
echo "  Android : vérifier android/app/src/main/AndroidManifest.xml (CAMERA permission)"
echo "  iOS     : vérifier ios/$APP_NAME/Info.plist (NSCameraUsageDescription)"

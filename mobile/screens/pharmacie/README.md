# Module Scanner — Pharmacie Stock

## Dépendances à installer

> Projet **bare React Native** (non Expo) — utiliser `npm install`, pas `expo install`.

```bash
cd mobile
# react-native-vision-camera est déjà dans package.json
# Installer seulement le DateTimePicker manquant :
npm install @react-native-community/datetimepicker

# Android : lier les dépendances natives
npx react-native link @react-native-community/datetimepicker   # ou rebuild le projet

# iOS
cd ios && pod install && cd ..
```

### Caméra — react-native-vision-camera v4

`ScannerStockScreen` utilise `react-native-vision-camera` (déjà installé).
Il faut configurer les permissions dans le projet natif :

**Android** (`android/app/src/main/AndroidManifest.xml`) :
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

**iOS** (`ios/<App>/Info.plist`) :
```xml
<key>NSCameraUsageDescription</key>
<string>Accès caméra nécessaire pour scanner les codes-barres médicaments</string>
```

## Screens

| Fichier | Rôle |
|---------|------|
| `ScannerStockScreen.tsx` | Caméra plein écran — détecte EAN-13, QR, Code128 |
| `MedicamentInconnuScreen.tsx` | Formulaire one-time quand le code est inconnu |
| `FormulaireStockScreen.tsx` | Saisie quantité + détails (lot, péremption, motif) |

## Navigation (à ajouter dans App.tsx)

```tsx
// Dans le navigator admin/pharmacie
<Stack.Screen name="ScannerStockScreen" component={ScannerStockScreen} />
<Stack.Screen name="MedicamentInconnuScreen" component={MedicamentInconnuScreen} />
<Stack.Screen name="FormulaireStockScreen" component={FormulaireStockScreen} />
```

## Flux complet

```
PharmacieAdminScreen
  └─ Bouton "Scanner entrée" / "Scanner sortie"
       └─ ScannerStockScreen (mode: 'entree' | 'sortie')
            ├─ EAN/QR connu  → FormulaireStockScreen → POST /pharmacie/stock/entree|sortie
            └─ EAN/QR inconnu → MedicamentInconnuScreen → POST /pharmacie/ean
                                  └─ FormulaireStockScreen
```

## Import base de départ (une seule fois au déploiement)

```bash
curl -X POST https://votre-domaine.com/api/pharmacie/ean/import-base
```

Charge les 50 médicaments depuis `api/data/medicaments_base.json`.
Les champs `ean` sont vides — ils se remplissent automatiquement
au premier scan de chaque boîte en terrain.

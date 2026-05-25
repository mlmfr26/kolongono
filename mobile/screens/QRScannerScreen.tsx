import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration,
  StatusBar, Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { colors, spacing, radius, fontSize, fontWeight } from '../components/theme';
import { Icon, IconName } from '../components/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QRScanMode =
  | 'scan_produit'
  | 'scan_ordonnance'
  | 'scan_patient'
  | 'scan_unite';

export type QRScanResult = {
  raw: string;
  type: 'produit' | 'ordonnance' | 'patient' | 'unite' | 'barcode' | 'inconnu';
  id?: number;
  code?: string;
};

// Format QR Kolongono : KOLO:PROD:123:CODE | KOLO:ORD:456 | KOLO:PAT:789 | KOLO:UNITE:10
// Format fallback     : JSON compact {"t":"p","id":123} ou code-barre numérique EAN-13
function parseQRCode(raw: string): QRScanResult {
  const koloMatch = raw.match(/^KOLO:(PROD|ORD|PAT|UNITE):(\d+)(?::(.+))?$/);
  if (koloMatch) {
    const typeMap: Record<string, QRScanResult['type']> = {
      PROD: 'produit', ORD: 'ordonnance', PAT: 'patient', UNITE: 'unite',
    };
    return { raw, type: typeMap[koloMatch[1]], id: parseInt(koloMatch[2], 10), code: koloMatch[3] };
  }
  if (/^\d{8,14}$/.test(raw)) return { raw, type: 'barcode', code: raw };
  try {
    const obj = JSON.parse(raw);
    if (obj.t && obj.id) {
      const typeMap2: Record<string, QRScanResult['type']> = { p: 'produit', o: 'ordonnance', pa: 'patient', u: 'unite' };
      return { raw, type: typeMap2[obj.t] ?? 'inconnu', id: obj.id, code: obj.code };
    }
  } catch {}
  return { raw, type: 'inconnu' };
}

const MODE_CONFIG: Record<QRScanMode, { iconName: IconName; hint: string }> = {
  scan_produit:    { iconName: 'pill',       hint: 'Code QR ou code-barre médicament' },
  scan_ordonnance: { iconName: 'clipboard',  hint: 'QR code ordonnance KOLO:ORD:…' },
  scan_patient:    { iconName: 'user-circle', hint: 'Carte de membre Kolongono' },
  scan_unite:      { iconName: 'hospital',   hint: 'QR code du dispensaire / clinique' },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = {
  route: { params: { mode?: QRScanMode; title?: string; returnTo?: string } };
  navigation: any;
};

export default function QRScannerScreen({ route, navigation }: Props) {
  const { mode = 'scan_produit', title, returnTo } = route.params ?? {};
  const cfg = MODE_CONFIG[mode];

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isActive, setIsActive]   = useState(true);
  const [flashOn,  setFlashOn]    = useState(false);
  const [result,   setResult]     = useState<QRScanResult | null>(null);
  const [cooldown, setCooldown]   = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const onCodeScanned = useCallback((codes: any[]) => {
    if (cooldown || codes.length === 0) return;
    const raw = codes[0].value;
    if (!raw) return;

    const parsed = parseQRCode(raw);
    Vibration.vibrate(80);
    setCooldown(true);
    setResult(parsed);
    setIsActive(false);

    setTimeout(() => {
      if (returnTo) {
        navigation.navigate(returnTo, { scanResult: parsed });
      } else {
        navigation.goBack();
      }
    }, 1100);
  }, [cooldown, navigation, returnTo]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39'],
    onCodeScanned,
  });

  // ── Permission manquante ──
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Icon name="camera" size={52} color={colors.textLight} strokeWidth={1.2} />
        <Text style={styles.centeredTitle}>Accès caméra requis</Text>
        <Text style={styles.centeredSub}>Pour scanner les QR codes, autorisez l'accès à la caméra dans les paramètres.</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={requestPermission}>
          <Text style={styles.actionBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.textLight, fontSize: fontSize.sm }}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Icon name="video-off" size={52} color={colors.textLight} strokeWidth={1.2} />
        <Text style={styles.centeredTitle}>Caméra indisponible</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl }}>
          <Text style={{ color: colors.textLight, fontSize: fontSize.sm }}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        codeScanner={codeScanner}
        torch={flashOn ? 'on' : 'off'}
      />

      {/* Masques sombres autour du cadre de scan */}
      <View style={styles.maskTop} />
      <View style={styles.maskMiddle}>
        <View style={styles.maskSide} />
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          {result && <View style={styles.scanSuccess} />}
        </View>
        <View style={styles.maskSide} />
      </View>
      <View style={styles.maskBottom} />

      {/* Barre supérieure */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.iconBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{title ?? `Scanner (${mode.replace('scan_', '')})`}</Text>
        <TouchableOpacity style={[styles.iconBtn, flashOn && styles.iconBtnOn]} onPress={() => setFlashOn(f => !f)}>
          <Text style={styles.iconBtnText}>⚡</Text>
        </TouchableOpacity>
      </View>

      {/* Zone inférieure — hint ou résultat */}
      <View style={styles.bottomPanel}>
        {result ? (
          <View style={styles.resultRow}>
            <Icon name="check-circle" size={28} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultType}>{result.type.toUpperCase()} — {result.id ? `#${result.id}` : result.code}</Text>
              <Text style={styles.resultRaw} numberOfLines={1}>{result.raw}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.hintBox}>
            <Icon name={cfg.iconName} size={28} color="rgba(255,255,255,0.5)" style={{ marginBottom: spacing.xs }} />
            <Text style={styles.hintMain}>{cfg.hint}</Text>
            <Text style={styles.hintSub}>Centrez le code dans le cadre blanc</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FRAME = 240;
const C     = 28;
const CW    = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  centered: {
    flex: 1, backgroundColor: colors.bg,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.xxxl, gap: spacing.md,
  },
  centeredTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.text, textAlign: 'center' },
  centeredSub:   { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  actionBtn:     { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing.xxxl, paddingVertical: spacing.lg, marginTop: spacing.md },
  actionBtnText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.black },

  // Masques
  maskTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: '25%', backgroundColor: 'rgba(0,0,0,0.62)' },
  maskMiddle: { position: 'absolute', top: '25%', left: 0, right: 0, height: FRAME, flexDirection: 'row' },
  maskSide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  maskBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, top: `calc(25% + ${FRAME}px)` as any, backgroundColor: 'rgba(0,0,0,0.62)' },

  scanFrame: { width: FRAME, height: FRAME, position: 'relative' },
  corner:    { position: 'absolute', width: C, height: C, borderColor: '#FFF', borderRadius: 3 },
  cTL: { top: 0,    left: 0,    borderTopWidth: CW,    borderLeftWidth: CW   },
  cTR: { top: 0,    right: 0,   borderTopWidth: CW,    borderRightWidth: CW  },
  cBL: { bottom: 0, left: 0,    borderBottomWidth: CW, borderLeftWidth: CW   },
  cBR: { bottom: 0, right: 0,   borderBottomWidth: CW, borderRightWidth: CW  },
  scanSuccess: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,163,74,0.25)',
    borderWidth: 2, borderColor: colors.primary, borderRadius: 4,
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 52 : spacing.xl,
    paddingBottom: spacing.md,
  },
  iconBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  iconBtnOn:  { backgroundColor: colors.warning },
  iconBtnText:{ color: '#FFF', fontSize: 16 },
  topTitle:   { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  hintBox:  { alignItems: 'center', gap: spacing.xs },
  hintMain: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
  hintSub:  { color: 'rgba(255,255,255,0.45)', fontSize: fontSize.sm, textAlign: 'center' },

  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(22,163,74,0.92)', borderRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, width: '100%',
  },
  resultType: { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.black },
  resultRaw:  { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs, marginTop: 2 },
});

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Vibration, Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../components/theme';
import { apiClient } from '../../components/api';

type ScanMode = 'entree' | 'sortie';

interface Props {
  route: { params: { mode: ScanMode; centreId: string; operateur: string } };
}

export default function ScannerStockScreen({ route }: Props) {
  const { mode, centreId, operateur } = route.params;
  const navigation = useNavigation<any>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const cooldownRef = useRef(false);

  const device = useCameraDevice('back');

  useEffect(() => {
    Camera.requestCameraPermission().then(status => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const handleCode = useCallback(async (value: string) => {
    if (cooldownRef.current || value === lastScan || loading) return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 2000);

    setLastScan(value);
    setLoading(true);
    Vibration.vibrate(80);

    try {
      const response = await apiClient.get(`/pharmacie/ean/${value}`);
      const medicament = response.data;

      setIsActive(false);
      navigation.navigate('FormulaireStockScreen', {
        medicament,
        mode,
        centreId,
        operateur,
        codeScanne: value,
      });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        const isQR = value.startsWith('MED-') || !(/^\d{8,13}$/.test(value));
        setIsActive(false);
        navigation.navigate('MedicamentInconnuScreen', {
          codeScanne: value,
          typeCode: isQR ? 'qr' : 'ean',
          mode,
          centreId,
          operateur,
        });
      } else {
        Alert.alert('Erreur réseau', 'Vérifiez votre connexion et réessayez.');
      }
    } finally {
      setLoading(false);
    }
  }, [lastScan, loading, mode, centreId, operateur, navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'qr', 'code-128'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        handleCode(codes[0].value);
      }
    },
  });

  // Réactivation du scanner au retour sur l'écran
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => setIsActive(true));
    return unsubscribe;
  }, [navigation]);

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.permText}>Demande d'accès à la caméra...</Text>
      </View>
    );
  }

  if (hasPermission === false || !device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>
          {!device ? 'Caméra arrière indisponible.' : 'Accès caméra refusé.'}
        </Text>
        <Text style={styles.permSub}>
          Activez l'accès dans les paramètres de l'application.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Caméra plein écran */}
      <Camera
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={isActive && !loading}
        codeScanner={codeScanner}
      />

      {/* Overlay UI */}
      <View style={styles.overlay}>

        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {mode === 'entree' ? 'Réception stock' : 'Dispensation'}
            </Text>
            <Text style={styles.headerSub}>
              {mode === 'entree'
                ? 'Scannez le code-barres ou QR de la boîte'
                : 'Scannez le médicament à dispenser'}
            </Text>
          </View>
          <View style={[styles.modeBadge, mode === 'entree' ? styles.badgeGreen : styles.badgeAmber]}>
            <Text style={styles.modeBadgeText}>
              {mode === 'entree' ? 'ENTRÉE' : 'SORTIE'}
            </Text>
          </View>
        </View>

        {/* Viseur central */}
        <View style={styles.viewfinderArea}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {!loading && <View style={styles.scanLine} />}

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Recherche...</Text>
              </View>
            )}
          </View>

          <Text style={styles.hint}>
            {loading
              ? 'Vérification en cours...'
              : 'Pointez vers EAN-13 (boîte fabricant) ou QR Code maison'}
          </Text>
        </View>

        {/* Pied de page — saisie manuelle */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => {
              setIsActive(false);
              navigation.navigate('MedicamentInconnuScreen', {
                codeScanne: null,
                typeCode: 'manuel',
                mode,
                centreId,
                operateur,
              });
            }}
          >
            <Text style={styles.manualBtnText}>Saisie manuelle</Text>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            {lastScan ? `Dernier scan : ${lastScan.slice(0, 14)}...` : 'Aucun scan effectué'}
          </Text>
        </View>

      </View>
    </View>
  );
}

const VIEWFINDER_SIZE = 260;
const CORNER = 22;
const BORDER = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 24 },
  permText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  permSub: { color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 8, textAlign: 'center' },

  overlay: { flex: 1, justifyContent: 'space-between' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,.55)',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,.65)', fontSize: 12, marginTop: 2 },
  modeBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeGreen: { backgroundColor: 'rgba(16,185,129,.85)' },
  badgeAmber: { backgroundColor: 'rgba(217,119,6,.85)' },
  modeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  viewfinderArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  viewfinder: {
    width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE,
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: CORNER, height: CORNER,
    borderColor: '#fff', borderWidth: BORDER,
  },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanLine: {
    position: 'absolute', left: 8, right: 8, height: 2,
    backgroundColor: theme.colors.primary, opacity: 0.9,
  },
  loadingOverlay: { alignItems: 'center', gap: 10 },
  loadingText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hint: {
    color: 'rgba(255,255,255,.75)', fontSize: 13, textAlign: 'center',
    paddingHorizontal: 32, lineHeight: 18,
  },

  footer: {
    backgroundColor: 'rgba(0,0,0,.55)', paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 16,
    alignItems: 'center', gap: 10,
  },
  manualBtn: {
    backgroundColor: 'rgba(255,255,255,.15)', borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,.3)', width: '100%', alignItems: 'center',
  },
  manualBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footerNote: { color: 'rgba(255,255,255,.4)', fontSize: 11 },
});

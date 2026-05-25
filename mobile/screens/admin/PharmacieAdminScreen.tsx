import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../../components/theme';
import { Icon } from '../../components/Icons';
import type { QRScanResult } from '../QRScannerScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Produit = {
  id: string; nom: string; categorie: string;
  prix: number; stock: number; unite: string; ordonnance_requise: boolean;
};

type Mouvement = {
  id: number; produit_nom: string; type_mouvement: string;
  quantite: number; motif: string; utilisateur_nom: string;
  scan_qr: boolean; created_at: string;
};

type Tab = 'catalogue' | 'mouvements';

const MOUV_TYPE: Record<string, { label: string; color: string; sign: string }> = {
  entree:     { label: 'Entrée',     color: colors.primary,   sign: '+' },
  sortie:     { label: 'Sortie',     color: colors.pharmacie, sign: '−' },
  inventaire: { label: 'Inventaire', color: colors.info,      sign: '±' },
  transfert:  { label: 'Transfert',  color: colors.accent,    sign: '→' },
  peremption: { label: 'Péremption', color: colors.danger,    sign: '×' },
};

// ─── Modale de mouvement de stock ─────────────────────────────────────────────

type MouvModalProps = {
  visible: boolean;
  produit?: Produit | null;
  typeMouvement: 'entree' | 'sortie';
  onClose: () => void;
  onConfirm: (data: { produit_id: number; type: string; quantite: number; motif: string; scan_qr: boolean }) => void;
};

function MouvModal({ visible, produit, typeMouvement, onClose, onConfirm }: MouvModalProps) {
  const [quantite, setQuantite] = useState('');
  const [motif,    setMotif]    = useState('');

  useEffect(() => {
    if (visible) { setQuantite(''); setMotif(''); }
  }, [visible]);

  const cfg = MOUV_TYPE[typeMouvement];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mStyles.backdrop}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <View style={mStyles.header}>
            <View style={[mStyles.iconBg, { backgroundColor: cfg.color + '18' }]}>
              <Text style={[mStyles.iconText, { color: cfg.color }]}>{cfg.sign}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mStyles.title}>{cfg.label} de stock</Text>
              <Text style={mStyles.subtitle} numberOfLines={1}>{produit?.nom ?? 'Produit non sélectionné'}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {produit && (
            <View style={mStyles.stockInfo}>
              <Text style={mStyles.stockInfoText}>Stock actuel : <Text style={{ fontWeight: fontWeight.black, color: colors.primaryDark }}>{produit.stock}</Text></Text>
            </View>
          )}

          <Text style={mStyles.label}>Quantité</Text>
          <TextInput
            style={mStyles.input}
            value={quantite}
            onChangeText={v => setQuantite(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="Ex : 50"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={mStyles.label}>Motif / Commentaire</Text>
          <TextInput
            style={[mStyles.input, mStyles.inputMulti]}
            value={motif}
            onChangeText={setMotif}
            placeholder="Réapprovisionnement, dispensation, inventaire…"
            placeholderTextColor={colors.placeholder}
            multiline
          />

          <TouchableOpacity
            style={[mStyles.confirmBtn, { backgroundColor: cfg.color }]}
            onPress={() => {
              const qty = parseInt(quantite, 10);
              if (!qty || qty <= 0) { Alert.alert('Erreur', 'Quantité invalide.'); return; }
              if (!produit) { Alert.alert('Erreur', 'Produit non sélectionné.'); return; }
              onConfirm({ produit_id: parseInt(produit.id), type: typeMouvement, quantite: qty, motif, scan_qr: false });
              onClose();
            }}
          >
            <Text style={mStyles.confirmBtnText}>Confirmer {cfg.label.toLowerCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function PharmacieAdminScreen({ route, navigation }: any) {
  const { token } = useAuth();

  const [activeTab, setActiveTab]   = useState<Tab>('catalogue');
  const [produits,  setProduits]    = useState<Produit[]>([]);
  const [mouvements,setMouvements]  = useState<Mouvement[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [recherche, setRecherche]   = useState('');
  const [filtre,    setFiltre]      = useState<'tout' | 'bas_stock'>('tout');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalType,    setModalType]    = useState<'entree' | 'sortie'>('entree');
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);

  // Réception résultat QR scanner
  useEffect(() => {
    const scan: QRScanResult | undefined = route?.params?.scanResult;
    if (!scan) return;
    if (scan.type === 'produit' && scan.id) {
      const found = produits.find(p => p.id === String(scan.id));
      if (found) {
        setSelectedProduit(found);
        setModalType(route?.params?.mouvType ?? 'entree');
        setModalOpen(true);
      } else {
        Alert.alert('Produit non trouvé', `QR code scanné : #${scan.id}\nProduit introuvable dans le catalogue.`);
      }
    }
  }, [route?.params?.scanResult]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get<{ produits: Produit[] }>('/api/pharmacie/produits', token),
      api.get<{ mouvements: Mouvement[] }>('/api/pharmacie/mouvements', token),
    ])
      .then(([p, m]) => {
        if (!cancelled) {
          setProduits(p.produits ?? []);
          setMouvements(m.mouvements ?? []);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]));

  const filteredProduits = produits.filter(p => {
    const matchSearch = !recherche || p.nom.toLowerCase().includes(recherche.toLowerCase());
    const matchFiltre = filtre === 'tout' || (filtre === 'bas_stock' && p.stock < 50);
    return matchSearch && matchFiltre;
  });

  const basStock = produits.filter(p => p.stock < 50).length;
  const rupture  = produits.filter(p => p.stock === 0).length;

  async function enregistrerMouvement(data: { produit_id: number; type: string; quantite: number; motif: string; scan_qr: boolean }) {
    try {
      await api.post('/api/pharmacie/mouvements', {
        produit_id: data.produit_id,
        type_mouvement: data.type,
        quantite: data.quantite,
        motif: data.motif,
        scan_qr: data.scan_qr,
      }, token);
      // Refresh data
      const [p, m] = await Promise.all([
        api.get<{ produits: Produit[] }>('/api/pharmacie/produits', token),
        api.get<{ mouvements: Mouvement[] }>('/api/pharmacie/mouvements', token),
      ]);
      setProduits(p.produits ?? []);
      setMouvements(m.mouvements ?? []);
      Alert.alert('Enregistré', 'Mouvement de stock enregistré avec succès.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer le mouvement.');
    }
  }

  function ouvrirScanner(mouvType: 'entree' | 'sortie') {
    navigation.navigate('QRScanner', {
      mode: 'scan_produit',
      title: mouvType === 'entree' ? 'Scanner — Entrée stock' : 'Scanner — Sortie stock',
      returnTo: 'PharmacieAdmin',
      mouvType,
    });
  }

  function ouvrirScannerEAN(mouvType: 'entree' | 'sortie') {
    const centreId  = route?.params?.centreId  ?? 'CTR-001';
    const operateur = route?.params?.operateur ?? 'agent';
    navigation.navigate('ScannerStockScreen', { mode: mouvType, centreId, operateur });
  }

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Pharmacie — Administration</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.scanFab, { backgroundColor: '#059669' }]}
              onPress={() => ouvrirScannerEAN('entree')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="scan" size={15} color="#fff" />
                <Text style={styles.scanFabText}>Entrée</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scanFab, { backgroundColor: '#D97706' }]}
              onPress={() => ouvrirScannerEAN('sortie')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="scan" size={15} color="#fff" />
                <Text style={styles.scanFabText}>Sortie</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.hStat}><Text style={styles.hStatVal}>{produits.length}</Text><Text style={styles.hStatLbl}>produits</Text></View>
          <View style={styles.hStatDiv} />
          <View style={styles.hStat}><Text style={[styles.hStatVal, basStock > 0 && styles.hStatValWarn]}>{basStock}</Text><Text style={styles.hStatLbl}>bas stock</Text></View>
          <View style={styles.hStatDiv} />
          <View style={styles.hStat}><Text style={[styles.hStatVal, rupture > 0 && styles.hStatValAlert]}>{rupture}</Text><Text style={styles.hStatLbl}>rupture</Text></View>
          <View style={styles.hStatDiv} />
          <View style={styles.hStat}><Text style={styles.hStatVal}>{mouvements.length}</Text><Text style={styles.hStatLbl}>mouvements</Text></View>
        </View>
      </View>

      {/* Tabs Catalogue / Mouvements */}
      <View style={styles.tabRow}>
        {(['catalogue', 'mouvements'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'catalogue' ? '💊 Catalogue' : '📋 Mouvements'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.pharmacie} />
        </View>
      ) : (
        <>
          {/* ── TAB CATALOGUE ── */}
          {activeTab === 'catalogue' && (
            <>
              <View style={styles.searchBar}>
                <Icon name="search" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={recherche}
                  onChangeText={setRecherche}
                  placeholder="Rechercher un produit…"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              <View style={styles.filterRow}>
                {[['tout', 'Tous'], ['bas_stock', 'Bas stock (< 50)']].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.filterChip, filtre === key && styles.filterChipActive]}
                    onPress={() => setFiltre(key as any)}
                  >
                    <Text style={[styles.filterChipText, filtre === key && styles.filterChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {filteredProduits.map(p => {
                  const stockAlert = p.stock === 0 ? 'rupture' : p.stock < 20 ? 'critique' : p.stock < 50 ? 'faible' : 'ok';
                  return (
                    <View key={p.id} style={[styles.prodCard, stockAlert === 'rupture' && styles.prodCardRupture]}>
                      <View style={styles.prodHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prodNom}>{p.nom}</Text>
                          <Text style={styles.prodCat}>{p.categorie} · {p.unite}</Text>
                          {p.ordonnance_requise && <Text style={styles.ordTag}>Ordonnance</Text>}
                        </View>
                        <View style={styles.prodActions}>
                          <Text style={styles.prodPrix}>{p.prix.toLocaleString()} FC</Text>
                          {/* Boutons entrée / sortie rapides */}
                          <View style={styles.prodBtns}>
                            <TouchableOpacity
                              style={[styles.prodBtn, { backgroundColor: colors.primaryLight }]}
                              onPress={() => { setSelectedProduit(p); setModalType('entree'); setModalOpen(true); }}
                            >
                              <Text style={[styles.prodBtnText, { color: colors.primaryDark }]}>+ Entrée</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.prodBtn, { backgroundColor: '#E0F2FE' }]}
                              onPress={() => { setSelectedProduit(p); setModalType('sortie'); setModalOpen(true); }}
                            >
                              <Text style={[styles.prodBtnText, { color: colors.pharmacie }]}>− Sortie</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      <View style={styles.stockRow}>
                        <View style={styles.stockBar}>
                          <View style={[styles.stockFill, {
                            width: `${Math.min((p.stock / 300) * 100, 100)}%` as any,
                            backgroundColor: stockAlert === 'rupture' ? colors.danger : stockAlert === 'critique' ? '#EF4444' : stockAlert === 'faible' ? colors.warning : colors.primary,
                          }]} />
                        </View>
                        <View style={[styles.stockBadge, {
                          backgroundColor: stockAlert === 'ok' ? colors.primaryLight : stockAlert === 'faible' ? colors.warningLight : colors.dangerLight,
                        }]}>
                          <Text style={[styles.stockBadgeText, {
                            color: stockAlert === 'ok' ? colors.primaryDark : stockAlert === 'faible' ? colors.warning : colors.danger,
                          }]}>
                            {p.stock === 0 ? 'RUPTURE' : `${p.stock} unités`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
                <View style={{ height: 120 }} />
              </ScrollView>
            </>
          )}

          {/* ── TAB MOUVEMENTS ── */}
          {activeTab === 'mouvements' && (
            <>
              {/* Actions rapides QR */}
              <View style={styles.qrActionsRow}>
                <TouchableOpacity style={[styles.qrActionBtn, { borderColor: colors.primary }]} onPress={() => ouvrirScanner('entree')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="scan" size={13} color={colors.primary} />
                    <Text style={[styles.qrActionText, { color: colors.primary }]}>+ Entrée QR</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.qrActionBtn, { borderColor: colors.pharmacie }]} onPress={() => ouvrirScanner('sortie')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="scan" size={13} color={colors.pharmacie} />
                    <Text style={[styles.qrActionText, { color: colors.pharmacie }]}>− Sortie QR</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.qrActionBtn, { borderColor: colors.info }]}
                  onPress={() => navigation.navigate('QRScanner', { mode: 'scan_ordonnance', title: 'Dispenser ordonnance', returnTo: 'PharmacieAdmin' })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="clipboard" size={13} color={colors.info} />
                    <Text style={[styles.qrActionText, { color: colors.info }]}>Ordonnance</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {mouvements.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Icon name="clipboard" size={40} color={colors.textLight} strokeWidth={1.2} />
                    <Text style={styles.emptyText}>Aucun mouvement enregistré</Text>
                  </View>
                ) : (
                  mouvements.map(m => {
                    const cfg = MOUV_TYPE[m.type_mouvement] ?? { label: m.type_mouvement, color: colors.textMuted, sign: '·' };
                    return (
                      <View key={m.id} style={styles.mouvCard}>
                        <View style={[styles.mouvSignBox, { backgroundColor: cfg.color + '18' }]}>
                          <Text style={[styles.mouvSign, { color: cfg.color }]}>{cfg.sign}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mouvProduit}>{m.produit_nom}</Text>
                          <Text style={styles.mouvMeta}>
                            {cfg.label} · {m.utilisateur_nom}
                            {m.scan_qr ? ' · ⬛ QR' : ''}
                          </Text>
                          {m.motif ? <Text style={styles.mouvMotif}>{m.motif}</Text> : null}
                        </View>
                        <View style={styles.mouvQtyCol}>
                          <Text style={[styles.mouvQty, { color: cfg.color }]}>{cfg.sign}{Math.abs(m.quantite)}</Text>
                          <Text style={styles.mouvDate}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
                <View style={{ height: 120 }} />
              </ScrollView>
            </>
          )}
        </>
      )}

      {/* Modale mouvement */}
      <MouvModal
        visible={modalOpen}
        produit={selectedProduit}
        typeMouvement={modalType}
        onClose={() => setModalOpen(false)}
        onConfirm={enregistrerMouvement}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const mStyles = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: colors.card, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: 36 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconBg:      { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  iconText:    { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  title:       { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  subtitle:    { fontSize: fontSize.sm, color: colors.textMuted },
  stockInfo:   { backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  stockInfoText: { fontSize: fontSize.sm, color: colors.primaryDark },
  label:       { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium, marginBottom: spacing.xs, marginTop: spacing.sm },
  input:       { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, color: colors.text },
  inputMulti:  { height: 72, textAlignVertical: 'top' },
  confirmBtn:  { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg },
  confirmBtnText: { color: '#FFF', fontWeight: fontWeight.black, fontSize: fontSize.md },
});

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primaryDark, paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  headerTitle:  { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  scanFab:      { backgroundColor: colors.pharmacie, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  scanFabText:  { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.black },
  headerStats:  { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: spacing.md },
  hStat:        { flex: 1, alignItems: 'center' },
  hStatVal:     { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  hStatValWarn: { color: '#FDE68A' },
  hStatValAlert:{ color: '#FCA5A5' },
  hStatLbl:     { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs },
  hStatDiv:     { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  tabRow:    { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:       { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.pharmacie },
  tabText:   { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  tabTextActive: { color: colors.pharmacie, fontWeight: fontWeight.black },

  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.xl, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 48, fontSize: fontSize.md, color: colors.text, marginLeft: spacing.sm },

  filterRow:   { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  filterChip:        { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive:  { backgroundColor: colors.pharmacie, borderColor: colors.pharmacie },
  filterChipText:    { fontSize: fontSize.sm, color: colors.textMuted },
  filterChipTextActive: { color: '#FFF', fontWeight: fontWeight.bold },

  qrActionsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  qrActionBtn:  { flex: 1, borderWidth: 1.5, borderRadius: radius.xl, paddingVertical: spacing.sm, alignItems: 'center' },
  qrActionText: { fontSize: fontSize.xs, fontWeight: fontWeight.black },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md },

  prodCard:        { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.sm, ...shadow.sm },
  prodCardRupture: { borderWidth: 1, borderColor: colors.danger },
  prodHeader:  { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  prodNom:     { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  prodCat:     { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  ordTag:      { color: colors.warning, fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 4 },
  prodActions: { alignItems: 'flex-end', gap: spacing.xs },
  prodPrix:    { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.pharmacie },
  prodBtns:    { flexDirection: 'row', gap: spacing.xs },
  prodBtn:     { borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  prodBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.black },
  stockRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stockBar:    { flex: 1, height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' },
  stockFill:   { height: '100%', borderRadius: 3 },
  stockBadge:  { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  stockBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  mouvCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  mouvSignBox:  { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mouvSign:     { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  mouvProduit:  { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  mouvMeta:     { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  mouvMotif:    { fontSize: fontSize.xs, color: colors.textLight, fontStyle: 'italic', marginTop: 1 },
  mouvQtyCol:   { alignItems: 'flex-end' },
  mouvQty:      { fontSize: fontSize.md, fontWeight: fontWeight.black },
  mouvDate:     { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
});

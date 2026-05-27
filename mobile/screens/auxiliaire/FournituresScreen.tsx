/**
 * FournituresScreen — Auxiliaire de santé
 * Deux fonctions exclusives à l'auxiliaire :
 *  1. Commander les fournitures de premier secours (produits sans ordonnance)
 *  2. Renouveler une ordonnance quand le médecin l'a autorisé
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon } from '../../components/Icons';

dayjs.locale('fr');

type Fourniture = {
  id: string;
  nom: string;
  categorie: string;
  unite: string;
  stock: number;
  prix: number;
};

type OrdonnanceRenouvelable = {
  id: string;
  patient: { id: string; prenom: string; nom: string };
  medecin: string;
  diagnostic: string;
  date: string;
  produits: { nom: string; posologie: string; quantite: number }[];
  nb_renouvellements_restants: number;
  date_expiration: string;
};

type CartItem = { fourniture: Fourniture; quantite: number };

type Tab = 'fournitures' | 'renouvellements';

export default function FournituresScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [tab,          setTab]          = useState<Tab>('fournitures');
  const [fournitures,  setFournitures]  = useState<Fourniture[]>([]);
  const [ordonnances,  setOrdonnances]  = useState<OrdonnanceRenouvelable[]>([]);
  const [panier,       setPanier]       = useState<CartItem[]>([]);
  const [categorie,    setCategorie]    = useState('Tous');
  const [recherche,    setRecherche]    = useState('');
  const [loading,      setLoading]      = useState(false);
  const [sending,      setSending]      = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    api.get<{ fournitures: Fourniture[] }>('/api/pharmacie/fournitures', token)
      .then(d => { if (!cancelled && d.fournitures) setFournitures(d.fournitures); })
      .catch(() => {});
    api.get<{ ordonnances: OrdonnanceRenouvelable[] }>(`/api/consultations/ordonnances/renouvelables?auxiliaire_id=${user?.id}`, token)
      .then(d => { if (!cancelled && d.ordonnances) setOrdonnances(d.ordonnances); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, user?.id]));

  const categories = ['Tous', ...Array.from(new Set(fournitures.map(f => f.categorie)))];
  const filtered = fournitures.filter(f => {
    const matchCat = categorie === 'Tous' || f.categorie === categorie;
    const matchSearch = !recherche || f.nom.toLowerCase().includes(recherche.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(f: Fourniture) {
    setPanier(prev => {
      const ex = prev.find(i => i.fourniture.id === f.id);
      if (ex) return prev.map(i => i.fourniture.id === f.id ? { ...i, quantite: i.quantite + 1 } : i);
      return [...prev, { fourniture: f, quantite: 1 }];
    });
  }
  function removeFromCart(id: string) { setPanier(p => p.filter(i => i.fourniture.id !== id)); }
  function decrement(id: string) {
    setPanier(p => {
      const item = p.find(i => i.fourniture.id === id);
      if (!item || item.quantite === 1) return p.filter(i => i.fourniture.id !== id);
      return p.map(i => i.fourniture.id === id ? { ...i, quantite: i.quantite - 1 } : i);
    });
  }

  const totalFC = panier.reduce((s, i) => s + i.fourniture.prix * i.quantite, 0);
  const nbItems = panier.reduce((s, i) => s + i.quantite, 0);

  async function commanderFournitures() {
    if (!panier.length) return;
    Alert.alert(
      'Confirmer la commande',
      `${nbItems} article(s) · ${totalFC.toLocaleString()} FC\n\nFournitures de premier secours`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Commander', onPress: async () => {
            setSending(true);
            try {
              await api.post('/api/pharmacie/commandes', {
                auxiliaire_id: user?.id,
                type: 'fournitures_premier_secours',
                produits: panier.map(i => ({ produit_id: i.fourniture.id, quantite: i.quantite })),
              }, token);
              setPanier([]);
              Alert.alert('Commande envoyée', 'Vos fournitures de premier secours seront livrées prochainement.');
            } catch (err: any) {
              Alert.alert('Erreur', err.message ?? 'Impossible d\'envoyer la commande.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  async function renouvelerOrdonnance(ord: OrdonnanceRenouvelable) {
    Alert.alert(
      'Renouveler l\'ordonnance',
      `Patient : ${ord.patient.prenom} ${ord.patient.nom}\nMédecin : ${ord.medecin}\nDiagnostic : ${ord.diagnostic}\n\nRenouvellements restants : ${ord.nb_renouvellements_restants}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', onPress: async () => {
            setSending(true);
            try {
              await api.post(`/api/consultations/ordonnances/${ord.id}/renouveler`, {
                auxiliaire_id: user?.id,
                patient_id: ord.patient.id,
              }, token);
              setOrdonnances(prev => prev.map(o =>
                o.id === ord.id
                  ? { ...o, nb_renouvellements_restants: o.nb_renouvellements_restants - 1 }
                  : o,
              ).filter(o => o.nb_renouvellements_restants > 0));
              Alert.alert('Renouvellement effectué', `L'ordonnance de ${ord.patient.prenom} ${ord.patient.nom} a été renouvelée. La commande pharmacie est en cours.`);
            } catch (err: any) {
              Alert.alert('Erreur', err.message ?? 'Impossible de renouveler.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Fournitures & Renouvellements</Text>
          <Text style={styles.headerSub}>Auxiliaire de santé</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'fournitures' && styles.tabActive]} onPress={() => setTab('fournitures')}>
          <Icon name="package" size={14} color={tab === 'fournitures' ? palette.greenDeep : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'fournitures' && styles.tabTextActive]}>Premier secours</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'renouvellements' && styles.tabActive]} onPress={() => setTab('renouvellements')}>
          <Icon name="refresh" size={14} color={tab === 'renouvellements' ? palette.blueDeep : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'renouvellements' && styles.tabTextActive]}>
            Renouvellements
            {ordonnances.length > 0 && (
              <Text style={styles.tabBadge}> {ordonnances.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB : Fournitures premier secours ── */}
      {tab === 'fournitures' && (
        <>
          <View style={styles.searchBar}>
            <Icon name="search" size={15} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher…"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
            {categories.map(c => (
              <TouchableOpacity key={c} style={[styles.catChip, categorie === c && styles.catChipActive]} onPress={() => setCategorie(c)}>
                <Text style={[styles.catChipText, categorie === c && styles.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {filtered.map(f => {
              const inCart = panier.find(i => i.fourniture.id === f.id);
              return (
                <View key={f.id} style={styles.prodCard}>
                  <View style={styles.prodInfo}>
                    <View style={styles.prodIconWrap}>
                      <Icon name="bandage" size={18} color={palette.greenDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prodNom}>{f.nom}</Text>
                      <Text style={styles.prodCat}>{f.categorie} · {f.unite}</Text>
                      <Text style={[styles.prodStock, f.stock < 10 && styles.prodStockLow]}>
                        Stock : {f.stock} {f.stock < 10 ? '— faible' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.prodRight}>
                    <Text style={styles.prodPrix}>{f.prix.toLocaleString()} FC</Text>
                    {inCart ? (
                      <View style={styles.qtyRow}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => decrement(f.id)}>
                          <Text style={styles.qtyBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyVal}>{inCart.quantite}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(f)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(f)}>
                        <Icon name="plus" size={18} color={palette.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ height: panier.length > 0 ? 120 : 40 }} />
          </ScrollView>

          {panier.length > 0 && (
            <TouchableOpacity style={styles.panierBar} onPress={commanderFournitures} activeOpacity={0.9}>
              <View style={styles.panierLeft}>
                <View style={styles.panierBadge}><Text style={styles.panierBadgeText}>{nbItems}</Text></View>
                <Text style={styles.panierText}>Commander les fournitures</Text>
              </View>
              {sending
                ? <ActivityIndicator size="small" color={palette.white} />
                : <Text style={styles.panierTotal}>{totalFC.toLocaleString()} FC</Text>}
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ── TAB : Renouvellements ── */}
      {tab === 'renouvellements' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.infoBanner}>
            <Icon name="info" size={14} color={palette.blueDeep} />
            <Text style={styles.infoText}>
              Vous ne pouvez renouveler une ordonnance que si le médecin l'a explicitement autorisé sur l'ordonnance ou dans le dossier du patient.
            </Text>
          </View>

          {ordonnances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="file-text" size={44} color={colors.textLight} strokeWidth={1.2} />
              <Text style={styles.emptyText}>Aucun renouvellement en attente</Text>
            </View>
          ) : (
            ordonnances.map(ord => (
              <View key={ord.id} style={styles.renouCard}>
                <View style={styles.renouHeader}>
                  <View style={styles.renouAvatar}>
                    <Text style={styles.renouAvatarText}>{ord.patient.prenom[0]}{ord.patient.nom[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.renouPatient}>{ord.patient.prenom} {ord.patient.nom}</Text>
                    <Text style={styles.renouMedecin}>{ord.medecin}</Text>
                  </View>
                  <View style={styles.renouBadge}>
                    <Text style={styles.renouBadgeText}>{ord.nb_renouvellements_restants} restant{ord.nb_renouvellements_restants > 1 ? 's' : ''}</Text>
                  </View>
                </View>

                <Text style={styles.renouDiag}>{ord.diagnostic}</Text>

                {ord.produits.map((p, i) => (
                  <View key={i} style={styles.renouProd}>
                    <Icon name="pill" size={12} color={palette.purpleDeep} />
                    <Text style={styles.renouProdText}>{p.nom} · {p.posologie}</Text>
                  </View>
                ))}

                <View style={styles.renouFooter}>
                  <Text style={styles.renouExpiry}>Valide jusqu'au {dayjs(ord.date_expiration).format('D MMM YYYY')}</Text>
                  <TouchableOpacity
                    style={[styles.renouBtn, sending && styles.renouBtnSending]}
                    onPress={() => renouvelerOrdonnance(ord)}
                    disabled={sending}
                    activeOpacity={0.85}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color={palette.white} />
                      : <>
                          <Icon name="refresh" size={14} color={palette.white} />
                          <Text style={styles.renouBtnText}>Renouveler</Text>
                        </>}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: palette.dark,
    paddingTop: 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: palette.white },
  headerSub:   { fontSize: fontSize.xs, color: 'rgba(255,255,255,.5)', marginTop: 2 },

  tabs:        { flexDirection: 'row', backgroundColor: palette.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:   { borderBottomColor: palette.greenDeep },
  tabText:     { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  tabTextActive:{ color: palette.greenDeep },
  tabBadge:    { color: palette.blueDeep, fontWeight: fontWeight.black },

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.white, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.xl, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, height: 44 },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  catScroll:   { maxHeight: 44 },
  catContent:  { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  catChip:        { borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, backgroundColor: palette.white, borderWidth: 1, borderColor: colors.border },
  catChipActive:  { backgroundColor: palette.greenDeep, borderColor: palette.greenDeep },
  catChipText:    { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  catChipTextActive:{ color: palette.white, fontWeight: fontWeight.bold },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },

  prodCard:   { backgroundColor: palette.white, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadow.xs },
  prodInfo:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prodIconWrap:{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: palette.greenSoft, justifyContent: 'center', alignItems: 'center' },
  prodNom:    { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  prodCat:    { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  prodStock:  { fontSize: fontSize.xs, color: colors.textLight, marginTop: 1 },
  prodStockLow:{ color: '#D97706' },
  prodRight:  { alignItems: 'flex-end', gap: spacing.xs },
  prodPrix:   { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: palette.greenDeep },
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 4 },
  qtyBtn:     { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: fontSize.lg, color: palette.greenDeep, fontWeight: fontWeight.black },
  qtyVal:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, minWidth: 18, textAlign: 'center' },
  addBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.greenDeep, justifyContent: 'center', alignItems: 'center' },

  panierBar:   { position: 'absolute', bottom: 20, left: spacing.lg, right: spacing.lg, backgroundColor: palette.dark, borderRadius: radius.full, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadow.xl },
  panierLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  panierBadge: { backgroundColor: palette.greenDeep, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  panierBadgeText:{ color: palette.white, fontSize: fontSize.xs, fontWeight: fontWeight.black },
  panierText:  { color: palette.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  panierTotal: { color: palette.green, fontSize: fontSize.md, fontWeight: fontWeight.black },

  infoBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: palette.blueSoft, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md },
  infoText:    { flex: 1, fontSize: fontSize.xs, color: palette.blueDeep, lineHeight: 18 },

  emptyBox:    { alignItems: 'center', paddingVertical: 56 },
  emptyText:   { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textMuted, marginTop: spacing.md },

  renouCard:   { backgroundColor: palette.white, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm, borderLeftWidth: 4, borderLeftColor: palette.blue },
  renouHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  renouAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.blue, justifyContent: 'center', alignItems: 'center' },
  renouAvatarText:{ fontSize: fontSize.md, fontWeight: fontWeight.black, color: palette.blueDeep },
  renouPatient:   { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text },
  renouMedecin:   { fontSize: fontSize.xs, color: colors.textMuted },
  renouBadge:     { backgroundColor: palette.blueSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  renouBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.blueDeep },
  renouDiag:      { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  renouProd:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  renouProdText:  { fontSize: fontSize.xs, color: colors.textMuted, flex: 1 },
  renouFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  renouExpiry:    { fontSize: fontSize.xs, color: colors.textMuted },
  renouBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.blueDeep, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  renouBtnSending:{ opacity: 0.6 },
  renouBtnText:   { color: palette.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});

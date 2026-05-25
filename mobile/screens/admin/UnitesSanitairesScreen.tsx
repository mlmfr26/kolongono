import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../../components/theme';
import { Icon, IconName } from '../../components/Icons';

type Unite = {
  id: number;
  nom: string;
  type: 'dispensaire' | 'clinique' | 'centre_sante' | 'pharmacie_partenaire' | 'poste_sante';
  zone: string;
  adresse: string;
  telephone: string;
  responsable_nom: string;
  statut: 'actif' | 'suspendu' | 'archive';
  capacite_lits: number;
  services: string[];
  qr_code: string;
  horaires: Record<string, string>;
  stats: { consultations_mois: number; medicaments_dispenses: number; personnel_actif: number };
};

const TYPE_CONFIG: Record<Unite['type'], { label: string; iconName: IconName; color: string }> = {
  dispensaire:          { label: 'Dispensaire',          iconName: 'hospital',     color: colors.primary     },
  clinique:             { label: 'Clinique',              iconName: 'building',     color: colors.info        },
  centre_sante:         { label: 'Centre de santé',       iconName: 'cross',        color: colors.accent      },
  pharmacie_partenaire: { label: 'Pharmacie partenaire',  iconName: 'pill',         color: colors.pharmacie   },
  poste_sante:          { label: 'Poste de santé',        iconName: 'stethoscope',  color: colors.auxiliaire  },
};

const TYPE_FILTRES = ['tout', 'dispensaire', 'clinique', 'centre_sante', 'pharmacie_partenaire', 'poste_sante'] as const;
type TypeFiltre = typeof TYPE_FILTRES[number];

export default function UnitesSanitairesScreen({ navigation }: any) {
  const { token }      = useAuth();
  const [unites,       setUnites]      = useState<Unite[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [recherche,    setRecherche]   = useState('');
  const [typeFiltre,   setTypeFiltre]  = useState<TypeFiltre>('tout');

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ unites: Unite[] }>('/api/unites', token)
      .then(d => { if (!cancelled) setUnites(d.unites ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]));

  const filtered = unites.filter(u => {
    const matchType = typeFiltre === 'tout' || u.type === typeFiltre;
    const matchSearch = !recherche || u.nom.toLowerCase().includes(recherche.toLowerCase()) || u.zone.toLowerCase().includes(recherche.toLowerCase());
    return matchType && matchSearch;
  });

  const actifs    = unites.filter(u => u.statut === 'actif').length;
  const totalConsult = unites.reduce((s, u) => s + u.stats.consultations_mois, 0);
  const totalMeds    = unites.reduce((s, u) => s + u.stats.medicaments_dispenses, 0);

  function confirmerArchiver(unite: Unite) {
    Alert.alert(
      'Archiver cette unité ?',
      `"${unite.nom}" sera désactivée et n'apparaîtra plus dans les listes actives.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/unites/${unite.id}/archiver`, token);
              setUnites(prev => prev.filter(u => u.id !== unite.id));
            } catch {
              Alert.alert('Erreur', 'Impossible d\'archiver cette unité.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Unités sanitaires</Text>
            <Text style={styles.headerSub}>Dispensaires & partenaires</Text>
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => navigation.navigate('UniteForm', { unite: null })}
          >
            <Text style={styles.newBtnText}>+ Nouvelle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerStats}>
          <View style={styles.hStat}>
            <Text style={styles.hStatVal}>{actifs}</Text>
            <Text style={styles.hStatLbl}>actives</Text>
          </View>
          <View style={styles.hStatDiv} />
          <View style={styles.hStat}>
            <Text style={styles.hStatVal}>{totalConsult}</Text>
            <Text style={styles.hStatLbl}>consultations/mois</Text>
          </View>
          <View style={styles.hStatDiv} />
          <View style={styles.hStat}>
            <Text style={styles.hStatVal}>{totalMeds}</Text>
            <Text style={styles.hStatLbl}>méd. dispensés</Text>
          </View>
        </View>
      </View>

      {/* Recherche */}
      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Nom, zone, commune…"
          placeholderTextColor={colors.placeholder}
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche('')}>
            <Icon name="x" size={16} color={colors.textMuted} style={{ paddingHorizontal: spacing.sm }} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres type */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {TYPE_FILTRES.map(t => {
          const cfg = t === 'tout' ? { label: 'Toutes', emoji: '🏥' } : { label: TYPE_CONFIG[t as Unite['type']].label, emoji: TYPE_CONFIG[t as Unite['type']].emoji };
          return (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFiltre === t && styles.filterChipActive]}
              onPress={() => setTypeFiltre(t)}
            >
              <Text style={styles.filterEmoji}>{cfg.emoji}</Text>
              <Text style={[styles.filterText, typeFiltre === t && styles.filterTextActive]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Liste */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>Chargement…</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.emptyView}>
              <Icon name="hospital" size={40} color={colors.textLight} strokeWidth={1.2} />
              <Text style={styles.emptyText}>Aucune unité trouvée</Text>
            </View>
          ) : (
            filtered.map(unite => {
              const cfg = TYPE_CONFIG[unite.type];
              return (
                <TouchableOpacity
                  key={unite.id}
                  style={styles.uniteCard}
                  onPress={() => navigation.navigate('UniteDetail', { uniteId: unite.id })}
                  activeOpacity={0.7}
                >
                  {/* En-tête carte */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: cfg.color + '18' }]}>
                      <Icon name={cfg.iconName} size={22} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardNom} numberOfLines={1}>{unite.nom}</Text>
                      <Text style={styles.cardZone}>{cfg.label} · {unite.zone}</Text>
                    </View>
                    <View style={[styles.statutBadge, { backgroundColor: unite.statut === 'actif' ? colors.primaryLight : colors.dangerLight }]}>
                      <Text style={[styles.statutText, { color: unite.statut === 'actif' ? colors.primaryDark : colors.danger }]}>
                        {unite.statut === 'actif' ? '● Actif' : unite.statut}
                      </Text>
                    </View>
                  </View>

                  {/* Infos */}
                  <View style={styles.cardInfoRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name="map-pin" size={12} color={colors.textMuted} />
                      <Text style={styles.cardInfoItem}>{unite.adresse.length > 30 ? unite.adresse.substring(0, 28) + '…' : unite.adresse}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name="user" size={12} color={colors.textMuted} />
                      <Text style={styles.cardInfoItem}>{unite.responsable_nom}</Text>
                    </View>
                  </View>

                  {/* Services */}
                  <View style={styles.servicesRow}>
                    {unite.services.slice(0, 4).map(s => (
                      <View key={s} style={styles.serviceChip}>
                        <Text style={styles.serviceChipText}>{s.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                    {unite.services.length > 4 && (
                      <View style={styles.serviceChip}>
                        <Text style={styles.serviceChipText}>+{unite.services.length - 4}</Text>
                      </View>
                    )}
                  </View>

                  {/* Stats du mois */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{unite.stats.consultations_mois}</Text>
                      <Text style={styles.statLbl}>consultations</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{unite.stats.medicaments_dispenses}</Text>
                      <Text style={styles.statLbl}>médicaments</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{unite.stats.personnel_actif}</Text>
                      <Text style={styles.statLbl}>personnel</Text>
                    </View>
                    {unite.capacite_lits > 0 && (
                      <View style={styles.statBox}>
                        <Text style={styles.statVal}>{unite.capacite_lits}</Text>
                        <Text style={styles.statLbl}>lits</Text>
                      </View>
                    )}
                  </View>

                  {/* Actions rapides */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionChip}
                      onPress={() => navigation.navigate('QRScanner', { mode: 'scan_unite', title: 'Scanner cette unité', returnTo: 'UniteDetail' })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="qr-code" size={12} color={colors.primaryDark} />
                        <Text style={styles.actionChipText}>QR</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionChip}
                      onPress={() => navigation.navigate('UniteDetail', { uniteId: unite.id, tab: 'personnel' })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="users" size={12} color={colors.primaryDark} />
                        <Text style={styles.actionChipText}>Personnel</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionChip}
                      onPress={() => navigation.navigate('UniteDetail', { uniteId: unite.id, tab: 'stock' })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="package" size={12} color={colors.primaryDark} />
                        <Text style={styles.actionChipText}>Stock</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionChip, styles.actionChipDanger]}
                      onPress={() => confirmerArchiver(unite)}
                    >
                      <Text style={[styles.actionChipText, { color: colors.danger }]}>Archiver</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.primaryDark,
    paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl,
  },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  headerTitle:{ color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:  { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm, marginTop: 2 },
  newBtn:     { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  newBtnText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.black },

  headerStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: spacing.md },
  hStat:       { flex: 1, alignItems: 'center' },
  hStatVal:    { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  hStatLbl:    { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs, marginTop: 1 },
  hStatDiv:    { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, marginHorizontal: spacing.lg, marginTop: spacing.md,
    borderRadius: radius.xl, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.sm,
  },
  searchInput: { flex: 1, height: 48, fontSize: fontSize.md, color: colors.text },

  filterScroll:  { maxHeight: 48, marginTop: spacing.sm },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  filterChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  filterEmoji:    { fontSize: 12 },
  filterText:     { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.medium },
  filterTextActive:{ color: '#FFF', fontWeight: fontWeight.bold },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  emptyView: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md },

  uniteCard: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  typeIcon:   { width: 48, height: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  cardNom:    { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  cardZone:   { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  statutBadge:{ borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statutText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  cardInfoRow: { gap: 4, marginBottom: spacing.sm },
  cardInfoItem:{ fontSize: fontSize.xs, color: colors.textLight },

  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  serviceChip: { backgroundColor: colors.infoLight, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  serviceChipText: { fontSize: 10, color: colors.info, fontWeight: fontWeight.medium },

  statsRow: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  statBox:  { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  statLbl:  { fontSize: 9, color: colors.textMuted, textAlign: 'center' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionChip: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  actionChipDanger: { borderColor: colors.dangerLight },
  actionChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: fontWeight.medium },
});

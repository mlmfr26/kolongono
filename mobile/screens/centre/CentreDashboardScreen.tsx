import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette, TAP_TARGET } from '../../components/theme';
import { Icon } from '../../components/Icons';

// ─── Données démo ─────────────────────────────────────────────────────────────

const DEMO_STATS = {
  admissions_jour: 18,
  en_attente_triage: 3,
  personnel_present: 11,
  personnel_total: 15,
  lits_occupes: 8,
  lits_total: 12,
  consultations_sd_mois: 47,
  revenus_sd_mois_fc: 235000,
  auxiliaires_pretees_sd: 1,
  salles_pretees_sd: 1,
  medecins_pretes_sd: 0,
};

const DEMO_TIMELINE: {
  id: string;
  heure: string;
  nom_patient: string;
  motif: string;
  triage: 'vert' | 'jaune' | 'rouge';
  statut: 'en_attente' | 'oriente' | 'admis';
}[] = [
  { id: 'A1', heure: '07:42', nom_patient: 'Bernadette KABUYA', motif: 'Fièvre et frissons', triage: 'jaune', statut: 'oriente' },
  { id: 'A2', heure: '08:15', nom_patient: 'Junior MUTOMBO', motif: 'Blessure bras droit', triage: 'vert', statut: 'admis' },
  { id: 'A3', heure: '09:03', nom_patient: 'Solange NTUMBA', motif: 'Difficultés respiratoires', triage: 'rouge', statut: 'en_attente' },
  { id: 'A4', heure: '10:28', nom_patient: 'Pascal LUKUSA', motif: 'Contrôle tension artérielle', triage: 'vert', statut: 'admis' },
  { id: 'A5', heure: '11:47', nom_patient: 'Yvette MWAMBA', motif: 'Douleurs abdominales', triage: 'jaune', statut: 'en_attente' },
];

// ─── Helpers triage ───────────────────────────────────────────────────────────

const TRIAGE_CONFIG = {
  vert:   { bg: '#ECFDF5', text: '#065F46', label: 'Stable' },
  jaune:  { bg: '#FEF3C7', text: '#92400E', label: 'Surveillance' },
  rouge:  { bg: '#FEF2F2', text: '#DC2626', label: 'Urgent' },
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  oriente: 'Orienté',
  admis: 'Admis',
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CentreDashboardScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(DEMO_STATS);

  useFocusEffect(useCallback(() => {
    const cid = (user as any)?.centre_id;
    if (!cid) return;
    let cancelled = false;
    api.get<any>(`/api/centres/${cid}/stats`, token)
      .then(d => {
        if (cancelled) return;
        setStats({
          admissions_jour:       d.admissions_jour      ?? DEMO_STATS.admissions_jour,
          en_attente_triage:     d.en_attente_triage    ?? DEMO_STATS.en_attente_triage,
          personnel_present:     d.personnel_present    ?? DEMO_STATS.personnel_present,
          personnel_total:       DEMO_STATS.personnel_total,
          lits_occupes:          d.lits_occupes         ?? DEMO_STATS.lits_occupes,
          lits_total:            d.lits_total           ?? DEMO_STATS.lits_total,
          consultations_sd_mois: d.consultations_sd_mois ?? DEMO_STATS.consultations_sd_mois,
          revenus_sd_mois_fc:    Math.round((d.revenus_sd_mois_usd ?? 0) * 2800),
          auxiliaires_pretees_sd:d.auxiliaires_sd       ?? DEMO_STATS.auxiliaires_pretees_sd,
          salles_pretees_sd:     d.salles_sd            ?? DEMO_STATS.salles_pretees_sd,
          medecins_pretes_sd:    d.medecins_sd          ?? DEMO_STATS.medecins_pretes_sd,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, token]));

  const tauxLits = Math.round((stats.lits_occupes / stats.lits_total) * 100);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSub}>Centre de Santé</Text>
            <Text style={styles.headerTitle}>
              {user?.prenom ? `${user.prenom} ${user.nom}` : 'Responsable Centre'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
            <Icon name="settings" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Section Aujourd'hui */}
        <Text style={styles.secLabel}>AUJOURD'HUI</Text>
        <View style={styles.tilesGrid}>
          <StatTile
            icon="users"
            label="Admissions"
            value={stats.admissions_jour.toString()}
            color={palette.blue}
          />
          <StatTile
            icon="clock"
            label="En attente triage"
            value={stats.en_attente_triage.toString()}
            color={stats.en_attente_triage > 0 ? palette.danger : palette.green}
            alert={stats.en_attente_triage > 0}
          />
          <StatTile
            icon="user-check"
            label="Personnel présent"
            value={`${stats.personnel_present}/${stats.personnel_total}`}
            color={palette.purple}
          />
          <StatTile
            icon="hospital"
            label="Lits occupés"
            value={`${stats.lits_occupes}/${stats.lits_total}`}
            color={tauxLits >= 80 ? palette.amber : palette.green}
            subLabel={`${tauxLits}% d'occupation`}
          />
        </View>

        {/* Section Scanner pharmacie */}
        <Text style={styles.secLabel}>PHARMACIE — STOCK</Text>
        <View style={styles.scannerSection}>
          <TouchableOpacity
            style={[styles.scannerBtn, { backgroundColor: '#059669' }]}
            onPress={() => navigation.navigate('ScannerStockScreen', {
              mode: 'entree',
              centreId: user?.centre_id ?? 'CTR-001',
              operateur: user?.id ?? 'admin',
            })}
            activeOpacity={0.85}
          >
            <Icon name="scan" size={20} color="#fff" />
            <Text style={styles.scannerBtnText}>Réceptionner stock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scannerBtn, { backgroundColor: '#D97706' }]}
            onPress={() => navigation.navigate('ScannerStockScreen', {
              mode: 'sortie',
              centreId: user?.centre_id ?? 'CTR-001',
              operateur: user?.id ?? 'admin',
            })}
            activeOpacity={0.85}
          >
            <Icon name="scan" size={20} color="#fff" />
            <Text style={styles.scannerBtnText}>Dispenser au patient</Text>
          </TouchableOpacity>
        </View>

        {/* Section Impact SantéDirect */}
        <Text style={styles.secLabel}>IMPACT SANTÉDIRECT</Text>
        <View style={styles.sdCard}>
          <View style={styles.sdLeftBar} />
          <View style={styles.sdCardInner}>
            <View style={styles.sdTitleRow}>
              <Text style={styles.sdTitle}>Ressources mises à disposition</Text>
              <View style={styles.sdBadge}>
                <Text style={styles.sdBadgeText}>Partenaire actif</Text>
              </View>
            </View>
            <View style={styles.sdMetricsRow}>
              <View style={styles.sdMetricItem}>
                <Icon name="user-check" size={16} color={palette.blueDeep} />
                <Text style={styles.sdMetricVal}>{stats.auxiliaires_pretees_sd}</Text>
                <Text style={styles.sdMetricLabel}>auxiliaire</Text>
              </View>
              <View style={styles.sdMetricDivider} />
              <View style={styles.sdMetricItem}>
                <Icon name="building" size={16} color={palette.blueDeep} />
                <Text style={styles.sdMetricVal}>{stats.salles_pretees_sd}</Text>
                <Text style={styles.sdMetricLabel}>salle</Text>
              </View>
              <View style={styles.sdMetricDivider} />
              <View style={styles.sdMetricItem}>
                <Icon name="stethoscope" size={16} color={palette.blueDeep} />
                <Text style={styles.sdMetricVal}>{stats.medecins_pretes_sd}</Text>
                <Text style={styles.sdMetricLabel}>médecin</Text>
              </View>
            </View>
            <View style={styles.sdBottomRow}>
              <View style={styles.sdBottomItem}>
                <Icon name="activity" size={14} color={palette.blueDeep} />
                <Text style={styles.sdBottomText}>
                  <Text style={styles.sdBottomVal}>{stats.consultations_sd_mois}</Text>
                  {' '}consultations ce mois
                </Text>
              </View>
              <View style={styles.sdBottomItem}>
                <Icon name="coins" size={14} color={palette.blueDeep} />
                <Text style={styles.sdBottomText}>
                  <Text style={styles.sdBottomVal}>{stats.revenus_sd_mois_fc.toLocaleString('fr-CD')} FC</Text>
                  {' '}générés
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.sdBtn}
              onPress={() => {
                // CentreImpact pas encore créé — ne crash pas
                if (navigation.getState().routeNames.includes('CentreImpact')) {
                  navigation.navigate('CentreImpact');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sdBtnText}>Voir le détail</Text>
              <Icon name="chevron-right" size={16} color={palette.blueDeep} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Dernières admissions */}
        <Text style={styles.secLabel}>DERNIÈRES ADMISSIONS</Text>
        {DEMO_TIMELINE.map(item => {
          const triConf = TRIAGE_CONFIG[item.triage];
          return (
            <View key={item.id} style={styles.admissionCard}>
              <View style={styles.admissionLeft}>
                <Text style={styles.admissionHeure}>{item.heure}</Text>
                <View style={[styles.triageBadge, { backgroundColor: triConf.bg }]}>
                  <Text style={[styles.triageText, { color: triConf.text }]}>{triConf.label}</Text>
                </View>
              </View>
              <View style={styles.admissionCenter}>
                <Text style={styles.admissionNom}>{item.nom_patient}</Text>
                <Text style={styles.admissionMotif} numberOfLines={1}>{item.motif}</Text>
                <Text style={styles.admissionStatut}>{STATUT_LABELS[item.statut]}</Text>
              </View>
              <TouchableOpacity
                style={styles.triageBtn}
                onPress={() => navigation.navigate('CentreAdmission')}
                activeOpacity={0.8}
              >
                <Text style={styles.triageBtnText}>Triage</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB Nouvelle admission */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CentreAdmission')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Sous-composant StatTile ─────────────────────────────────────────────────

function StatTile({
  icon, label, value, color, alert, subLabel,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  alert?: boolean;
  subLabel?: string;
}) {
  return (
    <View style={[tileStyles.root, alert && tileStyles.rootAlert]}>
      <View style={[tileStyles.iconWrap, { backgroundColor: color + '22' }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={tileStyles.value}>{value}</Text>
      <Text style={tileStyles.label}>{label}</Text>
      {subLabel ? <Text style={tileStyles.sub}>{subLabel}</Text> : null}
    </View>
  );
}

const tileStyles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center', ...shadow.sm, minHeight: 110 },
  rootAlert: { borderWidth: 1.5, borderColor: palette.danger },
  iconWrap:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  value:     { fontSize: fontSize.xxl, fontWeight: fontWeight.black, color: colors.textStrong, marginBottom: 2 },
  label:     { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  sub:       { fontSize: 10, color: colors.textLight, marginTop: 2, textAlign: 'center' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: palette.dark,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: palette.blue, opacity: 0.10, top: -80, right: -50,
  },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerSub:  { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm },
  headerTitle:{ color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  iconBtn:    { width: TAP_TARGET, height: TAP_TARGET, justifyContent: 'center', alignItems: 'flex-end' },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  secLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted,
    letterSpacing: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  // Tiles
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
  },

  // SantéDirect card
  sdCard: {
    flexDirection: 'row', backgroundColor: colors.card, marginHorizontal: spacing.lg,
    borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.sm, ...shadow.md,
  },
  sdLeftBar:    { width: 5, backgroundColor: palette.blue },
  sdCardInner:  { flex: 1, padding: spacing.lg },
  sdTitleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sdTitle:      { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textStrong, flex: 1 },
  sdBadge:      { backgroundColor: palette.blueSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  sdBadgeText:  { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.blueDeep },
  sdMetricsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.blueSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  sdMetricItem: { flex: 1, alignItems: 'center', gap: 3 },
  sdMetricVal:  { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: palette.blueDeep },
  sdMetricLabel:{ fontSize: fontSize.xs, color: palette.blueDeep },
  sdMetricDivider: { width: 1, height: 36, backgroundColor: palette.blue, opacity: 0.4 },
  sdBottomRow:  { gap: spacing.sm, marginBottom: spacing.md },
  sdBottomItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sdBottomText: { fontSize: fontSize.sm, color: colors.textMuted },
  sdBottomVal:  { fontWeight: fontWeight.bold, color: colors.text },
  sdBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, borderTopWidth: 1, borderTopColor: palette.blue + '44', paddingTop: spacing.sm,
  },
  sdBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: palette.blueDeep },

  // Admissions
  admissionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.md, ...shadow.xs,
  },
  admissionLeft:    { alignItems: 'center', width: 68 },
  admissionHeure:   { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 4 },
  triageBadge:      { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  triageText:       { fontSize: 10, fontWeight: fontWeight.black },
  admissionCenter:  { flex: 1 },
  admissionNom:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  admissionMotif:   { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  admissionStatut:  { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
  triageBtn: {
    backgroundColor: palette.dark, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  triageBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#FFF' },

  // Scanner pharmacie
  scannerSection: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  scannerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadow.sm,
  },
  scannerBtnText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: palette.dark, justifyContent: 'center', alignItems: 'center',
    ...shadow.lg,
  },
});

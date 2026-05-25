import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';

const DEMO_ADHERENTS = [
  { id: 'ADH-001', nom: 'Marie KABONGO',     plan: 'famille',   montant: 12000, statut: 'actif',   dateRenouv: '2026-06-22' },
  { id: 'ADH-002', nom: 'Joseph MUTOMBO',    plan: 'standard',  montant: 5000,  statut: 'actif',   dateRenouv: '2026-06-15' },
  { id: 'ADH-003', nom: 'Claire TSHIABA',    plan: 'solidaire', montant: 2000,  statut: 'impaye',  dateRenouv: '2026-05-10' },
  { id: 'ADH-004', nom: 'Paul NKEMBA',       plan: 'premium',   montant: 20000, statut: 'actif',   dateRenouv: '2026-07-01' },
  { id: 'ADH-005', nom: 'Ève MULUMBA',       plan: 'famille',   montant: 12000, statut: 'inactif', dateRenouv: null },
];

const PLAN_COLORS: Record<string, string> = { solidaire: '#16A34A', standard: '#0891B2', famille: '#7C3AED', premium: '#D97706' };

export default function AbonnementsAdminScreen() {
  const [filtre, setFiltre] = useState<'tous' | 'actif' | 'impaye' | 'inactif'>('tous');

  const filtered = DEMO_ADHERENTS.filter(a => filtre === 'tous' || a.statut === filtre);
  const totalFC  = DEMO_ADHERENTS.filter(a => a.statut === 'actif').reduce((s, a) => s + a.montant, 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Abonnements Mutuelle</Text>
        <View style={styles.headerStats}>
          <StatItem val={DEMO_ADHERENTS.filter(a => a.statut === 'actif').length.toString()}    lbl="actifs"   />
          <StatDiv />
          <StatItem val={DEMO_ADHERENTS.filter(a => a.statut === 'impaye').length.toString()}   lbl="impayés"  color="#FDE68A" />
          <StatDiv />
          <StatItem val={`${(totalFC / 1000).toFixed(0)}k FC`} lbl="revenus/mois" />
        </View>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {[['tous', 'Tous'], ['actif', 'Actifs'], ['impaye', 'Impayés'], ['inactif', 'Inactifs']].map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.fChip, filtre === k && styles.fChipActive]} onPress={() => setFiltre(k as any)}>
            <Text style={[styles.fChipText, filtre === k && styles.fChipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.map(a => (
          <View key={a.id} style={styles.adhCard}>
            <View style={styles.adhHeader}>
              <View style={styles.adhAvatar}>
                <Text style={styles.adhAvatarText}>{a.nom[0]}</Text>
              </View>
              <View style={styles.adhInfo}>
                <Text style={styles.adhNom}>{a.nom}</Text>
                <Text style={styles.adhId}>{a.id}</Text>
              </View>
              <View style={[styles.adhStatut, {
                backgroundColor: a.statut === 'actif' ? colors.primaryLight : a.statut === 'impaye' ? colors.warningLight : colors.bg,
              }]}>
                <Text style={[styles.adhStatutText, {
                  color: a.statut === 'actif' ? colors.primaryDark : a.statut === 'impaye' ? colors.warning : colors.textMuted,
                }]}>
                  {a.statut.charAt(0).toUpperCase() + a.statut.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.adhDetails}>
              <View style={[styles.adhPlanBadge, { backgroundColor: (PLAN_COLORS[a.plan] ?? colors.primary) + '18' }]}>
                <Text style={[styles.adhPlanText, { color: PLAN_COLORS[a.plan] ?? colors.primary }]}>
                  Plan {a.plan.charAt(0).toUpperCase() + a.plan.slice(1)}
                </Text>
              </View>
              <Text style={styles.adhMontant}>{a.montant.toLocaleString()} FC/mois</Text>
              {a.dateRenouv && (
                <Text style={styles.adhRenouv}>Renouvellement : {a.dateRenouv}</Text>
              )}
            </View>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function StatItem({ val, lbl, color }: { val: string; lbl: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: color ?? '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black }}>{val}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs }}>{lbl}</Text>
    </View>
  );
}
function StatDiv() { return <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />; }

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: palette.dark, paddingTop: 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  headerTitle:  { color: palette.white, fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: spacing.md },
  headerStats:  { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: spacing.md },

  filterScroll:  { maxHeight: 44 },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  fChip:              { borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fChipActive:        { backgroundColor: palette.dark, borderColor: palette.dark },
  fChipText:          { fontSize: fontSize.sm, color: colors.textMuted },
  fChipTextActive:    { color: palette.white, fontWeight: fontWeight.bold },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  adhCard:   { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.sm, ...shadow.sm },
  adhHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  adhAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  adhAvatarText: { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.primaryDark },
  adhInfo:   { flex: 1 },
  adhNom:    { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  adhId:     { fontSize: fontSize.xs, color: colors.textMuted },
  adhStatut: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  adhStatutText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  adhDetails: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  adhPlanBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  adhPlanText:  { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  adhMontant:   { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  adhRenouv:    { fontSize: fontSize.xs, color: colors.textMuted },
});

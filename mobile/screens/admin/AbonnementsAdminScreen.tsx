import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';

type Abonnement = {
  id: string;
  nom: string;
  plan: string | null;
  montant_usd: number;
  statut: string;
  date_renouvellement: string | null;
  nb_mois_impaye: number;
};

const PLAN_COLORS: Record<string, string> = { solidaire: '#16A34A', standard: '#0891B2', famille: '#7C3AED', premium: '#D97706' };

export default function AbonnementsAdminScreen() {
  const { token } = useAuth();
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filtre, setFiltre] = useState<'tous' | 'actif' | 'impaye' | 'inactif'>('tous');

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ abonnements: Abonnement[] }>('/api/admin/abonnements', token)
      .then(d => { if (!cancelled && d.abonnements) setAbonnements(d.abonnements); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]));

  const filtered  = abonnements.filter(a => filtre === 'tous' || a.statut === filtre);
  const actifs    = abonnements.filter(a => a.statut === 'actif');
  const impayes   = abonnements.filter(a => a.statut === 'impaye');
  const totalFC   = actifs.reduce((s, a) => s + a.montant_usd * 2800, 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Abonnements Mutuelle</Text>
        <View style={styles.headerStats}>
          {loading
            ? <ActivityIndicator color="#FFF" style={{ flex: 1 }} />
            : <>
                <StatItem val={actifs.length.toString()}                       lbl="actifs"       />
                <StatDiv />
                <StatItem val={impayes.length.toString()}                      lbl="impayés"      color="#FDE68A" />
                <StatDiv />
                <StatItem val={`${(totalFC / 1000).toFixed(0)}k FC`}          lbl="revenus/mois" />
              </>
          }
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
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>Aucun abonnement</Text>
          </View>
        )}

        {filtered.map(a => {
          const planLabel = a.plan ? a.plan.charAt(0).toUpperCase() + a.plan.slice(1) : 'Sans plan';
          const planColor = PLAN_COLORS[a.plan ?? ''] ?? colors.primary;
          const montantFC = a.montant_usd * 2800;
          return (
            <View key={a.id} style={styles.adhCard}>
              <View style={styles.adhHeader}>
                <View style={styles.adhAvatar}>
                  <Text style={styles.adhAvatarText}>{a.nom[0] ?? '?'}</Text>
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
                {a.plan && (
                  <View style={[styles.adhPlanBadge, { backgroundColor: planColor + '18' }]}>
                    <Text style={[styles.adhPlanText, { color: planColor }]}>Plan {planLabel}</Text>
                  </View>
                )}
                {montantFC > 0 && (
                  <Text style={styles.adhMontant}>{montantFC.toLocaleString()} FC/mois</Text>
                )}
                {a.nb_mois_impaye > 0 && (
                  <Text style={[styles.adhRenouv, { color: colors.warning }]}>{a.nb_mois_impaye} mois impayé{a.nb_mois_impaye > 1 ? 's' : ''}</Text>
                )}
                {a.date_renouvellement && (
                  <Text style={styles.adhRenouv}>Renouvellement : {a.date_renouvellement}</Text>
                )}
              </View>
            </View>
          );
        })}
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
  headerStats:  { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: spacing.md, minHeight: 56, alignItems: 'center' },

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

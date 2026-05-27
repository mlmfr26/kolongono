import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon } from '../../components/Icons';

type Revenus = {
  total_revenus_usd: number;
  total_depenses_usd: number;
  solde_usd: number;
  cotisations_fc: number;
  cotisations_usd: number;
};

type Stats = {
  total: number;
  adherents_actifs: number;
  adherents_inactifs: number;
  par_role: Record<string, number>;
};

export default function RapportsScreen() {
  const { token } = useAuth();
  const [revenus,  setRevenus]  = useState<Revenus | null>(null);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [consTotal,setConsTotal]= useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get<Revenus>('/api/admin/revenus', token).catch(() => null),
      api.get<Stats>('/api/admin/stats', token).catch(() => null),
      api.get<{ total: number }>('/api/admin/consultations?limit=1', token).catch(() => null),
    ]).then(([rev, st, cons]) => {
      if (cancelled) return;
      if (rev)  setRevenus(rev);
      if (st)   setStats(st);
      if (cons) setConsTotal(cons.total);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]));

  const cotFC   = revenus?.cotisations_fc ?? 0;
  const solde   = revenus?.solde_usd ?? 0;
  const revenus_usd = revenus?.total_revenus_usd ?? 0;
  const dep_usd = revenus?.total_depenses_usd ?? 0;

  function formatFC(fc: number) {
    if (fc >= 1_000_000) return `${(fc / 1_000_000).toFixed(1)}M FC`;
    if (fc >= 1000) return `${(fc / 1000).toFixed(0)}k FC`;
    return `${fc.toFixed(0)} FC`;
  }
  function formatUSD(u: number) {
    if (u >= 1000) return `$${(u / 1000).toFixed(1)}k`;
    return `$${u.toFixed(0)}`;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rapports</Text>
        <Text style={styles.headerSub}>Tableau de bord financier &amp; opérationnel</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* ── Finances ── */}
            <Text style={styles.secLabel}>FINANCES — MUTUELLE</Text>
            <View style={styles.cardsRow}>
              <BigCard
                label="Cotisations reçues"
                val={formatFC(cotFC)}
                sub={formatUSD(revenus?.cotisations_usd ?? 0)}
                color={palette.greenDeep}
                bg={palette.greenSoft}
                iconName="coins"
              />
              <BigCard
                label="Solde net"
                val={formatUSD(solde)}
                sub={solde >= 0 ? 'Excédent' : 'Déficit'}
                color={solde >= 0 ? palette.greenDeep : colors.danger}
                bg={solde >= 0 ? palette.greenSoft : '#FEE2E2'}
                iconName="trending-up"
              />
            </View>
            <View style={styles.cardsRow}>
              <SmallCard label="Revenus totaux"  val={formatUSD(revenus_usd)} color={palette.blueDeep}   />
              <SmallCard label="Dépenses totales" val={formatUSD(dep_usd)}     color={palette.purpleDeep} />
            </View>

            {/* ── Adhérents ── */}
            <Text style={styles.secLabel}>ADHÉRENTS</Text>
            <View style={styles.statsCard}>
              <StatRow label="Total utilisateurs"    val={(stats?.total ?? 0).toString()} />
              <StatRow label="Adhérents actifs"      val={(stats?.adherents_actifs ?? 0).toString()}   color={palette.greenDeep} />
              <StatRow label="Adhérents inactifs"    val={(stats?.adherents_inactifs ?? 0).toString()} color={colors.textMuted} />
              <StatRow label="Médecins"              val={(stats?.par_role?.medecin ?? 0).toString()}  color={palette.blueDeep} />
              <StatRow label="Auxiliaires de santé"  val={(stats?.par_role?.auxiliaire ?? 0).toString()} color={palette.purpleDeep} />
              <StatRow label="Admins"                val={(stats?.par_role?.admin ?? 0).toString()}   color={palette.amber} last />
            </View>

            {/* ── Activité médicale ── */}
            <Text style={styles.secLabel}>ACTIVITÉ MÉDICALE</Text>
            <View style={styles.statsCard}>
              <StatRow label="Consultations (total)" val={consTotal !== null ? consTotal.toLocaleString() : '—'} color={palette.blueDeep} />
              <StatRow label="Taux mutualisation"    val={stats?.adherents_actifs ? `${Math.round((stats.adherents_actifs / (stats.total || 1)) * 100)}%` : '—'} last />
            </View>

            {/* ── Note de bas ── */}
            <View style={styles.noteCard}>
              <Icon name="info" size={14} color={colors.textMuted} />
              <Text style={styles.noteText}>
                Données en temps réel depuis la base de données de production.{'\n'}
                Taux de change utilisé : 2 800 FC = 1 USD.
              </Text>
            </View>
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function BigCard({ label, val, sub, color, bg, iconName }: { label: string; val: string; sub: string; color: string; bg: string; iconName: any }) {
  return (
    <View style={[styles.bigCard, { backgroundColor: bg }]}>
      <Icon name={iconName} size={20} color={color} />
      <Text style={[styles.bigCardVal, { color }]}>{val}</Text>
      <Text style={[styles.bigCardSub, { color }]}>{sub}</Text>
      <Text style={[styles.bigCardLabel, { color: color + 'AA' }]}>{label}</Text>
    </View>
  );
}

function SmallCard({ label, val, color }: { label: string; val: string; color: string }) {
  return (
    <View style={[styles.smallCard, { borderLeftColor: color }]}>
      <Text style={[styles.smallCardVal, { color }]}>{val}</Text>
      <Text style={styles.smallCardLabel}>{label}</Text>
    </View>
  );
}

function StatRow({ label, val, color, last }: { label: string; val: string; color?: string; last?: boolean }) {
  return (
    <View style={[styles.statRow, !last && styles.statRowBorder]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, color ? { color } : {}]}>{val}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: palette.dark, paddingTop: 52, paddingBottom: 20, paddingHorizontal: spacing.lg },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black as any, color: '#fff', marginBottom: 3 },
  headerSub:   { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.65)' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold as any, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },

  cardsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bigCard:  { flex: 1, borderRadius: radius.xl, padding: spacing.lg, gap: 4, ...shadow.sm },
  bigCardVal:   { fontSize: fontSize.xxl, fontWeight: fontWeight.black as any, marginTop: 4 },
  bigCardSub:   { fontSize: fontSize.xs, fontWeight: fontWeight.semibold as any, opacity: 0.75 },
  bigCardLabel: { fontSize: fontSize.xs, marginTop: 4 },

  smallCard:      { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderLeftWidth: 4, ...shadow.xs },
  smallCardVal:   { fontSize: fontSize.lg, fontWeight: fontWeight.black as any },
  smallCardLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

  statsCard:   { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm, marginBottom: spacing.sm },
  statRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  statRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statLabel:   { fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  statVal:     { fontSize: fontSize.md, fontWeight: fontWeight.bold as any, color: colors.text },

  noteCard:    { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, alignItems: 'flex-start' },
  noteText:    { flex: 1, fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 16 },
});

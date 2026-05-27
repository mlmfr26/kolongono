import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon, IconName } from '../../components/Icons';

type KPIs = { adherents: string; consultations: string; revenus: string; medecins: string; sku: string };

export default function AdminDashboardScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [kpi, setKpi] = useState<KPIs>({ adherents: '…', consultations: '…', revenus: '…', medecins: '…', sku: '…' });

  useFocusEffect(useCallback(() => {
    Promise.all([
      api.get<{ adherents_actifs: number }>('/api/admin/stats', token).catch(() => null),
      api.get<{ total: number }>('/api/admin/consultations?limit=1', token).catch(() => null),
      api.get<{ cotisations_fc: number }>('/api/admin/revenus', token).catch(() => null),
      api.get<{ total: number }>('/api/admin/medecins', token).catch(() => null),
      api.get<{ total: number }>('/api/pharmacie/ean/list?limit=1', token).catch(() => null),
    ]).then(([stats, cons, rev, med, sku]) => {
      const cotFC = rev?.cotisations_fc ?? 0;
      setKpi({
        adherents:    stats ? stats.adherents_actifs.toString() : '—',
        consultations: cons ? cons.total.toString() : '—',
        revenus:      cotFC >= 1_000_000 ? `${(cotFC / 1_000_000).toFixed(1)}M` : cotFC >= 1000 ? `${(cotFC / 1000).toFixed(0)}k` : cotFC.toString(),
        medecins:     med ? med.total.toString() : '—',
        sku:          sku ? sku.total.toString() : '—',
      });
    });
  }, [token]));

  const stats: { iconName: IconName; label: string; val: string; color: string; bg: string }[] = [
    { iconName: 'users',       label: 'Adhérents actifs',      val: kpi.adherents,    color: palette.blueDeep,   bg: palette.blue   },
    { iconName: 'stethoscope', label: 'Consultations total',   val: kpi.consultations, color: palette.greenDeep,  bg: palette.green  },
    { iconName: 'coins',       label: 'Cotisations FC',        val: kpi.revenus,      color: palette.amber,      bg: palette.warningLight },
    { iconName: 'user-check',  label: 'Médecins partenaires',  val: kpi.medecins,     color: palette.blueDeep,   bg: palette.blueSoft    },
    { iconName: 'package',     label: 'Stock pharmacie (SKU)', val: kpi.sku,          color: palette.purpleDeep, bg: palette.purpleSoft  },
  ];

  const modules: { iconName: IconName; label: string; screen: string; color: string; bg: string }[] = [
    { iconName: 'pill',        label: 'Pharmacie & Stock',    screen: 'PharmacieAdmin',   color: palette.purpleDeep, bg: palette.purple   },
    { iconName: 'shield',      label: 'Abonnements Mutuelle', screen: 'AbonnementsAdmin', color: palette.blueDeep,   bg: palette.blue     },
    { iconName: 'stethoscope', label: 'Médecins partenaires', screen: 'MedecinsAdmin',    color: palette.greenDeep,  bg: palette.green    },
    { iconName: 'bar-chart',   label: 'Rapports',             screen: 'Rapports',         color: palette.purpleDeep, bg: palette.purpleSoft },
  ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />
        <Text style={styles.greeting}>Tableau de bord admin</Text>
        <Text style={styles.name}>{user?.prenom} {user?.nom}</Text>
        <Text style={styles.tagline}>SantéDirect Kolongono</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <Text style={styles.secLabel}>INDICATEURS CLÉS</Text>
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <View style={styles.statIcon}>
                <Icon name={s.iconName} size={22} color={s.color} />
              </View>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Modules */}
        <Text style={styles.secLabel}>MODULES DE GESTION</Text>
        <View style={styles.modulesGrid}>
          {modules.map(m => (
            <TouchableOpacity
              key={m.screen}
              style={[styles.moduleCard, { backgroundColor: m.bg }]}
              onPress={() => navigation.navigate(m.screen)}
              activeOpacity={0.8}
            >
              <View style={styles.moduleIcon}>
                <Icon name={m.iconName} size={24} color={m.color} />
              </View>
              <Text style={[styles.moduleLabel, { color: m.color }]}>{m.label}</Text>
              <Icon name="chevron-right" size={18} color={m.color} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Activité récente */}
        <Text style={styles.secLabel}>ACTIVITÉ RÉCENTE</Text>
        <View style={styles.activityCard}>
          {([
            { iconName: 'check-circle' as IconName, iconColor: colors.success,       text: 'Marie KABONGO — Consultation terminée · Paludisme simple',    time: 'il y a 2h'   },
            { iconName: 'pill'         as IconName, iconColor: palette.purpleDeep,   text: 'Commande pharmacie #CMD-2026-A1B2 livraison en cours',         time: 'il y a 3h'   },
            { iconName: 'user-plus'    as IconName, iconColor: palette.blueDeep,     text: 'Nouveau adhérent : Jean-Paul MUKENDI — Plan Famille',          time: 'il y a 4h'   },
            { iconName: 'coins'        as IconName, iconColor: palette.amber,        text: 'Paiement mutuelle reçu : 12.000 FC — ADH-042',                 time: 'il y a 5h'   },
            { iconName: 'stethoscope'  as IconName, iconColor: palette.greenDeep,    text: 'Dr. Béatrice MWAMBA — 3 consultations terminées aujourd\'hui', time: 'aujourd\'hui' },
          ]).map((a, i) => (
            <View key={i} style={[styles.activityRow, i < 4 && styles.activityRowBorder]}>
              <Icon name={a.iconName} size={16} color={a.iconColor} />
              <Text style={styles.activityText} numberOfLines={1}>{a.text}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: palette.dark,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  headerDecor1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: palette.blue,   opacity: 0.12, top: -80, right: -40 },
  headerDecor2: { position: 'absolute', width: 100, height: 100, borderRadius: 50,  backgroundColor: palette.purple, opacity: 0.15, bottom: -30, left: 30 },
  greeting: { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm },
  name:     { color: palette.white, fontSize: fontSize.xl, fontWeight: fontWeight.black },
  tagline:  { color: 'rgba(255,255,255,0.45)', fontSize: fontSize.xs, marginTop: 4 },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.md },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  statCard:   { flex: 1, minWidth: '28%', borderRadius: radius.xl, padding: spacing.md, alignItems: 'center', ...shadow.sm },
  statIcon:   { width: 44, height: 44, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.55)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  statVal:    { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  statLabel:  { fontSize: fontSize.xs, textAlign: 'center', marginTop: 4, fontWeight: fontWeight.semibold },

  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  moduleCard:  { flex: 1, minWidth: '44%', borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moduleIcon:  { width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.55)', justifyContent: 'center', alignItems: 'center' },
  moduleLabel: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  activityCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', ...shadow.md },
  activityRow:  { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityText: { flex: 1, fontSize: fontSize.xs, color: colors.text },
  activityTime: { fontSize: fontSize.xs, color: colors.textLight, minWidth: 60, textAlign: 'right' },
});

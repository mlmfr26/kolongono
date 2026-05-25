import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuth } from '../components/AuthContext';
import { api } from '../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../components/theme';
import { Icon } from '../components/Icons';

dayjs.locale('fr');

type Produit = { nom: string; posologie: string; quantite: number };

type Ordonnance = {
  id: string;
  date: string;
  medecin: string;
  diagnostic: string;
  produits: Produit[];
  recommandations: string;
  statut: 'emise' | 'commandee' | 'delivree' | 'expiree';
  renouvellement_autorise?: boolean;
  nb_renouvellements_restants?: number;
  date_expiration?: string;
};

const STATUT_CONFIG = {
  emise:     { label: 'Émise',     bg: palette.blueSoft,  text: palette.blueDeep,  icon: 'file-text'    as const },
  commandee: { label: 'Commandée', bg: '#FEF3C7',         text: '#92400E',          icon: 'package'      as const },
  delivree:  { label: 'Délivrée',  bg: palette.greenSoft, text: palette.greenDeep, icon: 'check-circle' as const },
  expiree:   { label: 'Expirée',   bg: '#FEE2E2',         text: '#B91C1C',          icon: 'x-circle'     as const },
};

const DEMO_ORDONNANCES: Ordonnance[] = [
  {
    id: 'ORD-2026-DEMO01',
    date: '2026-04-15',
    medecin: 'Dr. Emmanuel LUKUSA',
    diagnostic: 'Paludisme simple',
    produits: [
      { nom: 'Artéméther/Luméfantrine 20/120mg', posologie: '4 cp matin et soir pendant 3 jours', quantite: 2 },
      { nom: 'Paracétamol 500mg', posologie: '2 cp toutes les 6h si fièvre', quantite: 1 },
    ],
    recommandations: 'Repos au lit. Boire beaucoup d\'eau. Éviter le soleil. Revenir si fièvre persiste après 48h.',
    statut: 'delivree',
    renouvellement_autorise: false,
  },
  {
    id: 'ORD-2026-DEMO02',
    date: '2026-05-10',
    medecin: 'Dr. Béatrice MWAMBA',
    diagnostic: 'Hypertension artérielle',
    produits: [
      { nom: 'Amlodipine 5mg', posologie: '1 cp par jour le matin', quantite: 3 },
    ],
    recommandations: 'Contrôle tension chaque semaine. Régime pauvre en sel. Activité physique légère.',
    statut: 'delivree',
    renouvellement_autorise: true,
    nb_renouvellements_restants: 2,
    date_expiration: '2026-08-10',
  },
];

export default function OrdonnanceScreen() {
  const { user, token } = useAuth();
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>(DEMO_ORDONNANCES);
  const [loading,     setLoading]     = useState(false);
  const [selected,    setSelected]    = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ ordonnances: Ordonnance[] }>(`/api/consultations/ordonnances?patient_id=${user?.id}`, token)
      .then(d => { if (!cancelled && d.ordonnances) setOrdonnances(d.ordonnances); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, user?.id]));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes ordonnances</Text>
        <Text style={styles.headerSub}>{user?.prenom} {user?.nom}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.blueDeep} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {ordonnances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="file-text" size={48} color={colors.textLight} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>Aucune ordonnance</Text>
              <Text style={styles.emptySub}>Vos ordonnances apparaîtront ici après chaque consultation médicale.</Text>
            </View>
          ) : (
            ordonnances.map(ord => {
              const cfg = STATUT_CONFIG[ord.statut];
              const open = selected === ord.id;
              return (
                <TouchableOpacity
                  key={ord.id}
                  style={[styles.card, open && styles.cardOpen]}
                  onPress={() => setSelected(s => s === ord.id ? null : ord.id)}
                  activeOpacity={0.88}
                >
                  {/* En-tête */}
                  <View style={styles.cardTop}>
                    <View style={styles.cardLeft}>
                      <View style={[styles.statutPill, { backgroundColor: cfg.bg }]}>
                        <Icon name={cfg.icon} size={11} color={cfg.text} />
                        <Text style={[styles.statutText, { color: cfg.text }]}>{cfg.label}</Text>
                      </View>
                      <Text style={styles.cardDate}>{dayjs(ord.date).format('D MMMM YYYY')}</Text>
                    </View>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </View>

                  <Text style={styles.cardMedecin}>{ord.medecin}</Text>

                  {/* Diagnostic */}
                  <View style={styles.diagRow}>
                    <Icon name="stethoscope" size={14} color={palette.blueDeep} />
                    <Text style={styles.diagText}>{ord.diagnostic}</Text>
                  </View>

                  {/* Badge renouvellement autorisé */}
                  {ord.renouvellement_autorise && ord.nb_renouvellements_restants !== undefined && ord.nb_renouvellements_restants > 0 && (
                    <View style={styles.renewBanner}>
                      <Icon name="refresh" size={12} color={palette.greenDeep} />
                      <Text style={styles.renewText}>
                        Renouvellement possible · {ord.nb_renouvellements_restants} restant{ord.nb_renouvellements_restants > 1 ? 's' : ''} · votre auxiliaire peut le renouveler
                      </Text>
                    </View>
                  )}

                  {/* Détail */}
                  {open && (
                    <View style={styles.details}>
                      <View style={styles.divider} />

                      <Text style={styles.detailLabel}>MÉDICAMENTS PRESCRITS</Text>
                      {ord.produits.map((p, i) => (
                        <View key={i} style={styles.prodRow}>
                          <View style={styles.prodIconWrap}>
                            <Icon name="pill" size={14} color={palette.purpleDeep} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.prodNom}>{p.nom}</Text>
                            <Text style={styles.prodPoso}>{p.posologie}</Text>
                          </View>
                          <Text style={styles.prodQte}>×{p.quantite}</Text>
                        </View>
                      ))}

                      <Text style={[styles.detailLabel, { marginTop: spacing.md }]}>RECOMMANDATIONS</Text>
                      <View style={styles.recoBox}>
                        <Text style={styles.recoText}>{ord.recommandations}</Text>
                      </View>

                      {/* Note de livraison — lecture seule */}
                      <View style={styles.noteBox}>
                        <Icon name="info" size={14} color={palette.blueDeep} />
                        <Text style={styles.noteText}>
                          {ord.statut === 'delivree'
                            ? 'Médicaments délivrés — commandés par votre médecin lors de la consultation.'
                            : 'Vos médicaments sont en cours de préparation et seront livrés prochainement.'}
                        </Text>
                      </View>

                      {ord.date_expiration && (
                        <Text style={styles.expirationText}>
                          Valide jusqu'au {dayjs(ord.date_expiration).format('D MMMM YYYY')}
                        </Text>
                      )}
                    </View>
                  )}
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
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: palette.white,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.text },
  headerSub:   { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 3 },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },

  emptyBox:   { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginTop: spacing.md },
  emptySub:   { fontSize: fontSize.sm, color: colors.textLight, textAlign: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xs, lineHeight: 20 },

  card:     { backgroundColor: palette.white, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  cardOpen: { borderWidth: 1.5, borderColor: palette.blue },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardLeft: { flex: 1, gap: 4 },
  statutPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  statutText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardDate:    { fontSize: fontSize.xs, color: colors.textMuted },
  cardMedecin: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text, marginBottom: spacing.sm },

  diagRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.blueSoft, borderRadius: radius.lg, padding: spacing.sm },
  diagText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: palette.blueDeep, flex: 1 },

  renewBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.greenSoft, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm },
  renewText:   { flex: 1, fontSize: fontSize.xs, color: palette.greenDeep, fontWeight: fontWeight.semibold },

  details:    { marginTop: spacing.sm },
  divider:    { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  detailLabel:{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 0.7, marginBottom: spacing.sm },

  prodRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.sm },
  prodIconWrap:{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: palette.purpleSoft, justifyContent: 'center', alignItems: 'center' },
  prodNom:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  prodPoso:    { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  prodQte:     { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: palette.purpleDeep },

  recoBox:  { backgroundColor: palette.blueSoft, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  recoText: { fontSize: fontSize.sm, color: palette.blueDeep, lineHeight: 20 },

  noteBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F0F7FF', borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm },
  noteText: { flex: 1, fontSize: fontSize.xs, color: palette.blueDeep, lineHeight: 16 },

  expirationText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});

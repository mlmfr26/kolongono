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

type Livraison = {
  id: string;
  ordonnance_id: string;
  date_commande: string;
  statut: 'en_preparation' | 'en_cours_livraison' | 'livre' | 'annule';
  medecin: string;
  diagnostic: string;
  produits: { nom: string; quantite: number; posologie: string }[];
  livreur?: string;
  date_livraison?: string;
};

const STATUT_CONFIG = {
  en_preparation:      { label: 'En préparation',   bg: palette.blueSoft,   text: palette.blueDeep,   icon: 'package'   as const },
  en_cours_livraison:  { label: 'En livraison',      bg: '#FEF3C7',          text: '#92400E',           icon: 'map-pin'   as const },
  livre:               { label: 'Livré',             bg: palette.greenSoft,  text: palette.greenDeep,  icon: 'check-circle' as const },
  annule:              { label: 'Annulé',            bg: '#FEE2E2',          text: '#B91C1C',           icon: 'x-circle'  as const },
};

export default function PharmacieScreen() {
  const { user, token } = useAuth();
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [loading,    setLoading]    = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ livraisons: Livraison[] }>(`/api/pharmacie/livraisons?patient_id=${user?.id}`, token)
      .then(d => { if (!cancelled && d.livraisons) setLivraisons(d.livraisons); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, user?.id]));

  const actives = livraisons.filter(l => l.statut !== 'livre' && l.statut !== 'annule');
  const historique = livraisons.filter(l => l.statut === 'livre' || l.statut === 'annule');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pharmacie</Text>
        <Text style={styles.headerSub}>Suivi de vos livraisons de médicaments</Text>
      </View>

      {/* Bannière info workflow */}
      <View style={styles.infoBanner}>
        <Icon name="stethoscope" size={18} color={palette.blueDeep} />
        <Text style={styles.infoText}>
          Vos médicaments sont commandés et livrés automatiquement par votre médecin après chaque consultation. Votre auxiliaire de santé gère les produits de premier secours.
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.purpleDeep} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* En cours */}
          {actives.length > 0 && (
            <>
              <Text style={styles.secLabel}>EN COURS</Text>
              {actives.map(l => <LivraisonCard key={l.id} livraison={l} />)}
            </>
          )}

          {actives.length === 0 && (
            <View style={styles.emptyBox}>
              <Icon name="package" size={48} color={colors.textLight} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>Aucune livraison en cours</Text>
              <Text style={styles.emptySub}>Vos médicaments apparaîtront ici après chaque consultation médicale.</Text>
            </View>
          )}

          {/* Historique */}
          {historique.length > 0 && (
            <>
              <Text style={[styles.secLabel, { marginTop: spacing.xl }]}>HISTORIQUE</Text>
              {historique.map(l => <LivraisonCard key={l.id} livraison={l} collapsed />)}
            </>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

function LivraisonCard({ livraison: l, collapsed }: { livraison: Livraison; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  const cfg = STATUT_CONFIG[l.statut];

  return (
    <TouchableOpacity style={styles.card} onPress={() => setOpen(o => !o)} activeOpacity={0.88}>
      {/* En-tête */}
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={[styles.statutPill, { backgroundColor: cfg.bg }]}>
            <Icon name={cfg.icon} size={12} color={cfg.text} />
            <Text style={[styles.statutText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.cardDate}>{dayjs(l.date_commande).format('D MMM à HH:mm')}</Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </View>

      <Text style={styles.cardMedecin}>{l.medecin}</Text>
      <Text style={styles.cardDiag}>{l.diagnostic}</Text>

      {open && (
        <View style={styles.cardDetails}>
          <View style={styles.divider} />
          <Text style={styles.detailLabel}>MÉDICAMENTS</Text>
          {l.produits.map((p, i) => (
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
          {l.livreur && (
            <View style={styles.livreurRow}>
              <Icon name="user" size={13} color={colors.textMuted} />
              <Text style={styles.livreurText}>Livreur : {l.livreur}</Text>
            </View>
          )}
          {l.date_livraison && (
            <View style={styles.livreurRow}>
              <Icon name="check-circle" size={13} color={palette.greenDeep} />
              <Text style={[styles.livreurText, { color: palette.greenDeep }]}>
                Livré le {dayjs(l.date_livraison).format('D MMM YYYY à HH:mm')}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
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

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: palette.blueSoft,
    margin: spacing.lg, borderRadius: radius.xl, padding: spacing.md,
  },
  infoText: { flex: 1, fontSize: fontSize.xs, color: palette.blueDeep, lineHeight: 18 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },

  emptyBox:   { alignItems: 'center', paddingVertical: 56 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginTop: spacing.md },
  emptySub:   { fontSize: fontSize.sm, color: colors.textLight, textAlign: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xs, lineHeight: 20 },

  card: { backgroundColor: palette.white, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardLeft: { flex: 1, gap: 4 },
  statutPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  statutText:  { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardDate:    { fontSize: fontSize.xs, color: colors.textMuted },
  cardMedecin: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text, marginTop: spacing.xs },
  cardDiag:    { fontSize: fontSize.sm, color: colors.textMuted },

  cardDetails: { marginTop: spacing.sm },
  divider:     { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  detailLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 0.7, marginBottom: spacing.sm },

  prodRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.sm },
  prodIconWrap:{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: palette.purpleSoft, justifyContent: 'center', alignItems: 'center' },
  prodNom:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  prodPoso:    { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  prodQte:     { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: palette.purpleDeep },

  livreurRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  livreurText: { fontSize: fontSize.xs, color: colors.textMuted },
});

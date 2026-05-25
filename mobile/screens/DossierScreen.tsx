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
import { Icon, type IconName } from '../components/Icons';

dayjs.locale('fr');

export default function DossierScreen() {
  const { user, token } = useAuth();
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    api.get<any>(`/api/dossiers/${user.id}`, token)
      .then(d => setDossier(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, token]));

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.header}><Text style={styles.headerTitle}>Dossier médical</Text></View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.dossier} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dossier médical</Text>
        <Text style={styles.headerSub}>{user?.prenom} {user?.nom}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Infos clés */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <InfoItem iconName="droplet"        label="Groupe sanguin" value={dossier?.groupe_sanguin ?? 'Non renseigné'} />
            <InfoItem iconName="alert-triangle" label="Allergies"      value={dossier?.allergies?.length > 0 ? dossier.allergies.join(', ') : 'Aucune connue'} />
          </View>
        </View>

        {/* Traitements en cours */}
        <SectionCard
          iconName="pill"
          title="Traitements en cours"
          empty={!dossier?.traitements_en_cours?.length}
          emptyText="Aucun traitement en cours"
        >
          {dossier?.traitements_en_cours?.map((t: any, i: number) => (
            <Text key={i} style={styles.listItem}>• {t}</Text>
          ))}
        </SectionCard>

        {/* Antécédents */}
        <SectionCard
          iconName="archive"
          title="Antécédents médicaux"
          empty={!dossier?.antecedents?.length}
          emptyText="Aucun antécédent renseigné"
        >
          {dossier?.antecedents?.map((a: any, i: number) => (
            <Text key={i} style={styles.listItem}>• {a}</Text>
          ))}
        </SectionCard>

        {/* Vaccinations */}
        <SectionCard
          iconName="syringe"
          title="Vaccinations"
          empty={!dossier?.vaccinations?.length}
          emptyText="Aucune vaccination enregistrée"
        >
          {dossier?.vaccinations?.map((v: any, i: number) => (
            <View key={i} style={styles.vaccRow}>
              <Text style={styles.vaccNom}>{v.vaccin}</Text>
              <Text style={styles.vaccDate}>{v.date}</Text>
            </View>
          ))}
        </SectionCard>

        {/* Historique consultations */}
        <Text style={styles.secLabel}>HISTORIQUE CONSULTATIONS ({dossier?.historique_consultations?.length ?? 0})</Text>
        {dossier?.historique_consultations?.length === 0 && (
          <View style={styles.emptyCard}>
            <Icon name="clipboard" size={36} color={colors.textLight} strokeWidth={1.2} />
            <Text style={styles.emptyText}>Aucune consultation enregistrée</Text>
          </View>
        )}
        {dossier?.historique_consultations?.map((c: any) => (
          <View key={c.id} style={styles.consultCard}>
            <View style={styles.consultLeft}>
              <Text style={styles.consultDate}>{dayjs(c.date).format('D MMM YYYY')}</Text>
            </View>
            <View style={styles.consultRight}>
              <Text style={styles.consultMotif}>{c.motif}</Text>
              <Text style={styles.consultMed}>{c.medecin}</Text>
              {c.diagnostic && <Text style={styles.consultDiag}>{c.diagnostic}</Text>}
            </View>
            <View style={[styles.consultBadge, c.statut === 'termine' ? styles.consultBadgeDone : styles.consultBadgePending]}>
              <Text style={[styles.consultBadgeText, c.statut === 'termine' ? styles.consultBadgeTextDone : styles.consultBadgeTextPending]}>
                {c.statut === 'termine' ? 'Terminé' : 'À venir'}
              </Text>
            </View>
          </View>
        ))}

        {/* Note confidentialité */}
        <View style={styles.privacyBox}>
          <Icon name="shield" size={20} color={colors.accent} />
          <Text style={styles.privacyText}>
            Votre dossier médical est strictement confidentiel. Seuls vous, votre auxiliaire de santé et le médecin consultant y ont accès.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function InfoItem({ iconName, label, value }: { iconName: IconName; label: string; value: string }) {
  return (
    <View style={infoItemStyles.root}>
      <Icon name={iconName} size={24} color={colors.textMuted} />
      <Text style={infoItemStyles.label}>{label}</Text>
      <Text style={infoItemStyles.value}>{value}</Text>
    </View>
  );
}

const infoItemStyles = StyleSheet.create({
  root:  { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  value: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, textAlign: 'center' },
});

function SectionCard({ iconName, title, children, empty, emptyText }: any) {
  return (
    <>
      <Text style={styles.secLabel}>{title.toUpperCase()}</Text>
      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <Icon name={iconName} size={18} color={colors.textMuted} />
          <Text style={styles.sectionCardTitle}>{title}</Text>
        </View>
        {empty ? (
          <Text style={styles.sectionEmpty}>{emptyText}</Text>
        ) : children}
      </View>
    </>
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
  headerTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 3 },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  infoCard:   { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.xl, ...shadow.md, marginBottom: spacing.md },
  infoRow:    { flexDirection: 'row', gap: spacing.md },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },

  sectionCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.md },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  sectionEmpty: { color: colors.textLight, fontSize: fontSize.sm, fontStyle: 'italic' },

  listItem: { fontSize: fontSize.sm, color: colors.text, paddingVertical: 3, lineHeight: 20 },

  vaccRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  vaccNom:   { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  vaccDate:  { fontSize: fontSize.sm, color: colors.textMuted },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIconWrap: { marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.textMuted },

  consultCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.lg, padding: spacing.md, ...shadow.sm },
  consultLeft: { backgroundColor: colors.dossier + '18', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minWidth: 56 },
  consultDate: { fontSize: fontSize.xs, fontWeight: fontWeight.black, color: '#7C3AED', textAlign: 'center' },
  consultRight:{ flex: 1 },
  consultMotif:{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  consultMed:  { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  consultDiag: { fontSize: fontSize.xs, color: colors.primary, marginTop: 2, fontStyle: 'italic' },
  consultBadge:{ borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  consultBadgeDone:   { backgroundColor: colors.primaryLight },
  consultBadgePending:{ backgroundColor: colors.infoLight },
  consultBadgeText:   { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  consultBadgeTextDone:   { color: colors.primaryDark },
  consultBadgeTextPending:{ color: colors.info },

  privacyBox:  { flexDirection: 'row', backgroundColor: colors.bg, marginHorizontal: spacing.lg, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  privacyIcon: { fontSize: 18 },
  privacyText: { flex: 1, fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 18 },
});

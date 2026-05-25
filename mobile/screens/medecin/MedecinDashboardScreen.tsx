import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
} from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuth } from '../../components/AuthContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon, type IconName } from '../../components/Icons';

dayjs.locale('fr');

const DEMO_RDVS_MEDECIN = [
  {
    id: 'CONS-2026-AA1B2C',
    patient: { prenom: 'Marie', nom: 'KABONGO', age: 34 },
    motif: 'Fièvre et maux de tête depuis 2 jours',
    date_heure: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    statut: 'planifie',
    signes_vitaux: { temperature: 38.7, tension: '130/85', pouls: 92, tdr: 'paludisme_positif' },
    pre_consultation_faite: true,
  },
  {
    id: 'CONS-2026-DD3E4F',
    patient: { prenom: 'Joseph', nom: 'MUTOMBO', age: 8 },
    motif: 'Consultation pédiatrique de suivi',
    date_heure: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    statut: 'planifie',
    signes_vitaux: null,
    pre_consultation_faite: false,
  },
];

export default function MedecinDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [disponible, setDisponible] = useState(true);

  const prochains = DEMO_RDVS_MEDECIN.filter(r => r.statut === 'planifie');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerGreeting}>Tableau de bord</Text>
            <Text style={styles.headerName}>Dr. {user?.prenom} {user?.nom}</Text>
          </View>
          <View style={styles.dispoBadge}>
            <Switch
              value={disponible}
              onValueChange={setDisponible}
              trackColor={{ false: colors.textLight, true: '#4ADE80' }}
              thumbColor="#FFF"
            />
            <Text style={[styles.dispoText, disponible && styles.dispoTextActif]}>
              {disponible ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
        </View>
        <View style={styles.headerStats}>
          <StatItem val={prochains.length.toString()} lbl="consultations aujourd'hui" />
          <StatDivider />
          <StatItem val={prochains.filter(r => r.pre_consultation_faite).length.toString()} lbl="fiches complètes" color="#4ADE80" />
          <StatDivider />
          <StatItem val="0" lbl="urgences" />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.secLabel}>CONSULTATIONS À VENIR</Text>

        {prochains.map(rdv => {
          const minutesAvant = Math.round((new Date(rdv.date_heure).getTime() - Date.now()) / 60000);
          const urgent = minutesAvant <= 15 && minutesAvant >= 0;
          return (
            <TouchableOpacity
              key={rdv.id}
              style={[styles.rdvCard, urgent && styles.rdvCardUrgent]}
              onPress={() => navigation.navigate('ConsultationEnCours', { consultation: rdv })}
              activeOpacity={0.85}
            >
              {urgent && (
                <View style={styles.urgentTag}>
                  <Text style={styles.urgentTagText}>Dans {minutesAvant} min</Text>
                </View>
              )}
              <View style={styles.rdvHeader}>
                <View style={styles.rdvAvatar}>
                  <Text style={styles.rdvAvatarText}>{rdv.patient.prenom[0]}{rdv.patient.nom[0]}</Text>
                </View>
                <View style={styles.rdvInfo}>
                  <Text style={styles.rdvPatient}>{rdv.patient.prenom} {rdv.patient.nom}</Text>
                  <Text style={styles.rdvAge}>{rdv.patient.age} ans</Text>
                  <Text style={styles.rdvMotif} numberOfLines={1}>{rdv.motif}</Text>
                </View>
                <View style={styles.rdvTime}>
                  <Text style={styles.rdvHeure}>{dayjs(rdv.date_heure).format('HH:mm')}</Text>
                </View>
              </View>

              {rdv.signes_vitaux ? (
                <View style={styles.signesRow}>
                  <SigneBadge iconName="thermometer" val={`${rdv.signes_vitaux.temperature}°C`} alert={rdv.signes_vitaux.temperature >= 38} />
                  <SigneBadge iconName="heart-pulse" val={rdv.signes_vitaux.tension} />
                  <SigneBadge iconName="heart"       val={`${rdv.signes_vitaux.pouls} bpm`} />
                  {rdv.signes_vitaux.tdr && (
                    <SigneBadge
                      iconName="test-tube"
                      val={rdv.signes_vitaux.tdr.replace('_', ' ')}
                      alert={rdv.signes_vitaux.tdr.includes('positif')}
                    />
                  )}
                </View>
              ) : (
                <View style={styles.noSignes}>
                  <Text style={styles.noSignesText}>Pré-consultation non complétée</Text>
                </View>
              )}

              <View style={styles.rdvCta}>
                <Text style={[styles.rdvCtaText, { color: rdv.pre_consultation_faite ? palette.greenDeep : colors.warning }]}>
                  {rdv.pre_consultation_faite ? 'Prêt — Démarrer la consultation' : 'En attente de la pré-consultation'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {prochains.length === 0 && (
          <View style={styles.emptyBox}>
            <Icon name="stethoscope" size={48} color={colors.textLight} strokeWidth={1.2} />
            <Text style={styles.emptyText}>Aucune consultation planifiée</Text>
          </View>
        )}

        {/* Stats journée */}
        <Text style={styles.secLabel}>RÉSUMÉ JOURNÉE</Text>
        <View style={styles.resumeCard}>
          {([
            { iconName: 'check-circle' as IconName, label: 'Consultations terminées', val: '3' },
            { iconName: 'file-text'    as IconName, label: 'Ordonnances émises',      val: '3' },
            { iconName: 'pill'         as IconName, label: 'Commandes pharmacie',     val: '2' },
            { iconName: 'star-filled'  as IconName, label: 'Note moyenne patients',   val: '4.9' },
          ]).map((s, i) => (
            <View key={i} style={[styles.resumeRow, i < 3 && styles.resumeRowBorder]}>
              <Icon name={s.iconName} size={18} color={colors.primary} />
              <Text style={styles.resumeLabel}>{s.label}</Text>
              <Text style={styles.resumeVal}>{s.val}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function StatItem({ val, lbl, color }: { val: string; lbl: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[{ color: color ?? '#FFF', fontSize: fontSize.xxl, fontWeight: fontWeight.black }]}>{val}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs, textAlign: 'center', marginTop: 2 }}>{lbl}</Text>
    </View>
  );
}
function StatDivider() { return <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />; }

function SigneBadge({ iconName, val, alert }: { iconName: IconName; val: string; alert?: boolean }) {
  return (
    <View style={[signeBadgeStyles.root, alert && signeBadgeStyles.rootAlert]}>
      <Icon name={iconName} size={11} color={alert ? colors.danger : colors.textMuted} />
      <Text style={[signeBadgeStyles.val, alert && signeBadgeStyles.valAlert]}>{val}</Text>
    </View>
  );
}
const signeBadgeStyles = StyleSheet.create({
  root:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  rootAlert: { backgroundColor: colors.dangerLight },
  val:       { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.text },
  valAlert:  { color: colors.danger },
});

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.primaryDark,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  headerDecor1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: palette.blue, opacity: 0.12, top: -80, right: -40 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  headerGreeting: { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm },
  headerName:     { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  dispoBadge:    { alignItems: 'center', gap: 4 },
  dispoText:     { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs },
  dispoTextActif:{ color: '#4ADE80', fontWeight: fontWeight.bold },
  headerStats:   { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: spacing.md },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.sm },

  rdvCard:       { backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md },
  rdvCardUrgent: { borderWidth: 2, borderColor: colors.warning },
  urgentTag:     { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.xs, marginBottom: spacing.sm, alignItems: 'center' },
  urgentTagText: { color: colors.warning, fontSize: fontSize.xs, fontWeight: fontWeight.black },
  rdvHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  rdvAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.blue, justifyContent: 'center', alignItems: 'center' },
  rdvAvatarText: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: palette.blueDeep },
  rdvInfo:       { flex: 1 },
  rdvPatient:    { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  rdvAge:        { fontSize: fontSize.xs, color: colors.textMuted },
  rdvMotif:      { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  rdvTime:       {},
  rdvHeure:      { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  signesRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  noSignes:      { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  noSignesText:  { color: colors.warning, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textAlign: 'center' },
  rdvCta:        { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  rdvCtaText:    { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textAlign: 'center' },

  emptyBox:  { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: fontSize.md, color: colors.textMuted },

  resumeCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', ...shadow.md },
  resumeRow:  { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  resumeRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  resumeLabel:{ flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  resumeVal:  { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: palette.dark },
});

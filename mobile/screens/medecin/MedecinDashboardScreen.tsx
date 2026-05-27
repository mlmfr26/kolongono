import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, ActivityIndicator,
} from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon, type IconName } from '../../components/Icons';

dayjs.locale('fr');

type RdvMedecin = {
  id: string;
  patient_id: string;
  patient_nom: string;
  motif: string;
  date: string;
  heure_debut: string;
  statut: string;
  lien_medecin?: string;
};

export default function MedecinDashboardScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [disponible, setDisponible] = useState(true);
  const [rdvs,       setRdvs]       = useState<RdvMedecin[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [terminees,  setTerminees]  = useState(0);

  useFocusEffect(useCallback(() => {
    if (!user) { setLoading(false); return; }
    const today = new Date().toISOString().split('T')[0];
    setLoading(true);
    api.get<{ rendez_vous: RdvMedecin[] }>(
      `/api/consultations/rdv?medecin_id=${user.id}&date=${today}`, token
    ).then(d => {
      const list = d.rendez_vous || [];
      setRdvs(list);
      setTerminees(list.filter(r => r.statut === 'termine').length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user, token]));

  const prochains = rdvs.filter(r => r.statut === 'planifie' || r.statut === 'en_cours');

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
          <StatItem val={loading ? '…' : prochains.length.toString()} lbl="à venir aujourd'hui" />
          <StatDivider />
          <StatItem val={loading ? '…' : terminees.toString()} lbl="terminées" color="#4ADE80" />
          <StatDivider />
          <StatItem val={loading ? '…' : rdvs.length.toString()} lbl="total du jour" />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.secLabel}>CONSULTATIONS À VENIR</Text>

        {loading && (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && prochains.map(rdv => {
          const heureStr = rdv.heure_debut || '—';
          const [h, m] = heureStr.split(':').map(Number);
          const rdvTime = new Date();
          rdvTime.setHours(h || 0, m || 0, 0, 0);
          const minutesAvant = Math.round((rdvTime.getTime() - Date.now()) / 60000);
          const urgent = minutesAvant <= 15 && minutesAvant >= 0;
          const parts = rdv.patient_nom.split(' ');
          const initiales = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : rdv.patient_nom.substring(0, 2);
          return (
            <TouchableOpacity
              key={rdv.id}
              style={[styles.rdvCard, urgent && styles.rdvCardUrgent]}
              onPress={() => navigation.navigate('ConsultationEnCours', { consultation: { id: rdv.id, lien_medecin: rdv.lien_medecin, patient: { prenom: parts[0], nom: parts.slice(1).join(' '), age: '' }, motif: rdv.motif, statut: rdv.statut, signes_vitaux: null, pre_consultation_faite: false } })}
              activeOpacity={0.85}
            >
              {urgent && (
                <View style={styles.urgentTag}>
                  <Text style={styles.urgentTagText}>Dans {minutesAvant} min</Text>
                </View>
              )}
              <View style={styles.rdvHeader}>
                <View style={styles.rdvAvatar}>
                  <Text style={styles.rdvAvatarText}>{initiales.toUpperCase()}</Text>
                </View>
                <View style={styles.rdvInfo}>
                  <Text style={styles.rdvPatient}>{rdv.patient_nom}</Text>
                  <Text style={styles.rdvMotif} numberOfLines={1}>{rdv.motif}</Text>
                </View>
                <View style={styles.rdvTime}>
                  <Text style={styles.rdvHeure}>{heureStr}</Text>
                </View>
              </View>
              <View style={styles.rdvCta}>
                <Text style={[styles.rdvCtaText, { color: rdv.statut === 'en_cours' ? palette.greenDeep : colors.warning }]}>
                  {rdv.statut === 'en_cours' ? 'En cours — Rejoindre' : 'Planifié — Démarrer'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {!loading && prochains.length === 0 && (
          <View style={styles.emptyBox}>
            <Icon name="stethoscope" size={48} color={colors.textLight} strokeWidth={1.2} />
            <Text style={styles.emptyText}>Aucune consultation planifiée aujourd'hui</Text>
          </View>
        )}

        {/* Stats journée */}
        <Text style={styles.secLabel}>RÉSUMÉ JOURNÉE</Text>
        <View style={styles.resumeCard}>
          {([
            { iconName: 'check-circle' as IconName, label: 'Consultations terminées', val: terminees.toString() },
            { iconName: 'calendar'     as IconName, label: 'Total planifiées',        val: rdvs.length.toString() },
            { iconName: 'clock'        as IconName, label: 'En attente',              val: prochains.length.toString() },
          ]).map((s, i) => (
            <View key={i} style={[styles.resumeRow, i < 2 && styles.resumeRowBorder]}>
              <Icon name={s.iconName} size={18} color={colors.primary} />
              <Text style={styles.resumeLabel}>{s.label}</Text>
              <Text style={styles.resumeVal}>{loading ? '…' : s.val}</Text>
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

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../../components/theme';
import { Icon, type IconName } from '../../components/Icons';

type Props = { route: { params: { consultation: any } }; navigation: any };

export default function ConsultationEnCoursScreen({ route, navigation }: Props) {
  const { consultation } = route.params;
  const patient = consultation?.patient;
  const signes  = consultation?.signes_vitaux;
  const [phase, setPhase] = useState<'preparation' | 'consultation' | 'cloture'>('preparation');

  function rejoindreVideo() {
    if (consultation?.lien_medecin) {
      Linking.openURL(consultation.lien_medecin).catch(() =>
        Alert.alert('Erreur', 'Impossible d\'ouvrir la vidéoconférence.')
      );
    } else {
      Alert.alert('Vidéo', 'Lien non disponible. Mode simulation actif.');
      setPhase('consultation');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Consultation en cours</Text>
        {patient && <Text style={styles.headerSub}>{patient.prenom} {patient.nom} · {patient.age} ans</Text>}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Phases */}
        <View style={styles.phases}>
          {(['preparation', 'consultation', 'cloture'] as const).map((p, i) => (
            <React.Fragment key={p}>
              <TouchableOpacity
                style={[styles.phaseStep, phase === p && styles.phaseStepActive]}
                onPress={() => setPhase(p)}
              >
                <View style={[styles.phaseNum, phase === p && styles.phaseNumActive]}>
                  <Text style={[styles.phaseNumText, phase === p && styles.phaseNumTextActive]}>{i + 1}</Text>
                </View>
                <Text style={[styles.phaseLabel, phase === p && styles.phaseLabelActive]}>
                  {p === 'preparation' ? 'Préparation' : p === 'consultation' ? 'Consultation' : 'Clôture'}
                </Text>
              </TouchableOpacity>
              {i < 2 && <View style={styles.phaseBar} />}
            </React.Fragment>
          ))}
        </View>

        {/* Phase 1 — Préparation */}
        {phase === 'preparation' && (
          <>
            <Text style={styles.secLabel}>FICHE PRÉ-CONSULTATION</Text>
            {signes ? (
              <View style={styles.signesCard}>
                <SigRow iconName="thermometer" label="Température" val={`${signes.temperature}°C`} alert={signes.temperature >= 38} />
                <SigRow iconName="heart-pulse" label="Tension"     val={signes.tension} />
                <SigRow iconName="heart"       label="Pouls"       val={`${signes.pouls} bpm`} />
                {signes.tdr && <SigRow iconName="test-tube" label="TDR" val={signes.tdr.replace('_', ' ')} alert={signes.tdr.includes('positif')} />}
              </View>
            ) : (
              <View style={styles.noSignesCard}>
                <Text style={styles.noSignesText}>Aucune fiche de pré-consultation. Demandez à l'auxiliaire de la compléter.</Text>
              </View>
            )}

            <Text style={styles.secLabel}>MOTIF DE CONSULTATION</Text>
            <View style={styles.motifCard}>
              <Text style={styles.motifText}>{consultation?.motif}</Text>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setPhase('consultation')} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Démarrer la vidéoconsultation →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Phase 2 — Consultation vidéo */}
        {phase === 'consultation' && (
          <>
            <TouchableOpacity style={styles.videoBtn} onPress={rejoindreVideo} activeOpacity={0.85}>
              <Icon name="video" size={36} color="#fff" />
              <View>
                <Text style={styles.videoBtnTitle}>Rejoindre la vidéoconférence</Text>
                <Text style={styles.videoBtnSub}>Patient + Auxiliaire déjà connectés</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.protocoleCard}>
              <Text style={styles.protocoleTitle}>Pendant la consultation</Text>
              {[
                'Vérifier l\'identité du patient',
                'Compléter l\'anamnèse avec les signes vitaux',
                'Demander à l\'auxiliaire les vérifications complémentaires',
                'Poser le diagnostic basé sur les éléments concrets',
                'Rédiger l\'ordonnance en temps réel',
              ].map((s, i) => (
                <View key={i} style={styles.protocoleStep}>
                  <View style={styles.protocoleNum}><Text style={styles.protocoleNumText}>{i + 1}</Text></View>
                  <Text style={styles.protocoleStepText}>{s}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setPhase('cloture')} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Passer à la clôture →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Phase 3 — Clôture */}
        {phase === 'cloture' && (
          <>
            <Text style={styles.secLabel}>CLÔTURE DE CONSULTATION</Text>
            <View style={styles.clotureCard}>
              <Text style={styles.clotureText}>Émettez l'ordonnance numérique pour clôturer la consultation et déclencher la livraison des médicaments.</Text>
            </View>

            <TouchableOpacity
              style={styles.ordonnanceBtn}
              onPress={() => navigation.navigate('OrdonnanceDigitale', { consultation })}
              activeOpacity={0.85}
            >
              <Icon name="file-text" size={28} color="#fff" />
              <Text style={styles.ordonnanceBtnText}>Rédiger l'ordonnance numérique →</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function SigRow({ iconName, label, val, alert }: { iconName: IconName; label: string; val: string; alert?: boolean }) {
  return (
    <View style={sigRowStyles.row}>
      <Icon name={iconName} size={16} color={alert ? colors.danger : colors.textMuted} />
      <Text style={sigRowStyles.label}>{label}</Text>
      <Text style={[sigRowStyles.val, alert && sigRowStyles.valAlert]}>{val}</Text>
      {alert && <View style={sigRowStyles.alertDot} />}
    </View>
  );
}
const sigRowStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  label:    { flex: 1, fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  val:      { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text },
  valAlert: { color: colors.danger },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
});

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.primaryDark,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerTitle: { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm, marginTop: 3 },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },

  phases:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, ...shadow.sm, marginBottom: spacing.lg },
  phaseStep:  { flex: 1, alignItems: 'center', gap: 4 },
  phaseStepActive: {},
  phaseNum:   { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  phaseNumActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  phaseNumText:   { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.black },
  phaseNumTextActive: { color: '#FFF' },
  phaseLabel:     { fontSize: fontSize.xs, color: colors.textMuted },
  phaseLabelActive: { color: colors.primary, fontWeight: fontWeight.bold },
  phaseBar:   { width: 24, height: 2, backgroundColor: colors.border, marginHorizontal: spacing.xs },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },

  signesCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  noSignesCard: { backgroundColor: colors.warningLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  noSignesText: { color: colors.warning, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  motifCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.lg },
  motifText: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },

  nextBtn:     { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', ...shadow.md, marginBottom: spacing.lg },
  nextBtnText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.black },

  videoBtn:      { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: spacing.xl, ...shadow.lg, marginBottom: spacing.lg },
  videoBtnTitle: { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.black },
  videoBtnSub:   { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.sm, marginTop: 2 },

  protocoleCard:     { backgroundColor: colors.primaryLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  protocoleTitle:    { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.primaryDark, marginBottom: spacing.md },
  protocoleStep:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  protocoleNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  protocoleNumText:  { color: '#FFF', fontSize: fontSize.xs, fontWeight: fontWeight.black },
  protocoleStepText: { flex: 1, fontSize: fontSize.sm, color: colors.primaryDark, lineHeight: 20 },

  clotureCard:   { backgroundColor: colors.infoLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  clotureText:   { fontSize: fontSize.md, color: colors.info, lineHeight: 22 },

  ordonnanceBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, ...shadow.lg, marginBottom: spacing.lg },
  ordonnanceBtnText: { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.black },
});

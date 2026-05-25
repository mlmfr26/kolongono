import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { api } from '../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, TAP_TARGET, palette } from '../components/theme';
import { Icon, type IconName } from '../components/Icons';

type Props = {
  route: { params: { consultation: any } };
  navigation: any;
};

export default function PreConsultationScreen({ route, navigation }: Props) {
  const { consultation } = route.params;
  const { token } = useAuth();

  const [temperature,         setTemperature]         = useState('');
  const [tensionSystolique,   setTensionSystolique]   = useState('');
  const [tensionDiastolique,  setTensionDiastolique]  = useState('');
  const [pouls,               setPouls]               = useState('');
  const [saturationO2,        setSaturationO2]        = useState('');
  const [poids,               setPoids]               = useState('');
  const [observationLangue,   setObservationLangue]   = useState('');
  const [observationTeint,    setObservationTeint]    = useState('');
  const [observationCou,      setObservationCou]      = useState('');
  const [observationsGen,     setObservationsGen]     = useState('');
  const [loading,             setLoading]             = useState(false);

  async function soumettre() {
    if (!temperature || !tensionSystolique || !tensionDiastolique || !pouls) {
      Alert.alert('Champs requis', 'Veuillez renseigner au minimum la température, la tension et le pouls.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.post<any>(
        `/api/consultations/${consultation.consultation_id}/signes-vitaux`,
        {
          consultation_id: consultation.consultation_id,
          temperature: parseFloat(temperature),
          tension_systolique: parseInt(tensionSystolique),
          tension_diastolique: parseInt(tensionDiastolique),
          pouls: parseInt(pouls),
          saturation_o2: saturationO2 ? parseFloat(saturationO2) : undefined,
          poids: poids ? parseFloat(poids) : undefined,
          observation_langue:  observationLangue  || undefined,
          observation_teint:   observationTeint   || undefined,
          observation_cou:     observationCou     || undefined,
          observations_generales: observationsGen || undefined,
        },
        token,
      );

      const alertMsg = result.alerte
        ? `ALERTE : ${result.alerte}\n\nFiche de pré-consultation enregistrée.`
        : 'Fiche de pré-consultation enregistrée avec succès. Le médecin a accès à ces données.';

      Alert.alert('Pré-consultation enregistrée', alertMsg, [
        { text: 'OK', onPress: () => navigation.navigate('Teleconsultation', { consultation }) },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible d\'enregistrer les signes vitaux.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pré-consultation</Text>
        <Text style={styles.headerSub}>À compléter 15 min avant l'appel médecin</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info consultation */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Consultation</Text>
          <Text style={styles.infoId}>{consultation.consultation_id}</Text>
          <Text style={styles.infoMed}>Dr. {consultation.medecin?.prenom} {consultation.medecin?.nom}</Text>
          <Text style={styles.infoSpecialite}>{consultation.medecin?.specialite}</Text>
        </View>

        {/* Section 1 — Signes vitaux */}
        <Text style={styles.sectionTitle}>SIGNES VITAUX</Text>
        <View style={styles.card}>
          <InputField
            label="Température corporelle (°C) *"
            value={temperature}
            onChange={setTemperature}
            placeholder="ex : 37.5"
            keyboardType="decimal-pad"
            iconName="thermometer"
            alert={parseFloat(temperature) >= 39.5 ? 'Fièvre élevée !' : parseFloat(temperature) >= 38 ? 'Fièvre légère' : undefined}
          />
          <View style={styles.row}>
            <InputField
              label="Tension systolique (mmHg) *"
              value={tensionSystolique}
              onChange={setTensionSystolique}
              placeholder="ex : 120"
              keyboardType="number-pad"
              iconName="heart-pulse"
              flex
            />
            <InputField
              label="Tension diastolique *"
              value={tensionDiastolique}
              onChange={setTensionDiastolique}
              placeholder="ex : 80"
              keyboardType="number-pad"
              flex
            />
          </View>
          <InputField
            label="Pouls (bpm) *"
            value={pouls}
            onChange={setPouls}
            placeholder="ex : 72"
            keyboardType="number-pad"
            iconName="heart"
          />
          <InputField
            label="Saturation O₂ (%)"
            value={saturationO2}
            onChange={setSaturationO2}
            placeholder="ex : 98"
            keyboardType="decimal-pad"
            iconName="lungs"
          />
          <InputField
            label="Poids (kg)"
            value={poids}
            onChange={setPoids}
            placeholder="ex : 65"
            keyboardType="decimal-pad"
            iconName="activity"
          />
        </View>

        {/* Section 2 — Observations cliniques */}
        <Text style={styles.sectionTitle}>OBSERVATIONS CLINIQUES</Text>
        <View style={styles.card}>
          <MultilineField
            label="Observation de la langue"
            value={observationLangue}
            onChange={setObservationLangue}
            placeholder="Couleur, aspect, dépôts, ulcérations…"
            hint="L'auxiliaire photographie la langue et décrit son aspect"
          />
          <MultilineField
            label="Teint et couleur de peau"
            value={observationTeint}
            onChange={setObservationTeint}
            placeholder="Pâleur, jaunisse, rougeurs, cyanose…"
          />
          <MultilineField
            label="Observation du cou"
            value={observationCou}
            onChange={setObservationCou}
            placeholder="Ganglions, thyroïde, rigidité…"
          />
          <MultilineField
            label="Observations générales"
            value={observationsGen}
            onChange={setObservationsGen}
            placeholder="Symptômes principaux, depuis quand, intensité, contexte…"
          />
        </View>

        {/* Note protocole */}
        <View style={styles.protocoleBox}>
          <Icon name="clipboard" size={22} color={colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.protocoleTitle}>Protocole auxiliaire</Text>
            <Text style={styles.protocoleText}>
              L'auxiliaire assiste le médecin durant toute la consultation. Il est les yeux et les mains du médecin à distance. Ces données sont transmises en temps réel au médecin avant l'appel vidéo.
            </Text>
          </View>
        </View>

        {/* Bouton soumettre */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={soumettre}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.submitBtnText}>Enregistrer et rejoindre la consultation →</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder, keyboardType, iconName, alert: alertMsg, flex,
}: any) {
  return (
    <View style={[inputStyles.field, flex && { flex: 1 }]}>
      <View style={inputStyles.labelRow}>
        {iconName && <Icon name={iconName as IconName} size={13} color={colors.textMuted} />}
        <Text style={inputStyles.label}>{label}</Text>
      </View>
      <TextInput
        style={[inputStyles.input, alertMsg && inputStyles.inputAlert]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
      />
      {alertMsg && (
        <View style={inputStyles.alertRow}>
          <Icon name="alert-triangle" size={12} color={colors.warning} />
          <Text style={inputStyles.alertMsg}>{alertMsg}</Text>
        </View>
      )}
    </View>
  );
}

function MultilineField({ label, value, onChange, placeholder, hint }: any) {
  return (
    <View style={inputStyles.field}>
      <Text style={inputStyles.label}>{label}</Text>
      {hint && <Text style={inputStyles.hint}>{hint}</Text>}
      <TextInput
        style={inputStyles.textarea}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  field:      { marginBottom: spacing.md },
  labelRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  label:      { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  alertRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  hint:       { fontSize: fontSize.xs, color: colors.textLight, marginBottom: spacing.xs, fontStyle: 'italic' },
  input: {
    height: TAP_TARGET,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputAlert:  { borderColor: colors.warning },
  alertMsg:    { fontSize: fontSize.xs, color: colors.warning, marginTop: spacing.xs, fontWeight: fontWeight.semibold },
  textarea: {
    minHeight: 80,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
});

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
  scrollContent: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },

  infoCard: { backgroundColor: colors.primaryLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl, borderLeftWidth: 4, borderLeftColor: colors.primary },
  infoLabel:    { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary, letterSpacing: 0.5 },
  infoId:       { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  infoMed:      { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.primaryDark, marginTop: spacing.xs },
  infoSpecialite:{ fontSize: fontSize.sm, color: colors.primary },

  sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },

  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md, marginBottom: spacing.md },

  row: { flexDirection: 'row', gap: spacing.md },

  protocoleBox: {
    flexDirection: 'row',
    backgroundColor: colors.infoLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  protocoleTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.info, marginBottom: 4 },
  protocoleText:  { fontSize: fontSize.sm, color: colors.info, lineHeight: 20 },

  submitBtn:         { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', ...shadow.md, marginBottom: spacing.lg },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.black },
});

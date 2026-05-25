import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, TAP_TARGET } from '../../components/theme';
import { Icon, type IconName } from '../../components/Icons';

type Props = { route: { params: { consultation: any } }; navigation: any };

export default function SaisieSignesVitauxScreen({ route, navigation }: Props) {
  const { consultation } = route.params;
  const { token }        = useAuth();

  const [temperature,        setTemperature]        = useState('');
  const [tensSys,            setTensSys]            = useState('');
  const [tensDias,           setTensDias]           = useState('');
  const [pouls,              setPouls]              = useState('');
  const [satO2,              setSatO2]              = useState('');
  const [poids,              setPoids]              = useState('');
  const [obsLangue,          setObsLangue]          = useState('');
  const [obsTeint,           setObsTeint]           = useState('');
  const [obsCou,             setObsCou]             = useState('');
  const [obsGen,             setObsGen]             = useState('');
  const [kitTDR,             setKitTDR]             = useState<string | null>(null);
  const [loading,            setLoading]            = useState(false);

  const temp = parseFloat(temperature);
  const alerteTempLabel = !isNaN(temp) ? (temp >= 39.5 ? 'FIÈVRE ÉLEVÉE' : temp >= 38 ? 'Fièvre légère' : temp < 36 ? 'Hypothermie' : null) : null;

  async function valider() {
    if (!temperature || !tensSys || !tensDias || !pouls) {
      Alert.alert('Champs requis', 'Renseignez au minimum la température, la tension et le pouls.');
      return;
    }
    if (!consultation?.id) {
      Alert.alert('OK', 'Signes vitaux enregistrés localement. Aucune consultation liée.');
      navigation.goBack();
      return;
    }
    setLoading(true);
    try {
      const result = await api.post<any>(
        `/api/consultations/${consultation.id}/signes-vitaux`,
        {
          consultation_id: consultation.id,
          temperature: parseFloat(temperature),
          tension_systolique: parseInt(tensSys),
          tension_diastolique: parseInt(tensDias),
          pouls: parseInt(pouls),
          saturation_o2: satO2 ? parseFloat(satO2) : undefined,
          poids: poids ? parseFloat(poids) : undefined,
          observation_langue:  obsLangue || undefined,
          observation_teint:   obsTeint  || undefined,
          observation_cou:     obsCou    || undefined,
          observations_generales: obsGen || undefined,
        },
        token,
      );
      if (result.alerte) {
        Alert.alert('ALERTE MÉDICALE', result.alerte, [{ text: 'Compris', onPress: () => navigation.goBack() }]);
      } else {
        Alert.alert('Enregistré', 'Fiche de pré-consultation transmise au médecin.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible d\'enregistrer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Signes vitaux</Text>
        {consultation?.patient && (
          <Text style={styles.headerSub}>{consultation.patient.prenom} {consultation.patient.nom}</Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {alerteTempLabel && (
          <View style={[styles.alerteBanner, temp >= 39.5 ? styles.alerteRouge : styles.alerteOrange]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name={temp >= 39.5 ? 'ambulance' : 'alert-triangle'} size={16} color={temp >= 39.5 ? colors.danger : colors.warning} />
              <Text style={styles.alerteText}>{alerteTempLabel}</Text>
            </View>
          </View>
        )}

        <Text style={styles.secTitle}>MESURES OBJECTIVES</Text>
        <View style={styles.card}>
          <VitalInput label="Température (°C) *" value={temperature} onChange={setTemperature} placeholder="37.5" unit="°C" iconName="thermometer" />
          <View style={styles.row}>
            <VitalInput label="Systolique *" value={tensSys}  onChange={setTensSys}  placeholder="120" unit="mmHg" flex />
            <VitalInput label="Diastolique *" value={tensDias} onChange={setTensDias} placeholder="80"  unit="mmHg" flex />
          </View>
          <VitalInput label="Pouls (bpm) *"       value={pouls} onChange={setPouls} placeholder="72"  unit="bpm" iconName="heart"    />
          <VitalInput label="Saturation O₂ (%)" value={satO2} onChange={setSatO2} placeholder="98" unit="%"   iconName="lungs"    />
          <VitalInput label="Poids (kg)"         value={poids} onChange={setPoids} placeholder="65" unit="kg"  iconName="activity" />
        </View>

        <Text style={styles.secTitle}>KITS DE DIAGNOSTIC RAPIDE (TDR)</Text>
        <View style={styles.card}>
          <Text style={styles.kitLabel}>Résultat kit TDR effectué :</Text>
          <View style={styles.kitRow}>
            {[
              { key: 'paludisme_positif',  label: 'Paludisme +',   color: colors.danger  },
              { key: 'paludisme_negatif',  label: 'Paludisme −',   color: colors.primary },
              { key: 'typhoide_positif',   label: 'Typhoïde +',    color: colors.danger  },
              { key: 'typhoide_negatif',   label: 'Typhoïde −',    color: colors.primary },
              { key: 'hiv_positif',        label: 'HIV +',         color: colors.danger  },
              { key: 'hiv_negatif',        label: 'HIV −',         color: colors.primary },
              { key: 'non_effectue',       label: 'Non effectué',  color: colors.textMuted },
            ].map(k => (
              <TouchableOpacity
                key={k.key}
                style={[styles.kitChip, kitTDR === k.key && { backgroundColor: k.color, borderColor: k.color }]}
                onPress={() => setKitTDR(k.key === kitTDR ? null : k.key)}
              >
                <Text style={[styles.kitChipText, kitTDR === k.key && { color: '#FFF' }]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.secTitle}>OBSERVATIONS CLINIQUES</Text>
        <View style={styles.card}>
          <ObsField label="Langue" value={obsLangue} onChange={setObsLangue} placeholder="Couleur, aspect, dépôts…" />
          <ObsField label="Teint / peau" value={obsTeint} onChange={setObsTeint} placeholder="Pâleur, jaunisse, rougeurs…" />
          <ObsField label="Cou / ganglions" value={obsCou} onChange={setObsCou} placeholder="Ganglions, rigidité…" />
          <ObsField label="Observations générales" value={obsGen} onChange={setObsGen} placeholder="Symptômes, durée, intensité…" />
        </View>

        <TouchableOpacity
          style={[styles.validerBtn, loading && styles.validerBtnDisabled]}
          onPress={valider}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.validerBtnText}>Transmettre au médecin →</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function VitalInput({ label, value, onChange, placeholder, unit, iconName, flex }: any) {
  return (
    <View style={[vitStyles.field, flex && { flex: 1 }]}>
      <View style={vitStyles.labelRow}>
        {iconName && <Icon name={iconName as IconName} size={13} color={colors.textMuted} />}
        <Text style={vitStyles.label}>{label}</Text>
      </View>
      <View style={vitStyles.inputRow}>
        <TextInput
          style={vitStyles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
        />
        <Text style={vitStyles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

function ObsField({ label, value, onChange, placeholder }: any) {
  return (
    <View style={vitStyles.obsField}>
      <Text style={vitStyles.label}>{label}</Text>
      <TextInput
        style={vitStyles.textarea}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
      />
    </View>
  );
}

const vitStyles = StyleSheet.create({
  field:    { marginBottom: spacing.md },
  obsField: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  label:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    height: TAP_TARGET,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  unit: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium, minWidth: 36 },
  textarea: {
    minHeight: 68,
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
    backgroundColor: colors.auxiliaire,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerTitle: { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.65)', fontSize: fontSize.sm, marginTop: 3 },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },

  alerteBanner: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
  alerteRouge:  { backgroundColor: colors.dangerLight, borderLeftWidth: 4, borderLeftColor: colors.danger },
  alerteOrange: { backgroundColor: colors.warningLight, borderLeftWidth: 4, borderLeftColor: colors.warning },
  alerteText:   { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text },

  secTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  card:     { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md, marginBottom: spacing.md },
  row:      { flexDirection: 'row', gap: spacing.md },

  kitLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.sm },
  kitRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kitChip:  { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  kitChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted },

  validerBtn:         { backgroundColor: colors.auxiliaire, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', ...shadow.md, marginBottom: spacing.lg },
  validerBtnDisabled: { opacity: 0.6 },
  validerBtnText:     { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.black },
});

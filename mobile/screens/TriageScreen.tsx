import React, { useState, useContext } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../components/theme';
import { Icon, IconName } from '../components/Icons';
import { api } from '../components/api';
import { useAuth } from '../components/AuthContext';

// ─── Symptômes prédéfinis (contexte RDC) ────────────────────────────────────

const SYMPTOMES_PREDEFINIS: { id: string; label: string; iconName: IconName; categorie: string }[] = [
  { id: 's1',  label: 'Fièvre',              iconName: 'thermometer',   categorie: 'courant'    },
  { id: 's2',  label: 'Maux de tête',         iconName: 'brain',         categorie: 'courant'    },
  { id: 's3',  label: 'Frissons',             iconName: 'wind',          categorie: 'courant'    },
  { id: 's4',  label: 'Fatigue intense',       iconName: 'activity',      categorie: 'courant'    },
  { id: 's5',  label: 'Toux',                 iconName: 'lungs',         categorie: 'courant'    },
  { id: 's6',  label: 'Douleur abdominale',   iconName: 'activity',      categorie: 'digestif'   },
  { id: 's7',  label: 'Diarrhée',             iconName: 'droplet',       categorie: 'digestif'   },
  { id: 's8',  label: 'Vomissements',         iconName: 'alert-circle',  categorie: 'digestif'   },
  { id: 's9',  label: 'Éruption cutanée',     iconName: 'bandage',       categorie: 'peau'       },
  { id: 's10', label: 'Plaie / blessure',     iconName: 'bandage',       categorie: 'traumatisme'},
  { id: 's11', label: 'Douleur thoracique',   iconName: 'heart-pulse',   categorie: 'urgent'     },
  { id: 's12', label: 'Difficultés resp.',    iconName: 'lungs',         categorie: 'urgent'     },
  { id: 's13', label: 'Perte de conscience',  iconName: 'alert-triangle',categorie: 'urgent'     },
  { id: 's14', label: 'Convulsions',          iconName: 'zap',           categorie: 'urgent'     },
  { id: 's15', label: 'Hémorragie',           iconName: 'droplet',       categorie: 'urgent'     },
  { id: 's16', label: 'Paludisme suspecté',   iconName: 'leaf',          categorie: 'tropical'   },
  { id: 's17', label: 'Jaunissement peau',    iconName: 'sun',           categorie: 'tropical'   },
  { id: 's18', label: 'Malnutrition',         iconName: 'leaf',          categorie: 'nutrition'  },
  { id: 's19', label: 'Grossesse / accoucht.', iconName: 'heart',        categorie: 'grossesse'  },
  { id: 's20', label: 'Anxiété / tristesse',  iconName: 'brain',         categorie: 'mental'     },
];

const URGENCE_OPTIONS = [
  { id: 'normale',     label: 'Normale',      color: colors.success, desc: "Pas d'urgence immédiate" },
  { id: 'urgent',      label: 'Urgent',        color: colors.warning, desc: 'Besoin rapide de soins' },
  { id: 'tres_urgent', label: 'Très urgent',   color: colors.danger,  desc: 'Situation critique' },
];

const SEVERITE_CONFIG: Record<string, { color: string; bg: string; iconName: IconName; label: string }> = {
  benin:   { color: '#16A34A', bg: '#DCFCE7', iconName: 'check-circle',   label: 'Cas bénin' },
  modere:  { color: '#D97706', bg: '#FEF3C7', iconName: 'alert-triangle', label: 'Modéré'    },
  serieux: { color: '#EA580C', bg: '#FED7AA', iconName: 'alert-triangle', label: 'Sérieux'   },
  urgent:  { color: '#DC2626', bg: '#FEE2E2', iconName: 'ambulance',      label: 'URGENT'    },
};

// ─── Écran Triage ────────────────────────────────────────────────────────────

export default function TriageScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const patientId = route.params?.patient_id || 'ADH-001';
  const patientNom = route.params?.patient_nom || 'Patient';

  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState('normale');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const toggleSymptome = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const symptomesTexte = selected.map(id => {
    const s = SYMPTOMES_PREDEFINIS.find(s => s.id === id);
    return s ? s.label : id;
  });

  const lancer = async () => {
    if (selected.length === 0 && description.trim() === '') {
      Alert.alert('Symptômes requis', 'Sélectionnez au moins un symptôme ou décrivez la situation.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const body: any = {
        patient_id: patientId,
        symptomes: symptomesTexte.length > 0 ? symptomesTexte : [description.trim()],
        description: description.trim(),
        urgence_percue: urgence,
      };
      if (route.params?.age_patient) body.age_patient = route.params.age_patient;
      const data = await api.post('/api/consultations/triage', body, token);
      setResult(data);
    } catch (e: any) {
      Alert.alert('Erreur triage', e.message || 'Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const allerPrendreRDV = () => {
    if (!result?.medecin_recommande_id) return;
    navigation.navigate('PriseRDV', {
      medecin_id: result.medecin_recommande_id,
      patient_id: patientId,
      patient_nom: patientNom,
      triage_id: result.triage_id,
      motif: symptomesTexte.join(', '),
    });
  };

  const sev = result ? (SEVERITE_CONFIG[result.niveau_severite] || SEVERITE_CONFIG.modere) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.primaryDark} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Triage IA</Text>
          <Text style={styles.headerSub}>Patient : {patientNom}</Text>
        </View>
        <View style={styles.aiChip}>
          <Text style={styles.aiChipText}>IA</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Sélection symptômes ── */}
        {!result && (
          <>
            <Text style={styles.sectionTitle}>Symptômes observés</Text>
            <View style={styles.sympGrid}>
              {SYMPTOMES_PREDEFINIS.map(s => {
                const on = selected.includes(s.id);
                const isUrgent = s.categorie === 'urgent';
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => toggleSymptome(s.id)}
                    style={[
                      styles.sympChip,
                      on && styles.sympChipOn,
                      isUrgent && styles.sympChipUrgent,
                      on && isUrgent && styles.sympChipUrgentOn,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Icon name={s.iconName} size={14} color={on ? '#fff' : (isUrgent ? colors.danger : colors.primaryMid)} />
                    <Text style={[styles.sympLabel, on && styles.sympLabelOn]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description libre */}
            <Text style={styles.sectionTitle}>Description complémentaire</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Décrivez la situation en détail (durée, intensité, contexte…)"
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Niveau d'urgence */}
            <Text style={styles.sectionTitle}>Niveau d'urgence perçu</Text>
            <View style={styles.urgenceRow}>
              {URGENCE_OPTIONS.map(u => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => setUrgence(u.id)}
                  style={[styles.urgBtn, urgence === u.id && { borderColor: u.color, backgroundColor: u.color + '18' }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.urgDot, { backgroundColor: u.color }]} />
                  <Text style={[styles.urgLabel, urgence === u.id && { color: u.color, fontWeight: fontWeight.bold }]}>
                    {u.label}
                  </Text>
                  <Text style={styles.urgDesc}>{u.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.launchBtn, loading && styles.launchBtnDisabled]}
              onPress={lancer}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.launchBtnText}>Analyser avec l'IA</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ── Résultat triage ── */}
        {result && sev && (
          <>
            {/* Badge sévérité */}
            <View style={[styles.severiteBadge, { backgroundColor: sev.bg, borderColor: sev.color }]}>
              <Icon name={sev.iconName} size={28} color={sev.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.severiteLabel, { color: sev.color }]}>{sev.label.toUpperCase()}</Text>
                <Text style={[styles.severiteMessage, { color: sev.color }]}>{result.urgence_message}</Text>
              </View>
            </View>

            {/* Analyse */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Analyse IA</Text>
              <Text style={styles.cardText}>{result.analyse}</Text>
            </View>

            {/* Actions immédiates */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Actions immédiates</Text>
              {(result.actions_immediates || []).map((a: string, i: number) => (
                <View key={i} style={styles.actionRow}>
                  <View style={[styles.actionNum, { backgroundColor: sev.color }]}>
                    <Text style={styles.actionNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.actionText}>{a}</Text>
                </View>
              ))}
            </View>

            {/* Questions complémentaires */}
            {result.questions_complementaires?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Questions à poser au patient</Text>
                {result.questions_complementaires.map((q: string, i: number) => (
                  <View key={i} style={styles.questionRow}>
                    <Text style={styles.questionBullet}>?</Text>
                    <Text style={styles.questionText}>{q}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Conseil immédiat */}
            {result.conseil_immediat && (
              <View style={[styles.card, styles.conseilCard]}>
                <Text style={styles.conseilTitle}>Conseil de l'IA</Text>
                <Text style={styles.conseilText}>{result.conseil_immediat}</Text>
              </View>
            )}

            {/* Orientation hôpital */}
            {result.orientation_hopital && (
              <View style={styles.hopitalAlert}>
                <Icon name="ambulance" size={20} color={colors.danger} />
                <Text style={styles.hopitalText}>
                  Orientation vers l'hôpital recommandée
                  {result.orientation_hopital_motif ? `\n${result.orientation_hopital_motif}` : ''}
                </Text>
              </View>
            )}

            {/* CTA selon résultat */}
            {result.rdv_recommande && result.medecin_recommande_id ? (
              <View style={styles.rdvBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rdvBannerTitle}>RDV recommandé</Text>
                  <Text style={styles.rdvBannerSub}>
                    {result.medecin_recommande_nom} — {result.specialite_recommandee}
                  </Text>
                  <Text style={styles.rdvBannerDelai}>
                    Délai : {result.rdv_delai?.replace(/_/g, ' ') || 'à déterminer'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.rdvBtn} onPress={allerPrendreRDV} activeOpacity={0.85}>
                  <Text style={styles.rdvBtnText}>Prendre RDV</Text>
                </TouchableOpacity>
              </View>
            ) : (
              result.gestion_locale && (
                <View style={styles.localBanner}>
                  <Icon name="check-circle" size={20} color={colors.success} />
                  <Text style={styles.localText}>Prise en charge locale — pas de consultation nécessaire</Text>
                </View>
              )
            )}

            {/* Nouveau triage */}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => { setResult(null); setSelected([]); setDescription(''); setUrgence('normale'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetBtnText}>Nouveau triage</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn:       { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  headerSub:     { fontSize: fontSize.sm, color: colors.textMuted },
  aiChip:        { marginLeft: 'auto', backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  aiChipText:    { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  scroll:        { padding: spacing.lg, paddingBottom: 40 },
  sectionTitle:  { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  sympGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sympChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  sympChipOn:    { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  sympChipUrgent:{ borderColor: colors.dangerLight },
  sympChipUrgentOn: { backgroundColor: colors.dangerLight, borderColor: colors.danger },
  sympLabel:     { fontSize: fontSize.xs, color: colors.text },
  sympLabelOn:   { color: colors.primary, fontWeight: fontWeight.semibold },
  textarea:      { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text, minHeight: 90 },
  urgenceRow:    { flexDirection: 'column', gap: spacing.sm },
  urgBtn:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  urgDot:        { width: 12, height: 12, borderRadius: 6 },
  urgLabel:      { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text },
  urgDesc:       { fontSize: fontSize.xs, color: colors.textMuted, marginLeft: 'auto' },
  launchBtn:     { marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', ...shadow.md },
  launchBtnDisabled: { opacity: 0.6 },
  launchBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },

  severiteBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing.md },
  severiteLabel: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  severiteMessage: { fontSize: fontSize.sm },

  card:          { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  cardTitle:     { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  cardText:      { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22 },
  actionRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  actionNum:     { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  actionNumText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  actionText:    { flex: 1, fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  questionRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  questionBullet:{ fontSize: fontSize.md, color: colors.primary, fontWeight: fontWeight.bold, width: 16 },
  questionText:  { flex: 1, fontSize: fontSize.md, color: colors.textMuted },
  conseilCard:   { backgroundColor: colors.infoLight, borderWidth: 1, borderColor: colors.info },
  conseilTitle:  { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.info, marginBottom: 4 },
  conseilText:   { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },

  hopitalAlert:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.danger },
  hopitalIcon:   { fontSize: 20 },
  hopitalText:   { flex: 1, fontSize: fontSize.md, color: colors.dangerMid, fontWeight: fontWeight.medium },

  rdvBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary, gap: spacing.sm },
  rdvBannerTitle:{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primaryDark },
  rdvBannerSub:  { fontSize: fontSize.sm, color: colors.primary },
  rdvBannerDelai:{ fontSize: fontSize.xs, color: colors.primaryMid, marginTop: 2 },
  rdvBtn:        { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rdvBtnText:    { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  localBanner:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  localIcon:     { fontSize: 18 },
  localText:     { flex: 1, fontSize: fontSize.md, color: colors.primaryDark, fontWeight: fontWeight.medium },

  resetBtn:      { marginTop: spacing.sm, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  resetBtnText:  { color: colors.textMuted, fontSize: fontSize.md },
});

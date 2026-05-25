import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuth } from '../components/AuthContext';
import { api } from '../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../components/theme';
import { Icon } from '../components/Icons';

dayjs.locale('fr');

type Demande = {
  id: string;
  motif: string;
  symptomes: string;
  urgence: 'faible' | 'modere' | 'eleve';
  statut: 'en_attente' | 'en_cours' | 'traite' | 'annule';
  created_at: string;
  rdv?: { date: string; heure: string; medecin: string };
};

const URGENCE_LABELS = { faible: 'Faible', modere: 'Modérée', eleve: 'Élevée' };
const URGENCE_COLORS = {
  faible:  { bg: palette.greenSoft,  text: palette.greenDeep,  border: palette.green  },
  modere:  { bg: palette.blueSoft,   text: palette.blueDeep,   border: palette.blue   },
  eleve:   { bg: '#FEF3C7',          text: '#92400E',           border: '#D97706'      },
};
const STATUT_LABELS = {
  en_attente: 'En attente',
  en_cours:   'Prise en charge',
  traite:     'Traité',
  annule:     'Annulé',
};

const DEMO_DEMANDES: Demande[] = [
  {
    id: 'DEM-001',
    motif: 'Fièvre persistante',
    symptomes: 'Fièvre à 39°C depuis 3 jours, maux de tête, fatigue intense. Pas de toux.',
    urgence: 'modere',
    statut: 'en_cours',
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    rdv: { date: '2026-05-25', heure: '10h00 – 10h30', medecin: 'Dr. Emmanuel LUKUSA' },
  },
];

export default function ConsultationScreen({ navigation }: any) {
  const { user, token } = useAuth();

  const [demandes,  setDemandes]  = useState<Demande[]>(DEMO_DEMANDES);
  const [loading,   setLoading]   = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [sending,   setSending]   = useState(false);

  // Formulaire
  const [motif,     setMotif]     = useState('');
  const [symptomes, setSymptomes] = useState('');
  const [urgence,   setUrgence]   = useState<'faible' | 'modere' | 'eleve'>('faible');

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ demandes: Demande[] }>('/api/consultations/demandes/mes', token)
      .then(d => { if (!cancelled && d.demandes) setDemandes(d.demandes); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]));

  async function soumettreDemande() {
    if (!motif.trim()) { Alert.alert('Champ requis', 'Décrivez brièvement votre motif.'); return; }
    if (!symptomes.trim()) { Alert.alert('Champ requis', 'Décrivez vos symptômes.'); return; }
    setSending(true);
    try {
      const res = await api.post<{ demande_id: string }>('/api/consultations/demande', {
        patient_id: user?.id,
        motif: motif.trim(),
        symptomes: symptomes.trim(),
        urgence,
      }, token);
      const nouvelle: Demande = {
        id: res.demande_id,
        motif: motif.trim(),
        symptomes: symptomes.trim(),
        urgence,
        statut: 'en_attente',
        created_at: new Date().toISOString(),
      };
      setDemandes(prev => [nouvelle, ...prev]);
      setMotif('');
      setSymptomes('');
      setUrgence('faible');
      setShowForm(false);
      Alert.alert(
        'Demande envoyée',
        'Votre auxiliaire de santé a été notifié. Il vous contactera très prochainement.',
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible d\'envoyer la demande.');
    } finally {
      setSending(false);
    }
  }

  const nbEnCours = demandes.filter(d => d.statut === 'en_attente' || d.statut === 'en_cours').length;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Consultation médicale</Text>
          <Text style={styles.headerSub}>Votre auxiliaire coordonne votre prise en charge</Text>
        </View>
        {nbEnCours > 0 && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>{nbEnCours} active{nbEnCours > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Bannière info workflow */}
      <View style={styles.workflowBanner}>
        <Icon name="info" size={16} color={palette.blueDeep} />
        <Text style={styles.workflowText}>
          Votre auxiliaire de santé prend en charge votre demande, collecte vos symptômes et coordonne votre rendez-vous avec le médecin le plus adapté.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Bouton nouvelle demande */}
        {!showForm && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <View style={styles.newBtnIcon}>
              <Icon name="plus" size={22} color={palette.white} />
            </View>
            <View style={styles.newBtnText}>
              <Text style={styles.newBtnTitle}>Demander une consultation</Text>
              <Text style={styles.newBtnSub}>Décrivez votre problème de santé</Text>
            </View>
            <Icon name="arrow-right" size={18} color={palette.blueDeep} />
          </TouchableOpacity>
        )}

        {/* Formulaire de demande */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nouvelle demande de consultation</Text>

            <Text style={styles.fieldLabel}>Motif principal *</Text>
            <TextInput
              style={styles.inputShort}
              placeholder="Ex : Fièvre, douleurs abdominales, toux…"
              placeholderTextColor={colors.textLight}
              value={motif}
              onChangeText={setMotif}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Décrivez vos symptômes *</Text>
            <TextInput
              style={styles.inputLong}
              placeholder="Depuis quand ? Intensité ? Autres symptômes associés ? Médicaments déjà pris ?"
              placeholderTextColor={colors.textLight}
              value={symptomes}
              onChangeText={setSymptomes}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Niveau d'urgence ressenti</Text>
            <View style={styles.urgenceRow}>
              {(['faible', 'modere', 'eleve'] as const).map(u => {
                const col = URGENCE_COLORS[u];
                const active = urgence === u;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[styles.urgenceChip, active && { backgroundColor: col.bg, borderColor: col.border }]}
                    onPress={() => setUrgence(u)}
                  >
                    <Text style={[styles.urgenceChipText, active && { color: col.text, fontWeight: fontWeight.bold }]}>
                      {URGENCE_LABELS[u]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={soumettreDemande} activeOpacity={0.85}>
                {sending
                  ? <ActivityIndicator size="small" color={palette.white} />
                  : <Text style={styles.sendBtnText}>Envoyer la demande</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Historique des demandes */}
        {demandes.length > 0 && (
          <>
            <Text style={styles.secLabel}>MES DEMANDES</Text>
            {demandes.map(d => {
              const col = URGENCE_COLORS[d.urgence];
              return (
                <View key={d.id} style={styles.demandeCard}>
                  {/* En-tête */}
                  <View style={styles.demandeHeader}>
                    <View style={[styles.urgPill, { backgroundColor: col.bg }]}>
                      <Text style={[styles.urgPillText, { color: col.text }]}>
                        {URGENCE_LABELS[d.urgence]}
                      </Text>
                    </View>
                    <Text style={styles.demandeDate}>{dayjs(d.created_at).format('D MMM à HH:mm')}</Text>
                  </View>

                  <Text style={styles.demandeMotif}>{d.motif}</Text>
                  <Text style={styles.demandeSymptomes} numberOfLines={3}>{d.symptomes}</Text>

                  {/* Statut */}
                  <View style={[styles.statutRow, d.statut === 'en_cours' && styles.statutEnCours]}>
                    {d.statut === 'en_cours' && <View style={styles.statutDot} />}
                    <Text style={[styles.statutText, d.statut === 'traite' && styles.statutTraite]}>
                      {STATUT_LABELS[d.statut]}
                    </Text>
                  </View>

                  {/* RDV programmé */}
                  {d.rdv && (
                    <View style={styles.rdvBox}>
                      <Icon name="calendar" size={14} color={palette.blueDeep} />
                      <View>
                        <Text style={styles.rdvTitle}>Rendez-vous confirmé</Text>
                        <Text style={styles.rdvDetail}>{d.rdv.medecin} · {d.rdv.date} à {d.rdv.heure}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {loading && (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={palette.dark} />
          </View>
        )}

        {!loading && demandes.length === 0 && !showForm && (
          <View style={styles.emptyBox}>
            <Icon name="stethoscope" size={48} color={colors.textLight} strokeWidth={1.2} />
            <Text style={styles.emptyText}>Aucune demande de consultation</Text>
            <Text style={styles.emptySub}>
              Appuyez sur "Demander une consultation" pour contacter votre auxiliaire de santé.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: palette.white,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.text },
  headerSub:   { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, maxWidth: 220 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.greenSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  activeDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.success },
  activeText:  { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.greenDeep },

  workflowBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: palette.blueSoft, marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.xl, padding: spacing.md },
  workflowText:   { flex: 1, fontSize: fontSize.xs, color: palette.blueDeep, lineHeight: 18 },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },

  newBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: palette.white, borderRadius: radius.xxl, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  newBtnIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.dark, justifyContent: 'center', alignItems: 'center' },
  newBtnText: { flex: 1 },
  newBtnTitle: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text },
  newBtnSub:   { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

  formCard: { backgroundColor: palette.white, borderRadius: radius.xxl, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  formTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text, marginBottom: spacing.lg },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md, letterSpacing: 0.5 },
  inputShort: { backgroundColor: colors.bg, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  inputLong:  { backgroundColor: colors.bg, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 100, marginBottom: spacing.sm },

  urgenceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  urgenceChip: { flex: 1, borderRadius: radius.full, paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  urgenceChipText: { fontSize: fontSize.sm, color: colors.textMuted },

  formBtns:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn:  { flex: 1, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  sendBtn:    { flex: 2, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: palette.dark },
  sendBtnText:{ color: palette.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.sm },

  demandeCard: { backgroundColor: palette.white, borderRadius: radius.xxl, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.md },
  demandeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  urgPill:     { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  urgPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  demandeDate: { fontSize: fontSize.xs, color: colors.textMuted },
  demandeMotif:    { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text, marginBottom: 4 },
  demandeSymptomes:{ fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },

  statutRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statutEnCours:{ /* extra styling si needed */ },
  statutDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
  statutText:   { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted },
  statutTraite: { color: palette.greenDeep },

  rdvBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: palette.blueSoft, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  rdvTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.black, color: palette.blueDeep },
  rdvDetail:{ fontSize: fontSize.xs, color: palette.blueDeep, marginTop: 2 },

  emptyBox:  { alignItems: 'center', paddingVertical: 56 },
  emptyText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textMuted, marginTop: spacing.md },
  emptySub:  { fontSize: fontSize.sm, color: colors.textLight, textAlign: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xs, lineHeight: 20 },
});

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon } from '../../components/Icons';

dayjs.locale('fr');

type DemandeAux = {
  id: string;
  patient: { id: string; prenom: string; nom: string };
  motif: string;
  symptomes: string;
  urgence: 'faible' | 'modere' | 'eleve';
  created_at: string;
};

const URGENCE_AUX = {
  faible: { bg: '#ECFDF5', text: '#065F46', label: 'Faible'   },
  modere: { bg: '#EFF6FF', text: '#1E40AF', label: 'Modérée'  },
  eleve:  { bg: '#FEF3C7', text: '#92400E', label: 'Élevée'   },
};

const DEMO_DEMANDES_AUX: DemandeAux[] = [
  {
    id: 'DEM-002',
    patient: { id: 'ADH-003', prenom: 'Cécile', nom: 'NGOY' },
    motif: 'Douleurs thoraciques',
    symptomes: 'Douleur dans la poitrine depuis hier matin, légère dyspnée.',
    urgence: 'eleve',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'DEM-003',
    patient: { id: 'ADH-004', prenom: 'Paul', nom: 'ILUNGA' },
    motif: 'Éruption cutanée',
    symptomes: 'Boutons sur le bras droit, légères démangeaisons, pas de fièvre.',
    urgence: 'faible',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
];

const DEMO_CONSULTATIONS_AUX = [
  {
    id: 'CONS-2026-AA1B2C',
    patient: { id: 'ADH-001', prenom: 'Marie', nom: 'KABONGO' },
    medecin: { prenom: 'Emmanuel', nom: 'LUKUSA', specialite: 'Médecine générale' },
    motif: 'Fièvre et maux de tête depuis 2 jours',
    date_heure: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    statut: 'planifie',
    pre_consultation_faite: false,
  },
  {
    id: 'CONS-2026-DD3E4F',
    patient: { id: 'ADH-002', prenom: 'Joseph', nom: 'MUTOMBO' },
    medecin: { prenom: 'Béatrice', nom: 'MWAMBA', specialite: 'Pédiatrie' },
    motif: 'Consultation de suivi',
    date_heure: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    statut: 'planifie',
    pre_consultation_faite: false,
  },
];

export default function AuxiliaireHomeScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [consultations, setConsultations] = useState(DEMO_CONSULTATIONS_AUX);
  const [demandes,      setDemandes]      = useState<DemandeAux[]>(DEMO_DEMANDES_AUX);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    api.get<{ demandes: DemandeAux[] }>('/api/consultations/demandes', token)
      .then(d => { if (!cancelled && d.demandes) setDemandes(d.demandes); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]));

  const prochaine = consultations.find(c => c.statut === 'planifie');
  const urgentes  = consultations.filter(c => !c.pre_consultation_faite && c.statut === 'planifie');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />
        <Text style={styles.headerTitle}>Tableau de bord</Text>
        <Text style={styles.headerSub}>Auxiliaire de santé · {user?.prenom} {user?.nom}</Text>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatVal}>{consultations.length}</Text>
            <Text style={styles.headerStatLbl}>consultations aujourd'hui</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatVal, urgentes.length > 0 && styles.headerStatValAlert]}>
              {urgentes.length}
            </Text>
            <Text style={styles.headerStatLbl}>pré-consultations requises</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} colors={[palette.greenDeep]} />}
      >
        {urgentes.length > 0 && (
          <View style={styles.alerteBanner}>
            <Icon name="clock" size={18} color={colors.warning} />
            <Text style={styles.alerteText}>
              {urgentes.length} pré-consultation{urgentes.length > 1 ? 's' : ''} à compléter avant l'appel médecin
            </Text>
          </View>
        )}

        {/* ── Demandes en attente des adhérents ── */}
        {demandes.length > 0 && (
          <>
            <Text style={styles.secLabel}>DEMANDES EN ATTENTE — {demandes.length}</Text>
            {demandes.map(d => {
              const col = URGENCE_AUX[d.urgence];
              const initiales = d.patient.prenom[0] + d.patient.nom[0];
              return (
                <View key={d.id} style={[styles.demandeCard, d.urgence === 'eleve' && styles.demandeCardUrgent]}>
                  <View style={styles.demandeTop}>
                    <View style={styles.demandePatient}>
                      <View style={styles.demandeAvatar}>
                        <Text style={styles.demandeAvatarText}>{initiales}</Text>
                      </View>
                      <View>
                        <Text style={styles.demandePatientNom}>{d.patient.prenom} {d.patient.nom}</Text>
                        <Text style={styles.demandeMotif}>{d.motif}</Text>
                      </View>
                    </View>
                    <View style={[styles.urgPill, { backgroundColor: col.bg }]}>
                      <Text style={[styles.urgPillText, { color: col.text }]}>{col.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.demandeSymptomes} numberOfLines={2}>{d.symptomes}</Text>
                  <Text style={styles.demandeDateText}>
                    Reçue {dayjs(d.created_at).fromNow ? dayjs(d.created_at).format('D MMM à HH:mm') : ''}
                  </Text>
                  <View style={styles.demandeActions}>
                    <TouchableOpacity
                      style={styles.demandeTraiterBtn}
                      onPress={() => navigation.navigate('SaisieSignesVitaux', { consultation: { patient: d.patient, motif: d.motif, symptomes: d.symptomes, demande_id: d.id } })}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.demandeTraiterBtnText}>Prendre en charge</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.demandeRdvBtn}
                      onPress={() => navigation.navigate('PriseRDV', { patient_id: d.patient.id, demande_id: d.id, motif: d.motif })}
                      activeOpacity={0.85}
                    >
                      <Icon name="calendar" size={14} color={palette.blueDeep} />
                      <Text style={styles.demandeRdvBtnText}>Programmer RDV</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <Text style={styles.secLabel}>CONSULTATIONS DU JOUR</Text>

        {consultations.map(cons => {
          const minutesAvant = Math.round((new Date(cons.date_heure).getTime() - Date.now()) / 60000);
          const urgent = minutesAvant <= 15 && minutesAvant >= 0;
          return (
            <View key={cons.id} style={[styles.consCard, urgent && styles.consCardUrgent]}>
              {urgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>Dans {minutesAvant} min — Préparer maintenant</Text>
                </View>
              )}
              <View style={styles.consHeader}>
                <View style={styles.consPatient}>
                  <View style={styles.consAvatar}>
                    <Text style={styles.consAvatarText}>{cons.patient.prenom[0]}{cons.patient.nom[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.consPatientNom}>{cons.patient.prenom} {cons.patient.nom}</Text>
                    <Text style={styles.consMedecin}>Dr. {cons.medecin.prenom} {cons.medecin.nom}</Text>
                  </View>
                </View>
                <View style={styles.consTime}>
                  <Text style={styles.consHeure}>{dayjs(cons.date_heure).format('HH:mm')}</Text>
                  <Text style={styles.consDate}>{dayjs(cons.date_heure).format('D MMM')}</Text>
                </View>
              </View>

              <Text style={styles.consMotif} numberOfLines={2}>{cons.motif}</Text>

              <View style={styles.consActions}>
                <TouchableOpacity
                  style={[styles.preConsBtn, cons.pre_consultation_faite && styles.preConsBtnDone]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('SaisieSignesVitaux', { consultation: cons })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {cons.pre_consultation_faite && <Icon name="check" size={14} color={colors.primaryDark} />}
                    <Text style={[styles.preConsBtnText, cons.pre_consultation_faite && styles.preConsBtnTextDone]}>
                      {cons.pre_consultation_faite ? 'Pré-consultation faite' : 'Saisir signes vitaux'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.suiBtn}
                  onPress={() => navigation.navigate('SuiviPatient', { consultation: cons })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.suiBtnText}>Suivi</Text>
                    <Icon name="arrow-right" size={14} color={palette.greenDeep} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Triage IA — bouton principal */}
        <TouchableOpacity
          style={[styles.nouveauBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => navigation.navigate('Triage', { patient_id: 'ADH-001', patient_nom: 'Patient' })}
          activeOpacity={0.85}
        >
          <Icon name="brain" size={22} color="#fff" />
          <Text style={[styles.nouveauText, { color: '#fff' }]}>Triage IA patient</Text>
        </TouchableOpacity>

        {/* Nouveau patient */}
        <TouchableOpacity
          style={styles.nouveauBtn}
          onPress={() => navigation.navigate('SaisieSignesVitaux', { consultation: null })}
          activeOpacity={0.85}
        >
          <Icon name="user-plus" size={22} color={palette.greenDeep} />
          <Text style={styles.nouveauText}>Nouveau patient sans RDV</Text>
        </TouchableOpacity>

        {/* Fournitures premier secours & renouvellements */}
        <TouchableOpacity
          style={[styles.nouveauBtn, styles.fournBtn]}
          onPress={() => navigation.navigate('Fournitures')}
          activeOpacity={0.85}
        >
          <Icon name="package" size={22} color={palette.blueDeep} />
          <Text style={[styles.nouveauText, { color: palette.blueDeep }]}>Fournitures & Renouvellements</Text>
        </TouchableOpacity>

        {/* Guide rapide */}
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>Protocole pré-consultation (15 min avant)</Text>
          {[
            'Température corporelle (thermomètre)',
            'Tension artérielle (tensiomètre)',
            'Pouls (stéthoscope ou oxymètre)',
            'Observation langue, teint, cou',
            'Saisie dans l\'application',
          ].map((step, i) => (
            <View key={i} style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>{i + 1}</Text></View>
              <Text style={styles.guideStepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: palette.dark,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  headerDecor1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: palette.green,  opacity: 0.15, top: -80, right: -50 },
  headerDecor2: { position: 'absolute', width: 100, height: 100, borderRadius: 50,  backgroundColor: palette.blue,   opacity: 0.12, bottom: -20, left: 20 },
  headerTitle: { color: palette.white, fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.65)', fontSize: fontSize.sm, marginTop: 2, marginBottom: spacing.lg },
  headerStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.lg, padding: spacing.md, gap: spacing.lg },
  headerStat:  { flex: 1, alignItems: 'center' },
  headerStatVal:      { color: palette.white, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  headerStatValAlert: { color: palette.green },
  headerStatLbl:      { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.xs, textAlign: 'center', marginTop: 2 },
  headerStatDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  alerteBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningLight, marginHorizontal: spacing.lg, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning },
  alerteText:   { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.warning },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm },

  consCard:       { backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md },
  consCardUrgent: { borderWidth: 2, borderColor: colors.warning },
  urgentBadge:    { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  urgentBadgeText:{ color: colors.warning, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textAlign: 'center' },
  consHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  consPatient:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  consAvatar:   { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.green, justifyContent: 'center', alignItems: 'center' },
  consAvatarText:   { fontSize: fontSize.md, fontWeight: fontWeight.black, color: palette.greenDeep },
  consPatientNom:   { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  consMedecin:      { fontSize: fontSize.xs, color: colors.textMuted },
  consTime:         { alignItems: 'flex-end' },
  consHeure:        { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  consDate:         { fontSize: fontSize.xs, color: colors.textMuted },
  consMotif:        { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  consActions:      { flexDirection: 'row', gap: spacing.sm },
  preConsBtn:       { flex: 1, backgroundColor: palette.dark, borderRadius: radius.full, paddingVertical: spacing.sm, alignItems: 'center' },
  preConsBtnDone:   { backgroundColor: palette.green },
  preConsBtnText:   { color: palette.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  preConsBtnTextDone: { color: palette.greenDeep },
  suiBtn:           { backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  suiBtnText:       { color: palette.greenDeep, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  nouveauBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', gap: spacing.sm, marginBottom: spacing.lg },
  nouveauText:{ fontSize: fontSize.md, color: palette.greenDeep, fontWeight: fontWeight.semibold },
  fournBtn:   { borderColor: palette.blue, backgroundColor: palette.blueSoft },

  // Cartes demandes adhérents
  demandeCard:        { backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md },
  demandeCardUrgent:  { borderWidth: 2, borderColor: '#D97706' },
  demandeTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  demandePatient:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  demandeAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.blue, justifyContent: 'center', alignItems: 'center' },
  demandeAvatarText:  { fontSize: fontSize.md, fontWeight: fontWeight.black, color: palette.blueDeep },
  demandePatientNom:  { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  demandeMotif:       { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  urgPill:            { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  urgPillText:        { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  demandeSymptomes:   { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.xs },
  demandeDateText:    { fontSize: fontSize.xs, color: colors.textLight, marginBottom: spacing.md },
  demandeActions:     { flexDirection: 'row', gap: spacing.sm },
  demandeTraiterBtn:  { flex: 1, backgroundColor: palette.dark, borderRadius: radius.full, paddingVertical: spacing.sm, alignItems: 'center' },
  demandeTraiterBtnText: { color: palette.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  demandeRdvBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.blueSoft, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  demandeRdvBtnText:  { color: palette.blueDeep, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  guideCard:  { backgroundColor: palette.greenSoft, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg },
  guideTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: palette.greenDeep, marginBottom: spacing.md },
  guideStep:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  guideNum:   { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.greenDeep, justifyContent: 'center', alignItems: 'center' },
  guideNumText:    { color: palette.white, fontSize: fontSize.xs, fontWeight: fontWeight.black },
  guideStepText:   { flex: 1, fontSize: fontSize.sm, color: palette.greenDeep },
});

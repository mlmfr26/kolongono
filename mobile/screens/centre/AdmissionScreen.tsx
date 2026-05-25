import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette, TAP_TARGET } from '../../components/theme';
import { Icon } from '../../components/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type Triage = 'vert' | 'jaune' | 'rouge';
type StatutAdmission = 'en_attente' | 'oriente' | 'admis' | 'sorti';
type TypeConsultation = 'consultation' | 'urgence' | 'hospitalisation';
type Orientation = 'teleconsultation_sd' | 'medecin_sur_place' | 'urgences' | 'hospitalisation';

interface Admission {
  id: string;
  nom_patient: string;
  motif: string;
  type: TypeConsultation;
  heure: string;
  triage: Triage | null;
  statut: StatutAdmission;
  orientation: Orientation | null;
}

// ─── Données démo ─────────────────────────────────────────────────────────────

const DEMO_ADMISSIONS: Admission[] = [
  { id: 'A01', nom_patient: 'Solange NTUMBA',    motif: 'Difficultés respiratoires',       type: 'urgence',         heure: '09:03', triage: 'rouge', statut: 'en_attente', orientation: null },
  { id: 'A02', nom_patient: 'Yvette MWAMBA',     motif: 'Douleurs abdominales',             type: 'consultation',    heure: '11:47', triage: 'jaune', statut: 'en_attente', orientation: null },
  { id: 'A03', nom_patient: 'Kevin KASONGO',     motif: 'Fièvre persistante',               type: 'consultation',    heure: '13:10', triage: null,    statut: 'en_attente', orientation: null },
  { id: 'B01', nom_patient: 'Bernadette KABUYA', motif: 'Fièvre et frissons',               type: 'consultation',    heure: '07:42', triage: 'jaune', statut: 'oriente',    orientation: 'teleconsultation_sd' },
  { id: 'B02', nom_patient: 'Pascal LUKUSA',     motif: 'Contrôle tension artérielle',      type: 'consultation',    heure: '10:28', triage: 'vert',  statut: 'oriente',    orientation: 'medecin_sur_place' },
  { id: 'B03', nom_patient: 'Gisèle TSHIMANGA',  motif: 'Suivi grossesse',                  type: 'consultation',    heure: '08:55', triage: 'vert',  statut: 'oriente',    orientation: 'teleconsultation_sd' },
  { id: 'B04', nom_patient: 'Robert MBUYI',      motif: 'Blessure genou gauche',            type: 'urgence',         heure: '12:02', triage: 'jaune', statut: 'oriente',    orientation: 'medecin_sur_place' },
  { id: 'B05', nom_patient: 'Antoinette NGOY',   motif: 'Céphalées intenses',               type: 'consultation',    heure: '14:30', triage: 'jaune', statut: 'oriente',    orientation: 'urgences' },
  { id: 'B06', nom_patient: 'David KALOMBO',     motif: 'Consultation de routine',          type: 'consultation',    heure: '15:00', triage: 'vert',  statut: 'oriente',    orientation: 'medecin_sur_place' },
  { id: 'B07', nom_patient: 'Céleste LUBAMBA',   motif: 'Vomissements répétés',             type: 'urgence',         heure: '09:45', triage: 'jaune', statut: 'oriente',    orientation: 'medecin_sur_place' },
  { id: 'B08', nom_patient: 'Mathieu KASEBA',    motif: 'Contrôle diabète',                 type: 'consultation',    heure: '10:10', triage: 'vert',  statut: 'oriente',    orientation: 'teleconsultation_sd' },
  { id: 'C01', nom_patient: 'Junior MUTOMBO',    motif: 'Blessure bras droit',              type: 'urgence',         heure: '08:15', triage: 'vert',  statut: 'admis',      orientation: 'medecin_sur_place' },
  { id: 'C02', nom_patient: 'Grâce MULUMBA',     motif: 'Pneumonie confirmée',              type: 'hospitalisation', heure: '07:00', triage: 'rouge', statut: 'admis',      orientation: 'hospitalisation' },
  { id: 'C03', nom_patient: 'Théodore KAPEND',   motif: 'Post-opératoire suivi',            type: 'hospitalisation', heure: '06:30', triage: 'jaune', statut: 'admis',      orientation: 'hospitalisation' },
  { id: 'C04', nom_patient: 'Patience MUKENDI',  motif: 'Fracture cheville',                type: 'urgence',         heure: '11:20', triage: 'jaune', statut: 'admis',      orientation: 'hospitalisation' },
  { id: 'C05', nom_patient: 'Olivier LUMBALA',   motif: 'Crise hypertensive',               type: 'urgence',         heure: '10:55', triage: 'rouge', statut: 'admis',      orientation: 'urgences' },
  { id: 'D01', nom_patient: 'Marie-Claire BOWA', motif: 'Consultation pré-natale',          type: 'consultation',    heure: '07:30', triage: 'vert',  statut: 'sorti',      orientation: 'teleconsultation_sd' },
  { id: 'D02', nom_patient: 'Alain TSHIBANDA',   motif: 'Rhume et toux',                    type: 'consultation',    heure: '08:00', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D03', nom_patient: 'Joëlle MWEPU',      motif: 'Douleurs lombaires',               type: 'consultation',    heure: '08:40', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D04', nom_patient: 'Freddy KALONJI',    motif: 'Bilan sanguin résultats',          type: 'consultation',    heure: '09:00', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D05', nom_patient: 'Solange KABAMBA',   motif: 'Vaccination enfant',               type: 'consultation',    heure: '09:30', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D06', nom_patient: 'Alex MUAMBA',       motif: 'Suivi hypertension',               type: 'consultation',    heure: '10:00', triage: 'vert',  statut: 'sorti',      orientation: 'teleconsultation_sd' },
  { id: 'D07', nom_patient: 'Rosine NGALULA',    motif: 'Infection cutanée mineure',        type: 'consultation',    heure: '10:15', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D08', nom_patient: 'Bosco MUKALAYI',    motif: 'Douleurs oculaires',               type: 'consultation',    heure: '10:45', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D09', nom_patient: 'Ange KAFWIMBI',     motif: 'Maux de gorge',                    type: 'consultation',    heure: '11:00', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D10', nom_patient: 'Ruth MUPENDWA',     motif: 'Contrôle post-accouchement',       type: 'consultation',    heure: '11:15', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D11', nom_patient: 'Serge KATUMBA',     motif: 'Fièvre légère enfant',             type: 'consultation',    heure: '11:30', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
  { id: 'D12', nom_patient: 'Nadège LUKAMBA',    motif: 'Démangeaisons cutanées',           type: 'consultation',    heure: '11:45', triage: 'vert',  statut: 'sorti',      orientation: 'medecin_sur_place' },
];

// ─── Configs ──────────────────────────────────────────────────────────────────

const TRIAGE_CONFIG: Record<Triage, { bg: string; text: string; label: string }> = {
  vert:   { bg: '#ECFDF5', text: '#065F46', label: 'Stable' },
  jaune:  { bg: '#FEF3C7', text: '#92400E', label: 'Surveillance' },
  rouge:  { bg: '#FEF2F2', text: '#DC2626', label: 'Urgence vitale' },
};

const TABS: { key: StatutAdmission; label: string }[] = [
  { key: 'en_attente', label: 'En attente' },
  { key: 'oriente',    label: 'Orientés' },
  { key: 'admis',      label: 'Admis' },
  { key: 'sorti',      label: 'Sortis' },
];

const TYPES: { key: TypeConsultation; label: string }[] = [
  { key: 'consultation',    label: 'Consultation' },
  { key: 'urgence',         label: 'Urgence' },
  { key: 'hospitalisation', label: 'Hospitalisation' },
];

const ORIENTATIONS: { key: Orientation; label: string; icon: any; color: string }[] = [
  { key: 'teleconsultation_sd', label: 'Téléconsultation SD', icon: 'video',      color: palette.blue },
  { key: 'medecin_sur_place',   label: 'Médecin sur place',   icon: 'stethoscope',color: palette.green },
  { key: 'urgences',            label: 'Urgences',             icon: 'alert-circle',color: palette.danger },
  { key: 'hospitalisation',     label: 'Hospitalisation',      icon: 'hospital',   color: palette.amber },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdmissionScreen({ navigation }: any) {
  const { token } = useAuth();

  const [admissions, setAdmissions] = useState<Admission[]>(DEMO_ADMISSIONS);
  const [tabActif, setTabActif]     = useState<StatutAdmission>('en_attente');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Formulaire nouveau patient
  const [nomPatient, setNomPatient] = useState('');
  const [motif, setMotif]           = useState('');
  const [typeForm, setTypeForm]     = useState<TypeConsultation>('consultation');

  useFocusEffect(
    useCallback(() => {
      // Fetch API quand disponible
    }, [token]),
  );

  const filtered = admissions.filter(a => a.statut === tabActif);
  const counts: Record<StatutAdmission, number> = {
    en_attente: admissions.filter(a => a.statut === 'en_attente').length,
    oriente:    admissions.filter(a => a.statut === 'oriente').length,
    admis:      admissions.filter(a => a.statut === 'admis').length,
    sorti:      admissions.filter(a => a.statut === 'sorti').length,
  };

  function enregistrer() {
    if (!nomPatient.trim() || !motif.trim()) {
      Alert.alert('Champs requis', 'Veuillez renseigner le nom du patient et le motif.');
      return;
    }
    const now = new Date();
    const heure = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newAdm: Admission = {
      id: `NEW-${Date.now()}`,
      nom_patient: nomPatient.trim(),
      motif: motif.trim(),
      type: typeForm,
      heure,
      triage: null,
      statut: 'en_attente',
      orientation: null,
    };
    setAdmissions(prev => [newAdm, ...prev]);
    setNomPatient('');
    setMotif('');
    setTypeForm('consultation');
    setSelectedId(newAdm.id);
  }

  function appliquerTriage(id: string, triage: Triage, orientation: Orientation) {
    setAdmissions(prev =>
      prev.map(a => a.id === id
        ? { ...a, triage, orientation, statut: 'oriente' }
        : a),
    );
    setSelectedId(null);
    setTabActif('oriente');
  }

  const selected = selectedId ? admissions.find(a => a.id === selectedId) ?? null : null;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admissions & Triage</Text>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, tabActif === tab.key && styles.tabActive]}
              onPress={() => setTabActif(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tabActif === tab.key && styles.tabTextActive]}>
                {tab.label} ({counts[tab.key]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Formulaire Nouveau patient */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Nouveau patient</Text>

          <TextInput
            style={styles.input}
            placeholder="Nom du patient"
            placeholderTextColor={colors.placeholder}
            value={nomPatient}
            onChangeText={setNomPatient}
          />
          <TextInput
            style={styles.input}
            placeholder="Motif de venue"
            placeholderTextColor={colors.placeholder}
            value={motif}
            onChangeText={setMotif}
          />

          {/* Type chips */}
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, typeForm === t.key && styles.typeChipActive]}
                onPress={() => setTypeForm(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeChipText, typeForm === t.key && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.enregBtn} onPress={enregistrer} activeOpacity={0.85}>
            <Icon name="plus" size={18} color="#FFF" />
            <Text style={styles.enregBtnText}>Enregistrer + Triage</Text>
          </TouchableOpacity>
        </View>

        {/* Liste admissions filtrées */}
        <Text style={styles.secLabel}>{TABS.find(t => t.key === tabActif)?.label.toUpperCase()} — {filtered.length}</Text>

        {filtered.map(item => {
          const triConf = item.triage ? TRIAGE_CONFIG[item.triage] : null;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.admCard}
              onPress={() => setSelectedId(item.id)}
              activeOpacity={0.85}
            >
              <View style={styles.admTop}>
                <View style={styles.admInfo}>
                  <Text style={styles.admNom}>{item.nom_patient}</Text>
                  <Text style={styles.admMotif} numberOfLines={1}>{item.motif}</Text>
                </View>
                <View style={styles.admRight}>
                  <Text style={styles.admHeure}>{item.heure}</Text>
                  {triConf ? (
                    <View style={[styles.triageBadge, { backgroundColor: triConf.bg }]}>
                      <Text style={[styles.triageText, { color: triConf.text }]}>{triConf.label}</Text>
                    </View>
                  ) : (
                    <View style={styles.noTriageBadge}>
                      <Text style={styles.noTriageText}>A trier</Text>
                    </View>
                  )}
                </View>
              </View>
              {item.orientation && (
                <Text style={styles.admOrient}>
                  Orientation : {ORIENTATIONS.find(o => o.key === item.orientation)?.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Icon name="clipboard" size={40} color={colors.textLight} strokeWidth={1.2} />
            <Text style={styles.emptyText}>Aucune admission dans cette catégorie</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Sheet triage (Modal) */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setSelectedId(null)} activeOpacity={1} />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Triage — {selected?.nom_patient}</Text>
            <Text style={styles.sheetMotif}>{selected?.motif}</Text>

            <Text style={styles.sheetSection}>Niveau de triage</Text>
            {(['vert', 'jaune', 'rouge'] as Triage[]).map(t => {
              const conf = TRIAGE_CONFIG[t];
              const descr: Record<Triage, string> = {
                vert:  'Stable, orientation ambulatoire',
                jaune: 'Surveillance, urgence modérée',
                rouge: 'Urgence vitale, médecin immédiat',
              };
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.triageBtn, { borderColor: conf.bg }]}
                  onPress={() => {
                    // Choisir orientation par défaut selon triage
                    const orient: Orientation =
                      t === 'rouge' ? 'urgences' :
                      t === 'jaune' ? 'medecin_sur_place' :
                      'teleconsultation_sd';
                    if (selected) appliquerTriage(selected.id, t, orient);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.triageCircle, { backgroundColor: conf.bg }]}>
                    <Text style={[styles.triageLetter, { color: conf.text }]}>{t.toUpperCase()[0]}</Text>
                  </View>
                  <View style={styles.triageBtnInfo}>
                    <Text style={[styles.triageBtnLabel, { color: conf.text }]}>{conf.label}</Text>
                    <Text style={styles.triageBtnDescr}>{descr[t]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.sheetSection}>Orientation vers</Text>
            <View style={styles.orientRow}>
              {ORIENTATIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.orientChip, { borderColor: o.color + '66' }]}
                  onPress={() => {
                    if (selected) appliquerTriage(selected.id, selected.triage ?? 'vert', o.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Icon name={o.icon} size={16} color={o.color} />
                  <Text style={[styles.orientChipText, { color: o.color }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSelectedId(null)} activeOpacity={0.8}>
              <Text style={styles.sheetCloseBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: palette.dark,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: palette.danger, opacity: 0.08, top: -50, right: -30,
  },
  backBtn:     { marginBottom: spacing.sm, width: TAP_TARGET, justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: spacing.md },

  tabsScroll:   { maxHeight: 46 },
  tabsContent:  { gap: spacing.xs, alignItems: 'center' },
  tab:          { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tabActive:    { backgroundColor: '#FFF' },
  tabText:      { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.6)' },
  tabTextActive:{ color: palette.dark, fontWeight: fontWeight.black },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.md },

  // Formulaire
  formCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  formTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textStrong, marginBottom: spacing.md },
  input:     { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.sm, color: colors.text, backgroundColor: colors.bg, marginBottom: spacing.sm },
  typeRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeChip:      { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  typeChipActive:{ backgroundColor: palette.dark, borderColor: palette.dark },
  typeChipText:      { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted },
  typeChipTextActive:{ color: '#FFF' },
  enregBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: palette.dark, borderRadius: radius.lg, paddingVertical: spacing.md },
  enregBtnText:{ color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  secLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted,
    letterSpacing: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.xs,
  },

  // Cards admission
  admCard: {
    backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderRadius: radius.lg, padding: spacing.md, ...shadow.xs,
  },
  admTop:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  admInfo:      { flex: 1, marginRight: spacing.sm },
  admNom:       { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  admMotif:     { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  admRight:     { alignItems: 'flex-end', gap: 4 },
  admHeure:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  triageBadge:  { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  triageText:   { fontSize: 10, fontWeight: fontWeight.black },
  noTriageBadge:{ borderRadius: radius.full, backgroundColor: colors.bgSoft, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  noTriageText: { fontSize: 10, fontWeight: fontWeight.bold, color: colors.textLight },
  admOrient:    { fontSize: fontSize.xs, color: palette.blueDeep, fontWeight: fontWeight.semibold, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: spacing.md },
  emptyText:{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },

  // Modal sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,46,0.45)' },
  sheetContainer:{
    backgroundColor: colors.card, borderTopLeftRadius: radius.xxxl, borderTopRightRadius: radius.xxxl,
    padding: spacing.lg, paddingBottom: 40, ...shadow.xl,
  },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle:   { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.textStrong, marginBottom: 2 },
  sheetMotif:   { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.lg },
  sheetSection: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textLight, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.sm },

  triageBtn:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 2, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm },
  triageCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  triageLetter: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  triageBtnInfo:{ flex: 1 },
  triageBtnLabel:{ fontSize: fontSize.md, fontWeight: fontWeight.bold },
  triageBtnDescr:{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },

  orientRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  orientChip:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bg },
  orientChipText:{ fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  sheetCloseBtn: { backgroundColor: colors.bg, borderRadius: radius.xl, paddingVertical: spacing.md, alignItems: 'center' },
  sheetCloseBtnText:{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
});

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette, TAP_TARGET } from '../../components/theme';
import { Icon } from '../../components/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type Fonction = 'auxiliaire' | 'infirmier' | 'aide_soignant' | 'administratif' | 'sage_femme' | 'medecin';

interface Personnel {
  id: string;
  prenom: string;
  nom: string;
  fonction: Fonction;
  statut: 'actif' | 'conge' | 'absent';
  affecte_sd: boolean;
  nb_consultations_sd_mois: number;
}

// ─── Couleurs par fonction ────────────────────────────────────────────────────

const FONCTION_COLORS: Record<Fonction, string> = {
  auxiliaire:   palette.green,
  infirmier:    palette.blue,
  aide_soignant:palette.purple,
  administratif:palette.amber,
  sage_femme:   '#F9A8D4',
  medecin:      palette.dark,
};

const FONCTION_LABELS: Record<Fonction, string> = {
  auxiliaire:   'Auxiliaire',
  infirmier:    'Infirmier(e)',
  aide_soignant:'Aide-soignant',
  administratif:'Administratif',
  sage_femme:   'Sage-femme',
  medecin:      'Médecin',
};

// ─── Données démo ─────────────────────────────────────────────────────────────

const DEMO_PERSONNEL: Personnel[] = [
  { id: 'P1', prenom: 'Claudine',  nom: 'MUKEBA',    fonction: 'auxiliaire',   statut: 'actif',   affecte_sd: true,  nb_consultations_sd_mois: 12 },
  { id: 'P2', prenom: 'Bernard',   nom: 'TSHILOMBO', fonction: 'infirmier',    statut: 'actif',   affecte_sd: false, nb_consultations_sd_mois: 0 },
  { id: 'P3', prenom: 'Henriette', nom: 'KABONGO',   fonction: 'infirmier',    statut: 'actif',   affecte_sd: false, nb_consultations_sd_mois: 0 },
  { id: 'P4', prenom: 'Fidèle',    nom: 'MPIANA',    fonction: 'aide_soignant',statut: 'actif',   affecte_sd: false, nb_consultations_sd_mois: 0 },
  { id: 'P5', prenom: 'Thérèse',   nom: 'NGALULA',   fonction: 'sage_femme',   statut: 'conge',   affecte_sd: false, nb_consultations_sd_mois: 0 },
  { id: 'P6', prenom: 'Emmanuel',  nom: 'LUZOLO',    fonction: 'administratif',statut: 'actif',   affecte_sd: false, nb_consultations_sd_mois: 0 },
  { id: 'P7', prenom: 'Christine', nom: 'KALALA',    fonction: 'infirmier',    statut: 'absent',  affecte_sd: false, nb_consultations_sd_mois: 0 },
  { id: 'P8', prenom: 'Samuel',    nom: 'ILUNGA',    fonction: 'medecin',      statut: 'actif',   affecte_sd: false, nb_consultations_sd_mois: 0 },
];

type FiltreChip = 'tous' | Fonction;

const CHIPS: { key: FiltreChip; label: string }[] = [
  { key: 'tous',         label: 'Tous' },
  { key: 'auxiliaire',   label: 'Auxiliaire' },
  { key: 'infirmier',    label: 'Infirmier' },
  { key: 'aide_soignant',label: 'Aide-soignant' },
  { key: 'administratif',label: 'Admin' },
  { key: 'sage_femme',   label: 'Sage-femme' },
  { key: 'medecin',      label: 'Médecin' },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PersonnelScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>(DEMO_PERSONNEL);
  const [filtre, setFiltre] = useState<FiltreChip>('tous');

  useFocusEffect(
    useCallback(() => {
      // Fetch API quand disponible — données démo en attendant
      // api.get('/api/centre/personnel', token).then(setPersonnel).catch(() => setPersonnel(DEMO_PERSONNEL));
    }, [token]),
  );

  const filtered = filtre === 'tous' ? personnel : personnel.filter(p => p.fonction === filtre);
  const nbTotal  = personnel.length;
  const nbSD     = personnel.filter(p => p.affecte_sd).length;

  function toggleSD(id: string) {
    setPersonnel(prev =>
      prev.map(p => p.id === id ? { ...p, affecte_sd: !p.affecte_sd } : p),
    );
  }

  function handleAjouter() {
    Alert.alert(
      'Ajouter un membre',
      'Cette fonctionnalité ouvrira le formulaire d\'ajout de personnel.',
      [{ text: 'Compris', style: 'cancel' }],
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personnel soignant</Text>
        <Text style={styles.headerSub}>{nbTotal} membres · {nbSD} affecté{nbSD > 1 ? 's' : ''} SantéDirect</Text>
      </View>

      {/* Chips filtre */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.chip, filtre === chip.key && styles.chipActive]}
            onPress={() => setFiltre(chip.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filtre === chip.key && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.map(p => {
          const initiales = `${p.prenom[0]}${p.nom[0]}`;
          const couleur   = FONCTION_COLORS[p.fonction];
          return (
            <View key={p.id} style={styles.card}>
              {/* Cercle initiales */}
              <View style={[styles.avatar, { backgroundColor: couleur + '33' }]}>
                <Text style={[styles.avatarText, { color: couleur === palette.dark ? palette.gray700 : couleur }]}>
                  {initiales}
                </Text>
              </View>

              {/* Infos */}
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardNom}>{p.prenom} {p.nom}</Text>
                  {p.statut !== 'actif' && (
                    <View style={[styles.statutBadge, { backgroundColor: p.statut === 'conge' ? palette.warningLight : palette.dangerLight }]}>
                      <Text style={[styles.statutText, { color: p.statut === 'conge' ? palette.amber : palette.danger }]}>
                        {p.statut === 'conge' ? 'Congé' : 'Absent'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardFonction, { color: couleur === palette.dark ? palette.gray700 : couleur }]}>
                  {FONCTION_LABELS[p.fonction]}
                </Text>
                {p.affecte_sd && (
                  <View style={styles.sdBadge}>
                    <Icon name="shield" size={11} color={palette.blueDeep} />
                    <Text style={styles.sdBadgeText}>SantéDirect · {p.nb_consultations_sd_mois} consult/mois</Text>
                  </View>
                )}
              </View>

              {/* Toggle SD */}
              <TouchableOpacity
                style={[styles.toggleBtn, p.affecte_sd && styles.toggleBtnActive]}
                onPress={() => toggleSD(p.id)}
                activeOpacity={0.8}
              >
                <Icon
                  name={p.affecte_sd ? 'check' : 'plus'}
                  size={13}
                  color={p.affecte_sd ? palette.blueDeep : colors.textMuted}
                />
                <Text style={[styles.toggleText, p.affecte_sd && styles.toggleTextActive]}>
                  {p.affecte_sd ? 'Affecté SD' : 'Affecter SD'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Card Ajouter */}
        <TouchableOpacity style={styles.addCard} onPress={handleAjouter} activeOpacity={0.8}>
          <View style={styles.addIconWrap}>
            <Icon name="user-plus" size={22} color={palette.blueDeep} />
          </View>
          <Text style={styles.addText}>Ajouter un membre du personnel</Text>
          <Icon name="chevron-right" size={18} color={colors.textLight} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: palette.purple, opacity: 0.10, top: -60, right: -40,
  },
  backBtn:     { marginBottom: spacing.md, width: TAP_TARGET, justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm, marginTop: 2 },

  chipsScroll:   { maxHeight: 52, marginTop: spacing.sm },
  chipsContent:  { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  chip:          { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive:    { backgroundColor: palette.dark, borderColor: palette.dark },
  chipText:      { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  chipTextActive:{ color: '#FFF', fontWeight: fontWeight.bold },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.xl, padding: spacing.md, gap: spacing.md,
    marginBottom: spacing.sm, ...shadow.xs,
  },
  avatar:     { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: fontSize.md, fontWeight: fontWeight.black },
  cardInfo:   { flex: 1 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  cardNom:    { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textStrong },
  statutBadge:{ borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statutText: { fontSize: 10, fontWeight: fontWeight.bold },
  cardFonction:{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: 1 },
  sdBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  sdBadgeText:{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.blueDeep },

  toggleBtn:       { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', flexDirection: 'row', gap: 4 },
  toggleBtnActive: { backgroundColor: palette.blueSoft, borderColor: palette.blue },
  toggleText:      { fontSize: 11, fontWeight: fontWeight.semibold, color: colors.textMuted },
  toggleTextActive:{ color: palette.blueDeep },

  addCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.xl, padding: spacing.md, gap: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1.5, borderColor: palette.blue, borderStyle: 'dashed',
  },
  addIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.blueSoft, justifyContent: 'center', alignItems: 'center' },
  addText:     { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: palette.blueDeep },
});

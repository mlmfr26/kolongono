import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../../components/theme';
import { Icon } from '../../components/Icons';

type Props = { route: { params: { consultation: any } }; navigation: any };

export default function SuiviPatientScreen({ route, navigation }: Props) {
  const { consultation } = route.params;
  const patient = consultation?.patient;
  const medecin = consultation?.medecin;

  function rejoindreConsultation() {
    const lien = consultation?.lien_auxiliaire ?? consultation?.lien ?? consultation?.url;
    if (lien) {
      navigation.navigate('Teleconsultation', {
        rdv_id: consultation?.id,
        url: lien,
        medecin: medecin ? `${medecin.prenom ?? ''} ${medecin.nom ?? ''}`.trim() : undefined,
        role: 'auxiliaire',
      });
    } else {
      Alert.alert('Consultation', 'Lien vidéo non disponible pour cette consultation.');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Suivi patient</Text>
        {patient && <Text style={styles.headerSub}>{patient.prenom} {patient.nom}</Text>}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info consultation */}
        {consultation && (
          <View style={styles.consCard}>
            <View style={styles.consRow}>
              <Text style={styles.consLabel}>ID</Text>
              <Text style={styles.consVal}>{consultation.id}</Text>
            </View>
            <View style={styles.consRow}>
              <Text style={styles.consLabel}>Motif</Text>
              <Text style={styles.consVal}>{consultation.motif}</Text>
            </View>
            {medecin && (
              <View style={styles.consRow}>
                <Text style={styles.consLabel}>Médecin</Text>
                <Text style={styles.consVal}>Dr. {medecin.prenom} {medecin.nom} — {medecin.specialite}</Text>
              </View>
            )}
          </View>
        )}

        {/* Rôle auxiliaire */}
        <View style={styles.roleCard}>
          <Text style={styles.roleTitle}>Votre rôle durant la consultation</Text>
          {[
            { icon: '👁️', text: 'Vous êtes les yeux du médecin — Montrez ce qu\'il demande' },
            { icon: '🤲', text: 'Vous êtes ses mains — Assistez les gestes techniques' },
            { icon: '📋', text: 'Notez les instructions et posologie dictées par le médecin' },
            { icon: '💬', text: 'Traduisez si nécessaire entre patient et médecin' },
            { icon: '🚨', text: 'Signalez immédiatement tout signe d\'aggravation' },
          ].map((item, i) => (
            <View key={i} style={styles.roleRow}>
              <Text style={styles.roleIcon}>{item.icon}</Text>
              <Text style={styles.roleText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Checklist avant appel */}
        <Text style={styles.secLabel}>CHECKLIST AVANT APPEL</Text>
        <View style={styles.checkCard}>
          {[
            'Signes vitaux saisis dans l\'application',
            'Patient installé confortablement',
            'Tablette / téléphone chargé et connecté',
            'Matériel de premiers soins à portée',
            'Stéthoscope disponible',
            'Kits TDR disponibles si non effectués',
            'Silence et confidentialité assurés',
          ].map((item, i) => (
            <View key={i} style={styles.checkRow}>
              <View style={styles.checkBox}><Icon name="check" size={12} color="#fff" strokeWidth={2.5} /></View>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Bouton rejoindre */}
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={rejoindreConsultation}
          activeOpacity={0.85}
        >
          <Icon name="video" size={20} color="#fff" />
          <Text style={styles.joinText}>Rejoindre la consultation vidéo</Text>
        </TouchableOpacity>

        {/* Urgence */}
        <View style={styles.urgenceCard}>
          <Text style={styles.urgenceTitle}>Urgence pendant la consultation</Text>
          <Text style={styles.urgenceText}>Si l'état du patient se dégrade subitement :</Text>
          <TouchableOpacity style={styles.urgenceBtn} onPress={() => Linking.openURL('tel:15')}>
            <Text style={styles.urgenceBtnText}>Appeler SAMU 15</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

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
  scrollContent: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },

  consCard:  { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  consRow:   { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  consLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium, width: 80 },
  consVal:   { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold },

  roleCard:  { backgroundColor: colors.accentLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
  roleTitle: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.accent, marginBottom: spacing.md },
  roleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  roleIcon:  { fontSize: 18, width: 24 },
  roleText:  { flex: 1, fontSize: fontSize.sm, color: colors.accent, lineHeight: 20 },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },

  checkCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.lg },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  checkBox:  { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  checkText: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  joinBtn:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.auxiliaire, borderRadius: radius.xl, paddingVertical: spacing.lg, gap: spacing.md, ...shadow.lg, marginBottom: spacing.lg },
  joinText: { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.black },

  urgenceCard:  { backgroundColor: colors.dangerLight, borderRadius: radius.xl, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.danger },
  urgenceTitle: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.danger, marginBottom: spacing.xs },
  urgenceText:  { fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.md },
  urgenceBtn:   { backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  urgenceBtnText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.black },
});

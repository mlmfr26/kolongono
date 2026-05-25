import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../components/theme';
import { Icon } from '../components/Icons';
import { api } from '../components/api';
import { useAuth } from '../components/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cotisation {
  mois: string;
  montant_fc: number;
  statut: 'paye' | 'en_attente' | 'echec' | 'exonere';
  mode_paiement?: string;
}

interface CompteData {
  patient_id: string;
  abonnement: {
    plan: string;
    plan_nom: string;
    prix_fc: number;
    consultations_incluses: number;
    statut: string;
    date_debut: string;
  };
  solde_fc: number;
  eligibilite: {
    eligible: boolean;
    statut: string;
    message: string;
    montant_du_fc?: number;
    mois_dus?: string[];
  };
  cotisations: Cotisation[];
  rendez_vous_recents: any[];
}

const MODES_PAIEMENT = [
  { id: 'mpesa',        label: 'M-Pesa',           color: '#E40000' },
  { id: 'orange_money', label: 'Orange Money',      color: '#FF6600' },
  { id: 'airtel_money', label: 'Airtel Money',      color: '#DC143C' },
  { id: 'cash',         label: 'Espèces (guichet)', color: colors.textMuted },
];

const MONTANTS_RAPIDES = [5000, 10000, 20000, 50000];

function statutCotBg(statut: string) {
  switch (statut) {
    case 'paye':      return { bg: colors.primaryLight, color: colors.primary };
    case 'exonere':   return { bg: colors.accentLight,  color: colors.accent };
    case 'en_attente':return { bg: colors.warningLight, color: colors.warning };
    case 'echec':     return { bg: colors.dangerLight,  color: colors.danger };
    default:          return { bg: colors.border,       color: colors.textMuted };
  }
}

function statutLabel(s: string) {
  return { paye: 'Payé', exonere: 'Exonéré', en_attente: 'En attente', echec: 'Échec' }[s] || s;
}

function moisLabel(mois: string): string {
  const MOIS = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS[m]} ${y}`;
}

// ─── Écran Compte Patient ─────────────────────────────────────────────────────

export default function ComptePatientScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const patientId   = route.params?.patient_id   || 'ADH-001';
  const patientNom  = route.params?.patient_nom   || 'Patient';

  const [compte, setCompte]           = useState<CompteData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [modalRecharge, setModalRecharge] = useState(false);
  const [montant, setMontant]         = useState('');
  const [modePaiement, setModePaiement] = useState('mpesa');
  const [recharging, setRecharging]   = useState(false);

  const fetchCompte = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/consultations/compte/${patientId}`, token);
      setCompte(data as CompteData);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le compte.');
    } finally {
      setLoading(false);
    }
  }, [patientId, token]);

  useEffect(() => { fetchCompte(); }, [fetchCompte]);

  const recharger = async () => {
    const m = parseFloat(montant);
    if (!m || m < 500) {
      Alert.alert('Montant invalide', 'Le montant minimum est 500 FC.');
      return;
    }
    setRecharging(true);
    try {
      const data = await api.post('/api/consultations/compte/recharger', {
        patient_id: patientId,
        montant_fc: m,
        mode: modePaiement,
      }, token) as any;
      setModalRecharge(false);
      setMontant('');
      await fetchCompte();
      Alert.alert(
        'Rechargement effectué',
        data.message || `${m.toLocaleString('fr-FR')} FC ajoutés à votre compte.`,
      );
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Le rechargement a échoué.');
    } finally {
      setRecharging(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.safe}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={palette.blueDeep} />
        </View>
      </View>
    );
  }

  const elig = compte?.eligibilite;
  const ab   = compte?.abonnement;

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Mon compte santé</Text>
          <Text style={styles.headerSub}>{patientNom}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Statut éligibilité ── */}
        {elig && (
          <View style={[
            styles.eligCard,
            elig.eligible ? styles.eligCardOk : styles.eligCardKo,
          ]}>
            <View style={styles.eligIconWrap}>
              <Icon name={elig.eligible ? 'check-circle' : 'alert-triangle'} size={20} color={elig.eligible ? colors.primary : colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eligTitle, { color: elig.eligible ? colors.primary : colors.danger }]}>
                {elig.eligible ? 'Compte en ordre' : 'Régularisation requise'}
              </Text>
              <Text style={styles.eligMessage}>{elig.message}</Text>
              {!elig.eligible && elig.montant_du_fc && (
                <Text style={styles.eligMontant}>
                  Montant dû : {elig.montant_du_fc.toLocaleString('fr-FR')} FC
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Solde + Recharge ── */}
        <View style={styles.soldeCard}>
          <View style={styles.soldeLeft}>
            <Text style={styles.soldeLabel}>Solde disponible</Text>
            <Text style={styles.soldeValue}>
              {(compte?.solde_fc || 0).toLocaleString('fr-FR')} FC
            </Text>
          </View>
          <TouchableOpacity
            style={styles.rechargeBtn}
            onPress={() => setModalRecharge(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.rechargeBtnText}>+ Recharger</Text>
          </TouchableOpacity>
        </View>

        {/* ── Plan abonnement ── */}
        {ab && (
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planNom}>{ab.plan_nom}</Text>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{ab.statut}</Text>
              </View>
            </View>
            <View style={styles.planGrid}>
              <PlanStat label="Prix mensuel"     value={`${ab.prix_fc.toLocaleString('fr-FR')} FC`} />
              <PlanStat label="Consultations"    value={`${ab.consultations_incluses === 999 ? 'Illimitées' : ab.consultations_incluses}/mois`} />
              <PlanStat label="Depuis"           value={ab.date_debut ? ab.date_debut.slice(0,7) : '—'} />
            </View>
          </View>
        )}

        {/* ── Historique cotisations ── */}
        <Text style={styles.sectionTitle}>Cotisations mensuelles</Text>
        {(compte?.cotisations || []).length === 0 ? (
          <Text style={styles.emptyText}>Aucune cotisation enregistrée</Text>
        ) : (
          <View style={styles.cotisationsCard}>
            {(compte?.cotisations || []).map((c, i) => {
              const { bg, color } = statutCotBg(c.statut);
              return (
                <View key={i} style={[styles.cotRow, i > 0 && styles.cotRowBorder]}>
                  <View>
                    <Text style={styles.cotMois}>{moisLabel(c.mois)}</Text>
                    {c.mode_paiement && (
                      <Text style={styles.cotMode}>{c.mode_paiement.replace('_', ' ')}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {c.montant_fc > 0 && (
                      <Text style={styles.cotMontant}>{c.montant_fc.toLocaleString('fr-FR')} FC</Text>
                    )}
                    <View style={[styles.cotStatutBadge, { backgroundColor: bg }]}>
                      <Text style={[styles.cotStatutText, { color }]}>{statutLabel(c.statut)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── RDV récents ── */}
        {(compte?.rendez_vous_recents || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Rendez-vous récents</Text>
            <View style={styles.rdvCard}>
              {compte!.rendez_vous_recents.map((rdv, i) => (
                <View key={i} style={[styles.rdvRow, i > 0 && styles.cotRowBorder]}>
                  <View>
                    <Text style={styles.rdvDate}>{rdv.date} à {rdv.heure_debut}</Text>
                    <Text style={styles.rdvMedecin}>{rdv.medecin_id}</Text>
                  </View>
                  <View style={[
                    styles.rdvStatutBadge,
                    { backgroundColor: rdv.statut === 'confirme' ? colors.primaryLight : colors.warningLight },
                  ]}>
                    <Text style={[
                      styles.rdvStatutText,
                      { color: rdv.statut === 'confirme' ? colors.primary : colors.warning },
                    ]}>
                      {rdv.statut}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Régularisation si impayé */}
        {elig && !elig.eligible && (
          <TouchableOpacity
            style={styles.regulariserBtn}
            onPress={() => setModalRecharge(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.regulariserBtnText}>Régulariser ma situation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal Recharge ── */}
      <Modal
        visible={modalRecharge}
        transparent
        animationType="slide"
        onRequestClose={() => setModalRecharge(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Recharger le compte</Text>

            {/* Montants rapides */}
            <Text style={styles.modalLabel}>Montant rapide</Text>
            <View style={styles.montantsRow}>
              {MONTANTS_RAPIDES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.montantChip, montant === String(m) && styles.montantChipOn]}
                  onPress={() => setMontant(String(m))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.montantChipText, montant === String(m) && { color: '#fff' }]}>
                    {m.toLocaleString('fr-FR')} FC
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Montant libre */}
            <Text style={styles.modalLabel}>Montant personnalisé (FC)</Text>
            <TextInput
              style={styles.montantInput}
              placeholder="Ex: 15000"
              placeholderTextColor={colors.textLight}
              value={montant}
              onChangeText={setMontant}
              keyboardType="numeric"
            />

            {/* Mode de paiement */}
            <Text style={styles.modalLabel}>Mode de paiement</Text>
            <View style={styles.modesGrid}>
              {MODES_PAIEMENT.map(mode => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.modeBtn,
                    modePaiement === mode.id && { borderColor: mode.color, backgroundColor: mode.color + '12' },
                  ]}
                  onPress={() => setModePaiement(mode.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modeDot, { backgroundColor: mode.color }]} />
                  <Text style={[
                    styles.modeLabel,
                    modePaiement === mode.id && { color: mode.color, fontWeight: fontWeight.bold },
                  ]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, recharging && { opacity: 0.7 }]}
              onPress={recharger}
              disabled={recharging}
              activeOpacity={0.85}
            >
              {recharging
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>
                    Recharger {montant ? `${parseInt(montant).toLocaleString('fr-FR')} FC` : ''}
                  </Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.annulerBtn} onPress={() => setModalRecharge(false)}>
              <Text style={styles.annulerBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Composant mini-stat plan ──────────────────────────────────────────────

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={planStatStyle.box}>
      <Text style={planStatStyle.label}>{label}</Text>
      <Text style={planStatStyle.value}>{value}</Text>
    </View>
  );
}
const planStatStyle = StyleSheet.create({
  box:   { flex: 1, alignItems: 'center', padding: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 2 },
  value: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: palette.blueDeep, gap: spacing.sm },
  backBtn:       { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: palette.white },
  headerSub:     { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.65)' },
  scroll:        { padding: spacing.lg, paddingBottom: 40 },
  sectionTitle:  { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptyText:     { fontSize: fontSize.sm, color: colors.textLight, textAlign: 'center', padding: spacing.lg },

  eligCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing.md },
  eligCardOk:    { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  eligCardKo:    { backgroundColor: colors.dangerLight,  borderColor: colors.danger },
  eligIconWrap:  { marginTop: 2 },
  eligTitle:     { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  eligMessage:   { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  eligMontant:   { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.danger, marginTop: 4 },

  soldeCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.md },
  soldeLeft:     { flex: 1 },
  soldeLabel:    { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.75)' },
  soldeValue:    { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: '#fff', marginTop: 4 },
  rechargeBtn:   { backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rechargeBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  planCard:      { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  planHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  planNom:       { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  planBadge:     { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  planBadgeText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
  planGrid:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },

  cotisationsCard: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm, marginBottom: spacing.md },
  cotRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  cotRowBorder:  { borderTopWidth: 1, borderTopColor: colors.border },
  cotMois:       { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  cotMode:       { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  cotMontant:    { fontSize: fontSize.sm, color: colors.textMuted },
  cotStatutBadge:{ borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  cotStatutText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  rdvCard:       { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm, marginBottom: spacing.md },
  rdvRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  rdvDate:       { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text },
  rdvMedecin:    { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  rdvStatutBadge:{ borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  rdvStatutText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  regulariserBtn:{ marginTop: spacing.md, backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', ...shadow.md },
  regulariserBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },

  modalOverlay:  { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:    { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.lg },
  modalLabel:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.sm },
  montantsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  montantChip:   { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  montantChipOn: { backgroundColor: colors.primary },
  montantChipText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
  montantInput:  { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  modesGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modeBtn:       { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  modeDot:       { width: 10, height: 10, borderRadius: 5 },
  modeLabel:     { fontSize: fontSize.sm, color: colors.text },
  confirmBtn:    { marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', ...shadow.md },
  confirmBtnText:{ color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  annulerBtn:    { marginTop: spacing.sm, paddingVertical: 12, alignItems: 'center' },
  annulerBtnText:{ color: colors.textMuted, fontSize: fontSize.md },
});

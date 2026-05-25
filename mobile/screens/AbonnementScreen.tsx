import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../components/AuthContext';
import { api } from '../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, TAP_TARGET, palette } from '../components/theme';
import { Icon, type IconName } from '../components/Icons';

type Plan = {
  nom: string;
  prix_fc: number;
  consultations: number;
  hospitalisation: boolean;
  membres: number;
  description: string;
};

type Abonnement = {
  actif: boolean;
  plan: string | null;
  plan_info: Plan;
  consultations_restantes: number;
  consultations_utilisees: number;
  prix_fc: number;
  prochain_renouvellement: string;
  nb_mois_impaye: number;
};

const PLAN_ICON_NAMES: Record<string, IconName> = {
  solidaire: 'leaf',
  standard:  'star-filled',
  famille:   'users',
  premium:   'shield',
};

const PLAN_COLORS: Record<string, string> = {
  solidaire: palette.greenDeep,
  standard:  palette.blueDeep,
  famille:   palette.purpleDeep,
  premium:   palette.amber,
};

export default function AbonnementScreen() {
  const { user, token } = useAuth();
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [plans,      setPlans]      = useState<Record<string, Plan>>({});
  const [loading,    setLoading]    = useState(true);
  const [souscription, setSouscription] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      user ? api.get<Abonnement>(`/api/abonnements/${user.id}`, token) : Promise.resolve(null),
      api.get<{ plans: Record<string, Plan> }>('/api/abonnements/plans', token),
    ]).then(([abo, plansData]) => {
      if (!cancelled) {
        setAbonnement(abo);
        setPlans(plansData?.plans ?? {});
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, token]));

  async function souscrire(planKey: string) {
    if (!user) return;
    Alert.alert(
      `Souscrire — Plan ${plans[planKey]?.nom}`,
      `Prix : ${plans[planKey]?.prix_fc?.toLocaleString()} FC/mois\n${plans[planKey]?.description}\n\nChoisir le mode de paiement :`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Mobile Money', onPress: async () => {
            setSouscription(true);
            try {
              await api.post('/api/abonnements', {
                patient_id: user.id,
                plan: planKey,
                mode_paiement: 'mobile_money',
              }, token);
              Alert.alert('Abonnement activé !', `Plan ${plans[planKey]?.nom} activé avec succès.\nVotre mutuelle est maintenant active.`);
              // Reload
              const abo = await api.get<Abonnement>(`/api/abonnements/${user.id}`, token);
              setAbonnement(abo);
            } catch (err: any) {
              Alert.alert('Erreur', err.message ?? 'Impossible de souscrire.');
            } finally {
              setSouscription(false);
            }
          },
        },
        {
          text: 'Déduire Longonia', onPress: async () => {
            setSouscription(true);
            try {
              const bridgeResult = await api.post<any>('/api/longonia/debit-mutuelle', {
                patient_id: user.id,
                plan: planKey,
                montant_fc: plans[planKey]?.prix_fc,
              }, token);
              if (!bridgeResult.success) {
                Alert.alert('Info', 'Déduction Longonia indisponible. Paiement Mobile Money requis.');
                return;
              }
              await api.post('/api/abonnements', {
                patient_id: user.id,
                plan: planKey,
                mode_paiement: 'longonia_bridge',
              }, token);
              Alert.alert('Abonnement activé !', 'Mutuelle activée via votre compte Longonia.');
              const abo = await api.get<Abonnement>(`/api/abonnements/${user.id}`, token);
              setAbonnement(abo);
            } catch (err: any) {
              Alert.alert('Erreur', err.message ?? 'Erreur lors du paiement.');
            } finally {
              setSouscription(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.header}><Text style={styles.headerTitle}>Ma mutuelle</Text></View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.dark} />
        </View>
      </View>
    );
  }

  const actif = abonnement?.actif ?? false;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ma mutuelle</Text>
        <Text style={styles.headerSub}>Forfaits SantéDirect Kolongono</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Statut abonnement actuel */}
        {abonnement && (
          <View style={[styles.statusCard, actif ? styles.statusActif : styles.statusInactif]}>
            <View style={styles.statusTop}>
              <Text style={styles.statusLabel}>Votre mutuelle</Text>
              <View style={[styles.statusBadge, actif ? styles.sbActif : styles.sbInactif]}>
                <View style={[styles.sbDot, actif ? styles.sbDotActif : styles.sbDotInactif]} />
                <Text style={[styles.sbText, actif ? styles.sbTextActif : styles.sbTextInactif]}>
                  {actif ? 'Active' : abonnement.nb_mois_impaye > 0 ? 'Impayée' : 'Inactive'}
                </Text>
              </View>
            </View>
            {actif && (
              <>
                <Text style={styles.statusPlan}>{abonnement.plan_info?.nom ?? abonnement.plan}</Text>
                <View style={styles.statusStats}>
                  <View style={styles.statusStat}>
                    <Text style={styles.statVal}>{abonnement.consultations_restantes}</Text>
                    <Text style={styles.statLbl}>consultations restantes</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statusStat}>
                    <Text style={styles.statVal}>{abonnement.plan_info?.membres ?? 1}</Text>
                    <Text style={styles.statLbl}>membres couverts</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statusStat}>
                    <Text style={styles.statVal}>{abonnement.plan_info?.hospitalisation ? 'Oui' : 'Non'}</Text>
                    <Text style={styles.statLbl}>hospitalisation</Text>
                  </View>
                </View>
              </>
            )}
            {!actif && abonnement.nb_mois_impaye > 0 && (
              <Text style={styles.statusAlerte}>
                {abonnement.nb_mois_impaye} mois impayé(s) — Régularisez pour accéder aux soins
              </Text>
            )}
          </View>
        )}

        {/* Plans */}
        <Text style={styles.sectionTitle}>CHOISIR UN PLAN</Text>

        {Object.entries(plans).map(([key, plan]) => {
          const isActif = actif && abonnement?.plan === key;
          const color   = PLAN_COLORS[key] ?? colors.primary;
          return (
            <View key={key} style={[styles.planCard, isActif && styles.planCardActif]}>
              {isActif && (
                <View style={styles.planBadgeCurrent}>
                  <Text style={styles.planBadgeCurrentText}>Plan actuel</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View style={[styles.planIconBg, { backgroundColor: color + '18' }]}>
                  <Icon name={PLAN_ICON_NAMES[key] ?? 'clipboard'} size={28} color={color} />
                </View>
                <View style={styles.planHeaderText}>
                  <Text style={styles.planNom}>{plan.nom}</Text>
                  <Text style={styles.planDesc}>{plan.description}</Text>
                </View>
                <View style={styles.planPrix}>
                  <Text style={[styles.planPrixVal, { color }]}>{plan.prix_fc.toLocaleString()}</Text>
                  <Text style={styles.planPrixUnit}>FC/mois</Text>
                </View>
              </View>

              <View style={styles.planFeatures}>
                <PlanFeature iconName="stethoscope" label={`${plan.consultations === 999 ? 'Illimité' : plan.consultations} consultation(s)/mois`} />
                <PlanFeature iconName="user"        label={`${plan.membres} membre(s) couverts`} />
                <PlanFeature iconName="hospital"    label={`Hospitalisation : ${plan.hospitalisation ? 'incluse' : 'non incluse'}`} ok={plan.hospitalisation} />
              </View>

              {!isActif && (
                <TouchableOpacity
                  style={[styles.planBtn, { backgroundColor: color }, souscription && styles.planBtnDisabled]}
                  onPress={() => souscrire(key)}
                  activeOpacity={0.85}
                  disabled={souscription}
                >
                  {souscription
                    ? <ActivityIndicator color="#FFF" />
                    : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.planBtnText}>Souscrire ce plan</Text>
                        <Icon name="arrow-right" size={16} color="#FFF" />
                      </View>
                    )
                  }
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Paiement Longonia */}
        <View style={styles.longoniaBox}>
          <Icon name="wifi" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.longoniaTitre}>Payer via Longonia</Text>
            <Text style={styles.longoniaText}>
              Si vous êtes adhérent LONGONIA, votre mutuelle peut être déduite automatiquement de votre solde. Sélectionnez "Déduire Longonia" lors de la souscription.
            </Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function PlanFeature({ iconName, label, ok }: { iconName: IconName; label: string; ok?: boolean }) {
  return (
    <View style={featureStyles.row}>
      <Icon name={iconName} size={14} color={ok === false ? colors.textLight : colors.primary} />
      <Text style={[featureStyles.label, ok === false && featureStyles.labelOff]}>{label}</Text>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  label:    { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  labelOff: { color: colors.textLight },
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
  scrollContent: { paddingTop: spacing.lg },

  statusCard:  { marginHorizontal: spacing.lg, borderRadius: radius.xxl, padding: spacing.xl, marginBottom: spacing.md, ...shadow.lg },
  statusActif: { backgroundColor: colors.primaryDark },
  statusInactif:{ backgroundColor: '#7F1D1D' },
  statusTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statusLabel: { color: '#FFF', fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, gap: 5 },
  sbActif:     { backgroundColor: 'rgba(22,163,74,0.25)' },
  sbInactif:   { backgroundColor: 'rgba(255,255,255,0.12)' },
  sbDot:       { width: 7, height: 7, borderRadius: 4 },
  sbDotActif:  { backgroundColor: '#4ADE80' },
  sbDotInactif:{ backgroundColor: 'rgba(255,255,255,0.4)' },
  sbText:      { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  sbTextActif: { color: '#4ADE80' },
  sbTextInactif:{ color: 'rgba(255,255,255,0.5)' },
  statusPlan:  { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  statusStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, paddingVertical: spacing.md },
  statusStat:  { alignItems: 'center' },
  statVal:     { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.black },
  statLbl:     { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  statusAlerte:{ color: '#FCA5A5', fontSize: fontSize.sm, marginTop: spacing.sm },

  sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },

  planCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md },
  planCardActif: { borderWidth: 2, borderColor: palette.dark },
  planBadgeCurrent: { backgroundColor: palette.dark, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: spacing.sm },
  planBadgeCurrentText: { color: palette.white, fontSize: fontSize.xs, fontWeight: fontWeight.black },
  planHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  planIconBg:   { width: 52, height: 52, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  planHeaderText:{ flex: 1 },
  planNom:      { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  planDesc:     { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  planPrix:     { alignItems: 'flex-end' },
  planPrixVal:  { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  planPrixUnit: { fontSize: fontSize.xs, color: colors.textMuted },
  planFeatures: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  planBtn:      { borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', ...shadow.sm },
  planBtnDisabled: { opacity: 0.6 },
  planBtnText:  { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.black },

  longoniaBox: {
    flexDirection: 'row',
    backgroundColor: colors.accentLight,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  longoniaTitre: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.accent, marginBottom: 4 },
  longoniaText:  { fontSize: fontSize.sm, color: colors.accent, lineHeight: 20 },
});

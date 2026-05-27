import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuth } from '../components/AuthContext';
import { api } from '../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../components/theme';
import { Icon, IconName } from '../components/Icons';

dayjs.locale('fr');

type Abonnement = {
  actif: boolean;
  plan: string | null;
  plan_info: { nom: string; prix_fc: number; consultations: number };
  consultations_restantes: number;
  prochain_renouvellement: string;
  nb_mois_impaye: number;
};

type Rdv = {
  consultation_id: string;
  date_heure: string;
  motif: string;
  statut: string;
  medecin?: { nom: string; prenom: string; specialite: string };
};

type Notif = { id: string; titre: string; corps: string; heure: string; iconName: IconName; couleur: string };

const NOTIF_ICONS: Record<string, IconName> = {
  rupture_stock: 'alert-triangle',
  consultation:  'stethoscope',
  paiement:      'file-text',
  rdv:           'calendar',
  ordonnance:    'clipboard',
};
const NOTIF_COULEURS: Record<string, string> = {
  urgent:  '#EF4444',
  warning: '#D97706',
  info:    palette.blueDeep,
};

// Couleurs pastels des cartes d'action
const ACTION_CARDS: { iconName: IconName; label: string; screen: string; bg: string; iconColor: string }[] = [
  { iconName: 'stethoscope', label: 'Consultation',  screen: 'Consultation', bg: palette.blue,     iconColor: palette.blueDeep   },
  { iconName: 'pill',        label: 'Pharmacie',     screen: 'Pharmacie',    bg: palette.purple,   iconColor: palette.purpleDeep },
  { iconName: 'clipboard',   label: 'Mon dossier',   screen: 'Dossier',      bg: palette.green,    iconColor: palette.greenDeep  },
  { iconName: 'file-text',   label: 'Ordonnances',   screen: 'Ordonnance',   bg: palette.blueSoft, iconColor: palette.blueDeep   },
];

export default function DashboardScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const [abonnement,    setAbonnement]    = useState<Abonnement | null>(null);
  const [rdvs,          setRdvs]          = useState<Rdv[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [notifVisible,  setNotifVisible]  = useState(false);
  const [notifs,        setNotifs]        = useState<Notif[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const abo = await api.get<Abonnement>(`/api/abonnements/${user.id}`, token);
      setAbonnement(abo);
    } catch {}
    try {
      const r = await api.get<{ rendez_vous: any[] }>(`/api/consultations/rdv?patient_id=${user.id}`, token);
      setRdvs((r.rendez_vous ?? []).map(rv => ({
        consultation_id: rv.id,
        lien_patient: rv.lien_patient,
        medecin_nom: rv.medecin_nom,
        date_heure: rv.date && rv.heure_debut ? `${rv.date}T${rv.heure_debut}` : rv.date ?? '',
        motif: rv.motif ?? '',
        statut: rv.statut ?? 'planifie',
        medecin: rv.medecin_nom ? { nom: rv.medecin_nom, prenom: '', specialite: rv.specialite ?? '' } : undefined,
      })));
    } catch {}
    try {
      const role = (user as any).role ?? 'adherent';
      const n = await api.get<{ count: number; items: Array<{ id: string; type: string; titre: string; corps: string; severite: string }> }>(
        `/api/notifications?role=${role}`,
        token,
      );
      setNotifs((n.items ?? []).map(item => ({
        id:       item.id,
        titre:    item.titre,
        corps:    item.corps,
        heure:    '',
        iconName: (NOTIF_ICONS[item.type] ?? 'alert-circle') as IconName,
        couleur:  NOTIF_COULEURS[item.severite] ?? palette.blueDeep,
      })));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [user, token]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.dark} />
        </View>
      </View>
    );
  }

  const actif = abonnement?.actif ?? false;
  const prochainRdv = rdvs.find(r => r.statut === 'planifie' || r.statut === 'confirme');
  const initiales = ((user?.prenom?.[0] ?? '') + (user?.nom?.[0] ?? '')).toUpperCase();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[palette.dark]}
            tintColor={palette.dark}
          />
        }
      >
        {/* ── Header blanc ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>Bonjour,</Text>
            <Text style={styles.headerName}>{user?.prenom} {user?.nom}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => setNotifVisible(true)}>
              <Icon name="bell" size={20} color={colors.text} />
              {notifs.length > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notifs.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initiales}</Text>
            </View>
          </View>
        </View>

        {/* ── Carte mutuelle ── */}
        <TouchableOpacity
          style={styles.mutuellCard}
          onPress={() => navigation.navigate('Abonnement')}
          activeOpacity={0.92}
        >
          {/* Blobs décoratifs */}
          <View style={styles.cardBlob1} />
          <View style={styles.cardBlob2} />

          <View style={styles.mutuellTop}>
            <View>
              <Text style={styles.mutuellLabel}>Mutuelle SantéDirect</Text>
              <Text style={styles.mutuellPlan}>
                {actif ? `Plan ${abonnement?.plan_info?.nom ?? 'Standard'}` : 'Adhésion requise'}
              </Text>
            </View>
            <View style={[styles.mutuellBadge, actif ? styles.badgeActif : styles.badgeInactif]}>
              <View style={[styles.badgeDot, actif ? styles.dotActif : styles.dotInactif]} />
              <Text style={[styles.badgeText, actif ? styles.badgeTextActif : styles.badgeTextInactif]}>
                {actif ? 'Actif' : abonnement?.nb_mois_impaye ? 'Impayé' : 'Inactif'}
              </Text>
            </View>
          </View>

          {actif ? (
            <View style={styles.mutuellStats}>
              <View style={styles.mutuellStat}>
                <Text style={styles.mutuellStatVal}>{abonnement?.consultations_restantes ?? 0}</Text>
                <Text style={styles.mutuellStatLbl}>consultations</Text>
              </View>
              <View style={styles.mutuellDivider} />
              <View style={styles.mutuellStat}>
                <Text style={styles.mutuellStatVal}>{abonnement?.plan_info?.prix_fc?.toLocaleString() ?? 0} FC</Text>
                <Text style={styles.mutuellStatLbl}>par mois</Text>
              </View>
              <View style={styles.mutuellDivider} />
              <View style={styles.mutuellStat}>
                <Text style={styles.mutuellStatVal}>{dayjs(abonnement?.prochain_renouvellement).format('D MMM')}</Text>
                <Text style={styles.mutuellStatLbl}>renouvellement</Text>
              </View>
            </View>
          ) : (
            <View style={styles.mutuellCta}>
              <Text style={styles.mutuellCtaText}>Souscrire maintenant</Text>
              <Icon name="arrow-right" size={14} color={palette.white} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Actions rapides ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.secTitle}>Actions rapides</Text>
        </View>
        <View style={styles.actionsGrid}>
          {ACTION_CARDS.map(a => (
            <TouchableOpacity
              key={a.screen}
              style={[styles.actionCard, { backgroundColor: a.bg }]}
              onPress={() => navigation.navigate(a.screen)}
              activeOpacity={0.82}
            >
              <Icon name={a.iconName} size={26} color={a.iconColor} strokeWidth={2} />
              <Text style={[styles.actionLabel, { color: a.iconColor }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Prochain RDV ── */}
        {prochainRdv && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.secTitle}>Prochain RDV</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Consultation')}>
                <Text style={styles.seeAll}>voir tout</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rdvCard}>
              <View style={styles.rdvLeft}>
                <Text style={styles.rdvDate}>{dayjs(prochainRdv.date_heure).format('D MMM')}</Text>
                <Text style={styles.rdvTime}>{dayjs(prochainRdv.date_heure).format('HH:mm')}</Text>
              </View>
              <View style={styles.rdvRight}>
                <Text style={styles.rdvMotif} numberOfLines={1}>{prochainRdv.motif}</Text>
                {prochainRdv.medecin && (
                  <Text style={styles.rdvMedecin}>Dr. {prochainRdv.medecin.prenom} {prochainRdv.medecin.nom}</Text>
                )}
                <View style={styles.rdvBadge}>
                  <Text style={styles.rdvBadgeText}>Confirmé</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.rdvJoinBtn}
                onPress={() => navigation.navigate('Teleconsultation', {
                  rdv_id: prochainRdv.consultation_id,
                  url: prochainRdv.lien_patient,
                  medecin: prochainRdv.medecin_nom,
                  role: 'patient',
                })}
              >
                <Icon name="arrow-right" size={16} color={palette.white} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Urgence ── */}
        <TouchableOpacity style={styles.urgenceCard} activeOpacity={0.88}>
          <View style={styles.urgenceIconBg}>
            <Icon name="ambulance" size={22} color={palette.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgenceTitle}>Urgence médicale</Text>
            <Text style={styles.urgenceSub}>SAMU 15 · Pompiers 18 · Urgences locales</Text>
          </View>
          <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* ── Proverbe ── */}
        <View style={styles.proverbeCard}>
          <Text style={styles.provLuba}>"Bidimu m'bupita buanga"</Text>
          <Text style={styles.provFr}>Mieux vaut prévenir que guérir</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Modal notifications ── */}
      <Modal
        visible={notifVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setNotifVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            {/* En-tête */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              {notifs.length > 0 && (
                <TouchableOpacity
                  onPress={() => setNotifs([])}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.modalMarkAll}>Tout marquer lu</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Liste */}
            {notifs.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Icon name="bell" size={32} color={colors.textMuted} strokeWidth={1.4} />
                <Text style={styles.notifEmptyText}>Aucune nouvelle notification</Text>
              </View>
            ) : (
              notifs.map((n, idx) => (
                <View key={n.id}>
                  <View style={styles.notifRow}>
                    <View style={[styles.notifIconBg, { backgroundColor: n.couleur + '18' }]}>
                      <Icon name={n.iconName} size={18} color={n.couleur} strokeWidth={2} />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={styles.notifTitre}>{n.titre}</Text>
                      <Text style={styles.notifCorps} numberOfLines={2}>{n.corps}</Text>
                      <Text style={styles.notifHeure}>{n.heure}</Text>
                    </View>
                  </View>
                  {idx < notifs.length - 1 && <View style={styles.notifSep} />}
                </View>
              ))
            )}

            {/* Fermer */}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setNotifVisible(false)}>
              <Text style={styles.modalCloseTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 0 },

  // Header blanc
  header: {
    backgroundColor: palette.white,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
  headerName:     { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.text },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', ...shadow.xs },
  notifBadge:     { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notifBadgeText: { color: palette.white, fontSize: 9, fontWeight: fontWeight.black, lineHeight: 14 },

  // Modal notifications
  modalBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: palette.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: 36 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:     { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.text },
  modalMarkAll:   { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },
  notifRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
  notifIconBg:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifContent:   { flex: 1 },
  notifTitre:     { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 2 },
  notifCorps:     { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 18 },
  notifHeure:     { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4, opacity: 0.7 },
  notifSep:       { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  notifEmpty:     { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  notifEmptyText: { fontSize: fontSize.md, color: colors.textMuted },
  modalCloseBtn:  { marginTop: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  modalCloseTxt:  { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.blue, justifyContent: 'center', alignItems: 'center' },
  avatarText:     { color: palette.dark, fontSize: fontSize.md, fontWeight: fontWeight.black },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  secTitle:   { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  seeAll:     { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },

  // Mutuelle card — marine sombre
  mutuellCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    backgroundColor: palette.dark,
    overflow: 'hidden',
    ...shadow.lg,
  },
  cardBlob1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: palette.blue,   opacity: 0.15, top: -80, right: -60  },
  cardBlob2: { position: 'absolute', width: 120, height: 120, borderRadius: 60,  backgroundColor: palette.purple, opacity: 0.12, bottom: -40, left: 20  },
  mutuellTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  mutuellLabel:  { color: palette.white, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  mutuellPlan:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm, marginTop: 2 },
  mutuellBadge:  { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5, gap: 5 },
  badgeActif:    { backgroundColor: 'rgba(189,238,173,0.25)' },
  badgeInactif:  { backgroundColor: 'rgba(255,255,255,0.12)' },
  badgeDot:      { width: 7, height: 7, borderRadius: 4 },
  dotActif:      { backgroundColor: palette.green },
  dotInactif:    { backgroundColor: 'rgba(255,255,255,0.4)' },
  badgeText:     { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  badgeTextActif:  { color: palette.green },
  badgeTextInactif:{ color: 'rgba(255,255,255,0.5)' },
  mutuellStats:  { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, paddingVertical: spacing.md },
  mutuellStat:   { alignItems: 'center' },
  mutuellStatVal:{ color: palette.white, fontSize: fontSize.lg, fontWeight: fontWeight.black },
  mutuellStatLbl:{ color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs, marginTop: 2 },
  mutuellDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  mutuellCta:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, paddingVertical: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  mutuellCtaText:{ color: palette.white, fontWeight: fontWeight.bold, fontSize: fontSize.md },

  // Actions pastels
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.sm },
  actionCard:  { flex: 1, minWidth: '44%', borderRadius: radius.xl, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, alignItems: 'flex-start', gap: spacing.sm, ...shadow.xs },
  actionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: 18 },

  // RDV card
  rdvCard:    { backgroundColor: palette.white, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadow.md },
  rdvLeft:    { backgroundColor: palette.blueSoft, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', minWidth: 52 },
  rdvDate:    { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: palette.blueDeep },
  rdvTime:    { fontSize: fontSize.xs, color: palette.blueDeep, fontWeight: fontWeight.semibold, marginTop: 2 },
  rdvRight:   { flex: 1 },
  rdvMotif:   { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  rdvMedecin: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  rdvBadge:   { backgroundColor: palette.greenSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  rdvBadgeText:{ color: palette.greenDeep, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  rdvJoinBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.dark, justifyContent: 'center', alignItems: 'center', ...shadow.sm },

  // Urgence
  urgenceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: palette.dark,
    marginHorizontal: spacing.lg, marginTop: spacing.xl,
    borderRadius: radius.xl, padding: spacing.lg,
    ...shadow.sm,
  },
  urgenceIconBg: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center' },
  urgenceTitle:  { fontSize: fontSize.md, fontWeight: fontWeight.black, color: palette.white },
  urgenceSub:    { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  // Proverbe
  proverbeCard: { backgroundColor: palette.purpleSoft, marginHorizontal: spacing.lg, marginTop: spacing.xl, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  provLuba:     { fontSize: fontSize.md, fontWeight: fontWeight.black, color: palette.purpleDeep, textAlign: 'center', fontStyle: 'italic' },
  provFr:       { fontSize: fontSize.sm, color: palette.purpleDeep, marginTop: spacing.xs, textAlign: 'center', opacity: 0.75 },
});

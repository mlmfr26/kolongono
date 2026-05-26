import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../components/theme';
import { Icon } from '../components/Icons';
import { ApiClient } from '../components/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creneau {
  date: string;
  heure_debut: string;
  heure_fin: string;
  statut: 'libre' | 'reserve';
  duree_min: number;
}

interface MoisData {
  mois: string;
  creneaux: Creneau[];
  total: number;
  libres: number;
  reserves: number;
}

interface Medecin {
  id: string;
  prenom: string;
  nom: string;
  specialite: string;
  pays: string;
  ville: string;
  note: number;
  langues: string[];
  bio: string;
  disponible: boolean;
}

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_COURT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const JOURS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const NB_MOIS = 3; // visibilité minimale 3 mois en avant

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${JOURS_FR[d.getDay()]} ${d.getDate()} ${MOIS_COURT[d.getMonth()]}`;
}

function currentMois(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function moisLabel(mois: string): string {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS_FR[m - 1]} ${y}`;
}

function moisCourt(mois: string): string {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS_COURT[m - 1]} ${y}`;
}

function addMois(mois: string, offset: number): string {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function groupByDate(creneaux: Creneau[]): Record<string, Creneau[]> {
  return creneaux.reduce((acc, c) => {
    (acc[c.date] = acc[c.date] || []).push(c);
    return acc;
  }, {} as Record<string, Creneau[]>);
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function PriseRDVScreen({ navigation, route }: any) {
  const { medecin_id, patient_id, patient_nom, triage_id, motif, mode } = route.params || {};

  const [medecin, setMedecin]           = useState<Medecin | null>(null);
  const [moisData, setMoisData]         = useState<MoisData[]>([]);
  const [moisActif, setMoisActif]       = useState<string>(currentMois());
  const [loadingPlan, setLoadingPlan]   = useState(false);
  const [loadingRdv, setLoadingRdv]     = useState(false);
  const [selected, setSelected]         = useState<Creneau | null>(null);
  const [modalConfirm, setModalConfirm] = useState(false);
  const [rdvResult, setRdvResult]       = useState<any>(null);
  const tabsRef = useRef<ScrollView>(null);

  // Charger profil médecin
  useEffect(() => {
    ApiClient.get(`/api/consultations/medecins/${medecin_id}`)
      .then(setMedecin)
      .catch(() => {});
  }, [medecin_id]);

  // Charger planning 3 mois dès le départ
  const loadPlanning = useCallback(async (moisDebut: string) => {
    setLoadingPlan(true);
    setMoisData([]);
    try {
      const data = await ApiClient.get(
        `/api/consultations/planning/${medecin_id}?mois=${moisDebut}&nb_mois=${NB_MOIS}`
      );
      const months: MoisData[] = data.mois_data || [];
      setMoisData(months);
      // Pointer sur le premier mois ayant des créneaux libres
      const firstAvailable = months.find(m => m.libres > 0);
      if (firstAvailable) setMoisActif(firstAvailable.mois);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le planning.');
    } finally {
      setLoadingPlan(false);
    }
  }, [medecin_id]);

  useEffect(() => { loadPlanning(currentMois()); }, [loadPlanning]);

  const loadMore = () => {
    const dernierMois = moisData[moisData.length - 1]?.mois;
    if (dernierMois) loadPlanning(addMois(dernierMois, 1));
  };

  const confirmerRDV = async () => {
    if (!selected) return;
    setLoadingRdv(true);
    try {
      const data = await ApiClient.post('/api/consultations/rdv', {
        medecin_id,
        patient_id,
        date: selected.date,
        heure_debut: selected.heure_debut,
        heure_fin: selected.heure_fin,
        motif: motif || '',
        triage_id: triage_id || null,
      });
      setRdvResult(data);
      setModalConfirm(false);
    } catch (e: any) {
      setModalConfirm(false);
      if (e.status === 402) {
        Alert.alert(
          'Cotisation impayée',
          `${e.detail?.message || 'Régularisation requise.'}\n\nMontant dû : ${e.detail?.montant_du_fc?.toLocaleString('fr-FR')} FC`,
          [
            { text: 'Fermer', style: 'cancel' },
            { text: 'Voir mon compte', onPress: () => navigation.navigate('ComptePatient', { patient_id }) },
          ],
        );
      } else if (e.status === 409) {
        Alert.alert('Créneau indisponible', "Ce créneau vient d'être réservé. Choisissez un autre horaire.");
        loadPlanning(currentMois());
      } else {
        Alert.alert('Erreur', e.message || 'Impossible de confirmer le rendez-vous.');
      }
    } finally {
      setLoadingRdv(false);
    }
  };

  // ── Résultat confirmation RDV ──────────────────────────────────────────────
  if (rdvResult) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.successIcon}>
            <Icon name="check-circle" size={60} color={palette.greenDeep} strokeWidth={1.5} />
          </View>
          <Text style={styles.successTitle}>Rendez-vous confirmé !</Text>
          <Text style={styles.successSub}>{rdvResult.medecin} · {rdvResult.specialite}</Text>
          <Text style={styles.successDate}>
            {rdvResult.date ? formatDate(rdvResult.date) : ''} à {rdvResult.heure?.split(' – ')[0]}
          </Text>

          <View style={styles.linksCard}>
            <Text style={styles.linksTitle}>Liens de consultation vidéo</Text>
            <LinkRow label="Lien Patient"    link={rdvResult.lien_patient}    color={palette.blue} />
            <LinkRow label="Lien Auxiliaire" link={rdvResult.lien_auxiliaire} color={palette.green} />
            <LinkRow label="Lien Médecin"    link={rdvResult.lien_medecin}    color={palette.purple} />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{rdvResult.instructions}</Text>
          </View>

          <TouchableOpacity
            style={styles.teleconsBtn}
            onPress={() => navigation.navigate('Teleconsultation', {
              rdv_id: rdvResult.rdv_id,
              url: rdvResult.lien_patient,
              medecin: rdvResult.medecin,
            })}
            activeOpacity={0.85}
          >
            <Text style={styles.teleconsBtnText}>Rejoindre la consultation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.popToTop()} activeOpacity={0.7}>
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeMoisData = moisData.find(m => m.mois === moisActif);
  const creneauxActifs = activeMoisData?.creneaux.filter(c => c.statut === 'libre') ?? [];
  const grouped        = groupByDate(creneauxActifs);
  const dates          = Object.keys(grouped).sort();
  const today          = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={palette.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Choisir un créneau</Text>
          {medecin && (
            <Text style={styles.headerSub}>
              Dr. {medecin.prenom} {medecin.nom} · {medecin.specialite}
            </Text>
          )}
        </View>
        {mode === 'readonly' && (
          <View style={styles.readonlyBadge}>
            <Text style={styles.readonlyBadgeText}>Consultation</Text>
          </View>
        )}
      </View>

      {/* Profil médecin */}
      {medecin && (
        <View style={styles.medecinCard}>
          <View style={styles.medecinAvatar}>
            <Text style={styles.medecinInitials}>{medecin.prenom[0]}{medecin.nom[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.medecinNom}>Dr. {medecin.prenom} {medecin.nom}</Text>
            <Text style={styles.medecinSpec}>{medecin.specialite}</Text>
            <Text style={styles.medecinVille}>{medecin.ville}, {medecin.pays} · ⭐ {medecin.note}</Text>
            <View style={styles.languesRow}>
              {medecin.langues.map((l, i) => (
                <View key={i} style={styles.langChip}>
                  <Text style={styles.langChipText}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Sélecteur de mois — onglets scrollables (min 3 mois) */}
      <View style={styles.moisTabsWrap}>
        <ScrollView
          ref={tabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moisTabsContent}
        >
          {moisData.map((md) => {
            const isActif = md.mois === moisActif;
            const hasSlots = md.libres > 0;
            return (
              <TouchableOpacity
                key={md.mois}
                style={[styles.moisTab, isActif && styles.moisTabActive, !hasSlots && styles.moisTabEmpty]}
                onPress={() => setMoisActif(md.mois)}
                activeOpacity={0.75}
              >
                <Text style={[styles.moisTabLabel, isActif && styles.moisTabLabelActive]}>
                  {moisCourt(md.mois)}
                </Text>
                <View style={[styles.moisTabBadge, isActif && styles.moisTabBadgeActive, !hasSlots && styles.moisTabBadgeEmpty]}>
                  <Text style={[styles.moisTabBadgeText, isActif && styles.moisTabBadgeTextActive]}>
                    {hasSlots ? `${md.libres} dispo` : 'Complet'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {/* Bouton charger plus */}
          {!loadingPlan && moisData.length > 0 && (
            <TouchableOpacity style={styles.moisTabMore} onPress={loadMore} activeOpacity={0.75}>
              <Text style={styles.moisTabMoreText}>+3 mois</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {loadingPlan ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={palette.dark} />
          <Text style={styles.loadingText}>Chargement des disponibilités…</Text>
        </View>
      ) : dates.length === 0 ? (
        <View style={styles.emptyCenter}>
          <Icon name="calendar" size={48} color={colors.textLight} strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>Aucun créneau en {moisLabel(moisActif)}</Text>
          <Text style={styles.emptyText}>
            {moisData.some(m => m.libres > 0 && m.mois !== moisActif)
              ? "Des créneaux sont disponibles dans d'autres mois →"
              : 'Aucune disponibilité dans les 3 prochains mois.'}
          </Text>
          <TouchableOpacity onPress={loadMore} style={styles.nextMonthBtn}>
            <Text style={styles.nextMonthBtnText}>Voir les 3 mois suivants →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={dates}
          keyExtractor={d => d}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
          renderItem={({ item: d }) => {
            const isPast = d < today;
            return (
              <View style={[styles.dateGroup, isPast && styles.dateGroupPast]}>
                <View style={styles.dateLabelRow}>
                  <Text style={[styles.dateLabel, isPast && { color: colors.textLight }]}>
                    {formatDate(d)}
                  </Text>
                  {d === today && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Aujourd'hui</Text></View>}
                </View>
                <View style={styles.creneauxRow}>
                  {grouped[d].map((c, i) => {
                    const isSel = selected?.date === c.date && selected?.heure_debut === c.heure_debut;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.creneauBtn, isSel && styles.creneauBtnSelected, isPast && styles.creneauBtnPast]}
                        onPress={() => { if (!isPast) { setSelected(c); setModalConfirm(true); } }}
                        disabled={isPast}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.creneauHeure, isSel && styles.creneauHeureSelected, isPast && { color: colors.textLight }]}>
                          {c.heure_debut}
                        </Text>
                        <Text style={[styles.creneauDuree, isSel && { color: 'rgba(255,255,255,.7)' }]}>
                          {c.duree_min} min
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal confirmation */}
      <Modal visible={modalConfirm} transparent animationType="slide" onRequestClose={() => setModalConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Confirmer le rendez-vous ?</Text>
            {selected && medecin && (
              <>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Médecin</Text>
                  <Text style={styles.modalInfoValue}>Dr. {medecin.prenom} {medecin.nom}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Date</Text>
                  <Text style={styles.modalInfoValue}>{formatDate(selected.date)}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Heure</Text>
                  <Text style={styles.modalInfoValue}>{selected.heure_debut} – {selected.heure_fin}</Text>
                </View>
                {motif ? (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Motif</Text>
                    <Text style={styles.modalInfoValue} numberOfLines={2}>{motif}</Text>
                  </View>
                ) : null}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Patient</Text>
                  <Text style={styles.modalInfoValue}>{patient_nom || '—'}</Text>
                </View>
              </>
            )}
            <TouchableOpacity
              style={[styles.confirmBtn, loadingRdv && { opacity: 0.7 }]}
              onPress={confirmerRDV}
              disabled={loadingRdv}
              activeOpacity={0.85}
            >
              {loadingRdv
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirmer le RDV</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalConfirm(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Lien vidéo ──────────────────────────────────────────────────────────────

function LinkRow({ label, link, color }: { label: string; link: string; color: string }) {
  return (
    <View style={[linkStyles.row, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={linkStyles.label}>{label}</Text>
        <Text style={linkStyles.url} numberOfLines={1}>{link}</Text>
      </View>
    </View>
  );
}

const linkStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingLeft: spacing.sm, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  url:   { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: palette.dark, gap: spacing.sm },
  backBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#fff' },
  headerSub:    { fontSize: fontSize.xs, color: 'rgba(255,255,255,.55)', marginTop: 2 },
  readonlyBadge:{ backgroundColor: palette.blue, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  readonlyBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.blueDeep },

  medecinCard:  { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  medecinAvatar:{ width: 52, height: 52, borderRadius: 26, backgroundColor: palette.blue, justifyContent: 'center', alignItems: 'center' },
  medecinInitials: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: palette.blueDeep },
  medecinNom:   { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  medecinSpec:  { fontSize: fontSize.sm, color: palette.blueDeep },
  medecinVille: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  languesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  langChip:     { backgroundColor: palette.blueSoft, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  langChipText: { fontSize: fontSize.xs, color: palette.blueDeep, fontWeight: fontWeight.medium },

  // Onglets mois (min 3 en avant)
  moisTabsWrap:    { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  moisTabsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  moisTab:         { alignItems: 'center', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, minWidth: 80 },
  moisTabActive:   { backgroundColor: palette.dark, borderColor: palette.dark },
  moisTabEmpty:    { opacity: 0.5 },
  moisTabLabel:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  moisTabLabelActive: { color: '#fff' },
  moisTabBadge:    { marginTop: 4, backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  moisTabBadgeActive: { backgroundColor: palette.blue },
  moisTabBadgeEmpty:  { backgroundColor: 'transparent' },
  moisTabBadgeText:   { fontSize: 10, fontWeight: fontWeight.bold, color: colors.textMuted },
  moisTabBadgeTextActive: { color: palette.blueDeep },
  moisTabMore:     { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: palette.blueSoft, borderWidth: 1.5, borderColor: palette.blue, minWidth: 72 },
  moisTabMoreText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.blueDeep },

  loadingCenter:{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText:  { color: colors.textMuted, fontSize: fontSize.md },
  emptyCenter:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle:   { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, textAlign: 'center' },
  emptyText:    { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  nextMonthBtn: { backgroundColor: palette.dark, borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: 12, marginTop: spacing.md },
  nextMonthBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  dateGroup:    { marginBottom: spacing.lg },
  dateGroupPast:{ opacity: 0.4 },
  dateLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dateLabel:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  todayBadge:   { backgroundColor: palette.green, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 10, fontWeight: fontWeight.bold, color: palette.greenDeep },
  creneauxRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  creneauBtn:   { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md, backgroundColor: palette.blueSoft, borderWidth: 1.5, borderColor: palette.blue, alignItems: 'center', minWidth: 68 },
  creneauBtnSelected: { backgroundColor: palette.dark, borderColor: palette.dark },
  creneauBtnPast:{ backgroundColor: colors.border, borderColor: colors.border },
  creneauHeure: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: palette.blueDeep },
  creneauHeureSelected: { color: '#fff' },
  creneauDuree: { fontSize: 10, color: palette.blueDeep, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:   { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.lg },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalInfoLabel: { fontSize: fontSize.md, color: colors.textMuted },
  modalInfoValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, flex: 1, textAlign: 'right' },
  confirmBtn:   { marginTop: spacing.xl, backgroundColor: palette.dark, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center', ...shadow.md },
  confirmBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cancelBtn:    { marginTop: spacing.sm, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: colors.textMuted, fontSize: fontSize.md },

  // Confirmation succès
  scroll:       { padding: spacing.xl, alignItems: 'center' },
  successIcon:  { marginTop: spacing.xl, marginBottom: spacing.md },
  successTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: palette.greenDeep, textAlign: 'center' },
  successSub:   { fontSize: fontSize.md, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  successDate:  { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xl, textAlign: 'center' },
  linksCard:    { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  linksTitle:   { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.md },
  infoCard:     { width: '100%', backgroundColor: palette.blueSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl },
  infoText:     { fontSize: fontSize.sm, color: palette.blueDeep, lineHeight: 20 },
  teleconsBtn:  { width: '100%', backgroundColor: palette.dark, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center', ...shadow.md, marginBottom: spacing.sm },
  teleconsBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  homeBtn:      { width: '100%', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  homeBtnText:  { color: colors.textMuted, fontSize: fontSize.md },
});

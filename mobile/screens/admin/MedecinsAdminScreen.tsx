import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';

type Medecin = {
  id: string;
  nom: string;
  specialite: string;
  pays: string;
  ville: string;
  disponible: boolean;
  note: number | null;
  nb_consultations_total: number;
  nb_consultations_via_sd: number;
};

const FLAGS: Record<string, string> = {
  CD:'🇨🇩', FR:'🇫🇷', BE:'🇧🇪', CH:'🇨🇭', NL:'🇳🇱',
  MA:'🇲🇦', SN:'🇸🇳', CM:'🇨🇲', CI:'🇨🇮',
};
const ZONE_EU = ['FR','BE','CH','NL'];
const ZONE_AF = ['MA','SN','CM','CI'];

type Filtre = 'tous' | 'rdc' | 'europe' | 'afrique';

export default function MedecinsAdminScreen() {
  const { token } = useAuth();
  const [medecins,  setMedecins]  = useState<Medecin[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filtre,    setFiltre]    = useState<Filtre>('tous');
  const [query,     setQuery]     = useState('');
  const [selected,  setSelected]  = useState<Medecin | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ medecins: Medecin[]; total: number }>('/api/admin/medecins', token)
      .then(d => { if (!cancelled && d.medecins) setMedecins(d.medecins); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]));

  const filtered = useMemo(() => {
    let data = medecins;
    if (filtre === 'rdc')    data = data.filter(m => m.pays === 'CD');
    else if (filtre === 'europe')  data = data.filter(m => ZONE_EU.includes(m.pays));
    else if (filtre === 'afrique') data = data.filter(m => ZONE_AF.includes(m.pays));
    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter(m =>
        m.nom.toLowerCase().includes(q) ||
        m.specialite.toLowerCase().includes(q) ||
        m.ville.toLowerCase().includes(q)
      );
    }
    return data;
  }, [filtre, query, medecins]);

  const actifs         = medecins.filter(m => m.disponible);
  const totalConsult   = actifs.reduce((s, m) => s + m.nb_consultations_total, 0);
  const totalViaSD     = actifs.reduce((s, m) => s + m.nb_consultations_via_sd, 0);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Médecins partenaires</Text>
        <Text style={styles.headerSub}>Réseau téléconsultation · Salaires mensuels fixes</Text>
        {loading
          ? <ActivityIndicator color="#FFF" style={{ marginTop: 8 }} />
          : (
            <View style={styles.kpiRow}>
              <KpiChip val={`${actifs.length}`}              lbl="Médecins actifs" />
              <KpiChip val={`${totalConsult.toLocaleString()}`} lbl="Consultations total" color={palette.blue} />
              <KpiChip val={`${totalViaSD}`}                 lbl="Via SantéDirect" color={palette.green} />
            </View>
          )
        }
      </View>

      {/* Recherche */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Nom, spécialité, ville…"
            placeholderTextColor={colors.textLight}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {([['tous','Tous'],['rdc','🇨🇩 RDC'],['europe','🌍 Europe'],['afrique','🌍 Afrique']] as [Filtre,string][]).map(([k,l]) => (
          <TouchableOpacity key={k} style={[styles.chip, filtre === k && styles.chipActive]} onPress={() => setFiltre(k)}>
            <Text style={[styles.chipText, filtre === k && styles.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} médecin{filtered.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Liste */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>Aucun médecin</Text>
          </View>
        )}

        {filtered.map(m => {
          const initiales  = m.nom.replace(/^Dr\.\s*/, '').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
          const avatarBg   = ZONE_EU.includes(m.pays) ? palette.purple : ZONE_AF.includes(m.pays) ? palette.amber : palette.blue;
          return (
            <TouchableOpacity key={m.id} style={styles.card} activeOpacity={0.75} onPress={() => setSelected(m)}>
              <View style={styles.cardLeft}>
                <View style={[styles.avatar, { backgroundColor: avatarBg + '30', borderColor: avatarBg + '60' }]}>
                  <Text style={[styles.avatarText, { color: avatarBg }]}>{initiales}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardNom}>{m.nom}</Text>
                  <View style={[styles.statutBadge, { backgroundColor: m.disponible ? colors.greenLight : colors.bg }]}>
                    <Text style={[styles.statutText, { color: m.disponible ? colors.greenDeep : colors.textMuted }]}>
                      {m.disponible ? 'Actif' : 'Inactif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSpecialite}>{m.specialite}</Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardVille}>{FLAGS[m.pays] || m.pays} {m.ville}</Text>
                  {m.note !== null && (
                    <View style={styles.noteChip}>
                      <Text style={styles.noteText}>⭐ {m.note?.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardFooterRow}>
                  <Text style={styles.cardConsult}>{m.nb_consultations_total.toLocaleString()} consultations total</Text>
                  {m.nb_consultations_via_sd > 0 && (
                    <Text style={styles.cardSD}>{m.nb_consultations_via_sd} via SD</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Modal détail */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)} />
        {selected && (() => {
          const initiales = selected.nom.replace(/^Dr\.\s*/, '').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
          const avatarBg  = ZONE_EU.includes(selected.pays) ? palette.purple : ZONE_AF.includes(selected.pays) ? palette.amber : palette.blue;
          return (
            <View style={styles.modal}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={[styles.modalAvatar, { backgroundColor: avatarBg + '25' }]}>
                  <Text style={[styles.modalAvatarText, { color: avatarBg }]}>{initiales}</Text>
                </View>
                <View style={styles.modalTitleBlock}>
                  <Text style={styles.modalNom}>{selected.nom}</Text>
                  <Text style={styles.modalSpecialite}>{selected.specialite}</Text>
                  <Text style={styles.modalVille}>{FLAGS[selected.pays] || selected.pays} {selected.ville}</Text>
                </View>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <SectionLabel>Activité</SectionLabel>
                <View style={styles.infoBlock}>
                  <InfoRow label="Consultations total"      val={selected.nb_consultations_total.toLocaleString()} bold />
                  <InfoRow label="Via SantéDirect"          val={selected.nb_consultations_via_sd.toString()} />
                  {selected.note !== null && <InfoRow label="Note patients" val={`⭐ ${selected.note?.toFixed(1)} / 5`} />}
                  <InfoRow label="Identifiant réseau"       val={selected.id} mono />
                </View>

                <SectionLabel>Rémunération</SectionLabel>
                <View style={styles.infoBlock}>
                  <InfoRow label="Salaire mensuel fixe"     val="200–450 USD / mois" bold />
                  <InfoRow label="Mode de paiement"        val="Mensuel — Mobile Money" />
                  <InfoRow label="Tarif consultation"      val="Inclus mutuelle (0 FC)" />
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

function KpiChip({ val, lbl, color }: { val: string; lbl: string; color?: string }) {
  return (
    <View style={styles.kpiChip}>
      <Text style={[styles.kpiVal, color ? { color } : {}]}>{val}</Text>
      <Text style={styles.kpiLbl}>{lbl}</Text>
    </View>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
function InfoRow({ label, val, bold, mono }: { label: string; val: string; bold?: boolean; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoVal, bold && { fontWeight: fontWeight.bold as any }, mono && { fontFamily: 'monospace', fontSize: fontSize.sm }]}>
        {val}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header:      { backgroundColor: palette.dark, paddingTop: 52, paddingBottom: 20, paddingHorizontal: spacing.lg },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black as any, color: '#fff', marginBottom: 3 },
  headerSub:   { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.65)', marginBottom: 16 },
  kpiRow:      { flexDirection: 'row', gap: 10 },
  kpiChip:     { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  kpiVal:      { fontSize: fontSize.base, fontWeight: fontWeight.black as any, color: '#fff' },
  kpiLbl:      { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  searchWrap:  { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10, ...shadow.sm },
  searchIcon:  { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, padding: 0 },
  clearBtn:    { fontSize: 15, color: colors.textMuted, paddingLeft: 8 },

  filterScroll:  { flexGrow: 0 },
  filterContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8, flexDirection: 'row' },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  chipActive:    { backgroundColor: palette.dark, borderColor: palette.dark },
  chipText:      { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium as any },
  chipTextActive:{ color: '#fff' },

  countRow:    { paddingHorizontal: spacing.lg, paddingBottom: 6 },
  countText:   { fontSize: fontSize.sm, color: colors.textMuted },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: 4 },

  card:          { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: 10, ...shadow.sm },
  cardLeft:      { marginRight: 12 },
  avatar:        { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: fontSize.base, fontWeight: fontWeight.black as any },
  cardBody:      { flex: 1 },
  cardTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardNom:       { fontSize: fontSize.md, fontWeight: fontWeight.bold as any, color: colors.text, flex: 1, marginRight: 8 },
  statutBadge:   { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  statutText:    { fontSize: 11, fontWeight: fontWeight.semibold as any },
  cardSpecialite:{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 6 },
  cardMetaRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardVille:     { fontSize: fontSize.sm, color: colors.text },
  noteChip:      { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: palette.warningLight },
  noteText:      { fontSize: 12, fontWeight: fontWeight.bold as any, color: palette.amber },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  cardConsult:   { fontSize: 11, color: colors.textLight },
  cardSD:        { fontSize: 11, color: palette.greenDeep },

  overlay:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,46,0.5)' },
  modal:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingTop: 12 },
  modalHandle:     { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: 16 },
  modalAvatar:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  modalAvatarText: { fontSize: fontSize.xl, fontWeight: fontWeight.black as any },
  modalTitleBlock: { flex: 1 },
  modalNom:        { fontSize: fontSize.lg, fontWeight: fontWeight.black as any, color: colors.text },
  modalSpecialite: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  modalVille:      { fontSize: fontSize.sm, color: colors.textLight, marginTop: 2 },
  modalScroll:     { paddingHorizontal: spacing.lg },

  sectionLabel: { fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md, marginBottom: 8 },
  infoBlock:    { backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 4 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoLabel:    { fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  infoVal:      { fontSize: fontSize.sm, color: colors.text, textAlign: 'right', flex: 1 },
});

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette, TAP_TARGET } from '../../components/theme';
import { Icon } from '../../components/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeRepas = 'petit_dejeuner' | 'dejeuner' | 'diner';

interface Repas {
  id: string;
  date: string;              // 'YYYY-MM-DD'
  type_repas: TypeRepas;
  nb_personnel: number;
  nb_patients: number;
  nb_accompagnants: number;
  menu: string;
  cout_fc: number;
}

// ─── Données démo ─────────────────────────────────────────────────────────────

const TODAY = new Date();
function dateStr(offsetDays: number) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

const DEMO_REPAS: Repas[] = [
  { id: 'R01', date: dateStr(0), type_repas: 'petit_dejeuner', nb_personnel: 11, nb_patients: 8,  nb_accompagnants: 2,  menu: 'Bouillie de maïs, pain, thé', cout_fc: 45000 },
  { id: 'R02', date: dateStr(0), type_repas: 'dejeuner',       nb_personnel: 11, nb_patients: 10, nb_accompagnants: 4,  menu: 'Riz, haricots, légumes', cout_fc: 85000 },
  { id: 'R03', date: dateStr(1), type_repas: 'petit_dejeuner', nb_personnel: 10, nb_patients: 9,  nb_accompagnants: 3,  menu: 'Bouillie de maïs, café', cout_fc: 42000 },
  { id: 'R04', date: dateStr(1), type_repas: 'dejeuner',       nb_personnel: 10, nb_patients: 9,  nb_accompagnants: 3,  menu: 'Fufu, saka-saka, poisson', cout_fc: 90000 },
  { id: 'R05', date: dateStr(1), type_repas: 'diner',          nb_personnel: 8,  nb_patients: 9,  nb_accompagnants: 2,  menu: 'Riz, sauce arachide', cout_fc: 70000 },
  { id: 'R06', date: dateStr(2), type_repas: 'dejeuner',       nb_personnel: 11, nb_patients: 7,  nb_accompagnants: 2,  menu: 'Fufu, mbinzo, viande', cout_fc: 88000 },
  { id: 'R07', date: dateStr(2), type_repas: 'diner',          nb_personnel: 9,  nb_patients: 7,  nb_accompagnants: 1,  menu: 'Pain, sardines, tisane', cout_fc: 55000 },
];

// ─── Configs ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TypeRepas, { label: string; icon: any; color: string }> = {
  petit_dejeuner: { label: 'Petit-déjeuner', icon: 'sun',    color: palette.amber },
  dejeuner:       { label: 'Déjeuner',        icon: 'clock',  color: palette.blue },
  diner:          { label: 'Dîner',           icon: 'moon',   color: palette.purple },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-CD', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDate(repas: Repas[]): { date: string; items: Repas[] }[] {
  const map: Record<string, Repas[]> = {};
  repas.forEach(r => {
    if (!map[r.date]) map[r.date] = [];
    map[r.date].push(r);
  });
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function RefectoireScreen({ navigation }: any) {
  const { token } = useAuth();
  const [repas, setRepas] = useState<Repas[]>(DEMO_REPAS);

  // Formulaire
  const [typeForm, setTypeForm]             = useState<TypeRepas>('dejeuner');
  const [nbPersonnel, setNbPersonnel]       = useState('');
  const [nbPatients, setNbPatients]         = useState('');
  const [nbAccompagnants, setNbAccompagnants] = useState('');
  const [menu, setMenu]                     = useState('');
  const [cout, setCout]                     = useState('');

  useFocusEffect(
    useCallback(() => {
      // Fetch API quand disponible
      // api.get('/api/centre/refectoire', token).then(setRepas).catch(() => setRepas(DEMO_REPAS));
    }, [token]),
  );

  // Stats semaine
  const totalServis = repas.reduce((sum, r) => sum + r.nb_personnel + r.nb_patients + r.nb_accompagnants, 0);
  const totalCout   = repas.reduce((sum, r) => sum + r.cout_fc, 0);

  function enregistrer() {
    const np = parseInt(nbPersonnel, 10) || 0;
    const npat = parseInt(nbPatients, 10) || 0;
    const nacc = parseInt(nbAccompagnants, 10) || 0;
    const cfc = parseInt(cout, 10) || 0;

    if (!menu.trim()) {
      Alert.alert('Menu requis', 'Veuillez saisir le menu du repas.');
      return;
    }

    const newRepas: Repas = {
      id: `R${Date.now()}`,
      date: dateStr(0),
      type_repas: typeForm,
      nb_personnel: np,
      nb_patients: npat,
      nb_accompagnants: nacc,
      menu: menu.trim(),
      cout_fc: cfc,
    };
    setRepas(prev => [newRepas, ...prev]);
    setNbPersonnel('');
    setNbPatients('');
    setNbAccompagnants('');
    setMenu('');
    setCout('');
  }

  const groups = groupByDate(repas);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réfectoire</Text>
        <Text style={styles.headerSub}>Cantine du centre de santé</Text>

        {/* Stats semaine */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalServis}</Text>
            <Text style={styles.statLabel}>repas servis</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalCout.toLocaleString('fr-CD')}</Text>
            <Text style={styles.statLabel}>FC cette semaine</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{repas.length}</Text>
            <Text style={styles.statLabel}>services</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Formulaire saisie */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Saisie du repas</Text>

          {/* Type repas chips */}
          <View style={styles.typeRow}>
            {(Object.keys(TYPE_CONFIG) as TypeRepas[]).map(t => {
              const conf = TYPE_CONFIG[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, typeForm === t && { backgroundColor: conf.color + '22', borderColor: conf.color }]}
                  onPress={() => setTypeForm(t)}
                  activeOpacity={0.8}
                >
                  <Icon name={conf.icon} size={14} color={typeForm === t ? conf.color : colors.textMuted} />
                  <Text style={[styles.typeChipText, typeForm === t && { color: conf.color, fontWeight: fontWeight.bold }]}>
                    {conf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3 compteurs en row */}
          <View style={styles.countersRow}>
            <View style={styles.counterWrap}>
              <Icon name="user-check" size={14} color={palette.blueDeep} />
              <Text style={styles.counterLabel}>Personnel</Text>
              <TextInput
                style={styles.counterInput}
                value={nbPersonnel}
                onChangeText={setNbPersonnel}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <View style={styles.counterWrap}>
              <Icon name="users" size={14} color={palette.greenDeep} />
              <Text style={styles.counterLabel}>Patients</Text>
              <TextInput
                style={styles.counterInput}
                value={nbPatients}
                onChangeText={setNbPatients}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <View style={styles.counterWrap}>
              <Icon name="heart" size={14} color={palette.purpleDeep} />
              <Text style={styles.counterLabel}>Accompagnants</Text>
              <TextInput
                style={styles.counterInput}
                value={nbAccompagnants}
                onChangeText={setNbAccompagnants}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Menu du repas"
            placeholderTextColor={colors.placeholder}
            value={menu}
            onChangeText={setMenu}
          />
          <TextInput
            style={styles.input}
            placeholder="Coût total (FC)"
            placeholderTextColor={colors.placeholder}
            value={cout}
            onChangeText={setCout}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={enregistrer} activeOpacity={0.85}>
            <Icon name="check" size={18} color="#FFF" />
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>

        {/* Historique */}
        <Text style={styles.secLabel}>HISTORIQUE DE LA SEMAINE</Text>

        {groups.map(group => (
          <View key={group.date}>
            <Text style={styles.dateHeader}>{formatDate(group.date)}</Text>
            {group.items.map(item => {
              const conf  = TYPE_CONFIG[item.type_repas];
              const total = item.nb_personnel + item.nb_patients + item.nb_accompagnants;
              return (
                <View key={item.id} style={styles.repasCard}>
                  <View style={styles.repasTop}>
                    <View style={[styles.repasIconWrap, { backgroundColor: conf.color + '22' }]}>
                      <Icon name={conf.icon} size={18} color={conf.color} />
                    </View>
                    <View style={styles.repasInfo}>
                      <Text style={styles.repasType}>{conf.label}</Text>
                      <Text style={styles.repasMenu} numberOfLines={1}>{item.menu}</Text>
                    </View>
                    <View style={styles.repasCout}>
                      <Text style={styles.repasCoutVal}>{item.cout_fc.toLocaleString('fr-CD')}</Text>
                      <Text style={styles.repasCoutLabel}>FC</Text>
                    </View>
                  </View>
                  <View style={styles.repasCountsRow}>
                    <CounterBadge icon="user-check" val={item.nb_personnel}    label="personnel"      color={palette.blue} />
                    <CounterBadge icon="users"      val={item.nb_patients}     label="patients"       color={palette.green} />
                    <CounterBadge icon="heart"      val={item.nb_accompagnants}label="accompagnants"  color={palette.purple} />
                    <View style={styles.totalBadge}>
                      <Text style={styles.totalVal}>{total}</Text>
                      <Text style={styles.totalLabel}>total</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sous-composant CounterBadge ─────────────────────────────────────────────

function CounterBadge({ icon, val, label, color }: { icon: any; val: number; label: string; color: string }) {
  return (
    <View style={[cbStyles.root, { backgroundColor: color + '18' }]}>
      <Icon name={icon} size={12} color={color} />
      <Text style={[cbStyles.val, { color }]}>{val}</Text>
      <Text style={cbStyles.label}>{label}</Text>
    </View>
  );
}

const cbStyles = StyleSheet.create({
  root:  { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  val:   { fontSize: fontSize.xs, fontWeight: fontWeight.black },
  label: { fontSize: 10, color: colors.textMuted },
});

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
    backgroundColor: palette.amber, opacity: 0.08, top: -70, right: -40,
  },
  backBtn:     { marginBottom: spacing.sm, width: TAP_TARGET, justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm, marginTop: 2, marginBottom: spacing.lg },

  statsRow:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.lg, padding: spacing.md },
  statItem:    { flex: 1, alignItems: 'center' },
  statVal:     { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  statLabel:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs, textAlign: 'center', marginTop: 1 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.md },

  // Formulaire
  formCard: {
    backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm,
  },
  formTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textStrong, marginBottom: spacing.md },

  typeRow:       { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  typeChip:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  typeChipText:  { fontSize: 11, fontWeight: fontWeight.medium, color: colors.textMuted },

  countersRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  counterWrap:   { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  counterLabel:  { fontSize: 10, color: colors.textMuted, marginTop: 3, marginBottom: 3, textAlign: 'center' },
  counterInput:  { width: '100%', textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text, padding: 0 },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSize.sm, color: colors.text,
    backgroundColor: colors.bg, marginBottom: spacing.sm,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: palette.dark, borderRadius: radius.lg, paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  saveBtnText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  secLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted,
    letterSpacing: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.xs,
  },

  dateHeader: {
    fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text,
    marginHorizontal: spacing.lg, marginBottom: spacing.xs, marginTop: spacing.sm,
    textTransform: 'capitalize',
  },

  repasCard: {
    backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderRadius: radius.lg, padding: spacing.md, ...shadow.xs,
  },
  repasTop:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  repasIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  repasInfo:     { flex: 1 },
  repasType:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  repasMenu:     { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  repasCout:     { alignItems: 'flex-end' },
  repasCoutVal:  { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.textStrong },
  repasCoutLabel:{ fontSize: fontSize.xs, color: colors.textMuted },

  repasCountsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  totalBadge:     { marginLeft: 'auto', backgroundColor: colors.bgSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  totalVal:       { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: colors.text },
  totalLabel:     { fontSize: 10, color: colors.textMuted },
});

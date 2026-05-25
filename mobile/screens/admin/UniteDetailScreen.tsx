import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../../components/theme';
import { Icon, type IconName } from '../../components/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type Unite = {
  id: number;
  nom: string;
  type: string;
  zone: string;
  adresse: string;
  telephone: string;
  responsable_nom: string;
  statut: string;
  capacite_lits: number;
  services: string[];
  qr_code: string;
  horaires: Record<string, string>;
  stats: { consultations_mois: number; medicaments_dispenses: number; personnel_actif: number };
  created_at: string;
};

type Personnel = { id: number; utilisateur_id: number; nom: string; role: string; telephone: string; statut: string };
type StockItem  = { produit_id: number; produit_nom: string; quantite: number; dernier_mouvement: string };
type Mouvement  = { id: number; produit_nom: string; type_mouvement: string; quantite: number; motif: string; utilisateur_nom: string; scan_qr: boolean; created_at: string };

type Tab = 'infos' | 'personnel' | 'stock' | 'activite' | 'qr';


const TABS: { id: Tab; label: string; iconName: IconName }[] = [
  { id: 'infos',     label: 'Infos',     iconName: 'info'      },
  { id: 'personnel', label: 'Personnel', iconName: 'users'     },
  { id: 'stock',     label: 'Stock',     iconName: 'package'   },
  { id: 'activite',  label: 'Activité',  iconName: 'bar-chart' },
  { id: 'qr',        label: 'QR Code',   iconName: 'qr-code'   },
];

const TYPE_ICON: Record<string, IconName> = {
  dispensaire: 'hospital', clinique: 'building', centre_sante: 'cross',
  pharmacie_partenaire: 'pill', poste_sante: 'stethoscope',
};

const MOUV_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  entree:      { label: 'Entrée',      color: colors.primary,   sign: '+' },
  sortie:      { label: 'Sortie',      color: colors.pharmacie, sign: '−' },
  inventaire:  { label: 'Inventaire',  color: colors.info,      sign: '±' },
  transfert:   { label: 'Transfert',   color: colors.accent,    sign: '→' },
  peremption:  { label: 'Péremption',  color: colors.danger,    sign: '×' },
};

const SERVICES_LABELS: Record<string, string> = {
  teleconsultation: '📡 Téléconsultation',
  soins_primaires:  '🩺 Soins primaires',
  vaccinations:     '💉 Vaccinations',
  pharmacie:        '💊 Pharmacie',
  maternite:        '🤱 Maternité',
  chirurgie_mineure:'🔪 Chirurgie mineure',
  radiologie:       '🔬 Radiologie',
  conseil_medicament: '📋 Conseil médicament',
};

// ─── Screen principal ─────────────────────────────────────────────────────────

type Props = {
  route: { params: { uniteId: number; tab?: Tab } };
  navigation: any;
};

export default function UniteDetailScreen({ route, navigation }: Props) {
  const { uniteId, tab: initialTab = 'infos' } = route.params;
  const { token } = useAuth();

  const [unite,     setUnite]     = useState<Unite | null>(null);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [stock,     setStock]     = useState<StockItem[]>([]);
  const [mouvements,setMouvements]= useState<Mouvement[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Unite>>({});

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get<Unite>(`/api/unites/${uniteId}`, token),
      api.get<{ personnel: Personnel[] }>(`/api/unites/${uniteId}/personnel`, token),
      api.get<{ stock: StockItem[] }>(`/api/unites/${uniteId}/stock`, token),
      api.get<{ mouvements: Mouvement[] }>(`/api/pharmacie/mouvements?unite_id=${uniteId}`, token),
    ])
      .then(([u, p, s, m]) => {
        if (cancelled) return;
        setUnite(u);
        setPersonnel(p.personnel ?? []);
        setStock(s.stock ?? []);
        setMouvements(m.mouvements ?? []);
        setEditData({ nom: u.nom, telephone: u.telephone, adresse: u.adresse });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uniteId, token]));

  async function sauvegarderModif() {
    if (!unite) return;
    try {
      const updated = await api.put<Unite>(`/api/unites/${uniteId}`, editData, token);
      setUnite(updated);
      setEditMode(false);
      Alert.alert('Sauvegardé', 'Informations mises à jour.');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    }
  }

  if (loading || !unite) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{unite.nom}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={TYPE_ICON[unite.type] ?? 'hospital'} size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.headerSub}>{unite.type.replace(/_/g, ' ')} · {unite.zone}</Text>
            </View>
          </View>
          <View style={[styles.statutPill, { backgroundColor: unite.statut === 'actif' ? colors.primary : colors.danger }]}>
            <Text style={styles.statutPillText}>{unite.statut}</Text>
          </View>
        </View>

        {/* Métriques rapides */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{unite.stats.consultations_mois}</Text>
            <Text style={styles.metricLbl}>consult./mois</Text>
          </View>
          <View style={styles.metricDiv} />
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{unite.stats.medicaments_dispenses}</Text>
            <Text style={styles.metricLbl}>méd. dispensés</Text>
          </View>
          <View style={styles.metricDiv} />
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{unite.stats.personnel_actif}</Text>
            <Text style={styles.metricLbl}>personnel</Text>
          </View>
          {unite.capacite_lits > 0 && (
            <>
              <View style={styles.metricDiv} />
              <View style={styles.metric}>
                <Text style={styles.metricVal}>{unite.capacite_lits}</Text>
                <Text style={styles.metricLbl}>lits</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabScroll} contentContainerStyle={styles.tabContent}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.tabActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Icon name={t.iconName} size={14} color={activeTab === t.id ? colors.primaryDark : colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Corps */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* ─── TAB : Infos ─── */}
        {activeTab === 'infos' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Informations générales</Text>
              <TouchableOpacity onPress={() => setEditMode(e => !e)}>
                <Text style={styles.editLink}>{editMode ? 'Annuler' : '✏️ Modifier'}</Text>
              </TouchableOpacity>
            </View>

            {editMode ? (
              <View style={styles.editForm}>
                <Text style={styles.formLabel}>Nom de l'unité</Text>
                <TextInput
                  style={styles.formInput}
                  value={editData.nom}
                  onChangeText={v => setEditData(d => ({ ...d, nom: v }))}
                />
                <Text style={styles.formLabel}>Téléphone</Text>
                <TextInput
                  style={styles.formInput}
                  value={editData.telephone}
                  onChangeText={v => setEditData(d => ({ ...d, telephone: v }))}
                  keyboardType="phone-pad"
                />
                <Text style={styles.formLabel}>Adresse</Text>
                <TextInput
                  style={[styles.formInput, { height: 72 }]}
                  value={editData.adresse}
                  onChangeText={v => setEditData(d => ({ ...d, adresse: v }))}
                  multiline
                />
                <TouchableOpacity style={styles.saveBtn} onPress={sauvegarderModif}>
                  <Text style={styles.saveBtnText}>Sauvegarder</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoGrid}>
                <InfoRow iconName="map-pin"  label="Adresse"       value={unite.adresse} />
                <InfoRow iconName="phone"    label="Téléphone"     value={unite.telephone} />
                <InfoRow iconName="user"     label="Responsable"   value={unite.responsable_nom} />
                <InfoRow iconName="tag"      label="Type"          value={unite.type.replace(/_/g, ' ')} />
                <InfoRow iconName="calendar" label="Enregistrée"   value={new Date(unite.created_at).toLocaleDateString('fr-FR')} />
                {unite.capacite_lits > 0 && (
                  <InfoRow iconName="package" label="Capacité lits" value={`${unite.capacite_lits} lits`} />
                )}
              </View>
            )}

            {/* Horaires */}
            {Object.keys(unite.horaires).length > 0 && (
              <View style={styles.horaireCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="clock" size={14} color={colors.primaryDark} />
                  <Text style={styles.sectionTitle}>Horaires d'ouverture</Text>
                </View>
                {Object.entries(unite.horaires).map(([jour, heure]) => (
                  <View key={jour} style={styles.horaireRow}>
                    <Text style={styles.horaireJour}>{jour}</Text>
                    <Text style={styles.horaireHeure}>{heure}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Services */}
            <View style={styles.servicesCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="stethoscope" size={14} color={colors.primaryDark} />
                <Text style={styles.sectionTitle}>Services offerts</Text>
              </View>
              <View style={styles.servicesGrid}>
                {unite.services.map(s => (
                  <View key={s} style={styles.serviceItem}>
                    <Text style={styles.serviceItemText}>{SERVICES_LABELS[s] ?? s}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ─── TAB : Personnel ─── */}
        {activeTab === 'personnel' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Équipe ({personnel.length} membres)</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('QRScanner', { mode: 'scan_patient', title: 'Scanner carte personnel', returnTo: 'UniteDetail' })}
              >
                <Text style={styles.addBtnText}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {personnel.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="users" size={32} color={colors.textLight} strokeWidth={1.2} />
                <Text style={styles.emptyText}>Aucun personnel affecté</Text>
              </View>
            ) : (
              personnel.map(p => (
                <View key={p.id} style={styles.personnelCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{p.nom.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personnelNom}>{p.nom}</Text>
                    <Text style={styles.personnelRole}>{p.role} · {p.telephone}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor(p.role) + '18' }]}>
                    <Text style={[styles.roleText, { color: roleColor(p.role) }]}>{p.role}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ─── TAB : Stock ─── */}
        {activeTab === 'stock' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Stock ({stock.length} produits)</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('QRScanner', {
                  mode: 'scan_produit',
                  title: 'Scanner produit (entrée)',
                  returnTo: 'StockMouvement',
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="scan" size={13} color={colors.primaryDark} />
                  <Text style={styles.addBtnText}>Scanner entrée</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Boutons rapides mouvements */}
            <View style={styles.mouvBtnsRow}>
              <TouchableOpacity
                style={[styles.mouvBtn, { borderColor: colors.primary }]}
                onPress={() => navigation.navigate('QRScanner', { mode: 'scan_produit', title: 'Entrée de stock', returnTo: 'StockMouvement' })}
              >
                <Text style={[styles.mouvBtnText, { color: colors.primary }]}>+ Entrée stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mouvBtn, { borderColor: colors.pharmacie }]}
                onPress={() => navigation.navigate('QRScanner', { mode: 'scan_produit', title: 'Sortie de stock', returnTo: 'StockMouvement' })}
              >
                <Text style={[styles.mouvBtnText, { color: colors.pharmacie }]}>− Sortie stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mouvBtn, { borderColor: colors.info }]}
                onPress={() => navigation.navigate('QRScanner', { mode: 'scan_ordonnance', title: 'Dispenser ordonnance', returnTo: 'StockMouvement' })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="clipboard" size={13} color={colors.info} />
                  <Text style={[styles.mouvBtnText, { color: colors.info }]}>Ordonnance</Text>
                </View>
              </TouchableOpacity>
            </View>

            {stock.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="package" size={32} color={colors.textLight} strokeWidth={1.2} />
                <Text style={styles.emptyText}>Aucun stock enregistré</Text>
                <Text style={styles.emptyHint}>Utilisez le scanner QR pour enregistrer une entrée de stock.</Text>
              </View>
            ) : (
              stock.map(item => {
                const alert = item.quantite === 0 ? 'rupture' : item.quantite < 20 ? 'critique' : item.quantite < 50 ? 'faible' : 'ok';
                return (
                  <View key={item.produit_id} style={[styles.stockItem, alert === 'rupture' && styles.stockItemRupture]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stockNom}>{item.produit_nom}</Text>
                      <Text style={styles.stockDate}>Dernier mvt : {new Date(item.dernier_mouvement).toLocaleDateString('fr-FR')}</Text>
                    </View>
                    <View style={[styles.stockBadge, { backgroundColor: alertColor(alert) + '18' }]}>
                      <Text style={[styles.stockBadgeText, { color: alertColor(alert) }]}>
                        {item.quantite === 0 ? 'RUPTURE' : item.quantite}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ─── TAB : Activité ─── */}
        {activeTab === 'activite' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mouvements de stock récents</Text>
            {mouvements.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="bar-chart" size={32} color={colors.textLight} strokeWidth={1.2} />
                <Text style={styles.emptyText}>Aucun mouvement enregistré</Text>
              </View>
            ) : (
              mouvements.slice(0, 20).map(m => {
                const cfg = MOUV_CONFIG[m.type_mouvement] ?? { label: m.type_mouvement, color: colors.textMuted, sign: '·' };
                return (
                  <View key={m.id} style={styles.mouvCard}>
                    <View style={[styles.mouvSign, { backgroundColor: cfg.color + '18' }]}>
                      <Text style={[styles.mouvSignText, { color: cfg.color }]}>{cfg.sign}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mouvProduit}>{m.produit_nom}</Text>
                      <Text style={styles.mouvMeta}>
                        {cfg.label} · {m.utilisateur_nom}
                        {m.scan_qr ? ' · ⬛ QR' : ''}
                      </Text>
                      {m.motif ? <Text style={styles.mouvMotif}>{m.motif}</Text> : null}
                    </View>
                    <View style={styles.mouvQtyCol}>
                      <Text style={[styles.mouvQty, { color: cfg.color }]}>
                        {cfg.sign}{Math.abs(m.quantite)}
                      </Text>
                      <Text style={styles.mouvDate}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ─── TAB : QR Code ─── */}
        {activeTab === 'qr' && (
          <View style={[styles.section, { alignItems: 'center' }]}>
            <Text style={styles.sectionTitle}>Code QR de l'unité</Text>
            <Text style={styles.qrSubtitle}>Scanner ce code pour identifier {unite.nom}</Text>

            <View style={styles.qrContainer}>
              {/* Représentation visuelle du QR frame */}
              <View style={styles.qrFrame}>
                <View style={[styles.qrCorner, styles.qrCTL]} />
                <View style={[styles.qrCorner, styles.qrCTR]} />
                <View style={[styles.qrCorner, styles.qrCBL]} />
                <View style={[styles.qrCorner, styles.qrCBR]} />
                <View style={styles.qrInner}>
                  <Icon name="hospital" size={52} color={colors.primaryDark} strokeWidth={1.2} />
                  <Text style={styles.qrIdText}>UNITE #{unite.id}</Text>
                </View>
              </View>
            </View>

            <View style={styles.qrInfoBox}>
              <Text style={styles.qrCode}>{unite.qr_code}</Text>
              <Text style={styles.qrHint}>Format QR Kolongono standard</Text>
            </View>

            <Text style={styles.qrUsage}>Ce QR code permet de :</Text>
            <View style={styles.qrUsageList}>
              {['Identifier l\'unité lors d\'un scan', 'Déclencher une entrée/sortie de stock', 'Afficher les informations de l\'unité'].map(u => (
                <View key={u} style={styles.qrUsageItem}>
                  <Text style={styles.qrUsageDot}>•</Text>
                  <Text style={styles.qrUsageText}>{u}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function InfoRow({ iconName, label, value }: { iconName: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={iconName} size={14} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function roleColor(role: string) {
  return role === 'medecin' ? colors.primary : role === 'pharmacien' ? colors.pharmacie : role === 'responsable' ? colors.accent : colors.auxiliaire;
}

function alertColor(alert: string) {
  return alert === 'ok' ? colors.primary : alert === 'faible' ? colors.warning : colors.danger;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: { backgroundColor: colors.primaryDark, paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs, marginTop: 2 },
  statutPill:  { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statutPillText: { color: '#FFF', fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  metricsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: spacing.md },
  metric:     { flex: 1, alignItems: 'center' },
  metricVal:  { color: '#FFF', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  metricLbl:  { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs },
  metricDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  tabScroll:   { maxHeight: 48, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabContent:  { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingVertical: spacing.xs },
  tab:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  tabActive:   { backgroundColor: colors.primary },
  tabLabel:    { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.medium },
  tabLabelActive: { color: '#FFF', fontWeight: fontWeight.bold },

  body:        { flex: 1 },
  bodyContent: { padding: spacing.lg },

  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  editLink:      { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },

  infoGrid: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow.sm },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoLabel:{ width: 90, fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  infoValue:{ flex: 1, fontSize: fontSize.sm, color: colors.text },

  editForm:   { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow.sm },
  formLabel:  { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  formInput:  { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.bg },
  saveBtn:    { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText:{ color: '#FFF', fontWeight: fontWeight.black, fontSize: fontSize.md },

  horaireCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow.sm },
  horaireRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  horaireJour: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  horaireHeure:{ fontSize: fontSize.sm, color: colors.text },

  servicesCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  serviceItem:  { backgroundColor: colors.infoLight, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  serviceItemText: { fontSize: fontSize.sm, color: colors.info, fontWeight: fontWeight.medium },

  addBtn:     { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  addBtnText: { color: '#FFF', fontSize: fontSize.xs, fontWeight: fontWeight.black },

  emptyBox:  { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.textMuted, fontWeight: fontWeight.medium },
  emptyHint: { fontSize: fontSize.sm, color: colors.textLight, textAlign: 'center' },

  personnelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.sm, ...shadow.sm },
  avatarCircle:  { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText:    { color: colors.primaryDark, fontWeight: fontWeight.black, fontSize: fontSize.md },
  personnelNom:  { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  personnelRole: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  roleBadge:     { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  roleText:      { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  mouvBtnsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  mouvBtn:     { flex: 1, borderWidth: 1, borderRadius: radius.xl, paddingVertical: spacing.sm, alignItems: 'center' },
  mouvBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.black },

  stockItem:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.sm, ...shadow.sm },
  stockItemRupture: { borderWidth: 1, borderColor: colors.danger },
  stockNom:         { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  stockDate:        { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
  stockBadge:       { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  stockBadgeText:   { fontSize: fontSize.sm, fontWeight: fontWeight.black },

  mouvCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  mouvSign:      { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mouvSignText:  { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  mouvProduit:   { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  mouvMeta:      { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  mouvMotif:     { fontSize: fontSize.xs, color: colors.textLight, fontStyle: 'italic', marginTop: 1 },
  mouvQtyCol:    { alignItems: 'flex-end' },
  mouvQty:       { fontSize: fontSize.md, fontWeight: fontWeight.black },
  mouvDate:      { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },

  qrSubtitle:   { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  qrContainer:  { alignItems: 'center', marginVertical: spacing.xl },
  qrFrame: {
    width: 200, height: 200, position: 'relative',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radius.md,
  },
  qrCorner:  { position: 'absolute', width: 32, height: 32, borderColor: colors.primaryDark, borderRadius: 4 },
  qrCTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  qrCTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  qrCBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  qrCBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  qrInner:  { alignItems: 'center', gap: spacing.xs },
  qrIdText: { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: colors.primaryDark },
  qrInfoBox:{ backgroundColor: colors.primaryLight, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', width: '100%', gap: spacing.xs },
  qrCode:   { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.primaryDark, letterSpacing: 1 },
  qrHint:   { fontSize: fontSize.xs, color: colors.primary },
  qrUsage:     { fontSize: fontSize.sm, color: colors.textMuted, alignSelf: 'flex-start', marginTop: spacing.lg, fontWeight: fontWeight.medium },
  qrUsageList: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  qrUsageItem: { flexDirection: 'row', gap: spacing.sm },
  qrUsageDot:  { color: colors.primary, fontWeight: fontWeight.black },
  qrUsageText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
});

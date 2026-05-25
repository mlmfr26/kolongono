import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { api } from '../../components/api';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';
import { Icon } from '../../components/Icons';

// ─── Catalogue médicaments ────────────────────────────────────────────────────

const CATALOGUE = [
  { id: 'PROD-001', nom: 'Paracétamol 500mg',                   unite: 'boîte 20 cp',  categorie: 'Analgésiques',   ordonnance: false },
  { id: 'PROD-002', nom: 'Amoxicilline 500mg',                  unite: 'boîte 16 gél', categorie: 'Antibiotiques',  ordonnance: true  },
  { id: 'PROD-003', nom: 'Artéméther/Luméfantrine 20/120mg',    unite: 'boîte 24 cp',  categorie: 'Antipaludéens',  ordonnance: true  },
  { id: 'PROD-004', nom: 'Sérum de réhydratation orale',        unite: 'sachet',       categorie: 'Réhydratation',  ordonnance: false },
  { id: 'PROD-005', nom: 'Ciprofloxacine 500mg',                unite: 'boîte 10 cp',  categorie: 'Antibiotiques',  ordonnance: true  },
  { id: 'PROD-006', nom: 'Vitamine C 500mg',                    unite: 'boîte 20 cp',  categorie: 'Vitamines',      ordonnance: false },
  { id: 'PROD-007', nom: 'Métronidazole 250mg',                 unite: 'boîte 20 cp',  categorie: 'Antibiotiques',  ordonnance: true  },
  { id: 'PROD-008', nom: 'Ibuprofène 400mg',                    unite: 'boîte 20 cp',  categorie: 'Anti-inf.',      ordonnance: false },
  { id: 'PROD-009', nom: 'Amlodipine 5mg',                      unite: 'boîte 30 cp',  categorie: 'Cardiologie',    ordonnance: true  },
  { id: 'PROD-010', nom: 'Sulfate de zinc 20mg',                unite: 'boîte 10 cp',  categorie: 'Vitamines',      ordonnance: false },
  { id: 'PROD-011', nom: 'Fer + Acide folique',                 unite: 'boîte 30 cp',  categorie: 'Vitamines',      ordonnance: false },
  { id: 'PROD-012', nom: 'Albendazole 400mg',                   unite: 'comprimé',     categorie: 'Antiparasitaires',ordonnance: true },
];

type CartItem = {
  id: string;
  nom: string;
  unite: string;
  quantite: number;
  posologie: string;
};

type Props = { route: { params: { consultation: any } }; navigation: any };

export default function OrdonnanceDigitaleScreen({ route, navigation }: Props) {
  const { consultation }  = route.params;
  const { token }         = useAuth();

  const [diagnostic,      setDiagnostic]      = useState('');
  const [panier,          setPanier]          = useState<CartItem[]>([]);
  const [recherche,       setRecherche]       = useState('');
  const [duree,           setDuree]           = useState('');
  const [recommandations, setRecommandations] = useState('');
  const [rapport,         setRapport]         = useState('');
  const [renouvAuth,      setRenouvAuth]      = useState(false);
  const [nbRenouvMax,     setNbRenouvMax]     = useState('1');
  const [loading,         setLoading]         = useState(false);

  // ── Panier helpers ──────────────────────────────────────────────────────────

  function estDansPanier(id: string) {
    return panier.some(p => p.id === id);
  }

  function ajouterAuPanier(med: typeof CATALOGUE[0]) {
    if (estDansPanier(med.id)) return;
    setPanier(prev => [...prev, { id: med.id, nom: med.nom, unite: med.unite, quantite: 1, posologie: '' }]);
  }

  function retirerDuPanier(id: string) {
    setPanier(prev => prev.filter(p => p.id !== id));
  }

  function changerQuantite(id: string, delta: number) {
    setPanier(prev => prev.map(p =>
      p.id === id ? { ...p, quantite: Math.max(1, Math.min(10, p.quantite + delta)) } : p
    ));
  }

  function changerPosologie(id: string, posologie: string) {
    setPanier(prev => prev.map(p => p.id === id ? { ...p, posologie } : p));
  }

  // ── Emission ordonnance + déclenchement commande pharmacie ─────────────────

  async function validerOrdonnance() {
    if (!diagnostic.trim()) {
      Alert.alert('Requis', 'Veuillez saisir le diagnostic définitif.');
      return;
    }
    if (panier.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez au moins un médicament au panier.');
      return;
    }
    const sansPosologie = panier.filter(p => !p.posologie.trim());
    if (sansPosologie.length > 0) {
      Alert.alert(
        'Posologie manquante',
        `Renseignez la posologie pour : ${sansPosologie.map(p => p.nom).join(', ')}.`,
      );
      return;
    }
    if (!rapport.trim()) {
      Alert.alert('Requis', 'Veuillez rédiger le rapport de consultation.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.post<any>(
        `/api/consultations/${consultation.id}/ordonnance`,
        {
          consultation_id:  consultation.id,
          patient_id:       consultation.patient?.id,
          diagnostic,
          produits: panier.map(p => ({
            produit_id: p.id,
            nom:        p.nom,
            posologie:  p.posologie,
            quantite:   p.quantite,
          })),
          posologie:             panier.map(p => `${p.nom} — ${p.posologie}`).join('\n'),
          duree_traitement:      duree,
          recommandations,
          rapport,
          renouvellement_autorise:        renouvAuth,
          nb_renouvellements_max:         renouvAuth ? parseInt(nbRenouvMax) || 1 : 0,
        },
        token,
      );

      Alert.alert(
        'Ordonnance émise',
        `Ordonnance ${result.ordonnance_id} enregistrée.\nLa pharmacie a été notifiée automatiquement.`,
        [{ text: 'Terminer la consultation', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible d\'émettre l\'ordonnance.');
    } finally {
      setLoading(false);
    }
  }

  // ── Catalogue filtré ────────────────────────────────────────────────────────

  const catalogue = recherche.trim()
    ? CATALOGUE.filter(m => m.nom.toLowerCase().includes(recherche.toLowerCase()) || m.categorie.toLowerCase().includes(recherche.toLowerCase()))
    : CATALOGUE;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ordonnance numérique</Text>
          {consultation?.patient && (
            <Text style={styles.headerSub}>{consultation.patient.prenom} {consultation.patient.nom}</Text>
          )}
        </View>
        {panier.length > 0 && (
          <View style={styles.panierBadge}>
            <Icon name="shopping-cart" size={14} color={palette.white} />
            <Text style={styles.panierBadgeText}>{panier.length}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Diagnostic ── */}
        <Text style={styles.secTitle}>DIAGNOSTIC DÉFINITIF</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.diagInput}
            value={diagnostic}
            onChangeText={setDiagnostic}
            placeholder="ex : Paludisme simple / Infection respiratoire haute…"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* ── Catalogue médicaments ── */}
        <Text style={styles.secTitle}>CATALOGUE MÉDICAMENTS</Text>
        <View style={styles.card}>
          {/* Barre de recherche */}
          <View style={styles.searchRow}>
            <Icon name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher un médicament…"
              placeholderTextColor={colors.textLight}
            />
            {recherche.length > 0 && (
              <TouchableOpacity onPress={() => setRecherche('')}>
                <Icon name="x" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Liste du catalogue */}
          {catalogue.map(med => {
            const inCart = estDansPanier(med.id);
            return (
              <View key={med.id} style={styles.medRow}>
                <View style={styles.medInfo}>
                  <View style={styles.medNameRow}>
                    <Text style={styles.medNom}>{med.nom}</Text>
                    {med.ordonnance && (
                      <View style={styles.ordTag}>
                        <Text style={styles.ordTagText}>Ord.</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.medUnite}>{med.unite} · {med.categorie}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, inCart && styles.addBtnDone]}
                  onPress={() => inCart ? retirerDuPanier(med.id) : ajouterAuPanier(med)}
                  activeOpacity={0.8}
                >
                  {inCart
                    ? <Icon name="check" size={14} color={palette.greenDeep} />
                    : <Icon name="plus" size={14} color={palette.blueDeep} />
                  }
                  <Text style={[styles.addBtnText, inCart && styles.addBtnTextDone]}>
                    {inCart ? 'Ajouté' : 'Ajouter'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ── Panier ── */}
        {panier.length > 0 && (
          <>
            <View style={styles.panierHeader}>
              <Icon name="shopping-cart" size={14} color={palette.purpleDeep} />
              <Text style={styles.secTitle}>PANIER — {panier.length} MÉDICAMENT{panier.length > 1 ? 'S' : ''}</Text>
            </View>
            <View style={styles.card}>
              {panier.map((item, index) => (
                <View key={item.id} style={[styles.cartItem, index > 0 && styles.cartItemBorder]}>
                  {/* Nom + supprimer */}
                  <View style={styles.cartItemTop}>
                    <View style={styles.cartItemIconWrap}>
                      <Icon name="pill" size={14} color={palette.purpleDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemNom}>{item.nom}</Text>
                      <Text style={styles.cartItemUnite}>{item.unite}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cartRemoveBtn}
                      onPress={() => retirerDuPanier(item.id)}
                    >
                      <Icon name="trash-2" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>

                  {/* Contrôles quantité */}
                  <View style={styles.cartControls}>
                    <Text style={styles.cartControlLabel}>Qté :</Text>
                    <View style={styles.qteRow}>
                      <TouchableOpacity
                        style={styles.qteBtn}
                        onPress={() => changerQuantite(item.id, -1)}
                        disabled={item.quantite <= 1}
                      >
                        <Icon name="minus" size={12} color={item.quantite <= 1 ? colors.textLight : colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qteVal}>{item.quantite}</Text>
                      <TouchableOpacity
                        style={styles.qteBtn}
                        onPress={() => changerQuantite(item.id, +1)}
                        disabled={item.quantite >= 10}
                      >
                        <Icon name="plus" size={12} color={item.quantite >= 10 ? colors.textLight : colors.text} />
                      </TouchableOpacity>
                    </View>

                    {/* Posologie */}
                    <TextInput
                      style={styles.posologieInput}
                      value={item.posologie}
                      onChangeText={v => changerPosologie(item.id, v)}
                      placeholder="Posologie (ex : 1 cp matin/soir · 5j)"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Instructions ── */}
        <Text style={styles.secTitle}>INSTRUCTIONS</Text>
        <View style={styles.card}>
          <FieldLabel>Durée du traitement</FieldLabel>
          <TextInput
            style={styles.shortInput}
            value={duree}
            onChangeText={setDuree}
            placeholder="ex : 5 jours, 1 semaine…"
            placeholderTextColor={colors.textLight}
          />
          <FieldLabel>Recommandations au patient</FieldLabel>
          <TextInput
            style={styles.textarea}
            value={recommandations}
            onChangeText={setRecommandations}
            placeholder="Repos, hydratation, alimentation, suivi…"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Renouvellement */}
          <View style={styles.renouvRow}>
            <TouchableOpacity
              style={styles.renouvToggle}
              onPress={() => setRenouvAuth(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.renouvCheck, renouvAuth && styles.renouvCheckOn]}>
                {renouvAuth && <Icon name="check" size={10} color={palette.white} />}
              </View>
              <Text style={styles.renouvLabel}>Autoriser le renouvellement par l'auxiliaire</Text>
            </TouchableOpacity>
            {renouvAuth && (
              <View style={styles.renouvNbRow}>
                <Text style={styles.renouvNbLabel}>Max.</Text>
                {['1','2','3'].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.renouvNbChip, nbRenouvMax === n && styles.renouvNbChipOn]}
                    onPress={() => setNbRenouvMax(n)}
                  >
                    <Text style={[styles.renouvNbText, nbRenouvMax === n && styles.renouvNbTextOn]}>{n}</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.renouvNbLabel}>renouvellement{parseInt(nbRenouvMax) > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Rapport de consultation ── */}
        <Text style={styles.secTitle}>RAPPORT DE CONSULTATION</Text>
        <View style={styles.card}>
          <Text style={styles.rapportHint}>
            Compte rendu détaillé à destination des prochains praticiens :
          </Text>
          <TextInput
            style={[styles.textarea, { minHeight: 110 }]}
            value={rapport}
            onChangeText={setRapport}
            placeholder="Anamnèse, examen clinique, résultats TDR, évolution attendue, suivi recommandé…"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* ── Bouton Valider ── */}
        <TouchableOpacity
          style={[styles.validerBtn, (loading || panier.length === 0) && styles.validerDisabled]}
          onPress={validerOrdonnance}
          activeOpacity={0.85}
          disabled={loading || panier.length === 0}
        >
          {loading ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <>
              <Icon name="check-circle" size={20} color={palette.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.validerBtnTitle}>Valider l'ordonnance</Text>
                {panier.length > 0 && (
                  <Text style={styles.validerBtnSub}>
                    {panier.length} médicament{panier.length > 1 ? 's' : ''} · commande pharmacie automatique
                  </Text>
                )}
              </View>
              <Icon name="arrow-right" size={16} color="rgba(255,255,255,0.7)" />
            </>
          )}
        </TouchableOpacity>

        {panier.length === 0 && (
          <Text style={styles.panierEmpty}>Ajoutez des médicaments au panier pour valider</Text>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: palette.dark,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { color: palette.white, fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSub:   { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.sm, marginTop: 3 },
  panierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.purpleDeep, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 },
  panierBadgeText: { color: palette.white, fontSize: fontSize.sm, fontWeight: fontWeight.black },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },

  secTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  card:     { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.md },

  diagInput: {
    minHeight: 68,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },

  // Catalogue
  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  searchInput:{ flex: 1, fontSize: fontSize.sm, color: colors.text },

  medRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  medInfo:    { flex: 1 },
  medNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  medNom:     { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  medUnite:   { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  ordTag:     { backgroundColor: '#FEF3C7', borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  ordTagText: { fontSize: 9, fontWeight: fontWeight.black, color: '#92400E' },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.blueSoft, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  addBtnDone: { backgroundColor: palette.greenSoft },
  addBtnText:     { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: palette.blueDeep },
  addBtnTextDone: { color: palette.greenDeep },

  // Panier
  panierHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.sm },

  cartItem:       { paddingVertical: spacing.md },
  cartItemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  cartItemTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  cartItemIconWrap:{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: palette.purpleSoft, justifyContent: 'center', alignItems: 'center' },
  cartItemNom:    { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  cartItemUnite:  { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  cartRemoveBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' },

  cartControls:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cartControlLabel:{ fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold },
  qteRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 4 },
  qteBtn:         { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  qteVal:         { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.text, minWidth: 20, textAlign: 'center' },
  posologieInput: { flex: 1, minWidth: 180, height: 36, backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.sm, color: colors.text },

  // Instructions
  shortInput: { height: 44, backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, fontSize: fontSize.md, color: colors.text },
  textarea:   { minHeight: 80, backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: fontSize.md, color: colors.text },

  // Renouvellement
  renouvRow:       { marginTop: spacing.md },
  renouvToggle:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  renouvCheck:     { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  renouvCheckOn:   { backgroundColor: palette.greenDeep, borderColor: palette.greenDeep },
  renouvLabel:     { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium, flex: 1 },
  renouvNbRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, marginLeft: 28 },
  renouvNbLabel:   { fontSize: fontSize.xs, color: colors.textMuted },
  renouvNbChip:    { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  renouvNbChipOn:  { backgroundColor: palette.greenDeep, borderColor: palette.greenDeep },
  renouvNbText:    { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  renouvNbTextOn:  { color: palette.white },

  rapportHint: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm, lineHeight: 18 },

  // Bouton Valider
  validerBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: palette.greenDeep,
    borderRadius: radius.xl, padding: spacing.lg, ...shadow.lg, marginBottom: spacing.sm,
  },
  validerDisabled: { opacity: 0.5 },
  validerBtnTitle: { color: palette.white, fontSize: fontSize.md, fontWeight: fontWeight.black },
  validerBtnSub:   { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs, marginTop: 2 },
  panierEmpty:     { textAlign: 'center', color: colors.textLight, fontSize: fontSize.xs, marginBottom: spacing.md },
});

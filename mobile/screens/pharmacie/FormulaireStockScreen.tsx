/**
 * Formulaire de quantité affiché après un scan réussi.
 * Gère entrées (réception) et sorties (dispensation / perte).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../components/theme';
import { apiClient } from '../../components/api';

const MOTIFS_SORTIE = [
  { key: 'ordonnance',  label: 'Ordonnance SD' },
  { key: 'urgence',    label: 'Urgence / sans ordo' },
  { key: 'perime',     label: 'Périmé' },
  { key: 'casse',      label: 'Casse / perte' },
  { key: 'transfert',  label: 'Transfert inter-centre' },
];

interface Medicament {
  code_interne: string;
  ean?: string;
  nom: string;
  dosage?: string;
  forme?: string;
  unite_boite?: number;
  prix_unitaire?: number;
}

interface Props {
  route: {
    params: {
      medicament: Medicament;
      mode: 'entree' | 'sortie';
      centreId: string;
      operateur: string;
      codeScanne?: string;
    };
  };
}

export default function FormulaireStockScreen({ route }: Props) {
  const { medicament, mode, centreId, operateur } = route.params;
  const navigation = useNavigation<any>();

  const [quantite, setQuantite] = useState('1');
  const [motif, setMotif] = useState(MOTIFS_SORTIE[0].key);
  const [reference, setReference] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [numeroLot, setNumeroLot] = useState('');
  const [datePeremption, setDatePeremption] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const qte = parseInt(quantite) || 0;
  const isValid = qte > 0;

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Quantité invalide', 'Saisissez une quantité supérieure à 0.');
      return;
    }
    setSaving(true);
    try {
      const codeField = medicament.ean
        ? { ean: medicament.ean }
        : { code_interne: medicament.code_interne };

      if (mode === 'entree') {
        await apiClient.post('/api/pharmacie/stock/entree', {
          centre_id: centreId,
          ...codeField,
          quantite: qte,
          date_peremption: datePeremption?.toISOString().slice(0, 10) || null,
          numero_lot: numeroLot || null,
          fournisseur: fournisseur || null,
          operateur,
        });

        Alert.alert(
          'Stock mis à jour',
          `+${qte} ${medicament.nom} ${medicament.dosage || ''} réceptionnés.`,
          [
            { text: 'Scanner un autre', onPress: () => navigation.goBack() },
            { text: 'Terminer', onPress: () => navigation.navigate('Main') },
          ]
        );
      } else {
        const { data } = await apiClient.post('/api/pharmacie/stock/sortie', {
          centre_id: centreId,
          ...codeField,
          quantite: qte,
          motif,
          reference: reference || null,
          operateur,
        });

        const alertMsg = data.alerte
          ? `⚠️ Stock restant : ${data.stock_restant} — sous le seuil d'alerte.`
          : `Stock restant : ${data.stock_restant}`;

        Alert.alert('Sortie enregistrée', alertMsg, [
          { text: 'Scanner un autre', onPress: () => navigation.goBack() },
          { text: 'Terminer', onPress: () => navigation.navigate('Main') },
        ]);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Erreur réseau — réessayez.';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Fiche médicament */}
        <View style={[styles.medCard, mode === 'entree' ? styles.medCardGreen : styles.medCardAmber]}>
          <View style={[styles.modePill, mode === 'entree' ? styles.pillGreen : styles.pillAmber]}>
            <Text style={styles.modePillText}>
              {mode === 'entree' ? '↑ ENTRÉE STOCK' : '↓ SORTIE STOCK'}
            </Text>
          </View>
          <Text style={styles.medNom}>{medicament.nom}</Text>
          <Text style={styles.medDetail}>
            {[medicament.dci, medicament.dosage, medicament.forme]
              .filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.medCode}>{medicament.code_interne}</Text>
        </View>

        {/* Quantité */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Quantité *</Text>
          <View style={styles.qteRow}>
            <TouchableOpacity
              style={styles.qteBtn}
              onPress={() => setQuantite(String(Math.max(1, qte - 1)))}
            >
              <Text style={styles.qteBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.qteInput}
              value={quantite}
              onChangeText={v => setQuantite(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              textAlign="center"
            />
            <TouchableOpacity
              style={styles.qteBtn}
              onPress={() => setQuantite(String(qte + 1))}
            >
              <Text style={styles.qteBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {medicament.unite_boite && medicament.unite_boite > 1 && (
            <Text style={styles.qteNote}>
              = {qte * medicament.unite_boite} unités individuelles
            </Text>
          )}
        </View>

        {/* Champs spécifiques ENTRÉE */}
        {mode === 'entree' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Détails de la réception</Text>

            <Text style={styles.fieldLabel}>Fournisseur</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : CAMEG, MSF, Commande locale..."
              value={fournisseur}
              onChangeText={setFournisseur}
            />

            <Text style={styles.fieldLabel}>Numéro de lot</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : LC2024B"
              value={numeroLot}
              onChangeText={setNumeroLot}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Date de péremption</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dateBtnText, !datePeremption && { color: theme.colors.textMuted }]}>
                {datePeremption
                  ? datePeremption.toLocaleDateString('fr-CD')
                  : 'Sélectionner la date de péremption'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={datePeremption || new Date()}
                mode="date"
                minimumDate={new Date()}
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDatePeremption(d); }}
              />
            )}
          </View>
        )}

        {/* Champs spécifiques SORTIE */}
        {mode === 'sortie' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Motif de sortie</Text>
            {MOTIFS_SORTIE.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.motifRow, motif === m.key && styles.motifActive]}
                onPress={() => setMotif(m.key)}
              >
                <View style={[styles.radio, motif === m.key && styles.radioActive]} />
                <Text style={[styles.motifLabel, motif === m.key && styles.motifLabelActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}

            {motif === 'ordonnance' && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Référence ordonnance</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex : ORD-042 ou nom du patient"
                  value={reference}
                  onChangeText={setReference}
                />
              </>
            )}
          </View>
        )}

        {/* Valeur estimée */}
        {medicament.prix_unitaire && (
          <View style={styles.valeurRow}>
            <Text style={styles.valeurLabel}>Valeur estimée</Text>
            <Text style={styles.valeurVal}>
              {(qte * medicament.prix_unitaire).toFixed(2)} $
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnPrimary, !isValid && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>
                {mode === 'entree' ? 'Confirmer la réception' : 'Confirmer la sortie'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnSecondaryText}>Annuler</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48 },

  medCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  medCardGreen: { backgroundColor: '#D1FAE5' },
  medCardAmber: { backgroundColor: '#FEF3C7' },
  modePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  pillGreen: { backgroundColor: '#059669' },
  pillAmber: { backgroundColor: '#D97706' },
  modePillText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  medNom: { fontSize: 20, fontWeight: '900', color: theme.colors.text, marginBottom: 4 },
  medDetail: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 6 },
  medCode: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 4 },

  qteRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qteBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  qteBtnText: { fontSize: 22, fontWeight: '300', color: theme.colors.text, lineHeight: 26 },
  qteInput: { flex: 1, fontSize: 28, fontWeight: '900', color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 12, padding: 10 },
  qteNote: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6, textAlign: 'center' },

  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.background, marginBottom: 4 },

  dateBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, backgroundColor: theme.colors.background },
  dateBtnText: { fontSize: 15, color: theme.colors.text },

  motifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, marginBottom: 6 },
  motifActive: { backgroundColor: theme.colors.blueSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.border },
  radioActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  motifLabel: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  motifLabelActive: { color: theme.colors.primary, fontWeight: '800' },

  valeurRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  valeurLabel: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  valeurVal: { fontSize: 18, fontWeight: '900', color: theme.colors.text },

  btnPrimary: { backgroundColor: theme.colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.45 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnSecondary: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnSecondaryText: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '600' },
});

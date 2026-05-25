/**
 * Formulaire affiché quand un EAN/QR scanné est inconnu.
 * L'agent saisit les infos du médicament une seule fois —
 * la référence est ensuite enregistrée et les scans suivants
 * sont instantanés.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../components/theme';
import { apiClient } from '../../components/api';

type Forme = 'comprimé' | 'gélule' | 'sirop' | 'injectable' | 'pommade' | 'sachet' | 'autre';
type Categorie =
  | 'Antipaludéen' | 'Antibiotique' | 'Antalgique / Antipyrétique'
  | 'Anti-inflammatoire' | 'Antihypertenseur' | 'Antidiabétique'
  | 'Corticoïde' | 'Vitamines / Suppléments' | 'Soluté de perfusion'
  | 'Obstétrique' | 'Antiparasitaire' | 'Diagnostic' | 'Consommable médical' | 'Autre';

const FORMES: Forme[] = ['comprimé', 'gélule', 'sirop', 'injectable', 'pommade', 'sachet', 'autre'];
const CATEGORIES: Categorie[] = [
  'Antipaludéen', 'Antibiotique', 'Antalgique / Antipyrétique',
  'Anti-inflammatoire', 'Antihypertenseur', 'Antidiabétique',
  'Corticoïde', 'Vitamines / Suppléments', 'Soluté de perfusion',
  'Obstétrique', 'Antiparasitaire', 'Diagnostic', 'Consommable médical', 'Autre',
];

interface Props {
  route: {
    params: {
      codeScanne: string | null;
      typeCode: 'ean' | 'qr' | 'manuel';
      mode: 'entree' | 'sortie';
      centreId: string;
      operateur: string;
    };
  };
}

export default function MedicamentInconnuScreen({ route }: Props) {
  const { codeScanne, typeCode, mode, centreId, operateur } = route.params;
  const navigation = useNavigation<any>();

  const [nom, setNom] = useState('');
  const [dci, setDci] = useState('');
  const [dosage, setDosage] = useState('');
  const [fabricant, setFabricant] = useState('');
  const [forme, setForme] = useState<Forme>('comprimé');
  const [categorie, setCategorie] = useState<Categorie>('Antibiotique');
  const [uniteBoite, setUniteBoite] = useState('1');
  const [prixUsd, setPrixUsd] = useState('');
  const [prescription, setPrescription] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValid = nom.trim().length >= 2;

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Champ requis', 'Le nom du médicament est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ean: typeCode === 'ean' ? codeScanne : null,
        code_interne: typeCode === 'qr' ? codeScanne : null,
        nom: nom.trim(),
        dci: dci.trim() || null,
        dosage: dosage.trim() || null,
        fabricant: fabricant.trim() || null,
        forme,
        categorie,
        unite_boite: parseInt(uniteBoite) || 1,
        prix_usd: prixUsd ? parseFloat(prixUsd) : null,
        prescription,
        source: typeCode === 'ean' ? 'scan_ean' : typeCode === 'qr' ? 'scan_qr' : 'manuel',
        cree_par: centreId,
      };

      const { data: medicament } = await apiClient.post('/api/pharmacie/ean', payload);

      Alert.alert(
        'Médicament enregistré',
        `"${medicament.nom}" (${medicament.code_interne}) ajouté à la base.\nLes prochains scans seront instantanés.`,
        [
          {
            text: 'Continuer vers le stock',
            onPress: () =>
              navigation.replace('FormulaireStockScreen', {
                medicament,
                mode,
                centreId,
                operateur,
                codeScanne,
              }),
          },
        ]
      );
    } catch (error: any) {
      if (error?.response?.status === 409) {
        Alert.alert('Déjà enregistré', 'Ce code est déjà dans la base. Rechargez le scanner.');
      } else {
        Alert.alert('Erreur', 'Impossible d\'enregistrer. Vérifiez la connexion.');
      }
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

        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>Médicament inconnu</Text>
          <Text style={styles.sub}>
            {codeScanne
              ? `Code scanné : ${codeScanne} (${typeCode.toUpperCase()})`
              : 'Saisie manuelle'}
          </Text>
          <Text style={styles.info}>
            Complétez ces informations une seule fois. Ce médicament sera reconnu automatiquement lors des prochains scans.
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.card}>

          <Field label="Nom commercial *" required>
            <TextInput
              style={styles.input}
              placeholder="Ex : Coartem, Amoxicilline..."
              value={nom}
              onChangeText={setNom}
              autoFocus
            />
          </Field>

          <Field label="DCI (nom générique)">
            <TextInput
              style={styles.input}
              placeholder="Ex : Artéméther + Luméfantrine"
              value={dci}
              onChangeText={setDci}
            />
          </Field>

          <Field label="Dosage">
            <TextInput
              style={styles.input}
              placeholder="Ex : 500mg, 80mg/480mg, 250mg/5ml"
              value={dosage}
              onChangeText={setDosage}
            />
          </Field>

          <Field label="Fabricant">
            <TextInput
              style={styles.input}
              placeholder="Ex : Novartis, Générique..."
              value={fabricant}
              onChangeText={setFabricant}
            />
          </Field>

          <Field label="Forme pharmaceutique">
            <View style={styles.chipRow}>
              {FORMES.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, forme === f && styles.chipActive]}
                  onPress={() => setForme(f)}
                >
                  <Text style={[styles.chipText, forme === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Catégorie thérapeutique">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, categorie === c && styles.chipActive]}
                    onPress={() => setCategorie(c)}
                  >
                    <Text style={[styles.chipText, categorie === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Unités / boîte">
                <TextInput
                  style={styles.input}
                  placeholder="Ex : 24"
                  keyboardType="numeric"
                  value={uniteBoite}
                  onChangeText={setUniteBoite}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Prix unitaire ($)">
                <TextInput
                  style={styles.input}
                  placeholder="Ex : 4.50"
                  keyboardType="decimal-pad"
                  value={prixUsd}
                  onChangeText={setPrixUsd}
                />
              </Field>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Sur ordonnance uniquement</Text>
            <Switch
              value={prescription}
              onValueChange={setPrescription}
              trackColor={{ true: theme.colors.primary }}
              thumbColor={prescription ? '#fff' : '#f4f3f4'}
            />
          </View>

        </View>

        {/* Boutons */}
        <TouchableOpacity
          style={[styles.btnPrimary, !isValid && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!isValid || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>Enregistrer et continuer</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnSecondaryText}>Annuler — rescanner</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={fieldStyles.label}>
        {label}
        {required && <Text style={{ color: '#EF4444' }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48 },

  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 4 },
  sub: { fontSize: 12, fontWeight: '600', color: theme.colors.primary, marginBottom: 8 },
  info: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18, backgroundColor: theme.colors.blueSoft, padding: 12, borderRadius: 10 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },

  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.background },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: '#fff' },

  row: { flexDirection: 'row', gap: 12 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  switchLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },

  btnPrimary: { backgroundColor: theme.colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.45 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnSecondary: { borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  btnSecondaryText: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '600' },
});

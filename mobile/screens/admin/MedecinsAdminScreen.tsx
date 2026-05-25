import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Pressable,
} from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../../components/theme';

// ─── Données médecins partenaires ────────────────────────────────────────────
// salaire_usd = salaire mensuel fixe — jamais à la consultation
// jours = jours de disponibilité (1=lun … 7=dim)

type Medecin = {
  id: string; nom: string; prenom?: string;
  specialite: string; pays: string; ville: string;
  operateur_mm: string; salaire_usd: number;
  jours: number[]; heure_debut: string; heure_fin: string;
  consult_mois: number; statut: 'actif' | 'inactif';
};

const MEDECINS: Medecin[] = [
  // ── Kinshasa (CD) ──────────────────────────────────────────────────────────
  { id:'MED-K01', nom:'LUKUSA',     prenom:'Emmanuel',  specialite:'Médecine générale',      pays:'CD', ville:'Kinshasa',   operateur_mm:'M-Pesa',         salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:47, statut:'actif' },
  { id:'MED-K02', nom:'MWAMBA',     prenom:'Béatrice',  specialite:'Pédiatrie',              pays:'CD', ville:'Kinshasa',   operateur_mm:'Orange Money CD', salaire_usd:240, jours:[1,2,3,4,5],   heure_debut:'09:00', heure_fin:'13:00', consult_mois:38, statut:'actif' },
  { id:'MED-K03', nom:'TSHIMANGA',  prenom:'Sylvain',   specialite:'Médecine générale',      pays:'CD', ville:'Kinshasa',   operateur_mm:'Airtel Money',    salaire_usd:220, jours:[1,3,5],       heure_debut:'10:00', heure_fin:'14:00', consult_mois:22, statut:'actif' },
  { id:'MED-K04', nom:'KASONGO',    prenom:'Esther',    specialite:'Psychiatrie',            pays:'CD', ville:'Kinshasa',   operateur_mm:'Orange Money CD', salaire_usd:270, jours:[2,4],         heure_debut:'08:00', heure_fin:'12:00', consult_mois:15, statut:'actif' },
  { id:'MED-K05', nom:'NGANDU',     prenom:'Célestin',  specialite:'Cardiologie',            pays:'CD', ville:'Kinshasa',   operateur_mm:'M-Pesa',         salaire_usd:280, jours:[1,2,3,4,5],   heure_debut:'07:30', heure_fin:'11:30', consult_mois:31, statut:'actif' },
  { id:'MED-K06', nom:'MBALA',      prenom:'Agnès',     specialite:'Gynécologie-Obstétrique',pays:'CD', ville:'Kinshasa',   operateur_mm:'Orange Money CD', salaire_usd:270, jours:[1,2,3,4,5,6], heure_debut:'08:00', heure_fin:'12:00', consult_mois:29, statut:'actif' },
  { id:'MED-K07', nom:'LUBOYA',     prenom:'Victor',    specialite:'Dermatologie',           pays:'CD', ville:'Kinshasa',   operateur_mm:'M-Pesa',         salaire_usd:250, jours:[2,4,6],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:18, statut:'actif' },
  { id:'MED-K08', nom:'KALUMBA',    prenom:'Rose',      specialite:'Médecine interne',       pays:'CD', ville:'Kinshasa',   operateur_mm:'Airtel Money',    salaire_usd:250, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:24, statut:'actif' },
  { id:'MED-K09', nom:'NZINGA',     prenom:'Patrice',   specialite:'Chirurgie générale',     pays:'CD', ville:'Kinshasa',   operateur_mm:'Orange Money CD', salaire_usd:280, jours:[1,3,5],       heure_debut:'07:00', heure_fin:'11:00', consult_mois:12, statut:'actif' },
  { id:'MED-K10', nom:'ILUNGA',     prenom:'Joséphine', specialite:'Ophtalmologie',          pays:'CD', ville:'Kinshasa',   operateur_mm:'M-Pesa',         salaire_usd:260, jours:[2,4],         heure_debut:'09:00', heure_fin:'13:00', consult_mois:8,  statut:'actif' },
  { id:'MED-K11', nom:'MUTOMBO',    prenom:'André',     specialite:'Médecine générale',      pays:'CD', ville:'Kinshasa',   operateur_mm:'Orange Money CD', salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'10:00', heure_fin:'14:00', consult_mois:33, statut:'actif' },
  { id:'MED-K12', nom:'KABILA',     prenom:'Claudette', specialite:'Endocrinologie',         pays:'CD', ville:'Kinshasa',   operateur_mm:'Airtel Money',    salaire_usd:260, jours:[1,3],         heure_debut:'08:00', heure_fin:'12:00', consult_mois:6,  statut:'actif' },
  { id:'MED-K13', nom:'BANZA',      prenom:'Théodore',  specialite:'Neurologie',             pays:'CD', ville:'Kinshasa',   operateur_mm:'M-Pesa',         salaire_usd:270, jours:[2,4,6],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:19, statut:'actif' },
  // ── Lubumbashi (CD) ────────────────────────────────────────────────────────
  { id:'MED-L01', nom:'KABAMBA',    prenom:'Godefroid', specialite:'Médecine générale',      pays:'CD', ville:'Lubumbashi', operateur_mm:'Orange Money CD', salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:28, statut:'actif' },
  { id:'MED-L02', nom:'MULUMBA',    prenom:'Thérèse',   specialite:'Pédiatrie',              pays:'CD', ville:'Lubumbashi', operateur_mm:'M-Pesa',         salaire_usd:240, jours:[1,2,3,4,5],   heure_debut:'09:00', heure_fin:'13:00', consult_mois:17, statut:'actif' },
  { id:'MED-L03', nom:'TSHIMUANGA', prenom:'Pascal',    specialite:'Médecine interne',       pays:'CD', ville:'Lubumbashi', operateur_mm:'Airtel Money',    salaire_usd:250, jours:[2,4],         heure_debut:'08:00', heure_fin:'12:00', consult_mois:11, statut:'actif' },
  { id:'MED-L04', nom:'MBUYI',      prenom:'Chantal',   specialite:'Gynécologie',            pays:'CD', ville:'Lubumbashi', operateur_mm:'Orange Money CD', salaire_usd:270, jours:[1,3,5],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:9,  statut:'actif' },
  { id:'MED-L05', nom:'KAZADI',     prenom:'Romuald',   specialite:'Médecine générale',      pays:'CD', ville:'Lubumbashi', operateur_mm:'M-Pesa',         salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'07:30', heure_fin:'11:30', consult_mois:22, statut:'actif' },
  // ── Goma / Bukavu / Mbuji-Mayi (CD) ───────────────────────────────────────
  { id:'MED-G01', nom:'BULAMBO',    prenom:'Dieudonné', specialite:'Médecine générale',      pays:'CD', ville:'Goma',       operateur_mm:'M-Pesa',         salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:14, statut:'actif' },
  { id:'MED-G02', nom:'KYUNGU',     prenom:'Julienne',  specialite:'Pédiatrie',              pays:'CD', ville:'Goma',       operateur_mm:'Orange Money CD', salaire_usd:240, jours:[1,3,5],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:9,  statut:'actif' },
  { id:'MED-G03', nom:'MAKELELE',   prenom:'Fiston',    specialite:'Chirurgie',              pays:'CD', ville:'Goma',       operateur_mm:'Airtel Money',    salaire_usd:280, jours:[2,4],         heure_debut:'07:00', heure_fin:'11:00', consult_mois:5,  statut:'actif' },
  { id:'MED-B01', nom:'BAHATI',     prenom:'Honoré',    specialite:'Médecine générale',      pays:'CD', ville:'Bukavu',     operateur_mm:'M-Pesa',         salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:11, statut:'actif' },
  { id:'MED-B02', nom:'NTABOBA',    prenom:'Yvonne',    specialite:'Gynécologie',            pays:'CD', ville:'Bukavu',     operateur_mm:'Orange Money CD', salaire_usd:270, jours:[2,4,6],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:7,  statut:'actif' },
  { id:'MED-M01', nom:'TSHIBOLA',   prenom:'Alphonse',  specialite:'Médecine générale',      pays:'CD', ville:'Mbuji-Mayi', operateur_mm:'Airtel Money',   salaire_usd:220, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:16, statut:'actif' },
  { id:'MED-M02', nom:'KABONGO',    prenom:'Marie-Thérèse', specialite:'Pédiatrie',         pays:'CD', ville:'Mbuji-Mayi', operateur_mm:'Orange Money CD', salaire_usd:240, jours:[1,3,5],      heure_debut:'09:00', heure_fin:'13:00', consult_mois:12, statut:'actif' },
  { id:'MED-M03', nom:'KABUYA',     prenom:'Gaston',    specialite:'Médecine interne',       pays:'CD', ville:'Mbuji-Mayi', operateur_mm:'M-Pesa',         salaire_usd:250, jours:[2,4],         heure_debut:'08:00', heure_fin:'12:00', consult_mois:8,  statut:'actif' },
  { id:'MED-M04', nom:'TSHILOMBO',  prenom:'Christiane',specialite:'Gynécologie',            pays:'CD', ville:'Mbuji-Mayi', operateur_mm:'Airtel Money',   salaire_usd:270, jours:[1,3],         heure_debut:'09:00', heure_fin:'13:00', consult_mois:5,  statut:'actif' },
  // ── France ────────────────────────────────────────────────────────────────
  { id:'MED-P01', nom:'DUPONT',     prenom:'Pierre',    specialite:'Médecine générale',      pays:'FR', ville:'Paris',      operateur_mm:'Orange Money FR', salaire_usd:280, jours:[6,7],         heure_debut:'14:00', heure_fin:'18:00', consult_mois:23, statut:'actif' },
  { id:'MED-P02', nom:'MARTIN',     prenom:'Sophie',    specialite:'Pédiatrie',              pays:'FR', ville:'Paris',      operateur_mm:'Orange Money FR', salaire_usd:300, jours:[6,7],         heure_debut:'10:00', heure_fin:'14:00', consult_mois:19, statut:'actif' },
  { id:'MED-P03', nom:'LEROY',      prenom:'Marc',      specialite:'Médecine interne',       pays:'FR', ville:'Paris',      operateur_mm:'Orange Money FR', salaire_usd:300, jours:[6],           heure_debut:'09:00', heure_fin:'13:00', consult_mois:11, statut:'actif' },
  { id:'MED-P04', nom:'GIRARD',     prenom:'Amélie',    specialite:'Dermatologie',           pays:'FR', ville:'Paris',      operateur_mm:'Orange Money FR', salaire_usd:300, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:7,  statut:'actif' },
  { id:'MED-P05', nom:'MOREAU',     prenom:'Jean-Paul', specialite:'Cardiologie',            pays:'FR', ville:'Paris',      operateur_mm:'Orange Money FR', salaire_usd:320, jours:[6,7],         heure_debut:'08:00', heure_fin:'12:00', consult_mois:14, statut:'actif' },
  { id:'MED-LY1', nom:'FONTAINE',   prenom:'Nathalie',  specialite:'Médecine générale',      pays:'FR', ville:'Lyon',       operateur_mm:'Orange Money FR', salaire_usd:280, jours:[6],           heure_debut:'14:00', heure_fin:'18:00', consult_mois:8,  statut:'actif' },
  { id:'MED-LY2', nom:'BERNARD',    prenom:'François',  specialite:'Psychiatrie',            pays:'FR', ville:'Lyon',       operateur_mm:'Orange Money FR', salaire_usd:300, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:6,  statut:'actif' },
  { id:'MED-LY3', nom:'THOMAS',     prenom:'Claire',    specialite:'Gynécologie',            pays:'FR', ville:'Lyon',       operateur_mm:'Orange Money FR', salaire_usd:300, jours:[6,7],         heure_debut:'09:00', heure_fin:'13:00', consult_mois:10, statut:'actif' },
  { id:'MED-MA1', nom:'LEFEBVRE',   prenom:'Antoine',   specialite:'Médecine générale',      pays:'FR', ville:'Marseille',  operateur_mm:'Orange Money FR', salaire_usd:280, jours:[6],           heure_debut:'14:00', heure_fin:'18:00', consult_mois:9,  statut:'actif' },
  { id:'MED-MA2', nom:'ROBERT',     prenom:'Isabelle',  specialite:'Pédiatrie',              pays:'FR', ville:'Marseille',  operateur_mm:'Orange Money FR', salaire_usd:300, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:5,  statut:'actif' },
  { id:'MED-BO1', nom:'PETIT',      prenom:'Thomas',    specialite:'Médecine générale',      pays:'FR', ville:'Bordeaux',   operateur_mm:'Orange Money FR', salaire_usd:280, jours:[6],           heure_debut:'15:00', heure_fin:'19:00', consult_mois:7,  statut:'actif' },
  { id:'MED-BO2', nom:'DUBOIS',     prenom:'Élise',     specialite:'Médecine interne',       pays:'FR', ville:'Bordeaux',   operateur_mm:'Orange Money FR', salaire_usd:300, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:4,  statut:'actif' },
  { id:'MED-TO1', nom:'RICHARD',    prenom:'Nicolas',   specialite:'Médecine générale',      pays:'FR', ville:'Toulouse',   operateur_mm:'Orange Money FR', salaire_usd:280, jours:[6],           heure_debut:'14:00', heure_fin:'18:00', consult_mois:6,  statut:'actif' },
  { id:'MED-ST1', nom:'LAURENT',    prenom:'Camille',   specialite:'Pédiatrie',              pays:'FR', ville:'Strasbourg', operateur_mm:'Orange Money FR', salaire_usd:300, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:3,  statut:'actif' },
  // ── Belgique ──────────────────────────────────────────────────────────────
  { id:'MED-BR1', nom:'DUPUIS',     prenom:'Michel',    specialite:'Médecine générale',      pays:'BE', ville:'Bruxelles',  operateur_mm:'Orange Money BE', salaire_usd:280, jours:[6,7],         heure_debut:'14:00', heure_fin:'18:00', consult_mois:12, statut:'actif' },
  { id:'MED-BR2', nom:'PEETERS',    prenom:'Véronique', specialite:'Pédiatrie',              pays:'BE', ville:'Bruxelles',  operateur_mm:'Orange Money BE', salaire_usd:300, jours:[6,7],         heure_debut:'10:00', heure_fin:'14:00', consult_mois:8,  statut:'actif' },
  { id:'MED-BR3', nom:'MAES',       prenom:'Jacques',   specialite:'Médecine interne',       pays:'BE', ville:'Bruxelles',  operateur_mm:'Orange Money BE', salaire_usd:300, jours:[6],           heure_debut:'09:00', heure_fin:'13:00', consult_mois:6,  statut:'actif' },
  { id:'MED-LG1', nom:'LAMBERT',    prenom:'Annick',    specialite:'Gynécologie',            pays:'BE', ville:'Liège',      operateur_mm:'Orange Money BE', salaire_usd:300, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:4,  statut:'actif' },
  // ── Suisse ────────────────────────────────────────────────────────────────
  { id:'MED-GE1', nom:'MULLER',     prenom:'Frédéric',  specialite:'Médecine générale',      pays:'CH', ville:'Genève',     operateur_mm:'Orange (Twint)',  salaire_usd:290, jours:[6],           heure_debut:'14:00', heure_fin:'18:00', consult_mois:9,  statut:'actif' },
  { id:'MED-GE2', nom:'WEBER',      prenom:'Christine', specialite:'Cardiologie',            pays:'CH', ville:'Genève',     operateur_mm:'Orange (Twint)',  salaire_usd:320, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:5,  statut:'actif' },
  { id:'MED-LA1', nom:'FAVRE',      prenom:'Sylvain',   specialite:'Psychiatrie',            pays:'CH', ville:'Lausanne',   operateur_mm:'Orange (Twint)',  salaire_usd:310, jours:[6],           heure_debut:'14:00', heure_fin:'18:00', consult_mois:3,  statut:'actif' },
  // ── Pays-Bas ──────────────────────────────────────────────────────────────
  { id:'MED-RB1', nom:'VANDENBERG', prenom:'Jan',       specialite:'Médecine générale',      pays:'NL', ville:'Rotterdam',  operateur_mm:'Orange (Tikkie)', salaire_usd:290, jours:[7],           heure_debut:'10:00', heure_fin:'14:00', consult_mois:2,  statut:'actif' },
  // ── Maroc / Sénégal / Cameroun / Côte d'Ivoire ───────────────────────────
  { id:'MED-CA1', nom:'BENALI',     prenom:'Fatima',    specialite:'Médecine générale',      pays:'MA', ville:'Casablanca', operateur_mm:'Orange Money MA', salaire_usd:250, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:7,  statut:'actif' },
  { id:'MED-CA2', nom:'TAZI',       prenom:'Ahmed',     specialite:'Pédiatrie',              pays:'MA', ville:'Casablanca', operateur_mm:'Orange Money MA', salaire_usd:260, jours:[1,3,5],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:5,  statut:'actif' },
  { id:'MED-DK1', nom:'DIALLO',     prenom:'Moussa',    specialite:'Médecine générale',      pays:'SN', ville:'Dakar',      operateur_mm:'Orange Money SN', salaire_usd:240, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:9,  statut:'actif' },
  { id:'MED-DK2', nom:'FALL',       prenom:'Aminata',   specialite:'Gynécologie',            pays:'SN', ville:'Dakar',      operateur_mm:'Orange Money SN', salaire_usd:260, jours:[1,3,5],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:6,  statut:'actif' },
  { id:'MED-CM1', nom:'MBARGA',     prenom:'Bruno',     specialite:'Médecine générale',      pays:'CM', ville:'Douala',     operateur_mm:'Orange Money CM', salaire_usd:240, jours:[1,2,3,4,5],   heure_debut:'08:00', heure_fin:'12:00', consult_mois:8,  statut:'actif' },
  { id:'MED-CI1', nom:'KOUASSI',    prenom:'Kofi',      specialite:'Pédiatrie',              pays:'CI', ville:'Abidjan',    operateur_mm:'Orange Money CI', salaire_usd:250, jours:[1,3,5],       heure_debut:'09:00', heure_fin:'13:00', consult_mois:7,  statut:'actif' },
];

// ─── Constantes ───────────────────────────────────────────────────────────────
const JOURS_ABREV = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const FLAGS: Record<string, string> = {
  CD:'🇨🇩', FR:'🇫🇷', BE:'🇧🇪', CH:'🇨🇭', NL:'🇳🇱',
  MA:'🇲🇦', SN:'🇸🇳', CM:'🇨🇲', CI:'🇨🇮',
};
const ZONE_RDC    = ['CD'];
const ZONE_EU     = ['FR','BE','CH','NL'];
const ZONE_AF     = ['MA','SN','CM','CI'];

const SPECIALITES_UNIQUES = [...new Set(MEDECINS.map(m => m.specialite))].sort();

// ─── Couleur grille salaire ───────────────────────────────────────────────────
function salaireGrade(s: number): { bg: string; text: string } {
  if (s < 250) return { bg: colors.greenLight, text: colors.greenDeep };
  if (s < 280) return { bg: colors.blueLight,  text: colors.blueDeep  };
  if (s < 310) return { bg: colors.purpleLight,text: colors.purpleDeep};
  return          { bg: palette.warningLight,   text: palette.amber    };
}

type Filtre = 'tous' | 'rdc' | 'europe' | 'afrique' | string;

// ─── Composant principal ─────────────────────────────────────────────────────
export default function MedecinsAdminScreen() {
  const [filtre,   setFiltre]   = useState<Filtre>('tous');
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState<Medecin | null>(null);
  const [medecins, setMedecins] = useState<Medecin[]>(MEDECINS);

  const filtered = useMemo(() => {
    let data = medecins;
    if (filtre === 'rdc')    data = data.filter(m => ZONE_RDC.includes(m.pays));
    else if (filtre === 'europe') data = data.filter(m => ZONE_EU.includes(m.pays));
    else if (filtre === 'afrique') data = data.filter(m => ZONE_AF.includes(m.pays));
    else if (filtre !== 'tous') data = data.filter(m => m.specialite === filtre);
    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter(m =>
        m.nom.toLowerCase().includes(q) ||
        (m.prenom || '').toLowerCase().includes(q) ||
        m.specialite.toLowerCase().includes(q) ||
        m.ville.toLowerCase().includes(q)
      );
    }
    return data;
  }, [filtre, query, medecins]);

  const totalConsult  = medecins.filter(m => m.statut === 'actif').reduce((s, m) => s + m.consult_mois, 0);
  const masseSalariale= medecins.filter(m => m.statut === 'actif').reduce((s, m) => s + m.salaire_usd, 0);
  const nbActifs      = medecins.filter(m => m.statut === 'actif').length;

  const toggleStatut = (id: string) => {
    setMedecins(prev => prev.map(m =>
      m.id === id ? { ...m, statut: m.statut === 'actif' ? 'inactif' : 'actif' } : m
    ));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut: prev.statut === 'actif' ? 'inactif' : 'actif' } : null);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Médecins partenaires</Text>
        <Text style={styles.headerSub}>Réseau téléconsultation · 10 pays · Salaires mensuels fixes</Text>
        <View style={styles.kpiRow}>
          <KpiChip val={`${nbActifs}`}            lbl="Médecins actifs" />
          <KpiChip val={`${totalConsult}`}         lbl="Consultations/mois" color={palette.blue} />
          <KpiChip val={`$${masseSalariale.toLocaleString()}`} lbl="Masse salariale" color={palette.green} />
        </View>
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
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        {[
          ['tous', 'Tous'],
          ['rdc',  '🇨🇩 RDC'],
          ['europe','🌍 Europe'],
          ['afrique','🌍 Afrique'],
          ...SPECIALITES_UNIQUES.slice(0, 6).map(s => [s, s]),
        ].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            style={[styles.chip, filtre === k && styles.chipActive]}
            onPress={() => setFiltre(k as Filtre)}
          >
            <Text style={[styles.chipText, filtre === k && styles.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Compteur résultat */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} médecin{filtered.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Liste */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.map(m => {
          const grade = salaireGrade(m.salaire_usd);
          const initiales = `${(m.prenom || '')[0] || ''}${m.nom[0]}`.toUpperCase();
          const avatarBg  = ZONE_EU.includes(m.pays) ? palette.purple :
                            ZONE_AF.includes(m.pays) ? palette.amber  : palette.blue;
          return (
            <TouchableOpacity key={m.id} style={styles.card} activeOpacity={0.75} onPress={() => setSelected(m)}>
              <View style={styles.cardLeft}>
                <View style={[styles.avatar, { backgroundColor: avatarBg + '30', borderColor: avatarBg + '60' }]}>
                  <Text style={[styles.avatarText, { color: avatarBg }]}>{initiales}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardNom}>Dr. {m.prenom} {m.nom}</Text>
                  <View style={[styles.statutBadge, { backgroundColor: m.statut === 'actif' ? colors.greenLight : colors.bg }]}>
                    <Text style={[styles.statutText, { color: m.statut === 'actif' ? colors.greenDeep : colors.textMuted }]}>
                      {m.statut === 'actif' ? 'Actif' : 'Inactif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSpecialite}>{m.specialite}</Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardVille}>{FLAGS[m.pays] || m.pays} {m.ville}</Text>
                  <View style={[styles.salaireChip, { backgroundColor: grade.bg }]}>
                    <Text style={[styles.salaireText, { color: grade.text }]}>${m.salaire_usd}/mois</Text>
                  </View>
                </View>
                <View style={styles.cardFooterRow}>
                  <Text style={styles.cardConsult}>{m.consult_mois} consultations ce mois</Text>
                  <Text style={styles.cardPlanning}>
                    {m.jours.map(j => JOURS_ABREV[j]).join(' · ')} · {m.heure_debut}–{m.heure_fin}
                  </Text>
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
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            {/* En-tête modal */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalAvatar, {
                backgroundColor: (ZONE_EU.includes(selected.pays) ? palette.purple : ZONE_AF.includes(selected.pays) ? palette.amber : palette.blue) + '25',
              }]}>
                <Text style={[styles.modalAvatarText, {
                  color: ZONE_EU.includes(selected.pays) ? palette.purpleDeep : ZONE_AF.includes(selected.pays) ? palette.amber : palette.blueDeep,
                }]}>
                  {`${(selected.prenom || '')[0] || ''}${selected.nom[0]}`.toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalNom}>Dr. {selected.prenom} {selected.nom}</Text>
                <Text style={styles.modalSpecialite}>{selected.specialite}</Text>
                <Text style={styles.modalVille}>{FLAGS[selected.pays] || selected.pays} {selected.ville}</Text>
              </View>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Salaire */}
              <SectionLabel>Rémunération</SectionLabel>
              <View style={styles.infoBlock}>
                <InfoRow label="Salaire mensuel fixe" val={`$${selected.salaire_usd} USD`} bold />
                <InfoRow label="Mode de paiement" val="Mensuel — Mobile Money" />
                <InfoRow label="Opérateur" val={selected.operateur_mm} />
              </View>

              {/* Planning */}
              <SectionLabel>Planning de disponibilité</SectionLabel>
              <View style={styles.infoBlock}>
                <View style={styles.joursRow}>
                  {[1,2,3,4,5,6,7].map(j => (
                    <View key={j} style={[styles.jourChip, selected.jours.includes(j) && styles.jourChipActive]}>
                      <Text style={[styles.jourText, selected.jours.includes(j) && styles.jourTextActive]}>
                        {JOURS_ABREV[j]}
                      </Text>
                    </View>
                  ))}
                </View>
                <InfoRow label="Créneaux" val={`${selected.heure_debut} – ${selected.heure_fin} (30 min)`} />
              </View>

              {/* Activité */}
              <SectionLabel>Activité — Mai 2026</SectionLabel>
              <View style={styles.infoBlock}>
                <InfoRow label="Consultations réalisées" val={`${selected.consult_mois}`} bold />
                <InfoRow label="Identifiant réseau" val={selected.id} mono />
              </View>

              {/* Actions */}
              <SectionLabel>Actions</SectionLabel>
              <View style={styles.actionsBlock}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: selected.statut === 'actif' ? colors.dangerLight : colors.greenLight }]}
                  onPress={() => toggleStatut(selected.id)}
                >
                  <Text style={[styles.actionBtnText, { color: selected.statut === 'actif' ? colors.danger : colors.greenDeep }]}>
                    {selected.statut === 'actif' ? 'Désactiver ce médecin' : 'Réactiver ce médecin'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnOutline} onPress={() => setSelected(null)}>
                  <Text style={styles.actionBtnOutlineText}>Modifier le planning — à venir</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: colors.bg },

  // Header
  header:            { backgroundColor: palette.dark, paddingTop: 52, paddingBottom: 20, paddingHorizontal: spacing.lg },
  headerTitle:       { fontSize: fontSize.xl, fontWeight: fontWeight.black as any, color: '#fff', marginBottom: 3 },
  headerSub:         { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.65)', marginBottom: 16 },
  kpiRow:            { flexDirection: 'row', gap: 10 },
  kpiChip:           { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  kpiVal:            { fontSize: fontSize.base, fontWeight: fontWeight.black as any, color: '#fff' },
  kpiLbl:            { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  // Recherche
  searchWrap:        { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4 },
  searchBox:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10, ...shadow.sm },
  searchIcon:        { fontSize: 15, marginRight: 8 },
  searchInput:       { flex: 1, fontSize: fontSize.md, color: colors.text, padding: 0 },
  clearBtn:          { fontSize: 15, color: colors.textMuted, paddingLeft: 8 },

  // Filtres
  filterScroll:      { flexGrow: 0 },
  filterContent:     { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8, flexDirection: 'row' },
  chip:              { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  chipActive:        { backgroundColor: palette.dark, borderColor: palette.dark },
  chipText:          { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium as any },
  chipTextActive:    { color: '#fff' },

  // Compteur
  countRow:          { paddingHorizontal: spacing.lg, paddingBottom: 6 },
  countText:         { fontSize: fontSize.sm, color: colors.textMuted },

  // Liste
  scroll:            { flex: 1 },
  scrollContent:     { paddingHorizontal: spacing.lg, paddingTop: 4 },

  // Carte médecin
  card:              { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: 10, ...shadow.sm },
  cardLeft:          { marginRight: 12 },
  avatar:            { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: fontSize.base, fontWeight: fontWeight.black as any },
  cardBody:          { flex: 1 },
  cardTopRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardNom:           { fontSize: fontSize.md, fontWeight: fontWeight.bold as any, color: colors.text, flex: 1, marginRight: 8 },
  statutBadge:       { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  statutText:        { fontSize: 11, fontWeight: fontWeight.semibold as any },
  cardSpecialite:    { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 6 },
  cardMetaRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardVille:         { fontSize: fontSize.sm, color: colors.text },
  salaireChip:       { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  salaireText:       { fontSize: 12, fontWeight: fontWeight.bold as any },
  cardFooterRow:     { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  cardConsult:       { fontSize: 11, color: colors.textLight },
  cardPlanning:      { fontSize: 10, color: colors.textLight },

  // Modal
  overlay:           { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,46,0.5)' },
  modal:             { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingTop: 12 },
  modalHandle:       { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: 16 },
  modalAvatar:       { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  modalAvatarText:   { fontSize: fontSize.xl, fontWeight: fontWeight.black as any },
  modalTitleBlock:   { flex: 1 },
  modalNom:          { fontSize: fontSize.lg, fontWeight: fontWeight.black as any, color: colors.text },
  modalSpecialite:   { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  modalVille:        { fontSize: fontSize.sm, color: colors.textLight, marginTop: 2 },
  modalScroll:       { paddingHorizontal: spacing.lg },

  sectionLabel:      { fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md, marginBottom: 8 },
  infoBlock:         { backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 4 },
  infoRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoLabel:         { fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  infoVal:           { fontSize: fontSize.sm, color: colors.text, textAlign: 'right', flex: 1 },

  joursRow:          { flexDirection: 'row', justifyContent: 'space-between', padding: 14, gap: 4 },
  jourChip:          { flex: 1, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.border, alignItems: 'center' },
  jourChipActive:    { backgroundColor: palette.dark },
  jourText:          { fontSize: 10, color: colors.textMuted, fontWeight: fontWeight.medium as any },
  jourTextActive:    { color: '#fff', fontWeight: fontWeight.bold as any },

  actionsBlock:      { gap: 10, marginBottom: spacing.md },
  actionBtn:         { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  actionBtnText:     { fontSize: fontSize.md, fontWeight: fontWeight.bold as any },
  actionBtnOutline:  { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  actionBtnOutlineText: { fontSize: fontSize.md, color: colors.textMuted },
});

/**
 * SantéDirect Kolongono — Design System v3
 *
 * Palette pastel médicale : bleu #ABC4EB · violet #BCA9ED · vert #BDEEAD · blanc
 * Typographie Outfit · icônes SVG · UI moderne et aérée (inspirée UI kits médicaux 2025)
 */

// ─── Palette de base ─────────────────────────────────────────────────────────

export const palette = {
  // Brand pastels
  blue:         '#ABC4EB',    // Bleu pervenche doux
  purple:       '#BCA9ED',    // Lavande douce
  green:        '#BDEEAD',    // Menthe douce
  white:        '#FFFFFF',

  // Dérivés des pastels (versions profondes)
  blueDeep:     '#7AA5D4',
  purpleDeep:   '#9B82D4',
  greenDeep:    '#8FC98A',

  // Dérivés des pastels (versions très claires — fond de cartes)
  blueSoft:     '#E4EDFA',
  purpleSoft:   '#EDE8FA',
  greenSoft:    '#E8F7E5',

  // Marine sombre — CTAs, nav active, boutons principaux
  dark:         '#1A1A2E',
  darkMid:      '#252538',
  darkSoft:     '#3D3D5C',

  // Neutres froids (légèrement bleutés)
  gray50:       '#F4F6FA',    // Fond principal — très légèrement teinté
  gray100:      '#ECEEF5',    // Fond alternatif
  gray150:      '#E2E4EF',
  gray200:      '#CDD0E8',
  gray400:      '#9499BB',
  gray500:      '#6B6F90',
  gray700:      '#3A3D5C',
  gray900:      '#1A1A2E',

  // Status
  success:      '#4CAF50',
  successLight: '#E8F5E9',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
  danger:       '#EF4444',
  dangerLight:  '#FEE2E2',
  dangerDark:   '#B91C1C',

  amber:        '#F59E0B',
};

// ─── Tokens sémantiques ──────────────────────────────────────────────────────

export const colors = {
  // Primaire — marine sombre pour CTAs et navigation active
  primary:      palette.dark,         // #1A1A2E — boutons CTA, état actif
  primaryDark:  palette.darkMid,      // #252538 — headers, surfaces foncées
  primaryDeep:  palette.gray900,      // #1A1A2E — titres forts
  primaryMid:   palette.darkSoft,     // #3D3D5C — variante intermédiaire
  primaryLight: palette.blueSoft,     // #E4EDFA — fonds légers, chips actives
  primarySoft:  palette.gray50,       // #F4F6FA — sections de fond

  // Pastels de marque — accents et couleurs de cartes
  blue:         palette.blue,         // #ABC4EB
  blueLight:    palette.blueSoft,     // #E4EDFA
  blueDeep:     palette.blueDeep,     // #7AA5D4
  purple:       palette.purple,       // #BCA9ED
  purpleLight:  palette.purpleSoft,   // #EDE8FA
  purpleDeep:   palette.purpleDeep,   // #9B82D4
  green:        palette.green,        // #BDEEAD
  greenLight:   palette.greenSoft,    // #E8F7E5
  greenDeep:    palette.greenDeep,    // #8FC98A

  // Accent — bleu pastel (Longonia bridge, infos)
  accent:       palette.blue,
  accentLight:  palette.blueSoft,

  // Compat rétro
  violet:       palette.purple,
  violetLight:  palette.purpleSoft,
  lavender:     palette.purpleSoft,
  lavenderSoft: '#F5F3FF',
  lime:         palette.green,
  limeLight:    palette.greenSoft,
  orange:       '#F97316',
  orangeLight:  '#FFF0E6',

  // Sémantiques
  success:      palette.success,
  successLight: palette.successLight,
  warning:      palette.warning,
  warningLight: palette.warningLight,
  danger:       palette.danger,
  dangerLight:  palette.dangerLight,
  dangerDark:   palette.dangerDark,
  info:         palette.blue,
  infoLight:    palette.blueSoft,
  amber:        palette.amber,
  amberLight:   palette.warningLight,

  // ─── Fond & Surfaces ─────────────────────────────────────────────────────
  bg:           palette.gray50,       // #F4F6FA — fond principal légèrement teinté
  bgSoft:       palette.gray100,      // #ECEEF5 — sections alternées
  card:         palette.white,        // Cartes — blanc pur avec ombre
  surface:      palette.gray50,       // Inputs, zones distinctes

  // Bordures
  border:       palette.gray150,      // #E2E4EF
  borderLight:  '#ECEEF5',
  divider:      '#F0F2FA',

  // Textes
  text:         palette.gray900,      // #1A1A2E — corps de texte
  textStrong:   palette.dark,         // #1A1A2E — titres
  textMuted:    palette.gray500,      // #6B6F90 — secondaire
  textLight:    palette.gray400,      // #9499BB — tertiaire/désactivé
  placeholder:  palette.gray400,

  // Overlay
  overlay: 'rgba(26, 26, 46, 0.45)',

  // ─── Modules Kolongono ───────────────────────────────────────────────────
  consultation: palette.blue,         // Bleu — consultations
  pharmacie:    palette.purple,       // Violet — pharmacie
  dossier:      palette.purple,       // Violet — dossiers médicaux
  abonnement:   palette.blue,         // Bleu — mutuelle
  auxiliaire:   palette.green,        // Vert — auxiliaires
  urgence:      palette.danger,       // Rouge — urgences
  finance:      palette.amber,        // Ambre — finances

  // ─── Alias de compat (utilisés dans les screens scanner) ─────────────────
  background:   palette.gray50,       // = bg
  blueSoft:     '#E4EDFA',            // = blueLight
};

// Objet theme unifié — importable avec { theme } depuis les screens
export const theme = {
  colors,
  spacing,
  radius,
  shadow,
  fontFamily,
  fontSize,
  fontWeight,
};

// ─── Typographie — Outfit ────────────────────────────────────────────────────

export const fontFamily = {
  regular:  'Outfit-Regular',
  medium:   'Outfit-Medium',
  semibold: 'Outfit-SemiBold',
  bold:     'Outfit-Bold',
  black:    'Outfit-Black',
  // Fallback si Outfit non installé
  fallback: 'System',
};

export const fontSize = {
  xs:      11,
  sm:      13,
  md:      15,
  base:    16,
  lg:      18,
  xl:      21,
  xxl:     25,
  xxxl:    30,
  hero:    38,
  display: 48,
};

export const fontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
  black:    '900' as const,
};

export const lineHeight = {
  tight:   1.2,
  normal:  1.45,
  relaxed: 1.65,
  loose:   1.8,
};

// ─── Espacement ──────────────────────────────────────────────────────────────

export const spacing = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  xxl:   28,
  xxxl:  40,
  huge:  56,

  screenH: 20,
  screenV: 24,
  cardPad: 20,
};

// ─── Rayons ───────────────────────────────────────────────────────────────────

export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  xxl:  30,
  xxxl: 40,
  full: 9999,
};

// ─── Ombres ──────────────────────────────────────────────────────────────────

export const shadow = {
  none: {},
  xs: {
    elevation: 1,
    shadowColor: palette.dark,
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  sm: {
    elevation: 2,
    shadowColor: palette.dark,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  md: {
    elevation: 4,
    shadowColor: palette.dark,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  lg: {
    elevation: 8,
    shadowColor: palette.dark,
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  xl: {
    elevation: 16,
    shadowColor: palette.dark,
    shadowOpacity: 0.14,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 12 },
  },
  // Ombre principale marine — pour bottom nav pill
  nav: {
    elevation: 20,
    shadowColor: palette.dark,
    shadowOpacity: 0.30,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  // Ombre colorée bleue — pour CTA principaux
  primary: {
    elevation: 6,
    shadowColor: palette.dark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
  },
};

// ─── Layout ──────────────────────────────────────────────────────────────────

export const TAP_TARGET        = 52;
export const BOTTOM_TAB_HEIGHT = 64;   // Hauteur du pill de navigation
export const BOTTOM_TAB_MARGIN = 20;   // Marge basse du pill
export const HEADER_HEIGHT     = 60;

// ─── Animation ──────────────────────────────────────────────────────────────

export const animation = {
  fast:   150,
  normal: 250,
  slow:   400,
};

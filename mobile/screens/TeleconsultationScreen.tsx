import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius, fontSize, fontWeight } from '../components/theme';
import { Icon } from '../components/Icons';

type Props = {
  route: { params: { lien: string; role: 'patient' | 'auxiliaire' | 'medecin'; nomSalle: string } };
  navigation: any;
};

export default function TeleconsultationScreen({ route, navigation }: Props) {
  const { lien, role, nomSalle } = route.params;
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur]   = useState(false);

  /* HTML injecté pour cacher l'UI Jitsi superflue et adapter au contexte médical */
  const injectedJS = `
    (function() {
      // Attendre que Jitsi soit chargé
      var tries = 0;
      var interval = setInterval(function() {
        tries++;
        if (tries > 30) { clearInterval(interval); return; }

        // Masquer boutons non pertinents (chat public, emoji, whiteboard)
        var selectors = [
          '[aria-label="More options"]',
          '.toolbox-button[aria-label="Start recording"]',
          '.toolbox-button[aria-label="Reactions"]',
        ];
        selectors.forEach(function(s) {
          var el = document.querySelector(s);
          if (el) el.style.display = 'none';
        });

        // Titre de la salle — contexte médical
        var watermark = document.querySelector('.watermark');
        if (watermark) watermark.style.display = 'none';

        if (document.querySelector('.toolbox-content-wrapper')) clearInterval(interval);
      }, 500);

      // Écouter la fin de la consultation
      if (window.JitsiMeetExternalAPI) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'jitsi_loaded'}));
      }
      true;
    })();
  `;

  function terminerConsultation() {
    Alert.alert(
      'Terminer la consultation',
      'Êtes-vous sûr de vouloir quitter cette consultation vidéo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: () => {
            webViewRef.current?.injectJavaScript(`
              if (window.JitsiMeetExternalAPI) {
                APP.conference.hangup();
              }
            `);
            navigation.goBack();
          },
        },
      ]
    );
  }

  function onMessage(event: any) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'jitsi_loaded') setLoading(false);
    } catch (_) {}
  }

  const roleLabel = role === 'medecin' ? 'Médecin' : role === 'auxiliaire' ? 'Auxiliaire' : 'Patient';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Barre supérieure */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN DIRECT</Text>
          </View>
          <Text style={styles.topBarTitle} numberOfLines={1}>{nomSalle}</Text>
        </View>
        <View style={styles.topBarRight}>
          <Text style={styles.roleChip}>{roleLabel}</Text>
          <TouchableOpacity style={styles.endBtn} onPress={terminerConsultation}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="phone-off" size={14} color="#fff" />
              <Text style={styles.endBtnText}>Fin</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chargement */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Connexion à la consultation vidéo…</Text>
          <Text style={styles.loadingSubtext}>
            {Platform.OS === 'android'
              ? 'Jitsi Meet · Chiffrement de bout en bout'
              : 'Jitsi Meet · Chiffrement de bout en bout'}
          </Text>
        </View>
      )}

      {/* Erreur réseau */}
      {erreur && (
        <View style={styles.erreurView}>
          <Icon name="video-off" size={48} color={colors.textLight} strokeWidth={1.2} />
          <Text style={styles.erreurTitle}>Connexion impossible</Text>
          <Text style={styles.erreurText}>
            Vérifiez la connexion internet.{'\n'}
            Le médecin et l'auxiliaire doivent être connectés.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setErreur(false); setLoading(true); webViewRef.current?.reload(); }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="refresh" size={14} color="#fff" />
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
            <Text style={[styles.retryBtnText, { color: colors.textMuted }]}>← Retour</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView Jitsi */}
      {!erreur && (
        <WebView
          ref={webViewRef}
          source={{ uri: lien }}
          style={styles.webview}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true}
          originWhitelist={['https://*', 'http://*']}
          injectedJavaScript={injectedJS}
          onMessage={onMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setErreur(true); }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) { setLoading(false); setErreur(true); }
          }}
          // Permissions micro et caméra
          mediaCapturePermissionGrantType="grant"
        />
      )}

      {/* Barre inférieure */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>
          🔒 Consultation chiffrée · Jitsi Meet · 3 participants max
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: {
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingTop: spacing.xl,
  },
  topBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.danger, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText:    { color: '#fff', fontSize: 10, fontWeight: fontWeight.black },
  topBarTitle: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold, flex: 1 },
  roleChip:    { backgroundColor: 'rgba(255,255,255,.15)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3, color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  endBtn:      { backgroundColor: colors.danger, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 6 },
  endBtnText:  { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.black },

  webview: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1A0A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 10,
  },
  loadingText:    { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.md },
  loadingSubtext: { color: 'rgba(255,255,255,.4)', fontSize: fontSize.xs },

  erreurView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1A0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    zIndex: 10,
  },
  erreurIcon:  { fontSize: 52, marginBottom: spacing.sm },
  erreurTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  erreurText:  { color: 'rgba(255,255,255,.5)', fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  retryBtn:    { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  retryBtnText:{ color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.black },

  bottomBar: {
    backgroundColor: 'rgba(0,0,0,.8)',
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  bottomText: { color: 'rgba(255,255,255,.3)', fontSize: fontSize.xs },
});

// ============================================================
// CONFIGURATION CMSS Relation Clients — À REMPLIR
// ============================================================
// 1. Créez un projet gratuit sur https://supabase.com
// 2. Project Settings → API → copiez URL et anon key
// 3. SQL Editor → collez sql/schema.sql → Run
// 4. Remplissez les valeurs ci-dessous

window.CMSS_CONFIG = {
  // --- Base de données centrale (Supabase) ---
  SUPABASE_URL: '',           // Ex: https://xxxxx.supabase.co
  SUPABASE_ANON_KEY: '',      // Clé "anon" / "public"

  // --- Mode : true = utilise Supabase si configuré ---
  USE_CLOUD: true,

  // --- SMS (optionnel — Orange Mali / Twilio) ---
  SMS_ENABLED: false,
  SMS_API_URL: '',            // URL API SMS
  SMS_API_KEY: '',
  SMS_SENDER: 'CMSS',

  // --- Intégration métier CMSS (futur) ---
  CMSS_API_URL: '',           // Ex: API interne dossiers pensions
  CMSS_API_KEY: '',

  // --- Site ---
  SITE_NAME: 'CMSS — Relation Clients',
  SUPPORT_PHONE: '8000 2238'
};

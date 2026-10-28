/**
 * Couche données CMSS — cloud (Supabase) ou local (localStorage)
 * Résout : base centrale, données partagées, sauvegardes cloud
 */
(function () {
  const cfg = window.CMSS_CONFIG || {};
  let supabase = null;
  let mode = 'local';

  function cloudReady() {
    return !!(cfg.USE_CLOUD && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  }

  async function init() {
    if (cloudReady()) {
      try {
        supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        // test léger
        const { error } = await supabase.from('agents').select('id').limit(1);
        if (!error) {
          mode = 'cloud';
          console.log('[CMSS] Mode CLOUD (Supabase) — données partagées');
          return mode;
        }
        console.warn('[CMSS] Supabase erreur, repli local:', error.message);
      } catch (e) {
        console.warn('[CMSS] Init cloud échouée, mode local', e);
      }
    }
    mode = 'local';
    // seed admin local
    if (!localStorage.getItem('cmss_users')) {
      localStorage.setItem('cmss_users', JSON.stringify([{
        id: 'admin-001', username: 'admin', password: 'Admin@CMSS2026',
        nom: 'Administrateur CMSS', role: 'admin', actif: true, createdAt: new Date().toISOString()
      }]));
    }
    if (!localStorage.getItem('cmss_agent_stats')) localStorage.setItem('cmss_agent_stats', '{}');
    console.log('[CMSS] Mode LOCAL (navigateur)');
    return mode;
  }

  function getMode() { return mode; }

  // ---- Agents ----
  async function listAgents() {
    if (mode === 'cloud') {
      const { data, error } = await supabase.from('agents').select('*').order('created_at');
      if (error) throw error;
      return (data || []).map(a => ({
        id: a.id, username: a.username, password: a.password_hash,
        nom: a.nom, role: a.role, actif: a.actif, createdAt: a.created_at
      }));
    }
    return JSON.parse(localStorage.getItem('cmss_users') || '[]');
  }

  async function login(username, password) {
    await init();
    if (mode === 'cloud') {
      const { data, error } = await supabase.from('agents')
        .select('*').eq('username', username).eq('password_hash', password).eq('actif', true).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, username: data.username, nom: data.nom, role: data.role };
    }
    const users = JSON.parse(localStorage.getItem('cmss_users') || '[]');
    const u = users.find(x => x.username === username && x.password === password && x.actif);
    return u ? { id: u.id, username: u.username, nom: u.nom, role: u.role } : null;
  }

  async function createAgent(payload) {
    if (mode === 'cloud') {
      const { data, error } = await supabase.from('agents').insert({
        username: payload.username,
        password_hash: payload.password,
        nom: payload.nom,
        role: payload.role || 'agent',
        actif: true
      }).select().single();
      if (error) throw error;
      return data;
    }
    const users = JSON.parse(localStorage.getItem('cmss_users') || '[]');
    if (users.some(u => u.username === payload.username)) throw new Error('Identifiant déjà utilisé');
    const row = {
      id: 'user-' + Date.now(), username: payload.username, password: payload.password,
      nom: payload.nom, role: payload.role || 'agent', actif: true, createdAt: new Date().toISOString()
    };
    users.push(row);
    localStorage.setItem('cmss_users', JSON.stringify(users));
    return row;
  }

  async function setAgentActif(id, actif) {
    if (mode === 'cloud') {
      const { error } = await supabase.from('agents').update({ actif }).eq('id', id);
      if (error) throw error;
      return;
    }
    const users = JSON.parse(localStorage.getItem('cmss_users') || '[]');
    const u = users.find(x => x.id === id);
    if (u) { u.actif = actif; localStorage.setItem('cmss_users', JSON.stringify(users)); }
  }

  // ---- Réclamations / RDV / Suivis ----
  async function insertReclamation(row) {
    if (mode === 'cloud') {
      const { data, error } = await supabase.from('reclamations').insert(row).select().single();
      if (error) throw error;
      return data;
    }
    const list = JSON.parse(localStorage.getItem('cmss_suivis') || '[]');
    list.unshift({
      id: row.tracking_number, cat: 'reclamation', type: row.category, objet: row.subject,
      aff: row.affiliation_number, nom: row.full_name, description: row.description,
      statut: 'soumise', label: 'Soumise', color: 'bg-yellow-100 text-yellow-800',
      date: new Date().toLocaleDateString('fr-FR'),
      historique: [{ etape: 'Soumise', date: new Date().toLocaleDateString('fr-FR'), desc: 'Enregistrée' }]
    });
    localStorage.setItem('cmss_suivis', JSON.stringify(list));
    return row;
  }

  async function insertRdv(row) {
    if (mode === 'cloud') {
      const { data, error } = await supabase.from('rendez_vous').insert(row).select().single();
      if (error) throw error;
      return data;
    }
    const list = JSON.parse(localStorage.getItem('cmss_suivis') || '[]');
    list.unshift({
      id: row.tracking_number, cat: 'rdv', type: row.motif, objet: row.motif,
      aff: row.affiliation_number, nom: row.full_name, centre: row.centre,
      creneau: (row.date_rdv || '') + ' · ' + (row.creneau || ''),
      statut: 'confirme', label: 'Confirmé', color: 'bg-green-100 text-green-800',
      date: new Date().toLocaleDateString('fr-FR'),
      historique: [{ etape: 'Confirmé', date: new Date().toLocaleDateString('fr-FR'), desc: 'RDV pris' }]
    });
    localStorage.setItem('cmss_suivis', JSON.stringify(list));
    return row;
  }

  async function searchSuivis(q) {
    q = (q || '').trim().toLowerCase();
    if (mode === 'cloud') {
      let items = [];
      const [r1, r2, r3] = await Promise.all([
        supabase.from('reclamations').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('rendez_vous').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('dossiers').select('*').order('created_at', { ascending: false }).limit(50)
      ]);
      (r1.data || []).forEach(x => items.push({
        id: x.tracking_number, cat: 'reclamation', type: x.category, objet: x.subject,
        aff: x.affiliation_number, nom: x.full_name, statut: x.status, label: x.status,
        date: new Date(x.created_at).toLocaleDateString('fr-FR'), description: x.description
      }));
      (r2.data || []).forEach(x => items.push({
        id: x.tracking_number, cat: 'rdv', type: x.motif, objet: x.motif,
        aff: x.affiliation_number, nom: x.full_name, centre: x.centre,
        creneau: (x.date_rdv || '') + ' · ' + (x.creneau || ''),
        statut: x.status, label: x.status, date: new Date(x.created_at).toLocaleDateString('fr-FR')
      }));
      (r3.data || []).forEach(x => items.push({
        id: x.tracking_number, cat: 'dossier', type: x.benefit_type, objet: x.benefit_type,
        aff: x.affiliation_number, nom: x.applicant_name, statut: x.current_status, label: x.current_status,
        date: new Date(x.created_at).toLocaleDateString('fr-FR')
      }));
      if (q) items = items.filter(d =>
        (d.id || '').toLowerCase().includes(q) || (d.aff || '').includes(q) ||
        (d.nom || '').toLowerCase().includes(q) || (d.objet || '').toLowerCase().includes(q)
      );
      return items;
    }
    let list = JSON.parse(localStorage.getItem('cmss_suivis') || '[]');
    // démo dossiers
    const demo = [
      { id: 'DOS-2026-15847', cat: 'dossier', type: 'Pension de retraite', objet: 'Pension', aff: '123456789', statut: 'en_instruction', label: 'En instruction', color: 'bg-yellow-100 text-yellow-800', date: '18/10/2026' }
    ];
    list = [...list, ...demo];
    if (q) list = list.filter(d =>
      (d.id || '').toLowerCase().includes(q) || (d.aff || '').includes(q) ||
      (d.nom || '').toLowerCase().includes(q) || (d.objet || '').toLowerCase().includes(q)
    );
    return list;
  }

  async function recordAction(agentId, actionType, detail) {
    if (!agentId) return;
    if (mode === 'cloud') {
      await supabase.from('agent_actions').insert({
        agent_id: agentId, action_type: actionType, detail: detail || ''
      });
      return;
    }
    const stats = JSON.parse(localStorage.getItem('cmss_agent_stats') || '{}');
    if (!stats[agentId]) stats[agentId] = { actions: [], counts: {} };
    stats[agentId].actions = stats[agentId].actions || [];
    stats[agentId].counts = stats[agentId].counts || {};
    stats[agentId].actions.unshift({ type: actionType, detail: detail || '', at: new Date().toISOString() });
    stats[agentId].counts[actionType] = (stats[agentId].counts[actionType] || 0) + 1;
    stats[agentId].lastActivity = new Date().toISOString();
    localStorage.setItem('cmss_agent_stats', JSON.stringify(stats));
  }

  async function getAgentStats() {
    if (mode === 'cloud') {
      const { data } = await supabase.from('agent_actions').select('*').order('created_at', { ascending: false }).limit(500);
      const map = {};
      (data || []).forEach(a => {
        if (!map[a.agent_id]) map[a.agent_id] = { actions: [], counts: {}, lastActivity: a.created_at };
        map[a.agent_id].actions.push({ type: a.action_type, detail: a.detail, at: a.created_at });
        map[a.agent_id].counts[a.action_type] = (map[a.agent_id].counts[a.action_type] || 0) + 1;
        if (a.created_at > map[a.agent_id].lastActivity) map[a.agent_id].lastActivity = a.created_at;
      });
      return map;
    }
    return JSON.parse(localStorage.getItem('cmss_agent_stats') || '{}');
  }

  // SMS (préparé)
  async function sendSms(phone, message, purpose) {
    if (!cfg.SMS_ENABLED || !cfg.SMS_API_URL) {
      console.log('[CMSS SMS simulé]', phone, message);
      if (mode === 'cloud') {
        await supabase.from('sms_logs').insert({ phone, message, purpose, status: 'simulated' });
      }
      return { ok: true, simulated: true };
    }
    // Brancher ici l'API Orange / Twilio
    try {
      const res = await fetch(cfg.SMS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.SMS_API_KEY },
        body: JSON.stringify({ to: phone, text: message, from: cfg.SMS_SENDER })
      });
      const body = await res.text();
      if (mode === 'cloud') {
        await supabase.from('sms_logs').insert({
          phone, message, purpose, status: res.ok ? 'sent' : 'error', provider_response: body
        });
      }
      return { ok: res.ok, body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  window.CMSSDB = {
    init, getMode, listAgents, login, createAgent, setAgentActif,
    insertReclamation, insertRdv, searchSuivis, recordAction, getAgentStats, sendSms
  };
})();

// CMSS Auth — script partagé
(function() {
  function getSession() {
    try {
      return JSON.parse(localStorage.getItem('cmss_session') || 'null');
    } catch(e) { return null; }
  }

  function requireAuth(allowedRoles) {
    const session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(session.role)) {
      window.location.href = session.role === 'admin' ? 'admin.html' : 'index.html';
      return null;
    }
    return session;
  }

  function logout() {
    localStorage.removeItem('cmss_session');
    window.location.href = 'login.html';
  }

  function recordAction(agentId, actionType, detail) {
    const stats = JSON.parse(localStorage.getItem('cmss_agent_stats') || '{}');
    if (!stats[agentId]) {
      stats[agentId] = { actions: [], counts: { reclamation: 0, rdv: 0, suivi: 0, autre: 0 } };
    }
    stats[agentId].actions.unshift({
      type: actionType,
      detail: detail || '',
      at: new Date().toISOString()
    });
    // garder max 100 actions par agent
    if (stats[agentId].actions.length > 100) stats[agentId].actions.length = 100;
    stats[agentId].counts[actionType] = (stats[agentId].counts[actionType] || 0) + 1;
    stats[agentId].lastActivity = new Date().toISOString();
    localStorage.setItem('cmss_agent_stats', JSON.stringify(stats));
  }

  window.CMSSAuth = { getSession, requireAuth, logout, recordAction };
})();

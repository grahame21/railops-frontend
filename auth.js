(function(){
  function getSession(){
    try { return JSON.parse(localStorage.getItem('railops_session') || 'null'); }
    catch(e){ return null; }
  }
  function logout(){
    try { localStorage.removeItem('railops_session'); } catch(e){}
    location.replace('/login.html');
  }
  function requireRole(allowedRoles){
    const sess = getSession();
    if (!sess || !allowedRoles.includes(sess.role)) {
      location.replace('/login.html');
      return false;
    }
    return true;
  }
  function wireLogout(selector){
    const el = document.querySelector(selector);
    if (el) el.addEventListener('click', function(e){ e.preventDefault(); logout(); });
  }
  window.RailOpsAuth = { getSession, logout, requireRole, wireLogout };
})();

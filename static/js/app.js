(function () {
  const hidden = document.getElementById('device_id');
  if (hidden) {
    const key = 'railops_device_id';
    let value = localStorage.getItem(key);
    if (!value) {
      value = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, value);
    }
    hidden.value = value;
  }
})();

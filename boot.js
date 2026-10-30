(() => {
  const showError = () => {
    const panel = document.getElementById('startup');
    if (!panel) return;
    panel.setAttribute('role', 'alert');
    document.getElementById('startup-message').textContent = 'بارگذاری شیفت‌یار کامل نشد.';
    document.getElementById('startup-help').textContent = 'فایل ZIP را کامل استخراج کنید؛ app.bundle.js، styles.css و پوشه assets باید کنار index.html باشند. اگر سایت را به‌روز کرده‌اید، همه پنجره‌های آن را ببندید و دوباره باز کنید. اطلاعات ذخیره‌شده را پاک نکنید.';
  };
  document.getElementById('startup-reload')?.addEventListener('click', () => location.reload());
  window.addEventListener('error', showError, true);
  window.addEventListener('unhandledrejection', showError);
  window.addEventListener('load', showError, { once: true });
})();

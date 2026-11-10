// يحفظ واجهة التطبيق على الجهاز ليفتح فورًا، ولا يتدخل في طلبات البيانات
const CACHE = 'ishraf-v20';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const PAGE_TIMEOUT = 2500;   // أقصى انتظار للشبكة قبل فتح النسخة المحفوظة
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
const save = (req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; };
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // خطوط Google: من الذاكرة بعد أول مرة
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => save(e.request, x))));
    return;
  }
  if (u.origin !== location.origin) return;
  const isPage = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname);
  if (isPage) {
    // الصفحة: الشبكة أولًا لتصل التحديثات، لكن لا ننتظرها أكثر من ثانيتين ونصف
    // (no-cache: يتحقق من GitHub في كل مرة بدل نسخة المتصفح)
    const net = fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }).then(r => save(e.request, r));
    const cached = caches.match(e.request).then(r => r || caches.match('./index.html'));
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fin = r => { if (!done && r) { done = true; resolve(r); } };
      const t = setTimeout(() => cached.then(fin), PAGE_TIMEOUT);
      net.then(r => { clearTimeout(t); fin(r); }).catch(() => { clearTimeout(t); cached.then(r => fin(r || Response.error())); });
    }));
    e.waitUntil(net.catch(() => {}));
    return;
  }
  // الملفات الثابتة (الأيقونات، qr.js، exceljs…): من الذاكرة فورًا مع تحديثها في الخلفية
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => save(e.request, r));
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});

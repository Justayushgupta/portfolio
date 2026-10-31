// Vercel serverless function (CommonJS): emails you when someone opens your portfolio.
// Env vars: RESEND_API_KEY (from resend.com), NOTIFY_TO (the email you signed up to Resend with)
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dec = (v) => { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } };

module.exports = async (req, res) => {
  // Open https://YOUR-SITE/api/notify in a browser to check setup (shows true/false only, no secrets)
  if (req.method === 'GET') {
    return res.status(200).json({ functionWorks: true, hasResendKey: !!process.env.RESEND_API_KEY, hasNotifyTo: !!process.env.NOTIFY_TO });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const h = req.headers;
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const ua = h['user-agent'] || body.ua || '';
  if (/bot|crawl|spider|lighthouse/i.test(ua)) return res.status(204).end();

  const ip = (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const city = dec(h['x-vercel-ip-city']) || '?';
  const region = dec(h['x-vercel-ip-country-region']) || '?';
  const country = h['x-vercel-ip-country'] || '?';
  const lat = h['x-vercel-ip-latitude'], lon = h['x-vercel-ip-longitude'];
  const map = lat && lon ? `https://www.google.com/maps?q=${lat},${lon}` : '';

  const html = `<h2>New visitor on your portfolio</h2>
<p><b>IP:</b> ${esc(ip)}<br><b>Approx. location:</b> ${esc(city)}, ${esc(region)}, ${esc(country)}
${map ? `<br><a href="${map}">Open on map</a> (city-level, not exact)` : ''}</p>
<p><b>Timezone:</b> ${esc(body.tz)}<br><b>Language:</b> ${esc(body.lang)}<br>
<b>Came from:</b> ${esc(body.ref) || 'direct'}<br><b>Device:</b> ${esc(ua)}<br>
<b>Time (UTC):</b> ${new Date().toISOString()}</p>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Portfolio Alerts <onboarding@resend.dev>',
        to: [process.env.NOTIFY_TO],
        subject: `Portfolio visit: ${city}, ${country}`,
        html,
      }),
    });
    const out = await r.text();
    console.log('Resend status', r.status, out); // visible in Vercel > Logs
    return res.status(200).json({ resendStatus: r.status });
  } catch (e) {
    console.log('Resend error', String(e));
    return res.status(200).json({ error: String(e) });
  }
};

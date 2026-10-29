// Vercel serverless function: emails you when someone opens your portfolio.
// Env vars (Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY = key from resend.com (free tier)
//   NOTIFY_TO      = your email (the one you signed up to Resend with)
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const h = req.headers;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const ua = h['user-agent'] || body.ua || '';
  if (/bot|crawl|spider|preview|vercel|lighthouse/i.test(ua)) return res.status(204).end();

  const ip = (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
  const city = dec(h['x-vercel-ip-city']) || '?';
  const region = dec(h['x-vercel-ip-country-region']) || '?';
  const country = h['x-vercel-ip-country'] || '?';
  const lat = h['x-vercel-ip-latitude'];
  const lon = h['x-vercel-ip-longitude'];
  const map = lat && lon ? `https://www.google.com/maps?q=${lat},${lon}` : '';

  const html = `<h2>New visitor on your portfolio</h2>
<p><b>IP:</b> ${esc(ip)}<br><b>Approx. location:</b> ${esc(city)}, ${esc(region)}, ${esc(country)}
${map ? `<br><a href="${map}">Open on map</a> (city-level, not exact)` : ''}</p>
<p><b>Timezone:</b> ${esc(body.tz)}<br><b>Language:</b> ${esc(body.lang)}<br>
<b>Came from:</b> ${esc(body.ref) || 'direct'}<br><b>Device:</b> ${esc(ua)}<br>
<b>Time (UTC):</b> ${new Date().toISOString()}</p>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Portfolio Alerts <onboarding@resend.dev>',
        to: process.env.NOTIFY_TO,
        subject: `Portfolio visit: ${city}, ${country}`,
        html,
      }),
    });
  } catch (e) { /* never break the visitor's page */ }
  res.status(200).json({ ok: true });
}

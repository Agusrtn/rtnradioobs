export default async function handler(req, res) {
  const upstream = 'https://rtn-music.vercel.app/api/radio-stream';
  const qs = req.url && req.url.includes('?') ? req.url.split('?')[1] : 'format=json';
  const target = upstream + (qs ? ('?' + qs) : '');
  try {
    const r = await fetch(target, { cache: 'no-store' });
    const body = await r.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(r.status).send(body);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: String(err) });
  }
}

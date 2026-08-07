// POST /api/upload-image
// Body: { imageBase64: "<base64 image data, no data: prefix>" }
// Returns: { url: "https://i.imgur.com/xxxxx.png" }
//
// This runs on Vercel's servers, not in the browser — so every upload
// goes out from Vercel's IP, not the visitor's. That sidesteps the
// residential-ISP shared-IP rate-limit problem entirely (many customers
// behind one NAT'd IP exhausting Imgur's anonymous per-IP quota), and it
// keeps the Imgur Client-ID out of the page source, where anyone could
// otherwise read it out and use it themselves.
//
// Setup: in the Vercel project dashboard → Settings → Environment
// Variables, add IMGUR_CLIENT_ID with the Client-ID from
// https://api.imgur.com/oauth2/addclient ("Anonymous usage without user
// authorization"), then redeploy.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'Server not configured: IMGUR_CLIENT_ID environment variable is missing' });
    return;
  }

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing imageBase64 in request body' });
      return;
    }

    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ image: imageBase64, type: 'base64' }),
    });

    const data = await imgurRes.json().catch(() => null);

    if (!imgurRes.ok || !data || !data.success || !data.data || !data.data.link) {
      const message = (data && data.data && data.data.error) || `Imgur returned HTTP ${imgurRes.status}`;
      res.status(imgurRes.status && imgurRes.status >= 400 ? imgurRes.status : 502).json({ error: message });
      return;
    }

    res.status(200).json({ url: data.data.link });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Upload failed' });
  }
};

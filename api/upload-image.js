// POST /api/upload-image
// Body: { imageBase64: "<base64 image data, no data: prefix>" }
// Returns: { url: "https://i.ibb.co/xxxxx/filename.png" }
//
// This runs on Vercel's servers, not in the browser — so every upload
// goes out from Vercel's IP, not the visitor's. That sidesteps
// residential-ISP shared-IP rate-limit problems entirely, and it keeps
// the ImgBB API key out of the page source, where anyone could
// otherwise read it out and use it themselves (ImgBB's own docs
// explicitly recommend keeping the key server-side for this reason).
//
// Setup: in the Vercel project dashboard → Settings → Environment
// Variables, add IMGBB_API_KEY with the key from
// https://api.imgbb.com/ ("Get API key", after creating a free
// imgbb.com account — email or Google/Facebook login both work), then
// redeploy.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured: IMGBB_API_KEY environment variable is missing' });
    return;
  }

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing imageBase64 in request body' });
      return;
    }

    // ImgBB takes the key as a query param (not an Authorization header,
    // unlike Imgur) and the image as a form field. POST is required —
    // ImgBB's own docs warn GET can corrupt base64 data via URL encoding.
    const uploadUrl = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`;
    const imgbbRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ image: imageBase64 }),
    });

    const data = await imgbbRes.json().catch(() => null);

    if (!imgbbRes.ok || !data || !data.success || !data.data || !data.data.url) {
      const message = (data && data.error && data.error.message) || `ImgBB returned HTTP ${imgbbRes.status}`;
      res.status(imgbbRes.status && imgbbRes.status >= 400 ? imgbbRes.status : 502).json({ error: message });
      return;
    }

    res.status(200).json({ url: data.data.url });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Upload failed' });
  }
};

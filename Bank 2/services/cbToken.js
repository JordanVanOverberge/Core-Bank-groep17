// Fetches and caches a Bearer token from the Clearing Bank.
// Tokens are valid for 4 hours; we refresh 5 minutes before expiry.
let _token     = null;
let _expiresAt = 0;

async function getCBToken() {
  if (_token && Date.now() < _expiresAt) return _token;

  const res = await fetch(`${process.env.CB_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bic: process.env.BIC, secret: process.env.CB_SECRET })
  });

  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(`CB token error: ${JSON.stringify(data)}`);

  _token = data.data?.token ?? data.token;
  if (!_token) throw new Error('CB stuurde geen token in de response');

  _expiresAt = Date.now() + 4 * 60 * 60 * 1000 - 5 * 60 * 1000; // 3h55m

  return _token;
}

module.exports = { getCBToken };

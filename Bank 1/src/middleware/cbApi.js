const axios = require('axios');

const CB_URL = process.env.CB_URL;
let cachedToken = null;

async function getToken() {
  if (cachedToken) return cachedToken;

  const res = await axios.post(`${CB_URL}/token`, {
    bic: process.env.BANK_BIC,
    secret_key: process.env.BANK_SECRET_KEY,
  });

  cachedToken = res.data.token;
  // Token expires after 4h, reset after 3h55
  setTimeout(() => { cachedToken = null; }, 3 * 60 * 60 * 1000 + 55 * 60 * 1000);
  return cachedToken;
}

async function sendPoToCb(poList) {
  const token = await getToken();
  const res = await axios.post(`${CB_URL}/po_in`, { data: poList }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function fetchPoFromCb() {
  const token = await getToken();
  const res = await axios.get(`${CB_URL}/po_out`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function fetchAckOut() {
  const token = await getToken();
  const res = await axios.get(`${CB_URL}/ack_out`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function sendAckIn(ackList) {
  const token = await getToken();
  const res = await axios.post(`${CB_URL}/ack_in`, { data: ackList }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function fetchBanks() {
  const token = await getToken();
  const res = await axios.get(`${CB_URL}/banks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

module.exports = { getToken, sendPoToCb, fetchPoFromCb, fetchAckOut, sendAckIn, fetchBanks };

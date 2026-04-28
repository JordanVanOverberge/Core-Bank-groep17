/**
 * Test script voor alle API endpoints
 * Alle endpoints moeten dit format returnen:
 * { ok: true/false, status: 200, code: 2000, message: "...", data: [...] }
 */

const BASE_URL = 'http://localhost:3001/api';
const CB_SECRET = process.env.CB_SECRET || '23f67d88559ecdba';

const endpoints = [
  { method: 'GET',  path: '/help',              auth: false, desc: 'Help lijst' },
  { method: 'GET',  path: '/info',              auth: false, desc: 'Bank info' },
  { method: 'GET',  path: '/accounts',          auth: false, desc: 'Alle rekeningen' },
  { method: 'GET',  path: '/po_new_generate?count=2&min=1&max=100', auth: false, desc: 'Willekeurige POs genereren' },
  { method: 'GET',  path: '/po_new_process',    auth: false, desc: 'POs verwerken' },
  { method: 'GET',  path: '/po_out',            auth: false, desc: 'Uitgaande POs' },
  { method: 'GET',  path: '/ack_out',           auth: false, desc: 'Uitgaande ACKs' },
  { method: 'GET',  path: '/transactions',      auth: false, desc: 'Transacties' },
  { method: 'GET',  path: '/logs',              auth: false, desc: 'Logs' },
];

async function test() {
  console.log('🔍 Testen van alle API endpoints...\n');
  
  for (const ep of endpoints) {
    const method = ep.method;
    const url = BASE_URL + ep.path;
    const headers = { 'Content-Type': 'application/json' };
    
    if (ep.auth) {
      headers['Authorization'] = `Bearer ${CB_SECRET}`;
    }

    try {
      const options = { method, headers };
      const res = await fetch(url, options);
      const data = await res.json();
      
      // Valideer response format
      const isValid = 
        data.hasOwnProperty('ok') &&
        data.hasOwnProperty('status') &&
        data.hasOwnProperty('code') &&
        data.hasOwnProperty('message') &&
        data.hasOwnProperty('data');
      
      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${method.padEnd(6)} ${ep.path.padEnd(40)} (${res.status})`);
      
      if (!isValid) {
        console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}`);
      }
    } catch (err) {
      console.log(`❌ ${method.padEnd(6)} ${ep.path.padEnd(40)} ERROR: ${err.message}`);
    }
  }
  
  console.log('\n✅ Test voltooid!\n');
}

test();
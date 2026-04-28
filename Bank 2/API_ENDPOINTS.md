# 🏦 PingFin Bank 2 (GKCCBEBB) - API Endpoints
 
## Bankgegevens
- **BIC:** GKCCBEBB
- **Poort:** 3001
- **Database:** pingfin_gkcc
- **Status:** ✅ Alle endpoints operationeel
 
## 📋 Alle Endpoints
 
### Openbare Endpoints (geen auth vereist)
 
#### GET /api/help
- **Beschrijving:** Helplijst met alle beschikbare endpoints
- **Response:** Array van endpoint definities
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
#### GET /api/info
- **Beschrijving:** Bank informatie (BIC, naam, teamleden)
- **Response:** Object met bank details
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: {...} }`
 
#### GET /api/accounts
- **Beschrijving:** Alle rekeningen in de database
- **Response:** Array van accounts
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
### Payment Order (PO) Endpoints
 
#### GET /api/po_new_generate
- **Beschrijving:** Willekeurige POs genereren
- **Query params:**
  - `count` (default: 3, max: 20)
  - `min` (default: 1)
  - `max` (default: 500, max: 999999.99)
- **Response:** Array van gegenereerde POs
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
#### POST /api/po_new_add
- **Beschrijving:** Handmatig POs toevoegen
- **Body:** `{ "data": [ { po_amount, po_message, oa_id, bb_id, ba_id }, ... ] }`
- **Response:** Bevestiging van toevoeging
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [] }`
 
#### GET /api/po_new_process
- **Beschrijving:** POs valideren en verwerken
  - Interne betalingen: direkt verwerken
  - Externe betalingen: naar CB sturen
  - Ongeldige: weigeren
- **Response:** Verwerking summary
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: {...} }`
 
#### GET /api/po_out
- **Beschrijving:** Alle uitgaande POs
- **Response:** Array van po_out records
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
### Inkomende Payment Order Endpoint (beveiligd)
 
#### POST /api/po_in
- **Beschrijving:** POs ontvangen van andere banken via CB
- **Auth:** Bearer token vereist
- **Header:** `Authorization: Bearer <CB_SECRET>`
- **Body:** `{ "data": [ { po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id }, ... ] }`
- **Response:** Array van verwerkte ACKs
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
### Acknowledgment (ACK) Endpoints
 
#### POST /api/ack_in
- **Beschrijving:** ACKs ontvangen van CB
- **Auth:** Bearer token vereist
- **Header:** `Authorization: Bearer <CB_SECRET>`
- **Body:** `{ "data": [ { po_id, po_amount, ..., bb_code, bb_datetime }, ... ] }`
- **Response:** Array van opgeslagen ACKs
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
#### GET /api/ack_out
- **Beschrijving:** Alle uitgaande ACKs
- **Response:** Array van ack_out records
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
### Data Endpoints
 
#### GET /api/transactions
- **Beschrijving:** Alle transacties
- **Response:** Array van transaction records
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
#### GET /api/logs
- **Beschrijving:** Alle logs (nieuwste eerst)
- **Response:** Array van log records
- **Format:** `{ ok: true, status: 200, code: 2000, message: "...", data: [...] }`
 
---
 
## 🔐 Authenticatie
 
POST endpoints vereisen Bearer token:
```
Authorization: Bearer 23f67d88559ecdba
```
 
## ✅ Response Format
 
Alle endpoints volgen dit format:
```json
{
  "ok": true/false,
  "status": 200/400/401/500,
  "code": 2000,
  "message": "Beschrijving van response",
  "data": [] // Array of object
}
```
 
## 🧪 Testen
 
```bash
node test-endpoints.js
```
 
---
 
**Opgesteld:** 28 april 2026
**Bank:** PingFin Centrale (GKCCBEBB)
**Database:** pingfin_gkcc
# CoreBank 2 — GKCCBEBB

**Groep 17**

**Teamleden:**
- Moussa Ismaël
- Van Overberge Jordan
- Boulhefa Anas
- Bentatou Yasmina

## Installatie

1. Clone de repository.
2. Installeer dependencies: `npm install`
3. Stel de database op met `schema.sql`.
4. Configureer `.env` bestand met de juiste variabelen.
5. Start de applicatie: `npm start`

## Endpoints

Alle endpoints retourneren responses in dit formaat:
```json
{
  "ok": true/false,
  "status": 200,
  "code": 2000,
  "message": "...",
  "data": [...]
}
```

### GET /api/help
Helplijst met alle endpoints.

### GET /api/info
Bank informatie (BIC, naam, teamleden).

### GET /api/accounts
Alle rekeningen.

### GET /api/po_new_generate
Willekeurige POs genereren. Params: count, min, max.

### POST /api/po_new_add
Manueel POs toevoegen aan po_new. Body: { "data": [...] }

### GET /api/po_new_process
POs valideren en versturen naar CB.

### POST /api/po_in
POs ontvangen van andere bank (Bearer vereist).

### GET /api/po_out
Inhoud po_out tabel.

### GET /api/ack_out
Inhoud ack_out tabel.

### GET /api/ack_in
Inhoud ack_in tabel.

### GET /api/transactions
Alle transacties.

### GET /api/logs
Alle logs (nieuwste eerst).

## Foutcodes

- 2000: OK
- 4000: Bad Request
- 4001: Interne betaling – niet naar CB sturen
- 4002: Bedrag is te hoog (max 500 euro)
- 4003: Bedrag is negatief of nul
- 4004: Ontvangende IBAN ongeldig (moet BE + 14 cijfers zijn)
- 4005: BIC ongeldig (moet 8 of 11 tekens zijn)
- 4006: PO_ID ongeldig (moet beginnen met GKCCBEBB_)
- 5000: Internal Server Error
- 5002: CB fout
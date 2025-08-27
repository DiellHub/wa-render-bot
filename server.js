const express = require("express");
const QRCode = require("qrcode");
const axios = require("axios");
const { Client, LocalAuth } = require("whatsapp-web.js");

const SAVE_URL = process.env.SAVE_URL;   // es: https://gestionaleid.netsons.org/save.php
const SAVE_TOKEN = process.env.SAVE_TOKEN; // lo stesso token messo in save.php
const PORT = process.env.PORT || 3000;

let latestQR = null;
let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth(), // su Render free, la sessione NON è persistente ai redeploy
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
});

client.on("qr", (qr) => {
  latestQR = qr;
  console.log("[QR] Aggiornato. Apri /qr per scansionarlo.");
});

client.on("authenticated", () => console.log("✅ Autenticato"));
client.on("ready", () => {
  isReady = true;
  console.log("✅ Bot pronto su Render!");
});

client.on("disconnected", (reason) => {
  isReady = false;
  console.log("⚠️ Disconnesso:", reason);
});

client.on("message", async (msg) => {
  try {
    if (!SAVE_URL || !SAVE_TOKEN) return; // se non configurato, skip
    await axios.post(SAVE_URL, new URLSearchParams({
      token: SAVE_TOKEN,
      from: msg.from,
      body: msg.body
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log("📝 Messaggio inoltrato a Netsons:", msg.from);
  } catch (err) {
    console.error("Errore invio a Netsons:", err.message);
  }
});

client.initialize();

const app = express();

// Pagina QR (immagine inline, nessun servizio esterno)
app.get("/qr", async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!latestQR) {
    return res.end(`<h3>Nessun QR al momento.</h3>
    <p>Se hai appena deployato, attendi qualche secondo o controlla i log.</p>
    <a href="/qr">Aggiorna</a>`);
  }
  try {
    const dataUrl = await QRCode.toDataURL(latestQR);
    res.end(`<h2>Scansiona con WhatsApp → Dispositivi collegati</h2>
      <img src="${dataUrl}" alt="QR" />
      <p><a href="/qr">Aggiorna</a></p>`);
  } catch (e) {
    res.status(500).end("Errore generazione QR");
  }
});

// Healthcheck per UptimeRobot
app.get("/healthz", (req, res) => {
  res.json({ ok: true, ready: isReady });
});

// Info
app.get("/", (req, res) => {
  res.type("text/plain").send(
    `WA bot running. Ready=${isReady}. Visita /qr per scansionare.`
  );
});

app.listen(PORT, () => {
  console.log(`HTTP server su :${PORT}`);
});

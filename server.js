const express = require("express");
const QRCode = require("qrcode");
const axios = require("axios");
const { Client, LocalAuth } = require("whatsapp-web.js");

const SAVE_URL = process.env.SAVE_URL;
const SAVE_TOKEN = process.env.SAVE_TOKEN;
const PORT = process.env.PORT || 10000; // Render usa la porta 10000 di default

let latestQR = null;
let isReady = false;
let statusMessage = "Inizializzazione...";

console.log("🚀 Avvio del bot...");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    // Argomenti essenziali per ambienti con poche risorse come Render
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- importante per ridurre la RAM
      '--disable-gpu'
    ]
  }
});

// Log più dettagliati
client.on("qr", (qr) => {
  latestQR = qr;
  statusMessage = "QR Code ricevuto. Scansiona per continuare.";
  console.log("[QR] Aggiornato. Apri /qr per scansionarlo.");
});

client.on("loading_screen", (percent, message) => {
    console.log(`⏳ Caricamento: ${percent}% - ${message}`);
    statusMessage = `Caricamento: ${percent}% - ${message}`;
});

client.on("authenticated", () => {
  statusMessage = "Autenticazione riuscita. In attesa della prontezza del bot...";
  console.log("✅ Autenticato");
});

client.on('auth_failure', msg => {
    statusMessage = `Autenticazione fallita: ${msg}`;
    console.error('❌ ERRORE AUTENTICAZIONE', msg);
});

client.on("ready", () => {
  isReady = true;
  statusMessage = "Bot pronto e operativo!";
  console.log("✅ Bot pronto su Render!");
});

client.on("disconnected", (reason) => {
  isReady = false;
  statusMessage = `Disconnesso: ${reason}. Riavvio in corso...`;
  console.log("⚠️ Disconnesso:", reason);
  // Potrebbe essere necessario un riavvio o una re-inizializzazione qui
  client.initialize();
});

client.on("message", async (msg) => {
  try {
    if (!isReady) return; // Non processare messaggi se non è pronto
    if (!SAVE_URL || !SAVE_TOKEN) return;
    
    await axios.post(SAVE_URL, new URLSearchParams({
      token: SAVE_TOKEN,
      from: msg.from,
      body: msg.body
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log("📝 Messaggio inoltrato a Netsons:", msg.from);
  } catch (err) {
    console.error("Errore invio a Netsons:", err.response ? err.response.data : err.message);
  }
});

client.initialize();

const app = express();

app.get("/qr", async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!latestQR) {
    return res.end(`<h3>Nessun QR al momento.</h3>
    <p>Stato attuale: ${statusMessage}</p>
    <p>Se hai appena deployato, attendi qualche secondo o controlla i log.</p>
    <p><a href="/qr">Aggiorna</a></p>`);
  }
  try {
    const dataUrl = await QRCode.toDataURL(latestQR);
    res.end(`<h2>Scansiona con WhatsApp → Dispositivi collegati</h2>
      <img src="${dataUrl}" alt="QR" />
      <p>Stato: ${statusMessage}</p>
      <p><a href="/qr">Aggiorna</a></p>`);
  } catch (e) {
    res.status(500).end("Errore generazione QR");
  }
});

app.get("/", (req, res) => {
  res.type("text/plain").send(
    `WA bot running. Ready=${isReady}. Status: ${statusMessage}`
  );
});

app.listen(PORT, () => {
  console.log(`✅ Server HTTP in ascolto sulla porta: ${PORT}`);
});

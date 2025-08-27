const express = require("express");
const fs = require('fs');
const QRCode = require("qrcode");
const axios = require("axios");
const { Client, LocalAuth } = require("whatsapp-web.js");

const SAVE_URL = process.env.SAVE_URL;
const SAVE_TOKEN = process.env.SAVE_TOKEN;
const PORT = process.env.PORT || 10000;

let latestQR = null;
let isReady = false;
let statusMessage = "Inizializzazione...";

console.log("🚀 Avvio del bot...");

// --- NUOVO LOG: Verifica delle variabili d'ambiente ---
console.log(`🔗 SAVE_URL impostato: ${SAVE_URL ? 'Sì' : 'No'}`);
console.log(`🔑 SAVE_TOKEN impostato: ${SAVE_TOKEN ? 'Sì' : 'No'}`);
// ----------------------------------------------------

const SESSION_FOLDER_PATH = './.wwebjs_auth/';
if (fs.existsSync(SESSION_FOLDER_PATH)) {
    console.log('🧹 Pulizia della sessione precedente...');
    fs.rmSync(SESSION_FOLDER_PATH, { recursive: true, force: true });
    console.log('✅ Sessione precedente rimossa con successo.');
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Aggiunto per ambienti con risorse limitate
      '--disable-gpu'
    ]
  }
});

client.on("qr", (qr) => {
  latestQR = qr;
  isReady = false;
  statusMessage = "QR Code ricevuto. Scansiona per continuare.";
  console.log("[QR] Aggiornato. Apri /qr per scansionarlo.");
});

client.on("loading_screen", (percent, message) => {
    console.log(`⏳ Caricamento: ${percent}% - ${message}`);
    statusMessage = `Caricamento: ${percent}% - ${message}`;
});

client.on("authenticated", () => {
  statusMessage = "Autenticazione riuscita. In attesa della prontezza del bot...";
  console.log("✅ Autenticato. In attesa dell'evento 'ready'...");
});

client.on('auth_failure', msg => {
    statusMessage = `Autenticazione fallita: ${msg}`;
    console.error('❌ ERRORE AUTENTICAZIONE', msg);
});

client.on("ready", () => {
  isReady = true;
  latestQR = null;
  statusMessage = "Bot pronto e operativo!";
  // --- NUOVO LOG: Conferma che il bot è pronto ---
  console.log("✅✅✅ BOT PRONTO! Da ora ascolterà i messaggi. ✅✅✅");
  // ---------------------------------------------
});

client.on("disconnected", (reason) => {
  isReady = false;
  statusMessage = `Disconnesso: ${reason}. Il servizio si riavvierà automaticamente.`;
  console.log(`⚠️ Disconnesso: ${reason}. In attesa del riavvio automatico di Render.`);
});

client.on("message", async (msg) => {
  // --- NUOVO LOG: Rilevamento di ogni messaggio in arrivo ---
  console.log(`📩 Messaggio ricevuto da ${msg.from}. Controllo lo stato...`);
  // -------------------------------------------------------

  if (!isReady) {
    console.log("   -> Stato non pronto (isReady=false), messaggio ignorato.");
    return;
  }
  if (!SAVE_URL || !SAVE_TOKEN) {
    console.log("   -> URL o TOKEN mancanti, messaggio ignorato.");
    return;
  }
  
  console.log("   -> Bot pronto, URL e TOKEN presenti. Tento l'invio a Netsons...");
  try {
    await axios.post(SAVE_URL, new URLSearchParams({
      token: SAVE_TOKEN,
      from: msg.from,
      body: msg.body
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log("   -> ✅ Messaggio inoltrato con successo a Netsons.");
  } catch (err) {
    console.error("   -> ❌ Errore durante l'invio a Netsons:", err.response ? err.response.data : err.message);
  }
});

client.initialize();

const app = express();

app.get("/qr", async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (isReady) {
    return res.end(`<h3>✅ Bot già connesso e operativo!</h3><p>Stato: ${statusMessage}</p>`);
  }
  if (!latestQR) {
    return res.end(`<h3>Nessun QR al momento.</h3>
    <p>Stato attuale: ${statusMessage}</p>
    <p>Attendi qualche secondo o controlla i log.</p>
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

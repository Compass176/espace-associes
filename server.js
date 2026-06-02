/**
 * ============================================================
 *  L'Espace Associés — Serveur de commandes
 *  Node.js + Express + WebSocket
 *  Compatible local ET hébergement en ligne (Render, Railway…)
 *
 *  Démarrage local : node server.js
 *  Prérequis       : npm install express ws
 * ============================================================
 */

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// Render impose son propre port via la variable d'environnement PORT
// En local, on retombe sur 3000
const PORT = process.env.PORT || 3000;

// ── Stockage des commandes en mémoire ─────────────────────────
// (Render ne permet pas l'écriture de fichiers en plan gratuit)
let commandes = [];

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());

// Autorise les requêtes cross-origin (utile en hébergement cloud)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Clients WebSocket connectés ───────────────────────────────
const clients = new Set();

wss.on('connection', (ws, req) => {
  const role = new URL(req.url, 'http://localhost').searchParams.get('role') || 'inconnu';
  ws.role = role;
  clients.add(ws);
  console.log(`[WS] Nouvelle connexion : role=${role}  (${clients.size} clients connectés)`);

  // Envoyer les 20 dernières commandes dès la connexion (pour la cuisine)
  const historique = lireCommandes().slice(-20);
  ws.send(JSON.stringify({ type: 'historique', commandes: historique }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Déconnexion : role=${role}  (${clients.size} clients restants)`);
  });
});

// ── Diffuser un message à tous les clients connectés ──────────
function diffuser(message) {
  const data = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// ── Lire / écrire les commandes en mémoire ───────────────────
function lireCommandes() {
  return commandes;
}

function sauvegarderCommande(commande) {
  commandes.push(commande);
}

// ── Route POST /commande — reçoit une commande du mobile ──────
app.post('/commande', (req, res) => {
  const { table, items, heure } = req.body;

  // Validation minimale
  if (!table || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ erreur: 'Commande invalide' });
  }

  // Calcul du total
  const total = items.reduce((sum, i) => sum + (i.prix * i.qty), 0);

  // Construction de l'objet commande
  const commande = {
    id:     Date.now(),          // identifiant unique
    table,
    items,
    total:  Math.round(total * 100) / 100,
    heure:  heure || new Date().toLocaleTimeString('fr-FR'),
    statut: 'nouvelle'           // nouvelle | en_cours | servie
  };

  // Sauvegarde dans le fichier JSON
  sauvegarderCommande(commande);

  // Diffusion en temps réel à la cuisine et aux serveurs
  diffuser({ type: 'nouvelle_commande', commande });

  console.log(`[CMD] Table ${table} — ${items.length} article(s) — ${total.toFixed(2)} €`);

  res.status(201).json({ succes: true, id: commande.id });
});

// ── Route GET /commandes — liste toutes les commandes ─────────
app.get('/commandes', (req, res) => {
  res.json(lireCommandes());
});

// ── Route PATCH /commande/:id — changer le statut ─────────────
app.patch('/commande/:id', (req, res) => {
  const id     = parseInt(req.params.id);
  const statut = req.body.statut;
  const valides = ['nouvelle', 'en_cours', 'servie'];

  if (!valides.includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide' });
  }

  const liste = lireCommandes();
  const index = liste.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ erreur: 'Commande introuvable' });
  }

  liste[index].statut = statut;

  // Notifier tous les clients du changement de statut
  diffuser({ type: 'maj_statut', id, statut });

  console.log(`[MAJ] Commande #${id} → ${statut}`);
  res.json({ succes: true });
});

// ── Route DELETE /commandes — vider le log (fin de service) ───
app.delete('/commandes', (req, res) => {
  commandes = [];
  diffuser({ type: 'reinitialisation' });
  console.log('[RESET] Toutes les commandes effacées');
  res.json({ succes: true });
});

// ── Démarrage ────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   L\'Espace Associés — Serveur démarré    ║');
  console.log(`║   Port : ${PORT}                              ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  En attente de commandes...');
  console.log('');
});

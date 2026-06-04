/**
 * ============================================================
 *  L'Espace Associés — Serveur de commandes v2
 *  Node.js + Express + WebSocket + MongoDB
 * ============================================================
 */

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || '';

// ── Connexion MongoDB ─────────────────────────────────────────
let db;
async function connecterDB() {
  if (!MONGO_URI) {
    console.log('[DB] Pas de MONGO_URI — mode mémoire activé');
    return;
  }
  try {
    const client = await MongoClient.connect(MONGO_URI);
    db = client.db('espace-associes');
    console.log('[DB] MongoDB connecté');
    await initialiserMenu();
  } catch (e) {
    console.error('[DB] Erreur connexion:', e.message);
  }
}

// Menu par défaut (utilisé si la DB est vide)
const MENU_DEFAUT = [
  {
    categorie: 'Menu midi', service: '12:00 – 14:00', ordre: 1, actif: true,
    plats: [
      { nom: 'Soupe du jour', description: 'Lentille corail', prix: 5.00, actif: true, plat_du_jour: true },
      { nom: 'Quiche du jour & mesclun', description: 'Thon', prix: 9.90, actif: true, plat_du_jour: false },
      { nom: 'Salade Caesar', description: 'Romaine, poulet, crouton, tomate marinée, sauce césar', prix: 13.00, actif: true, plat_du_jour: false },
      { nom: 'Salade Parisienne', description: 'Laitue, pomme de terre, jambon, œuf dur, champignon, crouton', prix: 11.50, actif: true, plat_du_jour: false },
      { nom: 'Paella de gambas', description: '', prix: 15.00, actif: true, plat_du_jour: true },
      { nom: 'Assiette de fromages & salade verte', description: 'Fourme d\'Ambert, chaource, tomme', prix: 4.50, actif: true, plat_du_jour: false }
    ]
  },
  {
    categorie: 'La Plancha', service: '12:00 – 14:00', ordre: 2, actif: true,
    plats: [
      { nom: 'Pavé de rumsteak', description: '', prix: 14.00, actif: true, plat_du_jour: false },
      { nom: 'Lieu noir', description: '', prix: 11.00, actif: true, plat_du_jour: false },
      { nom: 'Filet de poulet', description: '', prix: 12.00, actif: true, plat_du_jour: false },
      { nom: 'Œufs au plat', description: '', prix: 8.50, actif: true, plat_du_jour: false }
    ],
    notes: [
      { titre: 'Garnitures au choix', texte: 'Grenailles au four · Boulgour · Petits pois · Carotte' },
      { titre: 'Sauce au choix', texte: 'Sauce vierge · Sauce au bleu' }
    ]
  },
  {
    categorie: 'Menu après-midi', service: '14:00 – 15:30', ordre: 3, actif: true,
    plats: [
      { nom: 'Wrap & mesclun', description: '', prix: 7.00, actif: true, plat_du_jour: false },
      { nom: 'Salade Caesar', description: '', prix: 13.00, actif: true, plat_du_jour: false },
      { nom: 'Salade Parisienne', description: '', prix: 11.50, actif: true, plat_du_jour: false },
      { nom: 'Quiche & mesclun', description: '', prix: 9.90, actif: true, plat_du_jour: false },
      { nom: 'Croque-Monsieur & mesclun', description: '', prix: 9.90, actif: true, plat_du_jour: false }
    ]
  }
];

async function initialiserMenu() {
  if (!db) return;
  const count = await db.collection('menu').countDocuments();
  if (count === 0) {
    await db.collection('menu').insertMany(MENU_DEFAUT);
    console.log('[DB] Menu par défaut inséré');
  }
}

async function lireMenu() {
  if (!db) return MENU_DEFAUT;
  return await db.collection('menu').find({ actif: true }).sort({ ordre: 1 }).toArray();
}

async function lireCommandes(filtre = {}) {
  if (!db) return [];
  return await db.collection('commandes').find(filtre).sort({ id: -1 }).toArray();
}

async function sauvegarderCommande(commande) {
  if (!db) return;
  await db.collection('commandes').insertOne(commande);
}

async function mettreAJourStatut(id, statut) {
  if (!db) return;
  await db.collection('commandes').updateOne({ id }, { $set: { statut } });
}

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, PUT');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth admin simple ─────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
function authAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== 'Bearer ' + ADMIN_PASSWORD) {
    return res.status(401).json({ erreur: 'Non autorisé' });
  }
  next();
}

// ── WebSocket ─────────────────────────────────────────────────
const clients = new Set();
wss.on('connection', async (ws, req) => {
  const role = new URL(req.url, 'http://localhost').searchParams.get('role') || 'inconnu';
  ws.role = role;
  clients.add(ws);
  const historique = (await lireCommandes()).slice(-20);
  ws.send(JSON.stringify({ type: 'historique', commandes: historique }));
  ws.on('close', () => clients.delete(ws));
});

function diffuser(message) {
  const data = JSON.stringify(message);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });
}

// ── Routes menu public ────────────────────────────────────────
app.get('/api/menu', async (req, res) => {
  res.json(await lireMenu());
});

// ── Routes commandes ──────────────────────────────────────────
app.post('/commande', async (req, res) => {
  const { table, items, heure } = req.body;
  if (!table || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ erreur: 'Commande invalide' });

  const total = items.reduce((sum, i) => sum + (i.prix * i.qty), 0);
  const now = new Date();
  const commande = {
    id: Date.now(),
    table, items,
    total: Math.round(total * 100) / 100,
    heure: heure || now.toLocaleTimeString('fr-FR'),
    date: now.toISOString().split('T')[0],
    semaine: getSemaine(now),
    mois: now.toISOString().slice(0, 7),
    statut: 'nouvelle'
  };

  await sauvegarderCommande(commande);
  diffuser({ type: 'nouvelle_commande', commande });
  console.log(`[CMD] Table ${table} — ${total.toFixed(2)} €`);
  res.status(201).json({ succes: true, id: commande.id });
});

app.get('/commandes', async (req, res) => {
  res.json(await lireCommandes());
});

app.patch('/commande/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { statut } = req.body;
  if (!['nouvelle', 'en_cours', 'servie'].includes(statut))
    return res.status(400).json({ erreur: 'Statut invalide' });
  await mettreAJourStatut(id, statut);
  diffuser({ type: 'maj_statut', id, statut });
  res.json({ succes: true });
});

app.delete('/commandes', async (req, res) => {
  if (db) await db.collection('commandes').deleteMany({ date: new Date().toISOString().split('T')[0] });
  diffuser({ type: 'reinitialisation' });
  res.json({ succes: true });
});

// ── Routes admin menu ─────────────────────────────────────────
app.get('/api/admin/menu', authAdmin, async (req, res) => {
  if (!db) return res.json(MENU_DEFAUT);
  res.json(await db.collection('menu').find({}).sort({ ordre: 1 }).toArray());
});

app.put('/api/admin/menu/:id', authAdmin, async (req, res) => {
  if (!db) return res.json({ succes: true });
  await db.collection('menu').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );
  diffuser({ type: 'menu_mis_a_jour' });
  res.json({ succes: true });
});

app.put('/api/admin/menu/:catId/plat/:platIndex', authAdmin, async (req, res) => {
  if (!db) return res.json({ succes: true });
  const cat = await db.collection('menu').findOne({ _id: new ObjectId(req.params.catId) });
  if (!cat) return res.status(404).json({ erreur: 'Catégorie introuvable' });
  cat.plats[parseInt(req.params.platIndex)] = req.body;
  await db.collection('menu').updateOne(
    { _id: new ObjectId(req.params.catId) },
    { $set: { plats: cat.plats } }
  );
  diffuser({ type: 'menu_mis_a_jour' });
  res.json({ succes: true });
});

app.post('/api/admin/menu/:catId/plat', authAdmin, async (req, res) => {
  if (!db) return res.json({ succes: true });
  await db.collection('menu').updateOne(
    { _id: new ObjectId(req.params.catId) },
    { $push: { plats: req.body } }
  );
  diffuser({ type: 'menu_mis_a_jour' });
  res.json({ succes: true });
});

// ── Routes historique ─────────────────────────────────────────
app.get('/api/historique/jour/:date', authAdmin, async (req, res) => {
  const commandes = await lireCommandes({ date: req.params.date });
  res.json({ commandes, stats: calculerStats(commandes) });
});

app.get('/api/historique/semaine/:semaine', authAdmin, async (req, res) => {
  const commandes = await lireCommandes({ semaine: req.params.semaine });
  res.json({ commandes, stats: calculerStats(commandes) });
});

app.get('/api/historique/mois/:mois', authAdmin, async (req, res) => {
  const commandes = await lireCommandes({ mois: req.params.mois });
  res.json({ commandes, stats: calculerStats(commandes) });
});

// ── Utilitaires ───────────────────────────────────────────────
function getSemaine(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
}

function calculerStats(commandes) {
  const ca = commandes.reduce((sum, c) => sum + (c.total || 0), 0);
  const plats = {};
  commandes.forEach(c => {
    (c.items || []).forEach(i => {
      plats[i.nom] = (plats[i.nom] || 0) + i.qty;
    });
  });
  const topPlats = Object.entries(plats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nom, qty]) => ({ nom, qty }));
  return { nb_commandes: commandes.length, ca: Math.round(ca * 100) / 100, top_plats: topPlats };
}

// ── Démarrage ─────────────────────────────────────────────────
connecterDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   L'Espace Associés — Serveur v2 démarré ║`);
    console.log(`║   Port : ${PORT}                              ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
  });
});

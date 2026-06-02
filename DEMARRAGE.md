# L'Espace Associés — Guide de démarrage

## Prérequis
- Avoir installé **Node.js** (https://nodejs.org) sur le PC/Mac qui servira de serveur
- Tous les appareils (téléphones convives, iPad cuisine, téléphones serveurs) doivent être **sur le même Wi-Fi**

---

## Installation (une seule fois)

1. Ouvrir un terminal dans ce dossier `serveur-commandes`
2. Taper :
   ```
   npm install
   ```

---

## Démarrage chaque jour

1. Ouvrir un terminal dans ce dossier
2. Taper :
   ```
   node server.js
   ```
3. Le serveur affiche son adresse IP locale, par exemple :
   ```
   http://192.168.1.42:3000
   ```

> Sous Windows : `ipconfig` pour trouver votre IP locale
> Sous Mac/Linux : `ifconfig` ou `ip a`

---

## Adresses à ouvrir sur chaque appareil

| Appareil         | URL à ouvrir                        |
|------------------|-------------------------------------|
| Menu convive     | `http://192.168.1.42:3000?table=1`  |
| iPad cuisine     | `http://192.168.1.42:3000/cuisine`  |
| Mobile serveurs  | `http://192.168.1.42:3000/serveur`  |

> Remplacez `192.168.1.42` par l'IP affichée au démarrage du serveur.
> Pour le menu, changez `table=1` selon le numéro de table (table=2, table=3, etc.)

---

## QR codes par table (étape 5)

Générez un QR code pour chaque URL de table sur :
- https://www.qr-code-generator.com
- ou en utilisant le fichier `generer-qrcodes.html` (fourni à l'étape 5)

---

## Fin de service

Sur la page Cuisine, cliquer **"Fin de service"** pour effacer toutes les commandes.


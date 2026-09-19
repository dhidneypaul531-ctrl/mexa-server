# Mexa — Serveur (backend)

Ce dossier contient le serveur qui permet à PLUSIEURS personnes d'utiliser
Mexa EN MÊME TEMPS, à partir de n'importe où (via internet).

## Ce que contient ce projet

```
mexa-server/
├── server.js              -> point d'entrée du serveur
├── package.json
├── .env.example            -> modèle des variables secrètes
├── db/
│   ├── schema.sql           -> structure de la base de données
│   ├── migrate.js           -> crée les tables dans la base de données
│   ├── pool.js               -> connexion à la base de données
│   └── seed-first-business.js -> crée votre 1ère entreprise + 1er admin
├── middleware/
│   └── auth.js              -> vérifie que la personne est bien connectée
└── routes/
    ├── auth.js               -> connexion, mot de passe oublié
    ├── products.js           -> produits
    ├── sales.js              -> ventes (diminue le stock automatiquement)
    ├── cash.js               -> ouverture/fermeture de caisse
    ├── clients.js            -> clients + paiement de crédit
    ├── suppliers.js          -> fournisseurs
    ├── categories.js         -> catégories
    ├── services.js           -> services
    ├── expenses.js           -> dépenses
    ├── users.js              -> utilisateurs/caissiers (admin seulement)
    ├── stockins.js           -> entrées de stock (réapprovisionnement)
    ├── stockouts.js          -> sorties de stock (pertes, dommages...)
    └── reports.js            -> rapport résumé (ventes, bénéfice, top produits...)
```

## Étape 1 — Tester en local (sur votre ordinateur, avant de mettre en ligne)

1. Installez [Node.js](https://nodejs.org) si ce n'est pas déjà fait.
2. Ouvrez un terminal dans ce dossier, puis :
   ```
   npm install
   ```
3. Copiez `.env.example` en `.env` et remplissez `DATABASE_URL` avec une base
   PostgreSQL (vous pouvez en créer une gratuite sur Render, Railway, ou Neon.tech
   pour tester rapidement).
4. Créez les tables :
   ```
   npm run migrate
   ```
5. Créez votre première entreprise et votre premier admin :
   ```
   node db/seed-first-business.js "Mon Bar" admin motdepasse123
   ```
6. Démarrez le serveur :
   ```
   npm start
   ```
7. Le serveur tourne sur `http://localhost:3000`. Testez avec :
   ```
   curl http://localhost:3000/health
   ```
   Vous devez voir `{"status":"ok"}`.

## Étape 2 — Mettre le serveur en ligne (Render.com)

1. Créez un compte sur [render.com](https://render.com).
2. Mettez ce dossier `mexa-server` dans un dépôt GitHub (créez un compte
   GitHub si besoin, créez un nouveau dépôt, et poussez ces fichiers dedans).
3. Sur Render : **New +** → **PostgreSQL** → donnez un nom → créez. Une fois
   créée, copiez la valeur **"Internal Database URL"**.
4. Sur Render : **New +** → **Web Service** → connectez votre dépôt GitHub.
   - Build Command : `npm install`
   - Start Command : `npm start`
5. Dans l'onglet **Environment** du service, ajoutez les variables :
   - `DATABASE_URL` = (l'URL copiée à l'étape 3)
   - `JWT_SECRET` = une longue phrase secrète que vous inventez
   - `RESET_CODE` = votre code de récupération de mot de passe (comme avant)
   - `CORS_ORIGIN` = `*` (à restreindre plus tard à votre vrai site)
6. Déployez. Une fois en ligne, Render vous donne une adresse du type :
   `https://mexa-server.onrender.com`
7. Depuis votre ordinateur (avec `DATABASE_URL` pointant maintenant vers la
   base de Render), lancez une seule fois :
   ```
   npm run migrate
   node db/seed-first-business.js "Mon Bar" admin motdepasse123
   ```

## Étape 3 — Connecter le fichier HTML (frontend) à ce serveur

Dans le fichier `Mexa-Offline.html`, chaque endroit qui lit/écrit
`localStorage` doit être remplacé par un appel à ce serveur. Exemple :

```js
const API = "https://mexa-server.onrender.com/api";
let token = localStorage.getItem("token"); // le ticket reçu après connexion

async function apiGet(path) {
  const res = await fetch(API + path, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}
```

C'est l'étape la plus longue : chaque module (produits, clients, dépenses...)
doit être branché un par un, en suivant le modèle de `products.js` /
`sales.js` / `cash.js` déjà écrits.

## Ajouter d'autres modules si besoin

Tous les modules du cahier des charges sont déjà écrits (produits, ventes,
caisse, clients, fournisseurs, catégories, services, dépenses, utilisateurs,
entrées/sorties de stock, rapports). Si vous ajoutez un nouveau module plus
tard, construisez-le EXACTEMENT sur le modèle de `routes/products.js` : une
route GET (liste), POST (créer), PUT (modifier), DELETE (supprimer, réservé
à l'admin) — toujours filtrées par `business_id = req.user.businessId` pour
que chaque entreprise ne voie que ses propres données.

# 🌿 La Station Genval

Site web simple pour **La Station**, café & petite restauration à Genval.

## Structure
- `index.html` — page principale (et popup de fermeture)
- `style.css` — style clair et minimaliste
- `menu.html` — page du menu
- `mentions-legales.html` — mentions légales
- `images/` — logo, photos, favicon

## Déploiement sur GitHub Pages
1. Ouvrir les **Settings** du dépôt GitHub.
2. Aller dans **Pages**.
3. Sélectionner la branche `main` et le dossier `/ (root)`.
4. Le site sera disponible à :  
   👉 https://gustomucho.github.io/lastation-genval

---

## Réactiver le popup pour de prochaines vacances

Le site peut afficher un **popup** sur la page d’accueil pour annoncer une fermeture
(été, Noël, etc.). Voici comment le remettre en route, même sans être développeur.

### Fichier à modifier
Ouvre uniquement **`index.html`**.

Tu dois changer **2 endroits** dans ce fichier :
1. le **texte** du popup (en haut de la page, juste après `<body>`)
2. le **script** du popup (tout en bas de la page, avant `</body>`)

### Étape 1 — Modifier le message

Cherche le bloc qui commence par `POPUP DE FERMETURE`.

Change par exemple :
- le titre (`Petite pause estivale !`)
- les dates dans les phrases
- le texte du bouton si tu veux
- l’emoji ☀️ si tu veux (ex. 🎄 pour Noël)

### Étape 2 — Modifier le script (obligatoire)

Tout en bas de `index.html`, cherche le `<script>` du popup.

#### a) Changer la clé de mémorisation
```js
var STORAGE_KEY = "summer-closure-dismissed-2026";
```

Donne-lui un **nouveau nom** à chaque période, par exemple :
- `"fermeture-noel-2026"`
- `"fermeture-ete-2027"`

Sans ça, les visiteurs qui ont déjà fermé l’ancien popup ne verront pas le nouveau.

#### b) Changer la date de réouverture
```js
var reopenDate = new Date(2026, 7, 24);
```

C’est le jour où le popup **s’arrête tout seul**.

Format : `new Date(ANNÉE, MOIS, JOUR)`

⚠️ En JavaScript, les mois commencent à **0** :

| Mois      | Numéro |
|-----------|--------|
| Janvier   | 0      |
| Février   | 1      |
| Mars      | 2      |
| Avril     | 3      |
| Mai       | 4      |
| Juin      | 5      |
| Juillet   | 6      |
| Août      | 7      |
| Septembre | 8      |
| Octobre   | 9      |
| Novembre  | 10     |
| Décembre  | 11     |

Exemples :
- Réouverture le **24 août 2026** → `new Date(2026, 7, 24)`
- Réouverture le **2 janvier 2027** → `new Date(2027, 0, 2)`
- Réouverture le **15 juillet 2027** → `new Date(2027, 6, 15)`

### Étape 3 — Publier sur le site

1. Enregistre `index.html`
2. Fais un **commit** puis un **push** sur la branche `main`
3. Attends 1–2 minutes que GitHub Pages mette le site à jour
4. Ouvre la page d’accueil (éventuellement en navigation privée) pour vérifier

### Astuce pour retester le popup chez toi
Si tu as déjà fermé le popup une fois, le navigateur s’en souvient.
Pour le revoir :
- ouvre le site en **navigation privée**, ou
- change temporairement la valeur de `STORAGE_KEY`, recharge la page, puis remets la bonne clé

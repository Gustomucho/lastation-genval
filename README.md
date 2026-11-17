# La Station Genval

Site public : https://lastation-genval.be/

Pour remplacer la carte, suivre [la procédure complète de mise à jour du menu](#mettre-à-jour-la-carte).

Le site reste en HTML/CSS, hébergé sur GitHub Pages. Aucun serveur, abonnement ou
service d’IA n’est nécessaire pour les nouveaux outils. Les visiteurs conservent
la même présentation ; les agents compatibles peuvent consulter les informations
et rechercher dans la carte.

## Outils pour les agents IA

`agent-tools.js` est chargé sur les trois pages. Il utilise en priorité
`document.modelContext.registerTool()`, avec l’ancienne API
`navigator.modelContext` en dernier recours. Sans API compatible, il s’arrête sans
modifier la page. Les erreurs d’enregistrement sont isolées par outil.

| Outil | Fonction |
| --- | --- |
| `get_cafe_info` | Adresse, téléphone, email, services et liens officiels. |
| `get_opening_hours` | Horaires habituels et exceptions publiées, heure de Bruxelles. |
| `search_menu` | Recherche par mots, catégorie et prix maximum, en euros. |
| `get_reservation_options` | Procédure de réservation par téléphone, sans créer de réservation. |

La fiche structurée `#cafe-data` dans `index.html` est la source commune des
coordonnées et horaires pour les pages et les outils. Pour une fermeture
exceptionnelle, ajouter une `specialOpeningHoursSpecification` avec des dates
explicites et publier aussi une annonce visible sur la page. L’ancien message
d’été 2026 a été retiré. Ne pas ajouter de nouvelle fermeture sans dates vérifiées.

Les outils sont en lecture seule. Ils ne garantissent ni le stock, ni l’ouverture
en temps réel, ni l’absence d’allergènes. Ils n’envoient pas d’email et ne
réservent pas de table. La prise en charge WebMCP dépend du navigateur et de
l’agent ; ajouter ce code ne l’active pas dans un navigateur non compatible.

## Carte et cohérence des données

`Menu.pdf`, les deux images affichées par `menu.html` et `menu.json` sont générés
ensemble à partir de la carte fournie. Les données JSON sont publiques mais ne
s’affichent pas dans la page. `search_menu` vérifie les empreintes des trois
sources avant de répondre ; un fichier remplacé seul rend la recherche
indisponible jusqu’à la mise à jour du paquet complet.

L’extraction vérifie que les deux pages et les deux colonnes contiennent des
produits, que les rubriques principales (cafés, petit-déjeuner, lunch et
gourmandises) sont présentes et que les deux images sont différentes. Les
encadrés d’introduction placés au-dessus d’une rubrique sont ignorés sans
interrompre la lecture de la colonne. La vérification humaine des prix et des
descriptions reste nécessaire avant publication.

## Mettre à jour la carte

Cette procédure se fait entièrement sur GitHub, sans Terminal. Elle prépare les
nouvelles images et les données pour les agents IA à partir du PDF, puis publie
les quatre fichiers ensemble après vérification.

**À retenir : remplacer seulement le PDF ou seulement les images ne suffit pas.**
La génération est automatique, mais la vérification et la publication restent
manuelles.

### Avant de commencer

- Préparer un PDF de **deux pages**, avec du texte sélectionnable : boissons sur
  la première page, restauration sur la seconde, dans la mise en page à deux
  colonnes utilisée par La Station.
- Le nommer exactement **`Menu.pdf`**, avec un M majuscule.
- Garder les noms des autres fichiers : `menu-page-1.jpg`,
  `menu-page-2.jpg` et `menu.json`.
- Si la carte change de nombre de pages ou de structure, demander une adaptation
  du script avant publication.

### 1. Créer une branche pour préparer le menu

1. Ouvrir [le dépôt La Station](https://github.com/Gustomucho/lastation-genval).
2. Dans l’onglet **Code**, cliquer sur le sélecteur **main**, en haut à gauche de
   la liste des fichiers.
3. Saisir un nouveau nom, par exemple `menu-decembre-2026`, puis cliquer sur
   **Create branch**.
4. Vérifier que ce nom est maintenant affiché à la place de `main`.

Cette branche est un espace de préparation. Le site public continue d’utiliser
`main` jusqu’à la fusion finale.

### 2. Remplacer le PDF sur cette branche

1. À la racine du dépôt (là où se trouve `index.html`), cliquer sur
   **Add file → Upload files**.
2. Glisser le nouveau `Menu.pdf`.
3. Enregistrer avec **Commit changes** sur la branche créée à l’étape 1.

Ne pas remplacer les images manuellement à ce stade : elles vont être générées
à partir du PDF.

### 3. Ouvrir la proposition de modification

1. Cliquer sur **Compare & pull request**. Si le bouton n’apparaît pas, ouvrir
   **Pull requests → New pull request**, avec `main` comme base et la branche du
   nouveau menu comme comparaison.
2. Donner un titre, par exemple « Nouveau menu décembre 2026 ».
3. Cliquer sur **Create pull request**.

**Ne pas cliquer sur Merge pour le moment.** L’ouverture de cette proposition
déclenche l’extraction du PDF. La vérification de cohérence peut être rouge tant
que les nouvelles images et le nouveau JSON n’ont pas été ajoutés : c’est attendu
à cette étape.

### 4. Télécharger le paquet généré

1. Ouvrir [l’onglet Actions](https://github.com/Gustomucho/lastation-genval/actions).
2. Sélectionner **Extraire le nouveau PDF du menu**, puis l’exécution correspondant
   à la branche et au nouveau PDF.
3. Attendre la coche verte. Si l’exécution est rouge, s’arrêter et transmettre
   son lien pour diagnostic.
4. Ouvrir cette exécution, descendre jusqu’à **Artifacts** et télécharger
   **menu-candidat-a-verifier**. Il faut être connecté à GitHub pour le télécharger.
5. Décompresser le ZIP sur l’ordinateur.

Le paquet doit contenir ces **quatre fichiers** :

| Fichier | Rôle |
| --- | --- |
| `Menu.pdf` | La carte fournie |
| `menu-page-1.jpg` | L’image de la page boissons |
| `menu-page-2.jpg` | L’image de la page restauration |
| `menu.json` | Les produits, descriptions, prix et horaires utilisables par les agents IA |

Prendre le paquet de la **dernière exécution réussie correspondant au PDF à
publier**, pas celui d’un ancien menu.

### 5. Vérifier les deux pages et les données

1. Ouvrir les deux images séparément : la première doit montrer les boissons,
   la seconde la restauration. Elles doivent être différentes et lisibles.
2. Comparer leur contenu avec les deux pages du PDF.
3. Ouvrir `menu.json` avec un éditeur de texte. Dans la liste `items`, vérifier
   qu’il y a des produits des deux pages : boissons, petits-déjeuners, lunchs et
   gourmandises. Rechercher `"source_page": 2` et contrôler notamment les lunchs.
   La présence des deux noms d’images dans l’en-tête du JSON ne suffit pas.
4. Contrôler les noms, prix, suppléments, formules, descriptions et heures de
   service. Les lignes d’un nom sur plusieurs lignes doivent rester associées
   au bon produit et au bon prix.

Le script contrôle la présence des deux pages, des deux colonnes et des rubriques
principales, ainsi que la différence entre les images. Ces contrôles ne
remplacent pas la comparaison avec le PDF.

En cas d’anomalie, **ne pas fusionner** et ne pas modifier seulement une image :
transmettre le lien de la proposition pour corriger et régénérer un paquet complet.

### 6. Ajouter ensemble les quatre fichiers vérifiés

1. Retourner dans **Code** et sélectionner la branche du nouveau menu.
2. Revenir à la racine du dépôt.
3. Cliquer sur **Add file → Upload files**.
4. Glisser ensemble `Menu.pdf`, `menu-page-1.jpg`, `menu-page-2.jpg` et
   `menu.json` depuis le paquet décompressé. Glisser les **fichiers eux-mêmes**,
   pas le dossier qui les contient.
5. Enregistrer avec **Commit changes** sur cette même branche.

La proposition de modification se met à jour automatiquement. Ne pas créer une
deuxième proposition pour ces fichiers.

### 7. Publier et vérifier le site

1. Retourner dans **Pull requests** et ouvrir la proposition du nouveau menu.
2. Attendre la réussite de la vérification **Vérifier le site et préparer le menu**
   (le contrôle peut apparaître sous le nom **verify**). Ne pas fusionner si elle
   reste rouge.
3. Cliquer sur **Merge pull request → Confirm merge**. Si GitHub propose une
   variante comme **Squash and merge**, confirmer la fusion proposée.
4. Dans **Actions**, attendre la réussite de **pages build and deployment**
   correspondant à cette fusion. La fusion seule ne signifie pas que le site
   a déjà terminé sa mise à jour.
5. Ouvrir [la page Menu](https://lastation-genval.be/menu.html) et vérifier les
   **deux pages** et quelques prix.
6. Ouvrir [menu.json](https://lastation-genval.be/menu.json) et vérifier un produit
   nouveau ou un prix modifié pour confirmer que les données IA sont à jour.

Après cette étape, la mise à jour est terminée. Il n’y a pas de nouveau test
WebMCP en console à réaliser systématiquement pour une simple modification de
carte ; les tests GitHub contrôlent la cohérence des fichiers.

### Si le site affiche encore l’ancienne carte ou deux fois la même page

1. Attendre d’abord la réussite de **pages build and deployment**.
2. Forcer le rechargement : **⌘ + Maj + R sur Mac**, ou **Ctrl + F5 sur Windows**.
3. Si nécessaire, ouvrir la page Menu dans une fenêtre de navigation privée.
4. Vérifier les deux fichiers directement :
   [page boissons](https://lastation-genval.be/menu-page-1.jpg) et
   [page restauration](https://lastation-genval.be/menu-page-2.jpg).

Si les deux pages sont correctes en navigation privée, l’ancien affichage vient
probablement du cache du navigateur. Si les fichiers restent identiques ou
incorrects dans une fenêtre privée, transmettre le lien de la proposition et
ne pas déposer un ancien paquet par-dessus.

### Si le PDF a déjà été remplacé directement sur main

Il n’est pas nécessaire de renvoyer le PDF :

1. Créer une branche à partir de `main`, comme à l’étape 1.
2. Dans **Actions → Extraire le nouveau PDF du menu**, cliquer sur
   **Run workflow**, sélectionner cette branche, puis confirmer **Run workflow**.
3. Reprendre les étapes 4, 5 et 6 avec le paquet de cette exécution.
4. Ouvrir la proposition de modification si elle n’existe pas encore, puis
   effectuer l’étape 7.

Pendant qu’un PDF ou une image est remplacé seul, la recherche IA peut signaler
une indisponibilité temporaire pour éviter de donner d’anciens prix. Elle
redevient utilisable lorsque le paquet cohérent est publié.

### Préparation locale, pour un développeur

```sh
python -m pip install -r scripts/requirements-menu.txt
# Installer aussi Poppler (pdftoppm) sur l’ordinateur.
python scripts/menu_data.py --pdf Menu.pdf --output-dir /tmp/menu-candidat
```

Le dossier de sortie doit être extérieur au site. Vérifier le paquet, puis
ajouter ensemble ses quatre fichiers à la branche avant publication.

## Vérifications

```sh
python -m pip install -r scripts/requirements-menu.txt
python scripts/menu_data.py --check
node --test tests/agent-tools.test.cjs
python -m unittest discover -s tests -p 'test_*.py' -v
```

Les tests Node vérifient les recherches, les entrées invalides, le repli sans API,
les données périmées et les fiches structurées. Leur registre est simulé : ils ne
prouvent pas la découverte dans un navigateur réel.

Avant publication de l’intégration, ouvrir une prévisualisation dans un navigateur
compatible WebMCP, vérifier la liste des quatre outils et appeler chacun. Tester
`search_menu` avec `{"query":"cappuccino"}`, `{"query":"soupe"}`, une recherche
sans résultat et un prix négatif (qui doit être refusé). Refaire un appel après
navigation vers `menu.html`. Vérifier aussi le site dans un navigateur sans API.

## Publication et retour arrière

GitHub Pages conserve la branche `main`, dossier racine, et le domaine
`lastation-genval.be`. Le fichier `CNAME`, le style et les photos de présentation restent indépendants
des mises à jour de la carte.

Les changements peuvent être intégrés en un commit. Pour revenir en arrière,
utiliser **Revert** sur ce commit / la pull request, puis attendre la publication
GitHub Pages. Aucun changement de paramètres d’hébergement n’est nécessaire.

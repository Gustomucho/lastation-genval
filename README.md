# La Station Genval

Site public : https://lastation-genval.be/

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

## État initial de la carte : attention au PDF ancien

Lors de l’intégration, `Menu.pdf` était une ancienne carte (printemps), différente
des deux images affichées par `menu.html` (notamment Americano et Toast Fig Kiss).
Il n’a pas été remplacé. `menu.json` contient les 55 articles et suppléments
vérifiés dans les **images affichées**, avec leur provenance. Tant que ce décalage
existe, l’outil renvoie la page et les images comme sources, jamais l’ancien PDF
comme référence de la carte actuelle.

Les données JSON sont publiques mais ne s’affichent pas dans la page. Aucun texte
invisible n’a été ajouté. `search_menu` vérifie les empreintes du PDF et des deux
images avant de répondre. Si un de ces fichiers change seul, il signale une
indisponibilité temporaire au lieu de répondre avec des prix potentiellement périmés.

## Mettre à jour la carte

1. Fournir le **nouveau PDF correspondant à la carte à publier** dans une branche
   séparée (pull request). Ne pas publier un PDF seul directement sur `main`.
2. L’action GitHub **Extraire le nouveau PDF du menu** prépare automatiquement un
   paquet `menu-candidat-a-verifier`, disponible dans les résultats de l’action.
3. Télécharger ce paquet et comparer les noms, prix, suppléments, descriptions et
   heures de service avec les deux images générées. L’extraction automatique
   nécessite cette vérification ; une nouvelle mise en page peut demander une adaptation.
4. Ajouter ensemble les quatre fichiers du paquet à la même proposition :
   `Menu.pdf`, `menu-page-1.jpg`, `menu-page-2.jpg` et `menu.json`.
5. Attendre la réussite de **Vérifier le site et préparer le menu**, puis intégrer
   la proposition. GitHub Pages conserve son mode de publication actuel.

La génération ne remplace jamais automatiquement la carte publique : elle prépare
un paquet à vérifier. Les actions signalent les incohérences ; elles ne remplacent
pas une règle GitHub de protection de branche. Le contrôle dans l’outil empêche
également de retourner des données périmées si une mise à jour directe a lieu.

Le script accepte le PDF texte à deux colonnes utilisé ici ; il refuse un PDF
scanné ou une structure qu’il ne reconnaît pas. Il ne déduit aucun allergène ou
régime alimentaire. Pour préparer le paquet localement :

```sh
python -m pip install -r scripts/requirements-menu.txt
# Installer aussi Poppler (pdftoppm) sur l’ordinateur.
python scripts/menu_data.py --pdf Menu.pdf --output-dir /tmp/menu-candidat
```

Le dossier de sortie doit être extérieur au site pour éviter d’écraser la carte
avant vérification. L’ancienne pièce jointe fournie pendant la conversation n’est
pas utilisée comme source de la nouvelle carte.

## Vérifications

```sh
python scripts/menu_data.py --check
node --test tests/agent-tools.test.cjs
```

Les tests Node vérifient les recherches, les entrées invalides, le repli sans API,
les données périmées et les fiches structurées. Leur registre est simulé : ils ne
prouvent pas la découverte dans un navigateur réel.

Avant publication de l’intégration, ouvrir une prévisualisation dans un navigateur
compatible WebMCP, vérifier la liste des quatre outils et appeler chacun. Tester
`search_menu` avec `{"query":"cappuccino"}`, `{"query":"fig kiss"}`, une recherche
sans résultat et un prix négatif (qui doit être refusé). Refaire un appel après
navigation vers `menu.html`. Vérifier aussi le site dans un navigateur sans API.

## Publication et retour arrière

GitHub Pages conserve la branche `main`, dossier racine, et le domaine
`lastation-genval.be`. Le fichier `CNAME`, le style, les photos, les images de la
carte et le PDF n’ont pas été modifiés par l’intégration.

Les changements peuvent être intégrés en un commit. Pour revenir en arrière,
utiliser **Revert** sur ce commit / la pull request, puis attendre la publication
GitHub Pages. Aucun changement de paramètres d’hébergement n’est nécessaire.

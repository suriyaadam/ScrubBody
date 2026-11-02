# ZÉMAYA
Boutique en français, signature « SOIN DU VENDREDI », pour le soin du corps avant la prière du vendredi. Prix en FDJ, quatre références (papaye, café, citron et nila, associées au sucre), panier persistant, FAQ, fiches produits, interface de commande et formulaire de contact.

## Lancer
Node.js 22 ou ultérieur, aucune installation de dépendances nécessaire. Depuis le dossier du projet, ou `wip/source/` dans l’archive :
```sh
npm run dev
```
Port 5173. `PORT=3000 npm start` permet de choisir un autre port.
`npm test` vérifie le panier. `npm run build` prépare les fichiers statiques dans `dist/`, à servir avec un hébergement statique.

## Choix technique
Le dépôt initial était vide et l’installation des dépendances était bloquée lors de la création initiale. Le site utilise donc des modules JavaScript natifs et du CSS, sans dépendance réseau, plutôt que React/Vite. La version autonome intègre les médias pour consultation hors ligne ; la version source utilise un serveur statique.

## Images des produits
Les quatre visuels produits sont intégrés :
- `public/images/zemaya-papaye.png` : papaye et sucre, dans l’accueil, la collection, l’histoire, la fiche produit et le panier.
- `public/images/zemaya-cafe.png` : café et sucre, dans la collection, la fiche produit et le panier.
- `public/images/zemaya-citron.png` : citron et sucre, dans la collection, la fiche produit et le panier.
- `public/images/zemaya-nila.png` : nila et sucre, dans la collection, la fiche produit et le panier.

Ces fichiers sont des adaptations génératives des affiches fournies par l’utilisateur : fond simplifié et textes promotionnels extérieurs aux pots retirés, avec les packagings comme références. Ils ne constituent pas les photographies originales et peuvent être remplacés par les fichiers originaux pour une reproduction exacte des produits. La provenance est documentée dans `public/images/PROVENANCE.md`.

Les données et chemins sont centralisés dans `src/data/products.js`. La composition complète, le conditionnement et les précautions propres à chaque référence doivent être confirmés à partir des emballages avant ouverture des ventes. Les conseils d’utilisation restent adaptés à la sensibilité de la peau et aux indications du produit.

## Scène vidéo liée au défilement
La vidéo fournie dure 10,041667 secondes. À la demande de l’utilisateur, seule la séquence allant de 5 secondes à la fin est utilisée : 5,041667 secondes. Le fichier original est conservé dans `assets-source/zemaya-hero-original.mp4`. La version utilisée en secours est `public/videos/zemaya-hero.mp4`.

Le mouvement est piloté par le défilement et se parcourt aussi en arrière : 60 images WebP extraites à 12 images/seconde, en 960 × 540 sur ordinateur et 640 × 360 sur téléphone. Les deux jeux pèsent environ 2,4 Mo au total. La scène reste épinglée sur environ 1,5 hauteur d’écran de défilement, puis laisse place à la collection ; le bouton permet de la rejoindre directement. Le cadrage conserve l’ensemble de l’image vidéo. Une image d’attente reste affichée pendant le chargement et la dernière image disponible reste visible entre deux images.

Les fichiers et paramètres sont centralisés dans `src/data/hero-media.js`. Les caches d’images sont bornés, les chargements simultanés limités et le rendu synchronisé par requestAnimationFrame. La préférence de réduction des animations remplace la séquence par une image fixe du produit ; une panne de chargement permet de revenir à la vidéo avec commandes natives.

`npm run export` produit une version autonome intégrant les images, la séquence et la vidéo de secours. `npm run wip` prépare le dossier `wip/` et l’archive `downloads/zemaya-wip.zip`.

## Version HTML autonome
`npm run export` produit `dist/zemaya.html`, un seul fichier contenant le style, le code et les images disponibles. Il s’ouvre sans serveur. Le panier persistant dépend de l’autorisation de stockage du navigateur pour les fichiers locaux. Pour un usage normal, privilégier le serveur local ou un hébergement statique.

## Services et informations à compléter
`contactConfig` dans `src/data/products.js` contient l’URL du futur service contact et les coordonnées à renseigner. Le formulaire ne prétend pas avoir envoyé de message tant qu’un service n’est pas configuré. L’API devra valider les données, protéger contre les abus et retourner un statut de succès uniquement après réception effective. Ne placer aucun secret dans le navigateur.
Le panier et son récapitulatif fonctionnent localement. La prise de commande et le paiement ne sont pas activés : connecter une API, contrôler les prix côté serveur, définir livraison et conditions commerciales avant ouverture. Aucun paiement ou enregistrement de commande n’est annoncé.
Les textes juridiques indiquent les informations manquantes : compléter l’identité du vendeur, l’hébergement, les coordonnées et les politiques applicables avant publication. Adapter également la politique de confidentialité après branchement des services.

## Référence visuelle
Panneaux arrondis, sections généreuses et présentation produit de la maquette, réinterprétés avec crème, papaye, sauge et bleu nuit. Aucun contenu de la marque de référence n’est repris.

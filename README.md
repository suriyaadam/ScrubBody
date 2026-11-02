# ZÉMAYA
Boutique en français, signature « SOIN DU VENDREDI », pour le soin du corps avant la prière du vendredi. Prix en FDJ, quatre références (papaye, café, citron et nila, associées au sucre), panier persistant, FAQ, fiches produits, interface de commande et formulaire de contact.

## Lancer
Node.js 22 ou ultérieur, aucune installation de dépendances nécessaire. Depuis le dossier du projet, ou `wip/source/` dans l’archive :
```sh
npm run dev
```
Port 5173. `PORT=3000 npm start` permet de choisir un autre port.
`npm test` vérifie le panier, les tarifs, la validation du formulaire, les messages WhatsApp et le serveur vidéo. `npm run build` prépare les fichiers statiques dans `dist/`, à servir avec un hébergement statique.

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

## Commandes WhatsApp et livraison
Le parcours de commande prépare un message complet puis ouvre WhatsApp vers le numéro professionnel centralisé dans `WHATSAPP_NUMBER` de `src/order.js` : `221778682456`. Le client doit encore appuyer sur Envoyer dans WhatsApp. Aucun envoi à la boutique ni aucun règlement n’est affirmé par le site.

Les tarifs sont centralisés dans `DELIVERY_ZONES` : Cité Hodan 0 FDJ, Djibouti-ville hors Cité Hodan 500 FDJ, Ali-Sabieh/Tadjourah/Dikhil/Obock/Arta 1 000 FDJ. Une zone absente ou inconnue laisse les frais et le total à préciser. Les calculs utilisent le prix de chaque référence du catalogue.

Le formulaire exige nom, téléphone djiboutien (+253 et 8 chiffres, format national accepté), zone, quartier, adresse et un choix parmi D-Money, CAC Bank et paiement à la livraison. Les notes sont facultatives. Un identifiant unique et un récapitulatif incluant quantités, prix, remises à 0 FDJ, taxes à 0 FDJ, livraison et total sont préparés après validation. Les modalités de règlement sont confirmées par la boutique ; aucune coordonnée de paiement n’est inventée. Le panier reste conservé après préparation du message.

Les champs de livraison restent dans le formulaire en mémoire, sans stockage local des coordonnées. La sélection d’une zone dans le panier se retrouve dans le formulaire ; le retour au panier conserve les champs. Le lien WhatsApp de reprise reste disponible si le navigateur bloque la nouvelle fenêtre. Les doubles validations identiques sont bloquées.

Les tests navigateur interceptent l’ouverture de WhatsApp et contrôlent l’URL : ils n’envoient aucun message réel.

## Services et informations à compléter
`contactConfig` dans `src/data/products.js` contient l’URL du futur service contact et les coordonnées à renseigner. Le formulaire ne prétend pas avoir envoyé de message tant qu’un service n’est pas configuré. L’API devra valider les données, protéger contre les abus et retourner un statut de succès uniquement après réception effective. Ne placer aucun secret dans le navigateur.
Les demandes de commande passent par WhatsApp, sans backend de commande ni paiement automatisé. La boutique confirme manuellement les disponibilités et les modalités. Les informations légales, les conditions de retour et de réclamation restent à compléter.
Les textes juridiques indiquent les informations manquantes : compléter l’identité du vendeur, l’hébergement, les coordonnées et les politiques applicables avant publication. Adapter également la politique de confidentialité après branchement des services.

## Référence visuelle
Panneaux arrondis, sections généreuses et présentation produit de la maquette, réinterprétés avec crème, papaye, sauge et bleu nuit. Aucun contenu de la marque de référence n’est repris.

## ZÉMAYA INSIGHTS
L’espace de gestion est accessible sous `insights/index.html` (ou `/insights/` sur le serveur). Il conserve l’identité crème, sauge et verte de ZÉMAYA avec une interface distincte : neuf vues, filtres de période et de recherche, graphiques interactifs, commandes, clients, produits, régions, rapports et profil.

Les données réelles sont les commandes saisies manuellement ou importées depuis un fichier JSON validé. Une demande préparée dans WhatsApp n’est jamais automatiquement enregistrée comme reçue, confirmée ou payée. Le stockage est local au navigateur et à l’origine du site, sous `zemaya-insights-orders-v1` ; il n’est pas partagé entre appareils. Les exports JSON servent aux sauvegardes et les exports CSV aux rapports. Les imports sont validés intégralement avant enregistrement et les conflits de références sont refusés.

Le chiffre d’affaires comprend les articles des commandes payées non annulées, hors livraison. Les quantités vendues suivent les mêmes règles. Le panier moyen divise ces recettes par le nombre de commandes payées. Une variation n’est affichée que si la période précédente fournit une base strictement positive. Les moyens de paiement représentent les choix déclarés, pas une preuve de règlement.

Un mode de prévisualisation explicitement marqué comme fictif est disponible. Il ne persiste aucune commande et bloque les modifications et exports afin de préserver les données réelles. L’espace est vide au premier lancement. La déconnexion quitte cet espace local ; elle ne constitue pas une authentification serveur. Pour une exploitation partagée avec accès protégés, un backend d’authentification et de stockage devra être raccordé.

`npm run export` génère aussi `dist/insights.html`, autonome. Le WIP contient `insights/index.html` en plus de la boutique et les sources complètes. Aucun fichier contenant des commandes enregistrées dans le navigateur n’est ajouté au dépôt ou à l’archive automatiquement.

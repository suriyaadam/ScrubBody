# Publication et consultation de ZÉMAYA

## Fichiers de consultation

- `wip/index.html` : version autonome intégrant le code, les images, les deux tailles de la séquence et la vidéo de secours. Ouvrir ce fichier dans un navigateur.
- `wip/source/` : sources complètes à modifier. Depuis ce dossier : `npm run dev`.
- `downloads/zemaya-wip.zip` : archive du dossier WIP.
- `review/` : captures ordinateur/téléphone et résultats des vérifications.

Les chemins de fichiers de l’environnement ne sont pas des liens de téléchargement publics. Le partage de l’archive se fait depuis le dépôt GitHub après transfert confirmé.

## GitHub Pages

Le dossier `docs/` contient la version prête à héberger et l’archive WIP. Pour activer le site depuis les paramètres du dépôt `suriyaadam/ScrubBody` :

1. Ouvrir Settings → Pages.
2. Choisir « Deploy from a branch ».
3. Sélectionner la branche `main` et le dossier `/docs`, puis enregistrer.
4. Attendre le succès du déploiement Pages. Utiliser l’adresse indiquée par GitHub, puis vérifier qu’elle répond avant de la partager comme site accessible.

Le workflow `.github/workflows/publish-site.yml` reste une alternative manuelle si la source Pages est configurée sur GitHub Actions. Il vérifie le panier, construit la page autonome et la déploie.

Dans l’environnement de développement, l’accès à l’API GitHub est soumis à la politique réseau. Les domaines `api.github.com` et `suriyaadam.github.io` sont nécessaires pour activer et vérifier automatiquement le site. Le brouillon réseau les prévoit ; un enregistrement du brouillon n’est pas une publication web.

## État fonctionnel

La scène commence à la seconde 5 de la vidéo originale et couvre ses 5,041667 dernières secondes. Elle avance et recule avec le défilement, conserve le produit final avant la collection et respecte la préférence de réduction des animations. Le cadrage complet et l’accès au bouton ont été vérifiés sur ordinateur et téléphone.

Le panier fonctionne à 350 FDJ par référence. Les services de contact, de paiement et de commande ne sont pas raccordés. Les informations commerciales et juridiques restent à compléter avant l’ouverture des ventes. La provenance des médias est documentée sous `public/images/PROVENANCE.md` et `assets-source/` conserve la vidéo originale fournie.

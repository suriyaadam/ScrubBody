# Dossier de travail ZÉMAYA

Le script `wip.mjs` prépare un dossier consultable hors ligne et une archive du projet complet, sans dépendances, données Git, caches ou fichiers de configuration privés.

## Générer les fichiers

Depuis la racine du projet, avec Node.js 22 ou ultérieur et la commande système `zip` :

```sh
npm run export
node wip.mjs
```

Les sorties sont :

- `wip/index.html` : site autonome avec les images et la vidéo présentes lors de l’export, à ouvrir directement dans un navigateur ;
- `wip/README.md` : instructions de consultation et état des fonctions ;
- `wip/source/` : copie réutilisable des fichiers de développement, comprenant les médias et les sources reçues ;
- `downloads/zemaya-wip.zip` : archive contenant un dossier supérieur `wip/`.

La commande de génération ne publie rien et n’envoie aucun fichier à GitHub. Elle ne crée pas non plus d’adresse web publique.

## Consulter ou modifier

Pour consulter le résultat hors ligne, ouvrez `wip/index.html`. Pour développer, placez-vous dans `wip/source/` et lancez `npm run dev`. Le serveur utilise le port 5173. Les médias inclus sont les fichiers disponibles au moment de la génération.

Le panier fonctionne dans le navigateur. Les services de contact, de prise de commande et de paiement ne sont pas configurés. Les coordonnées, informations juridiques et modalités commerciales restent à compléter avant l’ouverture des ventes. Aucune transmission de commande ou de paiement n’est annoncée.

## Régénération et protection des fichiers

Le dossier `wip/` porte un marqueur contenant l’inventaire et les empreintes de ses fichiers générés. Le script refuse de remplacer un dossier sans marqueur valide, ainsi qu’un dossier auquel des fichiers ont été ajoutés ou dont les fichiers ont été modifiés. Conservez vos changements ailleurs avant de régénérer.

Les autres fichiers présents dans `downloads/` sont conservés. Seule l’archive nommée `zemaya-wip.zip` peut être remplacée lors d’une régénération identifiée.

La copie utilise une liste explicite de fichiers et dossiers du projet. Elle exclut les dossiers cachés, les fichiers `.env`, les caches et les extensions courantes de clés privées ; les liens symboliques sont refusés. Aucun chemin absolu propre à la machine de travail n’est inscrit dans les instructions générées.

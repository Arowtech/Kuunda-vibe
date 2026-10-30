# Guide Kuunda Vibe

La page pour les utilisateurs est sur le site d’aide : [https://docs.kuunda-cloud.com/fr/guides/kuunda-vibe](https://docs.kuunda-cloud.com/fr/guides/kuunda-vibe). Dans Kuunda Vibe, elle s’ouvre par le menu **Aide → Guide Kuunda Vibe**.

Ce guide est pour vous, même si vous n’avez jamais programmé. Il explique ce que fait Kuunda Vibe, comment lui parler, et où se trouvent les réglages.

Kuunda Vibe est un programme sur votre ordinateur. Vous décrivez ce que vous voulez (un site, une application, un outil). L’assistant intégré pose quelques questions, vous propose des façons de le faire, puis construit le projet avec vous.

Vous n’avez pas à choisir tout seul le langage ou les outils. L’assistant le fait, puis vous validez.

---

## 1. Les cinq pièces, en une phrase chacune

Tout tient dans **un seul compte**. Vous ne créez pas un compte différent pour chaque service.

| Nom | À quoi ça sert, simplement |
| --- | --- |
| **Kuunda Vibe** | Le programme sur votre ordinateur. C’est ici que vous parlez à l’assistant et que vous voyez le projet. |
| **Kuunda Cloud** | L’endroit où les informations de votre application sont gardées (comptes, listes, textes, etc.). |
| **Kuunda Git** | L’endroit où le travail est enregistré en ligne, pour ne pas le perdre et pouvoir y revenir. |
| **Kuunda Frontend** | L’adresse publique du site, celle que les gens ouvrent dans un navigateur. |
| **Providers** | Les façons de se connecter : e-mail, et plus tard Google ou d’autres, selon ce qui est activé sur votre compte. |

Créer un compte avec Kuunda Cloud ouvre déjà ces services. L’assistant ne doit pas vous envoyer vous inscrire ailleurs (GitHub, Vercel, Netlify, etc.) sauf si **vous** le demandez.

---

## 2. Premier lancement

1. Ouvrez Kuunda Vibe.
2. La langue de l’interface suit la langue de votre ordinateur quand elle est disponible (français ou anglais). L’anglais est utilisé si le français n’est pas là.
3. Vous pouvez travailler sans compte pour discuter en local. Pour publier en ligne, enregistrer le code et utiliser la base de données, un compte Kuunda est nécessaire.

Pour créer ou ouvrir un compte, cherchez les commandes dont le nom commence par **Kuunda Vibe** (voir la section 10, « Retrouver une commande »).

---

## 3. Créer un projet

Un projet, c’est le dossier de votre idée : le site, l’application, ou l’outil.

1. Ouvrez la liste des commandes (section 10).
2. Choisissez **Kuunda Vibe : New Project** (Nouveau projet).
3. Choisissez le type :

| Type | Choisissez-le si… |
| --- | --- |
| **Website** (site) | Vous voulez des pages qu’on visite. |
| **Web application** (application web) | Vous voulez un outil dans le navigateur : compte, formulaires, données. |
| **Mobile application** | Vous visez un téléphone. On vous demandera plus tard Google Play, l’App Store, les deux, ou aucun pour l’instant. |
| **Other** (autre) | Vous voulez un dossier Kuunda vide, sans modèle imposé. |

4. Donnez un nom de dossier simple : lettres, chiffres, points, tirets. Évitez les espaces et les noms comme `CON` ou `AUX` (Windows les refuse).
5. Choisissez le dossier parent, celui dans lequel le projet sera créé.

Kuunda prépare alors un point de départ (souvent une petite application React, un outil courant pour les interfaces). Ce n’est **pas** une obligation. Dès que vous décrivez votre besoin, l’assistant peut proposer autre chose et remplacer ce point de départ si vous êtes d’accord.

Ne recréez pas un projet dans un dossier qui en contient déjà un. Ouvrez ce dossier à la place.

---

## 4. Parler à l’assistant

Le chat est le panneau où vous écrivez en français, comme à une personne.

Exemple :

> Je veux une application pour une boulangerie. Les clients voient les gâteaux du jour et peuvent laisser leur téléphone pour être rappelés.

Vous n’avez pas à dire « fais-le en React » ou « utilise PostgreSQL ».

### Ce que l’assistant doit faire avant de construire

Pour une **nouvelle** application, ou si vous voulez **changer** la façon dont elle est faite, il doit :

1. Vous proposer **deux ou trois façons** de la réaliser.
2. En marquer une **recommandée**, celle qui colle le mieux à votre demande. Ce n’est pas toujours le même outil. Une vitrine simple, une application avec comptes, ou une application téléphone ne se font pas de la même manière.
3. Vous poser **seulement** les questions qui changent le choix : site ou téléphone, pour qui, quelles informations garder.
4. **Attendre votre réponse** avant de créer les fichiers.

Chaque proposition doit dire, en clair :

- comment l’écran est fait ;
- où les informations sont gardées (en général Kuunda Cloud) ;
- où le travail est enregistré (en général Kuunda Git) ;
- où le site sera visible (en général Kuunda Frontend).

Si vous répondez « choisis pour moi », il prend l’option recommandée et vous le dit.

Il ne vous repose pas ces questions pour une petite correction (« change le titre », « le bouton ne marche pas ») ni quand le projet a déjà une façon de faire et que vous ne demandez pas d’en changer.

### Les quatre modes

Dans le chat, un mode dit à l’assistant jusqu’où aller.

| Mode | En pratique |
| --- | --- |
| **Agent** | Il fait le travail : il crée et modifie le projet. C’est le mode habituel. |
| **Plan** | Il regarde et vous écrit un plan. Il ne change pas encore les fichiers. Utile pour valider avant. |
| **Ask** (demander) | Il répond à une question. Il ne modifie pas le projet. |
| **Debug** | Quelque chose ne marche pas. Il cherche la cause, puis corrige. |

Pour une première idée, **Plan** puis **Agent** est un bon rythme : d’abord le plan, ensuite la construction.

### Ce qu’il ne doit pas faire tout seul

- Vous livrer une seule page HTML bricolée, sauf si vous avez demandé une page simple et figée.
- Utiliser un outil abandonné ou très vieux pour l’écran.
- Inventer une autre base de données si Kuunda Cloud est activé.
- Publier le site chez un autre hébergeur si vous n’avez pas dit de le faire.
- Enregistrer vos mots de passe ou clés secrètes dans le projet.

---

## 5. Où vont les informations, le code et le site

Quand vous demandez de **connecter** une application ou un site à Kuunda Cloud, l’assistant suit cet ordre :

1. **Créer un projet** pour cette application sur Kuunda Cloud (`https://api.ide.kuunda-cloud.com`), pas sur l’ordinateur. L’assistant le fait avec l’outil `connect_kuunda_cloud`. Un projet par application. Pas un nouveau compte, et pas un projet par fonction. Un serveur local (`npm run dev`) ne sert qu’à regarder la page.
2. Cette création branche **en même temps** la base de données et **Kuunda Git** (la copie en ligne du code).
3. Les autres fonctions (utilisateurs, stockage, connexion Google, analytique, e-mails, paiements) sont **dans ce même projet**. On ne les branche que si vous le demandez.
4. **Publier**, c’est **Kuunda Frontend**. On ne le fait que si vous demandez de mettre le site en ligne. Un envoi vers Kuunda Git construit et publie le site.

### Les informations (Kuunda Cloud)

C’est la mémoire de l’application : clients, produits, messages. Kuunda la prépare pour chaque nouveau projet, sur l’offre **standard**, sans vous demander de créer un deuxième compte Cloud.

L’assistant peut préparer et essayer les données dans un espace d’essai (le bac à sable). La mise en ligne définitive de ces données se fait depuis **Kuunda Studio**, dans Kuunda Vibe. L’assistant ne doit pas pousser tout seul vers la version réelle utilisée par vos clients.

Vous pouvez désactiver Cloud pour un projet, ou changer d’offre, avec les commandes **Kuunda Vibe** dont le nom contient **Cloud** (activer, désactiver, voir les données, gérer l’offre).

### Le travail enregistré (Kuunda Git)

C’est la copie en ligne de votre projet, pour ne pas dépendre d’un seul ordinateur. L’adresse ressemble à `https://git.kuunda-cloud.com/...`.

Un envoi vers Kuunda Git demande un **jeton** (un mot de passe spécial, à usage limité). Vous le créez dans les services du projet, page **Kuunda Git**. Ne le collez pas dans le chat et ne le mettez pas dans un fichier du projet. S’il apparaît à l’écran, considérez-le comme un secret.

### Le site visible (Kuunda Frontend)

Quand le projet est publié, les visiteurs l’ouvrent à une adresse du type `https://un-nom.kuunda-cloud.com`. Un envoi du travail vers Kuunda Git peut construire et publier le site. Vous n’avez pas à ouvrir un compte Vercel, Netlify ou GitHub Pages pour cela.

---

## 6. Voir le résultat sur votre ordinateur

Avant que le site soit en ligne, vous pouvez le regarder en local.

1. Ouvrez la commande **Kuunda Vibe : Open Browser Preview** (aperçu dans le navigateur).
2. La page du projet s’affiche dans Kuunda Vibe.
3. **Reload** recharge la page.
4. **Select Element** : vous cliquez un bouton ou un texte, et il est ajouté au chat. Vous pouvez alors dire « rends ce bouton plus grand » sans expliquer où il se trouve.

S’il n’y a pas encore de page, l’aperçu le dit. Décrivez d’abord l’écran à l’assistant.

---

## 7. Règles, skills et MCP

Ces trois réglages sont dans **Kuunda Vibe Settings** (paramètres de Kuunda Vibe), pas dans les paramètres généraux de l’éditeur.

Ouvrez la liste des commandes et cherchez **Kuunda Vibe Settings**.

### Règles

Une règle est une consigne durable.

- **AI Instructions**, onglet **General** : une consigne pour toutes vos discussions. Exemple : « Réponds toujours en français. »
- **Fichier dans le projet** : pour ce projet seulement. Le fichier s’appelle `.projectrules` et se place à la racine du dossier (à côté des autres fichiers du projet). Exemple : « Le ton du site est chaleureux, tutoiement interdit. »

Il existe aussi `.kuunda/rules` et `.voidrules`. Un seul suffit. `.projectrules` est le plus simple.

Après avoir modifié ce fichier, lancez **Kuunda Vibe : Reload Project Rules** (recharger les règles).

L’interrupteur **Disable system message** enlève les consignes intégrées de Kuunda (Cloud, Git, Frontend, questions avant de coder). Ne l’activez que si vous savez que vous voulez tout écrire vous-même dans AI Instructions.

### Skills

Un skill est une fiche de savoir-faire que l’assistant suit quand elle est allumée. Exemple : « Quand je demande une page tarif, utilise toujours trois colonnes et un bouton d’essai. »

Onglet **Skills** :

- **New Skill** crée une fiche à votre nom d’utilisateur Kuunda Vibe.
- L’interrupteur à droite allume ou éteint la fiche. Éteinte, elle reste sur l’ordinateur mais l’assistant ne s’en sert plus.
- **Open Skills Folder** ouvre le dossier pour lire ou modifier le texte.

Vous pouvez aussi mettre une fiche seulement pour un projet, dans le dossier `.kuunda/skills/nom-de-la-fiche/`. Le fichier s’appelle `SKILL.md`. Le nom du dossier : lettres minuscules, chiffres et tirets (`page-tarif`, pas `Page Tarif`).

La commande **Kuunda Vibe : Open Skills Folder** ouvre le même dossier personnel.

### MCP

MCP branche des outils extérieurs sur l’assistant (un calendrier, un tableur, un service que vous utilisez déjà).

Onglet **MCP** :

- **Add MCP Server** ouvre le fichier où vous décrivez ces branchements.
- Chaque ligne peut être allumée ou éteinte.

Si vous ne savez pas ce que c’est, laissez la liste vide. Kuunda Cloud, Git et Frontend n’ont pas besoin d’un MCP pour fonctionner.

En mode hors ligne strict, ces branchements ne sont pas utilisés.

---

## 8. Ce qu’il ne faut pas coller dans le chat ni dans le projet

Ne mettez jamais dans le projet, ni dans un message si vous pouvez l’éviter :

- le mot de passe de votre compte ;
- le jeton Kuunda Git ;
- les clés de la base de données ;
- un fichier de compte Google Play ou Apple.

Kuunda range déjà certains secrets à part, dans des fichiers que l’enregistrement en ligne ignore. Si l’assistant vous montre un secret, ne le commitez pas et ne le republiez pas dans le chat.

---

## 9. Téléphone : Google Play et l’App Store

Si le projet est une application mobile, Kuunda peut préparer les dossiers pour les boutiques. La publication réelle (fichier à envoyer, comptes développeur Google et Apple) est une étape à part. Les mots de passe de ces boutiques restent chez vous. L’assistant ne doit pas les écrire dans le projet.

---

## 10. Retrouver une commande

Presque tout ce qui est nommé **Kuunda Vibe : …** s’ouvre ainsi :

1. Appuyez sur **Ctrl+Shift+P** (Windows ou Linux) ou **Cmd+Shift+P** (Mac).
2. Tapez un mot : `projet`, `cloud`, `skills`, `preview`, `settings`.
3. Cliquez la ligne.

Commandes utiles :

| Vous voulez… | Cherchez… |
| --- | --- |
| Créer un projet | New Project |
| Ouvrir les réglages de l’assistant | Kuunda Vibe Settings |
| Recharger les règles du projet | Reload Project Rules |
| Ouvrir vos skills | Open Skills Folder |
| Voir la page en local | Open Browser Preview |
| Voir ou préparer Kuunda Cloud | les commandes qui contiennent Cloud |

---

## 11. Un déroulé simple, du début à la fin

1. Ouvrez Kuunda Vibe et, si vous voulez publier, connectez-vous.
2. **New Project**. Type : site ou application web. Nom : `boulangerie`.
3. Dans le chat, en mode **Plan**, décrivez l’idée en quelques phrases.
4. Lisez les deux ou trois propositions. Répondez, par exemple : « La recommandée, en français, pour le gérant et les clients. »
5. Passez en mode **Agent** et dites : « Vas-y. »
6. Regardez le résultat avec **Open Browser Preview**. Cliquez un élément qui ne vous plaît pas et dites ce que vous voulez changer.
7. Quand vous êtes content, enregistrez le travail sur Kuunda Git (avec un jeton créé dans Kuunda Git, pas collé dans le projet). Le site peut alors être publié sur Kuunda Frontend.

---

## 12. Si ça bloque

| Ce que vous voyez | Quoi faire |
| --- | --- |
| L’assistant construit sans vous avoir demandé votre avis | Rappelez : « Stop. Propose-moi d’abord deux ou trois options et attends. » |
| Il parle d’un outil que vous ne voulez pas | Dites le nom de l’option que vous gardez. Il doit s’y tenir ensuite. |
| « Pas de page à prévisualiser » | Demandez d’abord l’écran, puis rouvrez l’aperçu. |
| Cloud « pas encore prêt » | Kuunda réessaie tout seul. Vous n’avez pas à créer un autre compte. Réessayez un peu plus tard, ordinateur en ligne. |
| Le dossier existe déjà comme projet Kuunda | Ouvrez-le. Ne lancez pas New Project par-dessus. |
| Vous avez collé un jeton ou un mot de passe | Coupez cet accès dans le service concerné et créez-en un nouveau. Ne le laissez pas dans le chat. |

---

## 13. Les mots du quotidien

| Mot affiché | Sens |
| --- | --- |
| Projet | Le dossier de votre idée. |
| Chat | La discussion avec l’assistant. |
| Règle | Une consigne qui reste, pour tout Kuunda Vibe ou pour un seul projet. |
| Skill | Une fiche de méthode, allumée ou éteinte. |
| MCP | Un outil extérieur branché sur l’assistant. Facultatif. |
| Cloud | La mémoire des données de l’application. |
| Git | L’historique du travail, en ligne chez Kuunda. |
| Frontend | Le site que les visiteurs ouvrent. |
| Jeton | Un sésame temporaire. C’est un secret. |
| Bac à sable | L’essai, avant la version vue par vos clients. |
| Studio | L’endroit dans Kuunda où vous confirmez le passage des données d’essai vers la version réelle. |

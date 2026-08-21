# Déploiement sur Render

Ce guide couvre les étapes que **toi seul** peux faire (connexion à ton compte Render — je n'ai ni
identifiants ni accès à ton dashboard) et celles déjà automatisées par `render.yaml` à la racine du
dépôt.

## Ce que `render.yaml` définit déjà

Un [Blueprint Render](https://render.com/docs/blueprint-spec) qui déploie trois ressources :

- **`nimbalodge-db`** — PostgreSQL managé (plan `free`).
- **`nimbalodge-api`** — le backend NestJS (Node natif, pas Docker), avec migration Prisma +
  bootstrap admin exécutés avant chaque démarrage.
- **`nimbalodge-web`** — le frontend React/Vite en site statique, avec réécriture SPA (`/*` →
  `/index.html`, nécessaire pour React Router).

Plan `free` partout par défaut — décision financière volontairement laissée à toi. Deux limites à
connaître si tu comptes t'en servir durablement :
- Le service `free` se met en veille après une période d'inactivité (première requête après veille
  = ~30-60s de démarrage à froid).
- **La base `free` expire au bout de 90 jours** (Render la supprime). Pour des données réelles
  destinées à durer, passe la base sur un plan payant *avant* que des utilisateurs réels y stockent
  quoi que ce soit — sinon perte de données garantie à l'expiration.

## Étapes à faire toi-même dans le dashboard Render

### 1. Pousser le code

Si ce n'est pas déjà fait :

```
git push origin main
```

### 2. Créer le Blueprint

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connecte (ou autorise) ton compte GitHub si ce n'est pas déjà fait, puis sélectionne le dépôt
   `awaafendii/Nimbalodge`.
3. Render détecte `render.yaml` à la racine et propose les 3 ressources ci-dessus — vérifie les
   noms/plans puis clique **Apply**.

Le premier déploiement de `nimbalodge-api` va **échouer au démarrage** — c'est normal, pas un bug :
le script de bootstrap refuse de démarrer sans les identifiants du premier compte admin (jamais en
dur dans le code, voir plus bas).

### 3. Renseigner le compte administrateur (obligatoire, une seule fois)

Sur le service **`nimbalodge-api`** → **Environment** → ajoute ces 5 valeurs (elles sont déclarées
dans `render.yaml` avec `sync: false`, donc jamais commitées, jamais vues par moi) :

| Variable | Exemple |
|---|---|
| `BOOTSTRAP_ORG_NAME` | `Groupe Hôtelier Nimba` |
| `BOOTSTRAP_ADMIN_EMAIL` | `toi@tonentreprise.com` |
| `BOOTSTRAP_ADMIN_PASSWORD` | un vrai mot de passe fort, ≥ 12 caractères — choisis-le toi-même, ne me le communique pas |
| `BOOTSTRAP_ADMIN_FIRST_NAME` | `Prénom` (optionnel, défaut "Admin") |
| `BOOTSTRAP_ADMIN_LAST_NAME` | `Nom` (optionnel, défaut "Principal") |

Sauvegarde → Render relance automatiquement le déploiement. `prisma/bootstrap-production.ts`
tourne alors et crée **uniquement** une Organization + ton compte SUPER_ADMIN — aucun hôtel, aucun
département, aucune donnée métier. Voir `docs/architecture/phase-14-frontend-connection.md` et
`prisma/bootstrap-production.ts` pour le détail : c'est délibéré, conforme à la directive produit
("aucun département/catégorie/caisse/compte bancaire/activité ne doit être imposé").

Le script est idempotent : à chaque redémarrage/redéploiement, s'il trouve déjà un compte avec cet
email, il ne touche à rien (pas de réinitialisation silencieuse du mot de passe).

### 4. Vérifier les URLs (au cas où)

`render.yaml` suppose que Render attribue exactement `nimbalodge-api.onrender.com` et
`nimbalodge-web.onrender.com` (URLs prévisibles à partir du nom du service). Si l'un de ces noms
était déjà pris sur Render, ton service a reçu un suffixe différent — vérifie les URLs réelles en
haut de chaque service dans le dashboard.

Si elles diffèrent :
- Service `nimbalodge-api` → variable `CORS_ORIGIN` → mets l'URL réelle du site statique.
- Service `nimbalodge-web` → variable `VITE_API_URL` → mets `<url-réelle-api>/api/v1`.
- Sauvegarde chaque changement → redéploie manuellement le service concerné (**Manual Deploy** →
  **Deploy latest commit**).

### 5. Se connecter

Une fois les deux services au vert (`Live`) : ouvre l'URL de `nimbalodge-web`, connecte-toi avec
`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`. Le Tableau de bord affichera des valeurs à zéro
(aucune recette/dépense) et Paramètres proposera **"Créer un hôtel"** — c'est le point de départ
réel, pas une régression : configure ton premier hôtel toi-même depuis là.

### 6. Activer l'email réel (optionnel, mais recommandé avant tout vrai utilisateur)

Sans cette étape, un utilisateur qui a oublié son mot de passe reste bloqué (le lien de reset n'est
écrit que dans les logs serveur, visibles par toi seul). Aucun nom de domaine requis.

1. Crée un compte sur [app.brevo.com](https://app.brevo.com) — plan gratuit, 300 emails/jour à vie,
   aucune carte bancaire demandée.
2. **Paramètres** (icône engrenage, en haut à droite) → **Expéditeurs, domaines et dédiabilité** →
   **Expéditeurs** → **Ajouter un expéditeur** : renseigne l'email que tu veux utiliser comme
   expéditeur (le tien, ou une adresse dédiée type `noreply@...` si tu en as une) et confirme via
   l'email de vérification que Brevo t'envoie. C'est cette étape — vérifier UNE adresse email,
   pas un domaine entier — qui rend l'envoi possible sans nom de domaine.
3. **Paramètres** → **Clés API SMTP & API** → **Générer une nouvelle clé API** → copie-la (elle ne
   sera plus jamais affichée en entier ensuite).
4. Sur le service **`nimbalodge-api`** → **Environment**, renseigne :

   | Variable | Exemple |
   |---|---|
   | `BREVO_API_KEY` | la clé générée à l'étape 3 |
   | `EMAIL_FROM_ADDRESS` | l'adresse exactement vérifiée à l'étape 2 |
   | `EMAIL_FROM_NAME` | `NimbaLodge` (ou le nom que tu préfères voir comme expéditeur) |

   Sauvegarde → Render relance automatiquement le déploiement. À partir de là, `POST /auth/password-
   reset/request` envoie un vrai email au lieu de journaliser le lien — vérifiable en cliquant sur
   "Mot de passe oublié ?" depuis l'écran de connexion.

Sans ces variables, rien ne change : le comportement de repli (lien journalisé) reste actif, comme
avant cette fonctionnalité.

## Limites connues avant une première mise en production réelle

Voir `docs/security/overview.md` section "Risques résiduels" pour le détail technique — résumé
opérationnel ici :

- **Documents uploadés (factures, reçus, justificatifs) perdus au redémarrage** : le stockage est
  actuellement local sur disque (`LocalDiskStorageProvider`), et le système de fichiers Render est
  éphémère. Tout document uploadé disparaît au prochain déploiement/redémarrage du service
  `nimbalodge-api`. Ne pas exposer ce déploiement à de vrais utilisateurs qui compteraient sur la
  persistance de leurs documents tant qu'un `StorageProvider` cloud (S3/R2/...) n'est pas branché.
- **Réinitialisation de mot de passe par email** : fonctionnelle dès que l'étape 6 ci-dessus
  (`BREVO_API_KEY`/`EMAIL_FROM_ADDRESS`) est complétée. Tant que ces variables ne sont pas
  renseignées, le lien de reset reste écrit dans les logs serveur (visibles dans le dashboard
  Render → service `nimbalodge-api` → **Logs**), jamais envoyé par email — repli explicite, pas un
  bug, mais inutilisable pour de vrais utilisateurs externes.

## Ce qui reste hors de portée de ce déploiement

- **Vercel n'a jamais été utilisé** — abandonné après vérification : Vercel ne fait pas tourner de
  serveur Node stateful avec connexion PostgreSQL persistante (NestJS+Prisma), seulement des
  fonctions serverless/sites statiques. Render héberge les deux composants (API + statique) au même
  endroit, d'où le choix.
- Domaine personnalisé — pas configuré (les URLs `*.onrender.com` par défaut sont utilisées).
  Ajoutable ensuite dans le dashboard Render, aucune limite technique de notre côté.
- Render redéploie automatiquement à chaque push sur `main` (comportement standard du Blueprint),
  indépendamment du résultat de `.github/workflows/ci.yml` — la CI rapporte un statut mais ne
  bloque pas le déploiement Render tant qu'une règle de protection de branche ne l'exige pas
  explicitement côté GitHub (non configurée, décision à prendre séparément).
- Sauvegarde de la base — voir `docs/deployment/database-backup.md` (non couverte par Render sur
  le plan `free`).

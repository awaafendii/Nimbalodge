# Sauvegarde de la base de données

Le plan `free` de Render Postgres (voir `render.yaml` / `docs/deployment/render.md`) n'inclut
**aucune sauvegarde automatique ni point-in-time recovery**, et **la base free expire purement et
simplement au bout de 90 jours**. Pour une base contenant de vraies données financières/RH, ça
suffit à justifier un filet de sécurité indépendant de Render — c'est l'objet de
`.github/workflows/db-backup.yml`.

## Ce que fait le workflow

Tous les jours à 03:00 UTC (heure creuse pour des utilisateurs en Guinée, UTC+0), et à la demande
via **Actions → Database Backup → Run workflow** :

1. `pg_dump` de la base de production (image `postgres:16-alpine`, alignée sur la version du
   serveur — voir `docker-compose.yml`/`render.yaml`), format SQL brut, `--no-owner --no-privileges`
   pour rester restaurable sous un rôle différent de `nimbalodge`.
2. **Vérifie que la sauvegarde se restaure vraiment** : restauration dans une base Postgres 16
   jetable créée pour ce seul run, puis compte les tables restaurées. Le workflow échoue si la
   restauration échoue ou ne produit aucune table — un fichier de sauvegarde qui ne se restaure pas
   n'est pas une sauvegarde utilisable, autant le savoir immédiatement plutôt qu'au moment où on en
   a réellement besoin.
3. Compresse (`gzip`) et publie le résultat comme [artifact GitHub Actions](https://docs.github.com/actions/using-workflows/storing-workflow-data-as-artifacts),
   conservé **30 jours**.

## Mise en place (à faire une seule fois, par toi)

Le workflow a besoin de l'URL de connexion à la base de **production** — je n'y ai pas accès, tu
dois la fournir comme secret GitHub :

1. Dashboard Render → service **`nimbalodge-db`** → onglet **Connect** → copie **External
   Database URL** (commence par `postgresql://...`, contient le mot de passe généré par Render).
2. Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret**.
3. Nom : `PROD_DATABASE_URL` — Valeur : l'URL copiée à l'étape 1.

Sans ce secret, le workflow échoue immédiatement avec un message explicite plutôt que de tourner
dans le vide.

## Restaurer une sauvegarde (en cas de besoin réel)

1. Dépôt GitHub → **Actions → Database Backup** → choisis le run le plus récent avant l'incident →
   télécharge l'artifact (`nimbalodge-backup-<date>.zip`, contient le `.sql.gz`).
2. Décompresse : `gunzip nimbalodge-backup-<date>.sql.gz`.
3. Crée (ou vise) une base Postgres **vide** — le dump n'inclut pas de `DROP TABLE`, il est prévu
   pour restaurer dans une base neuve, pas pour écraser une base existante.
4. `psql "<URL-de-la-base-cible>" -f nimbalodge-backup-<date>.sql`

## Limites à connaître

- **Rétention 30 jours** : au-delà, l'artifact a disparu de GitHub. Pour un archivage plus long,
  il faudrait un stockage externe (S3/Backblaze) — pas mis en place ici, décision volontairement
  laissée de côté tant qu'un besoin concret ne le justifie pas (voir l'échange qui a précédé cette
  mise en place).
- **Les workflows planifiés GitHub Actions sont automatiquement désactivés après 60 jours sans
  aucune activité sur le dépôt** (aucun commit/push) — si le projet reste inactif deux mois, la
  planification s'arrête silencieusement. Un push (ou un déclenchement manuel) la réactive.
- Les crons GitHub Actions peuvent être retardés de quelques minutes en cas de forte charge sur
  l'infrastructure GitHub — normal, pas un bug de ce workflow.

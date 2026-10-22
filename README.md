This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Démarrage avec Docker

L'application Next.js et PostgreSQL sont lancés ensemble avec Docker Compose. La base PostgreSQL est conservée dans le volume `postgres_data`.

1. Copiez `.env.example` vers `.env`, puis remplacez les valeurs d'exemple. Les secrets peuvent être générés avec :

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Générez des valeurs distinctes pour `POSTGRES_PASSWORD`, `AUTH_SECRET` et `CRON_SECRET`. Conservez `POSTGRES_PASSWORD` en hexadécimal afin qu'il puisse être utilisé sans encodage dans `DATABASE_URL`.
2. Configurez `SMTP_USER` et `SMTP_PASS` avec votre compte Gmail et son mot de passe d'application (voir ci-dessous).
3. Lancez les services :

   ```bash
   docker compose up --build -d
   ```

   L'application est disponible sur [http://localhost:3000](http://localhost:3000). Pour consulter les journaux : `docker compose logs -f app`.

Les tables PostgreSQL sont créées automatiquement au premier démarrage. Si `.data/subtracker.sqlite` existe, son contenu est importé une seule fois dans PostgreSQL ; sinon, `.data/subtracker.json` est importé s'il existe. Les fichiers sources restent inchangés. Pour arrêter les services sans supprimer les données : `docker compose down`. **Ne lancez pas `docker compose down -v` sauf si vous voulez aussi supprimer la base de données.**

Pour lancer Next.js directement sur la machine, démarrez d'abord PostgreSQL et configurez `DATABASE_URL` avec l'adresse accessible depuis l'hôte (par exemple `localhost`), puis lancez `npm run dev`. Node.js 22.13 ou une version ultérieure est requis.

Les routes du backend sont intégrées à Next.js sous `/api`. En production, définissez `AUTH_SECRET` avec une valeur longue et aléatoire.

## Déploiement en production avec Traefik

Le fichier `compose.prod.yaml` est réservé au déploiement derrière Traefik ; le `compose.yaml` à la racine reste destiné au développement local. Il place l'application derrière le proxy et PostgreSQL sur un réseau privé, sans publier de port de base de données ni de port applicatif sur l'hôte.

Sur le serveur :

1. Assurez-vous que Traefik est déjà lancé avec son fournisseur Docker, l'entrypoint HTTPS et le résolveur de certificats ACME configurés.
2. Créez le réseau Docker partagé avec Traefik, si nécessaire. Son nom par défaut est `traefik` :

   ```bash
   docker network create traefik
   ```

   Si Traefik utilise déjà un autre réseau externe, définissez `TRAEFIK_NETWORK` avec son nom dans `.env.production`.
3. Créez `.env.production` à partir de `.env.production.example`. Renseignez le domaine public dans `APP_DOMAIN` et `APP_URL`, générez des valeurs secrètes distinctes pour `POSTGRES_PASSWORD`, `AUTH_SECRET` et `CRON_SECRET`, puis configurez votre compte Gmail et son mot de passe d'application.
4. Vérifiez que `TRAEFIK_ENTRYPOINT` et `TRAEFIK_CERT_RESOLVER` correspondent aux noms configurés dans Traefik, puis démarrez l'application :

   ```bash
   docker compose --env-file .env.production -f compose.prod.yaml up --build -d
   ```

Les données PostgreSQL persistent dans le volume `postgres_data`. `docker compose --env-file .env.production -f compose.prod.yaml down` arrête les services sans supprimer les données ; ne rajoutez pas `-v` sauf si vous souhaitez supprimer la base.

Les abonnements supprimés restent restaurables pendant 30 jours avant leur suppression définitive. Dans ce déploiement, le service `subscription-cleanup` lance automatiquement le nettoyage chaque jour.

## Historique des abonnements supprimés

Les abonnements supprimés restent restaurables pendant 30 jours avant leur suppression définitive. Le nettoyage est planifié quotidiennement à 07:15 UTC sur Vercel et exécuté par le service `subscription-cleanup` en production Compose. Sur un autre hébergement, configurez un cron quotidien pour appeler `/api/cron/subscription-cleanup` avec l'en-tête d'autorisation `CRON_SECRET`.

## Rappels par e-mail

Les rappels de renouvellement et la réinitialisation de mot de passe utilisent Gmail SMTP. Activez la validation en deux étapes sur le compte Google, puis créez un mot de passe d'application dans les paramètres de sécurité Google. Utilisez ce mot de passe d'application, jamais le mot de passe habituel du compte. Certains comptes administrés par une organisation peuvent interdire les mots de passe d'application.

Renseignez ces variables dans `.env` (Compose les transmet au conteneur de l'application) ou dans l'environnement de production :

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465` (TLS)
- `SMTP_USER` : adresse Gmail complète.
- `SMTP_PASS` : mot de passe d'application Google à 16 caractères. Les espaces sont retirés automatiquement.
- `EMAIL_FROM` : facultatif ; utilisez de préférence `SubTracker <votre-adresse@gmail.com>` avec la même adresse que `SMTP_USER`.
- `APP_URL` : URL publique de l'application, sans chemin, utilisée dans le lien du rappel.
- `CRON_SECRET` : secret aléatoire utilisé pour protéger l'endpoint cron.

Générez `CRON_SECRET` avec Node.js :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`vercel.json` planifie `/api/cron/reminders` chaque jour à 07:00 UTC. Vercel envoie l'en-tête `Authorization: Bearer <CRON_SECRET>` lorsque la variable est configurée. Pour un hébergement différent, configurez un cron quotidien qui appelle la même route avec cet en-tête. Le traitement respecte `email_notifications` et `renewal_reminder_days`, et marque chaque échéance après un envoi réussi. En dehors de Vercel, planifiez un appel quotidien à `/api/cron/reminders` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

Le lien « Mot de passe oublié ? » envoie un lien à usage unique, valable une heure, vers l'adresse renseignée. Il utilise `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` et `APP_URL` ci-dessus. Ces variables doivent être présentes sur le serveur et `APP_URL` doit correspondre à l'adresse publique de l'application. Les adresses qui ne correspondent à aucun compte reçoivent la même confirmation que les adresses existantes.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Documentation Next.js

Pour en savoir plus sur Next.js, consultez la [documentation](https://nextjs.org/docs).

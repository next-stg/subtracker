This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Backend local

Le backend est intégré à Next.js via les Route Handlers sous `/api`. Il persiste les utilisateurs, catégories, abonnements et autres données dans la base SQLite `.data/subtracker.sqlite` (ce répertoire est ignoré par Git). Node.js 22.13 ou une version ultérieure est requis pour le module SQLite intégré.

```bash
npm run dev
```

Au premier démarrage, les données existantes de `.data/subtracker.json` sont importées automatiquement dans SQLite ; le fichier JSON d'origine est conservé. Sauvegardez régulièrement `.data/subtracker.sqlite` ainsi que ses éventuels fichiers `-wal` et `-shm` après l'arrêt du serveur.

Les routes sont protégées par des tokens access/refresh. Pour utiliser un backend déployé séparément, définissez `NEXT_PUBLIC_API_URL` dans l'environnement du frontend. En production, définissez également `AUTH_SECRET` avec une valeur longue et aléatoire.

## Coffre d'identifiants

Les identifiants du gestionnaire sont chiffrés avec AES-256-GCM avant leur écriture dans le stockage. Le serveur exige une clé dédiée `PASSWORD_VAULT_KEY` de 32 octets encodée en Base64. Générez-la avec Node.js :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Ajoutez la valeur générée dans `.env.local` sous la forme `PASSWORD_VAULT_KEY=<valeur>`, et configurez la même variable dans l'environnement de production. Conservez cette clé dans un gestionnaire de secrets et dans vos sauvegardes sécurisées : sans elle, les identifiants chiffrés ne peuvent pas être récupérés. Ne la commitez pas.

## Rappels par e-mail

Les rappels de renouvellement et la réinitialisation de mot de passe utilisent Gmail SMTP. Activez la validation en deux étapes sur le compte Google, puis créez un mot de passe d'application dans les paramètres de sécurité Google. Utilisez ce mot de passe d'application, jamais le mot de passe habituel du compte. Certains comptes administrés par une organisation peuvent interdire les mots de passe d'application.

Ajoutez ces variables à `.env.local` et à l'environnement de production :

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

`vercel.json` planifie `/api/cron/reminders` chaque jour à 07:00 UTC. Vercel envoie l'en-tête `Authorization: Bearer <CRON_SECRET>` lorsque la variable est configurée. Pour un hébergement différent, configurez un cron quotidien qui appelle la même route avec cet en-tête. Le traitement respecte `email_notifications` et `renewal_reminder_days`, et marque chaque échéance après un envoi réussi.

Le lien « Mot de passe oublié ? » envoie un lien à usage unique, valable une heure, vers l'adresse renseignée. Il utilise `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` et `APP_URL` ci-dessus. Ces variables doivent être présentes sur le serveur et `APP_URL` doit correspondre à l'adresse publique de l'application. Les adresses qui ne correspondent à aucun compte reçoivent la même confirmation que les adresses existantes.

La base SQLite est stockée localement dans `.data/subtracker.sqlite`. Elle convient au développement et à un serveur persistant, mais pas aux fonctions serverless Vercel : leurs fichiers ne sont pas un stockage durable ou partagé entre exécutions. Pour une mise en production Vercel fiable des abonnements et des e-mails, utilisez une base de données hébergée et persistante.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

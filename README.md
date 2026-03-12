# 🛡️ CyberLearn

Plateforme de formation en cybersécurité style TryHackMe — cours interactifs, quiz, système de XP, profils utilisateurs et panneau d'administration.

## Stack

| Couche | Technologie |
|--------|------------|
| Backend | Node.js + Express |
| Base de données | SQLite (better-sqlite3) |
| Auth | JWT httpOnly cookies + bcrypt |
| Frontend | HTML/CSS/JS — thème dark cyberpunk |
| Conteneurisation | Docker + docker-compose |
| Reverse proxy | Nginx (TLS, rate-limit, gzip) |
| CI/CD | GitHub Actions (push `main` → déploiement VPS) |

## 🚀 Démarrage rapide (dev local)

```bash
# 1. Cloner et installer
git clone https://github.com/Jarko59/Perso.git
cd Perso
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Éditez .env avec votre JWT_SECRET

# 3. Lancer le serveur (DB + seed automatiques au 1er démarrage)
npm run dev

# 4. Ouvrir http://localhost:3000
```

**Compte admin par défaut :** `admin@cyberlearn.io` / `Admin1234!`

## 🐳 Docker (production)

```bash
# Build et lancer
docker compose up -d

# Logs
docker compose logs -f app

# Arrêter
docker compose down
```

## 🔄 CI/CD — GitHub Actions

Le workflow `.github/workflows/deploy.yml` se déclenche **automatiquement** sur push vers `main`.

### Secrets GitHub à configurer

Dans **Settings → Secrets and variables → Actions** :

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | IP ou domaine de votre VPS |
| `VPS_USER` | Utilisateur SSH (ex: `ubuntu`) |
| `VPS_SSH_KEY` | Clé SSH privée (contenu de `~/.ssh/id_rsa`) |
| `VPS_PORT` | Port SSH (défaut: 22) |
| `JWT_SECRET` | Secret JWT fort (min. 64 chars) |
| `ADMIN_EMAIL` | Email du compte admin |
| `ADMIN_PASSWORD` | Mot de passe admin |

### Workflow de déploiement

```
git checkout dev
# ... développement ...
git push origin dev

# Merge dev → main via PR GitHub
# ↓ GitHub Actions s'enclenche automatiquement
# ↓ Build image Docker → push GHCR
# ↓ SSH sur VPS → docker compose pull && up
# ↓ Health check
```

## 📁 Structure du projet

```
├── server.js              # Serveur Express principal
├── database/
│   ├── db.js              # Connexion SQLite + schema
│   └── seed.js            # Données initiales (7 cours, 35 quiz)
├── middleware/
│   └── auth.js            # Middleware JWT
├── routes/
│   ├── auth.js            # /api/auth/*
│   ├── courses.js         # /api/courses/*
│   ├── quizzes.js         # /api/quizzes/*
│   └── users.js           # /api/users/*
├── public/                # Frontend statique
│   ├── css/style.css      # Design system complet
│   ├── index.html         # Landing page
│   ├── login.html / register.html
│   ├── dashboard.html
│   ├── courses.html / course.html
│   ├── quiz.html
│   ├── profile.html
│   └── admin.html
├── nginx/nginx.conf        # Config Nginx production
├── Dockerfile              # Multi-stage build
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

## 🔒 Sécurité

- Mots de passe hashés avec **bcrypt** (12 rounds)
- Auth via **JWT** en cookie `httpOnly; Secure; SameSite=Lax`
- Rate limiting : 100 req/min global, 10 req/min sur `/api/auth/`
- Headers sécurité : HSTS, X-Frame-Options, X-Content-Type-Options
- Requêtes SQL paramétrées (protection SQLi)
- WAL mode SQLite pour performances en concurrence
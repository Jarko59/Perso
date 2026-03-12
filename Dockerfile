# On utilise Nginx, un serveur web ultra-léger et très performant
FROM nginx:alpine

# On copie tous les fichiers de ton projet dans le dossier public du serveur web
COPY . /usr/share/nginx/html

# On expose le port 80 (le port web standard)
EXPOSE 80

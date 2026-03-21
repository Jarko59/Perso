FROM nginx:alpine

# Mettre le flag en place
RUN echo "CTF{w3lcom3_t0_d0ck3r_s4ndb0x}" > /usr/share/nginx/html/flag.txt

# Remplacer la page par défaut
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

# Image de base Ubuntu (plus "réelle" pour un lab)
FROM ubuntu:22.04

# Éviter les questions interactives pendant l'install
ENV DEBIAN_FRONTEND=noninteractive

# Installer SSH et sudo
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    iputils-ping \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Configurer SSH
RUN mkdir /var/run/sshd
RUN echo 'root:cyberlearn_root_pwd_very_long' | chpasswd
# Autoriser l'auth par mot de passe
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Créer un utilisateur "faible"
RUN useradd -m -s /bin/bash student
RUN echo 'student:cyberlearn' | chpasswd

# --- LA FAILLE (Privilege Escalation) ---
# Autoriser l'utilisateur student à lancer 'find' en sudo sans mot de passe
RUN echo "student ALL=(root) NOPASSWD: /usr/bin/find" >> /etc/sudoers

# Créer le Flag (accessible uniquement par root)
RUN echo "CYBER{SUDO_F1ND_PR1V_E5C_2024}" > /root/flag.txt
RUN chmod 400 /root/flag.txt

# Exposer le port SSH
EXPOSE 22

# Lancer SSH au démarrage
CMD ["/usr/sbin/sshd", "-D"]

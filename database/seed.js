const { query } = require('./db');
const bcrypt = require('bcryptjs');

const seedDB = async () => {
  try {
    console.log('🌱 Début du seeding PostgreSQL...');

    // 1. Clear existing data
    await query('TRUNCATE users, categories, courses, modules, user_progress, quiz_questions, quiz_results, bookmarks CASCADE');

    // 2. Create Admin
    const adminPwd = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin1234!', 12);
    await query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
      ['admin', process.env.ADMIN_EMAIL || 'admin@cyberlearn.io', adminPwd, 'admin']
    );

    // 3. Categories
    const categories = [
      ['Systèmes Linux', 'linux', '🐧', '#10b981'],
      ['Réseaux', 'networking', '🌐', '#3b82f6'],
      ['Sécurité Web', 'web-sec', '🕸️', '#f43f5e'],
      ['Cryptographie', 'crypto', '🔐', '#8b5cf6'],
      ['OSINT', 'osint', '🔍', '#f59e0b'],
      ['Privilege Escalation', 'priv-esc', '⚡', '#ef4444'],
      ['Hacking Réseau', 'net-hacking', '📡', '#06b6d4'],
    ];

    const categoryMap = {};
    for (const [name, slug, icon, color] of categories) {
      const res = await query(
        'INSERT INTO categories (name, slug, icon, color) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, slug, icon, color]
      );
      categoryMap[slug] = res.rows[0].id;
    }

    // 4. Courses
    const courses = [
      {
        title: 'Linux Fundamentals',
        slug: 'linux-fundamentals',
        cat: 'linux',
        diff: 'beginner',
        desc: 'Maîtrisez la ligne de commande et l\'administration de base sous Linux.',
        icon: '🐧',
        color: '#10b981',
        modules: [
          ['Introduction au Shell', 'Le Shell est votre meilleur ami. Apprenez `ls`, `cd`, `pwd`...', 10],
          ['Gestion des Fichiers', 'Apprenez à créer, copier et déplacer des fichiers avec `touch`, `cp`, `mv`...', 10],
          ['Permissions & Utilisateurs', 'Comprendre `chmod`, `chown` et la gestion des droits...', 10],
          ['Processus & Services', 'Gérer les services avec `systemctl` et monitorer avec `top`...', 20],
        ],
        quizzes: [
          ['Quelle commande affiche le répertoire actuel ?', 'ls', 'pwd', 'cd', 'whoami', 'b', 'pwd signifie Print Working Directory'],
          ['Comment lister les fichiers cachés ?', 'ls -a', 'ls -l', 'ls -h', 'ls -r', 'a', '-a signifie all'],
          ['Quelle commande change le propriétaire d\'un fichier ?', 'chmod', 'chown', 'chgrp', 'passwd', 'b', 'chown = Change Owner'],
          ['Que signifie l\'extension .sh ?', 'Shared', 'Shell Script', 'Shutdown', 'Shown', 'b', 'Indique un script shell'],
          ['Quel utilisateur a l\'ID 0 ?', 'admin', 'user', 'root', 'guest', 'c', 'root est le super-utilisateur'],
        ]
      },
      {
        title: 'Networking 101',
        slug: 'networking-101',
        cat: 'networking',
        diff: 'beginner',
        desc: 'Comprendre le modèle OSI, TCP/IP et le fonctionnement d\'Internet.',
        icon: '🌐',
        color: '#3b82f6',
        modules: [
          ['Modèle OSI', 'Les 7 couches indispensables à connaître...', 10],
          ['Protocoles IP & ICMP', 'Le routage et le ping...', 10],
          ['TCP vs UDP', 'Fiabilité vs Rapidité...', 10],
          ['DNS & HTTP', 'Comment les noms de domaine sont résolus...', 20],
        ],
        quizzes: [
          ['Combien de couches compte le modèle OSI ?', '4', '5', '7', '8', 'c', '7 couches : Physique à Application'],
          ['À quelle couche appartient le protocole IP ?', '2', '3', '4', '7', 'b', 'Couche Réseau (Network)'],
          ['Quel port est utilisé par HTTPS ?', '80', '443', '22', '3306', 'b', '443 est le port SSL/TLS standard'],
          ['Que signifie DHCP ?', 'Domain Host Config', 'Dynamic Host Configuration Protocol', 'Data Host Control', 'Direct Hub Connection', 'b', 'Attribue des IPs dynamiquement'],
          ['Quelle commande teste la connectivité ?', 'ls', 'ping', 'ipconfig', 'route', 'b', 'Envoie des ICMP Echo Requests'],
        ]
      },
      {
        title: 'Web Security & OWASP',
        slug: 'web-security',
        cat: 'web-sec',
        diff: 'intermediate',
        desc: 'Apprenez à identifier et exploiter les vulnérabilités web courantes.',
        icon: '🕸️',
        color: '#f43f5e',
        modules: [
          ['SQL Injection', 'Exploiter les failles de base de données...', 20],
          ['Cross-Site Scripting (XSS)', 'Injecter du JS dans le navigateur des victimes...', 20],
          ['IDOR & Broken Auth', 'Accéder à des données sans autorisation...', 20],
          ['Burp Suite Basics', 'Utiliser l\'outil n°1 du pentester web...', 40],
        ],
        quizzes: [
          ['Que signifie SQLi ?', 'SQL Interface', 'SQL Injection', 'SQL Index', 'SQL Integration', 'b', 'Injection de code SQL malveillant'],
          ['Quel type d\'XSS est stocké en base de données ?', 'Reflected', 'DOM-based', 'Stored', 'Blind', 'c', 'Stored XSS'],
          ['Que signifie OWASP ?', 'Open Web Application Security Project', 'Online Web Auth System', 'Open Worldwide Application Security', 'None', 'a', 'La référence mondiale en sécu web'],
          ['Une faille IDOR permet de...', 'Miner du bitcoin', 'Accéder aux fichiers d\'un autre utilisateur', 'Crash le serveur', 'Changer le design', 'b', 'Insecure Direct Object Reference'],
          ['Quel caractère est souvent utilisé pour tester SQLi ?', '"', "'", ';', '--', 'b', "L'apostrophe simple brise souvent la requête"],
        ]
      },
      {
        title: 'Cryptographie Appliquée',
        slug: 'crypto-basics',
        cat: 'crypto',
        diff: 'beginner',
        desc: 'Les bases du chiffrement symétrique et asymétrique.',
        icon: '🔐',
        color: '#8b5cf6',
        modules: [
          ['Chiffrements Historiques', 'César, Vigenère et Enigma...', 10],
          ['AES & Chiffrement Symétrique', 'Une seule clé pour tout verrouiller...', 10],
          ['RSA & Chiffrement Asymétrique', 'Clé publique et clé privée...', 20],
          ['Hashing & Salting', 'Protéger les mots de passe des utilisateurs...', 20],
        ],
        quizzes: [
          ['Quel chiffrement utilise un décalage de lettres ?', 'AES', 'RSA', 'César', 'SHA', 'c', 'César (ex: A -> D)'],
          ['Combien de clés dans le chiffrement symétrique ?', '1', '2', '3', '4', 'a', 'Une seule clé partagée'],
          ['SHA-256 est un algorithme de...', 'Chiffrement', 'Hachage', 'Compression', 'Encodage', 'b', 'C\'est une fonction de hachage'],
          ['Que signifie "Assymétrique" ?', 'Pas de clé', 'Une clé différente pour chiffrer et déchiffrer', 'Une clé très longue', 'Un chiffrement rapide', 'b', 'Public/Private key pair'],
          ['Pourquoi "saler" un mot de passe ?', 'Pour le rendre lisible', 'Pour contrer les Rainbow Tables', 'Pour accélérer le hachage', 'Pour économiser de la place', 'b', 'Ajoute de l\'aléa avant le hachage'],
        ]
      },
      {
        title: 'OSINT & Reconnaissance',
        slug: 'osint-recon',
        cat: 'osint',
        diff: 'beginner',
        desc: 'Apprenez à collecter des informations en sources ouvertes.',
        icon: '🔍',
        color: '#f59e0b',
        modules: [
          ['Google Dorking', 'Utiliser les opérateurs avancés de Google...', 10],
          ['Social Media Investigation', 'Retrouver des traces sur LinkedIn, Twitter...', 10],
          ['Whois & DNS Analysis', 'À qui appartient ce domaine ?', 15],
          ['Shodan & Censys', 'Trouver des serveurs exposés...', 15],
        ],
        quizzes: [
          ['Que signifie OSINT ?', 'Open Source Intelligence', 'Online System Intelligence', 'Open Secure Interface', 'None', 'a', 'Collecte en sources ouvertes'],
          ['Quel opérateur Google cherche un type de fichier ?', 'site:', 'inurl:', 'filetype:', 'intitle:', 'c', 'filetype:pdf par exemple'],
          ['Shodan est un moteur de recherche pour...', 'Les PDF', 'Les objets connectés (IoT)', 'Les réseaux sociaux', 'Les images', 'b', 'Le "Google des hackers"'],
          ['Whois permet de...', 'Voir le code source', 'Connaître le propriétaire d\'un domaine', 'Hacker un site', 'Trouver des exploits', 'b', 'Fournit les infos d\'enregistrement'],
          ['Quel réseau est utile pour l\'OSINT d\'entreprise ?', 'TikTok', 'LinkedIn', 'Instagram', 'Snapchat', 'b', 'LinkedIn pour les employés et structures'],
        ]
      },
      {
        title: 'Privilege Escalation',
        slug: 'privesc-linux',
        cat: 'priv-esc',
        diff: 'advanced',
        desc: 'De simple utilisateur à ROOT : les techniques d\'élévation de privilèges.',
        icon: '⚡',
        color: '#ef4444',
        modules: [
          ['Sudo & SUID Permissions', 'Exploiter les mauvaises configurations sudo...', 30],
          ['Kernel Exploits', 'Le dernier recours du hacker...', 40],
          ['Crontab Jobs', 'Quand l\'automatisation devient une faille...', 30],
        ],
        quizzes: [
          ['Que signifie SUID ?', 'Super User ID', 'Set User ID', 'System Unit ID', 'None', 'b', 'Exécute avec les droits du proprio'],
          ['Quelle commande liste les privilèges sudo ?', 'sudo -l', 'sudo -v', 'sudo -s', 'sudo -k', 'a', '-l pour list'],
          ['Où sont stockés les mots de passe (hash) sous Linux ?', '/etc/passwd', '/etc/shadow', '/var/log/auth', '/root', 'b', 'Dans /etc/shadow'],
          ['Un exploit Kernel cible...', 'Le navigateur', 'Le noyau du système', 'La base de données', 'Le site web', 'b', 'Le coeur de l\'OS'],
          ['Quel binaire permet souvent un privesc via sudo ?', 'ls', 'vi / vim', 'pwd', 'cat', 'b', 'On peut spawn un shell depuis vim'],
        ]
      },
      {
        title: 'Hacking Réseau',
        slug: 'network-hacking',
        cat: 'net-hacking',
        diff: 'advanced',
        desc: 'Interception, Man-in-the-Middle et exploitation de protocoles réseau.',
        icon: '📡',
        color: '#06b6d4',
        modules: [
          ['ARP Spoofing', 'Se placer au milieu de la conversation...', 30],
          ['Wireshark Analysis', 'Lire les paquets qui circulent...', 30],
          ['Exploitation SMB/FTP', 'Accéder aux partages de fichiers...', 40],
        ],
        quizzes: [
          ['Que signifie MitM ?', 'Man in the Middle', 'Message in the Menu', 'None', 'Multiple Interface', 'a', 'Une attaque par interception'],
          ['ARP associe une IP à...', 'Un nom de domaine', 'Une adresse MAC', 'Un port', 'Un utilisateur', 'b', 'Address Resolution Protocol'],
          ['Wireshark est un...', 'Antivirus', 'Analyseur de paquets', 'Navigateur', 'Firewall', 'b', 'Sniffer réseau'],
          ['Quel port utilise SMB ?', '80', '443', '445', '21', 'c', '445 (Microsoft-DS)'],
          ['Le protocole FTP est-il chiffré par défaut ?', 'Oui', 'Non', 'Parfois', 'Seulement le login', 'b', 'Tout circule en clair'],
        ]
      }
    ];

    for (const c of courses) {
      const courseRes = await query(
        'INSERT INTO courses (category_id, title, slug, description, difficulty, icon, banner_color, published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [categoryMap[c.cat], c.title, c.slug, c.desc, c.diff, c.icon, c.color, true]
      );
      const courseId = courseRes.rows[0].id;

      // Add modules
      for (let i = 0; i < c.modules.length; i++) {
        await query(
          'INSERT INTO modules (course_id, title, content, order_index, xp_reward) VALUES ($1, $2, $3, $4, $5)',
          [courseId, c.modules[i][0], c.modules[i][1], i, c.modules[i][2]]
        );
      }

      // Add quiz questions
      for (const q of c.quizzes) {
        await query(
          'INSERT INTO quiz_questions (course_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [courseId, q[0], q[1], q[2], q[3], q[4], q[5], q[6]]
        );
      }
    }

    console.log('✅ Seeding PostgreSQL terminé !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seeding PostgreSQL:', err.message);
    process.exit(1);
  }
};

seedDB();

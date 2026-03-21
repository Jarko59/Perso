const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Démarre un conteneur éphémère pour un exercice
 * @param {string} image Nom de l'image Docker (ex: 'nginxdemos/hello')
 * @param {string} prefix Préfixe du nom (ex: 'user-123')
 * @returns {Promise<{id: string, port: number}>} L'ID et le port attribué
 */
async function spawnInstance(image, prefix) {
  try {
    // Vérifier si l'image existe, sinon on pourrait la puller (simplifié ici)
    const container = await docker.createContainer({
      Image: image,
      name: `cyberlearn-${prefix}-${Date.now()}`,
      HostConfig: {
        AutoRemove: true, // Se détruit dès qu'il est stoppé
        Memory: 256 * 1024 * 1024, // 256MB limite
        CpuShares: 512, // 50% CPU
        NetworkMode: 'bridge',
        PublishAllPorts: true // Mappe les ports EXPOSE aléatoirement
      }
    });

    await container.start();

    // Récupérer le port assigné dynamiquement
    const info = await container.inspect();
    const ports = info.NetworkSettings.Ports;
    
    // On prend le premier port exposé
    const firstPortKey = Object.keys(ports || {})[0];
    if (!firstPortKey || !ports[firstPortKey]) {
      // Si pas de port, on retourne 0
      return { id: container.id, port: 0 };
    }

    const hostPort = ports[firstPortKey][0].HostPort;
    return { id: container.id, port: parseInt(hostPort) };

  } catch (error) {
    console.error(`❌ ERREUR DOCKER SPAWN DETAIL :`, {
      message: error.message,
      statusCode: error.statusCode,
      json: error.json,
      image: image
    });
    throw error;
  }
}

/**
 * Arrête (et supprime grace à AutoRemove) un conteneur
 * @param {string} containerId 
 */
async function stopInstance(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.stop(); // AutoRemove s'enoccupera
  } catch (error) {
    console.error(`❌ Erreur Docker Stop (${containerId}):`, error.message);
    // Ignore si déjà stoppé ou introuvable (404)
    if (error.statusCode !== 404 && error.statusCode !== 304) {
      throw error;
    }
  }
}

module.exports = {
  docker,
  spawnInstance,
  stopInstance
};

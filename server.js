const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar base de datos
db.init().catch(err => {
  console.error('Error inicializando base de datos:', err);
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function euclideanDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
}

// ==========================================
// 1. RUTAS DE AUTENTICACIÓN TRADICIONAL
// ==========================================

// Login Normal (Email/Usuario y Contraseña)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Debes ingresar email y contraseña' });
  }

  try {
    const user = await db.findUserByEmail(email);
    if (!user) {
      await db.addLog({
        type: 'auth_failed',
        description: 'Intento de acceso fallido',
        userId: email,
        details: 'Usuario no encontrado',
        ip: req.ip
      });
      return res.status(401).json({ error: 'Credenciales inválidas: usuario no encontrado' });
    }

    const hashedInput = hashPassword(password);
    if (user.passwordHash !== hashedInput) {
      await db.addLog({
        type: 'auth_failed',
        description: 'Intento de acceso fallido',
        userId: email,
        userName: user.name,
        details: 'Contraseña incorrecta',
        ip: req.ip
      });
      return res.status(401).json({ error: 'Credenciales inválidas: contraseña incorrecta' });
    }

    // Verificar si el usuario tiene rostro enrolado
    const facialProfiles = await db.getAllFacialUsers();
    const hasFacialProfile = facialProfiles.some(
      f => (f.user_id || f.userId || '').toLowerCase() === user.email.toLowerCase() ||
           (f.user_id || f.userId || '').toLowerCase() === (user.userId || '').toLowerCase()
    );

    await db.addLog({
      type: 'auth_normal',
      description: 'Inicio de sesión con contraseña',
      userId: user.email,
      userName: user.name,
      details: 'Acceso exitoso al CRM',
      ip: req.ip
    });

    const userSafe = {
      id: user.id,
      userId: user.email,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      hasFacialProfile
    };

    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: userSafe,
      authMethod: 'password'
    });
  } catch (err) {
    console.error('Error en /api/auth/login:', err);
    res.status(500).json({ error: 'Error del servidor al procesar el inicio de sesión' });
  }
});

// Registro de Usuario Nuevo
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  try {
    const existing = await db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un usuario con este correo electrónico' });
    }

    const newUser = await db.createUser({
      name,
      email,
      password,
      role: role || 'Ejecutivo CRM'
    });

    await db.addLog({
      type: 'user_registered',
      description: 'Nuevo usuario registrado',
      userId: newUser.email,
      userName: newUser.name,
      details: `Rol: ${newUser.role}`,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.id,
        userId: newUser.email,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        avatar: newUser.avatar,
        hasFacialProfile: false
      }
    });
  } catch (err) {
    console.error('Error en /api/auth/register:', err);
    res.status(500).json({ error: 'Error en el servidor al registrar usuario' });
  }
});

// ==========================================
// 2. RUTAS DE RECONOCIMIENTO FACIAL
// ==========================================

// Registrar o Vincular Rostro
app.post('/api/face/register', async (req, res) => {
  const { userId, descriptor, userName } = req.body;
  if (!userId || !descriptor) {
    return res.status(400).json({ error: 'Faltan datos requeridos (userId o descriptor)' });
  }

  try {
    const saved = await db.saveFacialDescriptor(userId, descriptor);
    
    // Si no existe usuario con este email/userId, crearlo automáticamente para conveniencia
    let user = await db.findUserByEmail(userId);
    if (!user) {
      user = await db.createUser({
        name: userName || userId.split('@')[0],
        email: userId,
        password: 'defaultPassword123!',
        role: 'Usuario Biométrico'
      });
    }

    await db.addLog({
      type: 'face_registered',
      description: 'Perfil biométrico facial registrado',
      userId: userId,
      userName: user ? user.name : userId,
      details: 'Descriptor facial de 128 dimensiones guardado',
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Rostro registrado exitosamente',
      user: {
        id: user.id,
        userId: user.email,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        hasFacialProfile: true
      },
      facialRecord: {
        id: saved.id,
        userId: saved.user_id || saved.userId,
        registeredAt: saved.registered_at || saved.registeredAt
      }
    });
  } catch (err) {
    console.error('Error al registrar rostro:', err);
    res.status(500).json({ error: 'Error en la base de datos al registrar el rostro' });
  }
});

// Verificar / Login con Rostro
app.post('/api/face/verify', async (req, res) => {
  const { descriptor, threshold = 0.55 } = req.body;
  if (!descriptor) {
    return res.status(400).json({ error: 'Descriptor facial no proporcionado' });
  }

  try {
    const facialUsers = await db.getAllFacialUsers();
    if (!facialUsers || facialUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay rostros registrados en el sistema. Registra un rostro primero.'
      });
    }

    let bestMatch = null;
    let minDistance = Number(threshold) || 0.55;

    for (const record of facialUsers) {
      const dbDescriptor = record.descriptor;
      if (!dbDescriptor) continue;
      
      const distance = euclideanDistance(descriptor, dbDescriptor);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = record.user_id || record.userId;
      }
    }

    if (bestMatch) {
      // Calcular nivel de confianza porcentual aproximado (0.55 -> ~70%, 0.35 -> ~95%)
      const confidence = Math.max(0, Math.min(100, Math.round((1 - (minDistance / 0.70)) * 100)));
      
      let user = await db.findUserByEmail(bestMatch);
      if (!user) {
        user = await db.findUserById(bestMatch);
      }

      const userData = user ? {
        id: user.id,
        userId: user.email,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        hasFacialProfile: true
      } : {
        id: 'usr_' + bestMatch,
        userId: bestMatch,
        name: bestMatch.split('@')[0],
        email: bestMatch,
        role: 'Usuario Biométrico',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(bestMatch)}&background=3b82f6&color=fff`,
        hasFacialProfile: true
      };

      await db.addLog({
        type: 'auth_face',
        description: 'Acceso biométrico facial concedido',
        userId: bestMatch,
        userName: userData.name,
        details: `Distancia: ${minDistance.toFixed(3)} | Confianza estimada: ${confidence}%`,
        ip: req.ip
      });

      res.status(200).json({
        success: true,
        userId: bestMatch,
        distance: Number(minDistance.toFixed(4)),
        confidence: `${confidence}%`,
        user: userData,
        authMethod: 'facial'
      });
    } else {
      await db.addLog({
        type: 'auth_face_rejected',
        description: 'Acceso biométrico facial denegado',
        userId: 'desconocido',
        details: 'Rostro escaneado no coincide con ningún perfil',
        ip: req.ip
      });

      res.status(401).json({
        success: false,
        message: 'Rostro no reconocido. Por favor, mira fijamente a la cámara o regístrate.'
      });
    }
  } catch (err) {
    console.error('Error al verificar rostro:', err);
    res.status(500).json({ error: 'Error en la base de datos al verificar el rostro' });
  }
});

// Listar perfiles faciales registrados
app.get('/api/face/profiles', async (req, res) => {
  try {
    const list = await db.getAllFacialUsers();
    const safeList = list.map(item => ({
      id: item.id,
      userId: item.user_id || item.userId,
      registeredAt: item.registered_at || item.registeredAt
    }));
    res.json({ success: true, count: safeList.length, profiles: safeList });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar perfiles faciales' });
  }
});

// Eliminar perfil facial
app.delete('/api/face/:userId', async (req, res) => {
  try {
    await db.deleteFacialUser(req.params.userId);
    await db.addLog({
      type: 'face_deleted',
      description: 'Perfil biométrico eliminado',
      userId: req.params.userId,
      ip: req.ip
    });
    res.json({ success: true, message: 'Perfil biométrico eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar perfil biométrico' });
  }
});

// ==========================================
// 3. RUTAS DEL CRM (CLIENTES, DEALS, STATS)
// ==========================================

// Clientes - Obtener lista con filtros
app.get('/api/crm/clients', async (req, res) => {
  try {
    const clients = await db.getClients({
      status: req.query.status,
      search: req.query.search
    });
    res.json({ success: true, count: clients.length, clients });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar clientes' });
  }
});

// Clientes - Crear
app.post('/api/crm/clients', async (req, res) => {
  const { name, company, email, phone, status, value, notes } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
  }

  try {
    const newClient = await db.createClient({ name, company, email, phone, status, value, notes });
    await db.addLog({
      type: 'client_created',
      description: `Cliente agregado: ${newClient.name}`,
      details: `Empresa: ${newClient.company || 'N/A'} - Valor: $${newClient.value}`,
      ip: req.ip
    });
    res.status(201).json({ success: true, client: newClient });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// Clientes - Actualizar
app.put('/api/crm/clients/:id', async (req, res) => {
  try {
    const updated = await db.updateClient(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ success: true, client: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// Clientes - Eliminar
app.delete('/api/crm/clients/:id', async (req, res) => {
  try {
    await db.deleteClient(req.params.id);
    res.json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

// Pipeline Deals - Obtener
app.get('/api/crm/deals', async (req, res) => {
  try {
    const deals = await db.getDeals();
    res.json({ success: true, count: deals.length, deals });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar oportunidades comerciales' });
  }
});

// Pipeline Deals - Crear
app.post('/api/crm/deals', async (req, res) => {
  const { title, clientName, amount, stage, expectedClose } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'El título del deal es requerido' });
  }

  try {
    const deal = await db.createDeal(req.body);
    res.status(201).json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear deal' });
  }
});

// Pipeline Deals - Mover de etapa o actualizar
app.put('/api/crm/deals/:id', async (req, res) => {
  try {
    const updated = await db.updateDeal(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }
    res.json({ success: true, deal: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar oportunidad' });
  }
});

// Pipeline Deals - Eliminar
app.delete('/api/crm/deals/:id', async (req, res) => {
  try {
    await db.deleteDeal(req.params.id);
    res.json({ success: true, message: 'Oportunidad eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar oportunidad' });
  }
});

// Estadísticas del Dashboard
app.get('/api/crm/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});

// Logs de Auditoría del Sistema
app.get('/api/crm/logs', async (req, res) => {
  try {
    const logs = await db.getLogs(parseInt(req.query.limit, 10) || 30);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar logs' });
  }
});

// ==========================================
// 4. RUTAS BIG DATA: REPOSITORIOS, DATASETS Y COMPARADOR
// ==========================================

// Repositorios - Listar
app.get('/api/bigdata/repositories', async (req, res) => {
  try {
    const repos = await db.getRepositories();
    res.json({ success: true, count: repos.length, repositories: repos });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener repositorios Big Data' });
  }
});

// Repositorios - Crear
app.post('/api/bigdata/repositories', async (req, res) => {
  const { name, category, storageType, description, region, tags } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre del repositorio es obligatorio' });
  }

  try {
    const repo = await db.createRepository(req.body);
    await db.addLog({
      type: 'bigdata_repo_created',
      description: `Repositorio creado: ${repo.name}`,
      details: `Categoría: ${repo.category} | Almacenamiento: ${repo.storageType}`,
      ip: req.ip
    });
    res.status(201).json({ success: true, repository: repo });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear repositorio' });
  }
});

// Repositorios - Eliminar
app.delete('/api/bigdata/repositories/:id', async (req, res) => {
  try {
    await db.deleteRepository(req.params.id);
    res.json({ success: true, message: 'Repositorio y datasets asociados eliminados' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar repositorio' });
  }
});

// Datasets - Listar
app.get('/api/bigdata/datasets', async (req, res) => {
  try {
    const datasets = await db.getDatasets(req.query.repoId);
    res.json({ success: true, count: datasets.length, datasets });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datasets' });
  }
});

// Datasets - Obtener por ID
app.get('/api/bigdata/datasets/:id', async (req, res) => {
  try {
    const dataset = await db.getDatasetById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset no encontrado' });
    }
    res.json({ success: true, dataset });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dataset' });
  }
});

// Datasets - Incorporar nuevo dataset
app.post('/api/bigdata/datasets', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre del dataset es obligatorio' });
  }

  try {
    const dataset = await db.createDataset(req.body);
    await db.addLog({
      type: 'bigdata_dataset_added',
      description: `Dataset incorporado: ${dataset.name}`,
      details: `Formato: ${dataset.format} | Registros: ${dataset.rowCount} | Tamaño: ${dataset.sizeMb} MB`,
      ip: req.ip
    });
    res.status(201).json({ success: true, dataset });
  } catch (err) {
    res.status(500).json({ error: 'Error al incorporar dataset' });
  }
});

// Datasets - Eliminar
app.delete('/api/bigdata/datasets/:id', async (req, res) => {
  try {
    await db.deleteDataset(req.params.id);
    res.json({ success: true, message: 'Dataset eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar dataset' });
  }
});

// Motor de Comparación entre 2 Datasets
app.post('/api/bigdata/compare', async (req, res) => {
  const { datasetIdA, datasetIdB } = req.body;
  if (!datasetIdA || !datasetIdB) {
    return res.status(400).json({ error: 'Debes seleccionar datasetIdA y datasetIdB para comparar' });
  }

  if (datasetIdA === datasetIdB) {
    return res.status(400).json({ error: 'Selecciona dos datasets distintos para realizar la comparación' });
  }

  try {
    const comparison = await db.compareDatasets(datasetIdA, datasetIdB);
    await db.addLog({
      type: 'bigdata_comparison',
      description: `Comparación ejecutada: ${comparison.datasetA.name} vs ${comparison.datasetB.name}`,
      details: `Diagnóstico: ${comparison.driftAnalysis.overallDrift} | Delta filas: ${comparison.metricsDiff.rowDiffPct}%`,
      ip: req.ip
    });
    res.json({ success: true, comparison });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al ejecutar la comparación de datasets' });
  }
});

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Datanova CRM Enterprise',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: db.getStatus()
  });
});

// ==========================================
// 4. INICIALIZACIÓN DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Datanova CRM corriendo en puerto ${PORT}`);
    console.log(`🌐 Acceso local: http://localhost:${PORT}`);
  });
}

module.exports = app;

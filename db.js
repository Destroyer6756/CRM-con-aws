const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Directorio para persistencia local de respaldo
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'crm_db.json');

// SQL para crear todas las tablas necesarias
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Usuario',
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS facial_users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    descriptor JSONB NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crm_clients (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Lead',
    value NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crm_deals (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    client_id VARCHAR(255),
    client_name VARCHAR(255),
    stage VARCHAR(50) DEFAULT 'Prospecto',
    amount NUMERIC DEFAULT 0,
    probability INT DEFAULT 10,
    expected_close VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bigdata_repositories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    storage_type VARCHAR(100) DEFAULT 'AWS S3',
    region VARCHAR(100),
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bigdata_datasets (
    id VARCHAR(255) PRIMARY KEY,
    repo_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    format VARCHAR(50) DEFAULT 'Parquet',
    size_mb NUMERIC DEFAULT 0,
    row_count BIGINT DEFAULT 0,
    quality_score INT DEFAULT 95,
    null_percentage NUMERIC DEFAULT 0,
    columns JSONB,
    sample_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crm_logs (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    details TEXT,
    ip VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Función auxiliar para crear tablas (reutilizable por migrate.js)
async function createTables(client) {
  await client.query(CREATE_TABLES_SQL);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password || '').digest('hex');
}

// Generador determinista de descriptores faciales neuronales de 128 floats normalizados
function generateDeterministicVector(seed = 100) {
  const vec = [];
  let s = seed;
  for (let i = 0; i < 128; i++) {
    s = (s * 9301 + 49297) % 233280;
    const val = (s / 233280) * 0.4 - 0.2;
    vec.push(parseFloat(val.toFixed(4)));
  }
  return vec;
}

// Semilla inicial de datos para una experiencia CRM & Big Data completa
const defaultData = {
  users: [
    {
      id: 'usr_admin',
      userId: 'admin@datanova.com',
      name: 'Admin Datanova',
      email: 'admin@datanova.com',
      personalEmail: 'admin.personal@gmail.com',
      corporateEmail: 'admin@datanova.com',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      status: 'active',
      permissions: { crm: true, bigdata: true, dataset_compare: true, tasks: true, face_compare: true, admin: true },
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_carlos',
      userId: 'carlos.mendoza@datanova.com',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@datanova.com',
      personalEmail: 'carlos.mendoza.personal@gmail.com',
      corporateEmail: 'carlos.mendoza@datanova.com',
      passwordHash: hashPassword('carlos2026'),
      role: 'gerente',
      status: 'active',
      permissions: { crm: true, bigdata: true, dataset_compare: true, tasks: true, face_compare: true, admin: false },
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      createdAt: new Date().toISOString()
    }
  ],
  facial_users: [
    {
      id: 1,
      user_id: 'admin@datanova.com',
      userId: 'admin@datanova.com',
      userName: 'Admin Datanova',
      descriptor: generateDeterministicVector(101),
      registeredAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 2,
      user_id: 'carlos.mendoza@datanova.com',
      userId: 'carlos.mendoza@datanova.com',
      userName: 'Carlos Mendoza',
      descriptor: generateDeterministicVector(202),
      registeredAt: new Date(Date.now() - 86400000 * 4).toISOString()
    },
    {
      id: 3,
      user_id: 'asofia@techsolutions.co',
      userId: 'asofia@techsolutions.co',
      userName: 'Ana Sofía Restrepo',
      descriptor: generateDeterministicVector(303),
      registeredAt: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ],
  clients: [
    {
      id: 'cli_1',
      name: 'Ana Sofía Restrepo',
      company: 'TechSolutions Andina',
      email: 'asofia@techsolutions.co',
      phone: '+57 310 456 7890',
      status: 'Ganado',
      value: 18500,
      notes: 'Implementación de nube AWS y suite de analítica Big Data.',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'cli_2',
      name: 'Roberto Valenzuela',
      company: 'Logística Continental',
      email: 'rvalenzuela@logisticacont.com',
      phone: '+52 55 8923 1142',
      status: 'Negociación',
      value: 34000,
      notes: 'Migración de clústeres a Data Lake AWS con procesamiento paralelo.',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'cli_3',
      name: 'Valeria Gómez',
      company: 'Fintech NovaPay',
      email: 'valeria@novapay.io',
      phone: '+54 11 4455 6677',
      status: 'Propuesta',
      value: 27000,
      notes: 'Módulo de analítica de transacciones masivas y biometría.',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'cli_4',
      name: 'Mauricio Delgado',
      company: 'Retail Omnicanal S.A.',
      email: 'mdelgado@retailomni.com',
      phone: '+56 9 8765 4321',
      status: 'Contactado',
      value: 12500,
      notes: 'Integración de repositorio de compras y comportamiento de usuario.',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'cli_5',
      name: 'Elena Morales',
      company: 'BioSalud Digital',
      email: 'emorales@biosalud.com',
      phone: '+57 318 901 2345',
      status: 'Lead',
      value: 9500,
      notes: 'Telemetría de pacientes y reconocimiento facial para clínicas.',
      createdAt: new Date().toISOString()
    }
  ],
  deals: [
    {
      id: 'deal_1',
      title: 'Licencia Enterprise Datanova + Data Lake AWS S3',
      clientId: 'cli_3',
      clientName: 'Fintech NovaPay',
      stage: 'Propuesta',
      amount: 27000,
      probability: 70,
      expectedClose: '2026-10-25'
    },
    {
      id: 'deal_2',
      title: 'Arquitectura Big Data Multi-Región & Pipeline Spark',
      clientId: 'cli_2',
      clientName: 'Logística Continental',
      stage: 'Negociación',
      amount: 34000,
      probability: 85,
      expectedClose: '2026-10-15'
    },
    {
      id: 'deal_3',
      title: 'Soporte 24/7 y SLA Crítico Nube',
      clientId: 'cli_1',
      clientName: 'TechSolutions Andina',
      stage: 'Ganado',
      amount: 18500,
      probability: 100,
      expectedClose: '2026-09-28'
    },
    {
      id: 'deal_4',
      title: 'Módulo de Detección de Data Drift & Datasets',
      clientId: 'cli_4',
      clientName: 'Retail Omnicanal S.A.',
      stage: 'Contactado',
      amount: 12500,
      probability: 40,
      expectedClose: '2026-11-10'
    },
    {
      id: 'deal_5',
      title: 'Prueba de Concepto Biometría + Big Data Streams',
      clientId: 'cli_5',
      clientName: 'BioSalud Digital',
      stage: 'Prospecto',
      amount: 9500,
      probability: 20,
      expectedClose: '2026-11-30'
    }
  ],
  // ==========================================
  // REPOSITORIOS BIG DATA
  // ==========================================
  repositories: [
    {
      id: 'repo_fintech',
      name: 'Data Lake Financiero & Fraude AWS S3',
      description: 'Lote masivo de transacciones bancarias, pasarelas de pago y variables predictivas de riesgo.',
      category: 'Finanzas & Banca',
      storageType: 'AWS S3 / Apache Parquet',
      region: 'us-east-1 (N. Virginia)',
      tags: ['Transacciones', 'Fraude', 'ML-Ready', 'PCI-DSS'],
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
    },
    {
      id: 'repo_cloud_iot',
      name: 'Telemetría CloudWatch & Microservicios',
      description: 'Métricas de infraestructura en tiempo real, latencias P99, logs de pods Kubernetes y consumo de clústeres.',
      category: 'DevOps & Nube',
      storageType: 'AWS OpenSearch / Delta Lake',
      region: 'sa-east-1 (São Paulo)',
      tags: ['Telemetría', 'Kubernetes', 'Latencia', 'AWS'],
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
    },
    {
      id: 'repo_crm_analytics',
      name: 'Customer 360 & Comportamiento Omnicanal',
      description: 'Eventos de navegación, compras recurrentes, segmentación RFM y scoring de propensión de compra.',
      category: 'Customer Intelligence',
      storageType: 'Snowflake / PostgreSQL',
      region: 'us-west-2 (Oregon)',
      tags: ['Clientes', 'RFM', 'Churn', 'Marketing'],
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
    }
  ],
  // ==========================================
  // DATASETS DE BIG DATA
  // ==========================================
  datasets: [
    {
      id: 'ds_trans_q1',
      repoId: 'repo_fintech',
      name: 'Transacciones_Bancarias_Q1_2026.parquet',
      description: 'Historial de 1.45 millones de transacciones de tarjeta de crédito durante el primer trimestre.',
      format: 'Parquet',
      sizeMb: 420.5,
      rowCount: 1450000,
      qualityScore: 98,
      nullPercentage: 0.4,
      columns: [
        { name: 'id_transaccion', type: 'string', isNullable: false },
        { name: 'user_id', type: 'string', isNullable: false },
        { name: 'monto', type: 'number', mean: 142.50, min: 2.00, max: 8500.00, stdDev: 85.20 },
        { name: 'tipo_canal', type: 'string', isNullable: false },
        { name: 'latitud', type: 'number', mean: 4.65, min: -34.60, max: 19.43, stdDev: 12.10 },
        { name: 'es_fraude', type: 'boolean', isNullable: false },
        { name: 'timestamp', type: 'datetime', isNullable: false }
      ],
      sampleData: [
        { id_transaccion: 'TX-100101', user_id: 'usr_8921', monto: 120.50, tipo_canal: 'POS Físico', latitud: 4.6097, es_fraude: false, timestamp: '2026-01-15T08:30:00Z' },
        { id_transaccion: 'TX-100102', user_id: 'usr_3419', monto: 850.00, tipo_canal: 'Online Web', latitud: 4.6110, es_fraude: false, timestamp: '2026-01-15T08:31:12Z' },
        { id_transaccion: 'TX-100103', user_id: 'usr_1052', monto: 4500.00, tipo_canal: 'Transferencia API', latitud: -34.6037, es_fraude: true, timestamp: '2026-01-15T08:33:45Z' },
        { id_transaccion: 'TX-100104', user_id: 'usr_6631', monto: 35.20, tipo_canal: 'App Móvil', latitud: 19.4326, es_fraude: false, timestamp: '2026-01-15T08:34:02Z' },
        { id_transaccion: 'TX-100105', user_id: 'usr_4201', monto: 210.00, tipo_canal: 'POS Físico', latitud: 4.6521, es_fraude: false, timestamp: '2026-01-15T08:35:19Z' }
      ],
      createdAt: new Date(Date.now() - 86400000 * 8).toISOString()
    },
    {
      id: 'ds_trans_q2',
      repoId: 'repo_fintech',
      name: 'Transacciones_Bancarias_Q2_2026.parquet',
      description: 'Lote consolidado del segundo trimestre con incremento en comercio electrónico y nueva variable de riesgo IA.',
      format: 'Parquet',
      sizeMb: 585.2,
      rowCount: 1920000,
      qualityScore: 95,
      nullPercentage: 1.2,
      columns: [
        { name: 'id_transaccion', type: 'string', isNullable: false },
        { name: 'user_id', type: 'string', isNullable: false },
        { name: 'monto', type: 'number', mean: 178.90, min: 5.00, max: 12400.00, stdDev: 115.40 }, // Data Drift: +25.5% en media
        { name: 'tipo_canal', type: 'string', isNullable: false },
        { name: 'latitud', type: 'number', mean: 4.71, min: -34.60, max: 19.43, stdDev: 12.30 },
        { name: 'es_fraude', type: 'boolean', isNullable: false },
        { name: 'score_riesgo_ia', type: 'number', mean: 0.18, min: 0.01, max: 0.99, stdDev: 0.22 }, // Nueva columna en Q2
        { name: 'timestamp', type: 'datetime', isNullable: false }
      ],
      sampleData: [
        { id_transaccion: 'TX-200201', user_id: 'usr_8921', monto: 185.00, tipo_canal: 'POS Físico', latitud: 4.6099, es_fraude: false, score_riesgo_ia: 0.04, timestamp: '2026-04-10T10:15:00Z' },
        { id_transaccion: 'TX-200202', user_id: 'usr_4120', monto: 1200.00, tipo_canal: 'Online Web', latitud: 19.4320, es_fraude: false, score_riesgo_ia: 0.22, timestamp: '2026-04-10T10:16:15Z' },
        { id_transaccion: 'TX-200203', user_id: 'usr_1052', monto: 6200.00, tipo_canal: 'Transferencia API', latitud: -34.6037, es_fraude: true, score_riesgo_ia: 0.96, timestamp: '2026-04-10T10:18:22Z' },
        { id_transaccion: 'TX-200204', user_id: 'usr_6631', monto: 45.00, tipo_canal: 'App Móvil', latitud: 4.6110, es_fraude: false, score_riesgo_ia: 0.02, timestamp: '2026-04-10T10:20:01Z' },
        { id_transaccion: 'TX-200205', user_id: 'usr_9918', monto: 540.00, tipo_canal: 'Online Web', latitud: 4.6601, es_fraude: false, score_riesgo_ia: 0.11, timestamp: '2026-04-10T10:22:40Z' }
      ],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'ds_cloud_cluster_a',
      repoId: 'repo_cloud_iot',
      name: 'Telemetria_Cluster_AWS_us_east_1.json',
      description: 'Métricas de 2.8 millones de eventos en el clúster principal de producción en Virginia.',
      format: 'JSON',
      sizeMb: 740.0,
      rowCount: 2800000,
      qualityScore: 99,
      nullPercentage: 0.1,
      columns: [
        { name: 'nodo_id', type: 'string', isNullable: false },
        { name: 'latencia_ms', type: 'number', mean: 24.50, min: 4.20, max: 180.00, stdDev: 14.20 },
        { name: 'cpu_percent', type: 'number', mean: 42.10, min: 10.00, max: 95.00, stdDev: 16.80 },
        { name: 'memoria_mb', type: 'number', mean: 3120, min: 1024, max: 8192, stdDev: 1100 },
        { name: 'error_rate', type: 'number', mean: 0.02, min: 0.00, max: 1.50, stdDev: 0.08 }
      ],
      sampleData: [
        { nodo_id: 'i-0a81f3b', latencia_ms: 18.2, cpu_percent: 38.5, memoria_mb: 2840, error_rate: 0.00 },
        { nodo_id: 'i-0b92c4c', latencia_ms: 22.4, cpu_percent: 44.0, memoria_mb: 3200, error_rate: 0.01 },
        { nodo_id: 'i-0c73d5d', latencia_ms: 45.1, cpu_percent: 78.2, memoria_mb: 6100, error_rate: 0.12 },
        { nodo_id: 'i-0d64e6e', latencia_ms: 19.0, cpu_percent: 35.1, memoria_mb: 2750, error_rate: 0.00 }
      ],
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'ds_cloud_cluster_b',
      repoId: 'repo_cloud_iot',
      name: 'Telemetria_Cluster_AWS_sa_east_1.json',
      description: 'Métricas de 3.1 millones de eventos en el clúster regional de Sudamérica con mayor latencia.',
      format: 'JSON',
      sizeMb: 820.0,
      rowCount: 3100000,
      qualityScore: 97,
      nullPercentage: 0.6,
      columns: [
        { name: 'nodo_id', type: 'string', isNullable: false },
        { name: 'latencia_ms', type: 'number', mean: 48.60, min: 8.50, max: 320.00, stdDev: 28.50 }, // Drift: +98% latencia
        { name: 'cpu_percent', type: 'number', mean: 58.90, min: 12.00, max: 98.00, stdDev: 21.40 }, // Drift: +40% CPU
        { name: 'memoria_mb', type: 'number', mean: 3580, min: 1024, max: 8192, stdDev: 1250 },
        { name: 'error_rate', type: 'number', mean: 0.09, min: 0.00, max: 3.80, stdDev: 0.25 }
      ],
      sampleData: [
        { nodo_id: 'i-0sa111a', latencia_ms: 42.0, cpu_percent: 52.0, memoria_mb: 3400, error_rate: 0.02 },
        { nodo_id: 'i-0sa222b', latencia_ms: 68.5, cpu_percent: 74.2, memoria_mb: 4800, error_rate: 0.08 },
        { nodo_id: 'i-0sa333c', latencia_ms: 95.0, cpu_percent: 89.1, memoria_mb: 7200, error_rate: 0.35 },
        { nodo_id: 'i-0sa444d', latencia_ms: 38.4, cpu_percent: 48.3, memoria_mb: 3100, error_rate: 0.01 }
      ],
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ],
  logs: [
    {
      id: 'log_1',
      type: 'auth_normal',
      description: 'Inicio de sesión con credenciales',
      userId: 'admin@datanova.com',
      userName: 'Admin Datanova',
      details: 'Autenticación estándar exitosa',
      ip: '127.0.0.1',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ]
};

class DatabaseService {
  constructor() {
    this.usePostgres = false;
    this.pool = null;
    this.localData = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    const hasPostgresConfig = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.DB_HOST);
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    
    // En producción, REQUERIMOS PostgreSQL
    if (isProduction) {
      if (!hasPostgresConfig) {
        throw new Error('ERROR CRÍTICO: En producción se requiere configuración de PostgreSQL (DATABASE_URL o POSTGRES_URL). Configure las variables de entorno.');
      }
      
      try {
        const poolConfig = process.env.POSTGRES_URL || process.env.DATABASE_URL
          ? { connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, connectionTimeoutMillis: 10000 }
          : {
              host: process.env.DB_HOST,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
              port: parseInt(process.env.DB_PORT, 10) || 5432,
              connectionTimeoutMillis: 10000
            };

        this.pool = new Pool(poolConfig);
        const client = await this.pool.connect();

        // Crear tablas incluyendo Repositorios y Datasets Big Data
        await createTables(client);
        
        client.release();
        this.usePostgres = true;
        console.log('✅ Base de datos PostgreSQL conectada y configurada exitosamente con soporte Big Data.');
      } catch (err) {
        this.usePostgres = false;
        if (this.pool) {
          try { await this.pool.end(); } catch (e) {}
          this.pool = null;
        }
        console.error('❌ ERROR CRÍTICO: No se pudo conectar a PostgreSQL en producción:', err.message);
        throw new Error(`Fallo de conexión a PostgreSQL en producción: ${err.message}`);
      }
    } else {
      // En desarrollo/local: intentar PostgreSQL, fallback a JSON si falla
      if (hasPostgresConfig || !process.env.FORCE_LOCAL_DB) {
        try {
          const poolConfig = process.env.POSTGRES_URL || process.env.DATABASE_URL
            ? { connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, connectionTimeoutMillis: 3000 }
            : {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password',
                database: process.env.DB_NAME || 'datanova_db',
                port: parseInt(process.env.DB_PORT, 10) || 5432,
                connectionTimeoutMillis: 2000
              };

          this.pool = new Pool(poolConfig);
          const client = await this.pool.connect();

          await createTables(client);
          
          client.release();
          this.usePostgres = true;
          console.log('✅ Base de datos PostgreSQL conectada y configurada exitosamente con soporte Big Data.');
        } catch (err) {
          this.usePostgres = false;
          if (this.pool) {
            try { await this.pool.end(); } catch (e) {}
            this.pool = null;
          }
          console.log('ℹ️ PostgreSQL no disponible localmente. Activando almacenamiento persistente local optimizado.');
        }
      }

      if (!this.usePostgres) {
        this.initLocalStorage();
      }
    }

    this.isInitialized = true;
  }

  initLocalStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        this.localData = JSON.parse(fileContent);
        for (const key of Object.keys(defaultData)) {
          if (!this.localData[key] || this.localData[key].length === 0) {
            this.localData[key] = defaultData[key];
          }
        }
      } catch (e) {
        console.error('Error al leer datos locales, inicializando con valores predeterminados:', e);
        this.localData = JSON.parse(JSON.stringify(defaultData));
        this.saveLocalStorage();
      }
    } else {
      this.localData = JSON.parse(JSON.stringify(defaultData));
      this.saveLocalStorage();
    }
  }

  saveLocalStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.localData, null, 2), 'utf8');
    } catch (e) {
      console.error('Error guardando en archivo local:', e);
    }
  }

  getStatus() {
    return {
      connected: true,
      mode: this.usePostgres ? 'postgresql' : 'local_persistent',
      storageDescription: this.usePostgres 
        ? 'Base de datos PostgreSQL / AWS RDS activa' 
        : 'Almacenamiento persistente local activo (Listo para producción con PostgreSQL)',
      totalUsers: this.usePostgres ? null : this.localData.users.length,
      totalFacialProfiles: this.usePostgres ? null : this.localData.facial_users.length,
      totalClients: this.usePostgres ? null : this.localData.clients.length,
      totalDeals: this.usePostgres ? null : this.localData.deals.length,
      totalRepositories: this.usePostgres ? null : this.localData.repositories.length,
      totalDatasets: this.usePostgres ? null : this.localData.datasets.length
    };
  }

  // --- MÉTODOS DE USUARIOS ---
  async findUserByEmail(email) {
    await this.init();
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(user_id) = $1', [cleanEmail]);
      if (res.rows.length === 0) return null;
      const u = res.rows[0];
      return {
        id: u.id,
        userId: u.user_id,
        name: u.name,
        email: u.email,
        passwordHash: u.password_hash,
        role: u.role,
        avatar: u.avatar,
        createdAt: u.created_at
      };
    } else {
      return this.localData.users.find(u => 
        (u.email && u.email.toLowerCase() === cleanEmail) || 
        (u.userId && u.userId.toLowerCase() === cleanEmail)
      ) || null;
    }
  }

  async findUserById(userId) {
    await this.init();
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM users WHERE user_id = $1 OR id = $1', [userId]);
      if (res.rows.length === 0) return null;
      const u = res.rows[0];
      return {
        id: u.id,
        userId: u.user_id,
        name: u.name,
        email: u.email,
        passwordHash: u.password_hash,
        role: u.role,
        avatar: u.avatar,
        createdAt: u.created_at
      };
    } else {
      return this.localData.users.find(u => u.userId === userId || u.id === userId) || null;
    }
  }

  async createUser(userData) {
    await this.init();
    const cleanEmail = (userData.email || userData.userId || '').trim().toLowerCase();
    const id = 'usr_' + Date.now();
    const newUser = {
      id,
      userId: cleanEmail,
      name: userData.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      passwordHash: hashPassword(userData.password || '123456'),
      role: userData.role || 'Arquitecto Big Data',
      avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=3b82f6&color=fff`,
      createdAt: new Date().toISOString()
    };

    if (this.usePostgres) {
      await this.pool.query(
        'INSERT INTO users (id, user_id, name, email, password_hash, role, avatar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [newUser.id, newUser.userId, newUser.name, newUser.email, newUser.passwordHash, newUser.role, newUser.avatar]
      );
    } else {
      this.localData.users.push(newUser);
      this.saveLocalStorage();
    }

    return newUser;
  }

  // --- MÉTODOS DE RECONOCIMIENTO FACIAL ---
  async saveFacialDescriptor(userId, descriptor) {
    await this.init();
    if (!userId || !descriptor) throw new Error('userId y descriptor son requeridos');

    const cleanUserId = userId.trim();
    const descriptorArr = Array.isArray(descriptor) ? descriptor : Object.values(descriptor);

    if (this.usePostgres) {
      const query = `
        INSERT INTO facial_users (user_id, descriptor) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) 
        DO UPDATE SET descriptor = $2, registered_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const res = await this.pool.query(query, [cleanUserId, JSON.stringify(descriptorArr)]);
      return res.rows[0];
    } else {
      const existingIdx = this.localData.facial_users.findIndex(f => f.user_id === cleanUserId || f.userId === cleanUserId);
      const record = {
        id: existingIdx >= 0 ? this.localData.facial_users[existingIdx].id : this.localData.facial_users.length + 1,
        user_id: cleanUserId,
        userId: cleanUserId,
        descriptor: descriptorArr,
        registeredAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        this.localData.facial_users[existingIdx] = record;
      } else {
        this.localData.facial_users.push(record);
      }
      this.saveLocalStorage();
      return record;
    }
  }

  async getAllFacialUsers() {
    await this.init();
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM facial_users');
      return res.rows.map(row => {
        let desc = row.descriptor;
        if (typeof desc === 'string') {
          try { desc = JSON.parse(desc); } catch (e) {}
        }
        if (typeof desc === 'string') {
          try { desc = JSON.parse(desc); } catch (e) {}
        }
        if (desc && !Array.isArray(desc)) {
          desc = Object.values(desc);
        }
        return {
          id: row.id,
          user_id: row.user_id,
          userId: row.user_id,
          descriptor: desc,
          registeredAt: row.registered_at
        };
      });
    } else {
      return this.localData.facial_users;
    }
  }

  async deleteFacialUser(userId) {
    await this.init();
    if (this.usePostgres) {
      await this.pool.query('DELETE FROM facial_users WHERE user_id = $1', [userId]);
    } else {
      this.localData.facial_users = this.localData.facial_users.filter(f => f.user_id !== userId && f.userId !== userId);
      this.saveLocalStorage();
    }
    return true;
  }

  // --- MÉTODOS CRM: CLIENTES ---
  async getClients(filters = {}) {
    await this.init();
    let clients = [];
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM crm_clients ORDER BY created_at DESC');
      clients = res.rows.map(r => ({
        id: r.id,
        name: r.name,
        company: r.company,
        email: r.email,
        phone: r.phone,
        status: r.status,
        value: Number(r.value) || 0,
        notes: r.notes,
        createdAt: r.created_at
      }));
    } else {
      clients = [...this.localData.clients];
    }

    if (filters.status && filters.status !== 'Todos') {
      clients = clients.filter(c => c.status.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.search) {
      const s = filters.search.toLowerCase();
      clients = clients.filter(c => 
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.company && c.company.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s)) ||
        (c.phone && c.phone.includes(s))
      );
    }

    return clients;
  }

  async createClient(data) {
    await this.init();
    const newClient = {
      id: 'cli_' + Date.now(),
      name: data.name || 'Cliente sin nombre',
      company: data.company || 'Sin empresa',
      email: data.email || '',
      phone: data.phone || '',
      status: data.status || 'Lead',
      value: Number(data.value) || 0,
      notes: data.notes || '',
      createdAt: new Date().toISOString()
    };

    if (this.usePostgres) {
      await this.pool.query(
        'INSERT INTO crm_clients (id, name, company, email, phone, status, value, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [newClient.id, newClient.name, newClient.company, newClient.email, newClient.phone, newClient.status, newClient.value, newClient.notes]
      );
    } else {
      this.localData.clients.unshift(newClient);
      this.saveLocalStorage();
    }
    return newClient;
  }

  async updateClient(id, data) {
    await this.init();
    if (this.usePostgres) {
      const fields = [];
      const values = [];
      let idx = 1;

      ['name', 'company', 'email', 'phone', 'status', 'value', 'notes'].forEach(key => {
        if (data[key] !== undefined) {
          fields.push(`${key} = $${idx}`);
          values.push(key === 'value' ? Number(data[key]) : data[key]);
          idx++;
        }
      });

      if (fields.length > 0) {
        values.push(id);
        const q = `UPDATE crm_clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const res = await this.pool.query(q, values);
        return res.rows[0];
      }
      return null;
    } else {
      const idx = this.localData.clients.findIndex(c => c.id === id);
      if (idx === -1) return null;
      this.localData.clients[idx] = { ...this.localData.clients[idx], ...data };
      this.saveLocalStorage();
      return this.localData.clients[idx];
    }
  }

  async deleteClient(id) {
    await this.init();
    if (this.usePostgres) {
      await this.pool.query('DELETE FROM crm_clients WHERE id = $1', [id]);
    } else {
      this.localData.clients = this.localData.clients.filter(c => c.id !== id);
      this.saveLocalStorage();
    }
    return true;
  }

  // --- MÉTODOS CRM: DEALS / PIPELINE ---
  async getDeals() {
    await this.init();
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM crm_deals ORDER BY created_at DESC');
      return res.rows.map(r => ({
        id: r.id,
        title: r.title,
        clientId: r.client_id,
        clientName: r.client_name,
        stage: r.stage,
        amount: Number(r.amount) || 0,
        probability: Number(r.probability) || 0,
        expectedClose: r.expected_close,
        createdAt: r.created_at
      }));
    } else {
      return this.localData.deals;
    }
  }

  async createDeal(data) {
    await this.init();
    const newDeal = {
      id: 'deal_' + Date.now(),
      title: data.title || 'Nueva Oportunidad Comercial',
      clientId: data.clientId || '',
      clientName: data.clientName || 'Cliente Prospecto',
      stage: data.stage || 'Prospecto',
      amount: Number(data.amount) || 0,
      probability: Number(data.probability) || 20,
      expectedClose: data.expectedClose || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    if (this.usePostgres) {
      await this.pool.query(
        'INSERT INTO crm_deals (id, title, client_id, client_name, stage, amount, probability, expected_close) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [newDeal.id, newDeal.title, newDeal.clientId, newDeal.clientName, newDeal.stage, newDeal.amount, newDeal.probability, newDeal.expectedClose]
      );
    } else {
      this.localData.deals.unshift(newDeal);
      this.saveLocalStorage();
    }
    return newDeal;
  }

  async updateDeal(id, data) {
    await this.init();
    if (this.usePostgres) {
      const fields = [];
      const values = [];
      let idx = 1;

      ['title', 'clientId', 'clientName', 'stage', 'amount', 'probability', 'expectedClose'].forEach(key => {
        if (data[key] !== undefined) {
          const dbKey = key === 'clientId' ? 'client_id' : (key === 'clientName' ? 'client_name' : (key === 'expectedClose' ? 'expected_close' : key));
          fields.push(`${dbKey} = $${idx}`);
          values.push(key === 'amount' || key === 'probability' ? Number(data[key]) : data[key]);
          idx++;
        }
      });

      if (fields.length > 0) {
        values.push(id);
        const q = `UPDATE crm_deals SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const res = await this.pool.query(q, values);
        return res.rows[0];
      }
      return null;
    } else {
      const idx = this.localData.deals.findIndex(d => d.id === id);
      if (idx === -1) return null;
      this.localData.deals[idx] = { ...this.localData.deals[idx], ...data };
      this.saveLocalStorage();
      return this.localData.deals[idx];
    }
  }

  async deleteDeal(id) {
    await this.init();
    if (this.usePostgres) {
      await this.pool.query('DELETE FROM crm_deals WHERE id = $1', [id]);
    } else {
      this.localData.deals = this.localData.deals.filter(d => d.id !== id);
      this.saveLocalStorage();
    }
    return true;
  }

  // ==========================================
  // MÉTODOS BIG DATA: REPOSITORIOS
  // ==========================================
  async getRepositories() {
    await this.init();
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM bigdata_repositories ORDER BY created_at DESC');
      const repos = res.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        storageType: r.storage_type,
        region: r.region,
        tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags || [],
        createdAt: r.created_at
      }));
      // Enriquecer con conteo de datasets
      const dsRes = await this.pool.query('SELECT repo_id, COUNT(*) as count, SUM(size_mb) as total_size FROM bigdata_datasets GROUP BY repo_id');
      const dsMap = {};
      dsRes.rows.forEach(row => {
        dsMap[row.repo_id] = { count: parseInt(row.count, 10), totalSize: parseFloat(row.total_size) || 0 };
      });
      return repos.map(repo => ({
        ...repo,
        datasetCount: dsMap[repo.id]?.count || 0,
        totalSizeMb: dsMap[repo.id]?.totalSize || 0
      }));
    } else {
      return this.localData.repositories.map(repo => {
        const matchingDatasets = this.localData.datasets.filter(d => d.repoId === repo.id);
        const totalSize = matchingDatasets.reduce((sum, d) => sum + (Number(d.sizeMb) || 0), 0);
        return {
          ...repo,
          datasetCount: matchingDatasets.length,
          totalSizeMb: parseFloat(totalSize.toFixed(1))
        };
      });
    }
  }

  async createRepository(data) {
    await this.init();
    const newRepo = {
      id: 'repo_' + Date.now(),
      name: data.name || 'Repositorio Big Data',
      description: data.description || 'Almacenamiento de datasets y particiones para analítica.',
      category: data.category || 'General Big Data',
      storageType: data.storageType || 'AWS S3 / Apache Parquet',
      region: data.region || 'us-east-1',
      tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : ['BigData']),
      createdAt: new Date().toISOString()
    };

    if (this.usePostgres) {
      await this.pool.query(
        'INSERT INTO bigdata_repositories (id, name, description, category, storage_type, region, tags) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [newRepo.id, newRepo.name, newRepo.description, newRepo.category, newRepo.storageType, newRepo.region, JSON.stringify(newRepo.tags)]
      );
    } else {
      this.localData.repositories.unshift(newRepo);
      this.saveLocalStorage();
    }
    return newRepo;
  }

  async deleteRepository(id) {
    await this.init();
    if (this.usePostgres) {
      await this.pool.query('DELETE FROM bigdata_datasets WHERE repo_id = $1', [id]);
      await this.pool.query('DELETE FROM bigdata_repositories WHERE id = $1', [id]);
    } else {
      this.localData.datasets = this.localData.datasets.filter(d => d.repoId !== id);
      this.localData.repositories = this.localData.repositories.filter(r => r.id !== id);
      this.saveLocalStorage();
    }
    return true;
  }

  // ==========================================
  // MÉTODOS BIG DATA: DATASETS
  // ==========================================
  async getDatasets(repoId = null) {
    await this.init();
    if (this.usePostgres) {
      const q = repoId 
        ? 'SELECT * FROM bigdata_datasets WHERE repo_id = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM bigdata_datasets ORDER BY created_at DESC';
      const values = repoId ? [repoId] : [];
      const res = await this.pool.query(q, values);
      return res.rows.map(r => ({
        id: r.id,
        repoId: r.repo_id,
        name: r.name,
        description: r.description,
        format: r.format,
        sizeMb: parseFloat(r.size_mb) || 0,
        rowCount: parseInt(r.row_count, 10) || 0,
        qualityScore: r.quality_score,
        nullPercentage: parseFloat(r.null_percentage) || 0,
        columns: typeof r.columns === 'string' ? JSON.parse(r.columns) : r.columns || [],
        sampleData: typeof r.sample_data === 'string' ? JSON.parse(r.sample_data) : r.sample_data || [],
        createdAt: r.created_at
      }));
    } else {
      if (repoId) {
        return this.localData.datasets.filter(d => d.repoId === repoId);
      }
      return this.localData.datasets;
    }
  }

  async getDatasetById(id) {
    await this.init();
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM bigdata_datasets WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        repoId: r.repo_id,
        name: r.name,
        description: r.description,
        format: r.format,
        sizeMb: parseFloat(r.size_mb) || 0,
        rowCount: parseInt(r.row_count, 10) || 0,
        qualityScore: r.quality_score,
        nullPercentage: parseFloat(r.null_percentage) || 0,
        columns: typeof r.columns === 'string' ? JSON.parse(r.columns) : r.columns || [],
        sampleData: typeof r.sample_data === 'string' ? JSON.parse(r.sample_data) : r.sample_data || [],
        createdAt: r.created_at
      };
    } else {
      return this.localData.datasets.find(d => d.id === id) || null;
    }
  }

  async createDataset(data) {
    await this.init();
    
    // Auto-generar esquema si viene muestra de datos
    let cols = data.columns || [];
    let sample = data.sampleData || [];

    if (cols.length === 0 && sample.length > 0) {
      const firstRow = sample[0];
      cols = Object.keys(firstRow).map(k => {
        const val = firstRow[k];
        let t = typeof val;
        if (t === 'number') {
          const vals = sample.map(r => Number(r[k])).filter(v => !isNaN(v));
          const sum = vals.reduce((a, b) => a + b, 0);
          const mean = vals.length > 0 ? parseFloat((sum / vals.length).toFixed(2)) : 0;
          const min = vals.length > 0 ? Math.min(...vals) : 0;
          const max = vals.length > 0 ? Math.max(...vals) : 0;
          return { name: k, type: 'number', mean, min, max };
        }
        return { name: k, type: t === 'boolean' ? 'boolean' : 'string' };
      });
    }

    const newDataset = {
      id: 'ds_' + Date.now(),
      repoId: data.repoId || 'repo_fintech',
      name: data.name || 'Dataset_Importado_' + Date.now(),
      description: data.description || 'Dataset incorporado a la plataforma Big Data.',
      format: data.format || 'Parquet',
      sizeMb: parseFloat(data.sizeMb) || 12.5,
      rowCount: parseInt(data.rowCount, 10) || (sample.length > 0 ? sample.length * 1000 : 50000),
      qualityScore: parseInt(data.qualityScore, 10) || 96,
      nullPercentage: parseFloat(data.nullPercentage) || 0.5,
      columns: cols,
      sampleData: sample,
      createdAt: new Date().toISOString()
    };

    if (this.usePostgres) {
      await this.pool.query(
        'INSERT INTO bigdata_datasets (id, repo_id, name, description, format, size_mb, row_count, quality_score, null_percentage, columns, sample_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [newDataset.id, newDataset.repoId, newDataset.name, newDataset.description, newDataset.format, newDataset.sizeMb, newDataset.rowCount, newDataset.qualityScore, newDataset.nullPercentage, JSON.stringify(newDataset.columns), JSON.stringify(newDataset.sampleData)]
      );
    } else {
      this.localData.datasets.unshift(newDataset);
      this.saveLocalStorage();
    }
    return newDataset;
  }

  async deleteDataset(id) {
    await this.init();
    if (this.usePostgres) {
      await this.pool.query('DELETE FROM bigdata_datasets WHERE id = $1', [id]);
    } else {
      this.localData.datasets = this.localData.datasets.filter(d => d.id !== id);
      this.saveLocalStorage();
    }
    return true;
  }

  // ==========================================
  // MOTOR DE COMPARACIÓN DE DATASETS (DIFF & DRIFT)
  // ==========================================
  async compareDatasets(datasetIdA, datasetIdB) {
    const dsA = await this.getDatasetById(datasetIdA);
    const dsB = await this.getDatasetById(datasetIdB);

    if (!dsA || !dsB) {
      throw new Error('Uno o ambos datasets especificados no existen en el sistema');
    }

    // 1. Comparación de Métricas Globales
    const rowDiff = dsB.rowCount - dsA.rowCount;
    const rowDiffPct = dsA.rowCount > 0 ? parseFloat(((rowDiff / dsA.rowCount) * 100).toFixed(1)) : 0;
    
    const sizeDiff = parseFloat((dsB.sizeMb - dsA.sizeMb).toFixed(2));
    const sizeDiffPct = dsA.sizeMb > 0 ? parseFloat(((sizeDiff / dsA.sizeMb) * 100).toFixed(1)) : 0;

    const qualityDiff = dsB.qualityScore - dsA.qualityScore;
    const nullsDiff = parseFloat((dsB.nullPercentage - dsA.nullPercentage).toFixed(2));

    // 2. Comparación de Esquema (Schema Diff)
    const colsA = dsA.columns || [];
    const colsB = dsB.columns || [];

    const mapA = new Map(colsA.map(c => [c.name.toLowerCase(), c]));
    const mapB = new Map(colsB.map(c => [c.name.toLowerCase(), c]));

    const commonColumns = [];
    const uniqueToA = [];
    const uniqueToB = [];

    // Detectar columnas de A
    colsA.forEach(col => {
      const matchInB = mapB.get(col.name.toLowerCase());
      if (matchInB) {
        commonColumns.push({
          name: col.name,
          typeA: col.type,
          typeB: matchInB.type,
          typeMatch: col.type.toLowerCase() === matchInB.type.toLowerCase(),
          meanA: col.mean,
          meanB: matchInB.mean,
          minA: col.min,
          minB: matchInB.min,
          maxA: col.max,
          maxB: matchInB.max
        });
      } else {
        uniqueToA.push(col);
      }
    });

    // Detectar columnas exclusivas de B
    colsB.forEach(col => {
      if (!mapA.has(col.name.toLowerCase())) {
        uniqueToB.push(col);
      }
    });

    // 3. Análisis de Desviación Estadística (Data Drift)
    const driftMetrics = [];
    let highDriftCount = 0;

    commonColumns.forEach(c => {
      if (c.meanA !== undefined && c.meanB !== undefined) {
        const meanChange = c.meanA !== 0 ? ((c.meanB - c.meanA) / c.meanA) * 100 : 0;
        const absChange = Math.abs(meanChange);
        let status = 'Estable';
        let alertClass = 'green';

        if (absChange >= 20) {
          status = 'Drift Crítico / Alto';
          alertClass = 'red';
          highDriftCount++;
        } else if (absChange >= 7) {
          status = 'Drift Moderado';
          alertClass = 'yellow';
        }

        driftMetrics.push({
          column: c.name,
          meanA: c.meanA,
          meanB: c.meanB,
          changePct: parseFloat(meanChange.toFixed(2)),
          status,
          alertClass
        });
      }
    });

    // 4. Diagnóstico de Salud del Modelo / Dataset
    let overallDrift = 'Bajo / Estable';
    let overallColor = 'green';

    if (uniqueToB.length > 0 || highDriftCount > 0 || Math.abs(rowDiffPct) > 30) {
      if (highDriftCount >= 2 || uniqueToA.length > 0 || Math.abs(rowDiffPct) > 50) {
        overallDrift = 'Alto (Re-entrenamiento Recomendado)';
        overallColor = 'red';
      } else {
        overallDrift = 'Moderado (Monitoreo Activo)';
        overallColor = 'yellow';
      }
    }

    const similarityPct = Math.round((commonColumns.length / Math.max(1, (commonColumns.length + uniqueToA.length + uniqueToB.length))) * 100);

    return {
      datasetA: {
        id: dsA.id,
        name: dsA.name,
        format: dsA.format,
        rowCount: dsA.rowCount,
        sizeMb: dsA.sizeMb,
        qualityScore: dsA.qualityScore,
        nullPercentage: dsA.nullPercentage,
        columnsCount: colsA.length,
        sampleData: (dsA.sampleData || []).slice(0, 5)
      },
      datasetB: {
        id: dsB.id,
        name: dsB.name,
        format: dsB.format,
        rowCount: dsB.rowCount,
        sizeMb: dsB.sizeMb,
        qualityScore: dsB.qualityScore,
        nullPercentage: dsB.nullPercentage,
        columnsCount: colsB.length,
        sampleData: (dsB.sampleData || []).slice(0, 5)
      },
      metricsDiff: {
        rowDiff,
        rowDiffPct,
        sizeDiff,
        sizeDiffPct,
        qualityDiff,
        nullsDiff
      },
      schemaDiff: {
        similarityPct,
        totalCommon: commonColumns.length,
        totalUniqueA: uniqueToA.length,
        totalUniqueB: uniqueToB.length,
        commonColumns,
        uniqueToA,
        uniqueToB
      },
      driftAnalysis: {
        overallDrift,
        overallColor,
        driftMetrics
      }
    };
  }

  // --- MÉTODOS DE AUDITORÍA Y LOGS ---
  async getLogs(limit = 20) {
    await this.init();
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM crm_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows;
    } else {
      return this.localData.logs.slice(0, limit);
    }
  }

  async addLog(logData) {
    await this.init();
    const entry = {
      id: 'log_' + Date.now(),
      type: logData.type || 'system',
      description: logData.description || 'Actividad del sistema',
      userId: logData.userId || 'system',
      userName: logData.userName || 'Sistema',
      details: logData.details || '',
      ip: logData.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    };

    if (this.usePostgres) {
      await this.pool.query(
        'INSERT INTO crm_logs (id, type, description, user_id, user_name, details, ip) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [entry.id, entry.type, entry.description, entry.userId, entry.userName, entry.details, entry.ip]
      );
    } else {
      this.localData.logs.unshift(entry);
      if (this.localData.logs.length > 100) {
        this.localData.logs = this.localData.logs.slice(0, 100);
      }
      this.saveLocalStorage();
    }
    return entry;
  }

  // --- ESTADÍSTICAS GLOBALES CON BIG DATA ---
  async getStats() {
    const clients = await this.getClients();
    const deals = await this.getDeals();
    const facialUsers = await this.getAllFacialUsers();
    const repos = await this.getRepositories();
    const datasets = await this.getDatasets();

    const totalClients = clients.length;
    const activeDeals = deals.filter(d => d.stage !== 'Ganado' && d.stage !== 'Perdido').length;
    const pipelineValue = deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const wonValue = deals.filter(d => d.stage === 'Ganado').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const wonCount = deals.filter(d => d.stage === 'Ganado').length;
    const closedCount = deals.filter(d => d.stage === 'Ganado' || d.stage === 'Perdido').length;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 68;

    const totalBigDataRows = datasets.reduce((sum, d) => sum + (Number(d.rowCount) || 0), 0);
    const totalBigDataVolumeMb = parseFloat(datasets.reduce((sum, d) => sum + (Number(d.sizeMb) || 0), 0).toFixed(1));

    return {
      totalClients,
      activeDeals,
      pipelineValue,
      wonValue,
      winRate,
      facialProfilesCount: facialUsers.length,
      repositoriesCount: repos.length,
      datasetsCount: datasets.length,
      totalBigDataRows,
      totalBigDataVolumeMb,
      storageStatus: this.getStatus()
    };
  }
}

module.exports = new DatabaseService();
module.exports.createTables = createTables;

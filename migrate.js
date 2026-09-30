/**
 * ============================================================================
 * SCRIPT DE MIGRACIÓN DE DATOS A POSTGRESQL
 * Migra los datos de data/crm_db.json a PostgreSQL
 * ============================================================================
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createTables } = require('./db');

const DATA_FILE = path.join(__dirname, 'data', 'crm_db.json');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password || '').digest('hex');
}

async function migrateToPostgres() {
  console.log('🚀 Iniciando migración de datos a PostgreSQL...\n');

  // Leer configuración de PostgreSQL desde variables de entorno
  const poolConfig = process.env.DATABASE_URL || process.env.POSTGRES_URL
    ? { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'datanova_db',
        port: parseInt(process.env.DB_PORT, 10) || 5432
      };

  const pool = new Pool(poolConfig);

  try {
    // Conectar a PostgreSQL
    console.log('📡 Conectando a PostgreSQL...');
    const dbClient = await pool.connect();
    console.log('✅ Conexión establecida\n');

    // Crear tablas necesarias si no existen
    console.log('🔨 Verificando/creando tablas PostgreSQL...');
    await createTables(dbClient);
    console.log('✅ Tablas verificadas/creadas\n');

    // Leer datos del archivo JSON
    console.log('📖 Leyendo data/crm_db.json...');
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error('Archivo data/crm_db.json no encontrado');
    }
    const jsonData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`✅ Datos cargados: ${Object.keys(jsonData).join(', ')}\n`);

    // Migrar usuarios
    console.log('👤 Migrando usuarios...');
    if (jsonData.users && jsonData.users.length > 0) {
      for (const user of jsonData.users) {
        try {
          await dbClient.query(
            `INSERT INTO users (id, user_id, name, email, password_hash, role, avatar, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email) DO UPDATE SET
               name = EXCLUDED.name,
               role = EXCLUDED.role,
               avatar = EXCLUDED.avatar`,
            [
              user.id,
              user.userId || user.email,
              user.name,
              user.email,
              user.passwordHash,
              user.role,
              user.avatar,
              user.createdAt || new Date().toISOString()
            ]
          );
          console.log(`  ✓ Usuario migrado: ${user.email}`);
        } catch (err) {
          console.log(`  ✗ Error migrando usuario ${user.email}:`, err.message);
        }
      }
      console.log(`✅ Usuarios migrados: ${jsonData.users.length}\n`);
    }

    // Migrar perfiles faciales
    console.log('👁️ Migrando perfiles faciales...');
    if (jsonData.facial_users && jsonData.facial_users.length > 0) {
      for (const facial of jsonData.facial_users) {
        try {
          await dbClient.query(
            `INSERT INTO facial_users (id, user_id, descriptor, registered_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO UPDATE SET
               descriptor = EXCLUDED.descriptor,
               registered_at = EXCLUDED.registered_at`,
            [
              facial.id,
              facial.user_id || facial.userId,
              JSON.stringify(facial.descriptor),
              facial.registeredAt || new Date().toISOString()
            ]
          );
          console.log(`  ✓ Perfil facial migrado: ${facial.user_id || facial.userId}`);
        } catch (err) {
          console.log(`  ✗ Error migrando perfil facial:`, err.message);
        }
      }
      console.log(`✅ Perfiles faciales migrados: ${jsonData.facial_users.length}\n`);
    }

    // Migrar clientes
    console.log('🏢 Migrando clientes...');
    if (jsonData.clients && jsonData.clients.length > 0) {
      for (const crmClient of jsonData.clients) {
        try {
          await dbClient.query(
            `INSERT INTO crm_clients (id, name, company, email, phone, status, value, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               company = EXCLUDED.company,
               email = EXCLUDED.email,
               phone = EXCLUDED.phone,
               status = EXCLUDED.status,
               value = EXCLUDED.value,
               notes = EXCLUDED.notes`,
            [
              crmClient.id,
              crmClient.name,
              crmClient.company,
              crmClient.email,
              crmClient.phone,
              crmClient.status,
              crmClient.value,
              crmClient.notes,
              crmClient.createdAt || new Date().toISOString()
            ]
          );
          console.log(`  ✓ Cliente migrado: ${crmClient.name}`);
        } catch (err) {
          console.log(`  ✗ Error migrando cliente ${crmClient.name}:`, err.message);
        }
      }
      console.log(`✅ Clientes migrados: ${jsonData.clients.length}\n`);
    }

    // Migrar deals
    console.log('💼 Migrando oportunidades (deals)...');
    if (jsonData.deals && jsonData.deals.length > 0) {
      for (const deal of jsonData.deals) {
        try {
          await dbClient.query(
            `INSERT INTO crm_deals (id, title, client_id, client_name, stage, amount, probability, expected_close, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               client_id = EXCLUDED.client_id,
               client_name = EXCLUDED.client_name,
               stage = EXCLUDED.stage,
               amount = EXCLUDED.amount,
               probability = EXCLUDED.probability,
               expected_close = EXCLUDED.expected_close`,
            [
              deal.id,
              deal.title,
              deal.clientId,
              deal.clientName,
              deal.stage,
              deal.amount,
              deal.probability,
              deal.expectedClose,
              deal.createdAt || new Date().toISOString()
            ]
          );
          console.log(`  ✓ Deal migrado: ${deal.title}`);
        } catch (err) {
          console.log(`  ✗ Error migrando deal ${deal.title}:`, err.message);
        }
      }
      console.log(`✅ Deals migrados: ${jsonData.deals.length}\n`);
    }

    // Migrar logs
    console.log('📋 Migrando logs de auditoría...');
    if (jsonData.logs && jsonData.logs.length > 0) {
      for (const log of jsonData.logs) {
        try {
          await dbClient.query(
            `INSERT INTO crm_logs (id, type, description, user_id, user_name, details, ip, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              log.id,
              log.type,
              log.description,
              log.userId,
              log.userName,
              log.details,
              log.ip,
              log.timestamp || new Date().toISOString()
            ]
          );
        } catch (err) {
          // Ignorar errores en logs (no críticos)
        }
      }
      console.log(`✅ Logs migrados: ${jsonData.logs.length}\n`);
    }

    // Migrar repositorios Big Data (si existen)
    console.log('🗄️ Migrando repositorios Big Data...');
    if (jsonData.repositories && jsonData.repositories.length > 0) {
      for (const repo of jsonData.repositories) {
        try {
          await dbClient.query(
            `INSERT INTO bigdata_repositories (id, name, description, category, storage_type, region, tags, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               category = EXCLUDED.category,
               storage_type = EXCLUDED.storage_type,
               region = EXCLUDED.region,
               tags = EXCLUDED.tags`,
            [
              repo.id,
              repo.name,
              repo.description,
              repo.category,
              repo.storageType,
              repo.region,
              JSON.stringify(repo.tags || []),
              repo.createdAt || new Date().toISOString()
            ]
          );
          console.log(`  ✓ Repositorio migrado: ${repo.name}`);
        } catch (err) {
          console.log(`  ✗ Error migrando repositorio ${repo.name}:`, err.message);
        }
      }
      console.log(`✅ Repositorios migrados: ${jsonData.repositories.length}\n`);
    }

    // Migrar datasets Big Data (si existen)
    console.log('📊 Migrando datasets Big Data...');
    if (jsonData.datasets && jsonData.datasets.length > 0) {
      for (const dataset of jsonData.datasets) {
        try {
          await dbClient.query(
            `INSERT INTO bigdata_datasets (id, repo_id, name, description, format, size_mb, row_count, quality_score, null_percentage, columns, sample_data, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               format = EXCLUDED.format,
               size_mb = EXCLUDED.size_mb,
               row_count = EXCLUDED.row_count,
               quality_score = EXCLUDED.quality_score,
               null_percentage = EXCLUDED.null_percentage,
               columns = EXCLUDED.columns,
               sample_data = EXCLUDED.sample_data`,
            [
              dataset.id,
              dataset.repoId,
              dataset.name,
              dataset.description,
              dataset.format,
              dataset.sizeMb,
              dataset.rowCount,
              dataset.qualityScore,
              dataset.nullPercentage,
              JSON.stringify(dataset.columns || []),
              JSON.stringify(dataset.sampleData || []),
              dataset.createdAt || new Date().toISOString()
            ]
          );
          console.log(`  ✓ Dataset migrado: ${dataset.name}`);
        } catch (err) {
          console.log(`  ✗ Error migrando dataset ${dataset.name}:`, err.message);
        }
      }
      console.log(`✅ Datasets migrados: ${jsonData.datasets.length}\n`);
    }

    dbClient.release();
    await pool.end();

    console.log('='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log('\n📝 Resumen:');
    console.log(`  - Usuarios: ${jsonData.users?.length || 0}`);
    console.log(`  - Perfiles faciales: ${jsonData.facial_users?.length || 0}`);
    console.log(`  - Clientes: ${jsonData.clients?.length || 0}`);
    console.log(`  - Deals: ${jsonData.deals?.length || 0}`);
    console.log(`  - Logs: ${jsonData.logs?.length || 0}`);
    console.log(`  - Repositorios Big Data: ${jsonData.repositories?.length || 0}`);
    console.log(`  - Datasets Big Data: ${jsonData.datasets?.length || 0}`);
    console.log('\n💡 Puede eliminar data/crm_db.json después de verificar que los datos están correctos en PostgreSQL.\n');

  } catch (err) {
    console.error('❌ Error durante la migración:', err);
    await pool.end();
    process.exit(1);
  }
}

// Ejecutar migración
if (require.main === module) {
  migrateToPostgres();
}

module.exports = { migrateToPostgres };

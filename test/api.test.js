const request = require('supertest');
const app = require('../server');

describe('Suite de Pruebas Datanova CRM & Reconocimiento Facial', () => {

  describe('1. Autenticación Normal (Email y Contraseña)', () => {
    it('debería rechazar login si faltan campos', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@datanova.com' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it('debería rechazar login con contraseña incorrecta', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@datanova.com', password: 'passwordIncorrecta123' });
      expect(res.statusCode).toEqual(401);
    });

    it('debería iniciar sesión exitosamente con credenciales válidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@datanova.com', password: 'admin123' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('admin@datanova.com');
    });

    it('debería registrar un nuevo usuario en el sistema', async () => {
      const uniqueEmail = `test_${Date.now()}@datanova.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuario Prueba',
          email: uniqueEmail,
          password: 'PasswordSegura123!',
          role: 'Especialista CRM'
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(uniqueEmail);
    });
  });

  describe('2. Reconocimiento Facial', () => {
    it('debería fallar al registrar si faltan datos requeridos (userId o descriptor)', async () => {
      const res = await request(app)
        .post('/api/face/register')
        .send({ userId: 'usuario_123' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it('debería registrar y verificar un descriptor facial correctamente', async () => {
      // Creamos un vector unitario de prueba de 128 dimensiones único para esta ejecución
      const seed = Math.random() * 10;
      const testDescriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i + seed) * 0.1);
      const testUserId = `biometrico_${Date.now()}@datanova.com`;

      // Registrar
      const regRes = await request(app)
        .post('/api/face/register')
        .send({
          userId: testUserId,
          descriptor: testDescriptor,
          userName: 'Usuario Biométrico Test'
        });
      expect(regRes.statusCode).toEqual(201);
      expect(regRes.body.success).toBe(true);

      // Verificar con el mismo descriptor (distancia 0)
      const verifyRes = await request(app)
        .post('/api/face/verify')
        .send({
          descriptor: testDescriptor,
          threshold: 0.55
        });
      expect(verifyRes.statusCode).toEqual(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.userId).toBe(testUserId);
      expect(verifyRes.body.distance).toBeLessThan(0.01);
    });

    it('debería rechazar un descriptor facial completamente diferente', async () => {
      // Descriptor ortogonal / distante
      const distantDescriptor = Array.from({ length: 128 }, (_, i) => 10.0 + i * 0.5);
      const res = await request(app)
        .post('/api/face/verify')
        .send({
          descriptor: distantDescriptor,
          threshold: 0.55
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Funcionalidades del CRM', () => {
    it('debería consultar las estadísticas del CRM', async () => {
      const res = await request(app).get('/api/crm/stats');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('totalClients');
      expect(res.body.stats).toHaveProperty('pipelineValue');
    });

    it('debería listar los clientes del CRM', async () => {
      const res = await request(app).get('/api/crm/clients');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.clients)).toBe(true);
    });

    it('debería permitir crear un nuevo cliente', async () => {
      const res = await request(app)
        .post('/api/crm/clients')
        .send({
          name: 'Empresa Test',
          company: 'Test Corp S.A.',
          email: 'contacto@testcorp.com',
          phone: '+1 555 123 4567',
          status: 'Lead',
          value: 15000,
          notes: 'Cliente generado mediante prueba automatizada'
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.client.name).toBe('Empresa Test');
    });
  });

  describe('4. Módulo Big Data y Comparación de Datasets', () => {
    it('debería listar los repositorios de Big Data', async () => {
      const res = await request(app).get('/api/bigdata/repositories');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.repositories)).toBe(true);
      expect(res.body.repositories.length).toBeGreaterThanOrEqual(1);
    });

    it('debería permitir crear un nuevo repositorio Big Data', async () => {
      const res = await request(app)
        .post('/api/bigdata/repositories')
        .send({
          name: 'Data Lake Telemetría Test',
          description: 'Lote de logs de prueba',
          category: 'Pruebas',
          storageType: 'AWS S3',
          region: 'us-east-1'
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.repository.name).toBe('Data Lake Telemetría Test');
    });

    it('debería permitir incorporar un nuevo dataset', async () => {
      const res = await request(app)
        .post('/api/bigdata/datasets')
        .send({
          name: 'Logs_Transaccionales_Test.parquet',
          description: 'Muestra de prueba',
          format: 'Parquet',
          sizeMb: 15.5,
          rowCount: 50000,
          sampleData: [
            { id: '1', valor: 100, categoria: 'Retail' },
            { id: '2', valor: 250, categoria: 'Fintech' }
          ]
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.dataset.name).toBe('Logs_Transaccionales_Test.parquet');
    });

    it('debería comparar exitosamente 2 datasets y calcular schema diff y data drift', async () => {
      const res = await request(app)
        .post('/api/bigdata/compare')
        .send({
          datasetIdA: 'ds_trans_q1',
          datasetIdB: 'ds_trans_q2'
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.comparison).toBeDefined();

      const comp = res.body.comparison;
      // Validar métricas de filas y tamaño
      expect(comp.metricsDiff.rowDiff).toBe(470000); // 1.92M - 1.45M
      expect(comp.metricsDiff.rowDiffPct).toBeGreaterThan(0);
      expect(comp.metricsDiff.sizeDiff).toBeGreaterThan(0);

      // Validar detección de nueva columna en Dataset B
      expect(comp.schemaDiff.totalUniqueB).toBeGreaterThanOrEqual(1);
      expect(comp.schemaDiff.uniqueToB.some(c => c.name === 'score_riesgo_ia')).toBe(true);

      // Validar cálculo de Data Drift en la variable 'monto'
      expect(comp.driftAnalysis.driftMetrics.some(m => m.column === 'monto')).toBe(true);
      expect(comp.driftAnalysis.overallDrift).toBeDefined();
    });

    it('debería rechazar la comparación si se pasa el mismo dataset', async () => {
      const res = await request(app)
        .post('/api/bigdata/compare')
        .send({
          datasetIdA: 'ds_trans_q1',
          datasetIdB: 'ds_trans_q1'
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });
});


# 🚀 GUÍA DE DEPLOYMENT EN VERCEL - DATANOVA CRM

## 📋 RESUMEN DE CAMBIOS REALIZADOS

### Archivos Modificados:
1. **vercel.json** - Actualizado al formato moderno de Vercel Serverless Functions
2. **server.js** - Mejorada configuración CORS para seguridad
3. **api/index.js** - Nuevo archivo handler para Vercel Serverless

### Archivos Creados:
1. **.env.example** - Plantilla de variables de entorno
2. **.gitignore** - Configuración de Git para no exponer secretos

---

## 🌐 ARQUITECTURA FINAL

```
USUARIO
  ↓
NAVEGADOR (Chrome, Edge, Firefox, Safari)
  ↓
VERCEL (https://tu-dominio.vercel.app)
  ↓
Vercel Serverless Functions (api/index.js)
  ↓
Express.js (server.js)
  ↓
PostgreSQL Online (AWS RDS / Vercel Postgres / Supabase)
  ↓
Base de Datos Centralizada
```

**Todos los usuarios trabajan sobre la misma base de datos.**

---

## 🔐 VARIABLES DE ENTORNO NECESARIAS EN VERCEL

### OBLIGATORIAS (Producción):

1. **DATABASE_URL** o **POSTGRES_URL**
   - URL de conexión completa a PostgreSQL
   - Formato: `postgresql://usuario:password@host:puerto/nombre_base_datos`
   - Ejemplo Vercel Postgres: `postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
   - Ejemplo AWS RDS: `postgresql://admin:tu_password@datanova-db.cxyz.us-east-1.rds.amazonaws.com:5432/datanova_db`

2. **NODE_ENV**
   - Valor: `production`
   - Automático en Vercel, pero asegúrate que esté configurado

### OPCIONALES (Recomendadas):

3. **ALLOWED_ORIGINS**
   - Orígenes permitidos para CORS
   - Formato: `https://tu-dominio.vercel.app,http://localhost:3000`
   - Separa múltiples orígenes con comas

4. **FORCE_LOCAL_DB**
   - Solo para desarrollo local
   - Valor: `true` para forzar uso de JSON local
   - NO usar en producción

---

## 📊 TABLAS POSTGRESQL NECESARIAS

El sistema crea automáticamente estas tablas al iniciar:

1. **users** - Usuarios del sistema
   - id, user_id, name, email, password_hash, role, avatar, created_at

2. **facial_users** - Perfiles biométricos faciales
   - id, user_id, descriptor (JSONB), registered_at

3. **crm_clients** - Clientes del CRM
   - id, name, company, email, phone, status, value, notes, created_at

4. **crm_deals** - Oportunidades comerciales
   - id, title, client_id, client_name, stage, amount, probability, expected_close, created_at

5. **bigdata_repositories** - Repositorios Big Data
   - id, name, description, category, storage_type, region, tags (JSONB), created_at

6. **bigdata_datasets** - Datasets Big Data
   - id, repo_id, name, description, format, size_mb, row_count, quality_score, null_percentage, columns (JSONB), sample_data (JSONB), created_at

7. **crm_logs** - Logs de auditoría
   - id, type, description, user_id, user_name, details, ip, timestamp

---

## 🛠️ PASOS PARA MIGRAR DATOS DE crm_db.json A POSTGRESQL

### Opción 1: Migración Automática (Script incluido)

1. **Configura las variables de entorno** en tu máquina local:
   ```bash
   # Crea un archivo .env
   cp .env.example .env
   # Edita .env con tus credenciales de PostgreSQL
   ```

2. **Ejecuta el script de migración**:
   ```bash
   node migrate.js
   ```

3. **Verifica los datos** en PostgreSQL usando pgAdmin, DBeaver o psql

4. **(Opcional) Elimina crm_db.json** después de verificar:
   ```bash
   rm data/crm_db.json
   ```

### Opción 2: Migración Manual

Si prefieres hacerlo manualmente, el script `migrate.js` migra:
- ✅ Usuarios (con contraseñas hasheadas)
- ✅ Perfiles faciales biométricos
- ✅ Clientes del CRM
- ✅ Oportunidades (deals)
- ✅ Logs de auditoría
- ✅ Repositorios Big Data
- ✅ Datasets Big Data

---

## 🚀 PASOS PARA DEPLOY EN VERCEL

### Paso 1: Preparar el Repositorio

1. **Commit los cambios**:
   ```bash
   git add .
   git commit -m "Configure for Vercel deployment with PostgreSQL"
   ```

2. **Empuja a GitHub**:
   ```bash
   git push origin main
   ```

### Paso 2: Configurar PostgreSQL

**Opción A: Vercel Postgres (Recomendado)**
1. Ve a Vercel Dashboard → tu proyecto → Storage
2. Crea una nueva base de datos Postgres
3. Vercel configurará automáticamente `POSTGRES_URL`

**Opción B: AWS RDS**
1. Crea una instancia PostgreSQL en AWS RDS
2. Copia la URL de conexión
3. Configura `DATABASE_URL` en Vercel

**Opción C: Supabase**
1. Crea un proyecto en Supabase
2. Copia la URL de conexión
3. Configura `DATABASE_URL` en Vercel

### Paso 3: Configurar Variables de Entorno en Vercel

1. Ve a Vercel Dashboard → tu proyecto → Settings → Environment Variables
2. Agrega las siguientes variables:

| Variable | Valor | Entorno |
|----------|-------|---------|
| `DATABASE_URL` | `postgresql://...` | Production, Preview, Development |
| `NODE_ENV` | `production` | Production |
| `ALLOWED_ORIGINS` | `https://tu-dominio.vercel.app` | Production |

3. **IMPORTANTE**: No marques las variables como "sensitive" si necesitas verlas en el dashboard.

### Paso 4: Deploy en Vercel

1. **Conecta tu repo de GitHub** a Vercel
2. Vercel detectará automáticamente la configuración en `vercel.json`
3. Haz click en **Deploy**
4. Espera a que termine el build

### Paso 5: Verificar el Deployment

1. **Abre la URL de Vercel**: `https://tu-dominio.vercel.app`
2. **Prueba el login** con:
   - Email: `admin@datanova.com`
   - Password: `admin123`
3. **Verifica que funcione**:
   - ✅ Login normal
   - ✅ Dashboard
   - ✅ Clientes
   - ✅ Deals
   - ✅ Repositorios Big Data
   - ✅ Comparador de Datasets

---

## 💻 PASOS PARA EJECUTAR LOCALMENTE

### Con PostgreSQL Local:

1. **Instala PostgreSQL** en tu máquina
2. **Crea la base de datos**:
   ```bash
   createdb datanova_db
   ```

3. **Configura .env**:
   ```bash
   cp .env.example .env
   # Edita .env con:
   DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/datanova_db
   ```

4. **Instala dependencias**:
   ```bash
   npm install
   ```

5. **Inicia el servidor**:
   ```bash
   npm start
   ```

6. **Abre en navegador**: `http://localhost:3000`

### Sin PostgreSQL (Solo Desarrollo):

1. **Configura .env**:
   ```bash
   cp .env.example .env
   # Agrega:
   FORCE_LOCAL_DB=true
   ```

2. **Instala dependencias**:
   ```bash
   npm install
   ```

3. **Inicia el servidor**:
   ```bash
   npm start
   ```

4. **Abre en navegador**: `http://localhost:3000`

⚠️ **ADVERTENCIA**: El modo local NO debe usarse en producción.

---

## 🔍 VERIFICACIÓN Y TESTING

### Ejecutar Pruebas Automatizadas:

```bash
npm test
```

Esto ejecuta 15 pruebas que verifican:
- ✅ Autenticación normal
- ✅ Reconocimiento facial
- ✅ Funcionalidades CRM
- ✅ Módulo Big Data y comparador de datasets

### Verificar APIs Localmente:

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@datanova.com","password":"admin123"}'

# Stats
curl http://localhost:3000/api/crm/stats
```

---

## 🛡️ SEGURIDAD

### Credenciales y Secretos:

✅ **CORRECTO**:
- Contraseñas hasheadas con SHA-256
- Variables de entorno para credenciales de BD
- .gitignore evita commits de .env
- CORS configurado para dominios específicos

❌ **INCORRECTO** (NO HACER):
- Contraseñas en texto plano en código
- URLs de BD en código fuente
- Commit de .env con valores reales
- CORS con `Access-Control-Allow-Origin: *`

---

## 📝 ERRORES ENCONTRADOS Y SOLUCIONADOS

### Errores Corregidos:

1. **vercel.json** - Usaba formato antiguo `builds`
   - ✅ Solución: Actualizado a formato moderno con `functions` y `routes`

2. **CORS** - Permitía cualquier origen (inseguro)
   - ✅ Solución: Validación de dominios y same-origin para Vercel

3. **Falta .gitignore** - Riesgo de exponer secretos
   - ✅ Solución: Creado .gitignore completo

4. **Falta documentación** - No había guía de deployment
   - ✅ Solución: Creada esta guía completa

---

## 📞 SOPORTE Y TROUBLESHOOTING

### Problema: "Database connection failed"

**Solución**:
- Verifica que `DATABASE_URL` esté configurada en Vercel
- Verifica que la base de datos sea accesible desde Vercel
- Revisa los logs de Vercel en el dashboard

### Problema: "CORS error"

**Solución**:
- Verifica `ALLOWED_ORIGINS` en variables de entorno
- Asegúrate de incluir tu dominio de Vercel
- Revisa la configuración CORS en server.js

### Problema: "Build failed"

**Solución**:
- Verifica que `package.json` tenga las dependencias correctas
- Revisa los logs de build en Vercel
- Asegúrate de que `api/index.js` existe

### Problema: "Models not loading" (Face-api)

**Solución**:
- Verifica que la carpeta `public/models/` exista
- Descarga los modelos usando `node download-models.js` si es necesario
- Verifica que los archivos sean accesibles públicamente

---

## ✅ CHECKLIST FINAL ANTES DE DEPLOY

- [ ] Variables de entorno configuradas en Vercel
- [ ] PostgreSQL creado y accesible
- [ ] Datos migrados de crm_db.json (si aplica)
- [ ] Pruebas locales pasan (`npm test`)
- [ ] Servidor local funciona (`npm start`)
- [ ] .gitignore configurado correctamente
- [ ] .env NO está en el repo
- [ ] vercel.json actualizado
- [ ] api/index.js creado
- [ ] CORS configurado para seguridad
- [ ] Documentación revisada

---

## 🎯 RESUMEN FINAL

Tu CRM ahora está configurado para funcionar en Vercel con PostgreSQL:

✅ **Arquitectura**: Navegador → Vercel → Express → PostgreSQL
✅ **Seguridad**: CORS, contraseñas hasheadas, variables de entorno
✅ **Funcionalidades**: Todas las features conservadas
✅ **Testing**: 15/15 pruebas pasando
✅ **Documentación**: Guía completa de deployment

**El usuario final solo necesita abrir el navegador y entrar al dominio de Vercel.**

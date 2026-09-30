# 🚀 Datanova CRM Enterprise con Reconocimiento Facial & Soporte AWS

Sistema integral de gestión comercial (**CRM**) de nivel empresarial con autenticación dual: **Login Normal (Email/Contraseña)** y **Autenticación Facial Biométrica en tiempo real con Inteligencia Artificial**.

---

## 🌟 Características Principales

### 1. 🔐 Autenticación Dual Avanzada
* **Login Normal:** Acceso con correo corporativo y contraseña con cifrado SHA-256. Soporte para recordar sesión y registro de nuevas cuentas con roles comerciales.
* **Login Facial Biométrico en Tiempo Real:** Visor HUD futurista con retícula holográfica, escáner láser, detección continua de rostro y cálculo de vectores neuronales de 128 dimensiones (`face-api.js` + `TinyFaceDetector`).
* **Enrolamiento Facial Integrado:** Registro de rostro tanto desde el portal de inicio de sesión como desde el módulo de perfil dentro del CRM.
* **Acceso Demo en 1-Clic:** Botón rápido para acceder de inmediato con credenciales de prueba preconfiguradas.

### 2. 📊 CRM Enterprise Completo
* **Dashboard Ejecutivo & KPIs:** Métricas en tiempo real de Total de Clientes, Valor Total del Pipeline, Ingresos Cerrados (Won) y Perfiles Faciales Activos.
* **Embudo Comercial (Funnel):** Gráfica interactiva de avance de prospectos a través de las 5 etapas de venta.
* **Gestión de Clientes & Leads:** Tabla interactiva con búsqueda en tiempo real, filtros por etapa (*Lead*, *Contactado*, *Propuesta*, *Negociación*, *Ganado*), creación, edición, eliminación y exportación directa a archivo **CSV**.
* **Pipeline de Ventas (Tablero Kanban):** Visualización tipo tablero para arrastrar u organizar oportunidades y mover deals de etapa con un solo clic.
* **Módulo de Biometría & Seguridad:** Visualizador del estado biométrico del usuario actual, re-escaneo de rostro sin cerrar sesión, gestión de perfiles faciales y tabla de auditoría con historial cronológico de accesos.
* **Configuración del Sistema:** Selector interactivo del umbral de tolerancia para el reconocimiento facial y descarga de respaldo completo de datos en JSON.

### 3. 📈 Módulo Big Data & Repositorios (Data Lakes)
* **Gestión de Repositorios (Data Lakes):** Organización de datos por clústeres, almacenamiento en la nube (AWS S3, Delta Lake, Snowflake, Apache Iceberg) y regiones AWS (`us-east-1`, `sa-east-1`, etc.).
* **Incorporación de Datasets:** Asistente para registrar nuevos datasets mediante subida de archivos (CSV, JSON, Parquet) o especificación de metadatos, esquemas de columnas y muestras en vivo.
* **Explorador de Datasets:** Inspección profunda de esquemas de datos, tipos de campo (`string`, `number`, `boolean`, `datetime`), métricas de calidad de datos, porcentajes de nulos y previsualizador de registros de muestra.

### 4. 🔬 Motor de Comparación de Datasets (Data Drift & Schema Diff)
* **Comparador de 2 Datasets Side-by-Side:** Selección de cualquier par de datasets para análisis comparativo inmediato o uso de presets integrados (ej. Transacciones Q1 vs Q2, o Telemetría AWS Virginia vs São Paulo).
* **Diagnóstico Ejecutivo de Data Drift:** Detección de estabilidad de distribución estadística (`Estable`, `Moderado`, `Crítico`), con recomendaciones automáticas para reentrenamiento de modelos de Machine Learning.
* **Diferencial de Métricas Clave:** Comparativa porcentual de filas totales ($\Delta$ Filas), tamaño en disco ($\Delta$ MB), score de calidad y ratio de valores nulos.
* **Schema Diff Visualizer:** Matriz de columnas comunes con compatibilidad de tipos, detección de columnas exclusivas en Dataset A y nuevas columnas agregadas en Dataset B.
* **Análisis de Drift Estadístico por Variable:** Desviación porcentual del promedio ($\mu$) y rangos mínimo/máximo entre ambos lotes de datos.
* **Previsualización de Muestras Lado a Lado:** Inspección visual directa de filas representativas de ambos datasets.
* **Exportación de Informes:** Descarga del reporte completo de auditoría y comparación en formato JSON estructurado.

### 5. ☁️ Arquitectura Resiliente & AWS
* **Soporte Nativo de PostgreSQL:** Conexión mediante `pg.Pool` compatible con **AWS RDS**, Vercel Postgres o bases de datos PostgreSQL locales.
* **Modo Local Autónomo Resiliente:** Si PostgreSQL no está instalado o no se encuentra activo localmente, el sistema activa automáticamente un almacenamiento persistente local optimizado en `data/crm_db.json`, garantizando funcionamiento inmediato sin configuraciones complejas.

---

## ⚡ Credenciales de Demostración

| Rol | Correo Electrónico | Contraseña | Biometría Facial |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@datanova.com` | `admin123` | Enrolable en la app |
| **Gerente Comercial** | `carlos.mendoza@datanova.com` | `carlos2026` | Enrolable en la app |

---

## 🛠️ Requisitos e Instalación

### Requisitos:
* **Node.js** (v18 o superior)
* Navegador moderno con soporte para WebRTC / Cámara web (Chrome, Edge, Firefox, Safari).

### Instalación:
1. Clonar o descomprimir el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```
4. Abrir en el navegador:
   ```
   http://localhost:3000
   ```

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias y de integración que verifica la autenticación normal, el cálculo de descriptores faciales, los endpoints del CRM y el motor de Big Data / Comparación de Datasets:

```bash
npm test
```

---

## 📁 Estructura del Proyecto

```text
├── public/                     # Frontend estático de alto rendimiento
│   ├── models/                 # Pesos y manifiestos de redes neuronales (face-api)
│   ├── app.js                  # Lógica del cliente, HUD facial, comparador Big Data y SPA
│   ├── index.html              # Interfaz HTML5 con Login Dual, CRM y Módulo Big Data
│   └── styles.css              # Sistema de diseño Glassmorphism empresarial
├── test/
│   └── api.test.js             # Pruebas automatizadas con Jest (15 tests en 4 suites)
├── data/
│   └── crm_db.json             # Almacenamiento persistente local con datasets pre-cargados
├── db.js                       # Capa de datos dual (PostgreSQL / Almacenamiento local + Diff Engine)
├── server.js                   # Servidor API REST con Express y endpoints Big Data
├── package.json                # Dependencias y scripts del proyecto
└── README.md                   # Documentación técnica
```

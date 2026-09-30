/**
 * ============================================================================
 * DATANOVA ENTERPRISE - CLIENT APPLICATION CONTROLLER
 * CRM, Biometría Facial con Face-api.js, Repositorios Big Data & Comparador
 * ============================================================================
 */

// Estado Global de la Aplicación
const state = {
  currentUser: null,
  activeView: 'dashboard',
  isModelsLoaded: false,
  isCameraReady: false,
  stream: null,
  faceDetectionInterval: null,
  currentFaceDescriptor: null,
  currentDetectionScore: 0,
  facialThreshold: parseFloat(localStorage.getItem('datanova_threshold') || '0.55'),
  clients: [],
  deals: [],
  logs: [],
  repositories: [],
  datasets: [],
  currentComparison: null,
  activeFilter: 'Todos',
  activeRepoFilter: ''
};

// Rutas de APIs - Usa rutas relativas para funcionar tanto en local como en producción
const BASE_URL = ''; // Rutas relativas para funcionar en cualquier dominio
const MODEL_URL = '/models';
const API_BASE = '/api';

// ============================================================================
// 1. UTILIDADES Y SISTEMA DE NOTIFICACIONES TOAST
// ============================================================================
function showToast(message, type = 'info', title = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const titles = {
    success: 'Operación Exitosa',
    error: 'Atención / Error',
    warning: 'Advertencia',
    info: 'Notificación del Sistema'
  };

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title || titles[type]}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + ' M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + ' K';
  }
  return new Intl.NumberFormat('es-ES').format(num || 0);
}

function formatDate(isoString) {
  if (!isoString) return 'Reciente';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================================================
// 2. CARGA DE MODELOS IA Y CÁMARA PARA RECONOCIMIENTO FACIAL
// ============================================================================
async function initFaceApiModels() {
  const loadingOverlay = document.getElementById('cameraLoadingOverlay');
  const loadingText = document.getElementById('cameraLoadingText');
  const backendPill = document.getElementById('backendStatusPill');

  try {
    if (loadingText) loadingText.textContent = 'Cargando redes neuronales face-api...';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);

    state.isModelsLoaded = true;
    console.log('✅ Modelos de visión artificial cargados correctamente.');
    if (backendPill) backendPill.textContent = 'Datanova CRM & Big Data • Biometría IA Activa';

    await startCameraStream();
  } catch (err) {
    console.error('Error cargando modelos face-api:', err);
    if (loadingText) loadingText.textContent = 'Error al cargar modelos de IA.';
    showToast('No se pudieron cargar los modelos de visión artificial desde /models.', 'error');
  }
}

async function startCameraStream() {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('faceCanvas');
  const loadingOverlay = document.getElementById('cameraLoadingOverlay');
  const loadingText = document.getElementById('cameraLoadingText');
  const indicatorDot = document.getElementById('faceIndicatorDot');
  const indicatorText = document.getElementById('faceIndicatorText');

  if (!video) return;

  try {
    if (loadingText) loadingText.textContent = 'Conectando con sensor de cámara...';
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    });

    state.stream = stream;
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      state.isCameraReady = true;
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (indicatorText) indicatorText.textContent = 'Buscando rostro en cámara...';
      startLiveFaceDetectionLoop(video, canvas);
    };
  } catch (err) {
    console.warn('Aviso sobre cámara:', err);
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (indicatorDot) indicatorDot.className = 'status-indicator-dot no-face';
    if (indicatorText) indicatorText.textContent = 'Cámara no accesible (Usa Login Normal)';
    showToast('Cámara web no detectada o permisos denegados. Puedes usar el Login Normal con contraseña.', 'info');
  }
}

function startLiveFaceDetectionLoop(video, canvas) {
  if (state.faceDetectionInterval) clearInterval(state.faceDetectionInterval);

  const scanBtn = document.getElementById('scanAndLoginBtn');
  const indicatorDot = document.getElementById('faceIndicatorDot');
  const indicatorText = document.getElementById('faceIndicatorText');
  const confidencePill = document.getElementById('confidencePill');
  const scanLaser = document.getElementById('scanLaser');

  state.faceDetectionInterval = setInterval(async () => {
    if (!state.isModelsLoaded || !state.isCameraReady || video.paused || video.ended) return;

    try {
      const displaySize = { width: video.videoWidth || video.clientWidth, height: video.videoHeight || video.clientHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5
      })).withFaceLandmarks().withFaceDescriptor();

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detection) {
        state.currentFaceDescriptor = detection.descriptor;
        state.currentDetectionScore = detection.detection.score;

        const resized = faceapi.resizeResults(detection, displaySize);
        const box = resized.detection.box;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        if (indicatorDot) indicatorDot.className = 'status-indicator-dot detected';
        if (indicatorText) indicatorText.textContent = 'Rostro detectado: Alineado ✓';
        if (confidencePill) {
          confidencePill.style.display = 'inline-block';
          confidencePill.textContent = `${Math.round(detection.detection.score * 100)}% Calidad`;
        }
        if (scanBtn) scanBtn.disabled = false;
        if (scanLaser) scanLaser.style.opacity = '1';
      } else {
        state.currentFaceDescriptor = null;
        if (indicatorDot) indicatorDot.className = 'status-indicator-dot waiting';
        if (indicatorText) indicatorText.textContent = 'Centra tu rostro frente a la cámara...';
        if (confidencePill) confidencePill.style.display = 'none';
        if (scanBtn) scanBtn.disabled = true;
        if (scanLaser) scanLaser.style.opacity = '0.3';
      }
    } catch (e) {}
  }, 120);
}

// ============================================================================
// 3. AUTENTICACIÓN: LOGIN NORMAL, LOGIN FACIAL Y REGISTRO
// ============================================================================

async function handleNormalLogin(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const submitBtn = document.getElementById('submitLoginBtn');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast('Por favor, ingresa tu correo y contraseña.', 'warning');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verificando...</span>';

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`¡Bienvenido, ${data.user.name}! Acceso concedido al sistema.`, 'success');
      loginSuccess(data.user);
    } else {
      showToast(data.error || 'Credenciales inválidas', 'error');
    }
  } catch (err) {
    console.error('Error en login normal:', err);
    showToast('Error de conexión con el servidor.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Ingresar al CRM</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  }
}

async function handleFaceLogin() {
  const scanBtn = document.getElementById('scanAndLoginBtn');
  const video = document.getElementById('webcam');
  const statusBadge = document.getElementById('faceStatusBadge');

  if (!state.currentFaceDescriptor) {
    showToast('No se detectó un rostro claro. Por favor, mira fijamente a la cámara.', 'warning');
    return;
  }

  try {
    scanBtn.disabled = true;
    const origHTML = scanBtn.innerHTML;
    scanBtn.innerHTML = '<span>Analizando Biometría...</span>';

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();

    if (!detection) {
      showToast('Se perdió el rostro. Mantén tu posición frente a la cámara.', 'warning');
      scanBtn.disabled = false;
      scanBtn.innerHTML = origHTML;
      return;
    }

    const descriptorArray = Array.from(detection.descriptor);

    const res = await fetch(`${API_BASE}/face/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descriptor: descriptorArray,
        threshold: state.facialThreshold
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (statusBadge) {
        statusBadge.textContent = `✓ Reconocido: ${data.user.name} (${data.confidence})`;
        statusBadge.className = 'status-badge-modern success';
        statusBadge.style.display = 'block';
      }

      showToast(`¡Identidad biométrica verificada! Bienvenido, ${data.user.name} (${data.confidence} coincidencia).`, 'success');
      setTimeout(() => loginSuccess(data.user), 600);
    } else {
      if (statusBadge) {
        statusBadge.textContent = data.message || 'Rostro no coincide con ningún perfil registrado.';
        statusBadge.className = 'status-badge-modern error';
        statusBadge.style.display = 'block';
      }
      showToast(data.message || 'Rostro no reconocido. Enrola tu rostro primero o usa tu contraseña.', 'error');
    }

    scanBtn.innerHTML = origHTML;
    scanBtn.disabled = false;
  } catch (err) {
    console.error('Error en verificación facial:', err);
    showToast('Error en la verificación biométrica con el servidor.', 'error');
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<span>Escanear y Autenticar</span>';
  }
}

function loginSuccess(user) {
  state.currentUser = user;
  sessionStorage.setItem('datanova_user', JSON.stringify(user));

  const authScreen = document.getElementById('authScreen');
  const crmScreen = document.getElementById('crmAppScreen');

  authScreen.style.opacity = '0';
  authScreen.style.transition = 'opacity 0.3s ease';

  setTimeout(() => {
    authScreen.style.display = 'none';
    crmScreen.style.display = 'flex';
    crmScreen.style.opacity = '0';
    setTimeout(() => {
      crmScreen.style.transition = 'opacity 0.4s ease';
      crmScreen.style.opacity = '1';
    }, 50);

    updateUserInterface(user);
    loadAllSystemData();
  }, 300);
}

function handleLogout() {
  state.currentUser = null;
  sessionStorage.removeItem('datanova_user');

  const authScreen = document.getElementById('authScreen');
  const crmScreen = document.getElementById('crmAppScreen');

  crmScreen.style.display = 'none';
  authScreen.style.display = 'flex';
  authScreen.style.opacity = '1';

  showToast('Has cerrado sesión correctamente.', 'info');
}

// ============================================================================
// 4. ENROLAMIENTO FACIAL
// ============================================================================
async function handleCaptureAndEnroll() {
  const userIdInput = document.getElementById('enrollUserIdInput');
  const userNameInput = document.getElementById('enrollUserNameInput');
  const captureBtn = document.getElementById('captureAndEnrollBtn');
  const statusText = document.getElementById('modalCamStatusText');
  const modalVideo = document.getElementById('modalWebcam');

  const userId = userIdInput.value.trim();
  const userName = userNameInput.value.trim();

  if (!userId) {
    showToast('Debes ingresar un correo o identificador de usuario para vincular el rostro.', 'warning');
    return;
  }

  try {
    captureBtn.disabled = true;
    captureBtn.innerHTML = '<span>Capturando biometría...</span>';
    if (statusText) statusText.textContent = 'Escaneando rostro...';

    const videoSource = (modalVideo && modalVideo.srcObject) ? modalVideo : document.getElementById('webcam');

    const detection = await faceapi.detectSingleFace(videoSource, new faceapi.TinyFaceDetectorOptions())
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();

    if (!detection) {
      showToast('No se detectó ningún rostro. Por favor, mira de frente al sensor.', 'error');
      if (statusText) statusText.textContent = 'Rostro no detectado. Intenta de nuevo.';
      captureBtn.disabled = false;
      captureBtn.innerHTML = '<span>Capturar y Guardar Rostro</span>';
      return;
    }

    const descriptorArray = Array.from(detection.descriptor);

    const res = await fetch(`${API_BASE}/face/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName: userName || (state.currentUser ? state.currentUser.name : userId.split('@')[0]),
        descriptor: descriptorArray
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`¡Rostro registrado y vinculado con éxito para ${userId}!`, 'success');
      
      if (state.currentUser && (state.currentUser.email === userId || state.currentUser.userId === userId)) {
        state.currentUser.hasFacialProfile = true;
        sessionStorage.setItem('datanova_user', JSON.stringify(state.currentUser));
        updateUserInterface(state.currentUser);
      }

      closeModal('faceEnrollModal');
      if (state.activeView === 'biometrics') loadBiometricsData();
    } else {
      showToast(data.error || 'Error al guardar el descriptor biométrico', 'error');
    }
  } catch (err) {
    console.error('Error al enrolar rostro:', err);
    showToast('Error de comunicación con el servidor al registrar el rostro.', 'error');
  } finally {
    captureBtn.disabled = false;
    captureBtn.innerHTML = '<span>Capturar y Guardar Rostro</span>';
  }
}

async function startModalCamera() {
  const modalVideo = document.getElementById('modalWebcam');
  if (!modalVideo) return;

  try {
    if (state.stream) {
      modalVideo.srcObject = state.stream;
      modalVideo.play();
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      modalVideo.srcObject = stream;
      modalVideo.play();
    }
  } catch (e) {
    console.warn('Error en cámara de modal:', e);
  }
}

// ============================================================================
// 5. CARGA GENERAL DE DATOS (CRM & BIG DATA)
// ============================================================================
async function loadAllSystemData() {
  await Promise.all([
    loadStats(),
    loadClients(),
    loadDeals(),
    loadRepositories(),
    loadDatasets(),
    loadLogs(),
    loadHealthInfo()
  ]);
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/crm/stats`);
    const data = await res.json();
    if (data.success && data.stats) {
      const s = data.stats;
      document.getElementById('kpiTotalClients').textContent = s.totalClients || 0;
      document.getElementById('kpiPipelineValue').textContent = formatCurrency(s.pipelineValue || 0);
      document.getElementById('kpiWonValue').textContent = formatCurrency(s.wonValue || 0);
      document.getElementById('kpiFacialCount').textContent = s.facialProfilesCount || 0;

      // Actualizar contadores de navegación
      document.getElementById('navClientsCount').textContent = s.totalClients || 0;
      document.getElementById('navDealsCount').textContent = s.activeDeals || 0;
      const navRepos = document.getElementById('navReposCount');
      if (navRepos) navRepos.textContent = s.repositoriesCount || 0;

      // Métricas de Big Data en panel de repositorios
      const statRepos = document.getElementById('statTotalRepos');
      const statDatasets = document.getElementById('statTotalDatasets');
      const statRows = document.getElementById('statTotalBigDataRows');
      const statVol = document.getElementById('statTotalVolume');

      if (statRepos) statRepos.textContent = s.repositoriesCount || 0;
      if (statDatasets) statDatasets.textContent = s.datasetsCount || 0;
      if (statRows) statRows.textContent = formatNumber(s.totalBigDataRows || 0);
      if (statVol) statVol.textContent = (s.totalBigDataVolumeMb ? (s.totalBigDataVolumeMb / 1024).toFixed(2) + ' GB' : '0 GB');

      updateFunnelBars(s.pipelineValue);

      if (s.storageStatus) {
        const textElem = document.getElementById('storageStatusText');
        if (s.storageStatus.mode === 'postgresql') {
          if (textElem) textElem.textContent = 'PostgreSQL / AWS Conectado';
        } else {
          if (textElem) textElem.textContent = 'Almacenamiento Local Seguro';
        }
      }
    }
  } catch (err) {
    console.error('Error al cargar stats:', err);
  }
}

function updateFunnelBars(totalPipeline) {
  const deals = state.deals;
  const stages = { Prospecto: 0, Contactado: 0, Propuesta: 0, Negociación: 0, Ganado: 0 };

  deals.forEach(d => {
    if (stages[d.stage] !== undefined) {
      stages[d.stage] += (Number(d.amount) || 0);
    }
  });

  const maxVal = Math.max(...Object.values(stages), 1000);

  const map = [
    { id: 'funnelValProspect', bar: 'funnelBarProspect', val: stages.Prospecto },
    { id: 'funnelValContact', bar: 'funnelBarContact', val: stages.Contactado },
    { id: 'funnelValProp', bar: 'funnelBarProp', val: stages.Propuesta },
    { id: 'funnelValNeg', bar: 'funnelBarNeg', val: stages.Negociación },
    { id: 'funnelValWon', bar: 'funnelBarWon', val: stages.Ganado }
  ];

  map.forEach(item => {
    const valElem = document.getElementById(item.id);
    const barElem = document.getElementById(item.bar);
    if (valElem) valElem.textContent = formatCurrency(item.val);
    if (barElem) {
      const pct = Math.min(100, Math.max(15, Math.round((item.val / maxVal) * 100)));
      barElem.style.width = `${pct}%`;
    }
  });
}

// ============================================================================
// 6. CONTROLADORES BIG DATA: REPOSITORIOS
// ============================================================================
async function loadRepositories() {
  try {
    const res = await fetch(`${API_BASE}/bigdata/repositories`);
    const data = await res.json();
    if (data.success && data.repositories) {
      state.repositories = data.repositories;
      renderRepositories(data.repositories);
      populateRepositorySelects(data.repositories);
    }
  } catch (err) {
    console.error('Error cargando repositorios:', err);
  }
}

function renderRepositories(repos) {
  const grid = document.getElementById('repositoriesGrid');
  if (!grid) return;

  if (repos.length === 0) {
    grid.innerHTML = '<div class="empty-state-card" style="grid-column: 1/-1;">No hay repositorios Big Data creados aún. Haz clic en "+ Nuevo Repositorio" para registrar tu primer Data Lake en AWS S3.</div>';
    return;
  }

  grid.innerHTML = repos.map(r => `
    <div class="repo-card">
      <div class="repo-card-top">
        <div class="repo-title-group">
          <h4>${r.name}</h4>
          <span class="repo-category-tag">${r.category || 'General'}</span>
        </div>
        <button class="btn-table-action delete" onclick="deleteRepository('${r.id}', '${r.name}')" title="Eliminar Repositorio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>

      <p class="repo-desc">${r.description || 'Almacenamiento de datasets y particiones para analítica.'}</p>

      <div class="repo-meta-list">
        <div class="repo-meta-row">
          <span class="label">Almacenamiento:</span>
          <span class="val">${r.storageType || 'AWS S3'}</span>
        </div>
        <div class="repo-meta-row">
          <span class="label">Región AWS:</span>
          <span class="val">${r.region || 'us-east-1'}</span>
        </div>
        <div class="repo-meta-row">
          <span class="label">Datasets / Volumen:</span>
          <span class="val">${r.datasetCount || 0} datasets • ${r.totalSizeMb || 0} MB</span>
        </div>
      </div>

      <div class="repo-tags-wrap">
        ${(r.tags || []).map(t => `<span class="repo-tag-chip">#${t}</span>`).join('')}
      </div>

      <div class="repo-card-actions">
        <button class="btn-primary-sm btn-full" onclick="filterDatasetsByRepo('${r.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Ver Datasets (${r.datasetCount || 0})</span>
        </button>
      </div>
    </div>
  `).join('');
}

function populateRepositorySelects(repos) {
  const filterSelect = document.getElementById('repoFilterSelect');
  const modalSelect = document.getElementById('datasetRepoSelect');

  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Todos los Repositorios</option>' +
      repos.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  }

  if (modalSelect) {
    modalSelect.innerHTML = repos.map(r => `<option value="${r.id}">${r.name} (${r.storageType})</option>`).join('');
  }
}

window.deleteRepository = async function(id, name) {
  if (!confirm(`¿Confirmas la eliminación del repositorio "${name}" y todos sus datasets asociados?`)) return;

  try {
    const res = await fetch(`${API_BASE}/bigdata/repositories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Repositorio "${name}" eliminado.`, 'info');
      await loadRepositories();
      await loadDatasets();
      await loadStats();
    }
  } catch (err) {
    showToast('Error al eliminar repositorio', 'error');
  }
};

window.filterDatasetsByRepo = function(repoId) {
  const filterSelect = document.getElementById('repoFilterSelect');
  if (filterSelect) filterSelect.value = repoId;
  state.activeRepoFilter = repoId;
  loadDatasets(repoId);
};

async function handleSaveRepo(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('repoNameInput').value.trim();
  const category = document.getElementById('repoCategoryInput').value;
  const storageType = document.getElementById('repoStorageTypeInput').value;
  const region = document.getElementById('repoRegionInput').value;
  const tags = document.getElementById('repoTagsInput').value.trim();
  const description = document.getElementById('repoDescInput').value.trim();

  if (!name) {
    showToast('El nombre del repositorio es obligatorio.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/bigdata/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, storageType, region, tags, description })
    });

    if (res.ok) {
      showToast('Repositorio Big Data creado en AWS S3.', 'success');
      closeModal('repoModal');
      await loadRepositories();
      await loadStats();
    } else {
      const data = await res.json();
      showToast(data.error || 'Error al crear repositorio', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

// ============================================================================
// 7. CONTROLADORES BIG DATA: DATASETS
// ============================================================================
async function loadDatasets(repoId = null) {
  try {
    const url = repoId ? `${API_BASE}/bigdata/datasets?repoId=${repoId}` : `${API_BASE}/bigdata/datasets`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.datasets) {
      state.datasets = data.datasets;
      renderDatasetsTable(data.datasets);
      populateCompareDropdowns(data.datasets);
    }
  } catch (err) {
    console.error('Error cargando datasets:', err);
  }
}

function renderDatasetsTable(datasets) {
  const tbody = document.getElementById('datasetsTableBody');
  if (!tbody) return;

  if (datasets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state-card">No hay datasets en este repositorio. Haz clic en "+ Incorporar Dataset" para cargar un nuevo lote.</td></tr>';
    return;
  }

  tbody.innerHTML = datasets.map(d => {
    const repo = state.repositories.find(r => r.id === d.repoId);
    const formatClass = d.format ? d.format.toLowerCase() : 'parquet';

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:white;">${d.name}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">${d.description || 'Sin descripción'}</div>
        </td>
        <td>
          <span style="font-size:0.8rem; color:#a5b4fc; font-weight:600;">${repo ? repo.name : (d.repoId || 'Data Lake')}</span>
        </td>
        <td>
          <span class="status-tag propuesta">${d.format || 'Parquet'}</span>
        </td>
        <td>
          <strong>${formatNumber(d.rowCount)}</strong>
          <span style="font-size:0.7rem; color:var(--text-dim);"> filas</span>
        </td>
        <td>
          <strong>${d.sizeMb} MB</strong>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="funnel-progress-bg" style="width:60px; height:6px;">
              <div class="funnel-progress-fill stage-5" style="width:${d.qualityScore || 95}%;"></div>
            </div>
            <span style="font-size:0.775rem; font-weight:700; color:#34d399;">${d.qualityScore || 95}%</span>
          </div>
        </td>
        <td>
          <div class="action-btns-row">
            <button class="btn-table-action" onclick="sendToCompare('${d.id}')" title="Llevar a Comparador">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cyan-accent);"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
            </button>
            <button class="btn-table-action" onclick="showDatasetDetail('${d.id}')" title="Ver Esquema y Muestra">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-table-action delete" onclick="deleteDataset('${d.id}', '${d.name}')" title="Eliminar Dataset">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.deleteDataset = async function(id, name) {
  if (!confirm(`¿Confirmas la eliminación del dataset "${name}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/bigdata/datasets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Dataset "${name}" eliminado.`, 'info');
      await loadDatasets(state.activeRepoFilter);
      await loadRepositories();
      await loadStats();
    }
  } catch (err) {
    showToast('Error al eliminar dataset', 'error');
  }
};

window.showDatasetDetail = function(id) {
  const d = state.datasets.find(item => item.id === id);
  if (!d) return;

  document.getElementById('detailDatasetTitle').textContent = d.name;
  document.getElementById('detailDatasetSubtitle').textContent = `Formato: ${d.format} • ${formatNumber(d.rowCount)} filas • ${d.sizeMb} MB • Calidad: ${d.qualityScore}%`;

  const schemaTbody = document.getElementById('detailSchemaTableBody');
  const sampleHead = document.getElementById('detailSampleHead');
  const sampleBody = document.getElementById('detailSampleBody');

  const cols = d.columns || [];
  if (schemaTbody) {
    schemaTbody.innerHTML = cols.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td><span class="col-type-tag">${c.type}</span></td>
        <td>${c.mean !== undefined ? c.mean.toFixed(2) : '-'}</td>
        <td>${c.min !== undefined ? c.min : '-'}</td>
        <td>${c.max !== undefined ? c.max : '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">Sin metadatos de columnas</td></tr>';
  }

  const sample = d.sampleData || [];
  if (sample.length > 0 && sampleHead && sampleBody) {
    const sampleCols = Object.keys(sample[0]);
    sampleHead.innerHTML = `<tr>${sampleCols.map(c => `<th>${c}</th>`).join('')}</tr>`;
    sampleBody.innerHTML = sample.map(row => `
      <tr>${sampleCols.map(c => `<td>${row[c] !== undefined ? row[c] : ''}</td>`).join('')}</tr>
    `).join('');
  }

  const compareBtn = document.getElementById('sendDetailToCompareBtn');
  if (compareBtn) {
    compareBtn.onclick = () => {
      closeModal('datasetDetailModal');
      sendToCompare(d.id);
    };
  }

  openModal('datasetDetailModal');
};

async function handleSaveDataset(e) {
  if (e) e.preventDefault();
  const repoId = document.getElementById('datasetRepoSelect').value;
  const name = document.getElementById('datasetNameInput').value.trim();
  const format = document.getElementById('datasetFormatSelect').value;
  const rowCount = parseInt(document.getElementById('datasetRowsInput').value, 10) || 1000000;
  const sizeMb = parseFloat(document.getElementById('datasetSizeInput').value) || 250;
  const qualityScore = parseInt(document.getElementById('datasetQualityInput').value, 10) || 98;
  const description = document.getElementById('datasetDescInput').value.trim();
  const csvRaw = document.getElementById('datasetSampleCsv').value.trim();

  if (!name) {
    showToast('El nombre del dataset es obligatorio.', 'warning');
    return;
  }

  let sampleData = [];
  if (csvRaw) {
    try {
      const lines = csvRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length && i < 15; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const row = {};
          headers.forEach((h, idx) => {
            let val = values[idx];
            if (!isNaN(val) && val !== '') val = Number(val);
            if (val === 'true') val = true;
            if (val === 'false') val = false;
            row[h] = val;
          });
          sampleData.push(row);
        }
      }
    } catch (err) {
      console.warn('No se pudo parsear CSV personalizado, se usará esquema automático');
    }
  }

  try {
    const res = await fetch(`${API_BASE}/bigdata/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoId,
        name,
        format,
        rowCount,
        sizeMb,
        qualityScore,
        description,
        sampleData
      })
    });

    if (res.ok) {
      showToast(`Dataset "${name}" incorporado al repositorio exitosamente.`, 'success');
      closeModal('datasetModal');
      await loadDatasets(state.activeRepoFilter);
      await loadRepositories();
      await loadStats();
    } else {
      const data = await res.json();
      showToast(data.error || 'Error al incorporar dataset', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

// ============================================================================
// 8. MOTOR DE COMPARACIÓN ENTRE 2 DATASETS (DIFF & DRIFT ENGINE)
// ============================================================================
function populateCompareDropdowns(datasets) {
  const selectA = document.getElementById('selectDatasetA');
  const selectB = document.getElementById('selectDatasetB');

  if (!selectA || !selectB) return;

  const currentA = selectA.value;
  const currentB = selectB.value;

  const options = datasets.map(d => `
    <option value="${d.id}">${d.name} (${formatNumber(d.rowCount)} filas - ${d.sizeMb} MB)</option>
  `).join('');

  selectA.innerHTML = options;
  selectB.innerHTML = options;

  if (currentA && datasets.some(d => d.id === currentA)) selectA.value = currentA;
  else if (datasets.length > 0) selectA.value = datasets[0].id;

  if (currentB && datasets.some(d => d.id === currentB)) selectB.value = currentB;
  else if (datasets.length > 1) selectB.value = datasets[1].id;
}

window.sendToCompare = function(datasetId) {
  const selectA = document.getElementById('selectDatasetA');
  const selectB = document.getElementById('selectDatasetB');

  if (selectA) selectA.value = datasetId;
  
  // Seleccionar automáticamente uno diferente en B si es posible
  if (selectB && state.datasets.length > 1) {
    const other = state.datasets.find(d => d.id !== datasetId);
    if (other) selectB.value = other.id;
  }

  switchCrmView('compare');
  executeComparison();
};

async function executeComparison() {
  const selectA = document.getElementById('selectDatasetA');
  const selectB = document.getElementById('selectDatasetB');
  const btn = document.getElementById('executeCompareBtn');

  const idA = selectA.value;
  const idB = selectB.value;

  if (!idA || !idB) {
    showToast('Selecciona dos datasets para comparar.', 'warning');
    return;
  }

  if (idA === idB) {
    showToast('Debes seleccionar dos datasets distintos para ejecutar el análisis diferencial.', 'warning');
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Calculando Diff & Drift...</span>';
    }

    const res = await fetch(`${API_BASE}/bigdata/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetIdA: idA, datasetIdB: idB })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      state.currentComparison = data.comparison;
      renderComparisonResults(data.comparison);
      showToast('Comparación completada exitosamente con cálculo de Data Drift.', 'success');
    } else {
      showToast(data.error || 'Error al comparar datasets', 'error');
    }
  } catch (err) {
    console.error('Error en comparación:', err);
    showToast('Error de comunicación con el motor de comparación.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg><span>Comparar Datasets</span>';
    }
  }
}

function renderComparisonResults(comp) {
  const area = document.getElementById('compareResultsArea');
  if (!area) return;
  area.style.display = 'block';

  // 1. Diagnóstico de Drift
  const diagCard = document.querySelector('.drift-diagnosis-card');
  const diagTitle = document.getElementById('diagResultTitle');
  const diagBadge = document.getElementById('diagBadge');
  const diagBadgeText = document.getElementById('diagBadgeText');
  const diagSummary = document.getElementById('diagSummaryText');

  const drift = comp.driftAnalysis;
  if (diagBadge) {
    diagBadge.className = `drift-level-badge ${drift.overallColor}`;
    diagBadgeText.textContent = drift.overallDrift;
  }
  if (diagCard) {
    diagCard.className = `dashboard-card drift-diagnosis-card ${drift.overallColor}`;
  }

  const rowSign = comp.metricsDiff.rowDiff >= 0 ? '+' : '';
  const sizeSign = comp.metricsDiff.sizeDiff >= 0 ? '+' : '';
  
  if (diagTitle) {
    diagTitle.textContent = drift.overallDrift.includes('Alto') 
      ? '⚠️ Desviación Crítica de Datos (Data Drift Alto)' 
      : (drift.overallDrift.includes('Moderado') ? 'Deriva Estadística Moderada (Monitoreo Activo)' : '✓ Distribuciones Estables y Consistentes');
  }

  if (diagSummary) {
    diagSummary.innerHTML = `
      El lote <strong>${comp.datasetB.name}</strong> presenta una variación volumétrica de <strong>${rowSign}${comp.metricsDiff.rowDiffPct}%</strong> (${rowSign}${formatNumber(comp.metricsDiff.rowDiff)} registros) y <strong>${sizeSign}${comp.metricsDiff.sizeDiff} MB</strong> en almacenamiento.
      ${comp.schemaDiff.totalUniqueB > 0 ? `Se detectaron <strong>${comp.schemaDiff.totalUniqueB} columnas nuevas</strong> en el esquema de B.` : 'El esquema estructural se mantiene consistente.'}
      ${drift.driftMetrics.length > 0 ? `La variable clave <strong>${drift.driftMetrics[0].column}</strong> tiene un desplazamiento medio de <strong>${drift.driftMetrics[0].changePct > 0 ? '+' : ''}${drift.driftMetrics[0].changePct}%</strong>.` : ''}
    `;
  }

  // 2. KPIs A vs B
  document.getElementById('cmpRowsA').textContent = formatNumber(comp.datasetA.rowCount);
  document.getElementById('cmpRowsB').textContent = formatNumber(comp.datasetB.rowCount);
  document.getElementById('cmpRowsDiff').textContent = `${rowSign}${formatNumber(comp.metricsDiff.rowDiff)} (${rowSign}${comp.metricsDiff.rowDiffPct}%)`;

  document.getElementById('cmpSizeA').textContent = `${comp.datasetA.sizeMb} MB`;
  document.getElementById('cmpSizeB').textContent = `${comp.datasetB.sizeMb} MB`;
  document.getElementById('cmpSizeDiff').textContent = `${sizeSign}${comp.metricsDiff.sizeDiff} MB (${sizeSign}${comp.metricsDiff.sizeDiffPct}%)`;

  document.getElementById('cmpQualA').textContent = `${comp.datasetA.qualityScore}%`;
  document.getElementById('cmpQualB').textContent = `${comp.datasetB.qualityScore}%`;
  document.getElementById('cmpQualDiff').textContent = `Delta calidad: ${comp.metricsDiff.qualityDiff > 0 ? '+' : ''}${comp.metricsDiff.qualityDiff}%`;

  document.getElementById('cmpNullsA').textContent = `${comp.datasetA.nullPercentage}%`;
  document.getElementById('cmpNullsB').textContent = `${comp.datasetB.nullPercentage}%`;
  document.getElementById('cmpNullsDiff').textContent = `Delta nulos: ${comp.metricsDiff.nullsDiff > 0 ? '+' : ''}${comp.metricsDiff.nullsDiff}%`;

  // 3. Schema Diff
  const similarityBadge = document.getElementById('schemaSimilarityBadge');
  if (similarityBadge) similarityBadge.textContent = `${comp.schemaDiff.similarityPct}% Similitud Estructural`;

  document.getElementById('countSharedCols').textContent = comp.schemaDiff.totalCommon;
  document.getElementById('countUniqueA').textContent = comp.schemaDiff.totalUniqueA;
  document.getElementById('countUniqueB').textContent = comp.schemaDiff.totalUniqueB;

  const sharedCloud = document.getElementById('schemaSharedCols');
  const uniqueACloud = document.getElementById('schemaUniqueACols');
  const uniqueBCloud = document.getElementById('schemaUniqueBCols');

  if (sharedCloud) {
    sharedCloud.innerHTML = comp.schemaDiff.commonColumns.map(c => `
      <span class="schema-col-chip shared">
        ✓ ${c.name} <span class="col-type-tag">${c.typeA}</span>
      </span>
    `).join('') || '<span style="font-size:0.75rem; color:var(--text-dim);">Sin columnas compartidas</span>';
  }

  if (uniqueACloud) {
    uniqueACloud.innerHTML = comp.schemaDiff.uniqueToA.map(c => `
      <span class="schema-col-chip unique-a">
        - ${c.name} <span class="col-type-tag">${c.type}</span>
      </span>
    `).join('') || '<span style="font-size:0.75rem; color:var(--text-dim); font-style:italic;">Ninguna (Todas en B)</span>';
  }

  if (uniqueBCloud) {
    uniqueBCloud.innerHTML = comp.schemaDiff.uniqueToB.map(c => `
      <span class="schema-col-chip unique-b">
        + ${c.name} <span class="col-type-tag">${c.type}</span>
      </span>
    `).join('') || '<span style="font-size:0.75rem; color:var(--text-dim); font-style:italic;">Ninguna (Sin columnas nuevas)</span>';
  }

  // 4. Data Drift Table
  const driftTbody = document.getElementById('driftTableBody');
  if (driftTbody) {
    if (drift.driftMetrics.length === 0) {
      driftTbody.innerHTML = '<tr><td colspan="5" class="empty-state-card">No se detectaron columnas numéricas continuas para cálculo de Data Drift.</td></tr>';
    } else {
      driftTbody.innerHTML = drift.driftMetrics.map(m => {
        const sign = m.changePct >= 0 ? '+' : '';
        const badgeColor = m.alertClass === 'red' ? 'red' : (m.alertClass === 'yellow' ? 'yellow' : 'green');
        return `
          <tr>
            <td><strong>${m.column}</strong></td>
            <td>${m.meanA !== undefined ? m.meanA.toFixed(2) : '-'}</td>
            <td><strong>${m.meanB !== undefined ? m.meanB.toFixed(2) : '-'}</strong></td>
            <td><strong style="color:var(--text-main);">${sign}${m.changePct}%</strong></td>
            <td>
              <span class="drift-level-badge ${badgeColor}" style="padding:2px 8px; font-size:0.75rem;">
                ● ${m.status}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 5. Muestra Lado a Lado
  renderSamplePreview('sampleDataA', 'previewTitleA', comp.datasetA);
  renderSamplePreview('sampleDataB', 'previewTitleB', comp.datasetB);
}

function renderSamplePreview(containerId, titleId, dataset) {
  const container = document.getElementById(containerId);
  const title = document.getElementById(titleId);

  if (title) title.textContent = `${dataset.name} (${dataset.format})`;
  if (!container) return;

  const rows = dataset.sampleData || [];
  if (rows.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:1rem;">Sin filas de muestra disponibles</div>';
    return;
  }

  const cols = Object.keys(rows[0]);
  container.innerHTML = `
    <table class="crm-table" style="font-size:0.75rem;">
      <thead>
        <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>${cols.map(c => `<td>${r[c] !== undefined ? r[c] : ''}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function downloadComparisonReport() {
  if (!state.currentComparison) {
    showToast('Ejecuta una comparación primero.', 'warning');
    return;
  }

  const blob = new Blob([JSON.stringify(state.currentComparison, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `datanova_diff_report_${state.currentComparison.datasetA.id}_vs_${state.currentComparison.datasetB.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Reporte comparativo descargado exitosamente.', 'success');
}

// ============================================================================
// 9. CLIENTES CRM, DEALS, AUDITORÍA & PERFIL
// ============================================================================
async function loadClients() {
  try {
    const url = state.activeFilter && state.activeFilter !== 'Todos'
      ? `${API_BASE}/crm/clients?status=${encodeURIComponent(state.activeFilter)}`
      : `${API_BASE}/crm/clients`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.clients) {
      state.clients = data.clients;
      renderClientsTable(data.clients);
    }
  } catch (err) {
    console.error('Error al cargar clientes:', err);
  }
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clientsTableBody');
  if (!tbody) return;

  if (clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state-card">No hay clientes registrados en esta categoría.</td></tr>';
    return;
  }

  tbody.innerHTML = clients.map(client => {
    const initials = client.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const statusClass = (client.status || 'lead').toLowerCase().replace('ó', 'o');

    return `
      <tr>
        <td>
          <div class="client-cell">
            <div class="client-avatar-chip">${initials}</div>
            <div>
              <div class="client-name-bold">${client.name}</div>
              <div class="client-notes-small">${client.notes || 'Sin observaciones'}</div>
            </div>
          </div>
        </td>
        <td><strong>${client.company || 'Independiente'}</strong></td>
        <td>
          <div>${client.phone || 'Sin teléfono'}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">${client.email || 'Sin correo'}</div>
        </td>
        <td>
          <span class="status-tag ${statusClass}">● ${client.status || 'Lead'}</span>
        </td>
        <td>
          <strong style="color:var(--text-main); font-size:0.95rem;">${formatCurrency(client.value)}</strong>
        </td>
        <td>
          <div class="action-btns-row">
            <button class="btn-table-action" onclick="editClient('${client.id}')" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-table-action delete" onclick="deleteClient('${client.id}', '${client.name}')" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.editClient = function(id) {
  const client = state.clients.find(c => c.id === id);
  if (!client) return;

  document.getElementById('clientModalTitle').textContent = 'Editar Información del Cliente';
  document.getElementById('clientIdInput').value = client.id;
  document.getElementById('clientNameInput').value = client.name || '';
  document.getElementById('clientCompanyInput').value = client.company || '';
  document.getElementById('clientEmailInput').value = client.email || '';
  document.getElementById('clientPhoneInput').value = client.phone || '';
  document.getElementById('clientStatusInput').value = client.status || 'Lead';
  document.getElementById('clientValueInput').value = client.value || 0;
  document.getElementById('clientNotesInput').value = client.notes || '';

  openModal('clientModal');
};

window.deleteClient = async function(id, name) {
  if (!confirm(`¿Confirmas la eliminación del cliente "${name}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/crm/clients/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Cliente "${name}" eliminado.`, 'info');
      await loadClients();
      await loadStats();
    }
  } catch (err) {
    showToast('Error al eliminar cliente', 'error');
  }
};

async function handleSaveClient(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('clientIdInput').value;
  const name = document.getElementById('clientNameInput').value.trim();
  const company = document.getElementById('clientCompanyInput').value.trim();
  const email = document.getElementById('clientEmailInput').value.trim();
  const phone = document.getElementById('clientPhoneInput').value.trim();
  const status = document.getElementById('clientStatusInput').value;
  const value = parseFloat(document.getElementById('clientValueInput').value) || 0;
  const notes = document.getElementById('clientNotesInput').value.trim();

  if (!name) {
    showToast('El nombre del cliente es obligatorio.', 'warning');
    return;
  }

  const payload = { name, company, email, phone, status, value, notes };

  try {
    const url = id ? `${API_BASE}/crm/clients/${id}` : `${API_BASE}/crm/clients`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(id ? 'Cliente actualizado.' : 'Cliente agregado a la cartera.', 'success');
      closeModal('clientModal');
      await loadClients();
      await loadStats();
    }
  } catch (err) {
    showToast('Error al guardar cliente', 'error');
  }
}

function exportClientsToCsv() {
  if (!state.clients || state.clients.length === 0) {
    showToast('No hay clientes para exportar.', 'warning');
    return;
  }

  const headers = ['ID', 'Nombre', 'Empresa', 'Email', 'Telefono', 'Estado', 'Valor_USD', 'Notas', 'Fecha_Registro'];
  const rows = state.clients.map(c => [
    `"${c.id}"`,
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${(c.company || '').replace(/"/g, '""')}"`,
    `"${c.email || ''}"`,
    `"${c.phone || ''}"`,
    `"${c.status || ''}"`,
    c.value || 0,
    `"${(c.notes || '').replace(/"/g, '""')}"`,
    `"${c.createdAt || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes_datanova_crm_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo CSV descargado correctamente.', 'success');
}

async function loadDeals() {
  try {
    const res = await fetch(`${API_BASE}/crm/deals`);
    const data = await res.json();
    if (data.success && data.deals) {
      state.deals = data.deals;
      renderKanbanBoard(data.deals);
    }
  } catch (err) {
    console.error('Error al cargar deals:', err);
  }
}

function renderKanbanBoard(deals) {
  const stages = ['Prospecto', 'Contactado', 'Propuesta', 'Negociación', 'Ganado'];
  const colMap = {
    Prospecto: { container: 'colCardsProspect', count: 'colCountProspect', next: 'Contactado' },
    Contactado: { container: 'colCardsContact', count: 'colCountContact', next: 'Propuesta' },
    Propuesta: { container: 'colCardsProp', count: 'colCountProp', next: 'Negociación' },
    Negociación: { container: 'colCardsNeg', count: 'colCountNeg', next: 'Ganado' },
    Ganado: { container: 'colCardsWon', count: 'colCountWon', next: null }
  };

  stages.forEach(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    const colInfo = colMap[stage];
    const container = document.getElementById(colInfo.container);
    const countElem = document.getElementById(colInfo.count);

    if (countElem) countElem.textContent = stageDeals.length;
    if (!container) return;

    if (stageDeals.length === 0) {
      container.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-dim); font-size:0.75rem;">Sin oportunidades</div>';
      return;
    }

    container.innerHTML = stageDeals.map(d => {
      const nextBtn = colInfo.next ? `
        <button class="btn-move-stage" onclick="moveDealStage('${d.id}', '${colInfo.next}')" title="Avanzar a ${colInfo.next}">
          <span>Mover a ${colInfo.next}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      ` : '<span style="font-size:0.75rem; color:#34d399; font-weight:600;">✓ Cerrado</span>';

      return `
        <div class="deal-card">
          <div class="deal-card-title">${d.title}</div>
          <div class="deal-client-name">👤 ${d.clientName || 'Cliente Prospecto'}</div>
          <div class="deal-bottom-row">
            <span class="deal-amount">${formatCurrency(d.amount)}</span>
            ${nextBtn}
          </div>
        </div>
      `;
    }).join('');
  });
}

window.moveDealStage = async function(dealId, newStage) {
  try {
    const res = await fetch(`${API_BASE}/crm/deals/${dealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });
    if (res.ok) {
      showToast(`Oportunidad movida a "${newStage}"`, 'success');
      await loadDeals();
      await loadStats();
    }
  } catch (err) {
    showToast('Error al actualizar deal', 'error');
  }
};

async function handleSaveDeal(e) {
  if (e) e.preventDefault();
  const title = document.getElementById('dealTitleInput').value.trim();
  const selectClient = document.getElementById('dealClientSelect');
  const amount = parseFloat(document.getElementById('dealAmountInput').value) || 0;
  const stage = document.getElementById('dealStageInput').value;
  const expectedClose = document.getElementById('dealCloseDateInput').value;

  if (!title) {
    showToast('El título del deal es obligatorio.', 'warning');
    return;
  }

  const clientId = selectClient ? selectClient.value : '';
  const clientName = selectClient && selectClient.selectedOptions[0] ? selectClient.selectedOptions[0].text : 'Prospecto General';

  try {
    const res = await fetch(`${API_BASE}/crm/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, clientId, clientName, amount, stage, expectedClose })
    });

    if (res.ok) {
      showToast('Oportunidad creada en el Pipeline.', 'success');
      closeModal('dealModal');
      await loadDeals();
      await loadStats();
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

async function loadLogs() {
  try {
    const res = await fetch(`${API_BASE}/crm/logs?limit=15`);
    const data = await res.json();
    if (data.success && data.logs) {
      state.logs = data.logs;
      renderActivityFeed(data.logs);
      renderAuthAuditTable(data.logs);
    }
  } catch (err) {
    console.error('Error al cargar logs:', err);
  }
}

function renderActivityFeed(logs) {
  const container = document.getElementById('activityFeedList');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<div class="empty-state-card">No hay registros de actividad recientes.</div>';
    return;
  }

  container.innerHTML = logs.map(l => {
    let iconClass = 'system';
    let iconSvg = '<circle cx="12" cy="12" r="10"/>';

    if (l.type.includes('face')) {
      iconClass = 'face';
      iconSvg = '<path d="M12 2a5 5 0 0 0-5 5v1a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/>';
    } else if (l.type.includes('auth')) {
      iconClass = 'auth';
      iconSvg = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
    } else if (l.type.includes('client')) {
      iconClass = 'client';
      iconSvg = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>';
    } else if (l.type.includes('bigdata')) {
      iconClass = 'face';
      iconSvg = '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>';
    }

    return `
      <div class="activity-item">
        <div class="act-icon ${iconClass}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvg}</svg>
        </div>
        <div class="act-body">
          <div class="act-desc">${l.description}</div>
          <div class="act-detail">${l.details || l.userName || l.userId}</div>
        </div>
        <div class="act-time">${formatDate(l.timestamp)}</div>
      </div>
    `;
  }).join('');
}

function renderAuthAuditTable(logs) {
  const tbody = document.getElementById('authAuditTableBody');
  if (!tbody) return;

  const authLogs = logs.filter(l => l.type.includes('auth') || l.type.includes('face'));

  if (authLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state-card">Sin registros de autenticación aún.</td></tr>';
    return;
  }

  tbody.innerHTML = authLogs.map(l => {
    const isFace = l.type.includes('face');
    const isSuccess = !l.type.includes('rejected') && !l.type.includes('failed');

    const badge = isFace 
      ? `<span class="status-tag propuesta">👁️ Reconocimiento Facial</span>`
      : `<span class="status-tag contactado">🔑 Contraseña Normal</span>`;

    const statusResult = isSuccess 
      ? `<span style="color:var(--emerald); font-weight:600;">✓ Acceso Permitido</span>`
      : `<span style="color:var(--rose); font-weight:600;">✗ Acceso Denegado</span>`;

    return `
      <tr>
        <td>${badge}</td>
        <td>
          <strong>${l.userName || l.userId}</strong>
          <div style="font-size:0.75rem; color:var(--text-dim);">${l.userId}</div>
        </td>
        <td>
          <div>${l.details || l.description}</div>
          <div>${statusResult}</div>
        </td>
        <td><span style="font-family:monospace; font-size:0.8rem;">${l.ip || '127.0.0.1'}</span></td>
        <td>${formatDate(l.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

async function loadBiometricsData() {
  const listContainer = document.getElementById('facialUsersList');
  if (!listContainer) return;

  try {
    const res = await fetch(`${API_BASE}/face/profiles`);
    const data = await res.json();
    if (data.success && data.profiles) {
      if (data.profiles.length === 0) {
        listContainer.innerHTML = '<div class="empty-state-card">No hay perfiles faciales registrados. Haz clic en "Re-escanear y Actualizar Mi Rostro" para registrar el tuyo.</div>';
        return;
      }

      listContainer.innerHTML = data.profiles.map(p => `
        <div class="facial-user-row">
          <div class="facial-user-info">
            <div class="logo-icon-sm" style="width:32px;height:32px;background:rgba(6,182,212,0.2);color:#38bdf8;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div>
              <div class="bio-id-text">${p.userId}</div>
              <div class="bio-date-sub">Registrado: ${formatDate(p.registeredAt)}</div>
            </div>
          </div>
          <button class="btn-table-action delete" onclick="deleteFaceProfile('${p.userId}')" title="Eliminar biometría">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error al cargar perfiles faciales:', err);
  }
}

window.deleteFaceProfile = async function(userId) {
  if (!confirm(`¿Eliminar perfil biométrico de ${userId}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/face/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Perfil biométrico eliminado.`, 'info');
      if (state.currentUser && (state.currentUser.email === userId || state.currentUser.userId === userId)) {
        state.currentUser.hasFacialProfile = false;
        sessionStorage.setItem('datanova_user', JSON.stringify(state.currentUser));
        updateUserInterface(state.currentUser);
      }
      loadBiometricsData();
      loadStats();
    }
  } catch (err) {
    showToast('Error al eliminar perfil biométrico', 'error');
  }
};

async function loadHealthInfo() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.database) {
      const modeElem = document.getElementById('cfgDbMode');
      const statusElem = document.getElementById('cfgDbStatus');
      if (modeElem) modeElem.textContent = data.database.storageDescription;
      if (statusElem) statusElem.textContent = '● Operativo y Sincronizado';
    }
  } catch (e) {}
}

function updateUserInterface(user) {
  if (!user) return;

  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarRole = document.getElementById('sidebarUserRole');
  const sidebarAvatar = document.getElementById('sidebarUserAvatar');

  if (sidebarName) sidebarName.textContent = user.name || user.email;
  if (sidebarRole) sidebarRole.textContent = user.role || 'Usuario';
  if (sidebarAvatar && user.avatar) sidebarAvatar.src = user.avatar;

  const bioName = document.getElementById('bioUserFullName');
  const bioEmail = document.getElementById('bioUserEmail');
  const bioBadge = document.getElementById('currentUserBioBadge');
  const bioTag = document.getElementById('bioStatusTag');
  const bioRing = document.getElementById('bioRingPulse');
  const navIndicator = document.getElementById('navBiometricsIndicator');

  if (bioName) bioName.textContent = user.name || user.email;
  if (bioEmail) bioEmail.textContent = user.email || user.userId;

  if (user.hasFacialProfile) {
    if (bioBadge) {
      bioBadge.textContent = '✓ Biometría Activa';
      bioBadge.className = 'badge-bio-status enrolled';
    }
    if (bioTag) {
      bioTag.textContent = '✓ Enrolamiento Facial Activo';
      bioTag.className = 'tag-chip active';
    }
    if (bioRing) bioRing.style.display = 'block';
    if (navIndicator) navIndicator.className = 'status-dot-sm success';
  } else {
    if (bioBadge) {
      bioBadge.textContent = 'Sin Enrolamiento Facial';
      bioBadge.className = 'badge-bio-status';
    }
    if (bioTag) {
      bioTag.textContent = '⚠️ Rostro No Vinculado';
      bioTag.className = 'tag-chip';
    }
    if (bioRing) bioRing.style.display = 'none';
    if (navIndicator) navIndicator.className = 'status-dot-sm';
  }
}

// ============================================================================
// 10. SPA ROUTER (CONTROLADOR DE PESTAÑAS Y VISTAS)
// ============================================================================
function switchCrmView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll('.crm-sidebar .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`view${capitalize(viewName)}`);
  if (targetPanel) targetPanel.classList.add('active');

  const titleElem = document.getElementById('viewTitle');
  const subElem = document.getElementById('viewSubtitle');

  const titles = {
    dashboard: { title: 'Dashboard General & KPIs', sub: 'Métricas comerciales y volumen Big Data' },
    clients: { title: 'Gestión de Clientes & Leads', sub: 'Cartera comercial, seguimiento y prospección' },
    deals: { title: 'Pipeline Comercial (Deals)', sub: 'Flujo del embudo de ventas y oportunidades' },
    repositories: { title: 'Repositorios Big Data & Data Lakes', sub: 'Gestión de almacenamiento distribuido AWS S3 & Delta Lake' },
    compare: { title: 'Comparador de Datasets (Diff & Drift)', sub: 'Análisis de diferencias de esquemas, deltas volumétricos y deriva estadística' },
    biometrics: { title: 'Seguridad & Biometría Facial', sub: 'Perfiles de visión artificial y registro de accesos' },
    settings: { title: 'Configuración & Nube AWS', sub: 'Ajustes de infraestructura, base de datos y parámetros' }
  };

  if (titleElem && titles[viewName]) titleElem.textContent = titles[viewName].title;
  if (subElem && titles[viewName]) subElem.textContent = titles[viewName].sub;

  if (viewName === 'repositories') {
    loadRepositories();
    loadDatasets(state.activeRepoFilter);
  } else if (viewName === 'compare') {
    populateCompareDropdowns(state.datasets);
    if (!state.currentComparison && state.datasets.length >= 2) {
      executeComparison();
    }
  } else if (viewName === 'biometrics') {
    loadBiometricsData();
  } else if (viewName === 'deals') {
    loadDeals();
  } else if (viewName === 'clients') {
    loadClients();
  } else if (viewName === 'dashboard') {
    loadStats();
    loadLogs();
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// 11. MODALES AUXILIARES
// ============================================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'flex';

  if (modalId === 'faceEnrollModal') {
    startModalCamera();
    if (state.currentUser) {
      const userField = document.getElementById('enrollUserIdInput');
      const nameField = document.getElementById('enrollUserNameInput');
      if (userField) userField.value = state.currentUser.email || state.currentUser.userId;
      if (nameField) nameField.value = state.currentUser.name || '';
    }
  } else if (modalId === 'dealModal') {
    const select = document.getElementById('dealClientSelect');
    if (select) {
      select.innerHTML = state.clients.map(c => `
        <option value="${c.id}">${c.name} (${c.company || 'Sin Empresa'})</option>
      `).join('') || '<option value="">Sin clientes disponibles</option>';
    }
  } else if (modalId === 'datasetModal') {
    populateRepositorySelects(state.repositories);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// ============================================================================
// 12. INICIALIZACIÓN DE EVENTOS Y ARRANQUE
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {

  // 1. Selector de Tabs en Login (Normal vs Facial)
  const tabNormalBtn = document.getElementById('tabNormalBtn');
  const tabFaceBtn = document.getElementById('tabFaceBtn');
  const panelNormal = document.getElementById('panelNormalAuth');
  const panelFace = document.getElementById('panelFaceAuth');

  if (tabNormalBtn && tabFaceBtn) {
    tabNormalBtn.addEventListener('click', () => {
      tabNormalBtn.classList.add('active');
      tabFaceBtn.classList.remove('active');
      panelNormal.classList.add('active');
      panelFace.classList.remove('active');
    });

    tabFaceBtn.addEventListener('click', () => {
      tabFaceBtn.classList.add('active');
      tabNormalBtn.classList.remove('active');
      panelFace.classList.add('active');
      panelNormal.classList.remove('active');
    });
  }

  // 2. Toggle Visibilidad de Contraseña
  const togglePassBtn = document.getElementById('togglePasswordBtn');
  const passInput = document.getElementById('loginPassword');
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassBtn.innerHTML = isPass 
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  }



  // 4. Formulario de Login Normal
  const formNormal = document.getElementById('formNormalLogin');
  if (formNormal) formNormal.addEventListener('submit', handleNormalLogin);

  // 5. Botón de Escaneo Facial
  const scanBtn = document.getElementById('scanAndLoginBtn');
  if (scanBtn) scanBtn.addEventListener('click', handleFaceLogin);

  // 6. Botones de Modal de Enrolamiento Facial
  const openFaceEnrollBtn = document.getElementById('openFaceRegisterModalBtn');
  if (openFaceEnrollBtn) openFaceEnrollBtn.addEventListener('click', () => openModal('faceEnrollModal'));
  
  const closeEnrollBtn = document.getElementById('closeFaceEnrollModalBtn');
  if (closeEnrollBtn) closeEnrollBtn.addEventListener('click', () => closeModal('faceEnrollModal'));
  
  const cancelEnrollBtn = document.getElementById('cancelEnrollModalBtn');
  if (cancelEnrollBtn) cancelEnrollBtn.addEventListener('click', () => closeModal('faceEnrollModal'));

  const captureEnrollBtn = document.getElementById('captureAndEnrollBtn');
  if (captureEnrollBtn) captureEnrollBtn.addEventListener('click', handleCaptureAndEnroll);

  const reEnrollBtn = document.getElementById('reEnrollFaceBtn');
  if (reEnrollBtn) reEnrollBtn.addEventListener('click', () => openModal('faceEnrollModal'));

  const deleteFaceBtn = document.getElementById('deleteFaceBtn');
  if (deleteFaceBtn) {
    deleteFaceBtn.addEventListener('click', () => {
      if (state.currentUser) deleteFaceProfile(state.currentUser.email || state.currentUser.userId);
    });
  }

  // 7. Modal de Registro de Usuario
  const openRegModalBtn = document.getElementById('openRegisterModalBtn');
  if (openRegModalBtn) openRegModalBtn.addEventListener('click', () => openModal('registerModal'));

  const closeRegBtn = document.getElementById('closeRegisterModalBtn');
  if (closeRegBtn) closeRegBtn.addEventListener('click', () => closeModal('registerModal'));

  const cancelRegBtn = document.getElementById('cancelRegisterModalBtn');
  if (cancelRegBtn) cancelRegBtn.addEventListener('click', () => closeModal('registerModal'));

  const formRegister = document.getElementById('formRegisterAccount');
  if (formRegister) {
    formRegister.addEventListener('submit', async () => {
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const role = document.getElementById('regRole').value;
      const password = document.getElementById('regPassword').value;

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, role, password })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`¡Usuario ${name} registrado con éxito!`, 'success');
          closeModal('registerModal');
          loginSuccess(data.user);
        } else {
          showToast(data.error || 'Error al crear usuario', 'error');
        }
      } catch (e) {
        showToast('Error de conexión', 'error');
      }
    });
  }

  // 8. Navegación en Sidebar
  document.querySelectorAll('.crm-sidebar .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) switchCrmView(view);
    });
  });

  // 9. Cerrar Sesión
  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // 10. Clientes CRM
  const openNewClientBtn = document.getElementById('topbarNewClientBtn');
  const openNewClientBtn2 = document.getElementById('openNewClientModalBtn');
  if (openNewClientBtn) openNewClientBtn.addEventListener('click', () => {
    document.getElementById('clientModalTitle').textContent = 'Agregar Nuevo Cliente';
    document.getElementById('clientIdInput').value = '';
    document.getElementById('formClient').reset();
    openModal('clientModal');
  });
  if (openNewClientBtn2) openNewClientBtn2.addEventListener('click', () => {
    document.getElementById('clientModalTitle').textContent = 'Agregar Nuevo Cliente';
    document.getElementById('clientIdInput').value = '';
    document.getElementById('formClient').reset();
    openModal('clientModal');
  });

  const closeClientBtn = document.getElementById('closeClientModalBtn');
  if (closeClientBtn) closeClientBtn.addEventListener('click', () => closeModal('clientModal'));
  const cancelClientBtn = document.getElementById('cancelClientModalBtn');
  if (cancelClientBtn) cancelClientBtn.addEventListener('click', () => closeModal('clientModal'));

  const formClient = document.getElementById('formClient');
  if (formClient) formClient.addEventListener('submit', handleSaveClient);

  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.getAttribute('data-status');
      loadClients();
    });
  });

  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (state.activeView === 'clients') {
        const filtered = state.clients.filter(c => 
          (c.name && c.name.toLowerCase().includes(query)) ||
          (c.company && c.company.toLowerCase().includes(query)) ||
          (c.email && c.email.toLowerCase().includes(query))
        );
        renderClientsTable(filtered);
      }
    });
  }

  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportClientsToCsv);

  // 11. Deals Kanban
  const openNewDealBtn = document.getElementById('openNewDealModalBtn');
  if (openNewDealBtn) openNewDealBtn.addEventListener('click', () => {
    document.getElementById('formDeal').reset();
    openModal('dealModal');
  });
  const closeDealBtn = document.getElementById('closeDealModalBtn');
  if (closeDealBtn) closeDealBtn.addEventListener('click', () => closeModal('dealModal'));
  const cancelDealBtn = document.getElementById('cancelDealModalBtn');
  if (cancelDealBtn) cancelDealBtn.addEventListener('click', () => closeModal('dealModal'));

  const formDeal = document.getElementById('formDeal');
  if (formDeal) formDeal.addEventListener('submit', handleSaveDeal);

  // 12. Repositorios Big Data
  const openNewRepoBtn = document.getElementById('openNewRepoModalBtn');
  if (openNewRepoBtn) openNewRepoBtn.addEventListener('click', () => {
    document.getElementById('formRepo').reset();
    openModal('repoModal');
  });
  const closeRepoBtn = document.getElementById('closeRepoModalBtn');
  if (closeRepoBtn) closeRepoBtn.addEventListener('click', () => closeModal('repoModal'));
  const cancelRepoBtn = document.getElementById('cancelRepoModalBtn');
  if (cancelRepoBtn) cancelRepoBtn.addEventListener('click', () => closeModal('repoModal'));

  const formRepo = document.getElementById('formRepo');
  if (formRepo) formRepo.addEventListener('submit', handleSaveRepo);

  // 13. Datasets Big Data
  const openNewDatasetBtn = document.getElementById('openNewDatasetModalBtn');
  if (openNewDatasetBtn) openNewDatasetBtn.addEventListener('click', () => {
    document.getElementById('formDataset').reset();
    openModal('datasetModal');
  });
  const closeDatasetBtn = document.getElementById('closeDatasetModalBtn');
  if (closeDatasetBtn) closeDatasetBtn.addEventListener('click', () => closeModal('datasetModal'));
  const cancelDatasetBtn = document.getElementById('cancelDatasetModalBtn');
  if (cancelDatasetBtn) cancelDatasetBtn.addEventListener('click', () => closeModal('datasetModal'));

  const formDataset = document.getElementById('formDataset');
  if (formDataset) formDataset.addEventListener('submit', handleSaveDataset);

  const filterRepoSelect = document.getElementById('repoFilterSelect');
  if (filterRepoSelect) {
    filterRepoSelect.addEventListener('change', (e) => {
      state.activeRepoFilter = e.target.value;
      loadDatasets(e.target.value);
    });
  }

  // 14. Detalle de Dataset
  const closeDetailDatasetBtn = document.getElementById('closeDetailDatasetModalBtn');
  if (closeDetailDatasetBtn) closeDetailDatasetBtn.addEventListener('click', () => closeModal('datasetDetailModal'));
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => closeModal('datasetDetailModal'));

  // 15. Comparador de Datasets
  const executeCompareBtn = document.getElementById('executeCompareBtn');
  if (executeCompareBtn) executeCompareBtn.addEventListener('click', executeComparison);

  const jumpToCompareBtn = document.getElementById('jumpToCompareBtn');
  if (jumpToCompareBtn) jumpToCompareBtn.addEventListener('click', () => switchCrmView('compare'));

  const downloadReportBtn = document.getElementById('downloadCompareReportBtn');
  if (downloadReportBtn) downloadReportBtn.addEventListener('click', downloadComparisonReport);

  const presetTransBtn = document.getElementById('presetCompareTrans');
  if (presetTransBtn) {
    presetTransBtn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset-chip').forEach(p => p.classList.remove('active'));
      presetTransBtn.classList.add('active');
      const selectA = document.getElementById('selectDatasetA');
      const selectB = document.getElementById('selectDatasetB');
      if (selectA) selectA.value = 'ds_trans_q1';
      if (selectB) selectB.value = 'ds_trans_q2';
      executeComparison();
    });
  }

  const presetCloudBtn = document.getElementById('presetCompareCloud');
  if (presetCloudBtn) {
    presetCloudBtn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset-chip').forEach(p => p.classList.remove('active'));
      presetCloudBtn.classList.add('active');
      const selectA = document.getElementById('selectDatasetA');
      const selectB = document.getElementById('selectDatasetB');
      if (selectA) selectA.value = 'ds_cloud_cluster_a';
      if (selectB) selectB.value = 'ds_cloud_cluster_b';
      executeComparison();
    });
  }

  // 16. Logs & Settings
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', () => {
    loadLogs();
    showToast('Auditoría de actividad actualizada.', 'info');
  });

  const slider = document.getElementById('thresholdSlider');
  const display = document.getElementById('thresholdValDisplay');
  if (slider && display) {
    slider.value = state.facialThreshold;
    display.textContent = `${state.facialThreshold} (Actual)`;

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.facialThreshold = val;
      localStorage.setItem('datanova_threshold', val.toString());
      display.textContent = `${val.toFixed(2)} (${val <= 0.45 ? 'Muy Estricto' : (val >= 0.60 ? 'Tolerante' : 'Recomendado')})`;
    });
  }

  const backupBtn = document.getElementById('backupDataBtn');
  if (backupBtn) {
    backupBtn.addEventListener('click', async () => {
      try {
        const stats = await (await fetch(`${API_BASE}/crm/stats`)).json();
        const clients = await (await fetch(`${API_BASE}/crm/clients`)).json();
        const deals = await (await fetch(`${API_BASE}/crm/deals`)).json();
        const repos = await (await fetch(`${API_BASE}/bigdata/repositories`)).json();
        const datasets = await (await fetch(`${API_BASE}/bigdata/datasets`)).json();
        const logs = await (await fetch(`${API_BASE}/crm/logs?limit=50`)).json();

        const fullBackup = {
          exportDate: new Date().toISOString(),
          version: '2.0.0',
          stats,
          clients: clients.clients || [],
          deals: deals.deals || [],
          repositories: repos.repositories || [],
          datasets: datasets.datasets || [],
          logs: logs.logs || []
        };

        const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datanova_bigdata_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Copia de seguridad descargada exitosamente.', 'success');
      } catch (e) {
        showToast('Error al exportar datos.', 'error');
      }
    });
  }

  // 17. Verificar sesión activa
  const savedUser = sessionStorage.getItem('datanova_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      loginSuccess(user);
    } catch (e) {
      sessionStorage.removeItem('datanova_user');
    }
  }

  initFaceApiModels();
});

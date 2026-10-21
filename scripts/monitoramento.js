/* ==========================================================================
   ECOLLTRUCK - MONITORAMENTO COM MAPA INTERATIVO GPS EM TEMPO REAL
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const onlineTrucksMetric = document.getElementById('onlineTrucksMetric');
  const onlineTrucksHint = document.getElementById('onlineTrucksHint');
  const activeRoutesMetric = document.getElementById('activeRoutesMetric');
  const activeRoutesHint = document.getElementById('activeRoutesHint');
  const alertsMetric = document.getElementById('alertsMetric');
  const alertsHint = document.getElementById('alertsHint');

  const operatorTruckList = document.getElementById('operatorTruckList');
  const emptyOperatorListState = document.getElementById('emptyOperatorListState');

  const sensorReadingTable = document.getElementById('sensorReadingTable');
  const emptySensorReadingState = document.getElementById('emptySensorReadingState');

  const monitorAlertList = document.getElementById('monitorAlertList');

  let trucks = [];
  let routes = [];
  let latestReadings = {};

  // Dicionário para armazenar as instâncias de marcadores Leaflet por ID do caminhão
  let mapInstance = null;
  const truckMarkers = {};

  // Coordenadas padrão de Feira de Santana - BA
  const FEIRA_DE_SANTANA_COORDS = [-12.2577, -38.9595];

  // 1. INICIALIZAR O MAPA INTERATIVO LEAFLET (PROVEDOR ESRI / ARCGIS - 100% LIVRE E SEM BLOQUEIO 403)
  function initMap() {
    if (typeof L === 'undefined') {
      console.error('Biblioteca Leaflet não carregada.');
      return;
    }

    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // Cria o mapa centrado em Feira de Santana
    mapInstance = L.map('mapContainer', {
      center: FEIRA_DE_SANTANA_COORDS,
      zoom: 13,
      zoomControl: true
    });

    // Camada Esri World Street Map (Não sofre com política de bloqueio 403 e é 100% gratuita)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
    }).addTo(mapInstance);
  }

  initMap();

  // 2. CARREGAR SERVIÇO DO FIREBASE
  async function getFirebaseService() {
    if (window.EcollTruckFirebase) return window.EcollTruckFirebase;
    if (window.EcollTruckFirebaseReady) return await window.EcollTruckFirebaseReady;
    return new Promise((resolve) => {
      window.addEventListener('ecolltruck:firebase-ready', () => {
        resolve(window.EcollTruckFirebase);
      }, { once: true });
    });
  }

  const fb = await getFirebaseService();

  if (fb && typeof fb.seedInitialDatabase === 'function') {
    fb.seedInitialDatabase().catch(console.error);
  }

  // 3. ESCUTAR ROTAS EM TEMPO REAL
  fb.subscribe('routes', (snapshot) => {
    routes = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        routes.push({ id, ...data[id] });
      });
    }
    updateAllViews();
  });

  // 4. ESCUTAR CAMINHÕES EM TEMPO REAL
  fb.subscribe('trucks', (snapshot) => {
    trucks = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        trucks.push({ id, ...data[id] });
      });
    }
    updateAllViews();
  });

  // 5. ESCUTAR LEITURAS DOS SENSORES GPS DO HARDWARE EM TEMPO REAL (latestReadings)
  fb.subscribe('latestReadings', (snapshot) => {
    latestReadings = {};
    if (snapshot && snapshot.exists()) {
      latestReadings = snapshot.val();
    }
    updateAllViews();
  });

  // 6. REFRESH DE TODA A PÁGINA EM TEMPO REAL
  function updateAllViews() {
    renderMetrics();
    updateLiveMapMarkers(); // Atualiza marcadores no mapa GPS
    renderTruckList();
    renderSensorTable();
    renderAlerts();
  }

  // A) ATUALIZAR MARCADORES DE GPS NO MAPA
  function updateLiveMapMarkers() {
    if (!mapInstance) return;

    // Mapeia posições para cálculo do enquadramento automático do mapa (Bounds)
    const activeCoords = [];

    trucks.forEach((t, index) => {
      const reading = latestReadings[t.id] || {};
      
      // Se o sensor enviar lat/long válidas, utiliza elas. Se não, gera pequena variação em Feira de Santana para testes
      let lat = parseFloat(reading.latitude);
      let lng = parseFloat(reading.longitude);

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        // Coordenadas simuladas espalhadas em Feira de Santana caso o GPS ainda não tenha enviado sinal
        lat = -12.2577 + (index * 0.008);
        lng = -38.9595 - (index * 0.006);
      }

      activeCoords.push([lat, lng]);

      const truckName = t.name || t.nome || t.id;
      const plate = t.plate || t.placa || 'ECL';
      const weight = reading.weightKg !== undefined ? `${reading.weightKg} kg` : '0 kg';

      let dotClass = 'truck-marker-dot';
      if (t.status === 'Atenção' || reading.sensorStatus === 'attention') dotClass = 'truck-marker-dot warning';
      if (t.status === 'Manutenção' || reading.sensorStatus === 'offline') dotClass = 'truck-marker-dot danger';

      // Ícone HTML personalizado para o mapa
      const customHtmlIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="truck-map-marker">
            <span class="${dotClass}"></span>
            <span>${escapeHtml(truckName)}</span>
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15]
      });

      // Se o marcador já existe no mapa, apenas ATUALIZA a posição com animação suave
      if (truckMarkers[t.id]) {
        truckMarkers[t.id].setLatLng([lat, lng]);
        truckMarkers[t.id].setIcon(customHtmlIcon);
        truckMarkers[t.id].setPopupContent(`
          <div style="font-family: sans-serif; font-size: 12px; color: #0f172a;">
            <strong>${escapeHtml(truckName)} (${escapeHtml(plate)})</strong><br>
            <span>Status: <b>${escapeHtml(t.status || 'Operacional')}</b></span><br>
            <span>Peso atual: <b>${escapeHtml(weight)}</b></span><br>
            <small style="color:#64748b;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</small>
          </div>
        `);
      } else {
        // Se ainda não existe, CRIA um novo marcador no mapa
        const marker = L.marker([lat, lng], { icon: customHtmlIcon }).addTo(mapInstance);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #0f172a;">
            <strong>${escapeHtml(truckName)} (${escapeHtml(plate)})</strong><br>
            <span>Status: <b>${escapeHtml(t.status || 'Operacional')}</b></span><br>
            <span>Peso atual: <b>${escapeHtml(weight)}</b></span><br>
            <small style="color:#64748b;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</small>
          </div>
        `);
        truckMarkers[t.id] = marker;
      }
    });

    // Centraliza o mapa suavemente enquadrando todos os caminhões ativos
    if (activeCoords.length > 0) {
      const bounds = L.latLngBounds(activeCoords);
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  // B) MÉTRICAS
  function renderMetrics() {
    const totalTrucksCount = trucks.length;
    const onlineTrucksCount = trucks.filter(t => t.status === 'Operacional' || t.status === 'Em rota').length;
    const pausedOrMaintCount = totalTrucksCount - onlineTrucksCount;

    if (onlineTrucksMetric) {
      onlineTrucksMetric.textContent = `${onlineTrucksCount}/${totalTrucksCount}`;
    }
    if (onlineTrucksHint) {
      onlineTrucksHint.textContent = `${pausedOrMaintCount} fora de operação`;
    }

    const activeRoutesCount = routes.filter(r => r.status === 'Em andamento' || r.status === 'Em rota').length;
    if (activeRoutesMetric) {
      activeRoutesMetric.textContent = activeRoutesCount;
    }
    if (activeRoutesHint) {
      activeRoutesHint.textContent = `${routes.length} rotas no total`;
    }

    let alertsCount = 0;
    trucks.forEach(t => {
      if (t.status === 'Atenção' || t.status === 'Manutenção') alertsCount++;
      const reading = latestReadings[t.id];
      if (reading && reading.sensorStatus === 'offline') alertsCount++;
    });

    if (alertsMetric) alertsMetric.textContent = alertsCount;
    if (alertsHint) alertsHint.textContent = alertsCount > 0 ? `${alertsCount} ocorrência(s) ativa(s)` : 'Operação normal';
  }

  // C) LISTA DE STATUS DOS CAMINHÕES (DIREITA DO MAPA)
  function renderTruckList() {
    if (!operatorTruckList) return;
    operatorTruckList.innerHTML = '';

    if (trucks.length === 0) {
      if (emptyOperatorListState) emptyOperatorListState.hidden = false;
      return;
    }

    if (emptyOperatorListState) emptyOperatorListState.hidden = true;

    trucks.forEach(t => {
      const reading = latestReadings[t.id] || {};
      const route = routes.find(r => r.id === t.currentRouteId) || {};
      const routeName = route.code || route.name || (t.currentRouteId ? t.currentRouteId : 'Garagem');
      const weight = reading.weightKg !== undefined ? `${reading.weightKg} kg` : '0 kg';

      let pillClass = 'badge active';
      if (t.status === 'Em rota') pillClass = 'badge route';
      if (t.status === 'Atenção' || t.status === 'Pausado') pillClass = 'badge warning';
      if (t.status === 'Manutenção') pillClass = 'badge danger';

      const itemEl = document.createElement('article');
      itemEl.className = 'operator-list-item';
      itemEl.innerHTML = `
        <div>
          <strong>${escapeHtml(t.name || t.id)} | ${escapeHtml(routeName)}</strong>
          <small>${escapeHtml(t.plate || 'ECL')} - ${weight} coletados</small>
        </div>
        <span class="${pillClass}">${escapeHtml(t.status || 'Operacional')}</span>
      `;
      operatorTruckList.appendChild(itemEl);
    });
  }

  // D) TABELA DE SENSORES
  function renderSensorTable() {
    if (!sensorReadingTable) return;
    sensorReadingTable.innerHTML = '';

    if (trucks.length === 0) {
      if (emptySensorReadingState) emptySensorReadingState.hidden = false;
      return;
    }

    if (emptySensorReadingState) emptySensorReadingState.hidden = true;

    trucks.forEach((t, idx) => {
      const reading = latestReadings[t.id] || {};
      const weight = reading.weightKg !== undefined ? `${reading.weightKg} kg` : '0 kg';
      const sensorStatus = reading.sensorStatus || (t.status === 'Operacional' || t.status === 'Em rota' ? 'online' : 'offline');
      const updatedAt = reading.updatedAt ? new Date(reading.updatedAt).toLocaleTimeString('pt-BR') : 'Sem dados';

      let lat = parseFloat(reading.latitude);
      let lng = parseFloat(reading.longitude);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        lat = -12.2577 + (idx * 0.008);
        lng = -38.9595 - (idx * 0.006);
      }

      let statusBadgeClass = 'badge online';
      if (sensorStatus === 'offline' || t.status === 'Manutenção') statusBadgeClass = 'badge offline';
      if (sensorStatus === 'attention' || t.status === 'Atenção') statusBadgeClass = 'badge warning';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(t.name || t.id)}</strong> (${escapeHtml(t.plate || 'ECL')})</td>
        <td><strong>${escapeHtml(weight)}</strong></td>
        <td><span class="${statusBadgeClass}">${escapeHtml(sensorStatus.toUpperCase())}</span></td>
        <td>${escapeHtml(updatedAt)}</td>
        <td><small style="color: var(--text-muted);">${lat.toFixed(4)}, ${lng.toFixed(4)}</small></td>
      `;
      sensorReadingTable.appendChild(tr);
    });
  }

  // E) FILA DE ALERTAS
  function renderAlerts() {
    if (!monitorAlertList) return;
    monitorAlertList.innerHTML = '';

    const alerts = [];

    trucks.forEach(t => {
      const reading = latestReadings[t.id] || {};

      if (reading.sensorStatus === 'offline') {
        alerts.push({
          type: 'danger',
          title: `${t.name || t.id} sem sinal GPS/sensor`,
          subtitle: 'verificar conexão do equipamento de telemetria'
        });
      }

      if (t.status === 'Atenção') {
        alerts.push({
          type: 'warning',
          title: `${t.name || t.id} em estado de Atenção`,
          subtitle: 'acompanhar rota e nível de carga'
        });
      }

      if (t.status === 'Manutenção') {
        alerts.push({
          type: 'danger',
          title: `${t.name || t.id} em manutenção`,
          subtitle: 'veículo desativado temporariamente'
        });
      }
    });

    if (alerts.length === 0) {
      monitorAlertList.innerHTML = `
        <article class="alert-item">
          <span class="alert-icon" style="background-color: var(--success-bg); color: var(--success-text);">✓</span>
          <div>
            <strong>Nenhum alerta crítico no momento</strong>
            <small>Todos os caminhões e sensores comunicando normalmente</small>
          </div>
        </article>
      `;
      return;
    }

    alerts.forEach(a => {
      const article = document.createElement('article');
      article.className = 'alert-item';
      article.innerHTML = `
        <span class="alert-icon ${a.type}">⚠️</span>
        <div>
          <strong>${escapeHtml(a.title)}</strong>
          <small>${escapeHtml(a.subtitle)}</small>
        </div>
      `;
      monitorAlertList.appendChild(article);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
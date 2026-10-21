/* ==========================================================================
   ECOLLTRUCK - NAVEGAÇÃO DE ROTAS E RASTREAMENTO GPS EM TEMPO REAL
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async function () {
  // Elementos do GPS
  const routeGpsStatus = document.getElementById("routeGpsStatus");
  const routeTruckSelect = document.getElementById("routeTruckSelect");
  const btnToggleRouteGps = document.getElementById("btnToggleRouteGps");

  // Elementos da Rota
  const btnConcluirParada = document.getElementById("concluirParadaBtn");
  const finishRouteBtn = document.getElementById("finishRouteBtn");
  const jardinsItem = document.getElementById("jardinsItem");
  const jardinsStatusBadge = document.getElementById("jardinsStatusBadge");
  const pitangueirasItem = document.getElementById("pitangueirasItem");
  const pitangueirasStatus = document.getElementById("pitangueirasStatus");

  const currentStopTitle = document.getElementById("currentStopTitle");
  const currentStopSub = document.getElementById("currentStopSub");
  const wazeLink = document.getElementById("wazeLink");
  const mapsLink = document.getElementById("mapsLink");

  const badgeStopStatus = document.getElementById("badgeStopStatus");
  const progressText = document.getElementById("progressText");
  const progressBarFill = document.getElementById("progressBarFill");
  const currentRouteStatus = document.getElementById("currentRouteStatus");

  let gpsWatchId = null;
  let paradaEtapa = 1;

  // 1. CONEXÃO COM FIREBASE
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

  // 2. SISTEMA DE GEOLOCALIZAÇÃO ALTA PRECISÃO
  function startRouteGps() {
    if (!('geolocation' in navigator)) {
      if (routeGpsStatus) {
        routeGpsStatus.textContent = "❌ Este dispositivo não possui recurso de GPS.";
        routeGpsStatus.style.color = "#dc2626";
      }
      return;
    }

    if (routeGpsStatus) {
      routeGpsStatus.textContent = "📍 Solicitando GPS... Aceite a permissão de localização no navegador!";
      routeGpsStatus.style.color = "#0f172a";
    }

    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
    }

    const options = {
      enableHighAccuracy: true, // Força uso do hardware de GPS de alta precisão
      maximumAge: 0,            // Pega localização em tempo real sem cache
      timeout: 15000
    };

    gpsWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy);
        const speed = position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) : 0;
        const selectedTruckId = routeTruckSelect ? routeTruckSelect.value : "truck_02";

        if (routeGpsStatus) {
          routeGpsStatus.textContent = `📍 GPS Ativo (Precisão: ±${accuracy}m) • Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
          routeGpsStatus.style.color = "#166534";
        }

        if (btnToggleRouteGps) {
          btnToggleRouteGps.textContent = "GPS Transmitindo ✓";
          btnToggleRouteGps.style.backgroundColor = "#166534";
        }

        const payload = {
          latitude: lat,
          longitude: lng,
          lat: lat,
          lng: lng,
          speed: parseFloat(speed),
          accuracy: accuracy,
          lastGpsUpdate: new Date().toISOString()
        };

        // Salva backup local
        localStorage.setItem(`gps_truck_${selectedTruckId}`, JSON.stringify(payload));

        // Transmite para o Firebase para alimentar o mapa do monitoramento
        if (fb) {
          try {
            await fb.update(`trucks/${selectedTruckId}/location`, payload);
            await fb.update(`latestReadings/${selectedTruckId}/location`, payload);
            await fb.update(`trucks/${selectedTruckId}`, {
              lat: lat,
              lng: lng,
              latitude: lat,
              longitude: lng,
              lastUpdate: new Date().toISOString()
            });
          } catch (err) {
            console.error("Erro ao salvar localização no banco:", err);
          }
        }
      },
      (error) => {
        if (routeGpsStatus) {
          routeGpsStatus.textContent = `⚠️ Erro no GPS: ${error.message}`;
          routeGpsStatus.style.color = "#dc2626";
        }
      },
      options
    );
  }

  // Ativa automaticamente ao carregar a página
  startRouteGps();

  if (btnToggleRouteGps) {
    btnToggleRouteGps.addEventListener("click", startRouteGps);
  }

  if (routeTruckSelect) {
    routeTruckSelect.addEventListener("change", startRouteGps);
  }

  // 3. GERENCIADOR DE PARADAS
  if (btnConcluirParada) {
    btnConcluirParada.addEventListener("click", function () {
      if (paradaEtapa === 1) {
        jardinsItem.classList.remove("selected-item");
        jardinsItem.classList.add("done");
        jardinsStatusBadge.textContent = "Concluído";
        jardinsStatusBadge.className = "status-text";

        pitangueirasItem.classList.add("selected-item");
        pitangueirasStatus.textContent = "Em Coleta";
        pitangueirasStatus.className = "badge neutral";

        currentStopTitle.textContent = "Pitangueiras";
        currentStopSub.textContent = "Tomba, Feira de Santana - BA";
        wazeLink.href = "https://waze.com/ul?q=Pitangueiras,+Feira+de+Santana&navigate=yes";
        mapsLink.href = "https://www.google.com/maps/dir/?api=1&destination=Pitangueiras,+Feira+de+Santana";

        progressText.textContent = "75% Concluído";
        progressBarFill.style.width = "75%";

        paradaEtapa = 2;
        alert("📍 Parada 'Jardins Norte' concluída! Próxima parada: Pitangueiras.");
      } else if (paradaEtapa === 2) {
        pitangueirasItem.classList.remove("selected-item");
        pitangueirasItem.classList.add("done");
        pitangueirasStatus.textContent = "Concluído";
        pitangueirasStatus.className = "status-text";

        this.textContent = "Todas as Paradas Concluídas";
        this.style.backgroundColor = "#64748b";
        this.disabled = true;

        badgeStopStatus.textContent = "FINALIZADO";
        badgeStopStatus.className = "badge success";

        progressText.textContent = "100% Concluído";
        progressBarFill.style.width = "100%";

        paradaEtapa = 3;
        alert("📍 Todas as paradas da rota foram concluídas!");
      }
    });
  }

  // 4. FINALIZAR ROTA COMPLETA
  if (finishRouteBtn) {
    finishRouteBtn.addEventListener("click", function () {
      if (confirm("Deseja realmente finalizar esta rota ativa?")) {
        this.innerHTML = "<span>Rota Finalizada</span>";
        this.style.backgroundColor = "#64748b";
        this.disabled = true;

        if (btnConcluirParada) {
          btnConcluirParada.textContent = "Rota Encerrada";
          btnConcluirParada.style.backgroundColor = "#64748b";
          btnConcluirParada.disabled = true;
        }

        if (progressText) progressText.textContent = "100% Concluído";
        if (progressBarFill) progressBarFill.style.width = "100%";

        if (currentRouteStatus) {
          currentRouteStatus.textContent = "Rota Finalizada";
          currentRouteStatus.className = "badge neutral";
        }

        alert("✅ Rota finalizada com sucesso!");
      }
    });
  }
});
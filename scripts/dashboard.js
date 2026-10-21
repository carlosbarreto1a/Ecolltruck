(function () {
  const fallbackTrucks = [
    {
      id: "truck_02",
      name: "Truck 02",
      status: "Operacional",
      capacityKg: 1000,
      currentRouteId: "rota_024"
    },
    {
      id: "truck_05",
      name: "Truck 05",
      status: "Manuten\u00e7\u00e3o",
      capacityKg: 1000,
      currentRouteId: "rota_018"
    },
    {
      id: "truck_08",
      name: "Truck 08",
      status: "Aten\u00e7\u00e3o",
      capacityKg: 1000,
      currentRouteId: "rota_031"
    }
  ];
  const fallbackUsers = [
    { name: "Jo\u00e3o Silva", status: "Ativo" },
    { name: "Maria Santos", status: "Ativo" },
    { name: "Carlos Oliveira", status: "Ativo" }
  ];
  const fallbackRoutes = [
    { id: "rota_024", code: "R-024", status: "Em andamento" },
    { id: "rota_018", code: "R-018", status: "Programada" },
    { id: "rota_031", code: "R-031", status: "Aten\u00e7\u00e3o" }
  ];
  const fallbackReadings = [
    {
      truckId: "truck_02",
      weightKg: 580,
      sensorStatus: "online",
      updatedAt: new Date().toISOString()
    },
    {
      truckId: "truck_08",
      weightKg: 0,
      sensorStatus: "offline",
      updatedAt: new Date().toISOString()
    }
  ];

  const state = {
    trucks: loadArray("ecolltruck-trucks", fallbackTrucks),
    users: loadArray("ecolltruck-users", fallbackUsers),
    routes: fallbackRoutes,
    readings: fallbackReadings,
    records: []
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".metric-card, .panel").forEach((card, index) => {
      card.style.animationDelay = `${index * 35}ms`;
      card.classList.add("is-ready");
    });

    renderDashboard();
    connectFirebase();
  });

  async function connectFirebase() {
    if (!window.EcollTruckFirebaseReady) return;

    try {
      const firebase = await window.EcollTruckFirebaseReady;
      await firebase.seedInitialProfiles().catch(() => {});
      await firebase.seedInitialDatabase().catch(() => {});

      firebase.subscribe("trucks", (snapshot) => {
        const trucks = asList(snapshot.val());
        if (!trucks.length) return;
        state.trucks = trucks;
        localStorage.setItem("ecolltruck-trucks", JSON.stringify(trucks));
        renderDashboard();
      }, handleFirebaseError);

      firebase.subscribe("users", (snapshot) => {
        const users = asList(snapshot.val());
        if (!users.length) return;
        state.users = users;
        renderDashboard();
      }, handleFirebaseError);

      firebase.subscribe("routes", (snapshot) => {
        const routes = asList(snapshot.val());
        if (!routes.length) return;
        state.routes = routes;
        renderDashboard();
      }, handleFirebaseError);

      firebase.subscribe("latestReadings", (snapshot) => {
        state.readings = asList(snapshot.val());
        renderDashboard();
      }, handleFirebaseError);

      firebase.subscribe("weightRecords", (snapshot) => {
        state.records = asList(snapshot.val());
        renderDashboard();
      }, handleFirebaseError);
    } catch (error) {
      window.EcollTruckApp?.showToast("Dashboard usando dados locais.");
    }
  }

  function renderDashboard() {
    const trucks = state.trucks.map(normalizeTruck);
    const users = state.users;
    const routes = state.routes;
    const readings = state.readings;
    const records = state.records;
    const activeUsers = users.filter((user) => normalizeStatus(user.status) !== "bloqueado");
    const completedRoutes = routes.filter((route) => isCompletedRoute(route.status));
    const routePercent = routes.length ? Math.round((completedRoutes.length / routes.length) * 100) : 0;
    const alerts = buildAlerts(trucks, readings);
    const criticalAlerts = alerts.filter((alert) => alert.tone === "danger").length;
    const target = getDailyTarget();
    const dailyWeight = getDailyWeight(records, readings);
    const progress = target ? Math.min(Math.round((dailyWeight / target) * 100), 100) : 0;

    setText("totalTrucksMetric", trucks.length);
    setText("totalTrucksHint", `${countAvailableTrucks(trucks)} operacionais`);
    setText("activeUsersMetric", activeUsers.length);
    setText("activeUsersHint", `${users.length} perfis cadastrados`);
    setText("routesMetric", `${completedRoutes.length}/${routes.length}`);
    setText("routesHint", `${routePercent}% completo`);
    setText("alertsMetric", alerts.length);
    setText("alertsHint", criticalAlerts ? `${criticalAlerts} cr\u00edticos para avaliar` : "sem alertas cr\u00edticos");
    setText("dailyWeightValue", `${formatNumber(dailyWeight)}kg`);
    setText("dailyGoalValue", `de ${formatNumber(target)}kg`);
    setText("dailyProgressValue", `${progress}%`);
    setWidth("dailyProgressBar", `${progress}%`);

    renderTruckDonut(trucks);
    renderAlerts(alerts);
  }

  function renderTruckDonut(trucks) {
    const total = trucks.length;
    const operational = trucks.filter((truck) => isAvailableTruck(truck.status)).length;
    const maintenance = trucks.filter((truck) => normalizeStatus(truck.status) === "manutencao").length;
    const inactive = Math.max(total - operational - maintenance, 0);
    const operationalPercent = total ? Math.round((operational / total) * 100) : 0;
    const inactivePercent = total ? Math.round((inactive / total) * 100) : 0;
    const maintenancePercent = total ? Math.max(100 - operationalPercent - inactivePercent, 0) : 0;
    const inactiveEnd = operationalPercent + inactivePercent;
    const donut = document.getElementById("truckStatusDonut");

    setText("operationalDonutLabel", `Operacional: ${operationalPercent}%`);
    setText("inactiveDonutLabel", `Inativo: ${inactivePercent}%`);
    setText("maintenanceDonutLabel", `Manuten\u00e7\u00e3o: ${maintenancePercent}%`);

    if (!donut) return;
    donut.style.background = total
      ? `conic-gradient(var(--brand-3) 0 ${operationalPercent}%, var(--danger) ${operationalPercent}% ${inactiveEnd}%, var(--warning) ${inactiveEnd}% 100%)`
      : "conic-gradient(var(--surface-3) 0 100%)";
  }

  function renderAlerts(alerts) {
    const list = document.getElementById("dashboardAlertList");
    if (!list) return;

    const visibleAlerts = alerts.slice(0, 4);
    if (!visibleAlerts.length) {
      list.innerHTML = `
        <article class="alert-item">
          <span class="alert-icon success" data-icon="circle-check"></span>
          <div>
            <strong>Nenhum alerta ativo</strong>
            <small>sensores e caminh\u00f5es dentro do esperado</small>
          </div>
        </article>
      `;
    } else {
      list.innerHTML = visibleAlerts.map((alert) => `
        <article class="alert-item">
          <span class="alert-icon ${alert.tone}" data-icon="${alert.icon}"></span>
          <div>
            <strong>${escapeHTML(alert.title)}</strong>
            <small>${escapeHTML(alert.description)}</small>
          </div>
        </article>
      `).join("");
    }

    window.EcollTruckApp?.refreshIcons(list);
  }

  function buildAlerts(trucks, readings) {
    const truckById = new Map(trucks.map((truck) => [truck.id, truck]));
    const alerts = [];

    readings.forEach((reading) => {
      const truck = truckById.get(reading.truckId) || {};
      const name = truck.name || reading.truckId || "Caminh\u00e3o";
      const capacity = Number(truck.capacityKg || 1000);
      const weight = Number(reading.weightKg || 0);
      const percent = capacity ? Math.round((weight / capacity) * 100) : 0;

      if (!isReadingOnline(reading)) {
        alerts.push({
          tone: "danger",
          icon: "triangle-alert",
          title: `${name} sem leitura do sensor`,
          description: getReadingOfflineMessage(reading)
        });
      }

      if (percent >= 90) {
        alerts.push({
          tone: "warning",
          icon: "scale",
          title: `${name} atingiu ${percent}% da capacidade`,
          description: `${formatNumber(weight)}kg registrados na balan\u00e7a`
        });
      }
    });

    trucks.forEach((truck) => {
      const status = normalizeStatus(truck.status);
      if (status === "atencao" || status === "manutencao") {
        alerts.push({
          tone: status === "manutencao" ? "danger" : "warning",
          icon: status === "manutencao" ? "wrench" : "triangle-alert",
          title: `${truck.name} em ${truck.status}`,
          description: "acompanhar antes de liberar para coleta"
        });
      }
    });

    return alerts;
  }

  function getDailyWeight(records, readings) {
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = records.filter((record) => {
      const date = String(record.createdAt || record.date || "").slice(0, 10);
      return date === today;
    });

    if (todayRecords.length) {
      return todayRecords.reduce((sum, record) => sum + Number(record.weightKg || 0), 0);
    }

    return readings.reduce((sum, reading) => sum + Number(reading.weightKg || 0), 0);
  }

  function getDailyTarget() {
    try {
      const settings = JSON.parse(localStorage.getItem("ecolltruck-settings"));
      const target = Number(settings?.dailyTarget);
      return Number.isFinite(target) && target > 0 ? target : 1000;
    } catch (error) {
      return 1000;
    }
  }

  function isReadingOnline(reading) {
    const status = normalizeStatus(reading.sensorStatus);
    if (status === "offline") return false;
    if (status && status !== "online") return false;
    return !isReadingStale(reading);
  }

  function isReadingStale(reading) {
    const readingTime = getReadingTime(reading);
    if (!readingTime) return false;
    const limitMs = getOfflineLimitMinutes() * 60 * 1000;
    return Date.now() - readingTime > limitMs;
  }

  function getReadingOfflineMessage(reading) {
    if (isReadingStale(reading)) {
      return `sem atualiza\u00e7\u00e3o h\u00e1 mais de ${getOfflineLimitMinutes()} min`;
    }

    return "verificar GPS ou balan\u00e7a antes da pr\u00f3xima rota";
  }

  function getReadingTime(reading) {
    const value = reading.updatedAt || reading.timestamp || reading.createdAt;
    if (!value) return null;
    const numeric = Number(value);
    const date = Number.isFinite(numeric) && String(value).length >= 10
      ? new Date(numeric)
      : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }

  function getOfflineLimitMinutes() {
    try {
      const settings = JSON.parse(localStorage.getItem("ecolltruck-settings"));
      const minutes = Number(settings?.offlineMinutes);
      return Number.isFinite(minutes) && minutes > 0 ? minutes : 10;
    } catch (error) {
      return 10;
    }
  }

  function countAvailableTrucks(trucks) {
    return trucks.filter((truck) => isAvailableTruck(truck.status)).length;
  }

  function isAvailableTruck(status) {
    const normalized = normalizeStatus(status);
    return normalized === "operacional" || normalized === "em rota";
  }

  function isCompletedRoute(status) {
    const normalized = normalizeStatus(status);
    return normalized === "concluida" || normalized === "finalizada";
  }

  function normalizeTruck(truck) {
    return {
      id: truck.id || truck.truckId || truck.name,
      name: truck.name || truck.id || "Caminh\u00e3o",
      status: truck.status || "Operacional",
      capacityKg: Number(truck.capacityKg || 1000),
      currentRouteId: truck.currentRouteId || truck.routeId || ""
    };
  }

  function normalizeStatus(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function asList(value) {
    if (Array.isArray(value)) return value;
    return Object.values(value || {});
  }

  function loadArray(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : fallback.slice();
    } catch (error) {
      return fallback.slice();
    }
  }

  function handleFirebaseError() {
    window.EcollTruckApp?.showToast("N\u00e3o foi poss\u00edvel atualizar dados em tempo real.");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function setWidth(id, value) {
    const node = document.getElementById(id);
    if (node) node.style.width = value;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("pt-BR");
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();

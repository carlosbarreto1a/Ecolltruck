(function () {
  const sdkVersion = "10.12.2";
  const sdkBaseUrl = `https://www.gstatic.com/firebasejs/${sdkVersion}`;

  
  const firebaseConfig = {
    apiKey: "AIzaSyCALBietGoUOxXTFBgSzIEY_nmzXo-kTPE",
    authDomain: "ecolltruck-senai.firebaseapp.com",
    databaseURL: "https://ecolltruck-senai-default-rtdb.firebaseio.com",
    projectId: "ecolltruck-senai",
    storageBucket: "ecolltruck-senai.firebasestorage.app",
    messagingSenderId: "919686368132",
    appId: "1:919686368132:web:1fd592aeb3413ceb7a6bd1",
    measurementId: "G-CTG7RQPJDX"
  };
  const seedProfiles = {
    S5a6oSBwkEP73Qm2iF48WCYZWTq2: {
      id: "S5a6oSBwkEP73Qm2iF48WCYZWTq2",
      name: "Carlos Oliveira",
      email: "carlos@ecolltruck.com",
      role: "Motorista",
      status: "Ativo"
    },
    wVX8c9XiCPgi8mk9FfASVrxJxa92: {
      id: "wVX8c9XiCPgi8mk9FfASVrxJxa92",
      name: "Maria Santos",
      email: "maria@ecolltruck.com",
      role: "Operador",
      status: "Ativo"
    },
    "9TPEaT4DyASbD233tppHtuda8r53": {
      id: "9TPEaT4DyASbD233tppHtuda8r53",
      name: "Jo\u00e3o Silva",
      email: "joao@ecolltruck.com",
      role: "Administrador",
      status: "Ativo"
    }
  };
  const seedDatabase = {
    trucks: {
      truck_02: {
        id: "truck_02",
        name: "Truck 02",
        plate: "ECL-0202",
        status: "Operacional",
        currentRouteId: "rota_024",
        capacityKg: 1000,
        createdAt: "2026-06-13T00:00:00.000Z"
      },
      truck_05: {
        id: "truck_05",
        name: "Truck 05",
        plate: "ECL-0505",
        status: "Manuten\u00e7\u00e3o",
        currentRouteId: "rota_018",
        capacityKg: 1000,
        createdAt: "2026-06-13T00:00:00.000Z"
      },
      truck_08: {
        id: "truck_08",
        name: "Truck 08",
        plate: "ECL-0808",
        status: "Aten\u00e7\u00e3o",
        currentRouteId: "rota_031",
        capacityKg: 1000,
        createdAt: "2026-06-13T00:00:00.000Z"
      }
    },
    routes: {
      rota_024: {
        id: "rota_024",
        code: "R-024",
        name: "Centro - Jardins",
        status: "Em andamento",
        truckId: "truck_02"
      },
      rota_018: {
        id: "rota_018",
        code: "R-018",
        name: "Jardins",
        status: "Programada",
        truckId: "truck_05"
      },
      rota_031: {
        id: "rota_031",
        code: "R-031",
        name: "Retorno",
        status: "Aten\u00e7\u00e3o",
        truckId: "truck_08"
      }
    },
    latestReadings: {
      truck_02: {
        truckId: "truck_02",
        weightKg: 580,
        latitude: -12.2577,
        longitude: -38.9595,
        sensorStatus: "online",
        updatedAt: "2026-06-13T00:00:00.000Z"
      },
      truck_08: {
        truckId: "truck_08",
        weightKg: 0,
        latitude: -12.2664,
        longitude: -38.9663,
        sensorStatus: "offline",
        updatedAt: "2026-06-13T00:00:00.000Z"
      }
    }
  };

  window.EcollTruckFirebaseConfig = Object.freeze({ ...firebaseConfig });

  window.EcollTruckFirebaseReady = Promise.all([
    import(`${sdkBaseUrl}/firebase-app.js`),
    import(`${sdkBaseUrl}/firebase-auth.js`),
    import(`${sdkBaseUrl}/firebase-database.js`)
  ]).then(([appSdk, authSdk, databaseSdk]) => {
    const app = appSdk.getApps().length
      ? appSdk.getApp()
      : appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.getAuth(app);
    const database = databaseSdk.getDatabase(app);

    function checkConnection(timeoutMs = 6000) {
      return new Promise((resolve, reject) => {
        let settled = false;
        let unsubscribe = () => {};
        const connectionRef = databaseSdk.ref(database, ".info/connected");
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          unsubscribe();
          reject(new Error("Tempo limite ao conectar com o Firebase."));
        }, timeoutMs);
        unsubscribe = databaseSdk.onValue(
          connectionRef,
          (snapshot) => {
            if (settled || snapshot.val() !== true) return;
            settled = true;
            window.clearTimeout(timeout);
            unsubscribe();
            resolve(true);
          },
          (error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            unsubscribe();
            reject(error);
          }
        );
      });
    }

    async function seedInitialProfiles() {
      const updates = {};

      await Promise.all(Object.entries(seedProfiles).map(async ([uid, profile]) => {
        const profileRef = databaseSdk.ref(database, `users/${uid}`);
        const snapshot = await databaseSdk.get(profileRef);
        if (snapshot.exists()) return;

        updates[`users/${uid}`] = {
          ...profile,
          createdAt: new Date().toISOString(),
          seeded: true
        };
      }));

      if (Object.keys(updates).length) {
        await databaseSdk.update(databaseSdk.ref(database), updates);
      }
    }

    async function seedInitialDatabase() {
      const updates = {};

      await Promise.all(Object.entries(seedDatabase).map(async ([path, records]) => {
        const snapshot = await databaseSdk.get(databaseSdk.ref(database, path));
        if (snapshot.exists()) return;
        updates[path] = getSeedRecords(path, records);
      }));

      if (Object.keys(updates).length) {
        await databaseSdk.update(databaseSdk.ref(database), updates);
      }
    }

    function getSeedRecords(path, records) {
      if (path !== "latestReadings") return records;

      const now = new Date().toISOString();
      return Object.fromEntries(Object.entries(records).map(([id, record]) => [
        id,
        {
          ...record,
          updatedAt: now
        }
      ]));
    }

    const service = {
      app,
      auth,
      database,
      config: window.EcollTruckFirebaseConfig,
      seedProfiles: Object.freeze({ ...seedProfiles }),
      checkConnection,
      seedInitialProfiles,
      seedInitialDatabase,
      signIn: (email, password) => authSdk.signInWithEmailAndPassword(auth, email, password),
      signOut: () => authSdk.signOut(auth),
      observeAuth: (callback) => authSdk.onAuthStateChanged(auth, callback),
      createUser: async ({ name, email, password, role, status }) => {
        const secondaryApp = appSdk.initializeApp(firebaseConfig, `user-create-${Date.now()}`);
        const secondaryAuth = authSdk.getAuth(secondaryApp);

        try {
          const credential = await authSdk.createUserWithEmailAndPassword(secondaryAuth, email, password);
          if (name) {
            await authSdk.updateProfile(credential.user, { displayName: name });
          }

          let profileSaved = true;
          try {
            await databaseSdk.set(databaseSdk.ref(database, `users/${credential.user.uid}`), {
              id: credential.user.uid,
              name,
              email,
              role,
              status,
              createdAt: new Date().toISOString()
            });
          } catch (error) {
            profileSaved = false;
          }

          await authSdk.signOut(secondaryAuth);
          return {
            profileSaved,
            user: credential.user
          };
        } finally {
          await appSdk.deleteApp(secondaryApp);
        }
      },
      read: (path) => databaseSdk.get(databaseSdk.ref(database, path)),
      set: (path, value) => databaseSdk.set(databaseSdk.ref(database, path), value),
      update: (path, value) => databaseSdk.update(databaseSdk.ref(database, path), value),
      push: (path, value) => databaseSdk.push(databaseSdk.ref(database, path), value),
      subscribe: (path, callback, onError) => {
        return databaseSdk.onValue(databaseSdk.ref(database, path), callback, onError);
      }
    };

    window.EcollTruckFirebase = service;
    window.dispatchEvent(new CustomEvent("ecolltruck:firebase-ready"));
    return service;
  }).catch((error) => {
    console.error("Falha ao inicializar Firebase:", error);
    window.dispatchEvent(new CustomEvent("ecolltruck:firebase-error", {
      detail: { message: error.message }
    }));
    throw error;
  });
})();

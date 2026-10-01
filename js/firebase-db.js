        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, updateDoc, limit, deleteDoc, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDLKbj9rK4Xxha9ptpk9TU5JE9Bq53nh5c",
            authDomain: "tor-konfigurator.firebaseapp.com",
            projectId: "tor-konfigurator",
            storageBucket: "tor-konfigurator.firebasestorage.app",
            messagingSenderId: "649556152490",
            appId: "1:649556152490:web:ae91992d6918f87012c0d3"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const storage = getStorage(app);

        // Expose Firebase objects globally for modular features (e.g. Quiz module)
        window.auth = auth;
        window.db = db;
        window.storage = storage;

        let isRegistering = false;
        window.isResettingPassword = false;

        // Prüfen, ob wir uns im Passwort-Reset-Modus befinden (E-Mail Link geklickt)
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const oobCode = urlParams.get('oobCode');

        if (mode === 'resetPassword' && oobCode) {
            window.isResettingPassword = true;
            // Falls der User angemeldet ist, loggen wir ihn aus
            signOut(auth).catch(() => {});
        }

        // --- Admin Badge Activity States ---
        let adminBadgesUnsubscribes = [];
        let hasNewLiveChats = false;
        let hasNewChatVerlaeufe = false;
        let hasNewFehlerberichte = false;

        // --- HELPER: Scrollbalken der Hauptseite komplett an/aus schalten ---
        const toggleMainScroll = (enable) => {
            const val = enable ? 'auto' : 'hidden';
            document.body.style.overflow = val;
            document.documentElement.style.overflow = val; // WICHTIG: Killt den rechten Balken auch im HTML
        };

        window.showRegister = () => {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
            document.getElementById('introText').style.display = 'none';
            // Texte leeren
            document.getElementById('msgLogin').innerText = "";
            document.getElementById('msgRegister').innerText = "";
        };

        window.showLogin = () => {
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('introText').style.display = 'block';
            // Texte leeren
            document.getElementById('msgLogin').innerText = "";
            document.getElementById('msgRegister').innerText = "";
        };

        window.handleRegister = async () => {
            const first = document.getElementById('regFirstName').value;
            const last = document.getElementById('regLastName').value;
            const email = document.getElementById('regEmail').value;
            const pass = document.getElementById('regPassword').value;
            const passConfirm = document.getElementById('regPasswordConfirm').value;
            const consent = document.getElementById('regConsent').checked;
            const btn = document.querySelector('#registerForm button');
            const msgElement = document.getElementById('msgRegister'); // <--- GEÄNDERT

            const showMsg = (text, color = "red") => {
                msgElement.style.color = color;
                msgElement.innerText = text;
                msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            };

            if (!first || !last || !email || !pass || !passConfirm) { showMsg("Bitte alles ausfüllen."); return; }
            if (pass !== passConfirm) { showMsg("Passwörter stimmen nicht überein!"); return; }
            if (!consent) { showMsg("Bitte Bedingungen zustimmen."); return; }

            btn.disabled = true; btn.innerText = "Bitte warten..."; msgElement.innerText = ""; isRegistering = true;

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                const user = userCredential.user;

                await setDoc(doc(db, "users", user.uid), {
                    firstName: first, lastName: last, email: email, role: "customer", approved: false, createdAt: new Date()
                });

                try { await sendEmailSmart('register', { firstName: first, lastName: last, email: email }); } catch (e) { }

                showMsg("Registrierung erfolgreich! Wir prüfen Ihre Daten.", "green");

                setTimeout(async () => {
                    await signOut(auth);
                    window.showLogin();
                    isRegistering = false;
                    btn.disabled = false; btn.innerText = "Anfrage senden";
                    msgElement.innerText = "";
                }, 2000);

            } catch (error) {
                isRegistering = false; btn.disabled = false; btn.innerText = "Anfrage senden";
                if (auth.currentUser) await signOut(auth);
                const errorText = (error.code === 'auth/email-already-in-use') ? "E-Mail bereits registriert." : "Fehler: " + error.message;
                showMsg(errorText);
            }
        };

        // --- INITIALE ARTIKEL FÜR ALLGEMEINES ZUBEHÖR (DRAHTSEILE) ---
        const INITIAL_DRAHTSEIL_PRODUCTS = [
            { id: "seil_verstaerkt_n_3040", name: "Verstärktes Drahtseil Ø 2,9 mm (N-Beschlag, L=3040 mm)", artNr: "3086779", price: 161.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, N-Beschlag mit Kausche, komplett je Tor Stück für Tore mit einem Torblattgewicht > 170 kg: L = 3040 bis Torhöhe 2250", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["N"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_n_3780", name: "Verstärktes Drahtseil Ø 2,9 mm (N-Beschlag, L=3780 mm)", artNr: "3086778", price: 194.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, N-Beschlag mit Kausche, komplett je Tor Stück für Tore mit einem Torblattgewicht > 170 kg: L = 3780, größer Torhöhe 2250", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["N"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_5280", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=5280 mm)", artNr: "3086771", price: 264.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 5280 bis Torhöhe 2065", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_5475", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=5475 mm)", artNr: "3086772", price: 273.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 5475 bis Torhöhe 2190", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_5600", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=5600 mm)", artNr: "3086773", price: 280.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 5600 bis Torhöhe 2240", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_5655", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=5655 mm)", artNr: "3086774", price: 282.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 5655 bis Torhöhe 2250", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_6250", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=6250 mm)", artNr: "3086775", price: 306.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 6250 bis Torhöhe 2490", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_6900", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=6900 mm)", artNr: "3086776", price: 336.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 6900 bis Torhöhe 2830", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_verstaerkt_l_7300", name: "Verstärktes Drahtseil Ø 2,9 mm (L-Beschlag, L=7300 mm)", artNr: "3086777", price: 355.00, priceDate: 20091101, desc: "Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche, komplett je Tor für Tore mit einem Torblattgewicht > 170 kg: L = 7300 bis Torhöhe 3000", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 200 },
            { id: "seil_z_2365", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2365 mm)", artNr: "3064346", price: 65.00, priceDate: 20010201, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2365 bis Torhöhe 1875", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2445", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2445 mm)", artNr: "3064347", price: 65.00, priceDate: 20020701, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2445 bis Torhöhe 1955", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2490", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2490 mm)", artNr: "3064348", price: 65.00, priceDate: 19990901, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2490 bis Torhöhe 2000", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2570", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2570 mm)", artNr: "3064349", price: 65.00, priceDate: 20020701, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2570 bis Torhöhe 2080", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2615", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2615 mm)", artNr: "3064350", price: 67.00, priceDate: 19990901, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2615 bis Torhöhe 2125", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2695", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2695 mm)", artNr: "3064351", price: 67.00, priceDate: 20030301, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2695 bis Torhöhe 2205", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2740", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2740 mm)", artNr: "3064352", price: 67.00, priceDate: 19990901, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2740 bis Torhöhe 2250", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2865", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2865 mm)", artNr: "3064353", price: 67.00, priceDate: 20010201, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2865 bis Torhöhe 2375", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_2990", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=2990 mm)", artNr: "3064354", price: 67.00, priceDate: 20010201, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 2990 bis Torhöhe 2500", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_z_3115", name: "Drahtseil Ø 3 mm (Beschlagsart Z, L=3115 mm)", artNr: "3064355", price: 67.00, priceDate: 20030601, desc: "Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme, komplett je Tor Stück: L = 3115 bis Torhöhe 2625", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["Z"], positionTags: [], sortIndex: 210 },
            { id: "seil_n_3040", name: "Drahtseil Ø 3 mm (Beschlagsart N, L=3040 mm)", artNr: "3064375", price: 24.00, priceDate: 20050301, desc: "Drahtseile Ø 3 mm, Beschlagsart N, mit Kausche, komplett je Tor Stück: L = 3040 bis Torhöhe 2250", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["N"], positionTags: [], sortIndex: 220 },
            { id: "seil_n_3780", name: "Drahtseil Ø 3 mm (Beschlagsart N, L=3780 mm)", artNr: "3064376", price: 28.00, priceDate: 19990601, desc: "Drahtseile Ø 3 mm, Beschlagsart N, mit Kausche, komplett je Tor Stück: L = 3780 (ab 01.03.2005 nur Torhöhen > 2250)", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["N"], positionTags: [], sortIndex: 220 },
            { id: "seil_l_5280", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=5280 mm)", artNr: "3064358", price: 65.00, priceDate: 20050301, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 5280 bis Torhöhe 2065", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 },
            { id: "seil_l_5475", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=5475 mm)", artNr: "3064359", price: 71.00, priceDate: 20050301, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 5475 bis Torhöhe 2190", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 },
            { id: "seil_l_5600", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=5600 mm)", artNr: "3064360", price: 70.00, priceDate: 20050301, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 5600 bis Torhöhe 2240", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 },
            { id: "seil_l_5655", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=5655 mm)", artNr: "3064361", price: 70.00, priceDate: 20050301, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 5655 bis Torhöhe 2250", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 },
            { id: "seil_l_6250", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=6250 mm)", artNr: "3064362", price: 70.00, priceDate: 19990601, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 6250 bis Torhöhe 2490 (ab 01.03.2005 nur Torhöhen > 2250)", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 },
            { id: "seil_l_6900", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=6900 mm)", artNr: "3064363", price: 77.00, priceDate: 19990601, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 6900 bis Torhöhe 2830", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 },
            { id: "seil_l_7300", name: "Drahtseil Ø 3 mm (Beschlagsart L, L=7300 mm)", artNr: "3064364", price: 81.00, priceDate: 19990601, desc: "Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche, komplett je Tor Stück: L = 7300 bis Torhöhe 3000", category: "Allgemeines Zubehör", seriesTags: ["BR40"], fittingTags: ["L"], positionTags: [], sortIndex: 230 }
        ];

        // Neue Funktion: Teile laden (für den Haupt-Konfigurator)
        async function loadPartsFromCloud() {
            const loader = document.getElementById('initLoader');
            if (loader) { loader.style.display = 'flex'; loader.innerText = "Lade Preisliste..."; }

            try {
                const querySnapshot = await getDocs(collection(db, "products"));
                partsDB = {}; // Reset

                querySnapshot.forEach((doc) => {
                    // WICHTIG: Die Lamellen-Matrix darf nicht im normalen Rechner auftauchen!
                    if (doc.id === "SYSTEM_LAMELLEN_MATRIX") return;

                    const d = doc.data();
                    if (!d.category) d.category = "Beschlagteile für Torglieder";

                    // Rollenhalter 3074403 gilt für Mitte UND Boden
                    if (d.artNr === '3074403' || doc.id === '3074403' || doc.id === 'rollenhalter_h' || (d.name && d.name.toLowerCase() === 'rollenhalter')) {
                        if (!d.positionTags) d.positionTags = [];
                        if (!d.positionTags.includes('Mitte')) d.positionTags.push('Mitte');
                        if (!d.positionTags.includes('Boden')) d.positionTags.push('Boden');
                    }

                    partsDB[doc.id] = d;
                });

                // Initial-Produkte (Drahtseile) ergänzen, falls noch nicht in Firestore vorhanden
                INITIAL_DRAHTSEIL_PRODUCTS.forEach(item => {
                    if (!partsDB[item.id]) {
                        partsDB[item.id] = { ...item };
                    }
                });

                console.log("Preisliste geladen:", Object.keys(partsDB).length, "Artikel.");

                // Initiale Berechnung anstoßen, sobald Daten da sind
                if (window.markDirty) window.markDirty();
                if (typeof window.calcSeil === 'function') window.calcSeil();
                if (typeof window.renderDynamicGateGraphic === 'function') window.renderDynamicGateGraphic();

            } catch (e) {
                console.error("Fehler beim Laden der Teile:", e);
                alert("Fehler: Preisliste konnte nicht geladen werden. Sind Sie eingeloggt?");
            } finally {
                if (loader) loader.style.display = 'none';
            }
        }

        // Ladefunktion für die Lamellen-Matrix
        // Ladefunktion für die Lamellen-Matrix
        async function loadLamellenFromCloud() {
            try {
                const docSnap = await getDoc(doc(db, "products", "SYSTEM_LAMELLEN_MATRIX"));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // WICHTIG: window. davor setzen, damit der untere Skript-Bereich zugreifen kann!
                    window.lamellenMatrix = data.items || [];
                    window.lamellenGlobals = data.globals || { weiss: 0, color: 0, ral: 0 };

                    if (window.renderAdminLamellenTable) window.renderAdminLamellenTable();

                    // UI sofort aktualisieren, sobald Firebase fertig ist
                    if (typeof window.updateLamellenCalculation === 'function') {
                        window.updateLamellenCalculation();
                    }
                    console.log("Lamellen-Matrix geladen:", window.lamellenMatrix.length, "Einträge.");
                }
            } catch (e) {
                console.error("Fehler beim Laden der Lamellen-Matrix:", e);
            }
        }

        window.handleLogin = async () => {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            const msgElement = document.getElementById('msgLogin'); // <--- GEÄNDERT

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, pass);
                const user = userCredential.user;
                const userDoc = await getDoc(doc(db, "users", user.uid));

                if (userDoc.exists() && userDoc.data().approved === true) {
                    document.getElementById('loginOverlay').style.display = 'none';
                    msgElement.innerText = "";
                } else {
                    msgElement.style.color = "red";
                    msgElement.innerText = "Account noch nicht freigeschaltet.";
                    msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await signOut(auth);
                }
            } catch (error) {
                msgElement.style.color = "red";
                msgElement.innerText = "Login fehlgeschlagen. Daten prüfen.";
                msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        window.handleForgotPassword = async () => {
            const email = document.getElementById('email').value;
            if (!email) { alert("E-Mail eingeben."); return; }
            try { await sendPasswordResetEmail(auth, email); alert("E-Mail gesendet."); } catch (e) { alert("Fehler: " + e.message); }
        };

        window.checkOpenRequests = async () => {
            const menuAdminArea = document.getElementById('menuAdminArea'); const menuRequestList = document.getElementById('menuRequestList'); const badge = document.getElementById('adminBadge');
            if (menuAdminArea) menuAdminArea.style.display = "block";
            try {
                const q = query(collection(db, "users"), where("approved", "==", false)); const querySnapshot = await getDocs(q); const count = querySnapshot.size;
                if (count > 0) { badge.style.display = "flex"; badge.innerText = count; } else { badge.style.display = "none"; }
                if (count === 0) { menuRequestList.innerHTML = '<em style="font-size:0.8rem; color:#999;">Keine offenen Anfragen.</em>'; return; }
                let html = '';
                querySnapshot.forEach((docSnap) => {
                    const u = docSnap.data(); const uid = docSnap.id;
                    html += `
                        <div class="menu-request-item">
                            <div><strong>${u.firstName} ${u.lastName}</strong></div>
                            <div style="font-size:0.75rem; color:#666; margin-bottom:5px;">${u.email}</div>
                            <div class="menu-request-actions">
                                <select id="role-select-${uid}" class="role-select" onchange="window.toggleRequestBranchDropdown('${uid}')">
                                    <option value="customer">Kunde</option>
                                    <option value="employee">Mitarbeiter</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <div>
                                    <button class="btn-reject-small" onclick="rejectUser('${uid}', '${u.firstName}')">✕</button>
                                    <button class="btn-approve-small" onclick="approveUser('${uid}', '${u.email}', '${u.firstName}')">✔</button>
                                </div>
                            </div>
                            <select id="branch-select-${uid}" class="role-select" style="display: none; margin-top: 5px; width: 100%;">
                                <option value="">- Niederlassung/Werk wählen -</option>
                                <optgroup label="Werke">
                                    <option value="Brockhagen">Brockhagen</option>
                                    <option value="Ichtershausen">Ichtershausen</option>
                                    <option value="Amshausen">Amshausen</option>
                                    <option value="Eckelhausen">Eckelhausen</option>
                                    <option value="Brandis">Brandis</option>
                                    <option value="Antriebstechnik">Antriebstechnik</option>
                                    <option value="HUGA">HUGA</option>
                                    <option value="Freisen">Freisen</option>
                                    <option value="Werne">Werne</option>
                                </optgroup>
                                <optgroup label="Niederlassungen">
                                    <option value="Berlin">Berlin</option>
                                    <option value="Bremen">Bremen</option>
                                    <option value="Erfurt">Erfurt</option>
                                    <option value="Frankfurt">Frankfurt</option>
                                    <option value="Freisen (NL)">Freisen (NL)</option>
                                    <option value="Hannover">Hannover</option>
                                    <option value="Herne">Herne</option>
                                    <option value="Köln-Bonn">Köln-Bonn</option>
                                    <option value="Leipzig">Leipzig</option>
                                    <option value="Nürnberg">Nürnberg</option>
                                    <option value="München">München</option>
                                    <option value="Stuttgart">Stuttgart</option>
                                    <option value="Steinhagen">Steinhagen</option>
                                </optgroup>
                                <option value="Allgemein">Allgemein</option>
                            </select>
                        </div>
                    `;
                });
                menuRequestList.innerHTML = html;
            } catch (error) { console.error("Admin Error:", error); }
        };

        window.toggleRequestBranchDropdown = (uid) => {
            const selectBox = document.getElementById('role-select-' + uid);
            const branchSelect = document.getElementById('branch-select-' + uid);
            if (selectBox && branchSelect) {
                if (selectBox.value === 'employee' || selectBox.value === 'admin') {
                    branchSelect.style.display = 'block';
                } else {
                    branchSelect.style.display = 'none';
                    branchSelect.value = '';
                }
            }
        };

        window.rejectUser = async (uid, firstName) => {
            if (!confirm(`Anfrage von ${firstName} ablehnen und löschen?`)) return;
            try { await deleteDoc(doc(db, "users", uid)); alert("Gelöscht."); checkOpenRequests(); } catch (e) { alert(e.message); }
        };

        window.approveUser = async (uid, email, firstName) => {
            const selectBox = document.getElementById('role-select-' + uid); const selectedRole = selectBox ? selectBox.value : 'customer';
            const branchSelect = document.getElementById('branch-select-' + uid);
            const selectedBranch = (branchSelect && branchSelect.style.display !== 'none') ? branchSelect.value : '';

            if (selectedRole !== 'customer' && !selectedBranch) {
                alert("Bitte wählen Sie ein Werk oder eine Niederlassung aus!");
                return;
            }

            let confirmMsg = `${firstName} als "${selectedRole.toUpperCase()}" freischalten?`;
            if (selectedBranch) {
                confirmMsg = `${firstName} als "${selectedRole.toUpperCase()}" für "${selectedBranch}" freischalten?`;
            }
            if (!confirm(confirmMsg)) return;

            try {
                await updateDoc(doc(db, "users", uid), { 
                    approved: true, 
                    role: selectedRole,
                    branch: selectedBranch
                });
                let deutscheRolle = "Kunde"; if (selectedRole === 'employee') deutscheRolle = "Mitarbeiter"; if (selectedRole === 'admin') deutscheRolle = "Administrator";
                await sendEmailSmart('approve', { firstName: firstName, user_email: email, role_name: deutscheRolle });
                alert(`Freigabe als ${deutscheRolle} erfolgreich!`); checkOpenRequests();
            } catch (e) { alert("Fehler: " + e.message); }
        };

        // --- TORART (SEKTIONAL / SCHWINGTOR) & BAUREIHEN WECHSEL ---
        window.currentDoorType = 'sektional';

        window.switchDoorType = function (doorType) {
            if (window.currentDoorType === doorType) return;
            window.currentDoorType = doorType;

            const btnSektional = document.getElementById('btnDoorTypeSektional');
            const btnSchwing = document.getElementById('btnDoorTypeSchwing');
            const tabsSektional = document.getElementById('seriesTabsSektional');
            const tabsSchwing = document.getElementById('seriesTabsSchwing');

            if (doorType === 'sektional') {
                if (btnSektional) btnSektional.classList.add('active');
                if (btnSchwing) btnSchwing.classList.remove('active');
                if (tabsSektional) tabsSektional.style.display = 'flex';
                if (tabsSchwing) tabsSchwing.style.display = 'none';
                window.switchSeries('BR40');
            } else {
                if (btnSchwing) btnSchwing.classList.add('active');
                if (btnSektional) btnSektional.classList.remove('active');
                if (tabsSektional) tabsSektional.style.display = 'none';
                if (tabsSchwing) tabsSchwing.style.display = 'flex';
                window.switchSeries('F80');
            }
        };

        window.switchSubTabF80 = function (tab) {
            const btn = document.getElementById('btnSubAufmassF80');
            const cont = document.getElementById('aufmassF80AppContainer');
            if (btn) btn.classList.add('active');
            if (cont) cont.style.display = 'grid';
            if (typeof window.initAufmassF80 === 'function') window.initAufmassF80();
        };

        window.switchSubTabN80 = function (tab) {
            const btn = document.getElementById('btnSubAufmassN80');
            const cont = document.getElementById('aufmassN80AppContainer');
            if (btn) btn.classList.add('active');
            if (cont) cont.style.display = 'grid';
        };

        window.switchSeries = (series) => {
            if (window.currentSeries === series) {
                if (typeof window.renderDynamicGateGraphic === 'function') window.renderDynamicGateGraphic();
                return;
            }

            if (window.isQuizGameActive) {
                if (!confirm("Möchtest du das aktuelle Spiel wirklich abbrechen? Dein Fortschritt geht verloren.")) {
                    return;
                }
                window.isQuizGameActive = false;
            }

            // 1. Warnung nur bei Wechsel zwischen Sektionaltor-Baureihen mit Auswahl
            if (series !== 'TOOLS' && series !== 'F80' && series !== 'N80' && window.currentSeries !== 'TOOLS' && window.currentSeries !== 'F80' && window.currentSeries !== 'N80' && ((window.currentViewList && window.currentViewList.length > 0) || (window.calculatedList && window.calculatedList.length > 0))) {
                if (!confirm("Auswahl löschen und wechseln?")) return;
            }

            // 1b. Clean Reset: Marker, Tabelle und Berechnungen komplett zurücksetzen beim Wechseln
            if (typeof window.resetConfiguratorState === 'function') {
                window.resetConfiguratorState();
            }
            
            // Reset BR30 Baujahr-Dropdown
            const yearSelect = document.getElementById('selectBR30Year');
            if (yearSelect) {
                yearSelect.value = "";
                yearSelect.classList.remove('input-required');
            }

            window.currentSeries = series;

            // 2. Alle Container explizit verstecken
            const containers = [
                'mainAppContainer', 'allgZubehoerAppContainer', 'lamellenAppContainer', 
                'aufmassAppContainer', 'toolsAppContainer', 'aufmassF80AppContainer', 'aufmassN80AppContainer'
            ];
            containers.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // 3. Suche und Untermenüs zurücksetzen
            const searchContainer = document.getElementById('tourSearchBox');
            if (searchContainer) {
                searchContainer.style.setProperty('display', 'block', 'important');
            }

            // 2. Sub-Nav anzeigen
            const subNavBR40 = document.getElementById('subNavBR40');
            if (subNavBR40) {
                subNavBR40.style.display = (series === 'BR40') ? 'flex' : 'none';
            }
            const subNavTools = document.getElementById('subNavTools');
            if (subNavTools) {
                subNavTools.style.display = (series === 'TOOLS') ? 'flex' : 'none';
            }
            const subNavN80 = document.getElementById('subNavN80');
            if (subNavN80) {
                subNavN80.style.display = (series === 'N80') ? 'flex' : 'none';
            }
            const subNavF80 = document.getElementById('subNavF80');
            if (subNavF80) {
                subNavF80.style.display = (series === 'F80') ? 'flex' : 'none';
            }

            // 3. Baureihen-Optionen (BR30 / BR20) zurücksetzen und ein-/ausblenden
            if (document.getElementById('br30_options')) {
                document.getElementById('br30_options').style.display = (series === 'BR30') ? 'block' : 'none';
            }
            if (document.getElementById('br20_options')) {
                document.getElementById('br20_options').style.display = (series === 'BR20') ? 'block' : 'none';
            }

            // 4. Den richtigen Container anzeigen
            const mainAppContainer = document.getElementById('mainAppContainer');
            if (series === 'TOOLS') {
                const toolsCont = document.getElementById('toolsAppContainer');
                if (toolsCont) toolsCont.style.display = 'grid';
                
                // Bei Klick auf Interne Tools den aktiven Sub-Tab prüfen und visited Timestamp aktualisieren
                const activeBtn = document.querySelector('#subNavTools .sub-nav-btn.active');
                if (activeBtn) {
                    const btnId = activeBtn.id;
                    if (btnId === 'btnToolLiveChats') {
                        localStorage.setItem('lastVisited_LiveChats', Date.now());
                    } else if (btnId === 'btnToolCarlManager') {
                        if (window.selectedAdminTab === 'verlaeufe') {
                            localStorage.setItem('lastVisited_ChatVerlaeufe', Date.now());
                        } else if (window.selectedAdminTab === 'feedback') {
                            localStorage.setItem('lastVisited_Fehlerberichte', Date.now());
                        }
                    }
                    const toolName = btnId.replace(/^btn/, '');
                    const cleanToolId = toolName.charAt(0).toLowerCase() + toolName.slice(1);
                    if (typeof window.switchToolTab === 'function') window.switchToolTab(cleanToolId);
                } else {
                    if (typeof window.switchToolTab === 'function') window.switchToolTab('toolBestellPruefung');
                }
                if (window.updateAdminBadgesUI) window.updateAdminBadgesUI();
            } else if (series === 'F80') {
                const contF80 = document.getElementById('aufmassF80AppContainer');
                if (contF80) contF80.style.display = 'grid';
                if (typeof window.initAufmassF80 === 'function') window.initAufmassF80();
            } else if (series === 'N80') {
                const contN80 = document.getElementById('aufmassN80AppContainer');
                if (contN80) contN80.style.display = 'grid';
            } else {
                if (mainAppContainer) mainAppContainer.style.display = 'grid';
            }

            // 4b. Layout-Steuerung für BR30/BR20 vs BR40
            if (mainAppContainer && (series === 'BR40' || series === 'BR30' || series === 'BR20')) {
                const expH = document.getElementById('exportHeadingB');
                if (series === 'BR30' || series === 'BR20') {
                    // Tormaße und Beschlagsart bei alten Baureihen (BR30 & BR20) ausblenden
                    if (document.getElementById('ctrlSectionDimensions')) document.getElementById('ctrlSectionDimensions').style.display = 'none';
                    if (document.getElementById('ctrlSectionFitting')) document.getElementById('ctrlSectionFitting').style.display = 'none';
                    if (document.getElementById('optionB_Toggles')) document.getElementById('optionB_Toggles').style.display = 'none';
                    if (expH) expH.innerText = 'Export & Teilen';

                    // Option B Steuerung für BR30 und BR20
                    if (series === 'BR30') {
                        // BR30: Z ausblenden, N und L einblenden
                        if (document.getElementById('btnFitZ_R')) document.getElementById('btnFitZ_R').style.display = 'none';
                        if (document.getElementById('btnFitN_R')) document.getElementById('btnFitN_R').style.display = '';
                        if (document.getElementById('btnFitL_R')) document.getElementById('btnFitL_R').style.display = '';

                        // Falls aktuell Z ausgewählt ist, wechsle auf N
                        if (window.currentFittingRight === 'Z') {
                            if (typeof window.selectFittingRight === 'function') window.selectFittingRight('N');
                        }
                    } else {
                        // BR20: Z und L ausblenden, N einblenden
                        if (document.getElementById('btnFitZ_R')) document.getElementById('btnFitZ_R').style.display = 'none';
                        if (document.getElementById('btnFitL_R')) document.getElementById('btnFitL_R').style.display = 'none';
                        if (document.getElementById('btnFitN_R')) document.getElementById('btnFitN_R').style.display = '';

                        // Immer auf N wechseln für BR20
                        if (typeof window.selectFittingRight === 'function') window.selectFittingRight('N');
                    }
                } else {
                    // Standard wiederherstellen für BR40
                    if (document.getElementById('ctrlSectionDimensions')) document.getElementById('ctrlSectionDimensions').style.display = 'block';
                    if (document.getElementById('ctrlSectionFitting')) document.getElementById('ctrlSectionFitting').style.display = 'block';
                    if (document.getElementById('optionB_Toggles')) document.getElementById('optionB_Toggles').style.display = 'block';
                    if (expH) expH.innerText = '4. Export & Teilen';

                    if (document.getElementById('btnFitZ_R')) document.getElementById('btnFitZ_R').style.display = '';
                    if (document.getElementById('btnFitN_R')) document.getElementById('btnFitN_R').style.display = '';
                    if (document.getElementById('btnFitL_R')) document.getElementById('btnFitL_R').style.display = '';

                    if (typeof window.switchSubTab === 'function') {
                        window.switchSubTab('beschlag');
                    }
                }

                if (typeof window.renderDynamicGateGraphic === 'function') {
                    window.renderDynamicGateGraphic();
                }
            }

            // 5. Tabs aktiv setzen
            document.querySelectorAll('.series-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            const activeTab = document.getElementById('tab' + series);
            if (activeTab) activeTab.classList.add('active');
        };

            // --- NEU: UMSCHALTEN INNERHALB DER TOOLS ---
                window.switchToolTab = function (toolId) {
                    if (window.isQuizGameActive) {
                        if (!confirm("Möchtest du das aktuelle Spiel wirklich abbrechen? Dein Fortschritt geht verloren.")) {
                            return;
                        }
                        window.isQuizGameActive = false;
                    }
                    const adminOnlyTools = ['toolGitHubIssues', 'toolLiveChats', 'toolCarlManager'];
                    if (adminOnlyTools.includes(toolId) && window.currentUserRole !== 'admin') {
                        alert("Zugriff verweigert: Nur Administratoren dürfen diesen Bereich betreten.");
                        window.switchToolTab('toolBestellPruefung');
                        return;
                    }

                    // visited Timestamps aktualisieren bei Tab-Wechsel
                    if (toolId === 'toolLiveChats') {
                        localStorage.setItem('lastVisited_LiveChats', Date.now());
                    } else if (toolId === 'toolCarlManager') {
                        if (window.selectedAdminTab === 'verlaeufe') {
                            localStorage.setItem('lastVisited_ChatVerlaeufe', Date.now());
                        } else if (window.selectedAdminTab === 'feedback') {
                            localStorage.setItem('lastVisited_Fehlerberichte', Date.now());
                        }
                    }
                    if (window.updateAdminBadgesUI) window.updateAdminBadgesUI();

                    // Alle Tool-Buttons resetten
                    document.querySelectorAll('#subNavTools .sub-nav-btn').forEach(b => b.classList.remove('active'));
                    // Aktiven Button hervorheben
                    const btn = document.getElementById('btn' + toolId.charAt(0).toUpperCase() + toolId.slice(1));
                    if (btn) btn.classList.add('active');

                    // Alle Tool-Inhalte verstecken
                    document.querySelectorAll('[id^="content_tool"]').forEach(el => {
                        el.style.display = 'none';
                    });

                    // Gewähltes Tool anzeigen
                    const content = document.getElementById('content_' + toolId);
                    if (content) content.style.display = 'block';

                    if (toolId === 'toolQuiz') {
                        // Dynamischer Rollen-Check für Quiz
                        const isAdmin = (window.currentUserRole === 'admin' || window.currentUserRole === 'developer');
                        const btnGenerator = document.getElementById('btnQuizSubGenerator');
                        const btnManager = document.getElementById('btnQuizSubManager');
                        const lobbyArea = document.getElementById('quizLobbyArea');
                        const generatorArea = document.getElementById('quizGeneratorArea');
                        const leaderboardArea = document.getElementById('quizLeaderboardArea');
                        const managerArea = document.getElementById('quizManagerArea');

                        // API-Key laden
                        const apiKeyInput = document.getElementById('quizGeminiApiKey');
                        if (apiKeyInput && !apiKeyInput.value) {
                            apiKeyInput.value = localStorage.getItem('quiz_gemini_api_key') || '';
                        }

                        if (isAdmin) {
                            if (btnGenerator) btnGenerator.style.display = 'inline-block';
                            if (btnManager) btnManager.style.display = 'inline-block';
                        } else {
                            if (btnGenerator) btnGenerator.style.display = 'none';
                            if (btnManager) btnManager.style.display = 'none';
                        }

                        // Standardmäßig in der Lobby starten
                        if (window.switchQuizTab) {
                            window.switchQuizTab('lobby');
                        } else {
                            if (lobbyArea) lobbyArea.style.display = 'block';
                            if (generatorArea) generatorArea.style.display = 'none';
                            if (leaderboardArea) leaderboardArea.style.display = 'none';
                            if (managerArea) managerArea.style.display = 'none';
                        }

                        // Zähle Fragen in Lobby
                        if (window.updateLobbyQuestionsCount) {
                            window.updateLobbyQuestionsCount();
                        }
                    }

                    // Automatisch laden wenn GitHub Issues ausgewählt wird
                    if (toolId === 'toolGitHubIssues' && window.loadGitHubIssues) {
                        window.loadGitHubIssues();
                    }
                    
                    // Admin-Chat-Listener initialisieren falls Live-Chats angewählt
                    if (toolId === 'toolLiveChats' && window.initLiveChatsAdminListener) {
                        window.initLiveChatsAdminListener();
                    }
                };


        // --- AUTH LISTENER ---
        onAuthStateChanged(auth, async (user) => {
            if (window.isResettingPassword) {
                const loginOverlay = document.getElementById('loginOverlay');
                const introText = document.getElementById('introText');
                const loginForm = document.getElementById('loginForm');
                const registerForm = document.getElementById('registerForm');
                const resetForm = document.getElementById('resetPasswordForm');
                if (loginOverlay && resetForm) {
                    if (introText) introText.style.display = 'none';
                    if (loginForm) loginForm.style.display = 'none';
                    if (registerForm) registerForm.style.display = 'none';
                    resetForm.style.display = 'block';
                    loginOverlay.style.display = 'flex';
                    toggleMainScroll(false);
                }
                const loader = document.getElementById('initLoader');
                if (loader) loader.style.display = 'none';
                return;
            }
            const showQuiz = window.location.hostname.includes('test') || window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
            const showCarl = window.location.hostname.includes('test') || window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
            if (isRegistering) return;
            const loader = document.getElementById('initLoader'); const loginOverlay = document.getElementById('loginOverlay'); const internalTools = document.getElementById('internalTools'); const btnPdf = document.getElementById('btnPdf'); const menuAdminArea = document.getElementById('menuAdminArea'); const badge = document.getElementById('adminBadge'); const profileRoleDisplay = document.getElementById('profileRole');

            if (user) {
                console.log("[Auth] Benutzer ist angemeldet:", user.email, "UID:", user.uid);
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists() && userDoc.data().approved === true) {
                        // Vorname global speichern für Carl Assistant
                        window.currentUserFirstName = userDoc.data().firstName || (user.email ? user.email.split('@')[0] : "Kunde");

                        await loadPartsFromCloud();
                        await loadLamellenFromCloud();
                        // ERFOLGREICH EINGELOGGT
                        const userProfileEl = document.getElementById('userProfile');
                        if (userProfileEl) userProfileEl.style.display = 'block';
                        const carlWidget = document.getElementById('carlWidgetContainer');
                        if (carlWidget) carlWidget.style.display = showCarl ? 'block' : 'none';

                        const profileEmailEl = document.getElementById('profileEmail');
                        if (profileEmailEl) profileEmailEl.innerText = user.email;
                        if (loginOverlay) loginOverlay.style.display = 'none';

                        // Checkbox für Newsletter-Opt-In setzen (standardmäßig checked, wenn nicht explizit false)
                        const nlToggle = document.getElementById('userNewsletterToggle');
                        if (nlToggle) {
                            nlToggle.checked = userDoc.data().newsletterOptIn !== false;
                        }

                        toggleMainScroll(true); // SCROLLEN ERLAUBEN
                        checkOnboarding(user);
                        checkChangelogStatus();

                        const role = userDoc.data().role;
                        window.currentUserRole = role;
                        console.log("[Auth] Rolle aus Firestore geladen:", role);
                        if (window.checkKiServerStatus) {
                            window.checkKiServerStatus(); // Trigger Ollama-Verbindungsprüfung für Admins/Mitarbeiter
                        }
                        let roleName = "Kunde"; if (role === 'admin') roleName = "Admin"; if (role === 'employee') roleName = "Mitarbeiter";
                        if (profileRoleDisplay) profileRoleDisplay.innerText = roleName;

                        const branch = userDoc.data().branch || '';
                        const profileBranchDisplay = document.getElementById('profileBranch');
                        if (profileBranchDisplay) {
                            profileBranchDisplay.innerText = branch ? `Niederlassung: ${branch}` : '';
                            profileBranchDisplay.style.display = branch ? 'block' : 'none';
                        }

                        if (role === 'admin') {
                            console.log("[Auth] Wende UI-Konfiguration an für: Admin");
                            if (internalTools) internalTools.style.display = 'block';
                            // z.B. statt btnPdf.style.display='block';
                            if (document.getElementById('btnPdfContainer')) document.getElementById('btnPdfContainer').style.display = 'flex';

                            // Admin-Tools einblenden
                             if (document.getElementById('btnToolGitHubIssues')) document.getElementById('btnToolGitHubIssues').style.display = 'inline-block';
                             if (document.getElementById('btnToolLiveChats')) document.getElementById('btnToolLiveChats').style.display = 'inline-block';
                             if (document.getElementById('btnToolCarlManager')) document.getElementById('btnToolCarlManager').style.display = 'inline-block';
                             if (document.getElementById('btnToolQuiz')) document.getElementById('btnToolQuiz').style.display = showQuiz ? 'inline-block' : 'none';
                             if (document.getElementById('btnProfileUserSettings')) document.getElementById('btnProfileUserSettings').style.display = showQuiz ? 'flex' : 'none';

                            // Admin-Bereich einblenden & Mitarbeiterübersicht ausblenden
                            if (menuAdminArea) menuAdminArea.style.display = 'block';
                            if (document.getElementById('btnEmployeeUserList')) document.getElementById('btnEmployeeUserList').style.display = 'none';

                            // Roter Badge (Nutzer-Anfragen)
                            if (window.checkOpenRequests) window.checkOpenRequests();

                            // NEU: Gelber Badge (Tickets)
                            checkTicketStatus();

                            // Real-Time Admin Notification Badges initialisieren
                            if (window.initAdminNotificationBadges) {
                                window.initAdminNotificationBadges();
                            }
                        }

                        else if (role === 'employee') {
                            console.log("[Auth] Wende UI-Konfiguration an für: Mitarbeiter");
                            // Tools anzeigen
                            if (internalTools) internalTools.style.display = 'block';
                            // HIER GEÄNDERT: PDF Buttons auch für Mitarbeiter anzeigen
                            if (document.getElementById('btnPdfContainer')) document.getElementById('btnPdfContainer').style.display = 'flex';

                            // Admin-Tools ausblenden
                            if (document.getElementById('btnToolGitHubIssues')) document.getElementById('btnToolGitHubIssues').style.display = 'none';
                            if (document.getElementById('btnToolLiveChats')) document.getElementById('btnToolLiveChats').style.display = 'none';
                            if (document.getElementById('btnToolCarlManager')) document.getElementById('btnToolCarlManager').style.display = 'none';
                            if (document.getElementById('btnToolQuiz')) document.getElementById('btnToolQuiz').style.display = showQuiz ? 'inline-block' : 'none';
                            if (document.getElementById('btnProfileUserSettings')) document.getElementById('btnProfileUserSettings').style.display = showQuiz ? 'flex' : 'none';

                            // Admin-Bereich ausblenden
                            if (menuAdminArea) menuAdminArea.style.display = 'none';
                            if (badge) badge.style.display = 'none';

                            // NEU: Mitarbeiter-Liste anzeigen
                            if (document.getElementById('btnEmployeeUserList')) document.getElementById('btnEmployeeUserList').style.display = 'block';
                        }
                        else { 
                            console.log("[Auth] Wende UI-Konfiguration an für: Kunde");
                            if (internalTools) internalTools.style.display = 'none'; 
                            if (document.getElementById('btnPdfContainer')) document.getElementById('btnPdfContainer').style.display = 'none'; 
                            if (menuAdminArea) menuAdminArea.style.display = 'none'; 
                            if (badge) badge.style.display = 'none'; 
                            if (document.getElementById('btnToolGitHubIssues')) document.getElementById('btnToolGitHubIssues').style.display = 'none';
                            if (document.getElementById('btnToolLiveChats')) document.getElementById('btnToolLiveChats').style.display = 'none';
                            if (document.getElementById('btnToolCarlManager')) document.getElementById('btnToolCarlManager').style.display = 'none';
                            if (document.getElementById('btnToolQuiz')) document.getElementById('btnToolQuiz').style.display = 'none';
                            if (document.getElementById('btnProfileUserSettings')) document.getElementById('btnProfileUserSettings').style.display = 'none';
                            if (document.getElementById('inputDiscount1')) document.getElementById('inputDiscount1').value = 0; 
                            if (document.getElementById('inputDiscount2')) document.getElementById('inputDiscount2').value = 0; 
                        }
                        // =========================================================
                        // NEU: Sichtbarkeit des "Interne Tools" Tabs steuern
                        // =========================================================
                        const tabTools = document.getElementById('tabTOOLS');
                        if (tabTools) {
                            if (role === 'admin' || role === 'employee') {
                                tabTools.style.display = 'inline-block'; // Reiter wird sichtbar
                                if (role === 'admin' && window.initLiveChatsAdminListener) window.initLiveChatsAdminListener();
                            } else {
                                tabTools.style.display = 'none'; // Reiter bleibt versteckt
                            }
                        }
                        // =========================================================

                        if (typeof window.renderDynamicGateGraphic === 'function') {
                            window.renderDynamicGateGraphic();
                        }
                    
                    } else {
                        // USER EXISTIERT ABER NICHT FREIGEBEN
                        console.warn("[Auth] Benutzer existiert, ist aber nicht freigegeben.");
                        const userProfileEl = document.getElementById('userProfile');
                        if (userProfileEl) userProfileEl.style.display = 'none';
                        await signOut(auth);
                        const authMsg = document.getElementById('authMessage');
                        if (authMsg) authMsg.innerText = "Account noch nicht freigeschaltet.";
                        if (loginOverlay) loginOverlay.style.display = 'flex';
                        toggleMainScroll(false); // SCROLLEN VERBIETEN
                    }
                } catch (e) { console.error("[Auth] Fehler bei Rollenabfrage oder Datenabgleich:", e); }
            } else {
                // AUSGELOGGT (GÄSTE-MODUS)
                console.log("[Auth] Benutzer ist nicht angemeldet (Gast/Ausgeloggt).");
                window.currentUserRole = null;
                window.currentUserFirstName = "Kunde";

                // Admin Badge Streams aufräumen
                if (adminBadgesUnsubscribes) {
                    adminBadgesUnsubscribes.forEach(unsub => unsub());
                    adminBadgesUnsubscribes = [];
                }
                hasNewLiveChats = false;
                hasNewChatVerlaeufe = false;
                hasNewFehlerberichte = false;
                if (window.updateAdminBadgesUI) window.updateAdminBadgesUI();

                partsDB = {}; // WICHTIG: Daten im Speicher löschen wenn ausgeloggt
                const userProfileEl = document.getElementById('userProfile');
                if (userProfileEl) userProfileEl.style.display = 'none';
                if (loginOverlay) loginOverlay.style.display = 'flex';
                if (internalTools) internalTools.style.display = 'none';
                const btnPdfCont = document.getElementById('btnPdfContainer');
                if (btnPdfCont) btnPdfCont.style.display = 'none';
                
                // Carl KI-Assistent auch für Gäste (Kundenrolle vor dem Login) nur auf Testsystem anzeigen!
                const carlWidget = document.getElementById('carlWidgetContainer');
                if (carlWidget) {
                    carlWidget.style.display = showCarl ? 'block' : 'none';
                }

                const tabTools = document.getElementById('tabTOOLS');
                if (tabTools) tabTools.style.display = 'none';

                // NEU HINZUGEFÜGT:
                const quickBmTools = document.getElementById('quickBmTools');
                if (quickBmTools) quickBmTools.style.display = 'none';

                toggleMainScroll(false); // SCROLLEN VERBIETEN
            }
            if (loader) loader.style.display = 'none';
        });

        window.toggleProfileMenu = () => { const m = document.getElementById('profileMenu'); m.style.display = m.style.display === 'block' ? 'none' : 'block'; };
        window.logoutUser = async () => { await signOut(auth); location.reload(); };
        window.resetUserPassword = async () => { if (confirm("Passwort zurücksetzen?")) { const u = auth.currentUser; if (u && u.email) { try { await sendPasswordResetEmail(auth, u.email); alert("E-Mail gesendet."); } catch (e) { alert(e.message); } } } };

        window.handleConfirmPasswordReset = async () => {
            const newPassword = document.getElementById('newPassword').value;
            const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;
            const msgElement = document.getElementById('msgResetPassword');

            if (!msgElement) return;
            msgElement.innerText = "";

            if (!newPassword || newPassword.length < 6) {
                msgElement.innerText = "Das Passwort muss mindestens 6 Zeichen lang sein.";
                return;
            }

            if (newPassword !== newPasswordConfirm) {
                msgElement.innerText = "Die Passwörter stimmen nicht überein.";
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const oobCode = urlParams.get('oobCode');

            if (!oobCode) {
                msgElement.innerText = "Ungültiger oder abgelaufener Reset-Code.";
                return;
            }

            try {
                await confirmPasswordReset(auth, oobCode, newPassword);
                alert("Passwort erfolgreich geändert! Sie können sich nun mit dem neuen Passwort anmelden.");
                // URL Parameter säubern
                window.history.replaceState({}, document.title, window.location.pathname);
                window.isResettingPassword = false;
                
                // Formulare zurücksetzen und Login anzeigen
                document.getElementById('newPassword').value = '';
                document.getElementById('newPasswordConfirm').value = '';
                document.getElementById('resetPasswordForm').style.display = 'none';
                document.getElementById('introText').style.display = 'block';
                document.getElementById('loginForm').style.display = 'block';
                const msgLogin = document.getElementById('msgLogin');
                if (msgLogin) {
                    msgLogin.innerText = "Passwort erfolgreich geändert. Bitte loggen Sie sich ein.";
                    msgLogin.style.color = "green";
                }
            } catch (error) {
                console.error("Fehler beim Zurücksetzen des Passworts:", error);
                let userFriendlyError = "Fehler beim Zurücksetzen des Passworts: " + error.message;
                if (error.code === 'auth/expired-action-code') {
                    userFriendlyError = "Der Link ist abgelaufen. Bitte fordern Sie ein neues Passwort an.";
                } else if (error.code === 'auth/invalid-action-code') {
                    userFriendlyError = "Der Link ist ungültig oder wurde bereits verwendet.";
                } else if (error.code === 'auth/weak-password') {
                    userFriendlyError = "Das Passwort ist zu schwach.";
                }
                msgElement.innerText = userFriendlyError;
            }
        };

        window.cancelPasswordResetFlow = () => {
            window.history.replaceState({}, document.title, window.location.pathname);
            window.isResettingPassword = false;
            document.getElementById('newPassword').value = '';
            document.getElementById('newPasswordConfirm').value = '';
            document.getElementById('resetPasswordForm').style.display = 'none';
            document.getElementById('introText').style.display = 'block';
            document.getElementById('loginForm').style.display = 'block';
        };

        // MODALS: Scrollen verbieten wenn offen
        window.openLegalModal = (id) => { document.getElementById(id).style.display = 'flex'; toggleMainScroll(false); };

        // MODALS: Scrollen erlauben wenn zu (aber nur wenn Login nicht offen ist)
        window.closeLegalModal = (id) => {
            document.getElementById(id).style.display = 'none';
            const loginOpen = document.getElementById('loginOverlay').style.display !== 'none';
            if (!loginOpen) toggleMainScroll(true);
        };

        // --- ADMIN: PRODUKT MANAGER LOGIK (Inline Edit) ---

        let adminLocalData = [];
        let currentInlineEditId = null;

        // --- NEU: Sortier-Status ---
        let adminSortCol = 'id';
        let adminSortDesc = false; // false = A-Z, true = Z-A

        window.sortAdminTable = (col) => {
            if (adminSortCol === col) {
                adminSortDesc = !adminSortDesc; // Richtung umdrehen
            } else {
                adminSortCol = col;
                adminSortDesc = false; // Neue Spalte immer erst A-Z
            }
            window.renderAdminTable(); // Tabelle sofort neu zeichnen
        };

        window.openProductManager = async () => {
            const profileMenu = document.getElementById('profileMenu');
            if (profileMenu) profileMenu.style.display = 'none';
            document.getElementById('adminProductModal').style.display = 'flex';
            if (window.toggleMainScroll) window.toggleMainScroll(false);

            currentInlineEditId = null;
            document.getElementById('adminSeriesFilter').value = 'all';
            await loadAdminProductsDB();
        };

        window.closeAdminManager = () => {
            document.getElementById('adminProductModal').style.display = 'none';
            if (window.toggleMainScroll) window.toggleMainScroll(true);
            if (window.loadPartsFromCloud) window.loadPartsFromCloud();
        };

        // Holt Daten aus Firestore und speichert sie lokal im Array (für das Admin Menü)
        async function loadAdminProductsDB() {
            const tbody = document.getElementById('adminProductList');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="16" class="text-center" style="padding:20px; color:#666;">Lade Datenbank...</td></tr>';

            try {
                const querySnapshot = await getDocs(collection(db, "products"));
                adminLocalData = [];

                querySnapshot.forEach((docSnap) => {
                    if (docSnap.id === "SYSTEM_LAMELLEN_MATRIX") return; // Matrix hier ausblenden

                    const d = docSnap.data();
                    // Wenn keine Rubrik vorhanden ist, Standard "Beschlagteile für Torglieder" setzen
                    if (!d.category) {
                        d.category = "Beschlagteile für Torglieder";
                        updateDoc(doc(db, "products", docSnap.id), { category: "Beschlagteile für Torglieder" }).catch(() => {});
                    }
                    adminLocalData.push({ id: docSnap.id, ...d });
                });

                // Initial-Drahtseile in Firestore und lokales Array synchronisieren, falls noch nicht vorhanden
                for (const item of INITIAL_DRAHTSEIL_PRODUCTS) {
                    if (!adminLocalData.find(x => x.id === item.id)) {
                        adminLocalData.push({ ...item, createdAt: new Date(), updatedAt: new Date() });
                        setDoc(doc(db, "products", item.id), {
                            ...item,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        }).catch(err => console.warn("Sync err for", item.id, err));
                    }
                }

                // Alphabetisch sortieren
                adminLocalData.sort((a, b) => (a.id).localeCompare(b.id));
                window.renderAdminTable();

            } catch (e) {
                console.error("Admin Error:", e);
                tbody.innerHTML = `<tr><td colspan="16" style="color:red; padding:10px;">Fehler: ${e.message}</td></tr>`;
            }
        }

        // Kopieren / Duplizieren eines Produkts als Vorlage für ein neues Produkt
        window.copiedProductData = null;
        window.copyProduct = (id) => {
            const p = adminLocalData.find(x => x.id === id);
            if (!p) return;
            window.copiedProductData = JSON.parse(JSON.stringify(p));
            currentInlineEditId = 'NEW';
            window.renderAdminTable();
            setTimeout(() => {
                const idInput = document.getElementById('inline_id_NEW');
                if (idInput) {
                    idInput.focus();
                    idInput.select();
                    idInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
        };

        // Rendert die Tabelle basierend auf lokalen Daten, Filter, Suche, Sortierung und Edit-State
        window.renderAdminTable = () => {
            const tbody = document.getElementById('adminProductList');
            if (!tbody) return;

            const filterEl = document.getElementById('adminSeriesFilter');
            const filterVal = filterEl ? filterEl.value : 'all';

            const catFilterEl = document.getElementById('adminCategoryFilter');
            const catFilterVal = catFilterEl ? catFilterEl.value : 'all';

            const searchInput = document.getElementById('adminSearchInput');
            const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

            let html = '';
            let matchedCount = 0;

            try {
                // --- 1. SORTIERUNG DER DATEN ---
                adminLocalData.sort((a, b) => {
                    const fallbackTime = new Date(2026, 1, 20).getTime();

                    if (adminSortCol === 'createdAt') {
                        let tA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : fallbackTime;
                        let tB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : fallbackTime;
                        return adminSortDesc ? tB - tA : tA - tB;
                    }
                    else if (adminSortCol === 'updatedAt') {
                        // Sortierung nach Änderungsdatum (mit Fallback auf Erstellungsdatum)
                        let tA = a.updatedAt ? (a.updatedAt.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt).getTime()) : (a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : fallbackTime);
                        let tB = b.updatedAt ? (b.updatedAt.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt).getTime()) : (b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : fallbackTime);
                        return adminSortDesc ? tB - tA : tA - tB;
                    }
                    else if (adminSortCol === 'priceDate') {
                        let pA = a.priceDate || 0;
                        let pB = b.priceDate || 0;
                        return adminSortDesc ? pB - pA : pA - pB;
                    }

                    let valA = a[adminSortCol] !== undefined ? a[adminSortCol] : '';
                    let valB = b[adminSortCol] !== undefined ? b[adminSortCol] : '';

                    if (adminSortCol === 'price') {
                        valA = parseFloat(valA) || 0;
                        valB = parseFloat(valB) || 0;
                        return adminSortDesc ? valB - valA : valA - valB;
                    } else {
                        valA = String(valA).toLowerCase();
                        valB = String(valB).toLowerCase();
                        if (valA < valB) return adminSortDesc ? 1 : -1;
                        if (valA > valB) return adminSortDesc ? -1 : 1;
                        return 0;
                    }
                });

                // --- 2. OPTIK DER SORTIER-PFEILE ---
                const sortCols = ['id', 'name', 'artNr', 'price', 'createdAt', 'updatedAt', 'priceDate', 'category'];
                sortCols.forEach(col => {
                    const iconSpan = document.getElementById(`sortIcon_${col}`);
                    if (iconSpan) {
                        iconSpan.innerText = (adminSortCol === col) ? (adminSortDesc ? "▼" : "▲") : "↕";
                        iconSpan.className = (adminSortCol === col) ? "sort-icon sort-active" : "sort-icon";
                    }
                });

                const artNrCounts = {};
                adminLocalData.forEach(p => {
                    const nr = p.artNr ? String(p.artNr).trim() : '';
                    if (nr) artNrCounts[nr] = (artNrCounts[nr] || 0) + 1;
                });

                const renderTagsBadge = (arr, defaultColor) => {
                    if (!arr || arr.length === 0) return '';

                    // Baureihen auch hier sortieren
                    let sortedArr = [...arr];
                    if (arr.includes('BR40') || arr.includes('BR30')) {
                        sortedArr.sort((a, b) => {
                            const order = { "BR40": 1, "BR30": 2, "BR20": 3 };
                            return (order[a] || 99) - (order[b] || 99);
                        });
                    }

                    return sortedArr.map(t => {
                        let colorHex = defaultColor;
                        let bgHex = defaultColor + '15'; // 15 ist die hexadezimale Deckkraft (Transparenz)

                        if (t === 'BR40') { colorHex = '#005596'; bgHex = '#eaf4fb'; }
                        else if (t === 'BR30') { colorHex = '#e67e22'; bgHex = '#fdf2e9'; }
                        else if (t === 'BR20') { colorHex = '#27ae60'; bgHex = '#eafaf1'; }
                        else if (t === 'Z' || t === 'N' || t === 'L') { colorHex = '#8e44ad'; bgHex = '#f5eef8'; } // Lila

                        return `<span style="background:${bgHex}; color:${colorHex}; border:1px solid ${colorHex}40; padding:1px 4px; border-radius:3px; font-size:0.65rem; margin-right:3px; margin-bottom:3px; display:inline-block; font-weight:bold;">${t}</span>`;
                    }).join('');
                };

                const getTagsEditor = (p, idStr) => {
                    const sTags = p.seriesTags || [];
                    const fTags = p.fittingTags || [];
                    const pTags = p.positionTags || [];
                    const cat = p.category || 'Beschlagteile für Torglieder';

                    return `
                        <select id="inline_cat_${idStr}" class="admin-input" style="padding: 4px; font-size: 0.8rem; width: 100%; margin-bottom: 5px;">
                            <option value="Beschlagteile für Torglieder" ${(!cat || cat === 'Beschlagteile für Torglieder') ? 'selected' : ''}>Beschlagteile für Torglieder</option>
                            <option value="Zubehör für Torglieder" ${cat === 'Zubehör für Torglieder' ? 'selected' : ''}>Zubehör für Torglieder</option>
                            <option value="Zargen" ${cat === 'Zargen' ? 'selected' : ''}>Zargen</option>
                            <option value="Allgemeines Zubehör" ${cat === 'Allgemeines Zubehör' ? 'selected' : ''}>Allgemeines Zubehör</option>
                        </select>
                        <div class="admin-tags-container">
                            <div class="admin-tag-group">
                                <div class="admin-tag-label">Baureihe</div>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_series_br40_${idStr}" value="BR40" ${sTags.includes('BR40') ? 'checked' : ''}> BR40</label>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_series_br30_${idStr}" value="BR30" ${sTags.includes('BR30') ? 'checked' : ''}> BR30</label>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_series_br20_${idStr}" value="BR20" ${sTags.includes('BR20') ? 'checked' : ''}> BR20</label>
                            </div>
                            <div class="admin-tag-group">
                                <div class="admin-tag-label">Beschlag</div>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_fit_z_${idStr}" value="Z" ${fTags.includes('Z') ? 'checked' : ''}> Z</label>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_fit_n_${idStr}" value="N" ${fTags.includes('N') ? 'checked' : ''}> N</label>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_fit_l_${idStr}" value="L" ${fTags.includes('L') ? 'checked' : ''}> L</label>
                            </div>
                            <div class="admin-tag-group">
                                <div class="admin-tag-label">Position</div>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_pos_top_${idStr}" value="Top" ${pTags.includes('Top') ? 'checked' : ''}> Top</label>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_pos_mitte_${idStr}" value="Mitte" ${pTags.includes('Mitte') ? 'checked' : ''}> Mitte</label>
                                <label class="admin-tag-cb"><input type="checkbox" id="tag_pos_boden_${idStr}" value="Boden" ${pTags.includes('Boden') ? 'checked' : ''}> Boden</label>
                            </div>
                        </div>
                    `;
                };

                const formatPriceDate = (dInt) => {
                    if (!dInt) return "-";
                    const str = String(dInt);
                    if (str.length === 8) return `${str.slice(6, 8)}.${str.slice(4, 6)}.${str.slice(0, 4)}`;
                    return "-";
                };

                const formatDate = (ts) => {
                    if (!ts) return "-";
                    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
                    return new Date(ts).toLocaleDateString();
                };

                if (currentInlineEditId === 'NEW') {
                    const tpl = window.copiedProductData || {};
                    const tplLinks = (tpl.linkedParts && Array.isArray(tpl.linkedParts)) ? tpl.linkedParts.join(', ') : '';
                    html += `
                        <tr class="inline-edit-row" style="border-bottom:2px solid var(--hormann-blue); background: #eaf4fb;">
                            <td></td><td>-neu-</td>
                            <td><input type="text" id="inline_id_NEW" class="inline-input" placeholder="ID (z.B. seil_z_2500)" value="${tpl.id ? (tpl.id + '_kopie') : ''}"></td>
                            <td><input type="text" id="inline_name_NEW" class="inline-input" placeholder="Name" value="${tpl.name ? (tpl.name + ' (Kopie)') : ''}"></td>
                            <td><input type="text" id="inline_artnr_NEW" class="inline-input" placeholder="Art.Nr" value="${tpl.artNr || ''}"></td>
                            <td><input type="number" id="inline_price_NEW" class="inline-input" step="0.01" value="${tpl.price !== undefined ? tpl.price : '0.00'}"></td>
                            <td><input type="number" id="inline_sort_NEW" class="inline-input" value="${tpl.sortIndex !== undefined ? tpl.sortIndex : 100}"></td>
                            <td><input type="text" id="inline_desc_NEW" class="inline-input" placeholder="Kurzbeschreibung..." value="${tpl.desc || ''}"></td>
                            <td><input type="text" id="inline_links_NEW" class="inline-input" placeholder="ID1, ID2" value="${tplLinks}"></td>
                            <td><input type="text" id="inline_path_NEW" class="inline-input" placeholder="img/..." value="${tpl.path || ''}"></td>
                            <td>
                                <div class="admin-actions">
                                    <button class="btn-edit" onclick="saveInlineProduct('NEW')" title="Speichern">💾</button>
                                    <button class="btn-delete" onclick="cancelInlineEdit()" title="Abbrechen">✕</button>
                                </div>
                            </td>
                            <td style="font-size:0.75rem; color:#888;">(Heute)</td>
                            <td style="font-size:0.75rem; color:#888;">-</td>
                            <td style="font-size:0.75rem; color:#888;">-</td>
                            <td>${getTagsEditor(tpl, 'NEW')}</td>
                        </tr>
                    `;
                }

                adminLocalData.forEach((p) => {
                    const lowerId = p.id.toLowerCase();
                    const lowerDesc = (p.desc || "").toLowerCase();
                    const pCat = p.category || "Beschlagteile für Torglieder";

                    // 1. Baureihen-Filter
                    let matchesSeries = false;
                    if (filterVal === "all") { matchesSeries = true; }
                    else if (filterVal === "br20") { if (lowerId.includes('br20') || lowerDesc.includes('br20') || lowerDesc.includes('baureihe 20') || (p.seriesTags && p.seriesTags.includes('BR20'))) matchesSeries = true; }
                    else if (filterVal === "br30") { if (lowerId.includes('br30') || lowerDesc.includes('br30') || lowerDesc.includes('baureihe 30') || (p.seriesTags && p.seriesTags.includes('BR30'))) matchesSeries = true; }
                    else if (filterVal === "br40") {
                        if (lowerId.includes('br40') || lowerDesc.includes('br40') || lowerDesc.includes('baureihe 40') || (p.seriesTags && p.seriesTags.includes('BR40'))) { matchesSeries = true; }
                        else if (!lowerId.includes('br20') && !lowerId.includes('br30') && !lowerDesc.includes('br20') && !lowerDesc.includes('br30') && !lowerDesc.includes('baureihe 20') && !lowerDesc.includes('baureihe 30')) { matchesSeries = true; }
                    }
                    if (!matchesSeries) return;

                    // 2. Rubrik-Filter
                    if (catFilterVal !== 'all') {
                        if (pCat !== catFilterVal) return;
                    }

                    // 3. Live-Suche (Volltext über ID, Name, Art.-Nr., Beschreibung, Rubrik, Tags, Verknüpfungen)
                    if (searchVal) {
                        const searchContent = [
                            p.id,
                            p.name || '',
                            p.artNr ? String(p.artNr) : '',
                            p.desc || '',
                            pCat,
                            (p.linkedParts || []).join(' '),
                            p.path || '',
                            ...(p.seriesTags || []),
                            ...(p.fittingTags || []),
                            ...(p.positionTags || [])
                        ].join(' ').toLowerCase();

                        if (!searchContent.includes(searchVal)) return;
                    }

                    matchedCount++;

                    const imgTag = (p.path && p.path.length > 5) ? `<div class="admin-thumbnail-wrapper"><img src="${p.path}" class="admin-thumbnail"></div>` : '-';
                    let linkedStr = (p.linkedParts && Array.isArray(p.linkedParts)) ? p.linkedParts.join(', ') : '';

                    const nrStr = p.artNr ? String(p.artNr).trim() : '';
                    let artNrDisplay = p.artNr || '-';
                    if (nrStr && artNrCounts[nrStr] > 1) {
                        artNrDisplay = `<span style="background: #fff3cd; color: #d35400; border: 1px solid #ffeeba; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; white-space: nowrap;" title="Wird ${artNrCounts[nrStr]}x verwendet">${p.artNr} 🔄</span>`;
                    }

                    let dateDisplay = p.createdAt ? formatDate(p.createdAt) : "20.02.2026";
                    let updateDisplay = p.updatedAt ? formatDate(p.updatedAt) : "-";
                    const priceDateDisplay = formatPriceDate(p.priceDate);

                    // History Icon
                    let historyIcon = '';
                    if (p.history && p.history.length > 0) {
                        historyIcon = `<span onclick="showProductHistory('${p.id}')" style="cursor:pointer; margin-left: 5px; font-size: 1rem;" title="Änderungshistorie anzeigen">📜</span>`;
                    }

                    if (currentInlineEditId === p.id) {
                        html += `
                            <tr class="inline-edit-row" style="border-bottom:1px solid #ccc;">
                                <td></td><td>${imgTag}</td>
                                <td style="font-family:monospace; color:#555;">${p.id}</td>
                                <td><input type="text" id="inline_name_${p.id}" class="inline-input" value="${p.name || ''}"></td>
                                <td><input type="text" id="inline_artnr_${p.id}" class="inline-input" value="${p.artNr || ''}"></td>
                                <td><input type="number" id="inline_price_${p.id}" class="inline-input" step="0.01" value="${p.price !== undefined ? p.price : 0}"></td>
                                <td><input type="number" id="inline_sort_${p.id}" class="inline-input" value="${p.sortIndex !== undefined ? p.sortIndex : 100}"></td>
                                <td><input type="text" id="inline_desc_${p.id}" class="inline-input" value="${p.desc || ''}"></td>
                                <td><input type="text" id="inline_links_${p.id}" class="inline-input" value="${linkedStr}"></td>
                                <td><input type="text" id="inline_path_${p.id}" class="inline-input" value="${p.path || ''}"></td>
                                <td>
                                    <div class="admin-actions" style="display:flex; gap:4px; align-items:center;">
                                        <button class="btn-edit" onclick="saveInlineProduct('${p.id}')" title="Speichern">💾</button>
                                        <button class="btn-delete" onclick="cancelInlineEdit()" title="Abbrechen">✕</button>
                                    </div>
                                </td>
                                <td style="font-size:0.75rem;">${dateDisplay}</td>
                                <td style="font-size:0.75rem; color:var(--hormann-blue); font-weight:bold;">(Speichern)</td>
                                <td style="font-size:0.75rem; color:#888;">${priceDateDisplay}</td>
                                <td>${getTagsEditor(p, p.id)}</td>
                            </tr>
                        `;
                    } else {
                        html += `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="text-align:center;"><input type="checkbox" class="admin-row-cb" value="${p.id}" onchange="checkMassDeleteButton()"></td>
                                <td>${imgTag}</td>
                                <td style="font-family:monospace; color:#555; word-break: break-all;">${p.id}</td>
                                <td><strong>${p.name || ''}</strong></td>
                                <td>${artNrDisplay}</td>
                                <td style="text-align:right;">${(parseFloat(p.price) || 0).toFixed(2).replace('.', ',')} €</td>
                                <td>${p.sortIndex !== undefined ? p.sortIndex : ''}</td>
                                <td style="font-size: 0.75rem; color:#666;">${p.desc || '-'}</td>
                                <td style="word-break: break-all; font-size: 0.75rem;">${linkedStr}</td>
                                <td style="word-break: break-all; font-size: 0.75rem; color:#888;">${p.path || '-'}</td>
                                <td>
                                    <div class="admin-actions" style="display:flex; gap:4px; align-items:center;">
                                        <button class="btn-edit" onclick="startInlineEdit('${p.id}')" title="Bearbeiten">✏️</button>
                                        <button class="btn-edit" onclick="copyProduct('${p.id}')" title="Artikel duplizieren / als Vorlage kopieren" style="background:#0284c7; color:#fff;">📋</button>
                                        <button class="btn-delete" onclick="deleteProduct('${p.id}', '${p.name}')" title="Löschen">🗑️</button>
                                    </div>
                                </td>
                                <td style="font-size: 0.75rem; color:#666;">${dateDisplay}</td>
                                <td style="font-size: 0.75rem; color:#666; display:flex; align-items:center;">${updateDisplay} ${historyIcon}</td>
                                <td style="font-size: 0.75rem; color:var(--hormann-blue); font-weight:bold;">${priceDateDisplay}</td>
                                <td><div style="font-size: 0.75rem; font-weight:bold; color:#555; margin-bottom:4px;">${pCat}</div><div style="display:flex; flex-wrap:wrap; max-width:200px;">${renderTagsBadge(p.seriesTags, '#005596')}${renderTagsBadge(p.fittingTags, '#e67e22')}${renderTagsBadge(p.positionTags, '#27ae60')}</div></td>
                            </tr>
                        `;
                    }
                });

                tbody.innerHTML = html || '<tr><td colspan="16" class="text-center" style="padding:20px; color:#888;">Keine Produkte gefunden.</td></tr>';

                // Produkt-Zähler Badge aktualisieren
                const badgeEl = document.getElementById('adminProductCountBadge');
                if (badgeEl) {
                    badgeEl.innerText = `${matchedCount} von ${adminLocalData.length} Produkten`;
                }

                const masterCb = document.getElementById('selectAllAdmin');
                if (masterCb) masterCb.checked = false;
                if (typeof checkMassDeleteButton === 'function') checkMassDeleteButton();

            } catch (error) {
                console.error("Render Error:", error);
                tbody.innerHTML = `<tr><td colspan="16" style="color:red; padding:20px;">Fehler beim Rendern der Tabelle: ${error.message}</td></tr>`;
            }
        };

        // --- INLINE EDITING & HISTORIE ---
        window.startInlineEdit = (id) => {
            if (id === 'NEW' && currentInlineEditId !== 'NEW') {
                window.copiedProductData = null;
            }
            currentInlineEditId = id;
            window.renderAdminTable();
        };

        window.cancelInlineEdit = () => {
            currentInlineEditId = null;
            window.copiedProductData = null;
            window.renderAdminTable();
        };

        window.saveInlineProduct = async (id) => {
            const isNew = (id === 'NEW');
            const targetId = isNew ? document.getElementById('inline_id_NEW').value.trim().replace(/[^a-zA-Z0-9_]/g, '') : id;

            if (!targetId) return alert("Bitte eine eindeutige ID vergeben!");

            const name = document.getElementById(`inline_name_${id}`).value.trim();
            const priceRaw = document.getElementById(`inline_price_${id}`).value.replace(',', '.');
            const price = parseFloat(priceRaw);

            if (!name || isNaN(price)) return alert("Name und ein gültiger Preis sind Pflichtfelder.");

            // Duplikatswarnung
            const currentArtNr = document.getElementById(`inline_artnr_${id}`).value.trim();
            if (currentArtNr) {
                const duplicates = adminLocalData.filter(p => p.artNr === currentArtNr && p.id !== targetId);
                if (duplicates.length > 0) {
                    const dupNames = duplicates.map(d => `${d.name} (ID: ${d.id})`).join('\n- ');
                    if (!confirm(`ACHTUNG: Die Artikelnummer ${currentArtNr} wird bereits verwendet bei:\n\n- ${dupNames}\n\nTrotzdem speichern?`)) return;
                }
            }

            // Alte Daten laden, um Änderungen zu vergleichen
            const oldItem = adminLocalData.find(p => p.id === id);

            // --- NEU: TAGS AUSLESEN ---
            const sTags = [];
            if (document.getElementById(`tag_series_br40_${id}`)?.checked) sTags.push('BR40');
            if (document.getElementById(`tag_series_br30_${id}`)?.checked) sTags.push('BR30');
            if (document.getElementById(`tag_series_br20_${id}`)?.checked) sTags.push('BR20');

            const fTags = [];
            if (document.getElementById(`tag_fit_z_${id}`)?.checked) fTags.push('Z');
            if (document.getElementById(`tag_fit_n_${id}`)?.checked) fTags.push('N');
            if (document.getElementById(`tag_fit_l_${id}`)?.checked) fTags.push('L');

            const pTags = [];
            if (document.getElementById(`tag_pos_top_${id}`)?.checked) pTags.push('Top');
            if (document.getElementById(`tag_pos_mitte_${id}`)?.checked) pTags.push('Mitte');
            if (document.getElementById(`tag_pos_boden_${id}`)?.checked) pTags.push('Boden');

            let data = {
                name: name,
                artNr: currentArtNr,
                price: price,
                sortIndex: parseInt(document.getElementById(`inline_sort_${id}`).value) || 100,
                desc: document.getElementById(`inline_desc_${id}`).value.trim(),
                path: document.getElementById(`inline_path_${id}`).value.trim(),
                category: document.getElementById(`inline_cat_${id}`).value,
                seriesTags: sTags,
                fittingTags: fTags,
                positionTags: pTags,
                linkedParts: []
            };

            const linkedStr = document.getElementById(`inline_links_${id}`).value;
            if (linkedStr) data.linkedParts = linkedStr.split(',').map(s => s.trim()).filter(s => s !== '');

            // --- ÄNDERUNGSPROTOKOLL & DATUMS-LOGIK ---
            let changes = [];
            let newPriceDate = oldItem ? oldItem.priceDate : null;
            let existingHistory = oldItem && oldItem.history ? [...oldItem.history] : [];

            if (isNew) {
                data.createdAt = serverTimestamp();
                data.updatedAt = serverTimestamp();
                // Beim Neuanlegen wird das Preisdatum sofort auf HEUTE gesetzt
                const today = new Date();
                newPriceDate = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
                changes.push("Produkt neu angelegt.");
            } else if (oldItem) {
                if (oldItem.name !== data.name) changes.push(`Name: '${oldItem.name || '-'}' ➔ '${data.name}'`);
                if (oldItem.artNr !== data.artNr) changes.push(`Art.Nr: '${oldItem.artNr || '-'}' ➔ '${data.artNr || '-'}'`);

                // --- BESSERE BESCHREIBUNGS-HISTORIE ---
                if (oldItem.desc !== data.desc) {
                    changes.push(`Beschr: '${oldItem.desc || '-'}' ➔ '${data.desc || '-'}'`);
                }

                if (oldItem.category !== data.category) changes.push(`Rubrik: '${oldItem.category || '-'}' ➔ '${data.category || '-'}'`);

                // --- NEU: TAG-ÄNDERUNGEN PROTOKOLLIEREN ---
                const oldSeries = (oldItem.seriesTags || []).sort().join(', ');
                const newSeries = (data.seriesTags || []).sort().join(', ');
                if (oldSeries !== newSeries) changes.push(`Baureihen: [${oldSeries || '-'}] ➔ [${newSeries || '-'}]`);

                const oldFit = (oldItem.fittingTags || []).sort().join(', ');
                const newFit = (data.fittingTags || []).sort().join(', ');
                if (oldFit !== newFit) changes.push(`Beschläge: [${oldFit || '-'}] ➔ [${newFit || '-'}]`);

                const oldPos = (oldItem.positionTags || []).sort().join(', ');
                const newPos = (data.positionTags || []).sort().join(', ');
                if (oldPos !== newPos) changes.push(`Positionen: [${oldPos || '-'}] ➔ [${newPos || '-'}]`);

                // Preisprüfung
                if (oldItem.price !== data.price) {
                    changes.push(`Preis: ${formatEur(oldItem.price)} ➔ ${formatEur(data.price)}`);
                    // Preisdatum auf HEUTE setzen
                    const today = new Date();
                    newPriceDate = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
                }
            }

            data.priceDate = newPriceDate;

            // Wenn sich etwas geändert hat, in die Historie schreiben
            if (changes.length > 0 && !isNew) {
                data.updatedAt = serverTimestamp();

                let author = "Admin";
                if (auth.currentUser && auth.currentUser.email) author = auth.currentUser.email.split('@')[0];

                existingHistory.push({
                    dateISO: new Date().toISOString(),
                    user: author,
                    notes: changes
                });

                // Limitiere die Historie auf die letzten 30 Einträge
                if (existingHistory.length > 30) existingHistory = existingHistory.slice(-30);

                data.history = existingHistory;
            } else if (oldItem && oldItem.history) {
                data.history = oldItem.history;
            } else if (isNew) {
                data.history = [{ dateISO: new Date().toISOString(), user: "System", notes: changes }];
            }

            try {
                await setDoc(doc(db, "products", targetId), data, { merge: true });

                // Lokales Array updaten
                if (isNew) {
                    adminLocalData.push({ id: targetId, ...data, createdAt: new Date(), updatedAt: new Date() });
                } else {
                    const idx = adminLocalData.findIndex(p => p.id === id);
                    if (idx > -1) adminLocalData[idx] = { ...oldItem, ...data, updatedAt: new Date() };
                }

                currentInlineEditId = null;
                window.renderAdminTable();

            } catch (e) {
                console.error(e);
                alert("Fehler beim Speichern: " + e.message);
            }
        };

        // --- Historien-Fenster aufrufen ---
        window.showProductHistory = (id) => {
            const item = adminLocalData.find(p => p.id === id);
            if (!item || !item.history || item.history.length === 0) return;

            document.getElementById('historySubtitle').innerText = `Historie für: ${item.name} (${item.artNr || 'Keine ArtNr'})`;

            const container = document.getElementById('historyListContainer');
            let html = '';

            const sortedHistory = [...item.history].reverse();

            sortedHistory.forEach(entry => {
                const dateObj = new Date(entry.dateISO);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let changesHtml = entry.notes.map(n => `<li>${n}</li>`).join('');

                html += `
                    <div style="background: #f9f9f9; border-left: 3px solid var(--hormann-blue); padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.8rem; color: #666;">
                            <strong>🕒 ${dateStr}</strong>
                            <span>👤 ${entry.user}</span>
                        </div>
                        <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; color: #333;">
                            ${changesHtml}
                        </ul>
                    </div>
                `;
            });

            container.innerHTML = html;
            document.getElementById('productHistoryModal').style.display = 'flex';
        };
        // --- ADMIN: NEUE CHECKBOX & MASSEN-LÖSCHEN LOGIK ---
        window.toggleAllAdminCheckboxes = (masterCheckbox) => {
            const checkboxes = document.querySelectorAll('.admin-row-cb');
            checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
            window.checkMassDeleteButton();
        };

        window.checkMassDeleteButton = () => {
            const anyChecked = document.querySelectorAll('.admin-row-cb:checked').length > 0;
            const btn = document.getElementById('btnMassDeleteAdmin');
            if (btn) btn.style.display = anyChecked ? 'inline-block' : 'none';
        };

        window.deleteProduct = async (id, name) => {
            if (!confirm(`WARNUNG: Möchten Sie das Bauteil "${name}" (ID: ${id}) wirklich unwiderruflich löschen?`)) return;

            try {
                await deleteDoc(doc(db, "products", id));

                // Aus dem lokalen Array entfernen
                adminLocalData = adminLocalData.filter(p => p.id !== id);

                // Tabelle neu zeichnen
                window.renderAdminTable();

                // Massenlösch-Button prüfen
                if (typeof window.checkMassDeleteButton === 'function') {
                    window.checkMassDeleteButton();
                }
            } catch (e) {
                console.error(e);
                alert("Fehler beim Löschen: " + e.message);
            }
        };

        window.deleteSelectedProducts = async () => {
            const checkedBoxes = document.querySelectorAll('.admin-row-cb:checked');
            if (checkedBoxes.length === 0) return;

            if (!confirm(`WARNUNG: Möchten Sie wirklich ${checkedBoxes.length} Bauteile unwiderruflich löschen?`)) return;

            document.body.style.cursor = 'wait';
            const btn = document.getElementById('btnMassDeleteAdmin');
            btn.innerText = "Lösche..."; btn.disabled = true;

            let deletePromises = [];
            let idsToDelete = [];

            checkedBoxes.forEach(cb => {
                const id = cb.value;
                idsToDelete.push(id);
                deletePromises.push(deleteDoc(doc(db, "products", id)));
            });

            try {
                await Promise.all(deletePromises);
                adminLocalData = adminLocalData.filter(p => !idsToDelete.includes(p.id));
                window.renderAdminTable();
                alert(`${checkedBoxes.length} Bauteile erfolgreich gelöscht.`);
            } catch (e) {
                console.error(e);
                alert("Fehler beim Massenlöschen: " + e.message);
            } finally {
                document.body.style.cursor = 'default';
                btn.innerText = "🗑️ Markierte löschen"; btn.disabled = false;
            }
        };

        // --- UMSCHALTEN DER ADMIN-REITER ---
        window.switchAdminProductTab = (tab) => {
            const btnStd = document.getElementById('adminTabStandard');
            const btnLam = document.getElementById('adminTabLamellen');
            const viewStd = document.getElementById('adminStandardView');
            const viewLam = document.getElementById('adminLamellenView');

            if (btnStd) btnStd.classList.remove('active');
            if (btnLam) btnLam.classList.remove('active');
            if (viewStd) viewStd.style.display = 'none';
            if (viewLam) viewLam.style.display = 'none';

            if (tab === 'standard') {
                if (btnStd) btnStd.classList.add('active');
                if (viewStd) viewStd.style.display = 'flex';
            } else {
                if (btnLam) btnLam.classList.add('active');
                if (viewLam) viewLam.style.display = 'flex';
            }
        };

        // --- ADMIN: CSV IMPORT & PREIS-UPDATE (MIT VORSCHAU & SMART PARSING) ---
        let pendingCSVImport = null;

        window.showPreviewModal = (title, contentHtml, disableConfirm = false) => {
            const titleEl = document.getElementById('csvPreviewTitle');
            const contentEl = document.getElementById('csvPreviewContent');
            const modalEl = document.getElementById('csvPreviewModal');

            if (!titleEl || !contentEl || !modalEl) {
                alert("Vorschau konnte nicht geladen werden (HTML-Element fehlt). Aktion wird abgebrochen.");
                return;
            }

            titleEl.innerText = title;
            contentEl.innerHTML = contentHtml;
            const btn = document.getElementById('btnConfirmCSV');
            btn.disabled = disableConfirm;
            btn.style.opacity = disableConfirm ? "0.5" : "1";
            modalEl.style.display = 'flex';
        };

        window.closePreviewModal = () => {
            const modalEl = document.getElementById('csvPreviewModal');
            if (modalEl) modalEl.style.display = 'none';
            pendingCSVImport = null;
        };

        window.confirmCSVAction = async () => {
            if (!pendingCSVImport) return;
            const btn = document.getElementById('btnConfirmCSV');
            btn.disabled = true;
            btn.innerText = "Verarbeite...";

            try {
                if (pendingCSVImport.type === 'new') {
                    let countAdded = 0;
                    for (let item of pendingCSVImport.data) {
                        const { systemId, ...newData } = item;
                        await setDoc(doc(db, "products", systemId), newData);
                        adminLocalData.push({ id: systemId, ...newData });
                        countAdded++;
                    }
                    alert(`Import abgeschlossen. ${countAdded} neue Produkte wurden hinzugefügt.`);
                }
                else if (pendingCSVImport.type === 'price') {
                    let updatePromises = [];
                    pendingCSVImport.data.forEach(u => {
                        const item = adminLocalData.find(p => p.id === u.id);
                        if (item) {
                            item.price = u.newPrice;
                            item.priceDate = u.priceDate; // NEU: Datum wird lokal gespeichert!
                        }
                        // NEU: Datum wird in die Firebase-Datenbank geschrieben!
                        updatePromises.push(updateDoc(doc(db, "products", u.id), {
                            price: u.newPrice,
                            priceDate: u.priceDate
                        }));
                    });
                    await Promise.all(updatePromises);
                    alert(`Preis-Update abgeschlossen! ${updatePromises.length} Bauteile wurden aktualisiert.`);
                }

                window.renderAdminTable();
                closePreviewModal();
            } catch (err) {
                alert("Fehler bei der Ausführung: " + err.message);
                console.error(err);
            } finally {
                btn.disabled = false;
                btn.innerText = "Bestätigen & Ausführen";
                const fileInput = document.getElementById('csvFileInput');
                if (fileInput) fileInput.value = "";
            }
        };

        window.updatePricesCSV = async () => {
            const fileInput = document.getElementById('csvFileInput');
            if (!fileInput || !fileInput.files.length) return alert("Bitte eine CSV-Datei auswählen.");

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                const text = e.target.result;
                const lines = text.split(/\r?\n/);
                if (lines.length < 4) return alert("Die Datei ist leer oder fehlerhaft.");

                // Hörmann-Listen nutzen immer das Semikolon
                const separator = ';';

                // Wir suchen die Zeile mit den technischen Kürzeln (ARTNPA)
                let dataStartIndex = -1;
                for (let i = 0; i < Math.min(10, lines.length); i++) {
                    if (lines[i].includes('ARTNPA')) {
                        dataStartIndex = i + 1; // Die Daten fangen genau EINE Zeile darunter an!
                        break;
                    }
                }

                // Fallback, falls ARTNPA nicht gefunden wird (Daten starten dann meist in Zeile 4)
                if (dataStartIndex === -1) dataStartIndex = 3;

                // Feste Spalten-Indizes laut Original-Datei (A=0, B=1, ..., K=10, L=11)
                const idxArtNr = 1;  // Spalte B
                const idxPrice = 10; // Spalte K
                const idxDate = 11;  // Spalte L

                const parseDateInt = (dStr) => {
                    if (!dStr) return 0;
                    let clean = String(dStr).replace(/\D/g, '');
                    if (clean.length === 7 || clean.length === 8) {
                        const year = clean.slice(-4);
                        const month = clean.slice(-6, -4);
                        let day = clean.slice(0, -6);
                        if (day.length === 1) day = '0' + day;
                        return parseInt(year + month + day, 10);
                    }
                    else if (clean.length === 5 || clean.length === 6) {
                        const year = "20" + clean.slice(-2);
                        const month = clean.slice(-4, -2);
                        let day = clean.slice(0, -4);
                        if (day.length === 1) day = '0' + day;
                        return parseInt(year + month + day, 10);
                    }
                    return 0;
                };

                let latestPrices = {};

                for (let i = dataStartIndex; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (!line) continue;

                    let cols = line.split(separator).map(c => {
                        let str = c.trim();
                        if (str.startsWith('"') && str.endsWith('"')) str = str.substring(1, str.length - 1);
                        return str;
                    });

                    // Zeile muss lang genug sein, um das Datum (Index 11) zu enthalten
                    if (cols.length <= idxDate) continue;

                    const artNr = cols[idxArtNr] ? String(cols[idxArtNr]).trim() : '';
                    if (!artNr) continue;

                    let priceStr = cols[idxPrice] ? String(cols[idxPrice]).trim() : '0';
                    priceStr = priceStr.replace(/[^0-9,-]/g, '');
                    priceStr = priceStr.replace(',', '.');
                    const price = parseFloat(priceStr) || 0;

                    let dateInt = parseDateInt(cols[idxDate]);

                    // Überschreiben, wenn ArtNr noch nicht existiert ODER das neue Datum jünger/gleich ist
                    if (!latestPrices[artNr] || dateInt >= latestPrices[artNr].dateInt) {
                        latestPrices[artNr] = { price: price, dateInt: dateInt };
                    }
                }

                let updatesToApply = [];
                adminLocalData.forEach(item => {
                    const itemArtNr = item.artNr ? String(item.artNr).trim() : '';
                    if (itemArtNr && latestPrices[itemArtNr]) {
                        const newPrice = latestPrices[itemArtNr].price;
                        const newDate = latestPrices[itemArtNr].dateInt;

                        // Prüfen ob sich der Preis ODER das Datum geändert hat
                        if (Math.abs((item.price || 0) - newPrice) > 0.001 || item.priceDate !== newDate) {
                            updatesToApply.push({
                                id: item.id,
                                artNr: itemArtNr,
                                name: item.name,
                                oldPrice: item.price || 0,
                                newPrice: newPrice,
                                priceDate: newDate // Das Datum wird ins Preview übergeben
                            });
                        }
                    }
                });

                pendingCSVImport = { type: 'price', data: updatesToApply };
                const disableBtn = updatesToApply.length === 0;

                let html = `<p>Auswertung abgeschlossen:</p>`;
                html += `<ul style="font-size: 0.9rem; line-height: 1.5; background: #f9f9f9; padding: 15px; border-radius: 4px; border: 1px solid #ddd;">`;
                html += `<li><strong>Zu aktualisierende Preise / Daten:</strong> <span style="color: var(--hormann-blue); font-weight: bold;">${updatesToApply.length}</span></li>`;
                html += `</ul>`;

                if (updatesToApply.length > 0) {
                    html += `<div style="max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #ddd; padding: 10px; font-size: 0.8rem;">`;
                    updatesToApply.slice(0, 100).forEach(u => {
                        html += `<div style="border-bottom: 1px solid #eee; padding: 4px 0;">
                                    <strong>${u.artNr}</strong> - ${u.name}<br>
                                    <s style="color:#888;">${formatEur(u.oldPrice)}</s> &rarr; <strong style="color:var(--friendly-green);">${formatEur(u.newPrice)}</strong>
                                 </div>`;
                    });
                    if (updatesToApply.length > 100) html += `<div style="padding: 5px 0; color: #888;">... und ${updatesToApply.length - 100} weitere.</div>`;
                    html += `</div>`;
                } else {
                    html += `<p style="color: var(--friendly-green); font-weight: bold;">Alle Preise sind bereits auf dem aktuellsten Stand.</p>`;
                }

                showPreviewModal("Vorschau: Preis-Update", html, disableBtn);
            };

            // WICHTIG: ISO-8859-1 für korrekte Kodierung deutscher Excel-Dateien
            reader.readAsText(file, 'ISO-8859-1');
        };

        // --- HILFSFUNKTION: CSV AUSLESEN ---
        window.parseCSV = function (str) {
            const arr = [];
            let quote = false;
            for (let row = 0, col = 0, c = 0; c < str.length; c++) {
                let cc = str[c], nc = str[c + 1];
                arr[row] = arr[row] || [];
                arr[row][col] = arr[row][col] || '';
                if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
                if (cc == '"') { quote = !quote; continue; }
                if (cc == ';' && !quote) { ++col; continue; }
                if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
                if (cc == '\n' && !quote) { ++row; col = 0; continue; }
                if (cc == '\r' && !quote) { ++row; col = 0; continue; }
                arr[row][col] += cc;
            }
            return arr;
        };

        // --- ADMIN: LAMELLEN MATRIX IMPORT ---
        window.importLamellenMatrix = async () => {
            const fileInput = document.getElementById('csvLamellenInput');
            if (!fileInput.files.length) return alert("Bitte eine CSV-Datei auswählen.");

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                const text = e.target.result;
                const rows = parseCSV(text);
                if (rows.length < 2) return alert("Datei ist leer oder fehlerhaft.");

                const headers = rows[0].map(h => h.toLowerCase());

                // Spalten suchen
                const iSicke = headers.indexOf('sicke');
                const iObf = headers.indexOf('oberflaeche');
                const iTyp = headers.indexOf('sektionstyp');
                const iArt = headers.indexOf('artnr');
                const iPreis = headers.indexOf('preis_qm');
                const iKuerz = headers.indexOf('aufpreis_kuerzung');
                const iWeiss = headers.indexOf('aufpreis_weiss');
                const iColor = headers.indexOf('aufpreis_color');
                const iRal = headers.indexOf('aufpreis_ral');

                if (iSicke === -1 || iObf === -1 || iTyp === -1 || iPreis === -1) {
                    return alert("Fehler: Spaltenköpfe stimmen nicht überein! Bitte prüfen.");
                }

                let newMatrix = [];
                let newGlobals = { weiss: 0, color: 0, ral: 0 };

                document.body.style.cursor = 'wait';

                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i];
                    if (cols.length < 5 || !cols[iSicke]) continue;

                    // Globale Farb-Aufpreise aus der ersten echten Datenzeile (Index 1) ziehen
                    if (i === 1) {
                        if (iWeiss > -1 && cols[iWeiss]) newGlobals.weiss = parseFloat(cols[iWeiss].replace(',', '.')) || 0;
                        if (iColor > -1 && cols[iColor]) newGlobals.color = parseFloat(cols[iColor].replace(',', '.')) || 0;
                        if (iRal > -1 && cols[iRal]) newGlobals.ral = parseFloat(cols[iRal].replace(',', '.')) || 0;
                    }

                    newMatrix.push({
                        sicke: cols[iSicke].trim(),
                        oberflaeche: cols[iObf].trim(),
                        typ: cols[iTyp].trim(),
                        artNr: cols[iArt] ? cols[iArt].trim() : '',
                        preisQm: parseFloat(cols[iPreis].replace(',', '.')) || 0,
                        aufpreisKuerzung: (iKuerz > -1 && cols[iKuerz]) ? (parseFloat(cols[iKuerz].replace(',', '.')) || 0) : 0
                    });
                }

                try {
                    // Alles in ein einzelnes Dokument speichern
                    await setDoc(doc(db, "products", "SYSTEM_LAMELLEN_MATRIX"), {
                        items: newMatrix,
                        globals: newGlobals,
                        updatedAt: serverTimestamp()
                    });

                    lamellenMatrix = newMatrix;
                    lamellenGlobals = newGlobals;
                    renderAdminLamellenTable();
                    alert(`Erfolgreich! ${newMatrix.length} Kombinationen eingelesen.`);
                } catch (err) {
                    alert("Datenbank-Fehler: " + err.message);
                } finally {
                    document.body.style.cursor = 'default';
                }
            };
            reader.readAsText(file, 'ISO-8859-1');
        };

        // Rendert die Lamellen in der Admin-Tabelle zur Kontrolle
        window.renderAdminLamellenTable = () => {
            const tbody = document.getElementById('adminLamellenList');
            if (!tbody) return;

            let html = `
                <tr style="background: #fdf2e9; font-weight: bold; border-bottom: 2px solid #e67e22;">
                    <td colspan="6" style="padding: 10px; text-align: center;">
                        Globale Farb-Aufpreise: Standard/Weiß = ${formatEur(lamellenGlobals.weiss)}/m² | Vorzugsfarbe/Color = ${formatEur(lamellenGlobals.color)}/m² | RAL = ${formatEur(lamellenGlobals.ral)}/m²
                    </td>
                </tr>
            `;

            lamellenMatrix.forEach(m => {
                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td>${m.sicke}</td>
                        <td>${m.oberflaeche}</td>
                        <td>${m.typ}</td>
                        <td><strong>${m.artNr || '-'}</strong></td>
                        <td>${formatEur(m.preisQm)}</td>
                        <td>${m.aufpreisKuerzung > 0 ? '+ ' + formatEur(m.aufpreisKuerzung) : '-'}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html || '<tr><td colspan="6" class="text-center">Noch keine Daten vorhanden.</td></tr>';
        };

        // --- ADMIN: USER MANAGER LOGIK ---

        window.openUserManager = async () => {
            const profileMenu = document.getElementById('profileMenu');
            if (profileMenu) profileMenu.style.display = 'none';

            document.getElementById('adminUserModal').style.display = 'flex';
            if (window.toggleMainScroll) window.toggleMainScroll(false);

            await loadAdminUsers();
        };

        window.closeUserManager = () => {
            document.getElementById('adminUserModal').style.display = 'none';
            if (window.toggleMainScroll) window.toggleMainScroll(true);
        };

        // Lädt Benutzer (Unterscheidet zwischen Admin und Mitarbeiter)
        async function loadAdminUsers() {
            const tbody = document.getElementById('adminUserList');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px; color:#666;">Lade Benutzer...</td></tr>';

            try {
                // 1. Prüfen: Wer bin ich?
                const myAuth = auth.currentUser;
                if (!myAuth) return;
                const myDoc = await getDoc(doc(db, "users", myAuth.uid));
                const myRole = myDoc.exists() ? myDoc.data().role : 'customer';

                // Ist es ein Admin?
                const isAdmin = (myRole === 'admin' || myRole === 'developer');

                // 2. Alle User laden
                const querySnapshot = await getDocs(collection(db, "users"));
                let html = '';

                if (querySnapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Keine Benutzer gefunden.</td></tr>';
                    return;
                }

                querySnapshot.forEach((docSnap) => {
                    const u = docSnap.data();
                    const uid = docSnap.id;

                    // Status Anzeige (Hübsch)
                    const statusBadge = u.approved
                        ? '<span style="color:green; font-weight:bold;">✔ Aktiv</span>'
                        : '<span style="color:red; font-weight:bold;">⏳ Wartend</span>';

                    // Rolle übersetzen
                    let roleDisplay = "Kunde";
                    if (u.role === 'admin') roleDisplay = "Administrator";
                    if (u.role === 'employee') roleDisplay = "Mitarbeiter";

                    // --- DIE WEICHE: ADMIN vs MITARBEITER ---

                    let roleColumnContent = '';
                    let branchColumnContent = '';
                    let actionColumnContent = '';

                    const uBranch = u.branch || '';

                    if (isAdmin) {
                        // A) ADMIN: Sieht Dropdown und Buttons
                        const roleSelect = `
                            <select id="role-${uid}" style="padding:5px; border-radius:4px; border:1px solid #ccc;">
                                <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Kunde</option>
                                <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>Mitarbeiter</option>
                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            </select>
                        `;

                        roleColumnContent = `
                            <div style="display:flex; gap:5px; align-items:center;">
                                ${roleSelect}
                                <button class="btn-edit" onclick="updateUserRole('${uid}')" title="Daten speichern">💾</button>
                            </div>
                        `;

                        branchColumnContent = `
                            <select id="branch-${uid}" style="padding:5px; border-radius:4px; border:1px solid #ccc;">
                                <option value="" ${!uBranch ? 'selected' : ''}>- Keines -</option>
                                <optgroup label="Werke">
                                    <option value="Brockhagen" ${uBranch === 'Brockhagen' ? 'selected' : ''}>Brockhagen</option>
                                    <option value="Ichtershausen" ${uBranch === 'Ichtershausen' ? 'selected' : ''}>Ichtershausen</option>
                                    <option value="Amshausen" ${uBranch === 'Amshausen' ? 'selected' : ''}>Amshausen</option>
                                    <option value="Eckelhausen" ${uBranch === 'Eckelhausen' ? 'selected' : ''}>Eckelhausen</option>
                                    <option value="Brandis" ${uBranch === 'Brandis' ? 'selected' : ''}>Brandis</option>
                                    <option value="Antriebstechnik" ${uBranch === 'Antriebstechnik' ? 'selected' : ''}>Antriebstechnik</option>
                                    <option value="HUGA" ${uBranch === 'HUGA' ? 'selected' : ''}>HUGA</option>
                                    <option value="Freisen" ${uBranch === 'Freisen' ? 'selected' : ''}>Freisen</option>
                                    <option value="Werne" ${uBranch === 'Werne' ? 'selected' : ''}>Werne</option>
                                </optgroup>
                                <optgroup label="Niederlassungen">
                                    <option value="Berlin" ${uBranch === 'Berlin' ? 'selected' : ''}>Berlin</option>
                                    <option value="Bremen" ${uBranch === 'Bremen' ? 'selected' : ''}>Bremen</option>
                                    <option value="Erfurt" ${uBranch === 'Erfurt' ? 'selected' : ''}>Erfurt</option>
                                    <option value="Frankfurt" ${uBranch === 'Frankfurt' ? 'selected' : ''}>Frankfurt</option>
                                    <option value="Freisen (NL)" ${uBranch === 'Freisen (NL)' ? 'selected' : ''}>Freisen (NL)</option>
                                    <option value="Hannover" ${uBranch === 'Hannover' ? 'selected' : ''}>Hannover</option>
                                    <option value="Herne" ${uBranch === 'Herne' ? 'selected' : ''}>Herne</option>
                                    <option value="Köln-Bonn" ${uBranch === 'Köln-Bonn' ? 'selected' : ''}>Köln-Bonn</option>
                                    <option value="Leipzig" ${uBranch === 'Leipzig' ? 'selected' : ''}>Leipzig</option>
                                    <option value="Nürnberg" ${uBranch === 'Nürnberg' ? 'selected' : ''}>Nürnberg</option>
                                    <option value="München" ${uBranch === 'München' ? 'selected' : ''}>München</option>
                                    <option value="Stuttgart" ${uBranch === 'Stuttgart' ? 'selected' : ''}>Stuttgart</option>
                                    <option value="Steinhagen" ${uBranch === 'Steinhagen' ? 'selected' : ''}>Steinhagen</option>
                                </optgroup>
                                <option value="Allgemein" ${uBranch === 'Allgemein' ? 'selected' : ''}>Allgemein</option>
                            </select>
                        `;

                        actionColumnContent = `
                            <button class="btn-edit" onclick="triggerAdminPasswordReset('${u.email}')" title="Passwort-Reset-Link senden" style="margin-right: 5px;">🔑</button>
                            <button class="btn-delete" onclick="deleteUserDB('${uid}', '${u.email}')" title="Zugriff entfernen">🗑️</button>
                        `;
                    } else {
                        // B) MITARBEITER: Sieht nur Text (Read-Only)
                        roleColumnContent = `<span style="font-weight:bold; color:#555;">${roleDisplay}</span>`;
                        branchColumnContent = `<span style="font-weight:bold; color:#555;">${uBranch || '-'}</span>`;
                        actionColumnContent = `<span style="color:#ccc;">-</span>`;
                    }

                    // Zeile zusammenbauen
                    html += `
                        <tr style="border-bottom:1px solid #eee;">
                            <td><strong>${u.firstName} ${u.lastName}</strong><br><small style="color:#999; font-size:0.7rem;">Erstellt: ${u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : '-'}</small></td>
                            <td>${u.email}</td>
                            <td>${statusBadge}</td>
                            <td>${roleColumnContent}</td>
                            <td>${branchColumnContent}</td>
                            <td>${actionColumnContent}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;

            } catch (e) {
                console.error("User List Error:", e);
                tbody.innerHTML = `<tr><td colspan="6" style="color:red; padding:10px;">Fehler: ${e.message}</td></tr>`;
            }
        }

        window.updateUserRole = async (uid) => {
            const select = document.getElementById(`role-${uid}`);
            const newRole = select.value;
            const branchSelect = document.getElementById(`branch-${uid}`);
            const newBranch = branchSelect ? branchSelect.value : '';

            if (!confirm(`Soll der Nutzer wirklich aktualisiert werden?`)) return;

            try {
                // Wir setzen auch 'approved' auf true, falls man einem wartenden User direkt eine Rolle gibt
                await updateDoc(doc(db, "users", uid), {
                    role: newRole,
                    branch: newBranch,
                    approved: true
                });
                alert("Benutzer-Daten erfolgreich aktualisiert!");
                loadAdminUsers(); // Tabelle neu laden
            } catch (e) {
                alert("Fehler beim Speichern: " + e.message);
            }
        };

        window.deleteUserDB = async (uid, email) => {
            if (!confirm(`WARNUNG: Möchten Sie dem Nutzer ${email} den Zugriff entziehen?\n\nDer Datenbank-Eintrag wird gelöscht. Der Nutzer kann sich zwar noch einloggen, sieht aber nichts mehr.`)) return;

            try {
                await deleteDoc(doc(db, "users", uid));
                loadAdminUsers(); // Tabelle neu laden
            } catch (e) {
                alert("Fehler beim Löschen: " + e.message);
            }
        };

        window.triggerAdminPasswordReset = async (email) => {
            if (!email) return;
            if (!confirm(`Soll eine E-Mail zum Zurücksetzen des Passworts an ${email} gesendet werden?`)) return;

            try {
                await sendPasswordResetEmail(auth, email);
                alert(`Passwort-Reset-E-Mail wurde erfolgreich an ${email} gesendet.`);
            } catch (e) {
                console.error("Fehler beim Senden des Passwort-Resets:", e);
                alert("Fehler beim Senden: " + e.message);
            }
        };

        // --- SPEZIAL-TICKET FÜR AUFMASS-PILOT ---
        window.openAufmassReportModal = () => {
            document.getElementById('aufmassRepMessage').value = '';
            document.getElementById('aufmassRepFile').value = ''; // Reset File Input
            document.getElementById('aufmassReportModal').style.display = 'flex';
        };

        window.submitAufmassReport = async () => {
            const user = auth.currentUser;
            if (!user) {
                alert("Bitte loggen Sie sich ein, um Fehler zu melden.");
                return;
            }

            const message = document.getElementById('aufmassRepMessage').value.trim();
            const fileInput = document.getElementById('aufmassRepFile');

            if (!message) {
                alert("Bitte geben Sie einen kurzen Kommentar ein, damit wir den Fehler nachvollziehen können.");
                return;
            }

            const btn = document.querySelector('#aufmassReportModal .btn-calc');
            const originalText = btn.innerText;
            btn.innerText = "Sende Daten..."; btn.disabled = true;

            // 1. DYNAMISCHES DATENSAMMELN
            const getVal = (id) => {
                const el = document.getElementById(id);
                return (el && el.value !== "") ? el.value : '-';
            };

            const getSelectText = (id) => {
                const el = document.getElementById(id);
                return el && el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '-';
            };

            let contextData = "--- KONFIGURATION ---\n";
            contextData += `Montage: ${getSelectText('aufmassMontage')}\n`;
            contextData += `Bedienung: ${getSelectText('aufmassBedienung')}\n`;
            contextData += `Sicke: ${getSelectText('aufmassSicke')}\n`;
            contextData += `Oberfläche: ${getSelectText('aufmassOberflaeche')}\n`;
            contextData += `Farbe: ${getSelectText('aufmassFarbe')}\n\n`;

            contextData += "--- EINGEGEBENE MASSE ---\n";
            contextData += `Lichte Breite (A): ${getVal('aufmassA')} mm\n`;
            contextData += `Lichte Höhe (B): ${getVal('aufmassB')} mm\n`;
            contextData += `Anschlag Li (C1): ${getVal('aufmassC1')} mm\n`;
            contextData += `Anschlag Re (C2): ${getVal('aufmassC2')} mm\n`;
            contextData += `Sturz (D): ${getVal('aufmassD')} mm\n`;
            contextData += `Garagentiefe (G): ${getVal('aufmassG')} mm\n`;
            contextData += `Raumbreite Vorn (E1): ${getVal('aufmassE1')} mm\n`;
            contextData += `Raumbreite Hinten (E2): ${getVal('aufmassE2')} mm\n`;
            contextData += `Raumhöhe Vorn (F1): ${getVal('aufmassF1')} mm\n`;
            contextData += `Raumhöhe Hinten (F2): ${getVal('aufmassF2')} mm\n\n`;

            contextData += "--- ERMITTELTE TORE ---\n";
            if (typeof calculatedProposals !== 'undefined' && calculatedProposals.length > 0) {
                calculatedProposals.forEach((p, i) => {
                    let blendeInfo = p.fascia ? ` (Blende: ${p.fascia}mm)` : '';
                    contextData += `${i + 1}. ${p.title} (${p.type}): ${p.w}x${p.h} mm${blendeInfo}\n`;
                });
            } else {
                contextData += "Es wurden keine passenden Tore ermittelt.\n";
            }

            // Zusammenbauen der finalen Nachricht
            const finalMessage = `${message}\n\n\n${contextData}`;

            try {
                let fileUrl = null;

                // Datei hochladen (falls vorhanden)
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    if (file.size > 5 * 1024 * 1024) { // 5MB Limit
                        alert("Die Datei ist zu groß (Max 5MB).");
                        btn.innerText = originalText; btn.disabled = false;
                        return;
                    }
                    const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    fileUrl = await getDownloadURL(storageRef);
                }

                // In Ticket-Datenbank speichern
                await addDoc(collection(db, "tickets"), {
                    userId: user.uid,
                    userEmail: user.email,
                    userName: document.getElementById('profileRole') ? document.getElementById('profileRole').previousElementSibling?.innerText : 'User',
                    type: "Aufmaß-Pilot",
                    subject: "Schnellmeldung: Aufmaß-Pilot",
                    message: finalMessage,
                    fileUrl: fileUrl,
                    status: 'open',
                    createdAt: serverTimestamp(),
                    adminReply: ''
                });

                // E-Mail Info an dich triggern
                const emailParams = {
                    type: "Aufmaß-Pilot",
                    subject: "Schnellmeldung: Aufmaß-Pilot Fehler",
                    message: finalMessage,
                    user_email: user.email,
                    has_file: fileUrl ? "Ja (Siehe Admin-Panel)" : "Nein"
                };

                await sendEmailSmart('report', emailParams);

                alert("Vielen Dank! Ihr Bericht wurde inkl. aller Parameter erfolgreich übermittelt.");
                document.getElementById('aufmassReportModal').style.display = 'none';

            } catch (e) {
                console.error(e);
                alert("Fehler beim Senden: " + e.message);
            } finally {
                btn.innerText = originalText; btn.disabled = false;
            }
        };

        // --- REPORTING SYSTEM (Standard) ---

        window.openReportModal = () => {
            document.getElementById('repSubject').value = '';
            document.getElementById('repMessage').value = '';
            document.getElementById('repFile').value = ''; // Reset File Input
            document.getElementById('reportModal').style.display = 'flex';
        };

        window.submitReport = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const type = document.getElementById('repType').value;
            const subject = document.getElementById('repSubject').value.trim();
            const message = document.getElementById('repMessage').value.trim();
            const fileInput = document.getElementById('repFile');

            if (!subject || !message) {
                alert("Bitte Betreff und Beschreibung ausfüllen.");
                return;
            }

            const btn = document.querySelector('#reportModal .btn-calc');
            const originalText = btn.innerText;
            btn.innerText = "Sende..."; btn.disabled = true;

            try {
                let fileUrl = null;

                // 1. Datei hochladen (falls vorhanden)
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    if (file.size > 5 * 1024 * 1024) { // 5MB Limit
                        alert("Datei ist zu groß (Max 5MB).");
                        btn.innerText = originalText; btn.disabled = false;
                        return;
                    }
                    // Upload zu Firebase Storage
                    const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    fileUrl = await getDownloadURL(storageRef);
                }

                // 2. In Datenbank speichern
                await addDoc(collection(db, "tickets"), {
                    userId: user.uid,
                    userEmail: user.email,
                    userName: document.getElementById('profileRole') ? document.getElementById('profileRole').previousElementSibling?.innerText : 'User',
                    type: type,
                    subject: subject,
                    message: message,
                    fileUrl: fileUrl,
                    status: 'open',
                    createdAt: serverTimestamp(),
                    adminReply: ''
                });

                // 3. E-Mail Info an dich
                const emailParams = {
                    type: type,
                    subject: subject,
                    message: message,
                    user_email: user.email,
                    has_file: fileUrl ? "Ja (Siehe Admin-Panel)" : "Nein"
                };

                await sendEmailSmart('report', emailParams);

                alert("Vielen Dank! Ihr Bericht wurde gesendet.");
                document.getElementById('reportModal').style.display = 'none';

            } catch (e) {
                console.error(e);
                alert("Fehler beim Senden: " + e.message);
            } finally {
                btn.innerText = originalText; btn.disabled = false;
            }
        };

        // --- ADMIN TICKET LOGIK ---
        let currentTicketId = null;

        // Öffnet das Fenster und lädt die Liste
        window.openTicketManager = async () => {
            const menu = document.getElementById('profileMenu');
            if (menu) menu.style.display = 'none'; // Menü schließen
            document.getElementById('adminTicketModal').style.display = 'flex';
            document.getElementById('ticketDetailView').style.display = 'none'; // Detail ausblenden
            await loadAdminTickets();
        };

        // Lädt alle Tickets aus der Datenbank
        async function loadAdminTickets() {
            const tbody = document.getElementById('adminTicketList');
            tbody.innerHTML = '<tr><td colspan="6">Lade Tickets...</td></tr>';

            try {
                // Wir laden alle Tickets, sortiert nach Datum (neu oben)
                const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                let html = '';

                snapshot.forEach(doc => {
                    const t = doc.data();
                    const date = t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : '-';

                    // --- HIER IST DIE NEUE STATUS-LOGIK ---
                    let statusColor = 'gray';
                    let statusText = 'Erledigt';
                    let rowBg = '#f9f9f9'; // Standard Hintergrund für erledigte

                    if (t.status === 'open') {
                        statusColor = 'green';
                        statusText = 'Offen';
                        rowBg = '#fff'; // Weiß für offene
                    }
                    else if (t.status === 'archived') {
                        statusColor = '#95a5a6'; // Dunkelgrau
                        statusText = 'Archiviert 📦';
                        rowBg = '#eee'; // Etwas dunklerer Hintergrund
                    }
                    // --------------------------------------

                    html += `
                        <tr style="cursor:pointer; background:${rowBg}; border-bottom:1px solid #ddd;" onclick="openTicketDetail('${doc.id}')">
                            <td>${date}</td>
                            <td>${t.type === 'Bug' ? '🐞' : (t.type === 'Feature' ? '✨' : '📝')}</td>
                            <td>${t.userEmail}</td>
                            <td><strong>${t.subject}</strong></td>
                            <td><span style="color:${statusColor}; font-weight:bold;">${statusText}</span></td>
                            <td>👉</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html || '<tr><td colspan="6">Keine Tickets vorhanden.</td></tr>';
            } catch (e) {
                console.error(e);
                tbody.innerHTML = '<tr><td colspan="6" style="color:red">Fehler beim Laden.</td></tr>';
            }
        }

        // Zeigt ein einzelnes Ticket unten im Fenster an (Mit Namens-Check)
        window.openTicketDetail = async (ticketId) => {
            currentTicketId = ticketId;
            const ticketDoc = await getDoc(doc(db, "tickets", ticketId));
            const t = ticketDoc.data();

            // NEU: Wir holen uns den Vornamen des Users aus der Datenbank
            let kundenName = "Kunde"; // Fallback
            try {
                if (t.userId) {
                    const uDoc = await getDoc(doc(db, "users", t.userId));
                    if (uDoc.exists()) {
                        kundenName = uDoc.data().firstName;
                    }
                }
            } catch (e) { console.log("Name konnte nicht geladen werden", e); }

            document.getElementById('ticketDetailView').style.display = 'block';

            let statusIcon = t.status === 'archived' ? '📦 ' : (t.type === 'Bug' ? '🐞 ' : '✨ ');
            document.getElementById('tdSubject').innerText = statusIcon + t.subject;
            document.getElementById('tdMeta').innerText = `Von: ${t.userEmail} | Am: ${new Date(t.createdAt.seconds * 1000).toLocaleString()}`;
            document.getElementById('tdMessage').innerText = t.message;

            const fileDiv = document.getElementById('tdFile');
            if (t.fileUrl) {
                fileDiv.innerHTML = `<a href="${t.fileUrl}" target="_blank" style="color:var(--hormann-blue); text-decoration:underline;">📎 Anhang ansehen</a>`;
            } else if (t.status === 'archived' && t.hadFile) {
                fileDiv.innerHTML = `<span style="color:#999; font-style:italic;">📎 Anhang wurde gelöscht (Archiviert)</span>`;
            } else {
                fileDiv.innerHTML = '';
            }

            const btnReply = document.getElementById('btnSendReply');
            const btnClose = document.getElementById('btnCloseTicket');
            const btnArchive = document.getElementById('btnArchiveTicket');
            const btnGithub = document.getElementById('btnConvertToGithub');
            const btnUnlink = document.getElementById('btnUnlinkGithub');

            const replyField = document.getElementById('tdReply');
            replyField.value = t.adminReply || '';

            if (btnGithub) {
                if (t.githubIssueUrl) {
                    btnGithub.style.display = 'inline-block';
                    btnGithub.innerHTML = `🐱 Issue #${t.githubIssueNumber} öffnen`;
                    btnGithub.style.background = '#27ae60'; // Grün
                    btnGithub.onclick = () => window.open(t.githubIssueUrl, '_blank');
                    if (btnUnlink) {
                        btnUnlink.style.display = 'inline-block';
                        btnUnlink.onclick = () => window.unlinkTicketFromGitHub(ticketId);
                    }
                } else if (t.status === 'archived') {
                    btnGithub.style.display = 'none';
                    if (btnUnlink) btnUnlink.style.display = 'none';
                } else {
                    btnGithub.style.display = 'inline-block';
                    btnGithub.innerHTML = '🐱 In GitHub-Issue umwandeln';
                    btnGithub.style.background = '#2c3e50';
                    btnGithub.onclick = () => window.convertTicketToGitHubIssue(ticketId, t);
                    if (btnUnlink) btnUnlink.style.display = 'none';
                }
            }

            if (t.status === 'archived') {
                replyField.disabled = true;
                btnReply.style.display = 'none';
                btnClose.style.display = 'none';
                btnArchive.style.display = 'none';
            } else {
                replyField.disabled = false;
                btnReply.style.display = 'inline-block';
                btnClose.style.display = 'inline-block';
                btnArchive.style.display = 'inline-block';

                // WICHTIG: Hier geben wir jetzt kundenName mit!
                btnReply.onclick = () => sendTicketReply(t.userEmail, t.subject, kundenName);
                btnClose.onclick = () => closeTicket(ticketId);
                btnArchive.onclick = () => archiveTicket(ticketId, t.fileUrl);
            }
        };

        // --- EINZELNES TICKET ARCHIVIEREN ---
        window.archiveTicket = async (ticketId, fileUrl) => {
            if (!confirm("Ticket archivieren?\n\nDabei wird der Dateianhang unwiderruflich gelöscht, um Speicherplatz freizugeben.")) return;

            try {
                // Datei löschen...
                if (fileUrl) {
                    try {
                        const fileRef = ref(storage, fileUrl);
                        await deleteObject(fileRef);
                    } catch (err) { console.warn("Datei weg:", err); }
                }

                // DB Update
                await updateDoc(doc(db, "tickets", ticketId), {
                    status: 'archived',
                    fileUrl: null,
                    hadFile: !!fileUrl,
                    archivedAt: serverTimestamp()
                });

                alert("Ticket wurde archiviert.");

                loadAdminTickets();
                checkTicketStatus(); // NEU: Badge aktualisieren!

                document.getElementById('ticketDetailView').style.display = 'none';

            } catch (e) {
                alert("Fehler beim Archivieren: " + e.message);
            }
        };

        // --- AUTOMATISCHES AUFRÄUMEN (älter als 14 Tage) ---
        window.runAutoCleanup = async () => {
            if (!confirm("Sollen alle Tickets, die seit mehr als 14 Tagen GESCHLOSSEN sind, archiviert und deren Anhänge gelöscht werden?")) return;

            const btn = document.querySelector('button[onclick="runAutoCleanup()"]');
            const originalText = btn.innerText;
            btn.innerText = "⏳ Arbeite..."; btn.disabled = true;

            try {
                // 1. Hole alle geschlossenen Tickets
                const q = query(collection(db, "tickets"), where("status", "==", "closed"));
                const snapshot = await getDocs(q);

                const now = new Date();
                const dayInMs = 1000 * 60 * 60 * 24;
                let count = 0;

                // 2. Durchlaufe alle und prüfe das Alter (leider client-seitig filtern, da Firestore Querys limitiert sind)
                for (const docSnap of snapshot.docs) {
                    const t = docSnap.data();

                    // Wann wurde das Ticket zuletzt bearbeitet/geschlossen?
                    // Wir nehmen 'updatedAt' (falls du das speicherst) oder 'createdAt' als Fallback
                    // Besser: Wir fügen beim Schließen ein 'closedAt' hinzu. 
                    // Fallback hier: Wenn kein Datum da ist, lassen wir es sicherheitshalber stehen.

                    // Für jetzt nehmen wir das 'createdAt' + 30 Tage als Sicherheit, falls kein closedAt da ist,
                    // oder du fügst beim 'closeTicket' noch ein closedAt: serverTimestamp() hinzu.

                    // Simpler Ansatz für den Anfang: Wir nehmen das Erstellungsdatum + 30 Tage Puffer,
                    // ODER wir prüfen einfach manuell im Loop.

                    // HINWEIS: Da wir 'closedAt' bisher nicht gespeichert haben, ist es schwer zu sagen, WANN es geschlossen wurde.
                    // VORSCHLAG: Wir nutzen 'createdAt' als Indikator für sehr alte Tickets (> 30 Tage)

                    const ticketDate = t.createdAt ? t.createdAt.seconds * 1000 : 0;
                    const ageInDays = (now - ticketDate) / dayInMs;

                    // Wenn Ticket älter als 30 Tage ist UND geschlossen -> Weg damit
                    if (ageInDays > 30) {
                        await archiveTicketSilent(docSnap.id, t.fileUrl);
                        count++;
                    }
                }

                alert(`Fertig! ${count} alte Tickets wurden archiviert.`);
                loadAdminTickets();

            } catch (e) {
                console.error(e);
                alert("Fehler beim Aufräumen: " + e.message);
            } finally {
                btn.innerText = originalText; btn.disabled = false;
            }
        };

        // Hilfsfunktion für Massen-Löschung (ohne Alerts)
        async function archiveTicketSilent(ticketId, fileUrl) {
            if (fileUrl) {
                try {
                    const fileRef = ref(storage, fileUrl);
                    await deleteObject(fileRef);
                } catch (e) { console.log("Datei schon weg oder Fehler", e); }
            }
            await updateDoc(doc(db, "tickets", ticketId), {
                status: 'archived',
                fileUrl: null,
                hadFile: !!fileUrl,
                archivedAt: serverTimestamp()
            });
        }

        // Antwort senden (Mail + DB)
        // Antwort senden (Jetzt mit Name)
        window.sendTicketReply = async (userEmail, subject, userName) => {
            const replyText = document.getElementById('tdReply').value;
            if (!replyText) return alert("Bitte eine Antwort eingeben.");

            if (!confirm("Antwort per E-Mail an Kunden senden?")) return;

            const btn = document.getElementById('btnSendReply');
            btn.innerText = "Sende..."; btn.disabled = true;

            try {
                await updateDoc(doc(db, "tickets", currentTicketId), {
                    adminReply: replyText,
                    status: 'closed'
                });

                // Hier geben wir den Namen an die Mail-Funktion weiter
                await sendEmailSmart('reply', {
                    user_email: userEmail,
                    ticket_subject: subject,
                    reply_message: replyText,
                    to_name: userName // Der echte Vorname!
                });

                alert("Antwort gesendet!");

                loadAdminTickets();
                checkTicketStatus();

                document.getElementById('ticketDetailView').style.display = 'none';
            } catch (e) {
                alert("Fehler: " + e.message);
            } finally {
                btn.innerText = "Antwort senden"; btn.disabled = false;
            }
        };

        // Ticket manuell schließen
        window.closeTicket = async (id) => {
            if (!confirm("Ticket als 'Erledigt' markieren ohne Mail?")) return;

            // 1. Status in Datenbank ändern
            await updateDoc(doc(db, "tickets", id), { status: 'closed' });

            // 2. Liste aktualisieren
            loadAdminTickets();

            // 3. NEU: Gelben Badge sofort aktualisieren!
            checkTicketStatus();

            document.getElementById('ticketDetailView').style.display = 'none';
        };

        // --- TICKET BADGE LOGIK (Gelber Punkt) ---

        // 1. Zählt offene Tickets und zeigt den gelben Badge an
        async function checkTicketStatus() {
            const badge = document.getElementById('ticketBadge');
            if (badge) badge.style.display = 'none'; // Erstmal ausblenden

            const user = auth.currentUser;
            if (!user) return;

            try {
                // Suche nach Tickets mit Status "open"
                const q = query(collection(db, "tickets"), where("status", "==", "open"));
                const snapshot = await getDocs(q);
                const count = snapshot.size;

                // Wenn offene Tickets da sind -> Badge anzeigen
                if (count > 0) {
                    badge.innerText = count;
                    badge.style.display = 'flex';

                    // Kleiner Wackel-Effekt für Aufmerksamkeit
                    badge.parentElement.classList.add('shake-element');
                    setTimeout(() => badge.parentElement.classList.remove('shake-element'), 500);
                }
            } catch (e) {
                console.log("Ticket-Check nicht möglich (evtl. kein Admin):", e);
            }
        }

        // 2. Entscheidet was passiert, wenn man auf das Megafon klickt
        window.checkTicketButtonAction = async () => {
            const user = auth.currentUser;
            if (!user) return;

            // Wir prüfen die Rolle in der Datenbank
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const role = userDoc.exists() ? userDoc.data().role : 'user';

            if (role === 'admin' || role === 'developer') {
                // Wenn Admin -> Zeige Auswahlmodal
                const modal = document.getElementById('adminSupportChoiceModal');
                if (modal) {
                    modal.style.display = 'flex';
                } else if (window.openTicketManager) {
                    openTicketManager();
                }
            } else {
                // Wenn normaler User -> Öffne das "Fehler melden" Fenster
                if (window.openReportModal) {
                    openReportModal();
                } else {
                    console.error("Funktion openReportModal fehlt!");
                }
            }
        };

        // --- ONBOARDING TOUR LOGIK (DYNAMISCH FÜR BASIS & UPDATE) ---

        let currentStepIndex = -1;
        let activeTourSteps = []; // Speichert dynamisch, welche Tour gerade läuft
        let currentTourType = 'main'; // 'main' oder 'update07'

        // 1. Die reguläre Tour für GANZ NEUE User (Jetzt inkl. Aufmaß-Pilot)
        const mainTourSteps = [
            {
                id: 'tabBR40',
                title: '1. Baureihe wählen',
                text: 'Starten Sie hier: Wählen Sie oben die passende Baureihe.',
                mode: 'below-center'
            },
            {
                id: 'optionACard',
                title: 'Option A: Rechner',
                text: 'Nutzen Sie diesen Bereich, um bei bekannten Maßen alle Beschlagsteile pro Lamellenposition anzuzeigen.',
                mode: 'right-side'
            },
            {
                id: 'optionBCard',
                title: 'Option B: Visuell',
                text: 'Wählen Sie Ersatzteile alternativ direkt über die roten Punkte in der Zeichnung aus.',
                mode: 'left-side'
            },
            {
                id: 'btnSubLamellen',
                title: 'Ersatzlamellen',
                text: 'Wechseln Sie hier zur schnellen Kalkulation einzelner Ersatzlamellen inklusive Preis- und Oberflächenauswahl.',
                mode: 'below-center'
            },
            {
                id: 'btnSubAufmass',
                title: 'Neu: Der Aufmaß-Pilot',
                text: 'Unser neues Highlight! Wechseln Sie hier in den Aufmaß-Piloten, um Tore basierend auf Ihren gemessenen Raumdaten ermitteln zu lassen.',
                mode: 'below-center',
                onEnter: () => {
                    if (window.switchSubTab) window.switchSubTab('aufmass');
                    // Simuliere einen Klick auf "Verstanden" im Beta-Popup, damit die Tour nicht blockiert wird
                    if (window.closeAufmassInfo) window.closeAufmassInfo();
                }
            },
            {
                id: 'tourSearchBox',
                title: 'Smarte Artikelsuche',
                text: 'Suchen Sie direkt nach Artikelnummern oder Namen. Wir haben hier als Beispiel schon einmal "laufrolle un" für Sie eingegeben!',
                mode: 'left-side-search',
                onEnter: () => {
                    const searchEl = document.getElementById('artNrSearch');
                    if (searchEl) {
                        searchEl.value = 'laufrolle un';
                        if (window.handleSearchInput) window.handleSearchInput();
                    }
                },
                onLeave: () => {
                    const searchEl = document.getElementById('artNrSearch');
                    if (searchEl) {
                        searchEl.value = '';
                        if (window.handleSearchInput) window.handleSearchInput();
                    }
                    const res = document.getElementById('searchResults');
                    if (res) res.style.display = 'none';
                    if (window.switchSubTab) window.switchSubTab('beschlag'); // Zurück zur Hauptansicht
                }
            },
            {
                id: 'searchModalLocateButtons',
                title: 'Die Detailansicht',
                text: 'Hier finden Sie alle Infos und das passende Zubehör! Besonderes Highlight: Klicken Sie auf den Button in diesem Bereich, um sofort zu sehen, wo das Bauteil verbaut wird.',
                mode: 'below-center',
                onEnter: () => {
                    let demoId = Object.keys(partsDB).find(k => partsDB[k].artNr == '3040311');
                    if (!demoId) demoId = Object.keys(partsDB)[0];
                    if (demoId && window.openSearchModal) window.openSearchModal(demoId);

                    const modal = document.getElementById('searchModal');
                    if (modal) modal.style.zIndex = '9997';
                },
                onLeave: () => {
                    const modal = document.getElementById('searchModal');
                    if (modal) modal.style.zIndex = '2000';
                    if (window.closeSearchModal) window.closeSearchModal(true);
                }
            },
            {
                id: 'userProfile',
                title: 'Support & Hilfe',
                text: 'Hier verwalten Sie Ihre Daten. WICHTIG: Sollten Sie Fehler im neuen Aufmaß-Piloten finden, melden Sie diese zwingend über das Megafon-Icon!',
                mode: 'below-right-edge'
            }
        ];

        // 2. Die Highlight-Tour für das NEUE UPDATE (Aufmaß-Pilot)
        const updateTourSteps = [
            {
                id: 'btnSubAufmass',
                title: 'Das Highlight: Aufmaß-Pilot',
                text: 'Der neue Aufmaß-Pilot ist da! Klicken wir einmal drauf, um die neue Funktion zu starten.',
                mode: 'below-center',
                onEnter: () => {
                    if (window.switchSubTab) window.switchSubTab('aufmass');
                    if (window.closeAufmassInfo) window.closeAufmassInfo();
                }
            },
            {
                id: 'aufmassSetupCard',
                title: 'Montagesituation & Parameter',
                text: 'Hier legen Sie die Grundlagen fest. Je nach gewählter Montage (Hinter oder In der Öffnung) ändern sich die Parameter in der 3D-Ansicht rechts.',
                mode: 'right-side'
            },
            {
                id: 'sceneWrapper',
                title: 'Interaktive 3D-Raumanalyse',
                text: 'Geben Sie Ihre gemessenen Werte direkt an der Wand ein. Die Maßketten blenden sich smart ein und aus, je nachdem wie Sie die Kamera (Mausklick + Ziehen) drehen.',
                mode: 'below-center',
                onEnter: () => {
                    // Werte eintragen und Berechnung auslösen
                    const wInput = document.getElementById('aufmassA');
                    const hInput = document.getElementById('aufmassB');
                    if (wInput) wInput.value = 2470;
                    if (hInput) hInput.value = 2125;
                    if (window.handleInputChange) window.handleInputChange();
                    if (typeof update3D === 'function') update3D();

                    // Kamera fixieren: Ansicht von hinten, weiter entfernt
                    if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
                        camera.position.set(0, 1500, -5000);
                        controls.target.set(0, 1000, 0);
                        controls.update();
                    }
                }
            },
            {
                id: 'settingsOptions',
                title: 'Darstellungsoptionen',
                text: 'Über dieses Menü können Sie Wände ausblenden oder in den Skizzen-Modus wechseln, um eine ungestörte Ansicht zu erhalten.',
                mode: 'left-side',
                onEnter: () => {
                    const menu = document.getElementById('settingsOptions');
                    if (menu) {
                        menu.classList.add('active');
                        menu.style.display = 'block';
                    }
                    // Künstlicher Schubs nach oben für die Sprechblase
                    setTimeout(() => {
                        const overlay = document.getElementById('tourOverlay');
                        const modal = overlay ? overlay.querySelector('div') : null;
                        if (modal) modal.style.marginTop = '-100px';
                    }, 50);
                },
                onLeave: () => {
                    const menu = document.getElementById('settingsOptions');
                    if (menu) {
                        menu.classList.remove('active');
                        menu.style.display = 'none';
                    }
                    // Reset
                    const overlay = document.getElementById('tourOverlay');
                    const modal = overlay ? overlay.querySelector('div') : null;
                    if (modal) modal.style.marginTop = '0px';
                }
            },
            {
                id: 'sceneProposalMenu',
                title: 'Live Tor-Auswahl',
                text: 'Das System errechnet in Echtzeit die passenden Norm- und Sondergrößen! Klicken Sie einfach auf eine der Optionen, und das 3D-Modell passt sich mitsamt benötigten Blenden sofort an.',
                mode: 'left-side',
                onEnter: () => {
                    // Künstlicher Schubs nach oben
                    setTimeout(() => {
                        const overlay = document.getElementById('tourOverlay');
                        const modal = overlay ? overlay.querySelector('div') : null;
                        if (modal) modal.style.marginTop = '-40px';
                    }, 50);
                },
                onLeave: () => {
                    // Reset
                    const overlay = document.getElementById('tourOverlay');
                    const modal = overlay ? overlay.querySelector('div') : null;
                    if (modal) modal.style.marginTop = '0px';
                }
            },
            {
                id: 'aufmassResultContainer',
                title: 'Detailergebnisse & Check',
                text: 'Alle Vorschläge werden hier übersichtlich zusammengefasst. Sollten Ihre Raummaße (z.B. Tiefe G) zu gering für den Antrieb sein, werden Sie hier gewarnt.',
                mode: 'below-center'
            },
            {
                id: 'userProfile',
                title: 'Wichtig: Ihr Feedback!',
                text: 'Der Pilot läuft aktuell als Live-Test! Wenn Sie Ungereimtheiten oder Grafikfehler finden, erstellen Sie bitte über dieses Menü (Megafon) zwingend ein Ticket (inkl. Screenshot).',
                mode: 'below-right-edge',
                onLeave: () => {
                    if (window.switchSubTab) window.switchSubTab('beschlag');
                }
            }
        ];

        // Prüft beim Login, was der User sehen muss
        window.checkOnboarding = async (user) => {
            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);

            if (snap.exists()) {
                const data = snap.data();

                // Fall 1: Hat die Haupt-Tour noch nie gesehen
                if (!data.tourSeen) {
                    document.getElementById('welcomeName').innerText = data.firstName;
                    document.getElementById('welcomeModal').style.display = 'flex';
                }
                // Fall 2: Kennt die Haupt-Tour, hat aber Update 0.100 noch nicht gesehen
                else if (!data.updateTour0100Seen) {
                    document.getElementById('updateWelcomeName').innerText = data.firstName;
                    document.getElementById('updateWelcomeModal').style.display = 'flex';
                }
            }
        };

        // --- HAUPT-TOUR STEUERUNG ---
        window.startTour = () => {
            document.getElementById('welcomeModal').style.display = 'none';
            activeTourSteps = mainTourSteps;
            currentTourType = 'main';
            document.getElementById('tourOverlay').style.display = 'block';
            currentStepIndex = -1;
            nextTourStep();
        };

        window.skipTour = async () => {
            document.getElementById('welcomeModal').style.display = 'none';
            await finishTourInDB('main');
        };

        // --- UPDATE-TOUR STEUERUNG ---
        window.startUpdateTour = () => {
            document.getElementById('updateWelcomeModal').style.display = 'none';
            activeTourSteps = updateTourSteps; // Hier der neue Variablenname!
            currentTourType = 'update0100'; // Hier der neue Typ für die DB!
            document.getElementById('tourOverlay').style.display = 'block';
            currentStepIndex = -1;
            nextTourStep();
        };

        window.skipUpdateTour = async () => {
            document.getElementById('updateWelcomeModal').style.display = 'none';
            await finishTourInDB('update0100'); // Hier der neue Typ für die DB!
        };

        window.addEventListener('scroll', function () {
            const overlay = document.getElementById('tourOverlay');
            const modal = overlay ? overlay.querySelector('div') : null;

            if (overlay && overlay.style.display === 'block' && typeof activeTourSteps !== 'undefined' && currentStepIndex >= 0) {
                const step = activeTourSteps[currentStepIndex];
                const target = document.getElementById(step.id);

                if (target && modal) {
                    const rect = target.getBoundingClientRect();
                    let top = rect.bottom + 15;
                    let left = rect.left + (rect.width / 2) - (modal.offsetWidth / 2);

                    if (step.mode === 'right-side') {
                        top = rect.top;
                        left = rect.right + 15;
                    } else if (step.mode === 'left-side' || step.mode === 'left-side-search') {
                        top = rect.top;
                        left = rect.left - modal.offsetWidth - 15;
                    } else if (step.mode === 'below-right-edge') {
                        top = rect.bottom + 15;
                        left = rect.right - modal.offsetWidth;
                    }

                    // Manuelle Höhenkorrekturen
                    if (step.id === 'settingsOptions') {
                        top -= 150; // Deutlich weiter nach oben geschoben (Wert ggf. anpassen, falls noch zu tief)
                    } else if (step.id === 'sceneProposalMenu') {
                        top -= 60; // Etwas weiter nach oben als vorher
                    }

                    modal.style.top = top + 'px';
                    modal.style.left = left + 'px';
                }
            }
        }, true);

        // --- ENGINE FÜR BEIDE TOUREN ---
        window.nextTourStep = async () => {
            if (currentStepIndex >= 0 && activeTourSteps[currentStepIndex]) {
                const prevStep = activeTourSteps[currentStepIndex];
                const prevEl = document.getElementById(prevStep.id);
                if (prevEl) prevEl.classList.remove('tour-highlight');

                if (prevStep.onLeave) prevStep.onLeave();
            }

            currentStepIndex++;

            if (currentStepIndex >= activeTourSteps.length) {
                endTour();
                return;
            }

            const step = activeTourSteps[currentStepIndex];

            if (step.onEnter) step.onEnter();

            setTimeout(() => {
                const el = document.getElementById(step.id);
                if (!el || el.offsetParent === null) { nextTourStep(); return; }

                el.classList.add('tour-highlight');
                el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });

                const tooltip = document.getElementById('tourTooltip');
                const arrow = document.getElementById('tourArrow');
                document.getElementById('tourTitle').innerText = step.title;
                document.getElementById('tourText').innerText = step.text;
                document.getElementById('tourNextBtn').innerText = (currentStepIndex === activeTourSteps.length - 1) ? "Fertig!" : "Weiter \u2192";

                tooltip.style.display = 'block';
                const tipW = tooltip.offsetWidth || 280;
                const tipH = tooltip.offsetHeight || 120;

                const rect = el.getBoundingClientRect();

                let top = 0; let left = 0; let arrowClass = ''; let arrowLeft = '';

                if (step.mode === 'below-center') {
                    top = rect.bottom + 15;
                    left = rect.left + (rect.width / 2) - (tipW / 2);
                    arrowClass = 'arrow-top'; arrowLeft = '50%';
                }
                else if (step.mode === 'right-side') {
                    left = rect.right + 15; top = rect.top + 300; arrowClass = 'arrow-left';
                }
                else if (step.mode === 'left-side') {
                    left = rect.left - tipW - 15; top = rect.top + 300; arrowClass = 'arrow-right';
                }
                else if (step.mode === 'left-side-search') {
                    if (rect.left > tipW + 20) {
                        left = rect.left - tipW - 20; top = rect.top; arrowClass = 'arrow-right';
                    } else {
                        left = Math.max(10, rect.left + (rect.width / 2) - (tipW / 2));
                        top = rect.top - tipH - 15; arrowClass = 'arrow-bottom'; arrowLeft = '50%';
                    }
                }
                else if (step.mode === 'below-right-edge') {
                    top = rect.bottom + 15; left = rect.right - tipW + 5; arrowClass = 'arrow-top'; arrowLeft = '90%';
                }

                if ((step.mode === 'right-side' || step.mode === 'left-side') && window.innerWidth < 1000) {
                    top = rect.top + 50; left = rect.left + 20; arrowClass = 'arrow-top';
                    if (step.mode === 'left-side') left = rect.left;
                }

                if (left < 10) left = 10;
                if (left + tipW > window.innerWidth) left = window.innerWidth - tipW - 10;
                if (top < 10) top = 10;
                if (top + tipH > window.innerHeight) top = window.innerHeight - tipH - 10;

                tooltip.style.top = top + 'px';
                tooltip.style.left = left + 'px';

                arrow.className = 'tour-arrow ' + arrowClass;
                arrow.style.left = (arrowClass === 'arrow-left' || arrowClass === 'arrow-right' || arrowClass === 'arrow-bottom') ? '' : arrowLeft;
                arrow.style.top = (arrowClass === 'arrow-left' || arrowClass === 'arrow-right') ? '20px' : '';
                if (arrowClass === 'arrow-bottom') arrow.style.left = '50%';

            }, 150);
        };

        function endTour() {
            document.getElementById('tourOverlay').style.display = 'none';
            document.getElementById('tourTooltip').style.display = 'none';

            const modal = document.getElementById('searchModal');
            if (modal) modal.style.zIndex = '2000';

            finishTourInDB(currentTourType);
        }

        // Speichert in Firebase, welche Tour gesehen wurde
        async function finishTourInDB(tourType) {
            const user = auth.currentUser;
            if (user) {
                try {
                    let dataToUpdate = {};
                    if (tourType === 'main') {
                        dataToUpdate.tourSeen = true;
                    } else if (tourType === 'update0100') { // Neuer Check für v0.100
                        dataToUpdate.updateTour0100Seen = true;
                    }
                    await updateDoc(doc(db, "users", user.uid), dataToUpdate);
                } catch (e) { console.log("Konnte Tour-Status nicht speichern", e); }
            }
        }

        // --- CHANGELOG SYSTEM ---

        // Konfiguration der Typen und ihrer Priorität (Sortierung)
        const CL_TYPES = {
            'new': { label: '✨ Neu', class: 'cl-new', order: 1 },
            'imp': { label: '🚀 Verbess.', class: 'cl-imp', order: 2 },
            'fix': { label: '🐞 Bugfix', class: 'cl-fix', order: 3 }
        };

        // 1. ADMIN: Manager öffnen
        window.openChangelogManager = async () => {
            // Menü schließen
            const menu = document.getElementById('profileMenu');
            if (menu) menu.style.display = 'none';

            document.getElementById('adminChangelogModal').style.display = 'flex';

            // Standardmäßig "Neue Version" vorbereiten
            resetChangelogForm();

            // Liste der existierenden laden (für Edit)
            loadExistingVersionsList();

            // GitHub Token aus localStorage laden
            const storedToken = localStorage.getItem('gh_pat_token') || '';
            const tokenInput = document.getElementById('clGithubToken');
            if (tokenInput) tokenInput.value = storedToken;
        };

        // --- GITHUB INTEGRATION & AUTOMATISCHER IMPORT ---

        window.toggleGitHubTokenInput = (e) => {
            if (e) e.preventDefault();
            const panel = document.getElementById('githubTokenSetup');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        };

        window.saveGitHubToken = () => {
            const tokenInput = document.getElementById('clGithubToken');
            if (tokenInput) {
                const val = tokenInput.value.trim();
                localStorage.setItem('gh_pat_token', val);
                alert("GitHub Personal Access Token lokal gespeichert!");
                const panel = document.getElementById('githubTokenSetup');
                if (panel) panel.style.display = 'none';
            }
        };

        window.importGitHubIssues = async () => {
            const token = localStorage.getItem('gh_pat_token') || (document.getElementById('clGithubToken') ? document.getElementById('clGithubToken').value.trim() : '');
            if (!token) {
                alert("Bitte richte zuerst deinen GitHub Token ein (Klicke auf 'GitHub Token einrichten').");
                const panel = document.getElementById('githubTokenSetup');
                if (panel) panel.style.display = 'block';
                return;
            }

            const importBtn = document.querySelector('button[onclick="importGitHubIssues()"]');
            let originalText = "🐱 GitHub Issues importieren";
            if (importBtn) {
                originalText = importBtn.innerHTML;
                importBtn.disabled = true;
                importBtn.innerHTML = "⏳ Lade Issues...";
            }

            try {
                // Fetch closed issues from GitHub API
                const url = "https://api.github.com/repos/DePhoSa/ersatzteil-konfigurator/issues?state=closed&per_page=50";
                const response = await fetch(url, {
                    headers: {
                        "Authorization": `token ${token}`,
                        "Accept": "application/vnd.github.v3+json"
                    }
                });

                if (!response.ok) {
                    throw new Error(`GitHub API Fehler: ${response.status} (${response.statusText})`);
                }

                const issues = await response.json();
                if (issues.length === 0) {
                    alert("Keine geschlossenen Issues auf GitHub gefunden.");
                    if (importBtn) {
                        importBtn.disabled = false;
                        importBtn.innerHTML = originalText;
                    }
                    return;
                }

                // Wir holen bereits veröffentlichte Versionen, um Duplikate zu vermeiden.
                const changelogsSnap = await getDocs(collection(db, "changelogs"));
                const importedIssueNumbers = new Set();
                changelogsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach(item => {
                            const match = item.text.match(/#(\d+)\s*\)?$/);
                            if (match) {
                                importedIssueNumbers.add(parseInt(match[1]));
                            }
                        });
                    }
                });

                // Neue, noch nicht importierte Issues filtern (und interne/Admin-Issues ausschließen)
                const newIssues = issues.filter(issue => {
                    if (importedIssueNumbers.has(issue.number)) return false;
                    
                    const titleLower = (issue.title || '').toLowerCase();
                    const adminKeywords = ['admin', 'mitarbeiter', 'ticketmanager', 'ticket-manager', 'support-ticket', 'issues-dashboard', 'issues dashboard', 'megafon', 'mega-fon', 'interne tools', 'internen tools', 'internes tool'];
                    const isAdminRelated = adminKeywords.some(kw => titleLower.includes(kw));
                    
                    return !isAdminRelated;
                });

                if (newIssues.length === 0) {
                    alert("Alle geschlossenen Issues wurden bereits in früheren Changelogs importiert!");
                    if (importBtn) {
                        importBtn.disabled = false;
                        importBtn.innerHTML = originalText;
                    }
                    return;
                }

                // Zeilen im Formular füllen
                const container = document.getElementById('clEntryContainer');
                
                // Wir zählen die bereits gefüllten Felder
                const existingRows = container.querySelectorAll('.cl-edit-row');
                let hasRealContent = false;
                existingRows.forEach(row => {
                    const val = row.querySelector('input').value.trim();
                    if (val) hasRealContent = true;
                });

                // Falls das Formular leer ist, räumen wir die eine leere Standardzeile weg
                if (!hasRealContent) {
                    container.innerHTML = "";
                }

                let fixCount = 0;
                let featureCount = 0;
                let improvementCount = 0;

                newIssues.forEach(issue => {
                    // Mapping der GitHub Labels auf Changelog Typen
                    let type = 'fix'; // Standardmäßig ein Bugfix
                    if (issue.labels && Array.isArray(issue.labels)) {
                        const labelNames = issue.labels.map(l => l.name.toLowerCase());
                        if (labelNames.includes('feature') || labelNames.includes('new') || labelNames.includes('✨ neu')) {
                            type = 'new';
                            featureCount++;
                        } else if (labelNames.includes('enhancement') || labelNames.includes('improvement') || labelNames.includes('🚀 verbess.')) {
                            type = 'imp';
                            improvementCount++;
                        } else {
                            fixCount++;
                        }
                    } else {
                        fixCount++;
                    }

                    // Text formatieren: Titel + Issue Nummer
                    const text = `${issue.title} (#${issue.number})`;
                    addChangelogLine(type, text);
                });

                // Versionsnummer-Empfehlung berechnen
                const q = query(collection(db, "changelogs"), orderBy("createdAt", "desc"), limit(1));
                const latestSnap = await getDocs(q);
                let currentVerStr = "1.50";
                if (!latestSnap.empty) {
                    currentVerStr = latestSnap.docs[0].data().version;
                }

                const currentVer = parseFloat(currentVerStr);
                if (!isNaN(currentVer)) {
                    let nextVer;
                    if (featureCount > 0 || improvementCount > 0) {
                        // Neue Features oder Verbesserungen -> Minor Version erhöhen (z.B. 1.50 -> 1.60)
                        nextVer = (Math.floor(currentVer * 10) + 1) / 10;
                    } else {
                        // Nur Bugfixes -> Patch Version erhöhen (z.B. 1.50 -> 1.51)
                        nextVer = currentVer + 0.01;
                    }
                    nextVer = Math.round(nextVer * 100) / 100;
                    document.getElementById('clVersionInput').value = nextVer.toFixed(2).replace(/\.00$/, '');
                }

                alert(`${newIssues.length} GitHub Issues erfolgreich importiert!\n\nEmpfohlene Version wurde eingetragen. Bitte überprüfe die Einträge vor dem Veröffentlichen.`);

            } catch (e) {
                console.error(e);
                alert("Fehler beim Importieren: " + e.message);
            } finally {
                if (importBtn) {
                    importBtn.disabled = false;
                    importBtn.innerHTML = originalText;
                }
            }
        };

        window.importGitHubCommits = async () => {
            const token = localStorage.getItem('gh_pat_token') || (document.getElementById('clGithubToken') ? document.getElementById('clGithubToken').value.trim() : '');
            if (!token) {
                alert("Bitte richte zuerst deinen GitHub Token ein (Klicke auf 'GitHub Token einrichten').");
                const panel = document.getElementById('githubTokenSetup');
                if (panel) panel.style.display = 'block';
                return;
            }

            const importBtn = document.querySelector('button[onclick="importGitHubCommits()"]');
            let originalText = "🐱 GitHub Commits importieren";
            if (importBtn) {
                originalText = importBtn.innerHTML;
                importBtn.disabled = true;
                importBtn.innerHTML = "⏳ Lade Commits...";
            }

            try {
                // 1. Wir holen das aktuellste Changelog zuerst, um dessen Zeitstempel zu ermitteln
                const qLatest = query(collection(db, "changelogs"), orderBy("createdAt", "desc"), limit(1));
                const latestSnap = await getDocs(qLatest);
                let latestChangelogDate = null;
                let currentVerStr = "1.50";
                if (!latestSnap.empty) {
                    const latestData = latestSnap.docs[0].data();
                    currentVerStr = latestData.version;
                    if (latestData.createdAt) {
                        // Firebase Timestamp zu JS Date konvertieren
                        latestChangelogDate = latestData.createdAt.toDate();
                    }
                }

                // 2. Commits von GitHub API abfragen
                const url = "https://api.github.com/repos/DePhoSa/ersatzteil-konfigurator/commits?per_page=40";
                const response = await fetch(url, {
                    headers: {
                        "Authorization": `token ${token}`,
                        "Accept": "application/vnd.github.v3+json"
                    }
                });

                if (!response.ok) {
                    throw new Error(`GitHub API Fehler: ${response.status} (${response.statusText})`);
                }

                const commits = await response.json();
                if (commits.length === 0) {
                    alert("Keine Commits auf GitHub gefunden.");
                    if (importBtn) {
                        importBtn.disabled = false;
                        importBtn.innerHTML = originalText;
                    }
                    return;
                }

                // Wir holen bereits veröffentlichte Versionen für die Duplikattextprüfung
                const changelogsSnap = await getDocs(collection(db, "changelogs"));
                const existingTexts = new Set();
                changelogsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach(item => {
                            existingTexts.add(item.text.toLowerCase().trim());
                        });
                    }
                });

                // 3. Neue Commits filtern (sowohl nach Duplikaten als auch nach Erstellungsdatum des letzten Changelogs!)
                const newCommits = [];
                commits.forEach(c => {
                    const rawMsg = c.commit.message || '';
                    const firstLine = rawMsg.split('\n')[0].trim();
                    if (!firstLine) return;

                    // A. Filtern nach Datum: Nur Commits einbeziehen, die NEUER sind als der letzte verzeichnete Changelog!
                    const commitDateStr = c.commit.committer?.date || c.commit.author?.date;
                    if (commitDateStr && latestChangelogDate) {
                        const commitDate = new Date(commitDateStr);
                        if (commitDate <= latestChangelogDate) {
                            return; // Überspringe Commits, die älter oder gleich alt wie das letzte Changelog sind
                        }
                    }

                    // Ignoriere typische Merge-Commits oder Release-Commits
                    const lowerLine = firstLine.toLowerCase();
                    if (lowerLine.startsWith('merge ') || lowerLine.startsWith('release:')) return;

                    // B. Duplikatprüfung: Existiert dieser Text bereits im Changelog?
                    let isDuplicate = false;
                    existingTexts.forEach(ex => {
                        if (ex.includes(lowerLine) || lowerLine.includes(ex)) {
                            isDuplicate = true;
                        }
                    });

                    // C. Admin/Mitarbeiter Filter: Keine internen Änderungen im Changelog anzeigen
                    const adminKeywords = ['admin', 'mitarbeiter', 'ticketmanager', 'ticket-manager', 'support-ticket', 'issues-dashboard', 'issues dashboard', 'megafon', 'mega-fon', 'interne tools', 'internen tools', 'internes tool'];
                    const isAdminRelated = adminKeywords.some(kw => lowerLine.includes(kw));

                    if (!isDuplicate && !isAdminRelated) {
                        newCommits.push(firstLine);
                    }
                });

                if (newCommits.length === 0) {
                    alert("Alle aktuellen Commits wurden bereits in früheren Changelogs importiert oder stammen aus der Zeit vor der letzten Version!");
                    if (importBtn) {
                        importBtn.disabled = false;
                        importBtn.innerHTML = originalText;
                    }
                    return;
                }

                // Zeilen im Formular füllen
                const container = document.getElementById('clEntryContainer');
                
                // Wir zählen die bereits gefüllten Felder
                const existingRows = container.querySelectorAll('.cl-edit-row');
                let hasRealContent = false;
                existingRows.forEach(row => {
                    const val = row.querySelector('input').value.trim();
                    if (val) hasRealContent = true;
                });

                // Falls das Formular leer ist, räumen wir die eine leere Standardzeile weg
                if (!hasRealContent) {
                    container.innerHTML = "";
                }

                let fixCount = 0;
                let featureCount = 0;
                let improvementCount = 0;

                newCommits.forEach(commitMsg => {
                    let type = 'fix'; // Standardmäßig ein Bugfix
                    const lowerMsg = commitMsg.toLowerCase();
                    
                    if (lowerMsg.startsWith('feat') || lowerMsg.startsWith('✨') || lowerMsg.includes('new')) {
                        type = 'new';
                        featureCount++;
                    } else if (lowerMsg.startsWith('fix') || lowerMsg.startsWith('bug') || lowerMsg.startsWith('🐞')) {
                        type = 'fix';
                        fixCount++;
                    } else {
                        type = 'imp';
                        improvementCount++;
                    }

                    // Bereinigung des Commit-Präfixes (z.B. "feat: ", "fix(auth): ", etc.)
                    let cleanedMsg = commitMsg;
                    const prefixRegex = /^(feat|fix|bug|refactor|style|docs|chore|improvement|imp|test|perf|ci|build)(?:\([^)]+\))?\s*:\s*(.*)$/i;
                    const match = cleanedMsg.match(prefixRegex);
                    if (match) {
                        cleanedMsg = match[2].trim();
                    }

                    // Emojis am Anfang entfernen falls vorhanden
                    cleanedMsg = cleanedMsg.replace(/^[✨🚀🐞📝🔧🎨🐛⚙️🛠️]\s*/g, '');

                    // Umlaut-Korrektur (z.B. Menue -> Menü, fuer -> für)
                    const umlautReplacements = [
                        { pattern: /\bmenue(s)?\b/gi, replacement: (match, p1) => 'Menü' + (p1 || '') },
                        { pattern: /\bfuer\b/g, replacement: 'für' },
                        { pattern: /\bFuer\b/g, replacement: 'Für' },
                        { pattern: /\bueber\b/g, replacement: 'über' },
                        { pattern: /\bUeber\b/g, replacement: 'Über' },
                        { pattern: /\bzurueck\b/gi, replacement: 'zurück' },
                        { pattern: /\bloeschen\b/gi, replacement: 'löschen' },
                        { pattern: /\bloescht\b/gi, replacement: 'löscht' },
                        { pattern: /\baendern\b/gi, replacement: 'ändern' },
                        { pattern: /\baendert\b/gi, replacement: 'ändert' },
                        { pattern: /\bgeaendert\b/gi, replacement: 'geändert' },
                        { pattern: /\bhinzufuegen\b/gi, replacement: 'hinzufügen' },
                        { pattern: /\bhinzugefuegt\b/gi, replacement: 'hinzugefügt' },
                        { pattern: /\beinfuegen\b/gi, replacement: 'einfügen' },
                        { pattern: /\bauswaehlen\b/gi, replacement: 'auswählen' },
                        { pattern: /\bausgewaehlt\b/gi, replacement: 'ausgewählt' },
                        { pattern: /\berhoehen\b/gi, replacement: 'erhöhen' },
                        { pattern: /\berhoeht\b/gi, replacement: 'erhöht' },
                        { pattern: /\bgroesser\b/gi, replacement: 'größer' },
                        { pattern: /\bschliessen\b/gi, replacement: 'schließen' },
                        { pattern: /\bausfuehren\b/gi, replacement: 'ausführen' },
                    ];
                    umlautReplacements.forEach(r => {
                        cleanedMsg = cleanedMsg.replace(r.pattern, r.replacement);
                    });

                    // Ersten Buchstaben groß schreiben
                    if (cleanedMsg.length > 0) {
                        cleanedMsg = cleanedMsg.charAt(0).toUpperCase() + cleanedMsg.slice(1);
                    }

                    // Carl: Auto-Bold Logic (wenn Carl: am Anfang steht)
                    if (/^carl\s*:/i.test(cleanedMsg)) {
                        cleanedMsg = cleanedMsg.replace(/^carl\s*:\s*/i, '<b>Carl</b>: ');
                    }

                    addChangelogLine(type, cleanedMsg);
                });

                // Versionsnummer-Empfehlung berechnen (Nutzt den oben bereits geladenen Stand)
                const currentVer = parseFloat(currentVerStr);
                if (!isNaN(currentVer)) {
                    let nextVer;
                    if (featureCount > 0 || improvementCount > 0) {
                        nextVer = (Math.floor(currentVer * 10) + 1) / 10;
                    } else {
                        nextVer = currentVer + 0.01;
                    }
                    nextVer = Math.round(nextVer * 100) / 100;
                    document.getElementById('clVersionInput').value = nextVer.toFixed(2).replace(/\.00$/, '');
                }

                alert(`${newCommits.length} GitHub Commits erfolgreich importiert!\n\nEmpfohlene Version wurde eingetragen. Bitte überprüfe die Einträge vor dem Veröffentlichen.`);

            } catch (e) {
                console.error(e);
                alert("Fehler beim Importieren der Commits: " + e.message);
            } finally {
                if (importBtn) {
                    importBtn.disabled = false;
                    importBtn.innerHTML = originalText;
                }
            }
        };

        function resetChangelogForm() {
            document.getElementById('clVersionInput').value = "";
            document.getElementById('clEntryContainer').innerHTML = "";
            addChangelogLine(); // Eine leere Zeile start
            document.getElementById('btnDeleteVersion').style.display = 'none';
        }

        // Hilfsfunktion: Alle Changelogs robust laden und nach Datum sortieren
        async function fetchAllChangelogsSorted() {
            const snap = await getDocs(collection(db, "changelogs"));
            if (snap.empty) return [];
            let list = [];
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const ver = String(data.version || docSnap.id).trim();
                list.push({ id: docSnap.id, ...data, version: ver });
            });

            list.sort((a, b) => {
                const tA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime())) : 0;
                const tB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime())) : 0;
                if (tB !== tA) return tB - tA;
                return String(b.version).localeCompare(String(a.version), undefined, { numeric: true });
            });

            return list;
        }

        // 2. ADMIN: Bestehende Versionen laden (Buttons unten, auf die letzten 5 limitiert)
        async function loadExistingVersionsList() {
            const container = document.getElementById('clExistingList');
            if (!container) return;
            container.innerHTML = "Lade...";

            try {
                const list = await fetchAllChangelogsSorted();
                container.innerHTML = "";

                if (list.length === 0) {
                    container.innerHTML = "<small>Keine Versionen vorhanden.</small>";
                    return;
                }

                list.slice(0, 5).forEach(data => {
                    const btn = document.createElement('button');
                    btn.innerText = "v" + data.version;
                    btn.className = "btn-edit";
                    btn.style.margin = "0";
                    btn.onclick = () => loadVersionToEdit(data.id, data);
                    container.appendChild(btn);
                });
            } catch (e) {
                console.error(e);
                container.innerText = "Fehler beim Laden.";
            }
        }

        // 3. ADMIN: Eine Version zum Editieren ins Formular laden
        window.loadVersionToEdit = (docId, data) => {
            document.getElementById('clVersionInput').value = data.version || docId;
            const container = document.getElementById('clEntryContainer');
            container.innerHTML = "";

            // Zeilen einfügen
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    addChangelogLine(item.type, item.text);
                });
            } else {
                addChangelogLine();
            }

            // Delete Button anzeigen
            const delBtn = document.getElementById('btnDeleteVersion');
            if (delBtn) {
                delBtn.style.display = 'block';
                delBtn.dataset.id = docId;
            }
        };

        // 4. ADMIN: Zeile zum Formular hinzufügen
        window.addChangelogLine = (type = 'new', text = '') => {
            const container = document.getElementById('clEntryContainer');
            const div = document.createElement('div');
            div.className = 'cl-edit-row';

            div.innerHTML = `
                <select class="admin-input" style="width:130px; flex-shrink:0;">
                    <option value="new" ${type === 'new' ? 'selected' : ''}>✨ Neu</option>
                    <option value="imp" ${type === 'imp' ? 'selected' : ''}>🚀 Verbess.</option>
                    <option value="fix" ${type === 'fix' ? 'selected' : ''}>🐞 Bugfix</option>
                </select>
                <input type="text" class="admin-input" style="width:100%;" placeholder="Beschreibung..." value="${(text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">
                <button onclick="this.parentElement.remove()" style="background:#fee; color:red; border:1px solid #fcc; border-radius:4px; cursor:pointer;">✕</button>
            `;
            container.appendChild(div);
        };

        // 5. ADMIN: Speichern (Mit automatischer Sortierung & Versions-Normalisierung!)
        window.saveChangelog = async () => {
            const rawVersion = document.getElementById('clVersionInput').value.trim();
            if (!rawVersion) return alert("Bitte Version eingeben (z.B. 0.6)");

            // Version normalisieren: Führendes 'v' entfernen, Komma zu Punkt
            const version = rawVersion.replace(/^[vV]/, '').replace(',', '.').trim();

            const rows = document.querySelectorAll('.cl-edit-row');
            let items = [];

            rows.forEach(row => {
                const type = row.querySelector('select').value;
                const text = row.querySelector('input').value.trim();
                if (text) {
                    items.push({ type, text });
                }
            });

            if (items.length === 0) return alert("Bitte mindestens eine Zeile Inhalt eingeben.");

            // --- SORTIERUNG ---
            // Neu (1) -> Verbess (2) -> Fix (3)
            items.sort((a, b) => {
                const ordA = CL_TYPES[a.type] ? CL_TYPES[a.type].order : 99;
                const ordB = CL_TYPES[b.type] ? CL_TYPES[b.type].order : 99;
                return ordA - ordB;
            });

            try {
                const clRef = doc(db, "changelogs", version);

                // Immer mit aktuellem Timestamp veröffentlichen
                await setDoc(clRef, {
                    version: version,
                    items: items,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }, { merge: true });

                // Falls zuvor eine Version mit Komma (z.B. "0,6") angelegt wurde, löschen wir das Duplikat
                if (rawVersion.includes(',')) {
                    deleteDoc(doc(db, "changelogs", rawVersion)).catch(() => {});
                }

                alert(`Changelog v${version} erfolgreich veröffentlicht!`);
                document.getElementById('adminChangelogModal').style.display = 'none';

                // Aktualisierungen anstoßen
                loadExistingVersionsList();
                checkChangelogStatus();
            } catch (e) {
                console.error(e);
                alert("Fehler: " + e.message);
            }
        };

        // 6. ADMIN: Löschen
        window.deleteCurrentVersion = async () => {
            const versionInput = document.getElementById('clVersionInput').value.trim();
            const delBtn = document.getElementById('btnDeleteVersion');
            const targetId = (delBtn && delBtn.dataset && delBtn.dataset.id) ? delBtn.dataset.id : versionInput.replace(/^[vV]/, '').replace(',', '.').trim();

            if (!confirm(`Version ${versionInput} wirklich unwiderruflich löschen?`)) return;

            try {
                await deleteDoc(doc(db, "changelogs", targetId));
                // Auch alternative Schreibweise versuchen zu löschen
                const altId = targetId.includes('.') ? targetId.replace('.', ',') : targetId.replace(',', '.');
                deleteDoc(doc(db, "changelogs", altId)).catch(() => {});

                resetChangelogForm();
                loadExistingVersionsList(); // Liste aktualisieren
                checkChangelogStatus();
                alert("Gelöscht.");
            } catch (e) {
                alert("Fehler: " + e.message);
            }
        };

        // --- USER SICHT ---

        // 7. Check beim Start: Gibt es was Neues? (KUGELSICHER)
        window.checkChangelogStatus = async () => {
            const badge = document.getElementById('updateBadge');
            const dot = document.getElementById('updateDot');
            const label = document.getElementById('currentVersionLabel');
            const user = auth.currentUser;

            if (!user) return;

            try {
                const list = await fetchAllChangelogsSorted();

                if (list.length === 0) {
                    if (badge) badge.style.display = 'none';
                    return;
                }

                const latestDoc = list[0];
                const latestVer = String(latestDoc.version || latestDoc.id).trim();
                const latestDate = latestDoc.createdAt ? (latestDoc.createdAt.toMillis ? latestDoc.createdAt.toMillis() : (latestDoc.createdAt.seconds ? latestDoc.createdAt.seconds * 1000 : new Date(latestDoc.createdAt).getTime())) : 0;

                if (badge) badge.style.display = 'flex';
                if (label) label.innerText = "v" + latestVer;

                // Dynamische Version für die Tour
                const tourVerSpan = document.getElementById('tourLatestVersion');
                if (tourVerSpan) tourVerSpan.innerText = latestVer;

                // 2. Nutzerdaten aus Firestore holen (Wann hat er zuletzt reingeschaut?)
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const lastSeenChangelog = userDoc.exists() ? (userDoc.data().lastChangelogSeenAt || 0) : 0;

                // 3. Vergleichen: Ist das Release-Datum neuer als der letzte Klick des Nutzers?
                if (latestDate > lastSeenChangelog) {
                    if (badge) badge.classList.add('badge-pulse');
                    if (dot) dot.style.backgroundColor = '#e74c3c'; // Rot (Ungelesen)
                } else {
                    if (badge) badge.classList.remove('badge-pulse');
                    if (dot) dot.style.backgroundColor = '#2ecc71'; // Grün (Gelesen)
                }

            } catch (e) {
                console.log("Changelog Check failed", e);
            }
        };

        // 8. User öffnet Modal -> Laden & "Gelesen" markieren (KUGELSICHER)
        window.openChangelogModal = async () => {
            const modal = document.getElementById('changelogModal');
            if (modal) modal.style.display = 'flex';
            const listDiv = document.getElementById('changelogList');
            const user = auth.currentUser;

            // Visuelles Feedback sofort umschalten
            const badge = document.getElementById('updateBadge');
            if (badge) badge.classList.remove('badge-pulse');
            const dot = document.getElementById('updateDot');
            if (dot) dot.style.backgroundColor = '#2ecc71';

            // Cloud-Update: Speicher den aktuellen Zeitpunkt beim Nutzer
            if (user) {
                try {
                    await updateDoc(doc(db, "users", user.uid), {
                        lastChangelogSeenAt: Date.now()
                    });
                } catch (e) { console.error("Konnte Sichtung nicht speichern", e); }
            }

            if (listDiv) listDiv.innerHTML = "Lade Historie...";
            try {
                const list = await fetchAllChangelogsSorted();
                if (listDiv) listDiv.innerHTML = "";

                if (list.length === 0) {
                    if (listDiv) listDiv.innerHTML = "<p style='text-align:center; color:#888;'>Keine Einträge vorhanden.</p>";
                    return;
                }

                list.forEach(d => {
                    const dateStr = d.createdAt ? (d.createdAt.seconds ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : new Date(d.createdAt).toLocaleDateString()) : 'Unbekannt';
                    let itemsHtml = "";
                    if (d.items) {
                        d.items.forEach(item => {
                            const conf = CL_TYPES[item.type] || CL_TYPES['fix'];
                            itemsHtml += `<div class="cl-item"><span class="cl-tag ${conf.class}">${conf.label}</span><span>${item.text}</span></div>`;
                        });
                    }
                    if (listDiv) {
                        listDiv.innerHTML += `
                            <div class="cl-version-block">
                                <div class="cl-header"><span>v${d.version || d.id}</span><span class="cl-date">${dateStr}</span></div>
                                <div>${itemsHtml}</div>
                            </div>`;
                    }
                });
            } catch (e) {
                if (listDiv) listDiv.innerHTML = "Fehler beim Laden.";
            }
        };

        // --- ARTIKELSUCHE MIT FILTER, HOVER, SORTIERUNG & DUPLIKAT-FILTER ---
        window.handleSearchInput = function () {
            const searchEl = document.getElementById('artNrSearch');
            const filterEl = document.getElementById('searchSeriesFilter');
            const resultsContainer = document.getElementById('searchResults');

            if (!searchEl || !resultsContainer || !filterEl) return;

            const query = searchEl.value.toLowerCase().trim();
            const clearBtn = document.getElementById('clearMainSearchBtn');
            if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';
            const filterVal = filterEl.value;

            if (query.length < 2) {
                resultsContainer.style.display = 'none';
                window.hideSearchPreview();
                return;
            }

            let matchedItems = [];
            let seenKeysMap = new Map(); // Speichert die Referenz zum bereits gefundenen Artikel

            for (const [id, part] of Object.entries(partsDB)) {
                const artNrStr = part.artNr ? String(part.artNr).toLowerCase() : '';
                const nameStr = part.name ? String(part.name).toLowerCase() : '';
                const descStr = part.desc ? String(part.desc).toLowerCase() : '';

                if (!artNrStr && !nameStr) continue;

                // NEU: Set für die Badges (Smarte Text-Erkennung)
                let sBadges = new Set();
                const lowerId = id.toLowerCase();
                const isBR = descStr.includes('baureihe') || descStr.includes('br');

                if (lowerId.includes('br20') || descStr.includes('br20') || descStr.includes('br 20') || (isBR && /\b20\b/.test(descStr))) sBadges.add("BR20");
                if (lowerId.includes('br30') || descStr.includes('br30') || descStr.includes('br 30') || (isBR && /\b30\b/.test(descStr))) sBadges.add("BR30");
                if (lowerId.includes('br40') || descStr.includes('br40') || descStr.includes('br 40') || (isBR && /\b40\b/.test(descStr))) sBadges.add("BR40");

                if (sBadges.size === 0) sBadges.add("BR40"); // Standard-Fallback

                // Filter-Check: Hat das Bauteil das gesuchte Badge?
                if (filterVal !== "all" && !sBadges.has(filterVal.toUpperCase())) continue;

                // --- NEU: Multi-Wort-Suche (Tokenisierung) ---
                const searchTerms = query.split(/\s+/); // Teilt die Suche bei Leerzeichen in Wörter auf
                const textToSearch = `${artNrStr} ${nameStr} ${descStr}`; // Gesamter Text des Bauteils

                // Prüft, ob JEDES Suchwort irgendwo im Text steht
                const isMatch = searchTerms.every(term => textToSearch.includes(term));

                if (isMatch) {
                    const uniqueKey = part.artNr ? String(part.artNr).trim() : String(part.name).trim();

                    if (!seenKeysMap.has(uniqueKey)) {
                        const newItem = { id, part, seriesBadges: Array.from(sBadges) };
                        seenKeysMap.set(uniqueKey, newItem);
                        matchedItems.push(newItem);
                    } else {
                        // Füge neue Badges hinzu, falls ein Alias-Teil eine andere Baureihe hat
                        const existingItem = seenKeysMap.get(uniqueKey);
                        sBadges.forEach(b => {
                            if (!existingItem.seriesBadges.includes(b)) {
                                existingItem.seriesBadges.push(b);
                            }
                        });
                    }
                }
            }

            // --- NEU: Smarte Relevanz-Sortierung (Scoring) ---
            matchedItems.forEach(item => {
                const queryL = query.toLowerCase();
                const artNrL = (item.part.artNr || '').toLowerCase();
                const nameL = (item.part.name || '').toLowerCase();
                const descL = (item.part.desc || '').toLowerCase();

                let score = 0;

                const terms = queryL.split(/\s+/);
                if (artNrL === queryL) score = 100;
                else if (nameL === queryL) score = 90;
                else if (nameL.startsWith(queryL)) score = 80;
                else if (artNrL.includes(queryL)) score = 70;
                else if (terms.every(t => nameL.includes(t))) score = 60; // Alle Suchwörter stehen im Namen
                else if (terms.every(t => descL.includes(t))) score = 10; // Alle Suchwörter stehen in der Beschreibung
                else score = 5; // Gemischter Treffer (z.B. ein Wort im Namen, eins in der ArtNr)

                item.score = score;
            });

            // Erst nach Score (Relevanz) absteigend sortieren, bei Gleichstand alphabetisch nach Name
            matchedItems.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                const nameA = a.part.name || "";
                const nameB = b.part.name || "";
                return nameA.localeCompare(nameB);
            });

            resultsContainer.innerHTML = '';

            matchedItems.forEach(item => {
                const { id, part, seriesBadges } = item;

                // Badges sortieren, damit BR40 immer ganz links steht
                seriesBadges.sort((a, b) => {
                    const order = { "BR40": 1, "BR30": 2, "BR20": 3 };
                    return order[a] - order[b];
                });

                let badgesHtml = '';
                seriesBadges.forEach(b => {
                    let bClass = "badge-br40";
                    if (b === "BR30") bClass = "badge-br30";
                    if (b === "BR20") bClass = "badge-br20";
                    badgesHtml += `<span style="font-size: 0.7rem; padding: 2px 5px; border-radius: 3px; font-weight: bold; margin-right: 4px;" class="${bClass}">${b}</span>`;
                });

                let imgSrc = '';
                const possibleKeys = ['path', 'img', 'image', 'imageurl', 'bild', 'foto'];
                for (let key of possibleKeys) {
                    if (part[key] && typeof part[key] === 'string' && part[key].trim() !== '') {
                        imgSrc = part[key].trim();
                        break;
                    }
                }
                if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.includes('img/')) {
                    if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                    imgSrc = 'img/' + imgSrc;
                }

                const div = document.createElement('div');
                div.className = 'search-result-item';

                div.onclick = () => {
                    window.hideSearchPreview();
                    window.openSearchModal(id);
                };

                if (imgSrc) {
                    div.onmouseenter = (e) => window.showSearchPreview(e, imgSrc, item.part.fittingTags);
                    div.onmousemove = (e) => window.moveSearchPreview(e);
                    div.onmouseleave = () => window.hideSearchPreview();
                }

                div.innerHTML = `
                    <span class="search-result-name">${part.name || 'Ohne Name'}</span>
                    <div style="display: flex; align-items: center;">
                        ${badgesHtml}
                        <span class="search-result-nr" style="margin-left: 4px;">${part.artNr || ''}</span>
                    </div>
                `;
                resultsContainer.appendChild(div);
            });

            resultsContainer.style.display = 'block';
            if (matchedItems.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">Keine Artikel gefunden.</div>';
            }
        };

        // --- NEU: Artikelsuche DIREKT IM MODAL (Mit Filter) ---
        window.handleModalSearch = function () {
            const searchEl = document.getElementById('modalSearchInput');
            const filterEl = document.getElementById('modalSearchSeriesFilter'); // NEU: Filter-Element holen
            const resultsContainer = document.getElementById('modalSearchResults');
            if (!searchEl || !resultsContainer || !filterEl) return;

            const query = searchEl.value.toLowerCase().trim();
            const filterVal = filterEl.value; // NEU: Filter-Wert auslesen

            const clearBtn = document.getElementById('clearModalSearchBtn');
            if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';

            if (query.length < 2) {
                resultsContainer.style.display = 'none';
                window.hideSearchPreview();
                return;
            }

            let matchedItems = [];
            let seenKeysMap = new Map();

            // Suchen
            for (const [id, part] of Object.entries(partsDB)) {
                const artNrStr = part.artNr ? String(part.artNr).toLowerCase() : '';
                const nameStr = part.name ? String(part.name).toLowerCase() : '';
                const descStr = part.desc ? String(part.desc).toLowerCase() : '';

                // --- NEU: Baureihen-Filter direkt aus der Datenbank abfragen! ---
                let sTags = part.seriesTags && part.seriesTags.length > 0 ? part.seriesTags : ["BR40"];

                // Wenn nicht "Alle" ausgewählt ist und das Bauteil die gewählte Baureihe nicht hat -> überspringen
                if (filterVal !== "all" && !sTags.includes(filterVal.toUpperCase())) {
                    continue;
                }
                // -----------------------------------------------------------------

                // --- NEU: Multi-Wort-Suche (Tokenisierung) ---
                const searchTerms = query.split(/\s+/);
                const textToSearch = `${artNrStr} ${nameStr} ${descStr}`;
                const isMatch = searchTerms.every(term => textToSearch.includes(term));

                if (isMatch) {
                    const uniqueKey = part.artNr ? String(part.artNr).trim() : String(part.name).trim();
                    if (!seenKeysMap.has(uniqueKey)) {
                        const newItem = { id, part, sTags: sTags };
                        seenKeysMap.set(uniqueKey, newItem);
                        matchedItems.push(newItem);
                    }
                }
            }

            // --- NEU: Smarte Relevanz-Sortierung (Scoring) ---
            matchedItems.forEach(item => {
                const queryL = query.toLowerCase();
                const artNrL = (item.part.artNr || '').toLowerCase();
                const nameL = (item.part.name || '').toLowerCase();
                const descL = (item.part.desc || '').toLowerCase();

                let score = 0;

                const terms = queryL.split(/\s+/);
                if (artNrL === queryL) score = 100;
                else if (nameL === queryL) score = 90;
                else if (nameL.startsWith(queryL)) score = 80;
                else if (artNrL.includes(queryL)) score = 70;
                else if (terms.every(t => nameL.includes(t))) score = 60; // Alle Suchwörter stehen im Namen
                else if (terms.every(t => descL.includes(t))) score = 10; // Alle Suchwörter stehen in der Beschreibung
                else score = 5; // Gemischter Treffer

                item.score = score;
            });

            // Erst nach Score (Relevanz) absteigend sortieren, bei Gleichstand alphabetisch nach Name
            matchedItems.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                const nameA = a.part.name || "";
                const nameB = b.part.name || "";
                return nameA.localeCompare(nameB);
            });

            // Ergebnisse ausgeben
            resultsContainer.innerHTML = '';
            matchedItems.forEach(item => {
                const { id, part, sTags } = item;

                let badgesHtml = '';
                // Badges sortieren (BR40 nach links)
                [...sTags].sort((a, b) => {
                    const order = { "BR40": 1, "BR30": 2, "BR20": 3 };
                    return (order[a] || 99) - (order[b] || 99);
                }).forEach(b => {
                    let bClass = "badge-br40";
                    if (b === "BR30") bClass = "badge-br30";
                    if (b === "BR20") bClass = "badge-br20";
                    badgesHtml += `<span style="font-size: 0.65rem; padding: 2px 4px; border-radius: 3px; font-weight: bold; margin-right: 4px;" class="${bClass}">${b}</span>`;
                });

                const div = document.createElement('div');
                div.className = 'search-result-item';

                // --- BILD-VORSCHAU FÜR MODAL-SUCHE ---
                let imgSrc = '';
                const possibleKeys = ['path', 'img', 'image', 'imageurl', 'bild', 'foto'];
                for (let key of possibleKeys) {
                    if (part[key] && typeof part[key] === 'string' && part[key].trim() !== '') {
                        imgSrc = part[key].trim(); break;
                    }
                }
                if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.includes('img/')) {
                    if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                    imgSrc = 'img/' + imgSrc;
                }

                if (imgSrc) {
                    div.onmouseenter = (e) => window.showSearchPreview(e, imgSrc, part.fittingTags);
                    div.onmousemove = (e) => window.moveSearchPreview(e);
                    div.onmouseleave = () => window.hideSearchPreview();
                }

                // BEIM KLICK: Suche leeren und Modal mit neuem Artikel überschreiben
                div.onclick = () => {
                    resultsContainer.style.display = 'none';
                    searchEl.value = '';
                    window.hideSearchPreview();
                    window.openSearchModal(id);
                };

                div.innerHTML = `
                    <span class="search-result-name" style="font-size:0.8rem;">${part.name || 'Ohne Name'}</span>
                    <div style="display: flex; align-items: center;">
                        ${badgesHtml}
                        <span class="search-result-nr" style="margin-left: 4px; font-size:0.8rem;">${part.artNr || ''}</span>
                    </div>
                `;
                resultsContainer.appendChild(div);
            });

            resultsContainer.style.display = 'block';
            if (matchedItems.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 10px; color: #888; text-align: center; font-size:0.8rem;">Nichts gefunden.</div>';
            }
        };
        // --- NEU: HOVER BILD LOGIK ---
        window.showSearchPreview = function (event, src, fTags) {
            if (!src) return;

            let previewBox = document.getElementById('searchHoverPreview');
            if (!previewBox) {
                previewBox = document.createElement('div');
                previewBox.id = 'searchHoverPreview';
                previewBox.style.cssText = 'display:none; position:fixed; z-index: 3500; background:#fff; border:1px solid #ddd; box-shadow:0 8px 20px rgba(0,0,0,0.15); padding:8px; border-radius:6px; pointer-events:none; text-align:center;';
                previewBox.innerHTML = `
                    <img id="searchHoverImg" src="" style="max-width:180px; max-height:180px; display:block; object-fit:contain; border-radius:3px;">
                    <div id="searchHoverTags" style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;"></div>
                `;
                document.body.appendChild(previewBox);
            }

            const imgEl = document.getElementById('searchHoverImg');
            imgEl.src = src;

            const tagsEl = document.getElementById('searchHoverTags');
            const safeTags = fTags || [];
            if (safeTags.length > 0) {
                tagsEl.innerHTML = safeTags.map(t => `<span style="background:#f5eef8; color:#8e44ad; border:1px solid #8e44ad40; padding:2px 6px; border-radius:3px; font-size:0.7rem; font-weight:bold;">${t}-Beschlag</span>`).join('');
                tagsEl.style.display = 'flex';
                imgEl.style.marginBottom = '6px';
            } else {
                tagsEl.innerHTML = '';
                tagsEl.style.display = 'none';
                imgEl.style.marginBottom = '0';
            }

            previewBox.style.display = 'block';
            window.moveSearchPreview(event);
        };

        window.moveSearchPreview = function (event) {
            const previewBox = document.getElementById('searchHoverPreview');
            if (!previewBox || previewBox.style.display === 'none') return;

            // Position leicht versetzt zum Mauszeiger
            let x = event.clientX + 15;
            let y = event.clientY + 15;

            // Verhindern, dass das Bild rechts oder unten aus dem Bildschirm rutscht
            const rect = previewBox.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x = event.clientX - rect.width - 15;
            if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;

            previewBox.style.left = x + 'px';
            previewBox.style.top = y + 'px';
        };

        window.hideSearchPreview = function () {
            const previewBox = document.getElementById('searchHoverPreview');
            if (previewBox) previewBox.style.display = 'none';
        };

        window.handleSearchEnter = function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const firstResult = document.querySelector('#searchResults .search-result-item');
                if (firstResult) {
                    firstResult.click();
                }
            }
        };

        // --- NEU: MODAL GEDÄCHTNIS (HISTORY) ---
        let searchModalHistory = [];
        let currentSearchModalPartId = null;

        window.goBackInSearchModal = function () {
            if (searchModalHistory.length > 0) {
                // Das letzte Element aus dem Verlauf holen
                const prevPartId = searchModalHistory.pop();
                // Wichtig: 'true' übergeben, damit das System weiß, wir gehen rückwärts!
                window.openSearchModal(prevPartId, true);
            }
        };

        // --- AKTUALISIERTE ÖFFNEN-FUNKTION (Mit Datenbank-Tags!) ---
        window.openSearchModal = function (partId, isBackNavigation = false) {
            const part = partsDB[partId];
            if (!part) return;

            const modal = document.getElementById('searchModal');

            if (modal.style.display !== 'flex') { searchModalHistory = []; }
            else if (!isBackNavigation && currentSearchModalPartId) { searchModalHistory.push(currentSearchModalPartId); }

            currentSearchModalPartId = partId;

            const backBtn = document.getElementById('searchModalBackBtn');
            if (backBtn) backBtn.style.display = searchModalHistory.length > 0 ? 'inline-block' : 'none';

            document.getElementById('searchResults').style.display = 'none';
            document.getElementById('artNrSearch').value = '';

            document.getElementById('searchModalTitle').innerText = part.name || 'Produktdetails';
            document.getElementById('searchModalArtNr').innerText = part.artNr || '-';
            const priceVal = part.price ? parseFloat(part.price) : 0;
            document.getElementById('searchModalPrice').innerText = priceVal.toFixed(2).replace('.', ',');

            const descContainer = document.getElementById('searchModalDescContainer');
            const descText = document.getElementById('searchModalDesc');
            if (part.desc && part.desc.trim() !== '') {
                descText.innerText = part.desc;
                descContainer.style.display = 'block';
            } else {
                descContainer.style.display = 'none';
            }

            const imgEl = document.getElementById('searchModalImg');
            let imgSrc = '';
            const possibleKeys = ['path', 'img', 'image', 'imageurl', 'bild', 'foto'];
            for (let key of possibleKeys) {
                if (part[key] && typeof part[key] === 'string' && part[key].trim() !== '') {
                    imgSrc = part[key].trim(); break;
                }
            }

            if (imgSrc) {
                if (!imgSrc.startsWith('http') && !imgSrc.includes('img/')) {
                    if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                    imgSrc = 'img/' + imgSrc;
                }
                imgEl.src = imgSrc;
                imgEl.style.display = 'inline-block';
                imgEl.onclick = null;
                imgEl.style.cursor = 'default';
                imgEl.onerror = function () { this.style.display = 'none'; };
            } else {
                imgEl.style.display = 'none';
                imgEl.src = '';
            }

            // --- NEU: BADGES AUS DER DATENBANK ZEICHNEN (MIT EINZEL-FARBPRÜFUNG) ---
            const renderBadges = (tags, defaultColor, defaultBg) => {
                if (!tags || tags.length === 0) return '<span style="color:#aaa; font-size:0.8rem;">- keine Angabe -</span>';
                return tags.map(t => {
                    let color = defaultColor;
                    let bg = defaultBg;

                    // Jedes Badge bekommt seine exakte Farbe zugewiesen
                    if (t === 'BR40') { color = 'var(--color-br40)'; bg = '#eaf4fb'; }
                    else if (t === 'BR30') { color = 'var(--color-br30)'; bg = '#fdf2e9'; }
                    else if (t === 'BR20') { color = 'var(--color-br20)'; bg = '#eafaf1'; }
                    else if (t === 'Z' || t === 'N' || t === 'L') { color = '#8e44ad'; bg = '#f5eef8'; } // Lila für Beschläge

                    return `<span style="background:${bg}; color:${color}; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; border:1px solid ${color}40;">${t}</span>`;
                }).join('');
            };

            // Baureihen vorher sortieren, damit BR40 immer ganz links steht
            const sortedSeries = part.seriesTags ? [...part.seriesTags].sort((a, b) => {
                const order = { "BR40": 1, "BR30": 2, "BR20": 3 };
                return (order[a] || 99) - (order[b] || 99);
            }) : [];

            document.getElementById('modalBadgeSeries').innerHTML = renderBadges(sortedSeries, 'var(--hormann-blue)', '#eaf4fb');
            document.getElementById('modalBadgeFittings').innerHTML = renderBadges(part.fittingTags, '#8e44ad', '#f5eef8');
            document.getElementById('modalBadgePositions').innerHTML = renderBadges(part.positionTags, 'var(--friendly-green)', '#eafaf1');

            // --- NEU: BUTTONS AUS DEN DATENBANK-TAGS GENERIEREN ---
            const locateContainer = document.getElementById('searchModalLocateButtons');
            locateContainer.innerHTML = '';

            const sTags = part.seriesTags && part.seriesTags.length > 0 ? part.seriesTags : ['BR40']; // Fallback

            sTags.sort().forEach(s => {
                let btnColor = "var(--hormann-blue)";
                if (s === "BR30") btnColor = "var(--color-br30)";
                if (s === "BR20") btnColor = "var(--color-br20)";

                locateContainer.innerHTML += `
                    <button class="btn-locate" onclick="showInGraphic('${partId}', '${s}')" style="border: 2px solid ${btnColor}; color: ${btnColor}; padding: 6px 12px; font-size:0.8rem;">
                        <span>👁️</span> Zeige in <strong>${s}</strong>
                    </button>
                `;
            });

            // --- ZUGEHÖRIGE BAUTEILE ERMITTELN (Bleibt gleich!) ---
            const relatedBox = document.getElementById('searchModalRelatedBox');
            const relatedList = document.getElementById('searchModalRelatedList');
            relatedList.innerHTML = '';
            let relatedIds = new Set();

            let aliasIds = [];
            const artNr = part.artNr ? String(part.artNr).trim() : '';
            if (artNr) {
                for (const [k, p] of Object.entries(partsDB)) {
                    if (p.artNr && String(p.artNr).trim() === artNr) aliasIds.push(k);
                }
            } else { aliasIds.push(partId); }

            aliasIds.forEach(aliasId => {
                const aliasPart = partsDB[aliasId];
                if (aliasPart && aliasPart.linkedParts && Array.isArray(aliasPart.linkedParts)) {
                    aliasPart.linkedParts.forEach(id => relatedIds.add(id));
                }
            });

            for (const [key, p] of Object.entries(partsDB)) {
                if (p.linkedParts && Array.isArray(p.linkedParts)) {
                    const hasLink = p.linkedParts.some(linkedId => aliasIds.includes(linkedId));
                    if (hasLink) {
                        relatedIds.add(key);
                        p.linkedParts.forEach(siblingId => relatedIds.add(siblingId));
                    }
                }
            }

            aliasIds.forEach(aliasId => relatedIds.delete(aliasId));

            if (relatedIds.size > 0) {
                relatedBox.style.display = 'flex';
                let relatedArray = Array.from(relatedIds).map(id => {
                    let p = partsDB[id];
                    if (!p) return null;

                    // Arrays aus der DB nutzen (Fallback BR40)
                    let sTags = p.seriesTags && p.seriesTags.length > 0 ? p.seriesTags : ["BR40"];
                    return { id, part: p, sTags: sTags };
                }).filter(item => item !== null);

                const getCategory = (p) => {
                    if (p.positionTags && p.positionTags.length > 0) return p.positionTags.join(' & ') + 'sektion';
                    if (p.category) return p.category;
                    return "Zubehör";
                };

                let groupedRelated = {};
                relatedArray.forEach(item => {
                    let cat = getCategory(item.part);
                    if (!groupedRelated[cat]) groupedRelated[cat] = [];
                    groupedRelated[cat].push(item);
                });

                Object.keys(groupedRelated).sort().forEach(groupName => {
                    const header = document.createElement('div');
                    header.style.cssText = "font-size: 0.75rem; font-weight: bold; color: #888; text-transform: uppercase; margin-top: 10px; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px solid #eee;";
                    header.innerText = groupName;
                    relatedList.appendChild(header);

                    let items = groupedRelated[groupName];

                    // --- NEU: ERST NACH BAUREIHE SORTIEREN (BR40 > BR30 > BR20), DANN NACH NAME ---
                    items.sort((a, b) => {
                        const getRank = (tags) => {
                            if (tags.includes('BR40')) return 1;
                            if (tags.includes('BR30')) return 2;
                            if (tags.includes('BR20')) return 3;
                            return 4;
                        };
                        const rankA = getRank(a.sTags);
                        const rankB = getRank(b.sTags);

                        // Wenn Ränge unterschiedlich sind, den kleineren Rang (wichtiger) nach oben packen
                        if (rankA !== rankB) return rankA - rankB;

                        // Bei gleichem Rang alphabetisch sortieren
                        return (a.part.name || '').localeCompare(b.part.name || '');
                    });

                    items.forEach(item => {

                        // --- NEU: EINZELNE, FARBLICH KORREKTE BADGES GENERIEREN ---
                        let badgesHtml = '';

                        // Tags sortieren, damit BR40 immer links neben BR30 steht
                        const sortedTags = [...item.sTags].sort((a, b) => {
                            const order = { "BR40": 1, "BR30": 2, "BR20": 3 };
                            return (order[a] || 99) - (order[b] || 99);
                        });

                        sortedTags.forEach(b => {
                            let bClass = "badge-br40";
                            if (b === "BR30") bClass = "badge-br30";
                            if (b === "BR20") bClass = "badge-br20";
                            badgesHtml += `<span class="related-part-badge ${bClass}" style="margin-left:4px;">${b}</span>`;
                        });

                        let hoverImgSrc = '';
                        const possibleKeys = ['path', 'img', 'image', 'imageurl', 'bild', 'foto'];
                        for (let key of possibleKeys) {
                            if (item.part[key] && typeof item.part[key] === 'string' && item.part[key].trim() !== '') {
                                hoverImgSrc = item.part[key].trim(); break;
                            }
                        }
                        if (hoverImgSrc && !hoverImgSrc.startsWith('http') && !hoverImgSrc.includes('img/')) {
                            if (hoverImgSrc.startsWith('/')) hoverImgSrc = hoverImgSrc.substring(1);
                            hoverImgSrc = 'img/' + hoverImgSrc;
                        }

                        const div = document.createElement('div');
                        div.className = 'related-part-item';
                        div.title = "Klicken, um dieses Bauteil zu öffnen";
                        div.onclick = () => { window.hideSearchPreview(); window.openSearchModal(item.id); };

                        if (hoverImgSrc) {
                            div.onmouseenter = (e) => window.showSearchPreview(e, hoverImgSrc, item.part.fittingTags);
                            div.onmousemove = (e) => window.moveSearchPreview(e);
                            div.onmouseleave = () => window.hideSearchPreview();
                        }

                        div.innerHTML = `
                            <div>
                                <span class="related-part-name">${item.part.name || 'Unbekannt'}</span>
                                <span style="color:#888; font-size: 0.75rem; margin-left: 5px;">${item.part.artNr || ''}</span>
                            </div>
                            <div style="display:flex;">${badgesHtml}</div>
                        `;
                        relatedList.appendChild(div);
                    });
                });
            } else {
                relatedBox.style.display = 'none';
            }

            modal.style.display = 'flex';
        };

        // --- NEU: INTELLIGENTER SPRUNG IN DIE GRAFIK (Mit Beschlags-Prüfung) ---
        window.pendingGraphicJump = null;

        window.showInGraphic = (partId, targetSeries) => {
            const p = partsDB[partId];
            if (!p) return;

            // 1. BESCHLAGS-KOMPATIBILITÄT PRÜFEN (Welche Beschläge unterstützt das Teil?)
            let foundFittings = new Set();
            const partsToCheck = [];
            const artNr = p.artNr ? String(p.artNr).trim() : '';

            // Auch Alias-Teile mit derselben Artikelnummer scannen
            if (artNr) {
                for (const [k, pObj] of Object.entries(partsDB)) {
                    if (pObj.artNr && String(pObj.artNr).trim() === artNr) partsToCheck.push(k);
                }
            } else {
                partsToCheck.push(partId);
            }

            partsToCheck.forEach(k => {
                const pObj = partsDB[k];
                const idL = k.toLowerCase();
                const descL = (pObj.desc || "").toLowerCase();
                const nameL = (pObj.name || "").toLowerCase();
                const beschlagKeyword = descL.includes('beschlag') || nameL.includes('beschlag');

                if (idL.includes('_z_') || idL.endsWith('_z') || descL.includes('z-beschlag') || nameL.includes('z-beschlag') || (beschlagKeyword && /\bz\b/.test(descL))) foundFittings.add('Z');
                if (idL.includes('_n_') || idL.endsWith('_n') || descL.includes('n-beschlag') || nameL.includes('n-beschlag') || (beschlagKeyword && /\bn\b/.test(descL))) foundFittings.add('N');
                if (descL.includes('l-beschlag') || nameL.includes('l-beschlag') || (beschlagKeyword && /\bl\b/.test(descL))) {
                    foundFittings.add('L');
                } else if ((idL.includes('_l_') && !idL.endsWith('_l_')) || idL.includes('beschlag_l')) {
                    foundFittings.add('L');
                }
            });

            // --- BUGFIX: Unmögliche Beschläge für die Ziel-Baureihe ausblenden ---
            if (targetSeries === 'BR30') {
                foundFittings.delete('Z'); // BR30 hat physikalisch keinen Z-Beschlag
            }
            if (targetSeries === 'BR20') {
                foundFittings.delete('Z'); // BR20 hat keinen Z-Beschlag
                foundFittings.delete('L'); // BR20 hat keinen L-Beschlag
            }

            const possibleFittings = Array.from(foundFittings);

            // FALL A: Es gibt MEHRERE mögliche Beschläge -> Wir öffnen das neue Popup!
            if (possibleFittings.length > 1) {
                document.getElementById('fitSel_Z').style.display = possibleFittings.includes('Z') ? 'flex' : 'none';
                document.getElementById('fitSel_N').style.display = possibleFittings.includes('N') ? 'flex' : 'none';
                document.getElementById('fitSel_L').style.display = possibleFittings.includes('L') ? 'flex' : 'none';

                window.pendingGraphicJump = { partId, targetSeries };
                document.getElementById('fittingSelectionModal').style.display = 'flex';
                return; // PAUSE! Wir warten auf den Klick des Nutzers.
            }

            // FALL B: Es gibt genau EINEN Beschlag -> Wir stellen den Konfigurator heimlich darauf ein.
            if (possibleFittings.length === 1) {
                selectFittingLeft(possibleFittings[0]);
                selectFittingRight(possibleFittings[0]);
            }

            // FALL C: (oder nach A/B) -> Weiter zum Sprung
            window.executeGraphicJump(partId, targetSeries);
        };

        // Wird durch den Klick im neuen Popup aufgerufen
        window.confirmGraphicJump = (fitting) => {
            document.getElementById('fittingSelectionModal').style.display = 'none';
            selectFittingLeft(fitting);
            selectFittingRight(fitting);

            if (window.pendingGraphicJump) {
                window.executeGraphicJump(window.pendingGraphicJump.partId, window.pendingGraphicJump.targetSeries);
                window.pendingGraphicJump = null;
            }
        };

        // Die eigentliche Sprung-Logik (Jetzt mit smartem Standard-Fallback für BR30)
        window.executeGraphicJump = (partId, targetSeries) => {
            const p = partsDB[partId];
            if (!p) return;

            closeSearchModal(true);

            if (typeof window.resetConfiguratorState === 'function') {
                window.resetConfiguratorState();
            } else {
                window.currentViewList = [];
                window.calculatedList = [];
                if (typeof window.resetMarkersVisuals === 'function') {
                    window.resetMarkersVisuals();
                }
                const btnReset = document.getElementById('btnResetFilter');
                if (btnReset) btnReset.style.display = 'none';
                if (typeof window.renderTable === 'function') window.renderTable([]);
            }

            if (window.currentSeries !== targetSeries) {
                window.switchSeries(targetSeries);
            }

            const wrap = document.getElementById('visualCollapsible');
            if (wrap && wrap.classList.contains('visual-collapsed')) {
                toggleVisualGraphic();
            }

            isGraphicMode = true;

            const idStr = partId.toLowerCase();
            const nameStr = (p.name || "").toLowerCase();
            const labelStr = (p.secLabel || "").toLowerCase();
            const textCheck = (idStr + " " + nameStr + " " + (p.desc || "").toLowerCase() + " " + labelStr);

            // --- BUGFIX: BAUREIHE 30 BAUJAHR IMMER AUTOMATISCH SETZEN ---
            if (targetSeries === 'BR30') {
                const yearSelect = document.getElementById('selectBR30Year');
                if (yearSelect) {
                    // Standardmäßig auf "neu" setzen, um den Nutzer nicht mit Abfragen zu nerven!
                    let yearToSet = "new";
                    const artNrCheck = p.artNr ? String(p.artNr).trim() : "";

                    // Nur wenn es ganz klar ein altes Teil ist, wechseln wir auf "old"
                    if (/\balt\b/.test(textCheck) || textCheck.includes('1991') || textCheck.includes('07.03.1997') || idStr.includes('_alt') || idStr.includes('_42') || artNrCheck === '3039196') {
                        yearToSet = "old";
                    }

                    yearSelect.value = yearToSet;
                    yearSelect.classList.remove('input-required');
                }
            }
            // -----------------------------------------------------------

            // --- EIGENSCHAFTEN (RC2 / 170kg / TVS / etc.) AUTOMATISCH SETZEN ---
            const isRC2Part = textCheck.includes('rc2') || textCheck.includes('rc 2');
            const is170kgPart = textCheck.includes('170kg') || textCheck.includes('170 kg') || textCheck.includes('schwer');
            const isTVSPart = textCheck.includes('tvs') || textCheck.includes('verstärkung') || textCheck.includes('scharnier 6') || textCheck.includes('scharnier_6');

            const toggleRC2_B = document.getElementById('checkRC2_B');
            const toggleTVS_B = document.getElementById('checkTVS_B');
            const toggle170_B = document.getElementById('check170kg_B');
            const toggle170Schlupf_B = document.getElementById('check170kgSchlupf_B');
            const toggle5001_B = document.getElementById('check5001mm_B');

            if (toggleRC2_B) toggleRC2_B.checked = false;
            if (toggleTVS_B) toggleTVS_B.checked = false;
            if (toggle170_B) toggle170_B.checked = false;
            if (toggle170Schlupf_B) toggle170Schlupf_B.checked = false;
            if (toggle5001_B) toggle5001_B.checked = false;

            if (isRC2Part && toggleRC2_B) {
                toggleRC2_B.checked = true;
            } else if (isTVSPart && toggleTVS_B) {
                const wrapperTVS = document.getElementById('rowTVS_B');
                if (wrapperTVS && wrapperTVS.style.display !== 'none') toggleTVS_B.checked = true;
            } else if (is170kgPart && toggle170_B) {
                const wrapper170 = document.getElementById('row170kg_B');
                if (wrapper170 && wrapper170.style.display !== 'none') toggle170_B.checked = true;
            }
            // -----------------------------------------------------------

            let isLeft = /\b_?l\b/.test(idStr) || textCheck.includes('links') || textCheck.includes(' li,') || textCheck.includes(' li.');
            let isRight = /\b_?r\b/.test(idStr) || textCheck.includes('rechts') || textCheck.includes(' re,') || textCheck.includes(' re.');
            if (!isLeft && !isRight) { isLeft = true; isRight = true; }

            let isTop = false;
            let isMiddle = false;
            let isBottom = false;
            let isCenter = false;
            let isSeal = false;

            if (p.secLabel && p.secLabel.trim() !== '') {
                if (labelStr.includes('3')) isTop = true;
                if (labelStr.includes('2')) isMiddle = true;
                if (labelStr.includes('1')) isBottom = true;
            } else {
                if (textCheck.includes('top') || textCheck.includes('oben') || /\boben\b/.test(textCheck)) isTop = true;
                if (textCheck.includes('boden') || textCheck.includes('aufsetz') || textCheck.includes('unten') || /\bunten\b/.test(textCheck)) isBottom = true;
                if (textCheck.includes('zwischen')) isMiddle = true;

                if ((textCheck.includes('rollenbock') || textCheck.includes('halter') || textCheck.includes('rollenhalter')) && !isTop && !isBottom) {
                    isMiddle = true;
                }
            }

            if (textCheck.includes('mittelscharnier') || (textCheck.includes('scharnier') && !textCheck.includes('rollen') && !textCheck.includes('seitlich'))) {
                isCenter = true;
                isMiddle = false;
            }
            if (textCheck.includes('dichtung') || textCheck.includes('seal')) {
                isSeal = true;
                isBottom = false;
            }

            let targets = [];
            if (isSeal) targets.push('.pos-bottom-seal');
            if (isCenter) targets.push('.pos-center-1', '.pos-center-2', '.pos-center-3');

            if (isTop) {
                if (isLeft) targets.push('.pos-tl');
                if (isRight) targets.push('.pos-tr');
            }
            if (isBottom && !isSeal) {
                if (isLeft) targets.push('.pos-bl');
                if (isRight) targets.push('.pos-br');
            }
            if (isMiddle) {
                if (isLeft) targets.push('.pos-ml', '.pos-ml-1', '.pos-ml-2');
                if (isRight) targets.push('.pos-mr', '.pos-mr-1', '.pos-mr-2');
            }

            let markersFound = false;
            targets.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.classList.add('active');
                    markersFound = true;
                });
            });

            if (markersFound) {
                updateListFromGraphic();
            } else {
                const graphic = document.querySelector('.visual-img-bg');
                if (graphic) {
                    graphic.classList.add('shake-element');
                    setTimeout(() => graphic.classList.remove('shake-element'), 500);
                }
            }

            setTimeout(() => {
                const targetEl = document.getElementById('optionBHeader');
                if (targetEl) {
                    const yOffset = -20;
                    const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }, 100);
        };

        window.closeSearchModal = function (eventOrForce) {
            if (eventOrForce === true || (eventOrForce && eventOrForce.target && eventOrForce.target.id === 'searchModal')) {
                document.getElementById('searchModal').style.display = 'none';
            }
        };

        function handleSearchEnter(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const firstResult = document.querySelector('#searchResults .search-result-item');
                if (firstResult) {
                    firstResult.click(); // Öffnet das erste gefundene Ergebnis
                }
            }
        }

        // --- KLICK AUSSERHALB SCHLIESST MENÜS & SUCHE ---
        document.addEventListener('click', function (event) {
            // 1. Profil-Menü
            const profileMenu = document.getElementById('profileMenu');
            const userProfileContainer = document.getElementById('userProfile');
            if (profileMenu && profileMenu.style.display === 'block') {
                if (userProfileContainer && !userProfileContainer.contains(event.target)) {
                    profileMenu.style.display = 'none';
                }
            }

            // 2. Haupt-Suche
            const mainSearchBox = document.getElementById('tourSearchBox');
            const mainSearchResults = document.getElementById('searchResults');
            if (mainSearchResults && mainSearchResults.style.display === 'block') {
                if (mainSearchBox && !mainSearchBox.contains(event.target)) {
                    mainSearchResults.style.display = 'none';
                }
            }

            // 3. Modal-Suche
            const modalSearchContainer = document.getElementById('modalSearchContainer');
            const modalSearchResults = document.getElementById('modalSearchResults');
            if (modalSearchResults && modalSearchResults.style.display === 'block') {
                if (modalSearchContainer && !modalSearchContainer.contains(event.target)) {
                    modalSearchResults.style.display = 'none';
                }
            }
        });

        // --- HILFSFUNKTION: SUCHE LEEREN ---
        window.clearSearchField = function (inputId, resultId, btnId) {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
                input.focus(); // Setzt den Cursor wieder ins Feld
            }
            const res = document.getElementById(resultId);
            if (res) res.style.display = 'none';
            const btn = document.getElementById(btnId);
            if (btn) btn.style.display = 'none';
        };

        // --- UMSCHALTEN DER ADMIN-REITER ---
        window.switchAdminProductTab = (tab) => {
            const btnStd = document.getElementById('adminTabStandard');
            const btnLam = document.getElementById('adminTabLamellen');
            const viewStd = document.getElementById('adminStandardView');
            const viewLam = document.getElementById('adminLamellenView');

            btnStd.classList.remove('active');
            btnLam.classList.remove('active');
            viewStd.style.display = 'none';
            viewLam.style.display = 'none';

            if (tab === 'standard') {
                btnStd.classList.add('active');
                viewStd.style.display = 'flex';
            } else {
                btnLam.classList.add('active');
                viewLam.style.display = 'flex';
                // Lade hier später die Tabelle (die Funktion bauen wir dann zusammen mit dem Import)
                document.getElementById('adminLamellenList').innerHTML = '<tr><td colspan="6" class="text-center" style="padding:30px;">Bereit für den Import der CSV.</td></tr>';
            }
        };

        function getRequiredSturzhoehe(beschlag, isAntrieb) {
            if (beschlag === 'N') return 210;
            if (beschlag === 'L' || beschlag === 'Z') return isAntrieb ? 115 : 100;
            return 0;
        }

        function findFittingNormgroesseWidthAndHeight(sizes, targetWidth, targetHeight, A, C1, C2, G, isAntrieb) {
            const possible = sizes
                .filter(t => {
                    if (t[1] > targetHeight || t[0] > targetWidth) return false;
                    if (G !== undefined && A !== undefined) {
                        let effG = window.getUsableDepthForHeight(t[1], A, C1, C2, G);
                        let reqG = isAntrieb ? (t[1] <= 2250 ? 3200 : (t[1] <= 2500 ? 3450 : 4125)) : (t[1] + 510);
                        if (effG < reqG) return false;
                    }
                    return true;
                })
                .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
            return possible.length > 0 ? possible[0] : null;
        }

        function createProposal(title, type, w, h) {
            const tormodellSelect = document.getElementById('aufmassTormodell');
            const tormodell = tormodellSelect ? tormodellSelect.value : "LPU";
            const modelSuffix = tormodell === "RenoMatic" ? "RenoMatic" : "LPU";
            const fullTitle = `${title} (${modelSuffix})`;
            return { title: fullTitle, type: type, size: w + " x " + h + " mm", w: w, h: h };
        }

        function isZBeschlagSonderMoeglichMaxMasse(breite, hoehe) {
            if (breite <= 3250 && hoehe <= 2600) return true;
            if (breite <= 3500 && hoehe <= 2375) return true;
            if (breite <= 4000 && hoehe <= 2250) return true;
            return false;
        }

        function findNormgroessePassendZuIdealerHoeheUndBlendrahmen(sizes, A, B, maxH, blend, G, isAntrieb, C1, C2, allowKlinkerBlende = false) {
            let abzugMin = blend === 95 ? 190 : 250;
            let abzugMax = blend === 95 ? 280 : 330;
            let maxBlende = blend === 95 ? 180 : 210;

            let minB = A - abzugMax;
            let maxB = A - abzugMin;
            if (minB <= 0 || maxB <= 0 || minB > maxB) return null;

            let passend = sizes.filter(t => {
                if (t[1] > maxH || (!allowKlinkerBlende && (B - t[1]) > maxBlende) || (B - t[1]) < 0 || t[0] < minB || t[0] > maxB) return false;
                if (G !== undefined && A !== undefined) {
                    let effG = window.getUsableDepthForHeight(t[1], A, C1, C2, G);
                    let reqG = isAntrieb ? (t[1] <= 2250 ? 3200 : (t[1] <= 2500 ? 3450 : 4125)) : (t[1] + 510);
                    if (effG < reqG) return false;
                }
                return true;
            });
            passend.sort((a, b) => b[1] - a[1] || b[0] - a[0]);
            return passend.length > 0 ? passend[0] : null;
        }

        function isKlinkerNormgroessePassend(tor, A, B, klinkerL, klinkerR, klinkerO) {
            if (!tor) return false;
            const visibleW = A - klinkerL - klinkerR;
            const visibleH = B - klinkerO;
            if (visibleW <= 0 || visibleH <= 0) return false;

            // Bei Klinker ist die Rahmenaußenbreite entscheidend. Ein Tor,
            // dessen Rahmenaußenmaß kleiner als die lichte Klinkeröffnung ist,
            // würde seitlich hinter dem Klinker stehen und wird nicht empfohlen.
            const frameOuterWidth = tor[0] + 180; // 90 mm Anschlag je Seite
            return frameOuterWidth >= visibleW && tor[1] <= visibleH + 10;
        }

        function findBestProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn, isKlinkerMontage = false, klinkerL = 0, klinkerR = 0, klinkerO = 0) {
            const tormodell = document.getElementById('aufmassTormodell') ? document.getElementById('aufmassTormodell').value : "LPU";
            const oberflaeche = document.getElementById('aufmassOberflaeche') ? document.getElementById('aufmassOberflaeche').value : "";
            const sicke = document.getElementById('aufmassSicke') ? document.getElementById('aufmassSicke').value : "";

            let sizesZ = tormodell === "RenoMatic" ? window.renoMaticSizesZ : window.standardSizesZ;
            let sizesNL = tormodell === "RenoMatic" ? window.renoMaticSizesNL : window.standardSizesNL;

            // Filter standard sizes by Oberfläche limits
            if (tormodell === "LPU") {
                let limitB = 6000;
                if (oberflaeche === "Duragrain" || oberflaeche === "Planar") {
                    limitB = 5000;
                } else if (oberflaeche === "Decograin") {
                    limitB = 5500;
                }
                sizesZ = sizesZ.filter(t => t[0] <= limitB);
                sizesNL = sizesNL.filter(t => t[0] <= limitB);
            }

            // --- SILKGRAIN LOGIK ZENTRAL (KORRIGIERT FÜR WEB) ---
            // D-Sicke ist technisch oft an Silkgrain gekoppelt
            const isSilkgrain = (oberflaeche === "Silkgrain" || sicke === "D");

            let distZ = [...new Set(sizesZ.map(t => t[1]))].sort((a, b) => b - a);
            let distNL = [...new Set(sizesNL.map(t => t[1]))].sort((a, b) => b - a);

            let best = null;
            let reqFrame = 90;
            let reqSturzN = 210;
            let sturzOptZL = isAntrieb ? 115 : 100;

            if (isMontageIn) {
                let abstandOben = isAntrieb ? 115 : 110;
                let maxH = B - abstandOben;
                maxH = window.getMaxAllowedHeightForG(maxH, A, C1, C2, G, isAntrieb) || 0;
                if (maxH >= 1900) {
                    if (isKlinkerMontage) {
                        const visibleW = A - klinkerL - klinkerR;
                        const visibleH = B - klinkerO;
                        if (visibleW <= 0 || visibleH < 1900) return null;
                    }

                    let tor95 = null, beschlag95 = null;
                    let checkZ95 = findNormgroessePassendZuIdealerHoeheUndBlendrahmen(sizesZ, A, B, maxH, 95, G, isAntrieb, C1, C2, isKlinkerMontage);

                    // Silkgrain-Check für Montage IN
                    if (checkZ95 && (!isSilkgrain || (checkZ95[0] <= 3000 && checkZ95[1] <= 2600))) {
                        tor95 = checkZ95; beschlag95 = "Z-Beschlag";
                    } else {
                        let checkL95 = findNormgroessePassendZuIdealerHoeheUndBlendrahmen(sizesNL, A, B, maxH, 95, G, isAntrieb, C1, C2, isKlinkerMontage);
                        if (checkL95) { tor95 = checkL95; beschlag95 = "L-Beschlag"; }
                    }

                    let tor125 = null, beschlag125 = null;
                    let checkZ125 = findNormgroessePassendZuIdealerHoeheUndBlendrahmen(sizesZ, A, B, maxH, 125, G, isAntrieb, C1, C2, isKlinkerMontage);

                    // Silkgrain-Check für Montage IN
                    if (checkZ125 && (!isSilkgrain || (checkZ125[0] <= 3000 && checkZ125[1] <= 2600))) {
                        tor125 = checkZ125; beschlag125 = "Z-Beschlag";
                    } else {
                        let checkL125 = findNormgroessePassendZuIdealerHoeheUndBlendrahmen(sizesNL, A, B, maxH, 125, G, isAntrieb, C1, C2, isKlinkerMontage);
                        if (checkL125) { tor125 = checkL125; beschlag125 = "L-Beschlag"; }
                    }

                    if (isKlinkerMontage) {
                        if (isKlinkerNormgroessePassend(tor95, A, B, klinkerL, klinkerR, klinkerO)) return createProposal("Normgröße", beschlag95, tor95[0], tor95[1]);
                        if (isKlinkerNormgroessePassend(tor125, A, B, klinkerL, klinkerR, klinkerO)) return createProposal("Normgröße", beschlag125, tor125[0], tor125[1]);
                        return null;
                    }

                    if (tor95) return createProposal("Normgröße - Blendrahmen 95mm", beschlag95, tor95[0], tor95[1]);
                    if (tor125) return createProposal("Normgröße - Blendrahmen 125mm", beschlag125, tor125[0], tor125[1]);
                }
                return null;
            } else {
                let bedarfZL = isAntrieb ? 115 : 100;
                let maxHGesamt = B + D - bedarfZL;
                let maxHDahinter = Math.min(B, maxHGesamt);
                maxHDahinter = window.getMaxAllowedHeightForG(maxHDahinter, A, C1, C2, G, isAntrieb) || 0;
                if (maxHDahinter < 1900) return null;

                let ueberL = Math.max(0, reqFrame - C1);
                let ueberR = Math.max(0, reqFrame - C2);
                let effTargetB = A - ueberL - ueberR;
                if (effTargetB <= 0) return null;

                let zHoehe = maxHDahinter;
                let zMoeglich = true;
                if (isAntrieb && D < sturzOptZL) {
                    if (D <= 109) {
                        let agg = distZ.find(h => h <= maxHDahinter);
                        if (agg) zHoehe = agg; else zMoeglich = false;
                    } else {
                        let mod = distZ.find(h => h < B && h <= maxHDahinter);
                        if (mod) zHoehe = mod;
                        else {
                            let fb = distZ.find(h => h <= maxHDahinter);
                            if (fb) zHoehe = fb; else zMoeglich = false;
                        }
                    }
                }

                if (zMoeglich && zHoehe >= 1900) {
                    let zTor = findFittingNormgroesseWidthAndHeight(sizesZ, effTargetB, zHoehe, A, C1, C2, G, isAntrieb);
                    if (zTor && (A - zTor[0] < 181)) {
                        // --- SILKGRAIN CHECK HIER ---
                        if (!isSilkgrain || (zTor[0] <= 3000 && zTor[1] <= 2600)) {
                            best = createProposal("Normgröße", "Z-Beschlag", zTor[0], zTor[1]);
                        }
                    }
                }

                let nMoeglich = false;
                if (C1 >= reqFrame && C2 >= reqFrame && D >= reqSturzN) {
                    nMoeglich = true;
                    let nHoehe = Math.min(B, maxHDahinter);
                    if (nHoehe >= 1900) {
                        let nTor = findFittingNormgroesseWidthAndHeight(sizesNL, A, nHoehe, A, C1, C2, G, isAntrieb);
                        if (nTor && (A - nTor[0] < 181)) {
                            if (!best || nTor[0] > best.w || (nTor[0] === best.w && nTor[1] > best.h)) {
                                best = createProposal("Normgröße", "N-Beschlag", nTor[0], nTor[1]);
                            }
                        }
                    }
                }

                let lVersuchen = D < reqSturzN || (!nMoeglich && best?.type === "Z-Beschlag") || (!best);
                if (lVersuchen) {
                    let lHoehe = maxHDahinter;
                    let lMoeglich = true;
                    if (isAntrieb && D < sturzOptZL) {
                        if (D <= 109) {
                            let agg = distNL.find(h => h <= maxHDahinter);
                            if (agg) lHoehe = agg; else lMoeglich = false;
                        } else {
                            let mod = distNL.find(h => h < B && h <= maxHDahinter);
                            if (mod) lHoehe = mod;
                            else {
                                let fb = distNL.find(h => h <= maxHDahinter);
                                if (fb) lHoehe = fb; else lMoeglich = false;
                            }
                        }
                    }
                    if (lMoeglich && lHoehe >= 1900) {
                        let lTor = findFittingNormgroesseWidthAndHeight(sizesNL, effTargetB, lHoehe, A, C1, C2, G, isAntrieb);
                        if (lTor && (A - lTor[0] < 181)) {
                            if (!best || lTor[0] > best.w || (lTor[0] === best.w && lTor[1] > best.h)) {
                                best = createProposal("Normgröße", "L-Beschlag", lTor[0], lTor[1]);
                            }
                        }
                    }
                }

                return best;
            }
        }

        function findAlternativeNormProposal(A, B, C1, C2, D, G, isAntrieb, existingBest) {
            if (existingBest && existingBest.w === A && existingBest.h === B) {
                return null;
            }

            const tormodell = document.getElementById('aufmassTormodell') ? document.getElementById('aufmassTormodell').value : "LPU";
            const oberflaeche = document.getElementById('aufmassOberflaeche') ? document.getElementById('aufmassOberflaeche').value : "";
            const sicke = document.getElementById('aufmassSicke') ? document.getElementById('aufmassSicke').value : "";

            let sizesZ = tormodell === "RenoMatic" ? window.renoMaticSizesZ : window.standardSizesZ;
            let sizesNL = tormodell === "RenoMatic" ? window.renoMaticSizesNL : window.standardSizesNL;

            // Filter standard sizes by Oberfläche limits
            if (tormodell === "LPU") {
                let limitB = 6000;
                if (oberflaeche === "Duragrain" || oberflaeche === "Planar") {
                    limitB = 5000;
                } else if (oberflaeche === "Decograin") {
                    limitB = 5500;
                }
                sizesZ = sizesZ.filter(t => t[0] <= limitB);
                sizesNL = sizesNL.filter(t => t[0] <= limitB);
            }

            let allSizes = [...sizesZ, ...sizesNL];
            let uniqueMap = new Map();
            allSizes.forEach(s => uniqueMap.set(s[0] + 'x' + s[1], s));
            let unique = Array.from(uniqueMap.values()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

            let bestAlt = null;
            const isSilkgrain = (oberflaeche === "Silkgrain" || sicke === "D");

            for (let cand of unique) {
                let cB = cand[0];
                let cH = cand[1];

                if (existingBest && existingBest.w === cB && existingBest.h === cH) continue;
                if (cB < A - 180 || cH < B - 90) continue;

                let reqC1 = cB > A ? Math.floor((cB - A) / 2) + 90 : 90;
                let reqC2 = cB > A ? (cB - A) - Math.floor((cB - A) / 2) + 90 : 90;

                if (C1 < reqC1 || C2 < reqC2) continue;

                let type = "";
                let isZ = sizesZ.some(t => t[0] === cB && t[1] === cH);
                let isNL = sizesNL.some(t => t[0] === cB && t[1] === cH);
                let maxG = B + D;

                if (isZ && maxG >= cH + getRequiredSturzhoehe('Z', isAntrieb)) {
                    // --- SILKGRAIN CHECK HIER ---
                    if (!isSilkgrain || (cB <= 3000 && cH <= 2600)) {
                        type = "Z-Beschlag";
                    }
                }

                // Wenn Z nicht ging (oder wegen Silkgrain abgelehnt wurde), versuche NL
                if (type === "" && isNL) {
                    if (D >= 210 && maxG >= cH + getRequiredSturzhoehe('N', isAntrieb)) {
                        type = "N-Beschlag";
                    } else if (maxG >= cH + getRequiredSturzhoehe('L', isAntrieb)) {
                        type = "L-Beschlag";
                    }
                }

                if (type !== "") {
                    // Check if the candidate height is compatible with the depth constraints
                    let effG = window.getUsableDepthForHeight(cH, A, C1, C2, G);
                    let reqG = isAntrieb ? (cH <= 2250 ? 3200 : (cH <= 2500 ? 3450 : 4125)) : (cH + 510);
                    if (effG < reqG) {
                        type = ""; // Reject this proposal because it doesn't fit G-wise
                    }
                }

                if (type !== "") {
                    let candProp = createProposal("Alternative Normgröße", type, cB, cH);
                    if (!bestAlt) bestAlt = candProp;
                    else {
                        let rC = type === "Z-Beschlag" ? 1 : (type === "N-Beschlag" ? 2 : 3);
                        let rB = bestAlt.type === "Z-Beschlag" ? 1 : (bestAlt.type === "N-Beschlag" ? 2 : 3);
                        let dBC = Math.abs(cB - A);
                        let dBB = Math.abs(bestAlt.w - A);

                        if (dBC < dBB) bestAlt = candProp;
                        else if (dBC === dBB) {
                            if (rC < rB) bestAlt = candProp;
                            else if (rC === rB && Math.abs(cH - B) < Math.abs(bestAlt.h - B)) bestAlt = candProp;
                        }
                    }
                }
            }
            return bestAlt;
        }

        function findSonderanfertigungProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn, isKlinkerMontage = false, klinkerL = 0, klinkerR = 0, klinkerO = 0) {
            const oberflaeche = document.getElementById('aufmassOberflaeche') ? document.getElementById('aufmassOberflaeche').value : "";
            const sicke = document.getElementById('aufmassSicke') ? document.getElementById('aufmassSicke').value : "";
            const isSilkgrain = (oberflaeche === "Silkgrain" || sicke === "D");

            let potB, potH;
            if (isMontageIn) {
                potH = B - (isAntrieb ? 115 : 110);
                potH = window.getMaxAllowedHeightForG(potH, A, C1, C2, G, isAntrieb) || 0;
                potB = A;
            } else {
                let ueberL = Math.max(0, 90 - C1);
                let ueberR = Math.max(0, 90 - C2);
                potB = A - ueberL - ueberR;
                potH = Math.min(B, B + D - getRequiredSturzhoehe('Z', isAntrieb));
                potH = window.getMaxAllowedHeightForG(potH, A, C1, C2, G, isAntrieb) || 0;
            }

            const tormodell = document.getElementById('aufmassTormodell') ? document.getElementById('aufmassTormodell').value : "LPU";

            function getFinal(b, h) {
                if (tormodell === "RenoMatic") {
                    // RenoMatic Sondermaßermittlung
                    if (b > 5500) return null;
                    let maxB = b;
                    let minB = 1875;
                    let minH = 1900;
                    
                    // Höhe ermitteln: wenn breite > 5000, dann maxH = 2375, sonst 3000
                    let limitH = maxB > 5000 ? 2375 : 3000;
                    let maxH = Math.min(h, limitH);
                    
                    return (maxB >= minB && maxH >= minH) ? [maxB, maxH] : null;
                } else {
                    // LPU (Standard) Sondermaßermittlung
                    let limitB = 5500; // Nach 5500 mm Breite ist kein Sondermaß in der Breite mehr möglich!
                    if (oberflaeche === "Duragrain" || oberflaeche === "Planar") {
                        limitB = 5000;
                    }
                    
                    if (b > limitB) {
                        return null; // Sondermaß-Breite über dem Limit ist nicht möglich
                    }
                    
                    let maxB = b;
                    let maxH = Math.min(h, 3000);
                    
                    let minB = maxH <= 1899 ? 1750 : 1200;
                    let minH = 1800;
                    return (maxB >= minB && maxH >= minH) ? [maxB, maxH] : null;
                }
            }

            if (isMontageIn) {
                if (isKlinkerMontage) {
                    const targetW = Math.min(
                        A - 180,
                        A - klinkerL - klinkerR,
                        A - (2 * klinkerL),
                        A - (2 * klinkerR)
                    );
                    const targetH = Math.min(potH, B - klinkerO);
                    let finalS = getFinal(targetW, targetH);
                    if (!finalS) return null;

                    let type = "Z-Beschlag";
                    if (finalS[0] > 4000) type = "L-Beschlag";
                    if (type === "Z-Beschlag" && isSilkgrain && (finalS[0] > 3000 || finalS[1] > 2600)) {
                        type = "L-Beschlag";
                    }
                    return createProposal("Sondermaß", type, finalS[0], finalS[1]);
                }

                for (let bl of [95, 125]) {
                    let finalS = getFinal(A - (bl * 2), potH);
                    if (finalS) {
                        let type = "Z-Beschlag";
                        if (finalS[0] > 4000) type = "L-Beschlag";
                        // --- SILKGRAIN CHECK HIER ---
                        if (type === "Z-Beschlag" && isSilkgrain && (finalS[0] > 3000 || finalS[1] > 2600)) {
                            type = "L-Beschlag"; // Fallback auf L, da Z nicht erlaubt
                        }
                        return createProposal(isKlinkerMontage ? "Sondermaß" : "Sondermaß - Blendrahmen " + bl + "mm", type, finalS[0], finalS[1]);
                    }
                }
                return null;
            } else {
                let finalS = getFinal(potB, potH);
                if (!finalS) return null;
                let sB = finalS[0];
                let sH = finalS[1];
                let type = null;
                let reqN = getRequiredSturzhoehe('N', isAntrieb);
                let reqZL = getRequiredSturzhoehe('Z', isAntrieb);
                let ges = B + D;

                if (C1 >= 90 && C2 >= 90 && ges >= sH + reqN) {
                    type = "N-Beschlag";
                } else if (ges >= sH + reqZL) {
                    if (isZBeschlagSonderMoeglichMaxMasse(sB, sH)) {
                        // --- SILKGRAIN CHECK HIER ---
                        if (!isSilkgrain || (sB <= 3000 && sH <= 2600)) {
                            type = "Z-Beschlag";
                        } else {
                            type = "L-Beschlag"; // Silkgrain Fallback
                        }
                    } else {
                        type = "L-Beschlag";
                    }
                }

                if (type) return createProposal("Sondermaß", type, sB, sH);
            }
        }

        window.findBestProposal = findBestProposal;
        window.findAlternativeNormProposal = findAlternativeNormProposal;
        window.findSonderanfertigungProposal = findSonderanfertigungProposal;

        // --- ANFANG STÖRUNGS- & HINDERNIS-LOGIK ---
        try {
            const savedObs = localStorage.getItem('aufmassObstacles');
            window.aufmassObstacles = savedObs ? JSON.parse(savedObs) : [];
        } catch (e) {
            window.aufmassObstacles = [];
        }

        window.saveObstaclesToStorage = () => {
            try {
                localStorage.setItem('aufmassObstacles', JSON.stringify(window.aufmassObstacles));
            } catch (e) {
                console.error("Fehler beim Speichern der Hindernisse:", e);
            }
        };

        window.getObstacleAABB = (obs, A, C1, C2, G) => {
            const leftWall = A/2 + C1; // Left wall is at positive X in inside view
            const frontZ = G/2 - 150; // Raumwand innen bei G/2 - 150 mm
            
            let xMin, xMax, yMin, yMax, zMin, zMax;
            
            let w = 0;
            if (obs.type === 'rohr') {
                const dia = parseInt(obs.diameter) || 70;
                const len = parseInt(obs.length) || 1000;
                const dir = obs.direction || 'vertical';
                w = (dir === 'horizontalX') ? len : dia;
            } else {
                w = parseInt(obs.w) || 150;
            }
            
            // AbstandLinks measures from leftWall (positive X) in the negative X direction
            xMax = leftWall - (parseInt(obs.abstandLinks) || 0);
            xMin = xMax - w;
            
            if (obs.type === 'rohr') {
                const dia = parseInt(obs.diameter) || 70;
                const len = parseInt(obs.length) || 1000;
                const dir = obs.direction || 'vertical';
                
                if (dir === 'vertical') {
                    yMin = parseInt(obs.abstandBoden) || 0;
                    yMax = yMin + len;
                    zMax = frontZ - (parseInt(obs.abstandTor) || 0);
                    zMin = zMax - dia;
                } else if (dir === 'horizontalX') {
                    yMin = parseInt(obs.abstandBoden) || 0;
                    yMax = yMin + dia;
                    zMax = frontZ - (parseInt(obs.abstandTor) || 0);
                    zMin = zMax - dia;
                } else { // horizontalZ
                    yMin = parseInt(obs.abstandBoden) || 0;
                    yMax = yMin + dia;
                    zMax = frontZ - (parseInt(obs.abstandTor) || 0);
                    zMin = zMax - len;
                }
            } else { // unterzug or sonderteil
                const h = parseInt(obs.h) || 150;
                const d = parseInt(obs.d) || 150;
                
                yMin = parseInt(obs.abstandBoden) || 0;
                yMax = yMin + h;
                zMax = frontZ - (parseInt(obs.abstandTor) || 0);
                zMin = zMax - d;
            }
            
            return { xMin, xMax, yMin, yMax, zMin, zMax };
        };

        window.getUsableDepthForHeight = (h, A, C1, C2, G) => {
            let effG = G;
            if (!window.aufmassObstacles || window.aufmassObstacles.length === 0) return effG;
            
            const frontZ = G/2 - 150;
            
            window.aufmassObstacles.forEach(obs => {
                const box = window.getObstacleAABB(obs, A, C1, C2, G);
                
                const intersectsLeftTrack = (box.xMin < A/2 + 50 && box.xMax > A/2 - 100);
                const intersectsRightTrack = (box.xMin < -A/2 + 100 && box.xMax > -A/2 - 50);
                const intersectsTrackHeight = (box.yMin < h + 150 && box.yMax > h - 50);
                
                if ((intersectsLeftTrack || intersectsRightTrack) && intersectsTrackHeight && box.zMin < frontZ) {
                    const freeDepth = frontZ - box.zMax;
                    if (freeDepth < effG) {
                        effG = Math.max(0, Math.floor(freeDepth));
                    }
                }
            });
            return effG;
        };

        window.getMaxAllowedHeightForG = (targetHeight, A, C1, C2, G, isAntrieb) => {
            for (let h = targetHeight; h >= 1800; h -= 5) {
                let effG = window.getUsableDepthForHeight(h, A, C1, C2, G);
                let reqG = isAntrieb ? (h <= 2250 ? 3200 : (h <= 2500 ? 3450 : 4125)) : (h + 510);
                if (effG >= reqG) {
                    return h;
                }
            }
            return null;
        };

        window.applyObstacleDeductions = (A, B, C1, C2, D, G) => {
            let effB = B;
            let effC1 = C1;
            let effC2 = C2;
            let effD = D;
            let effG = G;
            
            const explanations = [];
            const affectedZones = { B: false, C1: false, C2: false, D: false, G: false };
            
            const frontZ = G/2 - 150;
            
            if (!window.aufmassObstacles || window.aufmassObstacles.length === 0) {
                return { B: effB, C1: effC1, C2: effC2, D: effD, G: effG, explanations, affectedZones };
            }
            
            window.aufmassObstacles.forEach(obs => {
                const box = window.getObstacleAABB(obs, A, C1, C2, G);
                
                // 1. ZONENPRÜFUNG LINKS (C1)
                // Left reveal is from A/2 to A/2 + C1
                if (box.xMin < A/2 + C1 && box.xMax > A/2 &&
                    box.yMin < B && box.yMax > 0 &&
                    box.zMin < frontZ && box.zMax > frontZ - 200) {
                    
                    const freeC1 = box.xMin - A/2;
                    if (freeC1 < 0 || box.xMin < A/2) {
                        explanations.push(`⚠️ Das Hindernis "${obs.name}" ist größer als der Anschlag links. In diesem Fall kann noch kein Tor richtig berechnet werden, da Zubehör benötigt wird.`);
                    }
                    if (freeC1 < effC1) {
                        const original = effC1;
                        effC1 = Math.max(0, Math.floor(freeC1));
                        affectedZones.C1 = true;
                        if (freeC1 >= 0) {
                            explanations.push(`Das Hindernis "${obs.name}" ragt in den linken Anschlag und reduziert das nutzbare Maß C1 von ${original} mm auf ${effC1} mm.`);
                        }
                    }
                }
                
                // 2. ZONENPRÜFUNG RECHTS (C2)
                // Right reveal is from -A/2 - C2 to -A/2
                if (box.xMin < -A/2 && box.xMax > -A/2 - C2 &&
                    box.yMin < B && box.yMax > 0 &&
                    box.zMin < frontZ && box.zMax > frontZ - 200) {
                    
                    const freeC2 = -A/2 - box.xMax;
                    if (freeC2 < 0 || box.xMax > -A/2) {
                        explanations.push(`⚠️ Das Hindernis "${obs.name}" ist größer als der Anschlag rechts. In diesem Fall kann noch kein Tor richtig berechnet werden, da Zubehör benötigt wird.`);
                    }
                    if (freeC2 < effC2) {
                        const original = effC2;
                        effC2 = Math.max(0, Math.floor(freeC2));
                        affectedZones.C2 = true;
                        if (freeC2 >= 0) {
                            explanations.push(`Das Hindernis "${obs.name}" ragt in den rechten Anschlag und reduziert das nutzbare Maß C2 von ${original} mm auf ${effC2} mm.`);
                        }
                    }
                }
                
                // 3. ZONENPRÜFUNG STURZ (D) & TORÖFFNUNG (B)
                if (box.xMin < A/2 && box.xMax > -A/2 &&
                    box.yMin < B + D && box.yMax > 0 &&
                    box.zMin < frontZ && box.zMax > frontZ - 200) {
                    
                    if (box.yMin >= B) {
                        // Blocks only the Sturz D area
                        const freeD = box.yMin - B;
                        if (freeD < effD) {
                            const original = effD;
                            effD = Math.max(0, Math.floor(freeD));
                            affectedZones.D = true;
                            explanations.push(`Das Hindernis "${obs.name}" blockiert den Sturz und reduziert die nutzbare Sturzhöhe D von ${original} mm auf ${effD} mm.`);
                        }
                    } else {
                        // Blocks the Sturz D area completely AND goes below B (into the door opening!)
                        if (effD > 0) {
                            effD = 0;
                            affectedZones.D = true;
                            explanations.push(`Das Hindernis "${obs.name}" blockiert den Sturz komplett (D = 0 mm).`);
                        }
                        
                        const freeB = box.yMin;
                        if (freeB < effB) {
                            const original = effB;
                            effB = Math.max(0, Math.floor(freeB));
                            affectedZones.B = true;
                            explanations.push(`Das Hindernis "${obs.name}" ragt in die Toröffnung und reduziert die nutzbare Durchgangshöhe B von ${original} mm auf ${effB} mm.`);
                        }
                    }
                }
                
                // 4. ZONENPRÜFUNG LAUFSCHIENEN / TIEFE (G)
                const intersectsLeftTrack = (box.xMin < A/2 + 50 && box.xMax > A/2 - 100);
                const intersectsRightTrack = (box.xMin < -A/2 + 100 && box.xMax > -A/2 - 50);
                const intersectsTrackHeight = (box.yMin < B + 150 && box.yMax > B - 50);
                
                if ((intersectsLeftTrack || intersectsRightTrack) && intersectsTrackHeight && box.zMin < frontZ) {
                    const freeDepth = frontZ - box.zMax;
                    if (freeDepth < effG) {
                        const original = effG;
                        effG = Math.max(0, Math.floor(freeDepth));
                        affectedZones.G = true;
                        explanations.push(`Das Hindernis "${obs.name}" blockiert den Schienenverlauf an der Decke und reduziert die nutzbare Tiefe G von ${original} mm auf ${effG} mm.`);
                    }
                }
            });
            
            return { C1: effC1, C2: effC2, D: effD, G: effG, explanations, affectedZones };
        };
        // --- ENDE STÖRUNGS- & HINDERNIS-LOGIK ---

        window.calculateAufmass = () => {
            let A = parseInt(document.getElementById('aufmassA').value) || 0;
            let B = parseInt(document.getElementById('aufmassB').value) || 0;
            let C1 = parseInt(document.getElementById('aufmassC1').value) || 0;
            let C2 = parseInt(document.getElementById('aufmassC2').value) || 0;
            let D = parseInt(document.getElementById('aufmassD').value) || 0;
            let G = parseInt(document.getElementById('aufmassG').value) || 0;
            let originalG = G;

            let E1 = parseInt(document.getElementById('aufmassE1').value) || 0;
            let E2 = parseInt(document.getElementById('aufmassE2').value) || 0;
            let F1 = parseInt(document.getElementById('aufmassF1').value) || 0;
            let F2 = parseInt(document.getElementById('aufmassF2').value) || 0;

            let montageValue = document.getElementById('aufmassMontage').value;
            let isMontageIn = montageValue === 'in' || montageValue === 'in_klinker';
            let isKlinkerMontage = montageValue === 'in_klinker';
            let isAntrieb = document.getElementById('aufmassBedienung').value === 'antrieb';
            let klinkerL = isKlinkerMontage ? Math.max(20, parseInt(document.getElementById('aufmassKlinkerL')?.value) || 0) : 0;
            let klinkerR = isKlinkerMontage ? Math.max(20, parseInt(document.getElementById('aufmassKlinkerR')?.value) || 0) : 0;
            let klinkerO = isKlinkerMontage ? (parseInt(document.getElementById('aufmassKlinkerO')?.value) || 0) : 0;

            let resContainer = document.getElementById('aufmassResultContainer');

            if (A === 0 || B === 0) {
                resContainer.innerHTML = '<p style="color:var(--error-red); font-weight:bold;">Bitte mindestens Lichte Breite (A) und Lichte Höhe (B) ausfüllen.</p>';
                return;
            }

            const userA = A;
            const userB = B;
            const userC1 = C1;
            const userC2 = C2;
            const userD = D;
            const userG = G;

            // Hindernis-Reduzierungen anwenden
            const deductions = window.applyObstacleDeductions(A, B, C1, C2, D, G);
            C1 = deductions.C1;
            C2 = deductions.C2;
            D = deductions.D;
            if (deductions.B !== undefined) B = deductions.B;
            // We do NOT overwrite G with deductions.G so that the search can explore heights dynamically using originalG!
            window.lastObstacleDeductions = deductions.explanations;
            window.lastObstacleAffectedZones = deductions.affectedZones;

            let origD = D, origC1 = C1, origC2 = C2;
            let alertMessages = [];
            let roomAlertMessages = [];
            if (window.lastObstacleDeductions && window.lastObstacleDeductions.length > 0) {
                alertMessages = alertMessages.concat(window.lastObstacleDeductions);
            }

            let minF = Math.min(F1 || Infinity, F2 || Infinity);
            if (minF !== Infinity && minF < (B + origD)) {
                let diff = (B + origD) - minF;
                D = Math.max(0, origD - diff);
                roomAlertMessages.push(`Die lichte Raumhöhe (${minF} mm) ist geringer als die benötigte Gesamthöhe vorne (${B + origD} mm). Die nutzbare Sturzhöhe (D) wurde intern von ${origD} mm auf ${D} mm reduziert.`);
            }

            let minE = Math.min(E1 || Infinity, E2 || Infinity);
            let frontTotalWidth = A + origC1 + origC2;

            if (minE !== Infinity && minE < frontTotalWidth) {
                if (minE >= A) {
                    let diff = frontTotalWidth - minE;
                    C1 = Math.max(0, origC1 - Math.floor(diff / 2));
                    C2 = Math.max(0, origC2 - Math.ceil(diff / 2));
                    roomAlertMessages.push(`Die Raumbreite (${minE} mm) ist geringer als die benötigte Gesamtbreite vorne (${frontTotalWidth} mm). Die seitlichen Anschläge wurden intern reduziert.`);
                } else {
                    C1 = 0;
                    C2 = 0;
                    roomAlertMessages.push(`Die Raumbreite (${minE} mm) ist sogar geringer als die Torbreite A (${A} mm). Einbau nicht möglich! Anschläge auf 0 gesetzt.`);
                }
            }
            alertMessages = alertMessages.concat(roomAlertMessages);
            window.lastRoomAlertMessages = roomAlertMessages;

            // Check for logic errors (LOGIK-FEHLER)
            let hasLogicError = false;
            if (F1 > 0 && F1 < B) {
                hasLogicError = true;
            }
            const rawF2Val = document.getElementById('aufmassF2') ? document.getElementById('aufmassF2').value.trim() : "";
            if (rawF2Val !== "") {
                const valF2 = parseFloat(rawF2Val) || 0;
                if (valF2 > 0 && valF2 < B) hasLogicError = true;
            }
            if (E1 > 0 && E1 < A) {
                hasLogicError = true;
            }
            const rawE2Val = document.getElementById('aufmassE2') ? document.getElementById('aufmassE2').value.trim() : "";
            if (rawE2Val !== "") {
                const valE2 = parseFloat(rawE2Val) || 0;
                if (valE2 > 0 && valE2 < A) hasLogicError = true;
            }

            // Flagge, ob Raumkompensation vorerst gesetzt ist (wird unten verfeinert)
            window.roomKompensationIsActive = roomAlertMessages.length > 0;

            let proposals = [];

            if (!hasLogicError) {
                let best = findBestProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (best) proposals.push(best);

                if (!isMontageIn) {
                    let alt = findAlternativeNormProposal(A, B, C1, C2, D, G, isAntrieb, best);
                    if (alt) proposals.push(alt);
                }

                let sonder = findSonderanfertigungProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (sonder) {
                    if (!proposals.find(p => p.w === sonder.w && p.h === sonder.h && p.type === sonder.type)) {
                        proposals.push(sonder);
                    }
                }
            }

            // Reines Roh-Ergebnis (ohne jegliche Kompensationen/Deductions durch Raumgrenzen ODER Hindernisse)
            let pureRawProposals = [];
            const originalObstacles = window.aufmassObstacles;
            window.aufmassObstacles = [];

            if (!hasLogicError) {
                let pureBest = findBestProposal(userA, userB, userC1, userC2, userD, originalG, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (pureBest) pureRawProposals.push(pureBest);
                if (!isMontageIn) {
                    let pureAlt = findAlternativeNormProposal(userA, userB, userC1, userC2, userD, originalG, isAntrieb, pureBest);
                    if (pureAlt) pureRawProposals.push(pureAlt);
                }
                let pureSonder = findSonderanfertigungProposal(userA, userB, userC1, userC2, userD, originalG, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (pureSonder) {
                    if (!pureRawProposals.find(p => p.w === pureSonder.w && p.h === pureSonder.h && p.type === pureSonder.type)) {
                        pureRawProposals.push(pureSonder);
                    }
                }
            }

            // Roh-Suche ohne Hindernis-Kompensationen durchführen zum Relevanz-Vergleich
            let rawProposals = [];
            if (!hasLogicError) {
                let tempC1 = userC1, tempC2 = userC2, tempD = userD;
                let minF_temp = Math.min(F1 || Infinity, F2 || Infinity);
                if (minF_temp !== Infinity && minF_temp < (userB + tempD)) {
                    let diff = (userB + tempD) - minF_temp;
                    tempD = Math.max(0, tempD - diff);
                }
                let minE_temp = Math.min(E1 || Infinity, E2 || Infinity);
                let frontTotalWidth_temp = userA + tempC1 + tempC2;
                if (minE_temp !== Infinity && minE_temp < frontTotalWidth_temp) {
                    if (minE_temp >= userA) {
                        let diff = frontTotalWidth_temp - minE_temp;
                        tempC1 = Math.max(0, tempC1 - Math.floor(diff / 2));
                        tempC2 = Math.max(0, tempC2 - Math.ceil(diff / 2));
                    } else {
                        tempC1 = 0; tempC2 = 0;
                    }
                }

                let rawBest = findBestProposal(userA, userB, tempC1, tempC2, tempD, userG, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (rawBest) rawProposals.push(rawBest);
                if (!isMontageIn) {
                    let rawAlt = findAlternativeNormProposal(userA, userB, tempC1, tempC2, tempD, userG, isAntrieb, rawBest);
                    if (rawAlt) rawProposals.push(rawAlt);
                }
                let rawSonder = findSonderanfertigungProposal(userA, userB, tempC1, tempC2, tempD, userG, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (rawSonder) {
                    if (!rawProposals.find(p => p.w === rawSonder.w && p.h === rawSonder.h && p.type === rawSonder.type)) {
                        rawProposals.push(rawSonder);
                    }
                }
            }

            window.aufmassObstacles = originalObstacles;

            const getProposalGap = (proposal, refB = B) => {
                if (!proposal) return 0;
                return isKlinkerMontage ? (Math.min(refB - 100, refB - klinkerO) - proposal.h) : (refB - (proposal.h + 100));
            };

            // 1. Relevanz der Hindernis-Deductions bestimmen (Vergleich: proposals mit rawProposals)
            let isDeductionRelevant = false;
            window.bestProposalHeightBeforeDeductions = null;
            if (proposals.length !== rawProposals.length) {
                isDeductionRelevant = true;
            } else if (proposals.length > 0 && rawProposals.length > 0) {
                const p1 = proposals[0];
                const r1 = rawProposals[0];
                if (p1.w !== r1.w || p1.h !== r1.h || p1.type !== r1.type) {
                    isDeductionRelevant = true;
                }
                let gapP = getProposalGap(p1);
                let gapR = getProposalGap(r1);
                if ((gapP > 0) !== (gapR > 0)) {
                    isDeductionRelevant = true;
                }
            }

            if (proposals.length > 0 && rawProposals.length > 0) {
                const p1 = proposals[0];
                const r1 = rawProposals[0];
                if (p1.h < r1.h) {
                    window.bestProposalHeightBeforeDeductions = r1.h;
                    const heightReductionText = `Aufgrund von Hindernissen an der Decke (Laufschienen blockiert) wurde die ermittelte Torhöhe von ${r1.h} mm auf ${p1.h} mm reduziert, damit das Tor (inkl. Antrieb) noch montiert werden kann.`;
                    if (window.lastObstacleDeductions) {
                        window.lastObstacleDeductions.push(heightReductionText);
                    }
                    if (!alertMessages.includes(heightReductionText)) {
                        alertMessages.push(heightReductionText);
                    }
                }
            } else if (proposals.length === 0 && rawProposals.length > 0) {
                isDeductionRelevant = true;
                const trackBlockText = `Aufgrund der Deckenhindernisse ist selbst für das niedrigste Tor nicht genügend Tiefe für die Laufschienen/Antrieb vorhanden.`;
                if (window.lastObstacleDeductions) {
                    window.lastObstacleDeductions.push(trackBlockText);
                }
                if (!alertMessages.includes(trackBlockText)) {
                    alertMessages.push(trackBlockText);
                }
            }

            if (proposals.length > 0) {
                const selectedProp = proposals[0];
                const sH = selectedProp.h;
                let neededG = isAntrieb ? (sH <= 2250 ? 3200 : (sH <= 2500 ? 3450 : 4125)) : (sH + 510);
                if (deductions.G < originalG && deductions.G < neededG && originalG >= neededG) {
                    isDeductionRelevant = true;
                }
            }
            window.obstacleDeductionIsRelevant = isDeductionRelevant;

            // 2. Relevanz der Raumkompensation bestimmen (Vergleich: rawProposals mit pureRawProposals)
            let isRoomKompensationRelevant = false;
            if (rawProposals.length !== pureRawProposals.length) {
                isRoomKompensationRelevant = true;
            } else if (rawProposals.length > 0 && pureRawProposals.length > 0) {
                const r1 = rawProposals[0];
                const pr1 = pureRawProposals[0];
                if (r1.w !== pr1.w || r1.h !== pr1.h || r1.type !== pr1.type) {
                    isRoomKompensationRelevant = true;
                }
                let gapR = getProposalGap(r1);
                let gapPR = getProposalGap(pr1);
                if ((gapR > 0) !== (gapPR > 0)) {
                    isRoomKompensationRelevant = true;
                }
            }
            window.roomKompensationIsActive = isRoomKompensationRelevant;

            // Hintergrund-Prüfung: Wenn RenoMatic gewählt, aber kein Vorschlag ermittelt,
            // prüfen wir, ob LPU ein Ergebnis geliefert hätte.
            const tormodellSelect = document.getElementById('aufmassTormodell');
            const isRenoMatic = tormodellSelect && tormodellSelect.value === 'RenoMatic';
            window.lpuAlternativePossible = false;

            if (isRenoMatic && proposals.length === 0 && !hasLogicError) {
                // Temporär auf LPU schalten
                tormodellSelect.value = 'LPU';
                
                let lpuProposals = [];
                let lpuBest = findBestProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (lpuBest) lpuProposals.push(lpuBest);
                
                if (!isMontageIn) {
                    let lpuAlt = findAlternativeNormProposal(A, B, C1, C2, D, G, isAntrieb, lpuBest);
                    if (lpuAlt) lpuProposals.push(lpuAlt);
                }
                
                let lpuSonder = findSonderanfertigungProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn, isKlinkerMontage, klinkerL, klinkerR, klinkerO);
                if (lpuSonder) {
                    if (!lpuProposals.find(p => p.w === lpuSonder.w && p.h === lpuSonder.h && p.type === lpuSonder.type)) {
                        lpuProposals.push(lpuSonder);
                    }
                }
                
                // Wieder zurück auf RenoMatic
                tormodellSelect.value = 'RenoMatic';
                
                if (lpuProposals.length > 0) {
                    window.lpuAlternativePossible = true;
                }
            }

            // --- KORRIGIERTE STURZBLENDEN & PU-BLENDEN LOGIK ---
            if (!isMontageIn || isKlinkerMontage) {
                proposals.forEach(p => {
                    let gap = isKlinkerMontage
                        ? ((B - klinkerO) - (p.h + 100))
                        : (B - (p.h + 100));
                    p.fascia = null;
                    p.isPU = false;

                    if (gap > 0) {
                        const standardFascias = [95, 125, 150, 173];
                        let maxAllowed = gap + 100;
                        let bestFascia = null;

                        // 1. Standard-Blenden prüfen
                        const fasciaOrder = isKlinkerMontage ? [...standardFascias].reverse() : standardFascias;
                        for (let i = fasciaOrder.length - 1; i >= 0; i--) {
                            // Gesamtdeckung inklusive Standardrahmen, nicht nur die offene Luecke.
                            if (isKlinkerMontage && maxAllowed > (fasciaOrder[i] === 95 ? 180 : 210)) continue;
                            if (fasciaOrder[i] >= gap && fasciaOrder[i] <= maxAllowed) {
                                bestFascia = fasciaOrder[i];
                                break;
                            }
                        }

                        // 2. PU-Blende prüfen (Maximalmaß = individuelle Rasterhöhe)
                        if (!bestFascia) {
                            // Sektionsanzahl präzise nach Torhöhe bestimmen
                            let numSections;
                            if (p.h <= 2250) {
                                numSections = 4; // z.B. 2000 -> 500, 2125 -> 531, 2250 -> 563
                            } else if (p.h <= 2875) {
                                numSections = 5; // z.B. 2500 -> 500, 2750 -> 550
                            } else if (p.h <= 3500) {
                                numSections = 6; // z.B. 3000 -> 500
                            } else {
                                // Fallback für Sondergrößen über 3500 mm
                                numSections = Math.ceil(p.h / 563);
                            }

                            let maxPUHeight = p.h / numSections;
                            let requiredPUHeight = gap + 100;

                            if (requiredPUHeight <= maxPUHeight) {
                                bestFascia = requiredPUHeight;
                                p.isPU = true;
                            }
                        }

                        // Zuweisung
                        if (bestFascia) {
                            p.fascia = bestFascia;
                            if (p.isPU) {
                                p.type += ` + PU-Blende (Sonderhöhe ${Math.round(bestFascia)}mm)`;
                            } else {
                                p.type += ` + ${bestFascia}mm Sturzblende`;
                            }
                        }
                    }
                });

                // Tor ohne Blende verwerfen, wenn eine Blende benötigt wird (kein Loch zulassen)
                proposals = proposals.filter(p => {
                    let gap = isKlinkerMontage
                        ? ((B - klinkerO) - (p.h + 100))
                        : (B - (p.h + 100));
                    if (gap > 0 && !p.fascia) {
                        return false;
                    }
                    return true;
                });
            }

            calculatedProposals = proposals.map((p, idx) => ({
                id: 'prop_' + idx,
                title: p.title,
                w: p.w,
                h: p.h,
                type: p.type,
                fascia: p.fascia, // GANZ WICHTIG: Blende an das 3D-Modell übergeben
                isPU: p.isPU      // <--- HIER FEHLTE DIESE ZEILE!!!
            }));

            if (!selectedProposalId || !calculatedProposals.find(p => p.id === selectedProposalId)) {
                selectedProposalId = calculatedProposals.length > 0 ? calculatedProposals[0].id : null;
            }

            // --- RÜCKKEHR ZUR INTERAKTIVEN ANSICHT & DYNAMISCHE TIEFENWARNUNG ---
            window.lastWarnG = "";
            window.largeOverlapWarning = "";
            if (!hasLogicError) {
                let selectedProp = calculatedProposals.find(p => p.id === selectedProposalId);
                if (selectedProp) {
                    let sH = selectedProp.h;
                    let usableG = window.getUsableDepthForHeight(sH, A, C1, C2, originalG);
                    
                    if (usableG >= originalG && window.lastObstacleAffectedZones) {
                        window.lastObstacleAffectedZones.G = false;
                    }

                    let neededG = isAntrieb ? (sH <= 2250 ? 3200 : (sH <= 2500 ? 3450 : 4125)) : (sH + 510);
                    if (usableG < neededG) {
                        window.lastWarnG = `<div style="background:#ffebee; color:#c0392b; padding:10px; border-left:4px solid #c0392b; margin-bottom:15px; font-size:0.85rem; border-radius:4px;">
                <strong>⚠️ Garagentiefe (G) kritisch:</strong> Für das empfohlene Tormaß (${selectedProp.w} x ${selectedProp.h} mm) stehen durch Hindernisse nur ${usableG} mm Tiefe zur Verfügung. Benötigt werden mind. ${neededG} mm für die Antriebsschiene.
                </div>`;
                    }

                    // --- NEU: Großer Überstand bei breiten Toren (> 4500 mm und Überstand >= 30 mm je Seite) ---
                    let overlap = (selectedProp.w - A) / 2;
                    if (selectedProp.w > 4500 && overlap >= 30) {
                        window.largeOverlapWarning = `<div style="background: rgba(243, 156, 18, 0.08); border: 1px solid rgba(243, 156, 18, 0.4); color: #d35400; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 0.88rem; box-shadow: 0 4px 10px rgba(0,0,0,0.02); text-align: left; line-height: 1.45;">
            <div style="display: flex; align-items: center; gap: 8px; color: #d35400; font-weight: bold; margin-bottom: 4px;">
                <span>💡 Technischer Hinweis (großes Überstandsmaß)</span>
            </div>
            <span style="color: #334155;">Der Überstand des Tores hinter der Öffnung beträgt <b>${Math.round(overlap)} mm</b> je Seite bei einer Torbreite von <b>${selectedProp.w} mm</b>. Bitte beachten Sie:
            <ul style="margin: 6px 0 0 16px; padding: 0; color: #475569;">
                <li>Der Gleitbereich muss permanent sauber gehalten werden.</li>
                <li>Die Dichtung muss ggf. irgendwann erneuert werden (Wechsel durch den großen Überstand erschwert).</li>
                <li>Es bestehen thermische Bedenken (Bi-Metall-Effekt bei sommerlicher/winterlicher Durchbiegung der Lamelle gegen das Mauerwerk).</li>
            </ul>
            </span>
        </div>`;
                    }
                } else {
                    // Falls kein passendes Tor ermittelt wurde, prüfen wir basierend auf B
                    let usableG = window.getUsableDepthForHeight(B, A, C1, C2, originalG);
                    let neededG = isAntrieb ? (B <= 2250 ? 3200 : (B <= 2500 ? 3450 : 4125)) : (B + 510);
                    if (usableG < neededG) {
                        window.lastWarnG = `<div style="background:#ffebee; color:#c0392b; padding:10px; border-left:4px solid #c0392b; margin-bottom:15px; font-size:0.85rem; border-radius:4px;">
                <strong>⚠️ Garagentiefe (G) kritisch:</strong> Gemessen ${usableG} mm. Benötigt werden mind. ${neededG} mm für die Antriebsschiene.
                </div>`;
                    }
                }
            }

            window.lastAlertMessages = alertMessages;

            if (typeof renderProposals === 'function') {
                renderProposals();
            }


        };

        // --- NEWSLETTER LOGIK ---

    // 1. Opt-out Einstellung des Nutzers speichern
    window.toggleNewsletterPref = async (isChecked) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateDoc(doc(db, "users", user.uid), {
                newsletterOptIn: isChecked
            });
        } catch (e) {
            console.error("Fehler beim Speichern der Newsletter-Präferenz:", e);
        }
    };

    // --- NEWSLETTER HUB VARIABLES ---
    let nlActiveDraftAttachmentUrl = null;
    let nlActiveDraftAttachmentName = null;

    // 2. Admin Modal öffnen
    window.openNewsletterManager = async () => {
        const menu = document.getElementById('profileMenu');
        if (menu) menu.style.display = 'none';
        
        window.resetNlForm();
        document.getElementById('adminNewsletterModal').style.display = 'flex';
        
        // Initialisiere/Lade Archiv & Entwürfe im Hintergrund
        await window.loadNewsletterDraftsAndArchive();
        await window.loadNlMediaLibrary();
        window.switchNewsletterTab('compose');
    };

    // 3. Tab-Navigation umschalten
    window.switchNewsletterTab = async (tabName) => {
        const composeTab = document.getElementById('nlTabCompose');
        const archiveTab = document.getElementById('nlTabArchive');
        const composeBtn = document.getElementById('nlTabComposeBtn');
        const archiveBtn = document.getElementById('nlTabArchiveBtn');

        if (tabName === 'compose') {
            composeTab.style.display = 'block';
            archiveTab.style.display = 'none';
            composeBtn.classList.add('active');
            archiveBtn.classList.remove('active');
        } else if (tabName === 'archive') {
            composeTab.style.display = 'none';
            archiveTab.style.display = 'block';
            composeBtn.classList.remove('active');
            archiveBtn.classList.add('active');
            await window.loadNewsletterDraftsAndArchive();
        }
    };

    // 4. Live-Preview in Echtzeit rendern
    window.updateNlPreview = () => {
        const subjectInput = document.getElementById('nlSubject');
        const messageInput = document.getElementById('nlMessage');
        const targetSelect = document.getElementById('nlTargetSelect');
        const fileInput = document.getElementById('nlAttachment');

        const previewSubject = document.getElementById('nlPreviewSubject');
        const previewBody = document.getElementById('nlPreviewBody');

        const subjectText = subjectInput.value.trim();
        previewSubject.innerText = subjectText ? `Betreff: ${subjectText}` : "Betreff: (Kein Betreff angegeben)";

        const messageText = messageInput.value;
        let formattedMessage = messageText.replace(/\n/g, "<br>");
        // Smart-Newline-Korrektur: Entferne unerwünschte <br>s direkt neben Block-HTML-Tags (z.B. <h3>, <p>, <hr>, <ul>, <li>, <img>)
        formattedMessage = formattedMessage.replace(/(?:<br>\s*)*(<\/?(?:h[1-6]|p|hr|ul|ol|li|div|blockquote|section|article|header|footer|img)[^>]*>)(?:\s*<br>)*/gi, "$1");

        // Ermittle Zielgruppen-Name
        let targetName = "Alle Abonnenten";
        if (targetSelect.value === 'customer') targetName = "Kunden-Rolle";
        else if (targetSelect.value === 'employee') targetName = "Mitarbeiter-Rolle";

        // Prüfe ob Anhang vorliegt (neu gewählt ODER geladener Entwurf)
        let hasAttachment = fileInput.files.length > 0 || nlActiveDraftAttachmentUrl !== null;
        let attachmentHtml = "";
        if (hasAttachment) {
            attachmentHtml = `
            <div style="margin-top: 20px;">
                <a href="#" onclick="return false;" style="background-color:#e74c3c; color:#ffffff; padding:10px 15px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block; font-size:12px; pointer-events:none; font-family:sans-serif;">
                    📄 PDF Anhang herunterladen (Vorschau)
                </a>
            </div>`;
        }

        // Simulierter HTML E-Mail Client
        previewBody.innerHTML = `
        <div style="background-color:#f8fafc; padding:20px; font-family:sans-serif; font-size:14px; line-height:1.6; color:#333; box-sizing:border-box; min-height:100%;">
            <div style="background-color:#005596; color:#ffffff; padding:15px 20px; border-radius:6px 6px 0 0; font-weight:bold; font-size:16px; display:flex; align-items:center; gap:8px;">
                <span>📢</span> Ersatzteil-Konfigurator Updates & News
            </div>
            <div style="background-color:#ffffff; padding:20px; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 6px 6px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <h3 style="margin-top:0; color:#333; font-size:16px;">Hallo [Empfänger-Name],</h3>
                <div style="color:#475569; font-size:13px;">
                    ${formattedMessage || '<span style="color:#94a3b8; font-style:italic;">Hier erscheint Ihr Nachrichtentext live während des Schreibens... Sie können Formatierungen wie &lt;b&gt; oder &lt;h4&gt; nutzen oder ganz bequem die Toolbar oben verwenden.</span>'}
                </div>
                ${attachmentHtml}
                <br><br>
                <a href="#" onclick="return false;" 
                   style="background-color:#005596; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block; font-size:13px; pointer-events:none;">
                   Konfigurator öffnen
                </a>
                <br><br>
                <hr style="border:0; border-top:1px solid #e2e8f0; margin:20px 0;">
                <small style="color:#94a3b8; font-size:11px; display:block; line-height:1.4;">Sie erhalten diese Nachricht, weil Sie mit der E-Mail-Rolle (${targetName}) registriert sind. Sie können diese Benachrichtigungen jederzeit in Ihrem Profil unter "E-Mail-Einstellungen" deaktivieren.</small>
                <br>
                Viele Grüße,<br><strong>Sascha</strong>
            </div>
        </div>`;
    };

    // 5. Rich-Text Editor Formatierungstools
    window.insertNlFormat = (tag) => {
        const textarea = document.getElementById('nlMessage');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        let replacement = "";

        if (tag === 'b') {
            replacement = `<b>${selectedText || 'fetter Text'}</b>`;
        } else if (tag === 'i') {
            replacement = `<i>${selectedText || 'kursiver Text'}</i>`;
        } else if (tag === 'h4') {
            replacement = `<h4>${selectedText || 'Zwischenüberschrift'}</h4>`;
        } else if (tag === 'hr') {
            replacement = `\n<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">\n`;
        }

        textarea.value = text.substring(0, start) + replacement + text.substring(end);
        textarea.focus();
        
        // Cursor-Position hinter das eingefügte Element verschieben
        const newCursorPos = start + replacement.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        
        window.updateNlPreview();
    };

    // 6. Firebase Storage Bild/GIF Uploader für Newsletter (Multi-Upload Support)
    window.handleNlImageUpload = async (input) => {
        if (input.files.length === 0) return;
        
        const btnText = document.getElementById('nlImageUploadText');
        const originalText = btnText.innerText;
        document.getElementById('btnNlImageUpload').disabled = true;

        try {
            const files = Array.from(input.files);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > 5 * 1024 * 1024) {
                    alert(`Bild "${file.name}" ist zu groß (maximal 5MB).`);
                    continue;
                }
                
                btnText.innerHTML = `<span class="nl-upload-spinner"></span> Lade ${i + 1}/${files.length} hoch...`;
                
                const fileExtension = file.name.split('.').pop();
                const storagePath = `newsletters/images/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;
                const storageRef = ref(storage, storagePath);
                
                await uploadBytes(storageRef, file);
            }
            
            // Nach erfolgreichem Upload aller Bilder, aktualisiere die Mediathek
            await window.loadNlMediaLibrary();
            
        } catch (e) {
            console.error("Bild-Upload Fehler:", e);
            alert("Fehler beim Hochladen der Bilder: " + e.message);
        } finally {
            btnText.innerText = originalText;
            document.getElementById('btnNlImageUpload').disabled = false;
            input.value = ''; // Reset Input
        }
    };

    // 6a. Bilder-Mediathek: Liste laden
    window.loadNlMediaLibrary = async () => {
        const galleryContainer = document.getElementById('nlMediaGallery');
        const countSpan = document.getElementById('nlGalleryCount');
        if (!galleryContainer) return;

        galleryContainer.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 10px; text-align: center;">⏳ Mediathek wird geladen...</div>';
        if (countSpan) countSpan.innerText = 'Lade...';

        try {
            const imagesRef = ref(storage, 'newsletters/images');
            const result = await listAll(imagesRef);
            
            if (countSpan) countSpan.innerText = `${result.items.length} ${result.items.length === 1 ? 'Bild' : 'Bilder'}`;

            if (result.items.length === 0) {
                galleryContainer.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem; padding: 15px; text-align: center;">Keine Bilder in der Mediathek. Laden Sie oben Bilder hoch!</div>';
                return;
            }

            // Hole URLs aller Bilder in parallel
            const cardsData = await Promise.all(result.items.map(async (itemRef) => {
                try {
                    const url = await getDownloadURL(itemRef);
                    return {
                        name: itemRef.name,
                        url: url
                    };
                } catch (err) {
                    console.error("Fehler beim Laden der URL für " + itemRef.name, err);
                    return null;
                }
            }));

            const validCards = cardsData.filter(c => c !== null);

            // Render Grid
            let html = '<div class="nl-gallery-grid">';
            validCards.forEach(card => {
                let cleanName = card.name;
                const parts = card.name.split('_');
                if (parts.length > 1) {
                    cleanName = parts.slice(1).join('_');
                }

                html += `
                <div class="nl-gallery-card" title="Klicken, um Bild in den Text einzufügen">
                    <img src="${card.url}" class="nl-gallery-img" onclick="insertNlImageCode('${card.url}')" alt="${cleanName}">
                    <div class="nl-gallery-actions">
                        <span class="nl-gallery-name" onclick="insertNlImageCode('${card.url}')">${cleanName}</span>
                        <button class="nl-gallery-delete-btn" onclick="deleteNlLibraryImage('${card.name}')" title="Bild unwiderruflich löschen">🗑️</button>
                    </div>
                </div>`;
            });
            html += '</div>';
            galleryContainer.innerHTML = html;

        } catch (e) {
            console.error("Fehler beim Laden der Mediathek:", e);
            galleryContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 10px; text-align: center;">❌ Fehler beim Laden der Mediathek. Bitte Firebase-Regeln prüfen!</div>';
            if (countSpan) countSpan.innerText = 'Fehler';
        }
    };

    // 6b. Bildcode an Cursor-Position einfügen
    window.insertNlImageCode = (url) => {
        const textarea = document.getElementById('nlMessage');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        const imgCode = `<img src="${url}" style="max-width:100%; border-radius:6px; margin:15px 0; display:block; box-shadow:0 2px 8px rgba(0,0,0,0.06);" alt="Bild">`;

        textarea.value = text.substring(0, start) + imgCode + text.substring(end);
        textarea.focus();

        const newCursorPos = start + imgCode.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;

        window.updateNlPreview();
    };

    // 6c. Bild aus Speicher löschen
    window.deleteNlLibraryImage = async (name) => {
        if (!confirm("Möchten Sie dieses Bild wirklich dauerhaft aus dem Speicher löschen?")) return;

        try {
            const imgRef = ref(storage, `newsletters/images/${name}`);
            await deleteObject(imgRef);
            await window.loadNlMediaLibrary();
        } catch (e) {
            console.error("Fehler beim Löschen des Bildes:", e);
            alert("Löschen fehlgeschlagen: " + e.message);
        }
    };

    // 6d. Galerie auf-/zuklappen
    window.toggleNlGallery = () => {
        const wrapper = document.getElementById('nlGalleryContentWrapper');
        const arrow = document.getElementById('nlGalleryToggleArrow');
        if (!wrapper || !arrow) return;

        if (wrapper.style.display === 'none') {
            wrapper.style.display = 'block';
            arrow.style.transform = 'rotate(0deg)';
        } else {
            wrapper.style.display = 'none';
            arrow.style.transform = 'rotate(-90deg)';
        }
    };

    // 7. Entwurf in Firestore speichern
    window.saveNewsletterDraft = async () => {
        const subject = document.getElementById('nlSubject').value.trim();
        const message = document.getElementById('nlMessage').value;
        const targetGroup = document.getElementById('nlTargetSelect').value;
        const fileInput = document.getElementById('nlAttachment');
        const draftIdInput = document.getElementById('nlDraftId');

        if (!subject) {
            alert("Bitte geben Sie mindestens einen Betreff ein, um den Entwurf zu speichern.");
            return;
        }

        // Optisches Feedback
        const saveBtn = document.querySelector("button[onclick='saveNewsletterDraft()']");
        const origText = saveBtn.innerText;
        saveBtn.disabled = true;
        saveBtn.innerText = "⏳ Speichere...";

        try {
            let attachmentUrl = nlActiveDraftAttachmentUrl;
            let attachmentName = nlActiveDraftAttachmentName;

            // Falls ein neuer PDF-Anhang gewählt wurde, diesen hochladen
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error("Dateianhang ist zu groß (Max 5MB).");
                }
                const storageRef = ref(storage, `newsletters/attachments/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                attachmentUrl = await getDownloadURL(storageRef);
                attachmentName = file.name;
            }

            const draftData = {
                subject: subject,
                message: message,
                targetGroup: targetGroup,
                attachmentUrl: attachmentUrl,
                attachmentName: attachmentName,
                status: "draft",
                createdAt: new Date(),
                sentAt: null,
                recipientCount: null
            };

            if (draftIdInput.value) {
                // Bestehenden Entwurf aktualisieren
                const docRef = doc(db, "newsletters", draftIdInput.value);
                await setDoc(docRef, draftData, { merge: true });
            } else {
                // Neuen Entwurf anlegen
                const docRef = await addDoc(collection(db, "newsletters"), draftData);
                draftIdInput.value = docRef.id;
            }

            // Aktualisiere lokale Referenzen
            nlActiveDraftAttachmentUrl = attachmentUrl;
            nlActiveDraftAttachmentName = attachmentName;
            if (attachmentUrl && attachmentName) {
                document.getElementById('nlCurrentAttachmentWrapper').style.display = 'flex';
                document.getElementById('nlCurrentAttachmentName').innerText = attachmentName;
                fileInput.value = ''; // Input leeren, da nun in Firestore gesichert
            }

            alert("Entwurf erfolgreich gespeichert!");
            window.updateNlPreview();

        } catch (e) {
            alert("Fehler beim Speichern des Entwurfs: " + e.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = origText;
        }
    };

    // 8. Entwürfe & Archiv aus Firestore laden (inkl. Mitarbeiter-Newsletter Initialisierung)
    window.loadNewsletterDraftsAndArchive = async () => {
        const archiveBody = document.getElementById('nlArchiveBody');
        if (!archiveBody) return;

        try {
            const q = query(collection(db, "newsletters"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);

            let docsList = [];
            snap.forEach(docSnap => {
                docsList.push({ id: docSnap.id, ...docSnap.data() });
            });

            // FALLS KEINE NEWSLETTER EXISTIEREN: Initialisiere den ersten Mitarbeiter-Newsletter-Entwurf
            if (docsList.length === 0) {
                const firstNlText = `<h3>Hallo {Name},</h3>\n\nhinter den Kulissen des Ersatzteil-Konfigurators hat sich in den letzten Tagen Großartiges getan. Ich freue mich, euch heute ein umfassendes Update präsentieren zu können, das unsere tägliche Arbeit revolutionieren und vereinfachen wird.\n\n<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">\n\n<h4>🎯 1. Ein zentraler Ort: Alle Projekte ab sofort vereint!</h4>\n<p>Um unsere Workflows zu bündeln und die Pflege zu vereinfachen, haben wir eine wichtige strategische Entscheidung getroffen: <strong style="color:#005596;">Ab sofort sind alle unsere Projekte auf dieser einzigen, zentralen Webseite vereint!</strong></p>\n<p>Sämtliche bisherigen, separaten Webseiten und bekannten Hilfsadressen werden in den kommenden Tagen abgeschaltet. Bitte nutzt ab jetzt ausschließlich diese Plattform für alle Konfigurationen, Aufmaße und Werkzeuge.</p>\n\n<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">\n\n<h4>📐 2. Der neue Aufmaß-Pilot (3D-Messhilfe) & Mitarbeiter-Tools</h4>\n<p>Wir haben den brandneuen <strong>Aufmaß-Pilot</strong> gestartet! Dieses 3D-Werkzeug hilft euch und unseren Kunden dabei, Lichte Maße, Sturzhöhen und seitliche Anschläge fehlerfrei zu erfassen. Das Tool berechnet automatisch die passenden Torgrößen und Beschlagsarten.</p>\n<p>Zudem wurden die <strong>Mitarbeiter-Tools</strong> (wie der optimierte Text-Konverter im Fullscreen-Split-Layout) nahtlos in die Hauptseite integriert, um Bestellungen aus ISS-Texten in Sekundenschnelle als Checkliste zu analysieren.</p>\n\n<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">\n\n<h4>🤖 3. Unser neuer digitaler Assistent: Carl</h4>\n<p>Habt ihr schon unseren neuen Kollegen entdeckt? Oben links auf der Webseite findet ihr ab sofort <strong>Carl, unseren privaten und DSGVO-konformen KI-Assistenten</strong>.</p>\n<ul>\n    <li><strong>Was er kann:</strong> Er beantwortet Fragen zu technischen Details, Maßen und Ersatzteilen direkt auf Basis unserer hinterlegten Handbücher – auch komplett offline!</li>\n    <li><strong>Was er bald kann:</strong> Carl wird kontinuierlich weiterentwickelt, um komplexe Fehlerdiagnosen durchzuführen und Angebote noch smarter vorzubereiten.</li>\n    <li><strong>Das Besondere für euch:</strong> Falls Carl einmal nicht weiterweiß, könnt ihr als Administratoren/Mitarbeiter das Gespräch im Live-Chat nahtlos übernehmen und direkt mit dem Kunden schreiben.</li>\n</ul>\n\n<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">\n\n<h4>📅 4. Neuer Update-Zyklus & Qualitätssicherung</h4>\n<p>Um die Qualität der Plattform auf allerhöchstem Niveau zu halten und gleichzeitig Freiräume für andere wichtige Projekte zu schaffen, passen wir unseren Entwicklungszyklus an.</p>\n<p>Der Update-Zyklus wird ab sofort wie folgt strukturiert:</p>\n<div style="background:#eaf4fb; padding:15px; border-left:4px solid #005596; border-radius:4px; margin:10px 0;">\n    <strong>• 2 Entwicklungstage pro Woche:</strong> Konzentriertes Hinzufügen neuer Funktionen.<br>\n    <strong>• 1 Bugfix-Tag pro Woche:</strong> Qualitätssicherung, Fehlerbehebung und Performance-Feinschliff.\n</div>\n<p>Durch diese Taktung garantieren wir eine absolut stabile Anwendung und können gleichzeitig hochfokussiert an neuen Lösungen arbeiten.</p>\n\n<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;">\n\n<p>Ich lade euch herzlich ein, die neuen Funktionen direkt auszuprobieren. Bei Fragen oder Feedback nutzt einfach das Ticket-System oder schreibt Carl direkt eine Nachricht.</p>\n\n<p>Viele Grüße,\n<strong>Sascha</strong></p>`;

                const firstNlData = {
                    subject: "🚀 Wichtig: Alle Projekte vereint, neuer Update-Zyklus & Start von KI-Assistent Carl!",
                    message: firstNlText,
                    targetGroup: "employee",
                    attachmentUrl: null,
                    attachmentName: null,
                    status: "draft",
                    createdAt: new Date(),
                    sentAt: null,
                    recipientCount: null
                };

                const docRef = await addDoc(collection(db, "newsletters"), firstNlData);
                docsList.push({ id: docRef.id, ...firstNlData });
            }

            archiveBody.innerHTML = '';
            docsList.forEach(item => {
                const dateVal = item.sentAt ? item.sentAt.toDate() : item.createdAt.toDate();
                const displayDate = dateVal.toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' }) + " Uhr";
                
                let targetText = "Alle Abonnenten";
                if (item.targetGroup === 'customer') targetText = "Rolle: Kunden";
                else if (item.targetGroup === 'employee') targetText = "Rolle: Mitarbeiter";

                const isDraft = item.status === 'draft';
                const statusBadge = isDraft ? `<span class="nl-badge draft">Entwurf</span>` : `<span class="nl-badge sent">Gesendet</span>`;

                let actionButtons = "";
                if (isDraft) {
                    actionButtons = `
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button onclick="loadDraftIntoEditor('${item.id}')" class="nl-btn-small primary" title="Diesen Entwurf bearbeiten">✍️ Editieren</button>
                        <button onclick="deleteNewsletter('${item.id}')" class="nl-btn-small danger" style="padding: 6px 10px;" title="Entwurf löschen">🗑️</button>
                    </div>`;
                } else {
                    actionButtons = `
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button onclick="loadDraftIntoEditor('${item.id}')" class="nl-btn-small secondary" title="Kampagne anzeigen">👁️ Vorschau</button>
                        <button onclick="deleteNewsletter('${item.id}')" class="nl-btn-small danger" style="padding: 6px 10px;" title="Verlaufseintrag löschen">🗑️</button>
                    </div>`;
                }

                archiveBody.innerHTML += `
                <tr>
                    <td>${displayDate}</td>
                    <td style="font-weight: 600;">${item.subject}</td>
                    <td>${targetText}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButtons}</td>
                </tr>`;
            });

        } catch (e) {
            console.error("Fehler beim Laden des Archivs:", e);
            archiveBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:30px;">Fehler beim Laden: ${e.message}</td></tr>`;
        }
    };

    // 9. Entwurf in den Editor laden
    window.loadDraftIntoEditor = async (draftId) => {
        try {
            const docRef = doc(db, "newsletters", draftId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                alert("Entwurf existiert nicht mehr.");
                return;
            }

            const data = docSnap.data();

            document.getElementById('nlDraftId').value = draftId;
            document.getElementById('nlSubject').value = data.subject || '';
            document.getElementById('nlMessage').value = data.message || '';
            document.getElementById('nlTargetSelect').value = data.targetGroup || 'all';
            document.getElementById('nlAttachment').value = ''; // Datei-Input zurücksetzen

            nlActiveDraftAttachmentUrl = data.attachmentUrl || null;
            nlActiveDraftAttachmentName = data.attachmentName || null;

            if (nlActiveDraftAttachmentUrl && nlActiveDraftAttachmentName) {
                document.getElementById('nlCurrentAttachmentWrapper').style.display = 'flex';
                document.getElementById('nlCurrentAttachmentName').innerText = nlActiveDraftAttachmentName;
            } else {
                document.getElementById('nlCurrentAttachmentWrapper').style.display = 'none';
            }

            // Sende-Knopf beschriften
            const sendBtn = document.getElementById('btnSendNewsletter');
            if (data.status === 'sent') {
                sendBtn.innerText = "Erneut versenden";
            } else {
                sendBtn.innerText = "🚀 Senden starten";
            }

            // Tab wechseln
            window.switchNewsletterTab('compose');
            window.updateNlPreview();

        } catch (e) {
            alert("Fehler beim Laden des Entwurfs: " + e.message);
        }
    };

    // 10. Entwurf oder Verlaufseintrag löschen
    window.deleteNewsletter = async (nlId) => {
        if (!confirm("Möchten Sie diesen Eintrag wirklich unwiderruflich löschen?")) return;

        try {
            const docRef = doc(db, "newsletters", nlId);
            await deleteDoc(docRef);
            
            // Falls das gerade geladene Dokument gelöscht wurde, Formular leeren
            if (document.getElementById('nlDraftId').value === nlId) {
                window.resetNlForm();
            }

            alert("Eintrag erfolgreich gelöscht.");
            await window.loadNewsletterDraftsAndArchive();

        } catch (e) {
            alert("Fehler beim Löschen: " + e.message);
        }
    };

    // 11. Entwurfs-Anhang entfernen
    window.removeNlDraftAttachment = () => {
        if (confirm("PDF-Dateianhang für diesen Entwurf entfernen?")) {
            nlActiveDraftAttachmentUrl = null;
            nlActiveDraftAttachmentName = null;
            document.getElementById('nlCurrentAttachmentWrapper').style.display = 'none';
            window.updateNlPreview();
        }
    };

    // 12. Formular zurücksetzen
    window.resetNlForm = () => {
        document.getElementById('nlDraftId').value = '';
        document.getElementById('nlSubject').value = '';
        document.getElementById('nlMessage').value = '';
        document.getElementById('nlTargetSelect').value = 'employee';
        document.getElementById('nlAttachment').value = '';
        nlActiveDraftAttachmentUrl = null;
        nlActiveDraftAttachmentName = null;
        document.getElementById('nlCurrentAttachmentWrapper').style.display = 'none';
        document.getElementById('btnSendNewsletter').innerText = "🚀 Senden starten";
        window.updateNlPreview();
    };

    // 13. Test-E-Mail an Admin senden
    window.sendTestNewsletter = async () => {
        const subject = document.getElementById('nlSubject').value.trim();
        const message = document.getElementById('nlMessage').value;
        const fileInput = document.getElementById('nlAttachment');

        if (!subject || !message) {
            alert("Bitte geben Sie einen Betreff und eine Nachricht ein, um eine Test-E-Mail zu senden.");
            return;
        }

        const testBtn = document.querySelector("button[onclick='sendTestNewsletter()']");
        const origText = testBtn.innerText;
        testBtn.disabled = true;
        testBtn.innerText = "⏳ Sende...";

        try {
            const adminUser = auth.currentUser;
            if (!adminUser || !adminUser.email) {
                throw new Error("Admin E-Mail konnte nicht ermittelt werden. Sind Sie eingeloggt?");
            }

            let attachmentUrl = nlActiveDraftAttachmentUrl;

            // Falls ein neuer PDF-Anhang für den Test gewählt wurde, diesen temporär hochladen
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const storageRef = ref(storage, `newsletters/attachments/test_${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                attachmentUrl = await getDownloadURL(storageRef);
            }

            const adminName = adminUser.displayName ? adminUser.displayName.split(' ')[0] : 'Sascha';
            const personalizedMessage = message.replace(/{Name}/g, adminName);

            await sendEmailSmart('newsletter', {
                user_email: adminUser.email,
                to_name: adminUser.displayName || 'Sascha (Admin)',
                email_subject: "[TEST-PREVIEW] " + subject,
                reply_message: personalizedMessage,
                attachment_url: attachmentUrl
            });

            alert(`Test-E-Mail erfolgreich an ${adminUser.email} gesendet! Bitte prüfen Sie Ihr Postfach.`);

        } catch (e) {
            alert("Fehler beim Senden der Test-E-Mail: " + e.message);
        } finally {
            testBtn.disabled = false;
            testBtn.innerText = origText;
        }
    };

    // 14. E-Mails an Empfängerkreis senden (Sende-Transitor & Firebase Aktualisierung)
    window.sendAdminNewsletter = async () => {
        const subject = document.getElementById('nlSubject').value.trim();
        const message = document.getElementById('nlMessage').value;
        const targetGroup = document.getElementById('nlTargetSelect').value;
        const fileInput = document.getElementById('nlAttachment');
        const draftId = document.getElementById('nlDraftId').value;

        if (!subject || !message) {
            alert("Bitte Betreff und Nachricht eingeben.");
            return;
        }

        const btn = document.getElementById('btnSendNewsletter');
        const origBtnText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Ermittle Empfänger...";

        try {
            const recipientMap = new Map();

            // 1. Hole alle Nutzer, die freigeschaltet sind und Newsletter abonniert haben
            const q = query(collection(db, "users"), where("approved", "==", true));
            const snap = await getDocs(q);

            snap.forEach(docSnap => {
                const u = docSnap.data();
                if (u.newsletterOptIn !== false && u.email) {
                    const role = u.role || 'customer';
                    let add = false;

                    if (targetGroup === 'all') add = true;
                    else if (targetGroup === 'customer' && role === 'customer') add = true;
                    else if (targetGroup === 'employee' && role === 'employee') add = true;

                    if (add && !recipientMap.has(u.email)) {
                        recipientMap.set(u.email, { email: u.email, name: u.firstName || 'Nutzer' });
                    }
                }
            });

            const recipients = Array.from(recipientMap.values());

            if (recipients.length === 0) {
                alert("Keine berechtigten Empfänger in der gewählten Zielgruppe gefunden.");
                btn.disabled = false;
                btn.innerText = origBtnText;
                return;
            }

            let displayGroup = "Mitarbeiter";
            if (targetGroup === 'all') displayGroup = "Alle Nutzer";
            else if (targetGroup === 'customer') displayGroup = "Kunden";

            if (!confirm(`Newsletter an alle ${recipients.length} Abonnenten der Gruppe "${displayGroup}" senden?`)) {
                btn.disabled = false;
                btn.innerText = origBtnText;
                return;
            }

            // 2. Upload des PDF-Anhangs, falls neu ausgewählt
            let attachmentUrl = nlActiveDraftAttachmentUrl;
            let attachmentName = nlActiveDraftAttachmentName;

            if (fileInput.files.length > 0) {
                btn.innerText = "Lade Datei hoch...";
                const file = fileInput.files[0];
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error("Dateianhang ist zu groß (Max 5MB).");
                }
                const storageRef = ref(storage, `newsletters/attachments/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                attachmentUrl = await getDownloadURL(storageRef);
                attachmentName = file.name;
            }

            // 3. E-Mails nacheinander versenden
            btn.innerText = "Sende E-Mails...";
            let successCount = 0;
            let failCount = 0;

            for (let r of recipients) {
                try {
                    // Ersetze {Name} Platzhalter im E-Mail-Körper
                    const personalizedMessage = message.replace(/{Name}/g, r.name);

                    await sendEmailSmart('newsletter', {
                        user_email: r.email,
                        to_name: r.name,
                        email_subject: subject,
                        reply_message: personalizedMessage,
                        attachment_url: attachmentUrl
                    });
                    successCount++;
                } catch (err) {
                    console.error("Fehler beim Senden an " + r.email, err);
                    failCount++;
                }
            }

            // 4. In Firestore archivieren / aktualisieren
            const campaignData = {
                subject: subject,
                message: message,
                targetGroup: targetGroup,
                attachmentUrl: attachmentUrl,
                attachmentName: attachmentName,
                status: "sent",
                createdAt: new Date(),
                sentAt: new Date(),
                recipientCount: successCount
            };

            if (draftId) {
                // Entwurf als "gesendet" überschreiben
                const docRef = doc(db, "newsletters", draftId);
                await setDoc(docRef, campaignData, { merge: true });
            } else {
                // Ohne vorherigen Entwurf direkt als gesendet archivieren
                await addDoc(collection(db, "newsletters"), campaignData);
            }

            alert(`Versand abgeschlossen!\n\nErfolgreich gesendet: ${successCount}\nFehlgeschlagen: ${failCount}`);
            window.resetNlForm();
            document.getElementById('adminNewsletterModal').style.display = 'none';

        } catch (e) {
            alert("Fehler beim E-Mail-Versand: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerText = origBtnText;
        }
    };


        // ==========================================
        // NEU: GITHUB ISSUES DASHBOARD & CONVERSION
        // ==========================================

        window.openDirectGitHubIssueCreator = () => {
            const tabBtn = document.getElementById('tabTOOLS');
            if (tabBtn) {
                tabBtn.click();
            }
            switchToolTab('toolGitHubIssues');
            window.toggleGitHubIssueForm(true);
            
            // Auf Erstellungsmodus zurücksetzen
            document.getElementById('ghEditIssueNumber').value = "";
            document.getElementById('ghSourceTicketId').value = "";
            document.getElementById('ghIssueFormTitle').innerText = "Neues GitHub-Issue erstellen";
            document.getElementById('ghIssueTitle').value = "";
            document.getElementById('ghIssueBody').value = "";
            document.getElementById('ghLabelBug').checked = false;
            document.getElementById('ghLabelFeature').checked = false;
            document.getElementById('ghLabelEnhancement').checked = false;
            document.getElementById('btnSaveGitHubIssue').innerText = "Erstellen";
        };

        window.toggleGitHubIssueForm = (show) => {
            const panel = document.getElementById('ghIssueFormPanel');
            if (!panel) return;
            
            if (show === undefined) {
                show = panel.style.display === 'none';
            }
            
            panel.style.display = show ? 'block' : 'none';
            
            if (show) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        };

        let ghCurrentStateFilter = 'open';
        
        window.setGitHubIssueStateFilter = (state) => {
            ghCurrentStateFilter = state;
            
            const btnOpen = document.getElementById('btnGhFilterOpen');
            const btnClosed = document.getElementById('btnGhFilterClosed');
            
            if (state === 'open') {
                if (btnOpen) btnOpen.classList.add('active');
                if (btnClosed) btnClosed.classList.remove('active');
            } else {
                if (btnOpen) btnOpen.classList.remove('active');
                if (btnClosed) btnClosed.classList.add('active');
            }
            
            window.loadGitHubIssues();
        };

        window.loadGitHubIssues = async () => {
            const token = localStorage.getItem('gh_pat_token');
            if (!token) {
                const listContainer = document.getElementById('ghIssuesList');
                if (listContainer) {
                    listContainer.innerHTML = `
                        <div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:15px; border-radius:6px; text-align:center; font-size:0.9rem; margin-top:15px;">
                            <strong>Achtung: Kein GitHub Token hinterlegt.</strong><br>
                            Bitte richte deinen GitHub Token im Changelog-Manager ein (🐱 GitHub Token einrichten), um den Issue Tracker zu nutzen.
                        </div>
                    `;
                }
                return;
            }
            
            const loader = document.getElementById('ghIssuesLoader');
            const listContainer = document.getElementById('ghIssuesList');
            
            if (loader) loader.style.display = 'block';
            if (listContainer) listContainer.innerHTML = '';
            
            try {
                const labelFilter = document.getElementById('ghFilterLabel')?.value || '';
                let labelQuery = labelFilter ? `&labels=${labelFilter}` : '';
                
                const url = `https://api.github.com/repos/DePhoSa/ersatzteil-konfigurator/issues?state=${ghCurrentStateFilter}${labelQuery}&per_page=50`;
                
                const response = await fetch(url, {
                    headers: {
                        "Authorization": `token ${token}`,
                        "Accept": "application/vnd.github.v3+json"
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`GitHub API Fehler: ${response.status} (${response.statusText})`);
                }
                
                const issues = await response.json();
                window.ghLoadedIssues = issues;
                if (loader) loader.style.display = 'none';
                
                if (issues.length === 0) {
                    listContainer.innerHTML = `
                        <div style="text-align:center; padding:30px; color:#999; font-style:italic; background:white; border:1px solid #ddd; border-radius:6px; margin-top:10px;">
                            Keine Issues mit diesen Filtern gefunden.
                        </div>
                    `;
                    return;
                }
                
                window.renderGitHubIssues(issues);
                
            } catch (e) {
                console.error(e);
                if (loader) loader.style.display = 'none';
                if (listContainer) {
                    listContainer.innerHTML = `
                        <div style="background:#f8d7da; border:1px solid #f5c6cb; color:#721c24; padding:15px; border-radius:6px; text-align:center; margin-top:10px;">
                            Fehler beim Laden der Issues: ${e.message}
                        </div>
                    `;
                }
            }
        };

        window.renderGitHubIssues = (issues) => {
            const listContainer = document.getElementById('ghIssuesList');
            if (!listContainer) return;
            
            let html = '';
            
            issues.forEach(issue => {
                let labelBadges = '';
                if (issue.labels && Array.isArray(issue.labels)) {
                    issue.labels.forEach(l => {
                        let bgColor = '#' + l.color;
                        let textColor = getContrastYIQ(l.color);
                        labelBadges += `<span style="background:${bgColor}; color:${textColor}; font-size:0.75rem; padding:3px 8px; border-radius:12px; font-weight:bold; margin-right:5px; display:inline-block;">${l.name}</span>`;
                    });
                }
                
                const bodyText = issue.body || 'Keine Beschreibung.';
                const isLong = bodyText.length > 200;
                const displayBody = isLong ? bodyText.substring(0, 200) + '...' : bodyText;
                
                const dateStr = new Date(issue.created_at).toLocaleDateString();
                const author = issue.user ? issue.user.login : 'Unbekannt';
                
                const isClosed = issue.state === 'closed';
                const actionButtonText = isClosed ? '🔄 Wiedereröffnen' : '🔴 Schließen';
                const actionButtonBg = isClosed ? '#27ae60' : '#e74c3c';
                
                html += `
                    <div class="issue-card" style="background:white; border:1px solid #ddd; border-radius:8px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
                            <h4 style="margin:0; font-size:1.05rem; color:#2c3e50; font-weight:700;">
                                <a href="${issue.html_url}" target="_blank" style="color:#2c3e50; text-decoration:none;">#${issue.number} ${escapeHTML(issue.title)}</a>
                            </h4>
                            <div style="display:flex; gap:5px;">
                                ${labelBadges}
                            </div>
                        </div>
                        
                        <div style="font-size:0.8rem; color:#888;">
                            Erstellt von <strong>@${author}</strong> am ${dateStr}
                        </div>
                        
                        <div id="ghIssueBodyText_${issue.number}" style="font-size:0.9rem; color:#444; white-space:pre-wrap; background:#fbfbfb; padding:8px; border-radius:4px; border:1px solid #f0f0f0;">${escapeHTML(displayBody)}</div>
                        
                        ${isLong ? `
                            <button onclick="window.toggleGitHubIssueBodyExpand(${issue.number})" id="btnExpandGh_${issue.number}" class="copy-btn" style="align-self:flex-start; margin:0; font-size:0.75rem; color:#2980b9; background:transparent; border:none; cursor:pointer; font-weight:bold; padding:0;">Mehr anzeigen</button>
                        ` : ''}
                        
                        <div style="display:flex; gap:8px; justify-content:flex-end; border-top:1px solid #f5f5f5; padding-top:10px; margin-top:5px; flex-wrap:wrap;">
                            <button onclick="window.openIssueEditor(${issue.number})" 
                                    class="btn-edit" 
                                    style="margin:0; font-size:0.8rem; padding:6px 12px; display:flex; align-items:center; gap:4px; border:1px solid #ccc; background:white; border-radius:4px; cursor:pointer;">
                                ✏️ Bearbeiten
                            </button>
                            <button onclick="window.toggleIssueState(${issue.number}, '${issue.state}')" 
                                    class="btn-calc" 
                                    style="margin:0; width:auto; font-size:0.8rem; padding:6px 12px; background:${actionButtonBg}; color:white;">
                                ${actionButtonText}
                            </button>
                        </div>
                    </div>
                `;
            });
            
            listContainer.innerHTML = html;
        };
        
        window.toggleGitHubIssueBodyExpand = (issueNumber) => {
            const bodyDiv = document.getElementById(`ghIssueBodyText_${issueNumber}`);
            const btn = document.getElementById(`btnExpandGh_${issueNumber}`);
            if (!bodyDiv || !btn) return;
            
            const issue = (window.ghLoadedIssues || []).find(i => i.number === issueNumber);
            const fullText = issue ? (issue.body || 'Keine Beschreibung.') : '';
            
            const isExpanded = btn.innerText === 'Weniger anzeigen';
            if (isExpanded) {
                bodyDiv.innerText = fullText.substring(0, 200) + '...';
                btn.innerText = 'Mehr anzeigen';
            } else {
                bodyDiv.innerText = fullText;
                btn.innerText = 'Weniger anzeigen';
            }
        };
        
        function getContrastYIQ(hexcolor){
            const r = parseInt(hexcolor.substring(0,2),16);
            const g = parseInt(hexcolor.substring(2,4),16);
            const b = parseInt(hexcolor.substring(4,6),16);
            const yiq = ((r*299)+(g*587)+(b*114))/1000;
            return (yiq >= 128) ? 'black' : 'white';
        }
        
        function escapeHTML(str) {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        window.toggleIssueState = async (issueNumber, currentState) => {
            const token = localStorage.getItem('gh_pat_token');
            if (!token) return;
            
            const newState = currentState === 'open' ? 'closed' : 'open';
            const confirmMsg = newState === 'closed' ? `Issue #${issueNumber} wirklich schließen?` : `Issue #${issueNumber} wiedereröffnen?`;
            
            if (!confirm(confirmMsg)) return;
            
            try {
                const url = `https://api.github.com/repos/DePhoSa/ersatzteil-konfigurator/issues/${issueNumber}`;
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        "Authorization": `token ${token}`,
                        "Content-Type": "application/json",
                        "Accept": "application/vnd.github.v3+json"
                    },
                    body: JSON.stringify({ state: newState })
                });
                
                if (!response.ok) {
                    throw new Error(`GitHub API Fehler: ${response.status}`);
                }
                
                alert(`Issue #${issueNumber} erfolgreich ${newState === 'closed' ? 'geschlossen' : 'wiedereröffnet'}!`);
                window.loadGitHubIssues();
                
            } catch (e) {
                console.error(e);
                alert("Fehler beim Ändern des Issue-Status: " + e.message);
            }
        };

        window.openIssueEditor = (issueNumber) => {
            const issue = (window.ghLoadedIssues || []).find(i => i.number === issueNumber);
            if (!issue) return;

            window.toggleGitHubIssueForm(true);
            
            document.getElementById('ghEditIssueNumber').value = issue.number || '';
            document.getElementById('ghSourceTicketId').value = '';
            
            document.getElementById('ghIssueFormTitle').innerText = `Issue #${issue.number} bearbeiten`;
            document.getElementById('ghIssueTitle').value = issue.title || '';
            document.getElementById('ghIssueBody').value = issue.body || '';
            
            const labelNames = (issue.labels || []).map(l => l.name);
            document.getElementById('ghLabelBug').checked = labelNames.includes('bug');
            document.getElementById('ghLabelFeature').checked = labelNames.includes('feature');
            document.getElementById('ghLabelEnhancement').checked = labelNames.includes('enhancement');
            
            document.getElementById('btnSaveGitHubIssue').innerText = "Speichern";
        };

        window.saveGitHubIssue = async () => {
            const title = document.getElementById('ghIssueTitle').value.trim();
            const body = document.getElementById('ghIssueBody').value.trim();
            const issueNumber = document.getElementById('ghEditIssueNumber').value;
            const sourceTicketId = document.getElementById('ghSourceTicketId').value;
            
            if (!title || !body) {
                alert("Bitte Titel und Beschreibung ausfüllen.");
                return;
            }
            
            const token = localStorage.getItem('gh_pat_token');
            if (!token) {
                alert("GitHub Token fehlt.");
                return;
            }
            
            const labels = [];
            if (document.getElementById('ghLabelBug').checked) labels.push('bug');
            if (document.getElementById('ghLabelFeature').checked) labels.push('feature');
            if (document.getElementById('ghLabelEnhancement').checked) labels.push('enhancement');
            
            const btn = document.getElementById('btnSaveGitHubIssue');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "⏳ Speichert...";
            
            try {
                let url = 'https://api.github.com/repos/DePhoSa/ersatzteil-konfigurator/issues';
                let method = 'POST';
                
                if (issueNumber) {
                    url += '/' + issueNumber;
                    method = 'PATCH';
                }
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        "Authorization": `token ${token}`,
                        "Content-Type": "application/json",
                        "Accept": "application/vnd.github.v3+json"
                    },
                    body: JSON.stringify({
                        title: title,
                        body: body,
                        labels: labels
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`GitHub API Fehler: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (sourceTicketId && method === 'POST') {
                    // Update Firestore Ticket
                    await updateDoc(doc(db, "tickets", sourceTicketId), {
                        githubIssueNumber: result.number,
                        githubIssueUrl: result.html_url,
                        adminReply: `Ticket wurde in GitHub-Issue #${result.number} umgewandelt.`
                    });
                    
                    alert(`Erfolgreich in GitHub-Issue #${result.number} umgewandelt!`);
                    
                    // Reload details view
                    await openTicketDetail(sourceTicketId);
                    await loadAdminTickets();
                } else {
                    alert(`Issue erfolgreich ${issueNumber ? 'aktualisiert' : 'erstellt'}!`);
                }
                
                window.toggleGitHubIssueForm(false);
                document.getElementById('ghEditIssueNumber').value = '';
                document.getElementById('ghSourceTicketId').value = '';
                document.getElementById('ghIssueTitle').value = '';
                document.getElementById('ghIssueBody').value = '';
                document.getElementById('ghLabelBug').checked = false;
                document.getElementById('ghLabelFeature').checked = false;
                document.getElementById('ghLabelEnhancement').checked = false;
                
                window.loadGitHubIssues();
                
            } catch (e) {
                console.error(e);
                alert("Fehler beim Speichern des Issues: " + e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };

        window.convertTicketToGitHubIssue = (ticketId, t) => {
            document.getElementById('adminTicketModal').style.display = 'none';
            
            const tabBtn = document.getElementById('tabTOOLS');
            if (tabBtn) tabBtn.click();
            
            switchToolTab('toolGitHubIssues');
            window.toggleGitHubIssueForm(true);
            
            document.getElementById('ghEditIssueNumber').value = '';
            document.getElementById('ghSourceTicketId').value = ticketId;
            document.getElementById('ghIssueFormTitle').innerText = "Ticket in GitHub-Issue umwandeln";
            
            let prefix = '🐞 [Bug] ';
            if (t.type === 'Feature') prefix = '✨ [Feature] ';
            else if (t.type === 'Feedback') prefix = '📝 [Feedback] ';
            
            document.getElementById('ghIssueTitle').value = prefix + t.subject;
            
            let fileInfo = '';
            if (t.fileUrl) {
                fileInfo = `\n- **Anhang:** [📎 Dateianhang ansehen](${t.fileUrl})`;
            }
            
            const markdownBody = `### Kundenmeldung\n${t.message}\n\n---\n**Metadaten:**\n- **Kunde:** ${t.userName || 'Kunde'} (${t.userEmail})\n- **Ticket-Typ:** ${t.type || 'Support'}\n- **Original-Ticket-ID:** ${ticketId}${fileInfo}`;
            
            document.getElementById('ghIssueBody').value = markdownBody;
            
            document.getElementById('ghLabelBug').checked = (t.type === 'Bug');
            document.getElementById('ghLabelFeature').checked = (t.type === 'Feature');
            document.getElementById('ghLabelEnhancement').checked = (t.type === 'Feedback');
            
            document.getElementById('btnSaveGitHubIssue').innerText = "Als Issue erstellen & verknüpfen";
        };

        window.unlinkTicketFromGitHub = async (ticketId) => {
            if (!confirm("Möchten Sie die Verknüpfung zu diesem GitHub-Issue für dieses Ticket wirklich aufheben? Das Issue auf GitHub bleibt bestehen, aber das Ticket auf Ihrer Webseite wird wieder freigegeben.")) return;
            
            try {
                await updateDoc(doc(db, "tickets", ticketId), {
                    githubIssueNumber: null,
                    githubIssueUrl: null
                });
                
                alert("Verknüpfung erfolgreich aufgehoben!");
                await openTicketDetail(ticketId);
                await loadAdminTickets();
            } catch (e) {
                console.error(e);
                alert("Fehler beim Entkoppeln: " + e.message);
            }
        };

        // ==========================================
        // NEU: FIREBASE LIVE-CHAT FÜR ASSISTENT CARL
        // ==========================================

        window.createLiveChatSession = async (messageHistory, dimensions, summary) => {
            try {
                const user = auth.currentUser;
                const customerEmail = user ? user.email : "Gast";
                let customerName = "Gast";
                if (user) {
                    customerName = window.currentUserFirstName || user.email.split('@')[0];
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists() && userDoc.data().firstName) {
                            customerName = userDoc.data().firstName;
                        }
                    } catch (e) {
                        console.error("Fehler beim Laden des Benutzernamens für den Chat:", e);
                    }
                }

                const docRef = await addDoc(collection(db, "live_chats"), {
                    status: "waiting", // wartend
                    customerEmail: customerEmail,
                    customerName: customerName,
                    createdAt: serverTimestamp(),
                    dimensions: dimensions,
                    summary: summary,
                    messages: messageHistory
                });

                localStorage.setItem('carl_chat_session_id', docRef.id);
                return docRef.id;
            } catch (e) {
                console.error("Fehler beim Erstellen der Chat-Sitzung:", e);
                alert("Fehler beim Starten des Live-Chats: " + e.message);
                return null;
            }
        };

        window.listenToLiveChatSession = (chatId, callback) => {
            return onSnapshot(doc(db, "live_chats", chatId), (docSnap) => {
                if (docSnap.exists()) {
                    callback(docSnap.data());
                }
            }, (error) => {
                console.error("Fehler im Live-Chat Stream:", error);
            });
        };

        window.sendChatMessageToSession = async (chatId, sender, text) => {
            try {
                await updateDoc(doc(db, "live_chats", chatId), {
                    messages: arrayUnion({
                        sender: sender,
                        text: text,
                        timestamp: Date.now()
                    })
                });
            } catch (e) {
                console.error("Fehler beim Senden der Nachricht:", e);
            }
        };

        window.updateLiveChatSessionMessages = async (chatId, messages) => {
            try {
                await updateDoc(doc(db, "live_chats", chatId), {
                    messages: messages
                });
                return true;
            } catch (e) {
                console.error("Fehler beim Aktualisieren der Live-Chat-Nachrichten:", e);
                return false;
            }
        };

        // Admin-Dashboard: Live-Chats abhören
        let liveChatsUnsubscribe = null;

        window.initLiveChatsAdminListener = () => {
            if (window.currentUserRole !== 'admin') return;
            const user = auth.currentUser;
            if (!user) return;

            if (liveChatsUnsubscribe) {
                liveChatsUnsubscribe();
            }

            // Clientseitige Filterung verwenden, um Index-Probleme bei Verbundabfragen vollständig auszuschließen!
            const q = query(
                collection(db, "live_chats"), 
                orderBy("createdAt", "desc")
            );

            liveChatsUnsubscribe = onSnapshot(q, (snapshot) => {
                const chats = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Nur offene ("waiting" oder "active") Chats anzeigen
                    if (data.status === "waiting" || data.status === "active") {
                        chats.push({ id: doc.id, ...data });
                    }
                });
                
                if (window.renderLiveChatsList) {
                    window.renderLiveChatsList(chats);
                }
            }, (error) => {
                console.error("Fehler beim Abrufen der Live-Chats für Admin:", error);
            });
        };

        window.takeoverLiveChatSession = async (chatId) => {
            try {
                const user = auth.currentUser;
                let adminName = "Sascha";
                if (user) {
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists() && userDoc.data().firstName) {
                            adminName = userDoc.data().firstName;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                await updateDoc(doc(db, "live_chats", chatId), {
                    status: "active",
                    messages: arrayUnion({
                        sender: "System",
                        text: `${adminName} übernimmt ab hier!`,
                        timestamp: Date.now()
                    })
                });
            } catch (e) {
                console.error("Fehler bei der Chat-Übernahme:", e);
                alert("Fehler bei der Chat-Übernahme: " + e.message);
            }
        };

        window.closeLiveChatSession = async (chatId) => {
            try {
                await updateDoc(doc(db, "live_chats", chatId), {
                    status: "closed",
                    messages: arrayUnion({
                        sender: "System",
                        text: "Dieser Chat wurde geschlossen.",
                        timestamp: Date.now()
                    })
                });
            } catch (e) {
                console.error("Fehler beim Schließen des Chats:", e);
            }
        };

        // ==========================================
        // NEUE KANÄLE FÜR CARL-FEEDBACK & WISSENSDATENBANK
        // ==========================================

        window.saveCarlSession = async (sessionId, messages, privacyMode) => {
            try {
                const user = auth.currentUser;
                const customerEmail = user ? user.email : "Gast";
                let customerName = "Gast";
                if (user) {
                    customerName = window.currentUserFirstName || user.email.split('@')[0];
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists() && userDoc.data().firstName) {
                            customerName = userDoc.data().firstName;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                if (!sessionId) {
                    const docRef = await addDoc(collection(db, "carl_sessions"), {
                        customerEmail: customerEmail,
                        customerName: customerName,
                        createdAt: serverTimestamp(),
                        privacyMode: privacyMode,
                        status: "active",
                        messages: messages
                    });
                    return docRef.id;
                } else {
                    const docRef = doc(db, "carl_sessions", sessionId);
                    let docExists = false;
                    try {
                        const docSnap = await getDoc(docRef);
                        docExists = docSnap.exists();
                    } catch (e) {
                        console.error("[saveCarlSession] Fehler beim Prüfen der Existenz:", e);
                    }

                    const updateData = {
                        messages: messages,
                        lastUpdatedAt: serverTimestamp(),
                        // Metadaten bei jedem Update mitspeichern, um ältere Dokumente automatisch zu heilen
                        customerEmail: customerEmail,
                        customerName: customerName
                    };

                    if (!docExists) {
                        updateData.createdAt = serverTimestamp();
                        updateData.privacyMode = privacyMode || 'OptionA';
                        updateData.status = "active";
                    }

                    await setDoc(docRef, updateData, { merge: true });
                    return sessionId;
                }
            } catch (e) {
                console.error("Fehler beim Speichern der Carl-Sitzung:", e);
                return null;
            }
        };

        window.saveTextConverterTicket = async (data) => {
            try {
                const user = auth.currentUser;
                const userEmail = data.userEmail || (user ? user.email : "Gast");
                let userName = "Gast";
                if (user) {
                    userName = window.currentUserFirstName || user.email.split('@')[0];
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists() && userDoc.data().firstName) {
                            userName = userDoc.data().firstName;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                const finalMessage = `Kontakt: ${userEmail}\n\nKommentar des Nutzers:\n${data.userComment}\n\n--- ORIGINALTEXT ---\n${data.originalText}\n\n--- GENERIERTE CHECKLISTE ---\n${data.generatedChecklistText}`;

                // In Ticket-Datenbank speichern
                const docRef = await addDoc(collection(db, "tickets"), {
                    userId: user ? user.uid : "Gast",
                    userEmail: userEmail,
                    userName: userName,
                    type: "Text-Konverter",
                    subject: "Fehlerbericht: Text-Konverter",
                    message: finalMessage,
                    fileUrl: null,
                    status: 'open',
                    createdAt: serverTimestamp(),
                    adminReply: ''
                });

                // E-Mail Info triggern
                const emailParams = {
                    type: "Text-Konverter",
                    subject: "Fehlerbericht: Text-Konverter Fehler",
                    message: finalMessage,
                    user_email: userEmail,
                    has_file: "Nein"
                };

                try {
                    await sendEmailSmart('report', emailParams);
                } catch (emailErr) {
                    console.error("E-Mail Fehler bei Text-Konverter Ticket:", emailErr);
                }

                return docRef.id;
            } catch (e) {
                console.error("Fehler beim Speichern des Text-Konverter-Tickets:", e);
                return null;
            }
        };

        window.saveCarlFeedback = async (feedbackData) => {
            try {
                const user = auth.currentUser;
                const customerEmail = user ? user.email : "Gast";
                let customerName = "Gast";
                if (user) {
                    customerName = window.currentUserFirstName || user.email.split('@')[0];
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists() && userDoc.data().firstName) {
                            customerName = userDoc.data().firstName;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                const docRef = await addDoc(collection(db, "carl_feedbacks"), {
                    customerEmail: customerEmail,
                    customerName: customerName,
                    ...feedbackData,
                    createdAt: serverTimestamp()
                });
                return docRef.id;
            } catch (e) {
                console.error("Fehler beim Speichern des Carl-Feedbacks:", e);
                return null;
            }
        };

        window.loadCarlSessions = (callback) => {
            if (window.currentUserRole !== 'admin') return () => {};
            // Clientseitige Sortierung verwenden, um Index- und Feldabwesenheits-Probleme vollständig auszuschließen!
            const q = query(collection(db, "carl_sessions"), limit(100));
            return onSnapshot(q, (snapshot) => {
                const sessions = [];
                snapshot.forEach((doc) => {
                    sessions.push({ id: doc.id, ...doc.data() });
                });
                // Sortieren nach createdAt (bzw. lastUpdatedAt) absteigend
                sessions.sort((a, b) => {
                    const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : (a.lastUpdatedAt ? (a.lastUpdatedAt.toMillis ? a.lastUpdatedAt.toMillis() : new Date(a.lastUpdatedAt).getTime()) : 0);
                    const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : (b.lastUpdatedAt ? (b.lastUpdatedAt.toMillis ? b.lastUpdatedAt.toMillis() : new Date(b.lastUpdatedAt).getTime()) : 0);
                    return timeB - timeA;
                });
                callback(sessions.slice(0, 50));
            }, (error) => {
                console.error("Fehler beim Abrufen der Carl-Sitzungen:", error);
            });
        };

        window.loadCarlFeedbacks = (callback) => {
            if (window.currentUserRole !== 'admin') return () => {};
            // Clientseitige Sortierung verwenden, um Index- und Feldabwesenheits-Probleme vollständig auszuschließen!
            const q = query(collection(db, "carl_feedbacks"), limit(100));
            return onSnapshot(q, (snapshot) => {
                const feedbacks = [];
                snapshot.forEach((doc) => {
                    feedbacks.push({ id: doc.id, ...doc.data() });
                });
                // Sortieren nach createdAt absteigend
                feedbacks.sort((a, b) => {
                    const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
                    const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
                    return timeB - timeA;
                });
                callback(feedbacks.slice(0, 50));
            }, (error) => {
                console.error("Fehler beim Abrufen der Carl-Feedbacks:", error);
            });
        };

        window.saveCarlKnowledge = async (title, text) => {
            try {
                const docRef = await addDoc(collection(db, "carl_knowledge"), {
                    title: title,
                    text: text,
                    createdAt: serverTimestamp()
                });
                return docRef.id;
            } catch (e) {
                console.error("Fehler beim Speichern des Wissensbausteins:", e);
                return null;
            }
        };

        window.deleteCarlKnowledge = async (docId) => {
            try {
                await deleteDoc(doc(db, "carl_knowledge", docId));
                return true;
            } catch (e) {
                console.error("Fehler beim Löschen des Wissensbausteins:", e);
                return false;
            }
        };

        window.deleteCarlSession = async (sessionId) => {
            try {
                await deleteDoc(doc(db, "carl_sessions", sessionId));
                return true;
            } catch (e) {
                console.error("Fehler beim Löschen der Carl-Sitzung:", e);
                return false;
            }
        };

        window.deleteCarlFeedback = async (feedbackId) => {
            try {
                await deleteDoc(doc(db, "carl_feedbacks", feedbackId));
                return true;
            } catch (e) {
                console.error("Fehler beim Löschen des Carl-Feedbacks:", e);
                return false;
            }
        };

        window.listenToCarlKnowledge = (callback) => {
            const q = query(collection(db, "carl_knowledge"), orderBy("createdAt", "desc"));
            return onSnapshot(q, (snapshot) => {
                const knowledgeList = [];
                snapshot.forEach((doc) => {
                    knowledgeList.push({ id: doc.id, ...doc.data() });
                });
                callback(knowledgeList);
            }, (error) => {
                console.error("Fehler beim Abrufen des Wissens:", error);
            });
        };

        window.updateAdminBadgesUI = () => {
            // Get visited timestamps from localStorage
            const lastVisitedLiveChats = parseInt(localStorage.getItem('lastVisited_LiveChats') || Date.now());
            const lastVisitedChatVerlaeufe = parseInt(localStorage.getItem('lastVisited_ChatVerlaeufe') || Date.now());
            const lastVisitedFehlerberichte = parseInt(localStorage.getItem('lastVisited_Fehlerberichte') || Date.now());

            // Falls der User aktiv in einem Tab steht, direkt Timestamp zurücksetzen und Badge nicht leuchten lassen
            if (window.currentSeries === 'TOOLS') {
                const activeBtn = document.querySelector('#subNavTools .sub-nav-btn.active');
                if (activeBtn) {
                    const btnId = activeBtn.id;
                    if (btnId === 'btnToolLiveChats') {
                        localStorage.setItem('lastVisited_LiveChats', Date.now());
                        hasNewLiveChats = false;
                    } else if (btnId === 'btnToolCarlManager') {
                        if (window.selectedAdminTab === 'verlaeufe') {
                            localStorage.setItem('lastVisited_ChatVerlaeufe', Date.now());
                            hasNewChatVerlaeufe = false;
                        } else if (window.selectedAdminTab === 'feedback') {
                            localStorage.setItem('lastVisited_Fehlerberichte', Date.now());
                            hasNewFehlerberichte = false;
                        }
                    }
                }
            }

            // Sub-Tabs im Carl-Manager
            const badgeVerlaeufe = document.getElementById('badgeCarlVerlaeufe');
            if (badgeVerlaeufe) {
                badgeVerlaeufe.style.display = hasNewChatVerlaeufe ? 'inline-block' : 'none';
            }
            const badgeFeedback = document.getElementById('badgeCarlFeedback');
            if (badgeFeedback) {
                badgeFeedback.style.display = hasNewFehlerberichte ? 'inline-block' : 'none';
            }

            // Haupt-Tabs in den Tools
            const badgeLiveChats = document.getElementById('badgeLiveChats');
            if (badgeLiveChats) {
                badgeLiveChats.style.display = hasNewLiveChats ? 'inline-block' : 'none';
            }
            const badgeCarlManager = document.getElementById('badgeCarlManager');
            if (badgeCarlManager) {
                const hasCarlManagerActivity = hasNewChatVerlaeufe || hasNewFehlerberichte;
                badgeCarlManager.style.display = hasCarlManagerActivity ? 'inline-block' : 'none';
            }

            // Haupt-Navigation "🛠️ Interne Tools"
            const badgeTools = document.getElementById('badgeTools');
            if (badgeTools) {
                const hasToolsActivity = hasNewLiveChats || hasNewChatVerlaeufe || hasNewFehlerberichte;
                badgeTools.style.display = hasToolsActivity ? 'inline-block' : 'none';
            }
        };

        window.initAdminNotificationBadges = () => {
            if (window.currentUserRole !== 'admin') return;

            // Unsubscribe falls bereits aktiv
            if (adminBadgesUnsubscribes) {
                adminBadgesUnsubscribes.forEach(unsub => unsub());
            }
            adminBadgesUnsubscribes = [];

            // Initialisiere Timestamps falls leer
            if (!localStorage.getItem('lastVisited_LiveChats')) {
                localStorage.setItem('lastVisited_LiveChats', Date.now());
            }
            if (!localStorage.getItem('lastVisited_ChatVerlaeufe')) {
                localStorage.setItem('lastVisited_ChatVerlaeufe', Date.now());
            }
            if (!localStorage.getItem('lastVisited_Fehlerberichte')) {
                localStorage.setItem('lastVisited_Fehlerberichte', Date.now());
            }

            // 1. Snapshot für Live-Chats
            const qChats = query(collection(db, "live_chats"));
            const unsubChats = onSnapshot(qChats, (snapshot) => {
                const lastVisited = parseInt(localStorage.getItem('lastVisited_LiveChats') || 0);
                let newActivity = false;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.status === 'waiting' || data.status === 'active') {
                        let docTime = 0;
                        if (data.lastUpdatedAt) {
                            docTime = data.lastUpdatedAt.toMillis ? data.lastUpdatedAt.toMillis() : new Date(data.lastUpdatedAt).getTime();
                        } else if (data.createdAt) {
                            docTime = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                        }
                        if (data.messages && data.messages.length > 0) {
                            const lastMsg = data.messages[data.messages.length - 1];
                            if (lastMsg.timestamp) {
                                const msgTime = lastMsg.timestamp.toMillis ? lastMsg.timestamp.toMillis() : new Date(lastMsg.timestamp).getTime();
                                docTime = Math.max(docTime, msgTime);
                            }
                        }
                        if (docTime > lastVisited) {
                            newActivity = true;
                        }
                    }
                });
                hasNewLiveChats = newActivity;
                window.updateAdminBadgesUI();
            }, (error) => {
                console.error("Fehler beim Abhören der Live-Chats für Badges:", error);
            });
            adminBadgesUnsubscribes.push(unsubChats);

            // 2. Snapshot für Chat-Verläufe
            const qSessions = query(collection(db, "carl_sessions"));
            const unsubSessions = onSnapshot(qSessions, (snapshot) => {
                const lastVisited = parseInt(localStorage.getItem('lastVisited_ChatVerlaeufe') || 0);
                let newActivity = false;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    let docTime = 0;
                    if (data.lastUpdatedAt) {
                        docTime = data.lastUpdatedAt.toMillis ? data.lastUpdatedAt.toMillis() : new Date(data.lastUpdatedAt).getTime();
                    } else if (data.createdAt) {
                        docTime = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                    }
                    if (docTime > lastVisited) {
                        newActivity = true;
                    }
                });
                hasNewChatVerlaeufe = newActivity;
                window.updateAdminBadgesUI();
            }, (error) => {
                console.error("Fehler beim Abhören der Carl-Sessions für Badges:", error);
            });
            adminBadgesUnsubscribes.push(unsubSessions);

            // 3. Snapshot für Fehlerberichte
            const qFeedbacks = query(collection(db, "carl_feedbacks"));
            const unsubFeedbacks = onSnapshot(qFeedbacks, (snapshot) => {
                const lastVisited = parseInt(localStorage.getItem('lastVisited_Fehlerberichte') || 0);
                let newActivity = false;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    let docTime = 0;
                    if (data.createdAt) {
                        docTime = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                    }
                    if (docTime > lastVisited) {
                        newActivity = true;
                    }
                });
                hasNewFehlerberichte = newActivity;
                window.updateAdminBadgesUI();
            }, (error) => {
                console.error("Fehler beim Abhören der Feedbacks für Badges:", error);
            });
            adminBadgesUnsubscribes.push(unsubFeedbacks);
        };


/**
 * Carl - Der offline-fähige KI-Assistent & Live-Chat-Schnittstelle
 * 
 * Diese Datei steuert die Benutzeroberfläche und Funktionalität des Assistenten Carl.
 * Carl beantwortet Fragen vollkommen lokal über ein regelbasiertes NLP-System oder über Ollama (online).
 * Bei Bedarf kann das Gespräch an Sascha (oder andere Mitarbeiter) per Firebase eskaliert werden.
 * Enthält ein umfangreiches RAG-Dokumenten- und OCR-Adminpanel zur Pflege des Wissensstands.
 */

(function () {
    // ==========================================
    // 1. LOKALE FAQ-WISSDENSDATENBANK & ZUSTAND
    // ==========================================
    const FAQ_DATA = [
        {
            keywords: ['sturz', 'sturzhöhe', 'sturzhöhe?', 'raumhöhe', 'höhe', 'sturzmangel', 'deckenhöhe', 'sturzbedarf'],
            answer: "Für die Montage eines Hörmann Sektionaltors ist die <b>Sturzhöhe (D)</b> entscheidend. Je nach Beschlagsart gelten folgende Mindestmaße:<br>• <b>Z-Beschlag</b> (Zugfeder): min. 100 mm Sturzbedarf<br>• <b>N-Beschlag</b> (Normalbeschlag vorn): min. 210 mm Sturzbedarf<br>• <b>L-Beschlag</b> (Niedrigsturzbeschlag hinten): min. 115 mm Sturzbedarf<br><br><i>Tipp:</i> Trage deine Maße im Aufmaß-Pilot ein und klicke auf 'Tor prüfen', damit ich deine Werte direkt überprüfen kann!"
        },
        {
            keywords: ['z-beschlag', 'zugfeder', 'zugfederbeschlag', 'z beschlag', 'seitliche feder'],
            answer: "Der <b>Z-Beschlag</b> (Zugfeder-Beschlag) besitzt seitlich liegende Zugfeder-Pakete. Die Vorteile:<br>• Benötigt nur <b>100 mm Sturzhöhe</b><br>• Einfachere und schnellere Montage im Vergleich zu Torsionsfedern<br><br><i>Einschränkung:</i> Er ist nur für kleinere bis mittlere Tore zugelassen (Breite meist bis 3000 mm, maximal 4000 mm je nach Gewicht)."
        },
        {
            keywords: ['n-beschlag', 'torsionsfeder', 'normalbeschlag', 'n beschlag', 'frontfeder'],
            answer: "Der <b>N-Beschlag</b> (Normal-Beschlag) verwendet vorne liegende Torsionsfedern. Vorteile:<br>• Extrem stabiler, ruhiger Torlauf für größere Tore<br>• Standardausführung für Breiten über 3000 mm<br><br><i>Einschränkung:</i> Benötigt eine großzügige <b>Sturzhöhe von mindestens 210 mm</b>."
        },
        {
            keywords: ['l-beschlag', 'niedrigsturz', 'niedrigsturzbeschlag', 'l beschlag', 'heckfeder'],
            answer: "Der <b>L-Beschlag</b> (Niedrigsturz-Beschlag) verwendet hinten liegende Torsionsfedern. Vorteile:<br>• Perfekt für niedrige Garagendecken mit wenig Platz<br>• Benötigt nur <b>115 mm Sturzhöhe</b><br><br><i>Hinweis:</i> Die nutzbare Durchfahrtshöhe wird hierbei geringfügig reduziert, da die Paneele nicht ganz aus der Öffnung fahren."
        },
        {
            keywords: ['baureihe 40', 'br40', 'br 40', 'aktuelle baureihe'],
            answer: "Die <b>Baureihe 40</b> ist das aktuelle Tormodell von Hörmann. Sie zeichnet sich durch modernste Wärmedämmung (z.B. LPU 42 oder LPU 67 Thermo), patentierte Fingerklemmschutz-Technik und ein enormes Spektrum an Farben und Oberflächen aus. Ersatzteile für die Baureihe 40 sind flächendeckend und langfristig lieferbar."
        },
        {
            keywords: ['baureihe 30', 'br30', 'br 30', 'ältere baureihe'],
            answer: "Die <b>Baureihe 30</b> wurde von ca. 1986 bis 1999 gebaut. Viele Ersatzteile sind im Original nicht mehr lieferbar, wir haben jedoch hochkompatible Nachrüstsätze (z.B. für Laufrollen, Scharniere oder komplette Zugfederpakete) im System eingepflegt. Beachte bitte das Baujahr vor/nach 1999 bei Federwechseln!"
        },
        {
            keywords: ['baureihe 20', 'br20', 'br 20', 'ganz alte baureihe'],
            answer: "Die <b>Baureihe 20</b> wurde vor 1992 gebaut. Sie verwendet oft veraltete Rollenhalterungen und Scharniersysteme. In unserem Konfigurator berechnen wir automatisch spezielle Modernisierungssets, mit denen das Tor auf aktuelle Rollentechnik umgerüstet werden kann."
        },
        {
            keywords: ['silkgrain', 'oberfläche', 'glatt', 'bimetall', 'sonneneinstrahlung'],
            answer: "<b>Silkgrain</b> ist eine elegante, vollkommen glatte Oberfläche ohne Prägung. Wichtige Details für die Langlebigkeit:<br>• <i>Reinigung:</i> Verwende nur extrem weiche Mikrofasertücher. Raue Schwämme kratzen die Oberfläche sofort blind.<br>• <i>Bimetall-Effekt:</i> Bei dunklen Farben dehnen sich die Außenbleche bei starker Sonneneinstrahlung stark aus, während die Innenseite kalt bleibt. Das Paneel biegt sich durch und das Tor kann klemmen. Wähle bei extremer Sonnenlage lieber hellere Töne."
        },
        {
            keywords: ['aufmaß', 'maße', 'messen', 'lichte breite', 'lichte höhe', 'anschlag', 'laibung'],
            answer: "Für eine korrekte Torplanung benötigen wir:<br>• <b>Lichte Breite (A)</b> und <b>Lichte Höhe (B)</b> der Maueröffnung<br>• <b>Anschlag Links (C1)</b> und <b>Anschlag Rechts (C2)</b>: Platz neben der Öffnung (min. 90 mm)<br>• <b>Sturzhöhe (D)</b>: Platz von Oberkante Öffnung bis Decke<br>• <b>Garagentiefe (G)</b>: Lichte Tiefe nach hinten<br><br>Klicke unten links auf 'Hinweise zum Aufmaß' für ein verständliches Diagramm!"
        },
        {
            keywords: ['preis', 'kosten', 'kaufen', 'bestellen', 'angebot'],
            answer: "Auf dieser Webseite bieten wir einen <b>reinen Konfigurator zur Ersatzteilermittlung</b> an. Es findet <b>kein direkter Online-Verkauf</b> statt. Am Ende der Konfiguration kannst du jedoch ein strukturiertes PDF exportieren, mit dem du ein verbindliches Angebot bei einem Fachhändler anfordern kannst."
        },
        {
            keywords: ['lieferzeit', 'versand', 'dauer', 'abholung'],
            answer: "Die standardmäßige Bearbeitungs- und Lieferzeit beträgt:<br>• Kleinteile (Scharniere, Rollen, Dichtungen): ca. 2-4 Werktage<br>• Maßgeschneiderte Torsionsfedern: ca. 5-8 Werktage<br>• Einzelne Torsektionen / Paneele nach Maß: ca. 2-3 Wochen."
        },
        {
            keywords: ['hilfe', 'carl', 'wer bist du', 'hallo', 'guten tag', 'moin'],
            answer: "Hallo! Ich bin dein digitaler <b>Assistent</b>. Ich helfe dir bei allen Fragen rund um dein Garagentor, passende Ersatzteile, Einbaumaße und Beschläge. Frag mich einfach aus oder klicke auf 'Tor prüfen'!"
        }
    ];

    // Globale Zustandsvariablen für Carl
    let currentPrivacyMode = localStorage.getItem('carl_privacy_mode') || null;
    let isServerOnline = false;
    let activeChatSessionId = localStorage.getItem('carl_chat_session_id') || null; // Für Live-Support (live_chats)
    let carlLoggingSessionId = localStorage.getItem('carl_logging_session_id') || null; // Für Carl-Chat-Protokoll (carl_sessions)
    
    // Enthält die Client-seitigen Nachrichten für Option B oder vor Live-Support-Verbindung
    let localMessages = [
        {
            sender: "Carl",
            text: "Hallo! Ich bin dein digitaler <b>Assistent</b>. Ich helfe dir gerne bei Fragen zu Maßen, Baureihen und Ersatzteilen weiter.<br><br><i>Hinweis: Ich laufe aktuell in einer einfachen, datenschutzfreundlichen Offline-Lernversion. Eine leistungsstarke, vernetzte Live-Edition befindet sich in der Entwicklung und folgt in Kürze!</i><br><br>Frage mich einfach etwas oder klicke auf <b>'Tor prüfen'</b>, damit ich deine aktuelle Konfiguration analysiere!",
            timestamp: Date.now()
        }
    ];

    let liveMessages = [];
    let liveChatUnsubscribe = null;

    // Speichert den Feedback-Zustand für gerenderte Chat-Blasen
    // Key: index, Value: 'thumbs' | 'comment' | 'done'
    let feedbackStatus = {};

    // Keyword-basierter lokaler NLP Matcher
    function findFaqAnswer(userInput) {
        const cleanedInput = userInput.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ");
        const tokens = cleanedInput.split(/\s+/).filter(t => t.length > 1);

        // Prüfe auf direkte Tor-Prüfungsbefehle
        if (cleanedInput.includes('prüfen') || cleanedInput.includes('checken') || cleanedInput.includes('diagnose') || cleanedInput.includes('diagnostizieren') || cleanedInput.includes('validieren')) {
            setTimeout(() => {
                window.triggerCarlLiveDiagnosis();
            }, 300);
            return "Gerne! Ich starte die Live-Diagnose deiner aktuellen Torkonfiguration... Einen Moment bitte.";
        }

        let bestMatch = null;
        let maxScore = 0;

        for (const faq of FAQ_DATA) {
            let score = 0;
            for (const kw of faq.keywords) {
                if (cleanedInput.includes(kw)) {
                    score += 3; // Phrase-Match
                }
                for (const token of tokens) {
                    if (kw === token) {
                        score += 2; // Exakter Token-Match
                    } else if (token.includes(kw) || kw.includes(token)) {
                        score += 1; // Teilweiser Match
                    }
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestMatch = faq;
            }
        }

        if (maxScore >= 2 && bestMatch) {
            return bestMatch.answer;
        }
        return null;
    }

    // ==========================================
    // 2. PRIVATSPHÄRE & VERBINDUNGSPRÜFUNG
    // ==========================================

    /**
     * Prüft die Verbindung zum privaten KI-Server (Ollama).
     */
    window.checkKiServerStatus = async function () {
        const statusDot = document.getElementById('carlStatusDot');
        const statusText = document.getElementById('carlStatusText');
        const adminBadge = document.getElementById('carlAdminConnectionBadge');

        // Sicherheitsprüfung: Nur Verbindung zu localhost/privatem Netzwerk aufbauen,
        // wenn der Benutzer angemeldet ist (Admin/Mitarbeiter/Dev) oder eine eigene Server-URL gespeichert hat.
        // Verhindert den unschönen Chrome-Sicherheitshinweis für normale Endkunden!
        const hasCustomUrl = !!localStorage.getItem('carl_ki_server_url');
        const isAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'developer' || window.currentUserRole === 'employee';
        
        if (!hasCustomUrl && !isAdmin) {
            isServerOnline = false;
            if (statusDot) {
                statusDot.style.background = '#fb923c'; // Modernes Orange für den Offline-Modus
                statusDot.style.boxShadow = '0 0 6px #fb923c';
                statusDot.style.animation = '';
            }
            if (statusText) statusText.innerText = "Offline-Modus";
            if (adminBadge) {
                adminBadge.innerText = "Fehlgeschlagen ❌";
                adminBadge.style.color = "#ef4444";
            }
            return false;
        }

        const url = localStorage.getItem('carl_ki_server_url') || 'http://localhost:11434';

        try {
            // PING an den Ollama-Server mit kurzem Timeout (1.5 Sekunden)
            const res = await fetch(`${url}/api/tags`, { 
                method: 'GET', 
                signal: AbortSignal.timeout(1500) 
            });

            if (res.ok) {
                isServerOnline = true;
                
                // UI anpassen (Erweitert / Online)
                if (statusDot) {
                    statusDot.style.background = '#22c55e'; // Schön HSL-tailored Grün
                    statusDot.style.boxShadow = '0 0 8px #22c55e';
                    // Sanfter Puls-Effekt für Online-Modus
                    statusDot.style.animation = 'carlEyePulse 1.5s infinite alternate';
                }
                if (statusText) statusText.innerText = "Erweiterter Modus";
                if (adminBadge) {
                    adminBadge.innerText = "Verbunden ✅";
                    adminBadge.style.color = "#22c55e";
                }
                return true;
            }
        } catch (e) {
            // Server offline
        }

        isServerOnline = false;
        if (statusDot) {
            statusDot.style.background = '#fb923c'; // Modernes Orange für den einfachen Modus
            statusDot.style.boxShadow = '0 0 6px #fb923c';
            statusDot.style.animation = '';
        }
        if (statusText) statusText.innerText = "Offline-Modus";
        if (adminBadge) {
            adminBadge.innerText = "Fehlgeschlagen ❌";
            adminBadge.style.color = "#ef4444";
        }
        return false;
    };

    /**
     * Initialisiert den Datenschutz-Onboarding-Bildschirm.
     */
    function initCarlOnboarding() {
        const onboarding = document.getElementById('carlPrivacyOnboarding');
        const welcomeModeText = document.getElementById('carlWelcomeModeText');
        const currentPrivacyLabel = document.getElementById('carlCurrentPrivacyLabel');

        if (!currentPrivacyMode || (currentPrivacyMode !== 'OptionA' && currentPrivacyMode !== 'OptionB')) {
            if (onboarding) onboarding.style.display = 'flex';
        } else {
            if (onboarding) onboarding.style.display = 'none';
            
            // Welcome Text aktualisieren
            if (welcomeModeText) {
                if (currentPrivacyMode === 'OptionA') {
                    welcomeModeText.innerHTML = "🔒 <b>Option A aktiv:</b> Ihr Chatverlauf wird verschlüsselt zur Optimierung geloggt.";
                } else {
                    welcomeModeText.innerHTML = "🛡️ <b>Option B aktiv:</b> Höchste Privatsphäre. Chats verbleiben rein lokal.";
                }
            }
            if (currentPrivacyLabel) {
                currentPrivacyLabel.innerText = currentPrivacyMode === 'OptionA' ? "Option A (Verlauf speichern)" : "Option B (Streng privat)";
            }
        }
    }

    /**
     * Setzt den Datenschutz-Modus fest.
     */
    window.selectCarlPrivacyMode = async function (mode, fromModal = false) {
        currentPrivacyMode = mode;
        localStorage.setItem('carl_privacy_mode', mode);

        // UI-Elemente aktualisieren
        const onboarding = document.getElementById('carlPrivacyOnboarding');
        const modal = document.getElementById('carlPrivacySettingsModal');
        const welcomeModeText = document.getElementById('carlWelcomeModeText');
        const currentPrivacyLabel = document.getElementById('carlCurrentPrivacyLabel');

        if (onboarding) onboarding.style.display = 'none';
        if (modal) modal.style.display = 'none';

        if (welcomeModeText) {
            if (mode === 'OptionA') {
                welcomeModeText.innerHTML = "🔒 <b>Option A aktiv:</b> Ihr Chatverlauf wird verschlüsselt zur Optimierung geloggt.";
            } else {
                welcomeModeText.innerHTML = "🛡️ <b>Option B aktiv:</b> Höchste Privatsphäre. Chats verbleiben rein lokal.";
            }
        }

        if (currentPrivacyLabel) {
            currentPrivacyLabel.innerText = mode === 'OptionA' ? "Option A (Verlauf speichern)" : "Option B (Streng privat)";
        }

        // Falls Option A gewählt wurde und noch keine Carl-Protokoll-Session-ID existiert, Firestore-Chatsession starten
        if (mode === 'OptionA' && !carlLoggingSessionId) {
            const chatHistoryForDb = localMessages.map(msg => ({
                sender: msg.sender,
                text: msg.text,
                timestamp: msg.timestamp || Date.now()
            }));
            const sid = await window.saveCarlSession(null, chatHistoryForDb, 'OptionA');
            if (sid) {
                carlLoggingSessionId = sid;
                localStorage.setItem('carl_logging_session_id', sid);
            }
        } else if (mode === 'OptionB') {
            // Falls von A nach B gewechselt wurde, bestehende Protokoll-Session löschen
            if (carlLoggingSessionId) {
                localStorage.removeItem('carl_logging_session_id');
                carlLoggingSessionId = null;
            }
        }

        renderCarlChatHistory();
    };

    /**
     * Toggelt das Datenschutz-Einstellungsmodal.
     */
    window.toggleCarlPrivacySettings = function () {
        const modal = document.getElementById('carlPrivacySettingsModal');
        if (!modal) return;

        if (modal.style.display === 'none' || modal.style.display === '') {
            modal.style.display = 'flex';
            // Aktuellen Modus im Modal anzeigen
            const label = document.getElementById('carlCurrentPrivacyLabel');
            if (label) {
                label.innerText = currentPrivacyMode === 'OptionA' ? "Option A (Verlauf speichern)" : "Option B (Streng privat)";
            }
        } else {
            modal.style.display = 'none';
        }
    };

    // ==========================================
    // 3. ANTWORT-FEEDBACK SYSTEM (👍 / 👎)
    // ==========================================

    /**
     * Behandelt Klicks auf 👍 oder 👎 bei einer Carl-Antwort.
     */
    window.handleCarlMessageFeedback = async function (msgIndex, isPositive) {
        if (isPositive) {
            feedbackStatus[msgIndex] = 'positive_comment';
            renderCarlChatHistory();
        } else {
            // Bei 👎 öffnen wir ein Eingabefeld für Kritik direkt unter der Blase
            feedbackStatus[msgIndex] = 'comment';
            renderCarlChatHistory();
        }
    };

    /**
     * Sendet das ausformulierte 👍/👎 Feedback-Ticket ab.
     */
    window.submitCarlFeedback = async function (msgIndex, isPositive = false) {
        const messages = activeChatSessionId ? liveMessages : localMessages;
        const wrongMsg = messages[msgIndex];
        const userMsg = msgIndex > 0 ? messages[msgIndex - 1] : { text: "Keine Frage vorhanden" };

        const inputNode = document.getElementById(`carlFeedbackInput_${msgIndex}`);
        const comment = inputNode ? inputNode.value.trim() : "";

        // Letzte 5 Nachrichten als Kontext extrahieren
        const startIndex = Math.max(0, msgIndex - 4);
        const contextSlice = messages.slice(startIndex, msgIndex + 1).map(m => ({
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp || Date.now()
        }));

        const feedbackData = {
            sessionId: activeChatSessionId || carlLoggingSessionId || "OptionB-Local",
            userQuery: userMsg.text,
            carlAnswer: wrongMsg.text,
            comment: comment || (isPositive ? "Positives Feedback ohne Kommentar" : "Negatives Feedback ohne Kommentar"),
            type: isPositive ? 'positive' : 'negative',
            contextMessages: contextSlice
        };

        // Ticket verschlüsselt an Firestore senden (carl_feedbacks)
        await window.saveCarlFeedback(feedbackData);

        // Feedback-Zustand auf 'done' setzen
        feedbackStatus[msgIndex] = 'done';

        if (currentPrivacyMode === 'OptionA' && carlLoggingSessionId && !activeChatSessionId) {
            wrongMsg.feedback = isPositive ? 'positive' : 'negative';
            await window.saveCarlSession(carlLoggingSessionId, localMessages, 'OptionA');
        } else if (activeChatSessionId) {
            wrongMsg.feedback = isPositive ? 'positive' : 'negative';
            if (window.updateLiveChatSessionMessages) {
                await window.updateLiveChatSessionMessages(activeChatSessionId, liveMessages);
            }
        }

        renderCarlChatHistory();
    };

    // ==========================================
    // 4. CHAT-WIDGET RENDERING & CHAT-LOGIK
    // ==========================================

    // Rendert den kompletten Chatverlauf mitsamt Feedback-Modulen
    function renderCarlChatHistory() {
        const historyContainer = document.getElementById('carlChatHistory');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';
        const messages = activeChatSessionId ? liveMessages : localMessages;

        messages.forEach((msg, index) => {
            const bubble = document.createElement('div');
            bubble.className = `carl-msg ${msg.sender.toLowerCase()}`;

            let authorName = msg.sender;
            if (msg.sender === "Kunde") {
                authorName = "Du";
            }

            if (msg.sender !== "System") {
                bubble.innerHTML = `<span class="carl-msg-author">${authorName}</span>${msg.text}`;
                
                // Falls Nachricht von Carl stammt und nicht die Schreib-Animation ist, Feedback hinzufügen
                if (msg.sender === "Carl" && index > 0 && msg.text !== "Carl schreibt...") {
                    const status = feedbackStatus[index] || 'thumbs';
                    
                    if (status === 'thumbs') {
                        // Daumen hoch & runter Buttons
                        const fbRow = document.createElement('div');
                        fbRow.style.cssText = "margin-top: 8px; display: flex; gap: 8px; justify-content: flex-end; align-items: center; opacity: 0.8;";
                        fbRow.innerHTML = `
                            <button onclick="window.handleCarlMessageFeedback(${index}, true)" style="background:none; border:none; cursor:pointer; font-size:0.85rem; padding: 2px;" title="Hilfreich">👍</button>
                            <button onclick="window.handleCarlMessageFeedback(${index}, false)" style="background:none; border:none; cursor:pointer; font-size:0.85rem; padding: 2px;" title="Falsche Antwort">👎</button>
                        `;
                        bubble.appendChild(fbRow);
                    } else if (status === 'comment') {
                        // Kritik-Eingabe
                        const commentBox = document.createElement('div');
                        commentBox.style.cssText = "margin-top: 8px; display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); box-sizing: border-box;";
                        commentBox.innerHTML = `
                            <span style="font-size: 0.7rem; color: rgba(255,255,255,0.9); font-weight: bold; display:block;">Warum war die Antwort ungenau? (optional)</span>
                            <div style="display:flex; gap:6px;">
                                <input type="text" id="carlFeedbackInput_${index}" placeholder="z.B. Antwort war veraltet..." style="flex:1; font-size:0.75rem; padding: 4px 6px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: rgba(0,0,0,0.15); color:white; outline:none; box-sizing: border-box;">
                                <button onclick="window.submitCarlFeedback(${index}, false)" style="background:white; color:#6d28d9; border:none; border-radius:4px; padding:2px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">Senden</button>
                            </div>
                        `;
                        bubble.appendChild(commentBox);
                    } else if (status === 'positive_comment') {
                        // Lob-Eingabe
                        const commentBox = document.createElement('div');
                        commentBox.style.cssText = "margin-top: 8px; display: flex; flex-direction: column; gap: 6px; background: rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3); box-sizing: border-box;";
                        commentBox.innerHTML = `
                            <span style="font-size: 0.7rem; color: rgba(255,255,255,0.9); font-weight: bold; display:block;">Was hat dir besonders geholfen? (optional)</span>
                            <div style="display:flex; gap:6px;">
                                <input type="text" id="carlFeedbackInput_${index}" placeholder="z.B. Super schnelle Antwort!..." style="flex:1; font-size:0.75rem; padding: 4px 6px; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; background: rgba(0,0,0,0.15); color:white; outline:none; box-sizing: border-box;">
                                <button onclick="window.submitCarlFeedback(${index}, true)" style="background:#10b981; color:white; border:none; border-radius:4px; padding:2px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">Senden</button>
                            </div>
                        `;
                        bubble.appendChild(commentBox);
                    } else if (status === 'done') {
                        // Danke-Meldung
                        const doneText = document.createElement('div');
                        doneText.style.cssText = "margin-top: 6px; font-size: 0.7rem; text-align: right; font-style: italic; opacity: 0.75;";
                        doneText.innerHTML = "✓ Feedback übermittelt. Vielen Dank!";
                        bubble.appendChild(doneText);
                    }
                }
            } else {
                bubble.innerHTML = msg.text;
            }

            historyContainer.appendChild(bubble);
        });

        // Automatisch nach unten scrollen
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }

    // Toggle das Chat-Panel (Ein-/Ausklappen)
    window.toggleCarlChatPanel = () => {
        const panel = document.getElementById('carlChatPanel');
        if (!panel) return;

        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'flex';
            // Clear unread count badge
            const badge = document.getElementById('carlUnreadBadge');
            if (badge) {
                badge.innerText = '0';
                badge.style.display = 'none';
            }
            renderCarlChatHistory();
            window.checkKiServerStatus(); // Verbindungsprüfung direkt triggern

            // Blinzel-Effekte der Augen starten
            const eyeLeft = document.getElementById('carlEyeLeft');
            const eyeRight = document.getElementById('carlEyeRight');
            if (eyeLeft) eyeLeft.style.animation = 'carlEyePulse 1s infinite alternate';
            if (eyeRight) eyeRight.style.animation = 'carlEyePulse 1s infinite alternate';
        } else {
            panel.style.display = 'none';

            // Animation ausschalten
            const eyeLeft = document.getElementById('carlEyeLeft');
            const eyeRight = document.getElementById('carlEyeRight');
            if (eyeLeft) eyeLeft.style.animation = '';
            if (eyeRight) eyeRight.style.animation = '';
        }
    };

    window.closeCarlChatPanel = () => {
        const panel = document.getElementById('carlChatPanel');
        if (panel) {
            panel.style.display = 'none';
            const eyeLeft = document.getElementById('carlEyeLeft');
            const eyeRight = document.getElementById('carlEyeRight');
            if (eyeLeft) eyeLeft.style.animation = '';
            if (eyeRight) eyeRight.style.animation = '';
        }
    };

    // Helper für Offline-Fallbacks und einfaches RAG offline
    function getOfflineCarlResponse(text, ragChunks) {
        // Falls RAG im Offline-Modus etwas hochrelevantes findet (Score > 0.22)
        if (ragChunks && ragChunks.length > 0 && ragChunks[0].score > 0.22) {
            const best = ragChunks[0];
            return `Hier ist ein passender Auszug aus unseren importierten Dokumenten (lokaler Abgleich):<br><br><i>"${best.text}"</i><br><br><small style="color: rgba(255, 255, 255, 0.75); display: block; margin-top: 4px;">ℹ️ [Einfacher Modus] Ich laufe gerade offline. Die KI-Serververbindung ist nicht aktiv.</small>`;
        }

        // Normaler FAQ Matcher
        const answer = findFaqAnswer(text);
        if (answer) {
            return answer + `<br><br><small style="color: rgba(255, 255, 255, 0.75); display: block; margin-top: 4px;">ℹ️ [Einfacher Modus] Ich laufe gerade offline und greife auf meine Standard-FAQ zu.</small>`;
        }

        return "Das habe ich im einfachen Offline-Modus leider nicht verstanden. Ich bin ein 100% lokaler Assistent. Du kannst deine Frage anders formulieren oder links unten auf 💬 <b>'Sascha rufen'</b> klicken, um einen Mitarbeiter hinzuzuziehen!";
    }

    // Sendet Kunden-Nachricht ab
    window.sendCarlMessage = async () => {
        const inputNode = document.getElementById('carlChatInput');
        if (!inputNode) return;

        const text = inputNode.value.trim();
        if (!text) return;

        inputNode.value = '';

        if (activeChatSessionId) {
            // Live-Support-Modus: Nachricht direkt in Firestore schreiben
            await window.sendChatMessageToSession(activeChatSessionId, "Kunde", text);
        } else {
            // Offline-Modus / Option B / Option A Carl: Lokale FAQs, Dokumenten-Wissen & Ollama prüfen
            localMessages.push({
                sender: "Kunde",
                text: text,
                timestamp: Date.now()
            });

            // Falls Option A aktiv ist, sofort in Firestore-Carl-Session loggen
            if (currentPrivacyMode === 'OptionA') {
                if (!carlLoggingSessionId) {
                    const sid = await window.saveCarlSession(null, localMessages, 'OptionA');
                    if (sid) {
                        carlLoggingSessionId = sid;
                        localStorage.setItem('carl_logging_session_id', sid);
                    }
                } else {
                    await window.saveCarlSession(carlLoggingSessionId, localMessages, 'OptionA');
                }
            }

            renderCarlChatHistory();

            // Roboterkopf kurz animieren
            const carlHead = document.getElementById('carlHead');
            if (carlHead) {
                carlHead.classList.add('carl-active');
            }

            // Lokales Dokumentenwissen durchsuchen (RAG)
            const ragChunks = window.searchCarlKnowledge ? window.searchCarlKnowledge(text, 3) : [];

            // Prüfen ob Ollama online ist
            if (isServerOnline) {
                // Schreibindikator rendern
                localMessages.push({
                    sender: "Carl",
                    text: "Carl schreibt...",
                    timestamp: Date.now()
                });
                renderCarlChatHistory();

                const serverUrl = localStorage.getItem('carl_ki_server_url') || 'http://localhost:11434';
                const serverToken = localStorage.getItem('carl_ki_server_token') || '';
                
                // Prompt vorbereiten mit System-Prompt & RAG-Kontext
                let contextString = "";
                if (ragChunks.length > 0) {
                    contextString = "\nZusätzliches Fachwissen aus importierten Hörmann-Dokumenten:\n" + 
                                    ragChunks.map(c => `[Dokument: ${c.source}]\n${c.text}`).join('\n\n') + "\n\n";
                }

                const systemPrompt = `Du bist Carl, ein hilfsbereiter, technischer KI-Assistent für Saschas Torkonfigurator.
Du hilfst Kunden bei Fragen zu Garagentoren, Aufmaßen, Montage und Ersatzteilen von Hörmann.
Deine Antworten sind freundlich, präzise, professionell und auf Deutsch.
Nutze HTML-Tags wie <b>, <i>, <ul>, <li>, <br> zur Gliederung deiner Antworten. Halte dich kurz und prägnant.

${contextString}Beantworte die Kundenfrage so präzise wie möglich unter Berücksichtigung dieses Kontextes. Wenn das Dokumenten-Wissen nicht ausreicht, antworte nach bestem Wissen zu Hörmann-Toren, aber verweise darauf, wenn du unsicher bist. Erfinde niemals Daten.`;

                // Letzte paar Nachrichten als Verlauf packen für Gesprächs-Memory (max 5)
                let memoryPrompt = "";
                const hist = localMessages.slice(-7, -1); // Letzten Nachrichten vor 'Carl schreibt...'
                hist.forEach(h => {
                    if (h.text !== "Carl schreibt...") {
                        memoryPrompt += `${h.sender === 'Kunde' ? 'User' : 'Assistant'}: ${h.text}\n`;
                    }
                });

                const finalPrompt = `${systemPrompt}\n\nChat-Verlauf:\n${memoryPrompt}User: ${text}\nAssistant:`;

                try {
                    const headers = { 'Content-Type': 'application/json' };
                    if (serverToken) {
                        headers['Authorization'] = `Bearer ${serverToken}`;
                    }

                    const response = await fetch(`${serverUrl}/api/generate`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            model: 'llama3.2',
                            prompt: finalPrompt,
                            stream: false
                        }),
                        signal: AbortSignal.timeout(12000) // 12 Sekunden Timeout
                    });

                    if (!response.ok) throw new Error("HTTP Fehler " + response.status);
                    
                    const data = await response.json();
                    let aiReply = data.response.trim();

                    // Schreib-Platzhalter entfernen
                    localMessages = localMessages.filter(m => m.text !== "Carl schreibt...");
                    
                    localMessages.push({
                        sender: "Carl",
                        text: aiReply,
                        timestamp: Date.now()
                    });

                } catch (err) {
                    console.error("Fehler beim Ollama-KI-Aufruf:", err);
                    
                    // Fallback bei Timeout/Netzwerkfehler auf lokalen FAQ/RAG Abgleich
                    localMessages = localMessages.filter(m => m.text !== "Carl schreibt...");
                    const fallbackReply = getOfflineCarlResponse(text, ragChunks);
                    localMessages.push({
                        sender: "Carl",
                        text: fallbackReply + "<br><br><small style='color:#ef4444;'>⚠️ [Verbindungsfehler] Anfrage an KI-Server fehlgeschlagen. Lokales Fallback genutzt.</small>",
                        timestamp: Date.now()
                    });
                }
            } else {
                // Komplett Offline: Direktes rule-based NLP FAQ & Offline-RAG
                setTimeout(() => {
                    const reply = getOfflineCarlResponse(text, ragChunks);
                    localMessages.push({
                        sender: "Carl",
                        text: reply,
                        timestamp: Date.now()
                    });
                    renderCarlChatHistory();
                }, 400);
            }

            // Sync, falls Option A aktiv ist
            if (currentPrivacyMode === 'OptionA' && carlLoggingSessionId) {
                await window.saveCarlSession(carlLoggingSessionId, localMessages, 'OptionA');
            }

            renderCarlChatHistory();

            if (carlHead) {
                carlHead.classList.remove('carl-active');
            }
        }
    };

    // Schnell-Fragen per Buttons abschicken
    window.sendCarlQuickQuestion = (text) => {
        const inputNode = document.getElementById('carlChatInput');
        if (inputNode) {
            inputNode.value = text;
            window.sendCarlMessage();
        }
    };

    // Tastatursteuerung für Kunden-Eingabefeld
    window.handleCarlInputKey = (event) => {
        if (event.key === 'Enter') {
            window.sendCarlMessage();
        }
    };

    // Führt eine physikalische Tor-Diagnose basierend auf aktuellen Einstellungen aus
    window.triggerCarlLiveDiagnosis = () => {
        const wNode = document.getElementById('inputWidth');
        const hNode = document.getElementById('inputHeight');
        const w = wNode ? parseInt(wNode.value) || 2500 : 2500;
        const h = hNode ? parseInt(hNode.value) || 2125 : 2125;

        const series = typeof currentSeries !== 'undefined' ? currentSeries : 'BR40';
        const fitLeft = typeof currentFittingLeft !== 'undefined' ? currentFittingLeft : 'Z';
        const fitRight = typeof currentFittingRight !== 'undefined' ? currentFittingRight : 'Z';

        const surfaceNode = document.getElementById('lamOberflaeche');
        const surface = surfaceNode ? surfaceNode.value : '';

        // Prüfe Deckensturz aus Aufmaß
        const sturzNode = document.getElementById('quick_aufmassD');
        const hasSturz = sturzNode && sturzNode.value !== '';
        const sturz = hasSturz ? parseInt(sturzNode.value) : 0;

        let diagnostics = [];
        let isSafe = true;

        diagnostics.push(`🔍 <b>Live-Diagnose deiner Torkonfiguration:</b>`);
        diagnostics.push(`• Gewählte Maße: ${w} mm Breite x ${h} mm Höhe`);
        diagnostics.push(`• Gewählter Beschlag: Links ${fitLeft}-Beschlag, Rechts ${fitRight}-Beschlag`);
        if (surface) {
            diagnostics.push(`• Paneel-Oberfläche: ${surface}`);
        }
        if (hasSturz) {
            diagnostics.push(`• Eingegebene Sturzhöhe (D): ${sturz} mm`);
        }

        // 1. Z-Beschlag Breitenprüfung
        if ((fitLeft === 'Z' || fitRight === 'Z') && w > 4000) {
            isSafe = false;
            diagnostics.push(`⚠️ <b>Achtung (Sicherheitsrisiko):</b> Ein Zugfedersystem (Z-Beschlag) ist für Torbreiten über 4000 mm nicht zugelassen oder konstruktiv unsicher. Ich empfehle dringend einen Torsionsfederbeschlag (N- oder L-Beschlag)!`);
        } else if ((fitLeft === 'Z' || fitRight === 'Z') && w > 3000) {
            diagnostics.push(`ℹ️ <b>Hinweis:</b> Bei Breiten über 3000 mm wird das Torgewicht hoch. Ein Zugfedersystem stößt hier oft an seine Grenzen.`);
        }

        // 2. Sturzhöhen-Kompatibilität bei eingetragenem Sturz
        if (hasSturz) {
            if (fitLeft === 'Z' && fitRight === 'Z') {
                if (sturz < 100) {
                    isSafe = false;
                    diagnostics.push(`❌ <b>Einbaufehler (Sturz):</b> Dein eingetragener Sturz von ${sturz} mm reicht nicht aus. Der Z-Beschlag benötigt mindestens <b>100 mm Sturzhöhe</b>! Das Tor kann so nicht eingebaut werden.`);
                } else {
                    diagnostics.push(`✅ <b>Sturzhöhe ausreichend:</b> Deine ${sturz} mm reichen für den Z-Beschlag (min. 100 mm benötigt) aus.`);
                }
            } else if (fitLeft === 'N' && fitRight === 'N') {
                if (sturz < 210) {
                    isSafe = false;
                    diagnostics.push(`❌ <b>Einbaufehler (Sturz):</b> Der N-Beschlag (Normalbeschlag) benötigt mindestens <b>210 mm Sturzhöhe</b>. Dein Sturz beträgt nur ${sturz} mm. Wechsle bitte auf einen Z-Beschlag (min. 100 mm) oder einen L-Beschlag (min. 115 mm).`);
                } else {
                    diagnostics.push(`✅ <b>Sturzhöhe ausreichend:</b> Deine ${sturz} mm reichen für den N-Beschlag (min. 210 mm benötigt) perfekt aus.`);
                }
            } else if (fitLeft === 'L' && fitRight === 'L') {
                if (sturz < 115) {
                    isSafe = false;
                    diagnostics.push(`❌ <b>Einbaufehler (Sturz):</b> Der L-Beschlag (Niedrigsturz) benötigt mindestens <b>115 mm Sturzhöhe</b>. Deine eingetragenen ${sturz} mm sind zu gering.`);
                } else {
                    diagnostics.push(`✅ <b>Sturzhöhe ausreichend:</b> Deine ${sturz} mm reichen für den L-Beschlag (min. 115 mm benötigt) aus.`);
                }
            }
        } else {
            diagnostics.push(`💡 <i>Tipp: Trage unter 'Aufmaß-Pilot' den Deckensturz (D) ein, damit ich prüfen kann, ob dein gewählter Beschlag passt!</i>`);
        }

        // 3. Oberflächen-Bimetall-Warnung
        if (surface && surface.toLowerCase().includes('silkgrain')) {
            diagnostics.push(`✨ <b>Oberflächen-Tipp:</b> Silkgrain ist extrem edel und glatt. Achte bei der Montage darauf, Paneele nicht mit rauen Werkzeugen zu berühren. Bei dunkler Lackierung auf der Südseite der Garage kann sich das Tor bei direkter Sonne durch den Bimetall-Effekt wölben.`);
        }

        // 4. Baureihen-Spezifika
        if (series === 'BR30') {
            diagnostics.push(`⚙️ <b>Baureihe 30:</b> Für den Federwechsel ist das Baujahr vor/nach 1999 wichtig, da sich die Wellendurchmesser und Feder-Arretierungen dort grundlegend geändert haben.`);
        } else if (series === 'BR20') {
            diagnostics.push(`🔧 <b>Baureihe 20:</b> Viele Scharniere und Rollenhalter sind veraltet. Der Konfigurator fügt bei Scharnierauswahl automatisch unsere Modernisierungs-Kits hinzu.`);
        }

        if (isSafe) {
            diagnostics.push(`🏁 <b>Fazit:</b> Deine konfigurierten Werte sehen sehr schlüssig aus! Das Tor ist in dieser Konstellation montierbar.`);
        } else {
            diagnostics.push(`🛑 <b>Fazit:</b> Ich habe kritische Inkompatibilitäten festgestellt. Bitte korrigiere die Maße oder die Beschlagsart.`);
        }

        appendCarlMessage("Carl", diagnostics.join('<br><br>'));
    };

    // Eskaliert das Gespräch an Sascha per Firebase
    window.requestSaschaHelp = async () => {
        // Sicherheitsfrage vor der Eskalation
        const confirmEscalate = confirm("Sascha rufen: Möchten Sie wirklich einen Live-Mitarbeiter (Sascha) hinzurufen? Ihr bisheriger Chatverlauf wird an Sascha übertragen, damit er Ihnen optimal helfen kann.");
        if (!confirmEscalate) return;

        // Falls wir in Option B sind, müssen wir den Kunden informieren, dass zur Live-Hilfe ein Firebase-Chat erstellt wird
        if (currentPrivacyMode === 'OptionB') {
            const ok = confirm("Hinweis: Da Sie den Modus 'Streng privat' gewählt haben, wird zur Kontaktaufnahme mit Sascha nun ein temporärer Live-Supportkanal geöffnet und Ihr Gespräch verschlüsselt übertragen. Möchten Sie fortfahren?");
            if (!ok) return;
        }

        if (activeChatSessionId && liveMessages.length > 0) {
            alert("Du bist bereits mit dem Live-Support verbunden.");
            return;
        }

        const btnEscalate = document.querySelector('.carl-escalate-btn');
        if (btnEscalate) {
            btnEscalate.disabled = true;
            btnEscalate.innerText = "⏳ Sascha rufen...";
        }

        // Ermittle aktuelle Dimensionen für das Admin-Dashboard
        const wNode = document.getElementById('inputWidth');
        const hNode = document.getElementById('inputHeight');
        const w = wNode ? parseInt(wNode.value) || 2500 : 2500;
        const h = hNode ? parseInt(hNode.value) || 2125 : 2125;
        const series = typeof currentSeries !== 'undefined' ? currentSeries : 'BR40';
        const fitLeft = typeof currentFittingLeft !== 'undefined' ? currentFittingLeft : 'Z';
        const fitRight = typeof currentFittingRight !== 'undefined' ? currentFittingRight : 'Z';
        const surface = document.getElementById('lamOberflaeche')?.value || 'Standard';
        const sturz = parseInt(document.getElementById('quick_aufmassD')?.value) || 0;

        const dimensions = {
            series: series,
            width: w,
            height: h,
            fittingLeft: fitLeft,
            fittingRight: fitRight,
            surface: surface,
            headroom: sturz
        };

        // Finde die letzte Frage des Kunden als Kontext
        let lastUserQuestion = "Kunde bittet um Live-Hilfe.";
        for (let i = localMessages.length - 1; i >= 0; i--) {
            if (localMessages[i].sender === "Kunde") {
                lastUserQuestion = localMessages[i].text;
                break;
            }
        }

        // Automatische, präzise Zusammenfassung für den Admin
        const summary = `Hilfe bei BR ${series.replace('BR', '')} | Maße: ${w}x${h} mm | Beschlag: ${fitLeft}/${fitRight} | Letzte Frage: "${lastUserQuestion}"`;

        // Konvertiere die lokale Historie für Firestore
        const chatHistoryForDb = localMessages.map(msg => ({
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp || Date.now()
        }));

        // Systemnachricht anhängen
        chatHistoryForDb.push({
            sender: "System",
            text: `${window.currentUserFirstName || "Kunde"} wartet auf Sascha...`,
            timestamp: Date.now()
        });

        // Session erstellen
        const sessionId = await window.createLiveChatSession(chatHistoryForDb, dimensions, summary);

        if (sessionId) {
            activeChatSessionId = sessionId;
            localStorage.setItem('carl_chat_session_id', sessionId);
            connectToLiveChatStream(sessionId);
        } else {
            if (btnEscalate) {
                btnEscalate.disabled = false;
                btnEscalate.innerText = "💬 Sascha rufen";
            }
            alert("Verbindung fehlgeschlagen. Bitte versuche es später noch einmal.");
        }
    };

    // Verbindet den Kunden-Chat in Echtzeit mit Firestore
    function connectToLiveChatStream(chatId) {
        activeChatSessionId = chatId;
        localStorage.setItem('carl_chat_session_id', chatId);

        // Escalate Area auf "Live" umschalten mit Beenden-Button
        const escalateArea = document.getElementById('carlEscalateArea');
        if (escalateArea) {
            escalateArea.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px; box-sizing:border-box;">
                    <span style="color: #6d28d9; font-weight: bold; font-size: 0.85rem;">💬 Live mit Support verbunden</span>
                    <button onclick="window.cancelLiveSupportFromUser()" style="background:#ef4444; color:white; border:none; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer;" class="carl-cancel-live-btn">Beenden</button>
                </div>
            `;
        }

        // Unsubscribe falls bereits vorhanden
        if (liveChatUnsubscribe) {
            liveChatUnsubscribe();
        }

        let isInitialSnapshot = true;

        // Firestore Stream abhören
        liveChatUnsubscribe = window.listenToLiveChatSession(chatId, (data) => {
            if (!data) return;

            const oldMessagesLength = liveMessages.length;
            liveMessages = data.messages || [];

            // NEU: Unread-Badge für den minimierten Chat aktualisieren
            const panel = document.getElementById('carlChatPanel');
            const isClosed = !panel || panel.style.display === 'none' || panel.style.display === '';
            if (!isInitialSnapshot && isClosed && liveMessages.length > oldMessagesLength) {
                const newMsgs = liveMessages.slice(oldMessagesLength);
                const hasSupportMsg = newMsgs.some(m => m.sender !== 'Kunde' && m.sender !== 'System');
                if (hasSupportMsg) {
                    const unreadCount = newMsgs.filter(m => m.sender !== 'Kunde' && m.sender !== 'System').length;
                    const badge = document.getElementById('carlUnreadBadge');
                    if (badge) {
                        const currentVal = parseInt(badge.innerText) || 0;
                        badge.innerText = currentVal + unreadCount;
                        badge.style.display = 'flex';
                    }
                }
            }

            // UI-Header aktualisieren
            const statusText = document.getElementById('carlStatusText');
            const statusDot = document.getElementById('carlStatusDot');
            const headerTitle = document.querySelector('.carl-chat-header strong');

            if (data.status === 'active') {
                if (statusText) statusText.innerText = "Sascha (Live)";
                if (statusDot) {
                    statusDot.style.background = '#22c55e';
                    statusDot.style.boxShadow = '0 0 6px #22c55e';
                }
                if (headerTitle) headerTitle.innerText = "Sascha (Live)";

                // Falls Sascha gerade übernommen hat und der Kunde noch keine Abschiedsinfo von Carl bekommen hat:
                const hasTakeoverMessage = liveMessages.some(m => m.sender === 'System' && m.text.includes('übernimmt'));
                const localGoodbyeRendered = localMessages.some(m => m.text.includes('Ich übergebe dich jetzt'));
                
                if (hasTakeoverMessage && !localGoodbyeRendered && oldMessagesLength > 0 && liveMessages.length > oldMessagesLength) {
                    // Füge einen charmanten Übergang hinzu
                    const lastMsg = liveMessages[liveMessages.length - 1];
                    if (lastMsg.sender === 'System') {
                        // Carl verabschiedet sich
                        liveMessages.splice(liveMessages.length - 1, 0, {
                            sender: "Carl",
                            text: "Ich übergebe dich jetzt an <b>Sascha</b>. Er ist ab sofort für dich da! 💬",
                            timestamp: Date.now() - 10
                        });
                    }
                }
            } else if (data.status === 'waiting') {
                if (statusText) statusText.innerText = "Sascha rufen...";
                if (statusDot) {
                    statusDot.style.background = '#fbbf24';
                    statusDot.style.boxShadow = '0 0 6px #fbbf24';
                }
                if (headerTitle) headerTitle.innerText = "KI-Assistent";
            } else if (data.status === 'closed') {
                if (statusText) statusText.innerText = "Beendet";
                if (statusDot) {
                    statusDot.style.background = '#6b7280';
                    statusDot.style.boxShadow = 'none';
                }
                if (headerTitle) headerTitle.innerText = "KI-Assistent";

                // Sperre die Eingaben und den Sende-Button
                const inputNode = document.getElementById('carlChatInput');
                if (inputNode) {
                    inputNode.disabled = true;
                    inputNode.placeholder = "Live-Support beendet.";
                }
                const sendBtnNode = document.getElementById('btnSendCarlMessage');
                if (sendBtnNode) {
                    sendBtnNode.disabled = true;
                }

                // Escalate Area zeigt den Zurück zu Carl Button
                if (escalateArea) {
                    escalateArea.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px; box-sizing:border-box;">
                            <span style="color: #6b7280; font-size: 0.8rem; font-weight: bold;">Sitzung beendet</span>
                            <button onclick="window.resetToCarlAssistant()" style="background:#6d28d9; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer;" class="carl-reset-btn">Zurück zu Carl</button>
                        </div>
                    `;
                }
            }

            renderCarlChatHistory();
            isInitialSnapshot = false;
        });
    }

    // Ermöglicht dem Kunden, die Support-Sitzung selbst zu beenden
    window.cancelLiveSupportFromUser = async () => {
        if (confirm("Möchten Sie die Live-Support-Sitzung wirklich beenden?")) {
            if (activeChatSessionId) {
                const chatId = activeChatSessionId;
                await window.closeLiveChatSession(chatId);
            }
        }
    };

    // Kehrt vom geschlossenen Support-Modus sauber zu Carl (Bot) zurück
    window.resetToCarlAssistant = () => {
        localStorage.removeItem('carl_chat_session_id');
        activeChatSessionId = null;
        liveMessages = [];
        if (liveChatUnsubscribe) {
            liveChatUnsubscribe();
            liveChatUnsubscribe = null;
        }

        // Eingabefeld & Sende-Button wieder freigeben
        const inputNode = document.getElementById('carlChatInput');
        if (inputNode) {
            inputNode.disabled = false;
            inputNode.placeholder = "Frage eingeben...";
        }
        const sendBtnNode = document.getElementById('btnSendCarlMessage');
        if (sendBtnNode) {
            sendBtnNode.disabled = false;
        }

        // Escalate-Bereich zurücksetzen
        const escalateArea = document.getElementById('carlEscalateArea');
        if (escalateArea) {
            escalateArea.innerHTML = `
                <span>Kommt der Assistent nicht weiter?</span>
                <button onclick="requestSaschaHelp()" class="carl-escalate-btn">💬 Sascha rufen</button>
            `;
        }

        // Status zurücksetzen und Verbindung prüfen
        window.checkKiServerStatus();

        renderCarlChatHistory();
    };

    // ==========================================
    // 5. ADMIN / EMPLOYEE CHAT-OVERRIDE CONTROLLERS
    // ==========================================

    window.selectedChatId = null;
    let adminChatUnsubscribe = null;

    // Rendert die Liste der wartenden & aktiven Chats in der linken Spalte
    window.renderLiveChatsList = (chats) => {
        const listContainer = document.getElementById('liveChatsList');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (chats.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; color: #999; padding: 30px 10px; font-style: italic; font-size: 0.85rem;">
                    Keine aktiven Live-Chats vorhanden.
                </div>
            `;
            return;
        }

        chats.forEach(chat => {
            const card = document.createElement('div');
            card.setAttribute('data-chat-id', chat.id);
            
            // Stylen der Karte
            card.style.padding = '12px 14px';
            card.style.background = 'white';
            card.style.border = chat.id === window.selectedChatId ? '2px solid var(--hormann-blue)' : '1px solid #e2e8f0';
            card.style.borderRadius = '8px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s ease';
            card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '4px';

            card.onmouseover = () => {
                if (chat.id !== window.selectedChatId) card.style.borderColor = '#cbd5e1';
            };
            card.onmouseout = () => {
                if (chat.id !== window.selectedChatId) card.style.borderColor = '#e2e8f0';
            };

            card.onclick = () => {
                window.selectActiveChat(chat.id);
            };

            const isWaiting = chat.status === 'waiting';
            const badgeColor = isWaiting ? '#fbbf24' : '#10b981';
            const badgeText = isWaiting ? 'Wartend' : 'Aktiv';

            const displayName = (chat.customerName && chat.customerName !== 'undefined' && chat.customerName !== 'null') ? chat.customerName : "Gast";
            const displayEmail = (chat.customerEmail && chat.customerEmail !== 'undefined' && chat.customerEmail !== 'null') ? chat.customerEmail : "Gast-Sitzung";
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 0.9rem; color: #1e293b;">${displayName}</strong>
                    <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${badgeText}
                    </span>
                </div>
                <div style="font-size: 0.75rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">
                    ${displayEmail}
                </div>
                <div style="font-size: 0.8rem; color: #475569; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${chat.summary || 'Keine Zusammenfassung.'}
                </div>
            `;

            listContainer.appendChild(card);
        });
    };

    // Wählt einen Chat aus und abonniert den Verlauf in Echtzeit
    window.selectActiveChat = (chatId) => {
        window.selectedChatId = chatId;

        // Triggert den Listener NICHT neu (Spares performance & Firestore reads).
        // Stattdessen selektieren wir direkt die DOM-Karten und passen die Ränder an:
        const listContainer = document.getElementById('liveChatsList');
        if (listContainer) {
            const cards = listContainer.querySelectorAll('div[data-chat-id]');
            cards.forEach(card => {
                const cid = card.getAttribute('data-chat-id');
                if (cid === chatId) {
                    card.style.border = '2px solid var(--hormann-blue)';
                } else {
                    card.style.border = '1px solid #e2e8f0';
                }
            });
        }

        const noChatMsg = document.getElementById('noChatSelectedMessage');
        const chatWindow = document.getElementById('activeChatWindow');

        if (noChatMsg) noChatMsg.style.display = 'none';
        if (chatWindow) chatWindow.style.display = 'flex';

        // Alten Stream beenden
        if (adminChatUnsubscribe) {
            adminChatUnsubscribe();
        }

        // Live Firestore Stream abonnieren
        adminChatUnsubscribe = window.listenToLiveChatSession(chatId, (data) => {
            if (!data) return;

            // Name und Maße im Header ausgeben
            const headerName = document.getElementById('activeChatHeaderName');
            const headerDetails = document.getElementById('activeChatHeaderDetails');

            if (headerName) {
                const displayName = (data.customerName && data.customerName !== 'undefined' && data.customerName !== 'null') ? data.customerName : "Gast";
                const displayEmail = (data.customerEmail && data.customerEmail !== 'undefined' && data.customerEmail !== 'null') ? data.customerEmail : "Gast-Sitzung";
                headerName.innerText = `${displayName} (${displayEmail})`;
            }
            
            if (headerDetails && data.dimensions) {
                const d = data.dimensions;
                headerDetails.innerText = `BR: ${d.series.replace('BR', '')} | Maße: ${d.width}x${d.height} mm | Beschlag: ${d.fittingLeft}/${d.fittingRight} | Oberfläche: ${d.surface} | Sturz: ${d.headroom} mm`;
            }

            // UI-Steuerung basierend auf Status
            const btnTakeover = document.getElementById('btnTakeoverChat');
            const activeInput = document.getElementById('activeChatInput');
            const btnSend = document.getElementById('btnSendActiveChatMessage');

            if (data.status === 'waiting') {
                if (btnTakeover) {
                    btnTakeover.disabled = false;
                    btnTakeover.innerText = "Chat übernehmen";
                    btnTakeover.style.display = 'block';
                }
                if (activeInput) {
                    activeInput.disabled = true;
                    activeInput.placeholder = "Übernehmen Sie das Gespräch, um zu antworten...";
                }
                if (btnSend) btnSend.disabled = true;
            } else if (data.status === 'active') {
                if (btnTakeover) btnTakeover.style.display = 'none';
                if (activeInput) {
                    activeInput.disabled = false;
                    activeInput.placeholder = "Antwort an den Kunden schreiben...";
                }
                if (btnSend) btnSend.disabled = false;
            } else {
                // Geschlossen
                if (btnTakeover) btnTakeover.style.display = 'none';
                if (activeInput) {
                    activeInput.disabled = true;
                    activeInput.placeholder = "Dieser Chat wurde geschlossen.";
                }
                if (btnSend) btnSend.disabled = true;
            }

            // Verlauf rendern
            const historyContainer = document.getElementById('activeChatHistory');
            if (historyContainer) {
                historyContainer.innerHTML = '';

                const messages = data.messages || [];
                messages.forEach(msg => {
                    const bubble = document.createElement('div');
                    
                    let bubbleClass = 'carl-msg';
                    let alignment = 'flex-start';

                    if (msg.sender === 'Sascha') {
                        bubbleClass = 'carl-msg sascha';
                        alignment = 'flex-end'; // Admin rechts
                    } else if (msg.sender === 'Kunde') {
                        bubbleClass = 'carl-msg kunde';
                        alignment = 'flex-start'; // Kunde links
                    } else if (msg.sender === 'Carl') {
                        bubbleClass = 'carl-msg carl';
                        alignment = 'flex-start';
                    } else if (msg.sender === 'System') {
                        bubbleClass = 'carl-msg system';
                        alignment = 'center';
                    }

                    bubble.className = bubbleClass;
                    bubble.style.alignSelf = alignment;

                    let author = msg.sender;
                    if (msg.sender === 'Sascha') {
                        author = 'Du (Sascha)';
                    } else if (msg.sender === 'Kunde') {
                        author = (data.customerName && data.customerName !== 'undefined' && data.customerName !== 'null') ? data.customerName : "Gast";
                    }

                    if (msg.sender !== 'System') {
                        bubble.innerHTML = `<span class="carl-msg-author">${author}</span>${msg.text}`;
                    } else {
                        bubble.innerHTML = msg.text;
                    }

                    historyContainer.appendChild(bubble);
                });

                historyContainer.scrollTop = historyContainer.scrollHeight;
            }
        });
    };

    // Übernimmt den Chat (setzt Status auf active)
    window.takeoverActiveChat = async () => {
        if (!window.selectedChatId) return;

        const btnTakeover = document.getElementById('btnTakeoverChat');
        if (btnTakeover) {
            btnTakeover.disabled = true;
            btnTakeover.innerText = "⏳ Übernehme...";
        }

        await window.takeoverLiveChatSession(window.selectedChatId);
    };

    // Sendet Admin-Antwort ab
    window.sendActiveChatMessage = async () => {
        if (!window.selectedChatId) return;

        const inputNode = document.getElementById('activeChatInput');
        if (!inputNode) return;

        const text = inputNode.value.trim();
        if (!text) return;

        inputNode.value = '';

        await window.sendChatMessageToSession(window.selectedChatId, "Sascha", text);
    };

    // Tastatursteuerung für Admin-Eingabe
    window.handleActiveChatInputKey = (event) => {
        if (event.key === 'Enter') {
            window.sendActiveChatMessage();
        }
    };

    // Schließt/Archiviert die Chat-Sitzung
    window.closeActiveChatSessionUI = async () => {
        if (!window.selectedChatId) return;

        if (confirm("Möchten Sie diesen Live-Chat wirklich schließen und archivieren?")) {
            const chatId = window.selectedChatId;

            // Stream beenden um Re-Renders auszuweichen
            if (adminChatUnsubscribe) {
                adminChatUnsubscribe();
                adminChatUnsubscribe = null;
            }

            await window.closeLiveChatSession(chatId);

            window.selectedChatId = null;

            // UI zurücksetzen
            const noChatMsg = document.getElementById('noChatSelectedMessage');
            const chatWindow = document.getElementById('activeChatWindow');

            if (noChatMsg) noChatMsg.style.display = 'flex';
            if (chatWindow) chatWindow.style.display = 'none';

            // Liste aktualisieren
            if (window.initLiveChatsAdminListener) {
                window.initLiveChatsAdminListener();
            }
        }
    };

    // ==========================================
    // 6. ADMIN MANAGER PANEL CONTROLLERS
    // ==========================================

    let selectedAdminTab = 'wissen';
    let selectedSessionDocId = null;
    let selectedFeedbackDocId = null;

    /**
     * Steuert den Tab-Wechsel im Carl-Adminbereich
     */
    window.switchCarlAdminTab = function (tabName) {
        selectedAdminTab = tabName;
        window.selectedAdminTab = tabName; // Bind it globally!

        // Badges bei Besuch zurücksetzen
        if (tabName === 'verlaeufe') {
            localStorage.setItem('lastVisited_ChatVerlaeufe', Date.now());
            if (window.updateAdminBadgesUI) window.updateAdminBadgesUI();
        } else if (tabName === 'feedback') {
            localStorage.setItem('lastVisited_Fehlerberichte', Date.now());
            if (window.updateAdminBadgesUI) window.updateAdminBadgesUI();
        }

        // Container ein-/ausblenden
        const tabs = ['wissen', 'verbindungen', 'verlaeufe', 'feedback'];
        tabs.forEach(t => {
            const el = document.getElementById(`carlAdminTab_${t}`);
            const btn = document.getElementById(`btnCarlAdmin${t.charAt(0).toUpperCase() + t.slice(1)}`);
            
            if (el) el.style.display = (t === tabName) ? 'block' : 'none';
            if (btn) {
                if (t === tabName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        // Trigger für tabspezifische Updates
        if (tabName === 'verlaeufe') {
            loadAdminSessionsList();
        } else if (tabName === 'feedback') {
            loadAdminFeedbacksList();
        }
    };

    // ------------------------------------------
    // Tab 1: Wissensdatenbank (Drag & Drop & OCR)
    // ------------------------------------------

    function initDragAndDrop() {
        const zone = document.getElementById('carlDragDropZone');
        const fileInput = document.getElementById('carlFileInput');

        if (!zone) return;

        zone.addEventListener('click', () => fileInput.click());

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--hormann-blue)';
            zone.style.background = '#f0f7ff';
        });

        const resetStyle = () => {
            zone.style.borderColor = '#cbd5e1';
            zone.style.background = 'white';
        };

        zone.addEventListener('dragleave', resetStyle);
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            resetStyle();
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processImportedFile(e.dataTransfer.files[0]);
            }
        });

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    processImportedFile(e.target.files[0]);
                }
            });
        }
    }

    async function processImportedFile(file) {
        const progressArea = document.getElementById('carlOcrProgressArea');
        const progressBar = document.getElementById('carlOcrProgressBar');
        const statusText = document.getElementById('carlOcrStatusText');
        const percentText = document.getElementById('carlOcrPercentText');

        const editorArea = document.getElementById('carlExtractedArea');
        const editorTitle = document.getElementById('carlExtractedTitle');
        const editorText = document.getElementById('carlExtractedText');

        if (!progressArea || !progressBar || !statusText || !percentText) return;

        // UI vorbereiten
        progressArea.style.display = 'block';
        editorArea.style.display = 'none';
        progressBar.style.width = '0%';
        percentText.innerText = '0%';

        try {
            let text = "";
            const updateProgress = (curr, total, msg) => {
                const pct = Math.round((curr / total) * 100);
                progressBar.style.width = `${pct}%`;
                percentText.innerText = `${pct}%`;
                statusText.innerText = msg || "Analysiere...";
            };

            if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
                // PDF Text Extraktion (lokal)
                text = await window.extractTextFromPDF(file, updateProgress);
            } else if (file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                // OCR Bild Texterkennung (lokal)
                text = await window.extractTextFromImage(file, updateProgress);
            } else {
                throw new Error("Dateiformat nicht unterstützt. Bitte PDF oder Bild hochladen.");
            }

            // Fortschritt beenden
            progressArea.style.display = 'none';

            // Editor einblenden
            editorArea.style.display = 'flex';
            if (editorTitle) editorTitle.value = file.name.replace(/\.[^/.]+$/, ""); // Name ohne Extension
            if (editorText) editorText.value = text;

        } catch (err) {
            console.error(err);
            progressArea.style.display = 'none';
            alert("Importfehler: " + err.message);
        }
    }

    window.saveExtractedCarlKnowledge = async function () {
        const editorTitle = document.getElementById('carlExtractedTitle');
        const editorText = document.getElementById('carlExtractedText');
        const editorArea = document.getElementById('carlExtractedArea');

        if (!editorTitle || !editorText || !editorTitle.value.trim() || !editorText.value.trim()) {
            alert("Titel und extrahierter Inhalt dürfen nicht leer sein.");
            return;
        }

        const title = editorTitle.value.trim();
        const text = editorText.value.trim();

        // Über Firebase synchronisieren (carl_knowledge)
        const id = await window.saveCarlKnowledge(title, text);
        if (id) {
            alert("Wissensbaustein erfolgreich importiert!");
            if (editorArea) editorArea.style.display = 'none';
            editorTitle.value = '';
            editorText.value = '';
        } else {
            alert("Fehler beim Speichern in der Cloud-Datenbank.");
        }
    };

    window.discardExtractedCarlKnowledge = function () {
        const editorArea = document.getElementById('carlExtractedArea');
        const editorTitle = document.getElementById('carlExtractedTitle');
        const editorText = document.getElementById('carlExtractedText');

        if (confirm("Möchten Sie die eingelesenen Daten wirklich verwerfen?")) {
            if (editorArea) editorArea.style.display = 'none';
            if (editorTitle) editorTitle.value = '';
            if (editorText) editorText.value = '';
        }
    };

    // Wissensdatenbank-Elemente rendern im Admin
    function renderAdminKnowledgeList(list) {
        const container = document.getElementById('carlKnowledgeItemsList');
        if (!container) return;

        container.innerHTML = '';

        if (!list || list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #999; padding: 30px; font-style: italic; font-size: 0.85rem;">
                    Keine Wissensbausteine vorhanden.
                </div>
            `;
            return;
        }

        list.forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = "background:white; border:1px solid #e2e8f0; border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:4px; position:relative; box-shadow: 0 1px 3px rgba(0,0,0,0.01);";
            
            // Formatierte Zeitanzeige
            let dateStr = "Unbekannt";
            if (item.createdAt) {
                const date = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                dateStr = date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:4px;">
                    <strong style="font-size:0.85rem; color:#1e293b; max-width:85%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.title}">${item.title}</strong>
                    <button onclick="deleteCarlKnowledgeItem('${item.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem; padding: 2px;" title="Wissensbaustein löschen">🗑️</button>
                </div>
                <div style="font-size:0.75rem; color:#64748b; font-family:monospace; line-height:1.3; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
                    ${item.text}
                </div>
                <div style="font-size:0.65rem; color:#94a3b8; text-align:right; margin-top:2px;">
                    Importiert: ${dateStr}
                </div>
            `;

            container.appendChild(card);
        });
    }

    window.deleteCarlKnowledgeItem = async function (id) {
        if (confirm("Möchten Sie diesen Wissensbaustein unwiderruflich löschen? Carl verliert dadurch diesen Wissenskontext.")) {
            const ok = await window.deleteCarlKnowledge(id);
            if (!ok) alert("Fehler beim Löschen des Wissensbausteins.");
        }
    };

    // ------------------------------------------
    // Tab 2: Server-Einstellungen
    // ------------------------------------------

    function initServerSettings() {
        const urlInput = document.getElementById('carlAdminServerUrl');
        const tokenInput = document.getElementById('carlAdminServerToken');

        if (urlInput) {
            urlInput.value = localStorage.getItem('carl_ki_server_url') || 'http://localhost:11434';
        }
        if (tokenInput) {
            tokenInput.value = localStorage.getItem('carl_ki_server_token') || '';
        }
    }

    window.saveCarlServerSettings = function () {
        const urlInput = document.getElementById('carlAdminServerUrl');
        const tokenInput = document.getElementById('carlAdminServerToken');

        if (!urlInput) return;

        let url = urlInput.value.trim();
        if (url.endsWith('/')) url = url.slice(0, -1); // Slash am Ende säubern

        const token = tokenInput ? tokenInput.value.trim() : '';

        localStorage.setItem('carl_ki_server_url', url);
        localStorage.setItem('carl_ki_server_token', token);

        alert("Server-Einstellungen erfolgreich gespeichert!");
        window.checkKiServerStatus(); // Verbindungs-Dot im Header direkt aktualisieren
    };

    window.testCarlServerConnection = async function () {
        const badge = document.getElementById('carlAdminConnectionBadge');
        if (badge) {
            badge.innerText = "Prüfe...";
            badge.style.color = "#64748b";
        }

        const success = await window.checkKiServerStatus();
        
        if (success) {
            alert("Verbindung zum privaten KI-Server erfolgreich! Ollama reagiert.");
        } else {
            alert("Verbindung fehlgeschlagen! Bitte prüfen Sie, ob Ollama läuft, CORS aktiviert ist oder die URL stimmt.");
        }
    };

    // ------------------------------------------
    // Tab 3: Chatverläufe (Option A)
    // ------------------------------------------

    let sessionsListListener = null;

    function loadAdminSessionsList() {
        // Zerstöre alten Snapshot-Listener falls aktiv
        if (sessionsListListener) {
            sessionsListListener();
        }

        sessionsListListener = window.loadCarlSessions((sessions) => {
            const container = document.getElementById('carlSessionsList');
            if (!container) return;

            container.innerHTML = '';

            if (!sessions || sessions.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: #999; padding: 30px; font-style: italic; font-size: 0.85rem;">
                        Keine Chat-Verläufe geladen.
                    </div>
                `;
                return;
            }

            sessions.forEach(session => {
                const card = document.createElement('div');
                card.setAttribute('data-session-id', session.id);
                card.style.cssText = `padding: 10px 12px; background: white; border: ${session.id === selectedSessionDocId ? '2px solid var(--hormann-blue)' : '1px solid #e2e8f0'}; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.01); transition: border-color 0.15s;`;
                
                card.onclick = () => selectAdminSession(session, card);

                let dateStr = "Unbekannt";
                if (session.createdAt) {
                    const date = session.createdAt.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
                    dateStr = date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
                } else if (session.lastUpdatedAt) {
                    const date = session.lastUpdatedAt.toDate ? session.lastUpdatedAt.toDate() : new Date(session.lastUpdatedAt);
                    dateStr = date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) + " (aktualisiert)";
                }

                const displayName = (session.customerName && session.customerName !== 'undefined' && session.customerName !== 'null') ? session.customerName : "Gast";
                const displayEmail = (session.customerEmail && session.customerEmail !== 'undefined' && session.customerEmail !== 'null') ? session.customerEmail : "Gast-Sitzung";

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:0.85rem; color:#1e293b;">${displayName}</strong>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.65rem; background:#e0f2fe; color:#0369a1; font-weight:bold; padding:1px 4px; border-radius:3px;">${session.messages ? session.messages.length : 0} Msg</span>
                            <button onclick="window.handleDeleteCarlSession('${session.id}', event)" style="background:none; border:none; cursor:pointer; font-size:0.85rem; padding: 2px; line-height: 1;" title="Löschen">🗑️</button>
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${displayEmail}
                    </div>
                    <div style="font-size:0.65rem; color:#94a3b8; text-align:right;">
                        Gestartet: ${dateStr}
                    </div>
                `;

                container.appendChild(card);
            });
        });
    }

    function selectAdminSession(session, card) {
        selectedSessionDocId = session.id;

        // Listen-Border-Highlight direkt via DOM aktualisieren (Spares expensive snapshot-re-rendering)
        const container = document.getElementById('carlSessionsList');
        if (container) {
            const cards = container.querySelectorAll('div[data-session-id]');
            cards.forEach(c => {
                const sid = c.getAttribute('data-session-id');
                if (sid === session.id) {
                    c.style.border = '2px solid var(--hormann-blue)';
                } else {
                    c.style.border = '1px solid #e2e8f0';
                }
            });
        }

        const noSelect = document.getElementById('noCarlSessionSelected');
        const activeView = document.getElementById('carlSessionActiveView');
        const headerName = document.getElementById('carlSessionHeaderName');
        const historyContent = document.getElementById('carlSessionHistoryContent');

        if (noSelect) noSelect.style.display = 'none';
        if (activeView) activeView.style.display = 'flex';
        
        const displayName = (session.customerName && session.customerName !== 'undefined' && session.customerName !== 'null') ? session.customerName : "Gast";
        const displayEmail = (session.customerEmail && session.customerEmail !== 'undefined' && session.customerEmail !== 'null') ? session.customerEmail : "Gast-Sitzung";
        if (headerName) {
            headerName.innerText = `${displayName} (${displayEmail})`;
        }

        if (historyContent) {
            historyContent.innerHTML = '';
            
            const messages = session.messages || [];
            messages.forEach(msg => {
                const bubble = document.createElement('div');
                let alignment = 'flex-start';
                let bg = '#7c3aed';
                let color = 'white';
                let senderName = msg.sender;

                if (msg.sender === 'Kunde') {
                    alignment = 'flex-end';
                    bg = '#2563eb';
                    senderName = displayName;
                } else if (msg.sender === 'System') {
                    alignment = 'center';
                    bg = '#e2e8f0';
                    color = '#475569';
                }

                bubble.style.cssText = `max-width:80%; padding:8px 12px; border-radius:10px; font-size:0.8rem; line-height:1.4; align-self:${alignment}; background:${bg}; color:${color}; word-break:break-word; margin-bottom: 5px;`;
                bubble.innerHTML = `<span style="font-size:0.65rem; font-weight:bold; display:block; opacity:0.85; margin-bottom:2px;">${senderName}</span>${msg.text}`;
                
                historyContent.appendChild(bubble);
            });

            historyContent.scrollTop = historyContent.scrollHeight;
        }
    }

    // ------------------------------------------
    // Tab 4: Fehlerberichte (Tickets)
    // ------------------------------------------

    let feedbacksListListener = null;

    function loadAdminFeedbacksList() {
        if (feedbacksListListener) {
            feedbacksListListener();
        }

        feedbacksListListener = window.loadCarlFeedbacks((tickets) => {
            const container = document.getElementById('carlFeedbacksList');
            if (!container) return;

            container.innerHTML = '';

            if (!tickets || tickets.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: #999; padding: 30px; font-style: italic; font-size: 0.85rem;">
                        Keine Fehlerberichte vorhanden.
                    </div>
                `;
                return;
            }

            tickets.forEach(ticket => {
                const card = document.createElement('div');
                card.setAttribute('data-feedback-id', ticket.id);
                
                const isPositive = ticket.type === 'positive';
                const cardBorderColor = ticket.id === selectedFeedbackDocId 
                    ? (isPositive ? '#10b981' : '#ef4444') 
                    : '#e2e8f0';
                const badgeBg = isPositive ? '#d1fae5' : '#fee2e2';
                const badgeColor = isPositive ? '#065f46' : '#b91c1c';
                const badgeLabel = isPositive ? 'Hilfreich 👍' : 'Ticket 👎';
                const commentColor = isPositive ? '#10b981' : '#ef4444';
                
                card.style.cssText = `padding: 10px 12px; background: white; border: ${ticket.id === selectedFeedbackDocId ? '2px solid ' + (isPositive ? '#10b981' : '#ef4444') : '1px solid #e2e8f0'}; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.01); transition: border-color 0.15s;`;
                
                card.onclick = () => selectAdminFeedback(ticket);

                let dateStr = "Unbekannt";
                if (ticket.createdAt) {
                    const date = ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
                    dateStr = date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
                }

                const displayName = (ticket.customerName && ticket.customerName !== 'undefined' && ticket.customerName !== 'null') ? ticket.customerName : "Gast";

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap: 8px;">
                        <strong style="font-size:0.8rem; color:${commentColor}; max-width:60%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ticket.comment}</strong>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.6rem; background:${badgeBg}; color:${badgeColor}; font-weight:bold; padding:1px 4px; border-radius:3px; white-space:nowrap;">${badgeLabel}</span>
                            <button onclick="window.handleDeleteCarlFeedback('${ticket.id}', event)" style="background:none; border:none; cursor:pointer; font-size:0.85rem; padding: 2px; line-height: 1;" title="Löschen">🗑️</button>
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        Frage: "${ticket.userQuery}"
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; color:#94a3b8; margin-top:2px;">
                        <span>Von: ${displayName}</span>
                        <span>Eingegangen: ${dateStr}</span>
                    </div>
                `;

                container.appendChild(card);
            });
        });
    }

    function selectAdminFeedback(ticket) {
        selectedFeedbackDocId = ticket.id;

        // Highlights in der Seitenleiste direkt via DOM anpassen (Spares expensive snapshot-re-rendering)
        const container = document.getElementById('carlFeedbacksList');
        if (container) {
            const cards = container.querySelectorAll('div[data-feedback-id]');
            cards.forEach(card => {
                const cid = card.getAttribute('data-feedback-id');
                const isPositiveCard = card.innerHTML.includes('Hilfreich 👍');
                if (cid === ticket.id) {
                    card.style.border = `2px solid ${isPositiveCard ? '#10b981' : '#ef4444'}`;
                } else {
                    card.style.border = '1px solid #e2e8f0';
                }
            });
        }

        const noSelect = document.getElementById('noCarlFeedbackSelected');
        const activeView = document.getElementById('carlFeedbackActiveView');

        const headerBar = document.getElementById('carlFeedbackHeaderBar');
        const headerTitle = document.getElementById('carlFeedbackHeaderTitle');
        const headerDate = document.getElementById('carlFeedbackHeaderDate');
        const commentBox = document.getElementById('carlFeedbackCommentBox');
        const commentLabel = document.getElementById('carlFeedbackCommentLabel');
        const commentText = document.getElementById('carlFeedbackComment');
        const answerLabel = document.getElementById('carlFeedbackAnswerLabel');
        const incorrectAnswerBox = document.getElementById('carlFeedbackIncorrectAnswer');
        const contextHistoryBox = document.getElementById('carlFeedbackContextHistory');

        if (noSelect) noSelect.style.display = 'none';
        if (activeView) activeView.style.display = 'flex';

        let dateStr = "Unbekannt";
        if (ticket.createdAt) {
            const date = ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
            dateStr = date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
        }

        const isPositive = ticket.type === 'positive';
        const rawName = (ticket.customerName && ticket.customerName !== 'undefined' && ticket.customerName !== 'null') ? ticket.customerName : "Gast";
        const displaySender = ` (${rawName})`;

        // Dynamisches Styling basierend auf Lob/Kritik
        if (isPositive) {
            if (headerBar) {
                headerBar.style.background = '#e6f4ea';
                headerBar.style.borderBottom = '1px solid #b7e1cd';
            }
            if (headerTitle) {
                headerTitle.innerText = "Positives Feedback (Lob)" + displaySender;
                headerTitle.style.color = '#137333';
            }
            if (headerDate) {
                headerDate.style.color = '#137333';
                headerDate.innerText = `Eingegangen am: ${dateStr}`;
            }
            if (commentBox) {
                commentBox.style.background = '#eafaf1';
                commentBox.style.border = '1px solid #a7f3d0';
            }
            if (commentLabel) {
                commentLabel.innerText = "Lob & Kundenanmerkung:";
                commentLabel.style.color = '#047857';
            }
            if (commentText) {
                commentText.style.color = '#065f46';
                commentText.innerHTML = ticket.comment ? `"${ticket.comment}"` : `<i>"Keine Anmerkung eingegeben."</i>`;
            }
            if (answerLabel) {
                answerLabel.innerText = "Hilfreiche Antwort von Carl:";
            }
        } else {
            if (headerBar) {
                headerBar.style.background = '#fdf2f2';
                headerBar.style.borderBottom = '1px solid #f8b4b4';
            }
            if (headerTitle) {
                headerTitle.innerText = "Fehlerbericht (Ticket)" + displaySender;
                headerTitle.style.color = '#9b1c1c';
            }
            if (headerDate) {
                headerDate.style.color = '#7f1d1d';
                headerDate.innerText = `Eingegangen am: ${dateStr}`;
            }
            if (commentBox) {
                commentBox.style.background = '#fff5f5';
                commentBox.style.border = '1px solid #feb2b2';
            }
            if (commentLabel) {
                commentLabel.innerText = "Kritik & Kundenanmerkung:";
                commentLabel.style.color = '#9b1c1c';
            }
            if (commentText) {
                commentText.style.color = '#7f1d1d';
                commentText.innerHTML = ticket.comment ? `"${ticket.comment}"` : `<i>"Keine Anmerkung eingegeben."</i>`;
            }
            if (answerLabel) {
                answerLabel.innerText = "Falsche Antwort von Carl:";
            }
        }

        if (incorrectAnswerBox) incorrectAnswerBox.innerHTML = ticket.carlAnswer;

        if (contextHistoryBox) {
            contextHistoryBox.innerHTML = '';
            
            const messages = ticket.contextMessages || [];
            messages.forEach(msg => {
                const bubble = document.createElement('div');
                let alignment = 'flex-start';
                let bg = '#7c3aed';
                let color = 'white';
                let senderName = msg.sender;

                if (msg.sender === 'Kunde') {
                    alignment = 'flex-end';
                    bg = '#2563eb';
                    senderName = rawName;
                } else if (msg.sender === 'System') {
                    alignment = 'center';
                    bg = '#e2e8f0';
                    color = '#475569';
                }

                bubble.style.cssText = `max-width:90%; padding:6px 10px; border-radius:8px; font-size:0.75rem; line-height:1.35; align-self:${alignment}; background:${bg}; color:${color}; word-break:break-word; margin-bottom:4px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);`;
                bubble.innerHTML = `<span style="font-size:0.6rem; font-weight:bold; display:block; opacity:0.8; margin-bottom:1px;">${senderName}</span>${msg.text}`;
                
                contextHistoryBox.appendChild(bubble);
            });
            contextHistoryBox.scrollTop = contextHistoryBox.scrollHeight;
        }
    }

    // Lösch-Handler für Chatverläufe und Feedback-Tickets
    window.handleDeleteCarlSession = async (id, event) => {
        if (event) event.stopPropagation();
        if (!confirm("Möchten Sie diesen Chatverlauf wirklich unwiderruflich löschen?")) return;
        
        const success = await window.deleteCarlSession(id);
        if (success) {
            if (selectedSessionDocId === id) {
                selectedSessionDocId = null;
                const noSelect = document.getElementById('noCarlSessionSelected');
                const activeView = document.getElementById('carlSessionActiveView');
                if (noSelect) noSelect.style.display = 'flex';
                if (activeView) activeView.style.display = 'none';
            }
        } else {
            alert("Fehler beim Löschen des Chatverlaufs.");
        }
    };

    window.handleDeleteCarlFeedback = async (id, event) => {
        if (event) event.stopPropagation();
        if (!confirm("Möchten Sie dieses Feedback-Ticket wirklich unwiderruflich löschen?")) return;
        
        const success = await window.deleteCarlFeedback(id);
        if (success) {
            if (selectedFeedbackDocId === id) {
                selectedFeedbackDocId = null;
                const noSelect = document.getElementById('noCarlFeedbackSelected');
                const activeView = document.getElementById('carlFeedbackActiveView');
                if (noSelect) noSelect.style.display = 'flex';
                if (activeView) activeView.style.display = 'none';
            }
        } else {
            alert("Fehler beim Löschen des Tickets.");
        }
    };

    // ==========================================
    // 7. INITIALISIERUNG BEIM LADEN
    // ==========================================

    document.addEventListener("DOMContentLoaded", () => {
        // Kurze Verzögerung für sichere Firebase & RAG-Bibliotheksbindung
        setTimeout(() => {
            initCarlOnboarding();
            window.checkKiServerStatus();
            initDragAndDrop();
            initServerSettings();

            // Wissensdatenbank cloud sync abhören
            if (window.listenToCarlKnowledge) {
                window.listenToCarlKnowledge((cloudList) => {
                    renderAdminKnowledgeList(cloudList);
                });
            }

            // Bestehende Livechat-Session herstellen
            if (activeChatSessionId) {
                connectToLiveChatStream(activeChatSessionId);
            } else {
                renderCarlChatHistory();
            }

            // Periodischer Verbindungs-Check alle 30 Sekunden
            setInterval(() => {
                window.checkKiServerStatus();
            }, 30000);

        }, 1000);
    });

})();

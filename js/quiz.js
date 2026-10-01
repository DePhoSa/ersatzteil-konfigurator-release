/**
 * Hörmann-Quiz - Administration & Gameplay-Engine
 * 
 * Steuert die Interaktion mit der Gemini API zur automatischen Generierung von 
 * humorvollen "You Don't Know Jack"-Fragen aus Memos und Rundmails, speichert
 * diese freigegeben in Firestore und treibt die interaktive Spiel-Engine an.
 */

import { collection, addDoc, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

(function () {
    // --- STATE BINDINGS ---
    window.isQuizGameActive = false;
    
    // Warnung vor dem Verlassen der Seite bei aktivem Spiel
    window.addEventListener('beforeunload', function (e) {
        if (window.isQuizGameActive) {
            e.preventDefault();
            e.returnValue = "Möchtest du das aktuelle Spiel wirklich abbrechen? Dein Fortschritt geht verloren.";
            return e.returnValue;
        }
    });

    let allQuestions = [];
    let activeQuestions = [];
    
    let gameMode = "quickie"; // 'quickie', 'update', 'marathon'
    let gameCategory = "all";
    
    let currentQuestionIndex = 0;
    let currentScore = 0;
    let marathonLives = 3;
    
    let tickerValue = 1000;
    let tickerInterval = null;
    let readingInterval = null;
    let timeElapsed = 0;

    // Admin-Generator-States
    let currentGeneratedQuestions = [];
    let generatorCategory = "";
    
    // Chat & Spam protection states
    let unsubscribeChat = null;
    let lastMessageTimestamps = [];

    // Humorous Feedback pools (with Firestore database-backed pools and local YDKJ fallbacks)
    let correctFeedbackPool = [
        "Richtig! Sascha klopft dir virtuell auf die Schulter! 🍺",
        "Korrekt! Hast wohl das Werksprospekt gefrühstückt, was? 📚",
        "Volltreffer! Damit hast du dir 5 Sekunden ehrfürchtiges Nicken verdient! 😎",
        "Richtig! Und das ganz ohne heimlich unter dem Tisch zu googeln! 🔍",
        "Sensationell! Die Konkurrenz zittert vor deiner Paneelen-Kompetenz! ⚙️",
        "Hauptgewinn! Dein Gehirn läuft heute mit 100% Federspannung! ⚡"
    ];
    let incorrectFeedbackPool = [
        "Autsch! Das war wohl eher ein LPU-Paneel-Platzer! 💥",
        "Falsch! Setzen, sechs! Sogar unser Kantinenkaffee hat mehr Durchblick! ☕",
        "Daneben! Suchst du noch die Federspannung oder rätst du einfach wild? ⚙️",
        "Leider falsch! Aber hey, Hauptsache die Frisur sitzt im Teams-Call! 💇",
        "Komplett vorbei! Sascha schüttelt traurig den Kopf. Geh nochmal üben! 🫣",
        "Das war so daneben, das zählte fast schon als Sabotage! 🛑"
    ];

    // --- INITIALISIERUNG & TABS ---

    window.switchQuizTab = function (tabId) {
        if (window.isQuizGameActive) {
            if (!confirm("Möchtest du das aktuelle Spiel wirklich abbrechen? Dein Fortschritt geht verloren.")) {
                return;
            }
            window.isQuizGameActive = false;
        }
        const isAdmin = (window.currentUserRole === 'admin' || window.currentUserRole === 'developer');
        if ((tabId === 'generator' || tabId === 'manager') && !isAdmin) {
            tabId = 'lobby';
        }

        // Gameplay und Game-Over Ansichten schließen, um sauberen Tab-Wechsel zu gewährleisten!
        const playArea = document.getElementById('quizGamePlayArea');
        if (playArea) playArea.style.display = 'none';
        const gameOverArea = document.getElementById('quizGameOverArea');
        if (gameOverArea) gameOverArea.style.display = 'none';

        document.querySelectorAll('#quizSubNav .sub-nav-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('btnQuizSub' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
        if (btn) btn.classList.add('active');

        if (tabId === 'lobby') {
            document.getElementById('quizLobbyArea').style.display = 'block';
            document.getElementById('quizGeneratorArea').style.display = 'none';
            document.getElementById('quizLeaderboardArea').style.display = 'none';
            document.getElementById('quizManagerArea').style.display = 'none';
            window.updateLobbyQuestionsCount();
        } else if (tabId === 'generator') {
            document.getElementById('quizLobbyArea').style.display = 'none';
            document.getElementById('quizGeneratorArea').style.display = 'grid';
            document.getElementById('quizLeaderboardArea').style.display = 'none';
            document.getElementById('quizManagerArea').style.display = 'none';
        } else if (tabId === 'leaderboard') {
            document.getElementById('quizLobbyArea').style.display = 'none';
            document.getElementById('quizGeneratorArea').style.display = 'none';
            document.getElementById('quizLeaderboardArea').style.display = 'block';
            document.getElementById('quizManagerArea').style.display = 'none';
            window.loadQuizLeaderboards();
        } else if (tabId === 'manager') {
            document.getElementById('quizLobbyArea').style.display = 'none';
            document.getElementById('quizGeneratorArea').style.display = 'none';
            document.getElementById('quizLeaderboardArea').style.display = 'none';
            document.getElementById('quizManagerArea').style.display = 'block';
            window.switchQuizManagerTab('questions'); // Start in Fragen-Editor
        }
    };

    /**
     * Wählt den Spielmodus in der Lobby visuell aus.
     */
    window.selectQuizMode = function (mode) {
        gameMode = mode;
        
        // Buttons zurücksetzen
        document.querySelectorAll('#quizLobbyArea .fitting-btn').forEach(b => {
            b.classList.remove('active');
            b.style.opacity = '0.7';
        });

        // Aktiven Modus hervorheben
        const btn = document.getElementById('btnMode' + mode.charAt(0).toUpperCase() + mode.slice(1));
        if (btn) {
            btn.classList.add('active');
            btn.style.opacity = '1';
        }

        // Kategorie-Auswahl für Marathon ausblenden, sonst einblenden!
        const catContainer = document.getElementById('quizCategorySelectionContainer');
        if (catContainer) {
            catContainer.style.display = (mode === 'marathon') ? 'none' : 'block';
        }
    };

    /**
     * Zählt die in Firestore verfügbaren Fragen und aktualisiert das UI in der Lobby.
     */
    window.updateLobbyQuestionsCount = async function () {
        const db = window.db;
        if (!db) return;

        const countDisplay = document.getElementById('lobbyQuestionCountDisplay');
        if (countDisplay) countDisplay.innerText = "Lade Fragenpool... 🔄";

        try {
            const querySnapshot = await getDocs(collection(db, "questions"));
            allQuestions = [];
            querySnapshot.forEach(docSnap => {
                allQuestions.push({ id: docSnap.id, ...docSnap.data() });
            });

            updateLobbyCategoryCounts();
            
            // Lade den Feedback Pool synchron aus Firestore
            loadFeedbackPoolFromFirestore();
        } catch (e) {
            console.error("Fehler beim Laden des Fragenpools:", e);
            if (countDisplay) countDisplay.innerText = "Pool konnte nicht geladen werden ❌";
        }
    };

    /**
     * Lädt den Feedback-Pool aus Firestore.
     */
    async function loadFeedbackPoolFromFirestore() {
        const db = window.db;
        if (!db) return;

        try {
            const querySnapshot = await getDocs(collection(db, "feedback_pool"));
            const correctList = [];
            const incorrectList = [];

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.type === 'correct') {
                    correctList.push(data.text);
                } else if (data.type === 'incorrect') {
                    incorrectList.push(data.text);
                }
            });

            if (correctList.length > 0) {
                correctFeedbackPool = correctList;
            }
            if (incorrectList.length > 0) {
                incorrectFeedbackPool = incorrectList;
            }
            console.log(`[Quiz] Feedback-Pool aus Firestore geladen: ${correctFeedbackPool.length} Richtig- & ${incorrectFeedbackPool.length} Falsch-Sprüche.`);
        } catch (e) {
            console.error("Fehler beim Laden des Feedback-Pools aus Firestore, nutze Fallbacks:", e);
        }
    }

    /**
     * Aktualisiert den Zähler der Fragen basierend auf der selektierten Kategorie in der Lobby.
     */
    function updateLobbyCategoryCounts() {
        const catSelect = document.getElementById('playCategorySelect');
        const countDisplay = document.getElementById('lobbyQuestionCountDisplay');
        if (!catSelect || !countDisplay) return;

        const selectedCat = catSelect.value;
        let count = 0;

        if (selectedCat === 'all') {
            count = allQuestions.length;
        } else {
            count = allQuestions.filter(q => q.category === selectedCat).length;
        }

        countDisplay.innerHTML = `Verfügbare Fragen: <strong style="color: var(--color-tools);">${count}</strong>`;
        
        // Dropdown Eventlistener einmalig einrichten
        if (!catSelect.dataset.hasListener) {
            catSelect.addEventListener('change', updateLobbyCategoryCounts);
            catSelect.dataset.hasListener = "true";
        }
    }

    // --- GAME ENGINE START ---

    /**
     * Startet die Quiz Spiel-Engine!
     */
    window.startQuizPlayEngine = function () {
        const catSelect = document.getElementById('playCategorySelect');
        gameCategory = catSelect ? catSelect.value : "all";
        if (gameMode === 'marathon') {
            gameCategory = "all";
        }

        // 1. Fragen filtern (Mehrfachkategorien robust prüfen)
        let pool = [];
        if (gameCategory === 'all') {
            pool = [...allQuestions];
        } else {
            pool = allQuestions.filter(q => {
                const cats = q.categories || (q.category ? [q.category] : []);
                return cats.includes(gameCategory);
            });
        }

        if (pool.length === 0) {
            alert("In dieser Kategorie sind leider noch keine Fragen vorhanden! Wechseln Sie zum Generator, um erste Fragen zu erstellen.");
            return;
        }

        // 2. Fragen mischen (Fisher-Yates)
        shuffleArray(pool);

        // 3. Rundenlänge festlegen
        if (gameMode === 'quickie') {
            activeQuestions = pool.slice(0, Math.min(5, pool.length));
        } else if (gameMode === 'update') {
            activeQuestions = pool.slice(0, Math.min(10, pool.length));
        } else {
            // Marathon: Alle Fragen des Pools spielen
            activeQuestions = pool;
        }

        // 4. UI anpassen (Lobby ausblenden, Spielfeld einblenden)
        document.getElementById('quizLobbyArea').style.display = 'none';
        document.getElementById('quizGamePlayArea').style.display = 'block';
        document.getElementById('quizGameOverArea').style.display = 'none';

        window.isQuizGameActive = true;

        // 5. Game States zurücksetzen
        currentScore = 0;
        marathonLives = 3;
        document.getElementById('playScoreDisplay').innerText = "Punkte: 0";

        if (gameMode === 'marathon') {
            document.getElementById('playLivesContainer').style.display = 'inline';
            updateLivesUI();
        } else {
            document.getElementById('playLivesContainer').style.display = 'none';
        }

        // 6. Erste Frage laden
        loadQuestion(0);
    };

    /**
     * Rendert eine Frage auf dem Bildschirm.
     */
    function loadQuestion(index) {
        currentQuestionIndex = index;
        const q = activeQuestions[index];

        // Statusbar Fortschritt
        const progressBadge = document.getElementById('playProgressBadge');
        if (progressBadge) {
            if (gameMode === 'marathon') {
                progressBadge.innerText = `Frage ${index + 1} (Survival!)`;
            } else {
                progressBadge.innerText = `Frage ${index + 1} / ${activeQuestions.length}`;
            }
        }

        // Fragetext einsetzen
        document.getElementById('playQuestionText').innerHTML = q.questionText;

        // Antworten rendern (in Sektionaltor-Revealers eingepackt)
        const grid = document.getElementById('playAnswersGrid');
        if (grid) {
            grid.innerHTML = "";
            q.answers.forEach((ans, ansIdx) => {
                const wrapper = document.createElement('div');
                wrapper.className = "sectional-panel";
                wrapper.style.transitionDelay = `${ansIdx * 0.12}s`; // Staggered delays
                
                const btn = document.createElement('button');
                btn.className = "fitting-btn";
                btn.style.cssText = "width: 100%; height: auto; padding: 15px 20px; font-size: 0.95rem; font-weight: 600; text-align: center; opacity: 1; border-width: 2px; transition: all 0.2s;";
                btn.innerHTML = ans;
                btn.onclick = () => window.selectQuizAnswer(ansIdx);
                btn.disabled = true; // disabled during reading phase
                
                wrapper.appendChild(btn);
                grid.appendChild(wrapper);
            });
        }

        // Feedback-Overlay ausblenden
        document.getElementById('playFeedbackOverlay').style.display = 'none';

        // Lesezeit Phase starten
        startReadingPhase(q);
    }

    /**
     * Startet die Lesephase basierend auf der Textlänge.
     */
    function startReadingPhase(q) {
        clearInterval(tickerInterval);
        clearInterval(readingInterval);

        const wordCount = q.questionText.split(/\s+/).length;
        // Berechne Lesezeit: Zwischen 2 und 5 Sekunden basierend auf Lesegeschwindigkeit (3.5 Worte / Sek)
        const readingSeconds = Math.min(5, Math.max(2, Math.round(wordCount / 3.5)));

        const readingContainer = document.getElementById('playReadingTimerContainer');
        const tickerContainer = document.getElementById('playBonusTickerContainer');
        const readingBar = document.getElementById('playReadingTimerBar');
        const readingSecondsDisplay = document.getElementById('playReadingSecondsDisplay');

        if (readingContainer) readingContainer.style.display = 'block';
        if (tickerContainer) tickerContainer.style.display = 'none';
        if (readingBar) readingBar.style.width = "100%";
        if (readingSecondsDisplay) readingSecondsDisplay.innerText = `Noch ${readingSeconds} Sek.`;

        const startTime = Date.now();
        const durationMs = readingSeconds * 1000;

        readingInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = durationMs - elapsed;

            if (remaining <= 0) {
                clearInterval(readingInterval);
                if (readingBar) readingBar.style.width = "0%";
                if (readingSecondsDisplay) readingSecondsDisplay.innerText = "Los! 🚀";

                revealAnswersAndStartGame();
            } else {
                const percentage = (remaining / durationMs) * 100;
                if (readingBar) readingBar.style.width = percentage + "%";
                if (readingSecondsDisplay) readingSecondsDisplay.innerText = `Noch ${Math.ceil(remaining / 1000)} Sek.`;
            }
        }, 50);
    }

    /**
     * Fährt das Sektionaltor herunter und startet danach den regulären Punkteverfall-Ticker.
     */
    function revealAnswersAndStartGame() {
        const readingContainer = document.getElementById('playReadingTimerContainer');
        const tickerContainer = document.getElementById('playBonusTickerContainer');

        if (readingContainer) readingContainer.style.display = 'none';
        if (tickerContainer) tickerContainer.style.display = 'block';

        // Sektionaltor-Reveal-Klassen aktivieren
        const panels = document.querySelectorAll('#playAnswersGrid .sectional-panel');
        panels.forEach(p => p.classList.add('reveal'));

        // Antwortbuttons nach der Animation freischalten
        setTimeout(() => {
            panels.forEach(p => {
                const btn = p.querySelector('button');
                if (btn) btn.disabled = false;
            });
            // Ticker starten!
            startTickerTimer();
        }, 600);
    }

    /**
     * Startet den zeitabhängigen Punkteverfall (Der Ticker).
     */
    function startTickerTimer() {
        clearInterval(tickerInterval);
        tickerValue = 1000;
        timeElapsed = 0;

        const tickerBar = document.getElementById('playTickerBar');
        const pointsDisplay = document.getElementById('playTickerPointsDisplay');

        if (tickerBar) {
            tickerBar.style.width = "100%";
            tickerBar.style.backgroundColor = "#27ae60"; // HSL tailored Grün
        }
        if (pointsDisplay) pointsDisplay.innerText = "1.000 Punkte";

        const startTime = Date.now();

        tickerInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            timeElapsed = elapsed;

            if (elapsed >= 20) {
                // Bei Ablauf von 20 Sekunden verbleibt der Basisscore bei 200 Punkten
                tickerValue = 200;
                clearInterval(tickerInterval);
                if (tickerBar) tickerBar.style.width = "20%";
            } else {
                // Linearer Punkteverfall von 1000 auf 200 über 20 Sekunden
                tickerValue = Math.round(1000 - (elapsed / 20) * 800);
                if (tickerBar) tickerBar.style.width = (100 - (elapsed / 20) * 80) + "%";
            }

            if (pointsDisplay) pointsDisplay.innerText = `${tickerValue} Punkte`;

            // Ticker Bar Farbindikatoren
            if (tickerBar) {
                if (elapsed > 14) {
                    tickerBar.style.backgroundColor = "#e74c3c"; // Alarm Rot
                } else if (elapsed > 8) {
                    tickerBar.style.backgroundColor = "#e67e22"; // Warnung Orange
                } else {
                    tickerBar.style.backgroundColor = "#27ae60"; // Gut Grün
                }
            }
        }, 100);
    }

    /**
     * Verarbeitet den Klick auf eine Antwortmöglichkeit.
     */
    window.selectQuizAnswer = function (selectedIndex) {
        clearInterval(tickerInterval);

        // Klicks auf Antwort-Buttons sperren
        const buttons = document.querySelectorAll('#playAnswersGrid button');
        buttons.forEach(b => b.disabled = true);

        const q = activeQuestions[currentQuestionIndex];
        const isCorrect = q.correctAnswerIndex === selectedIndex;

        const fbIcon = document.getElementById('playFeedbackIcon');
        const fbTitle = document.getElementById('playFeedbackTitle');
        const fbPoints = document.getElementById('playFeedbackPointsEarned');
        const fbExplain = document.getElementById('playFeedbackExplanation');
        const btnNext = document.getElementById('btnPlayNextQuestion');

        // YDKJ Vibe Erklärungen einpflegen
        fbExplain.innerText = q.explanation || "Tja, das ist halt so, weil Hörmann es so bestimmt hat! Da gibt es nichts zu diskutieren.";

        const correctHumorousPoints = [
            `+ ${tickerValue} Punkte staubtrocken eingesackt!`,
            `+ ${tickerValue} Punkte! Dein Highscore nimmt Gestalt an.`,
            `Boah! + ${tickerValue} Punkte für diese Meisterleistung!`,
            `+ ${tickerValue} Punkte! Sascha nickt anerkennend.`,
            `+ ${tickerValue} Punkte fließen direkt auf dein Punktekonto.`
        ];
        const incorrectHumorousPoints = [
            "- 500 Punkte Strafe fürs wilde Raten!",
            "- 500 Punkte! Autsch, das tut im Portemonnaie weh.",
            "- 500 Punkte! Der Kantinenchef verweigert dir das zweite Schnitzel.",
            "- 500 Punkte! Die Rangliste rückt in weite Ferne.",
            "- 500 Punkte! Sascha zieht die Augenbrauen hoch."
        ];

        if (isCorrect) {
            currentScore += tickerValue;

            const randomTitle = correctFeedbackPool[Math.floor(Math.random() * correctFeedbackPool.length)];
            const randomPoint = correctHumorousPoints[Math.floor(Math.random() * correctHumorousPoints.length)];

            fbIcon.innerText = "🎉";
            fbTitle.innerText = randomTitle;
            fbTitle.style.color = "var(--friendly-green)";
            fbPoints.innerText = randomPoint;
            fbPoints.style.color = "var(--friendly-green)";

            // Ausgewählten Button grün färben
            if (buttons[selectedIndex]) {
                buttons[selectedIndex].style.borderColor = "var(--friendly-green)";
                buttons[selectedIndex].style.backgroundColor = "#f4faf6";
                buttons[selectedIndex].style.color = "var(--friendly-green-hover)";
            }
        } else {
            currentScore = Math.max(0, currentScore - 500);

            const randomTitle = incorrectFeedbackPool[Math.floor(Math.random() * incorrectFeedbackPool.length)];
            const randomPoint = incorrectHumorousPoints[Math.floor(Math.random() * incorrectHumorousPoints.length)];

            fbIcon.innerText = "😢";
            fbTitle.innerText = randomTitle;
            fbTitle.style.color = "var(--error-red)";
            fbPoints.innerText = randomPoint;
            fbPoints.style.color = "var(--error-red)";

            // Ausgewählten Button rot färben
            if (buttons[selectedIndex]) {
                buttons[selectedIndex].style.borderColor = "var(--error-red)";
                buttons[selectedIndex].style.backgroundColor = "#fdf2f2";
                buttons[selectedIndex].style.color = "var(--error-red)";
            }

            // Richtigen Button grün umranden zur Info
            if (buttons[q.correctAnswerIndex]) {
                buttons[q.correctAnswerIndex].style.borderColor = "var(--friendly-green)";
                buttons[q.correctAnswerIndex].style.borderWidth = "3px";
            }

            // Wenn Marathon: Leben abziehen
            if (gameMode === 'marathon') {
                marathonLives--;
                updateLivesUI();
                if (marathonLives === 0) {
                    btnNext.innerHTML = "Zum bitteren Ende 💀";
                }
            }
        }

        // Score aktualisieren
        document.getElementById('playScoreDisplay').innerText = `Punkte: ${currentScore}`;

        // Feedback Overlay anzeigen
        document.getElementById('playFeedbackOverlay').style.display = 'flex';
    };

    /**
     * Bringt den Spieler zur nächsten Frage oder leitet zum Game Over über.
     */
    window.proceedToNextQuestion = function () {
        document.getElementById('playFeedbackOverlay').style.display = 'none';

        // 1. Abbruch durch Lebensverlust im Marathon
        if (gameMode === 'marathon' && marathonLives === 0) {
            window.endQuizGame();
            return;
        }

        // 2. Normaler Rundenübergang
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < activeQuestions.length) {
            loadQuestion(nextIndex);
        } else {
            // Rundenende erreicht
            window.endQuizGame();
        }
    };

    /**
     * Aktualisiert die visuelle Herzchen-Anzeige im Überlebensmodus.
     */
    function updateLivesUI() {
        const livesNode = document.getElementById('playLivesContainer');
        if (!livesNode) return;

        let hearts = "";
        for (let i = 0; i < 3; i++) {
            if (i < marathonLives) {
                hearts += "❤️ ";
            } else {
                hearts += "🖤 ";
            }
        }
        livesNode.innerText = hearts;
    }

    // --- GAME ENGINE ENDE ---

    /**
     * Beendet das Quiz und zeigt die humorvolle Auswertung.
     */
    window.endQuizGame = async function () {
        window.isQuizGameActive = false;
        clearInterval(tickerInterval);

        document.getElementById('quizGamePlayArea').style.display = 'none';
        document.getElementById('quizGameOverArea').style.display = 'block';

        // Punkte
        document.getElementById('endScoreDisplay').innerText = `${currentScore} Punkte`;

        // Weiche für Admins
        const isAdmin = (window.currentUserRole === 'admin' || window.currentUserRole === 'developer');
        const notice = document.getElementById('adminPlayScoreNotice');
        if (notice) {
            notice.style.display = isAdmin ? 'block' : 'none';
        }

        const rankDisplay = document.getElementById('endRankDisplay');
        if (rankDisplay) {
            rankDisplay.style.display = 'inline-block';
            if (isAdmin) {
                rankDisplay.innerText = "Außer Konkurrenz ☕";
                rankDisplay.style.background = "#e2e8f0";
                rankDisplay.style.color = "#475569";
            } else {
                rankDisplay.innerText = "Berechne Rang... ⏳";
                rankDisplay.style.background = "#f1f5f9";
                rankDisplay.style.color = "#64748b";
            }
        }

        // Witzige Performance-Evaluierungen (YDKJ-Vibe)
        const evalTitleNode = document.getElementById('endEvaluationTitle');
        const evalTextNode = document.getElementById('endEvaluationText');

        let title = "Der unangefochtene Tor-Gott 👑";
        let text = "Sensationeller Durchlauf! Sascha ist zu Tränen gerührt und hat das Bier schon kalt gestellt. Dein Bild hängt ab morgen in der Werkskantine!";

        if (currentScore === 0) {
            title = "Totalausfall an der Schranke 🛑";
            text = "0 Punkte! Hast du überhaupt schon mal ein Garagentor gesehen? Vielleicht solltest du lieber im Prospekte-Sortieren anfangen...";
        } else if (currentScore <= 1500) {
            title = "Stift am ersten Arbeitstag 🛠️";
            text = "Huch! Das war ein holpriger Start. Sascha empfiehlt dringend eine Lektüre über LPU-Paneele als Einschlafhilfe. Nächster Versuch!";
        } else if (currentScore <= 3500) {
            title = "Z-Beschlag-Zauderer ⚙️";
            text = "Gar nicht mal so extrem katastrophal! Du weißt zumindest, wo die Federn hängen. Für den echten Teamerfolg fehlt aber noch ein bisschen Fett auf den Laufschienen.";
        } else if (currentScore <= 6500) {
            title = "Verlade-Assistent im Mittelfeld 📈";
            text = "Eine solide, anständige Leistung! Du kennst die Werke fast so gut wie deine eigene Kaffeetasse. Für den Thron reicht es aber noch nicht.";
        } else if (currentScore <= 8500) {
            title = "Der unangefochtene Tor-Gott 👑";
            text = "Sensationeller Durchlauf! Sascha ist zu Tränen gerührt und hat das Bier schon kalt gestellt. Dein Bild hängt ab morgen in der Werkskantine!";
        } else {
            title = "Oberster Sektions-Guru 🌌";
            text = "Unglaublich! Über 8.500 Punkte! Du riechst förmlich den Zinküberzug und träumst in RAL-Farben. Du wurdest soeben zum Ehren-Werksschutz ernannt!";
        }

        if (evalTitleNode) evalTitleNode.innerText = title;
        if (evalTextNode) evalTextNode.innerText = text;

        // Highscore in Firestore speichern (NUR WENN NICHT ADMIN!)
        if (!isAdmin) {
            await saveScoreToLeaderboard();
            
            // Berechne den erreichten Rang aus Firestore
            try {
                const rank = await calculateUserRank(currentScore, gameMode, gameCategory);
                if (rankDisplay) {
                    rankDisplay.style.color = "#ffffff";
                    if (rank === 1) {
                        rankDisplay.innerHTML = "Platz #1 in der Ruhmeshalle! 🏆🥇";
                        rankDisplay.style.background = "linear-gradient(135deg, #f1c40f, #d35400)";
                        window.startConfettiRain();
                    } else if (rank === 2) {
                        rankDisplay.innerHTML = "Platz #2 in der Ruhmeshalle! 🥈";
                        rankDisplay.style.background = "linear-gradient(135deg, #bdc3c7, #7f8c8d)";
                        window.startConfettiRain();
                    } else if (rank === 3) {
                        rankDisplay.innerHTML = "Platz #3 in der Ruhmeshalle! 🥉";
                        rankDisplay.style.background = "linear-gradient(135deg, #e67e22, #d35400)";
                        window.startConfettiRain();
                    } else {
                        rankDisplay.innerHTML = `Platz #${rank} in der Ruhmeshalle! 📈`;
                        rankDisplay.style.background = "linear-gradient(135deg, #3498db, #2980b9)";
                    }
                }
            } catch (err) {
                console.error("Fehler bei der Rankberechnung:", err);
                if (rankDisplay) {
                    rankDisplay.innerText = "Rang wurde registriert! 📈";
                    rankDisplay.style.background = "linear-gradient(135deg, #3498db, #2980b9)";
                    rankDisplay.style.color = "#ffffff";
                }
            }
        }
    };

    /**
     * Speichert den Score in die Collection /leaderboards (Für Phase 3 vorbereitet).
     */
    async function saveScoreToLeaderboard() {
        const db = window.db;
        const auth = window.auth;
        if (!db || !auth || !auth.currentUser) return;

        try {
            const user = auth.currentUser;
            
            // Erst Benutzer-Stammdaten aus Firestore holen, um Werk & Name zu ermitteln
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (!userSnap.exists()) return;
            const userData = userSnap.data();

            // Namensanzeige formatieren
            let displayName = `${userData.firstName} ${userData.lastName}`;
            if (userData.nameDisplayMode === "short") {
                displayName = `${userData.firstName} ${userData.lastName.charAt(0)}.`;
            }

            // In Leaderboards Collection schreiben
            await addDoc(collection(db, "leaderboards"), {
                userId: user.uid,
                userName: displayName,
                score: currentScore,
                mode: gameMode,
                category: gameCategory,
                branch: userData.branch || "Allgemein",
                userRole: userData.role || "employee",
                avatarSeed: userData.avatarSeed || 1,
                showBranchNumber: userData.showBranchNumber !== false,
                createdAt: serverTimestamp()
            });

            console.log("[Quiz] Highscore erfolgreich im Leaderboard registriert!");
        } catch (e) {
            console.error("Fehler beim Speichern des Scores:", e);
        }
    }

    /**
     * Lädt die Ruhmeshalle (Leaderboards) aus Firestore und rendert sie mit Filtern.
     */
    window.loadQuizLeaderboards = async function () {
        const db = window.db;
        if (!db) return;

        // Echtzeit-Flurfunk-Chat initialisieren
        window.initLiveLeaderboardChat();

        const loader = document.getElementById('leaderboardLoader');
        const emptyState = document.getElementById('leaderboardEmptyState');
        const container = document.getElementById('leaderboardTableContainer');
        const tbody = document.getElementById('leaderboardTableBody');
        const shameSection = document.getElementById('leaderboardShameSection');

        if (loader) loader.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (container) container.style.display = 'none';
        if (shameSection) shameSection.style.display = 'none';
        if (tbody) tbody.innerHTML = "";

        try {
            // Filterwerte abrufen
            const modeFilter = document.getElementById('leaderboardModeFilter')?.value || 'all';
            const branchFilter = document.getElementById('leaderboardBranchFilter')?.value || 'all';
            const categoryFilter = document.getElementById('leaderboardCategoryFilter')?.value || 'all';

            // Top Scores abfragen
            const q = query(collection(db, "leaderboards"), orderBy("score", "desc"), limit(100));
            const querySnapshot = await getDocs(q);

            let scores = [];
            querySnapshot.forEach(docSnap => {
                scores.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Admins & Entwickler strikt ausschließen
            scores = scores.filter(s => s.userRole !== 'admin' && s.userRole !== 'developer');

            // Clientseitige Filter anwenden
            if (modeFilter !== 'all') {
                scores = scores.filter(s => s.mode === modeFilter);
            }
            if (branchFilter !== 'all') {
                scores = scores.filter(s => s.branch === branchFilter);
            }
            if (categoryFilter !== 'all') {
                scores = scores.filter(s => s.category === categoryFilter);
            }

            if (scores.length === 0) {
                if (loader) loader.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            // Rendern
            let shameFound = false;
            scores.forEach((s, idx) => {
                const rank = idx + 1;
                let rankBadge = `${rank}.`;
                if (rank === 1) rankBadge = "🥇";
                else if (rank === 2) rankBadge = "🥈";
                else if (rank === 3) rankBadge = "🥉";

                if (s.score < 500) {
                    shameFound = true;
                }

                let modeText = "☕ Quickie";
                if (s.mode === 'update') modeText = "📈 Update";
                if (s.mode === 'marathon') modeText = "❤️ Marathon";

                const tr = document.createElement('tr');
                tr.style.cssText = "border-bottom: 1px solid #f1f5f9; transition: background 0.1s;";
                tr.onmouseover = () => tr.style.backgroundColor = "#f8fafc";
                tr.onmouseout = () => tr.style.backgroundColor = "transparent";

                const avatarSvg = window.getAvatarSvg(s.avatarSeed || 1);
                const showBranchVal = s.showBranchNumber !== false;
                const branchText = showBranchVal ? s.branch : s.branch.replace(/\d/g, '').trim();

                tr.innerHTML = `
                    <td style="padding: 12px 10px; font-weight: bold; font-size: 1.1rem; text-align: center; vertical-align: middle;">${rankBadge}</td>
                    <td style="padding: 12px 10px; font-weight: bold; color: #2c3e50; vertical-align: middle;">
                        <div onclick="window.openUserProfilePopup('${s.userId}')" style="cursor: pointer; display: flex; align-items: center; gap: 10px; width: fit-content;" title="Profil anzeigen">
                            <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #e2e8f0; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                ${avatarSvg}
                            </div>
                            <span style="transition: color 0.15s;" onmouseover="this.style.color='var(--color-tools)'" onmouseout="this.style.color='#2c3e50'">${escapeHtml(s.userName)}</span>
                        </div>
                    </td>
                    <td style="padding: 12px 10px; vertical-align: middle;"><span class="card-badge" style="background: #eaf4fb; color: var(--hormann-blue); font-size: 0.75rem;">${escapeHtml(branchText || 'Allgemein')}</span></td>
                    <td style="padding: 12px 10px; font-size: 0.85rem; color: #475569; vertical-align: middle;">${modeText}</td>
                    <td style="padding: 12px 10px; font-size: 0.85rem; color: #475569; vertical-align: middle;">${escapeHtml(s.category === 'all' ? 'Gemischt' : s.category)}</td>
                    <td style="padding: 12px 10px; font-weight: bold; text-align: right; color: var(--color-tools); font-size: 1.05rem; vertical-align: middle;">${s.score.toLocaleString('de-DE')} Pkt.</td>
                `;
                tbody.appendChild(tr);
            });

            if (loader) loader.style.display = 'none';
            if (container) container.style.display = 'block';
            if (shameFound && shameSection) {
                shameSection.style.display = 'block';
            }
        } catch (err) {
            console.error("Fehler beim Laden des Leaderboards:", err);
            if (loader) loader.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                emptyState.innerHTML = `<span style="font-size: 2.5rem; display: block; margin-bottom: 10px;">❌</span>
                                       <strong style="color: #9b1c1c;">Fehler beim Laden!</strong>
                                       <p style="font-size: 0.85rem; color: #64748b; margin-top: 5px;">Das Leaderboard konnte nicht abgerufen werden. Eventuell fehlen Berechtigungen in den Firestore-Regeln.</p>`;
            }
        }
    };

    /**
     * Zeigt die Zwischenseite mit den Spielregeln vor dem Start.
     */
    window.showQuizExplanation = function () {
        const catSelect = document.getElementById('playCategorySelect');
        const selectedCategory = catSelect ? catSelect.value : "all";
        
        let modeTitle = "Der Quickie ☕";
        let modeDesc = `<strong>Modus: Quickie (5 Fragen)</strong><br>
        Löse 5 knifflige Fragen im rasanten Quickie-Modus. Je schneller du antwortest, desto mehr Punkte gibt es! Kannst du die Bestenliste stürmen?`;
        
        if (gameMode === 'update') {
            modeTitle = "Quiz Time ⏱️";
            modeDesc = `<strong>Modus: Quiz Time (10 Fragen)</strong><br>
            Stelle dich 10 Fragen im Standard-Modus. Schnelligkeit zählt! Zeige dein Wissen rund um Hörmann und sichere dir einen Spitzenplatz auf der Bestenliste.`;
        } else if (gameMode === 'marathon') {
            modeTitle = "Marathon (Survival) ❤️";
            modeDesc = `<strong>Modus: Marathon (Survival)</strong><br>
            Open-End: Alle Fragen, volles Hörmann Wissen. Du startest mit 3 Leben. Jede falsche Antwort kostet ein Herz.`;
        }

        const categoryName = selectedCategory === 'all' ? 'Alle Kategorien gemischt' : selectedCategory;
        const categoryLine = gameMode === 'marathon' ? '' : `<strong>Gewählte Kategorie:</strong> ${categoryName}<br><br>`;

        const explainTitle = document.getElementById('explainTitle');
        const explainText = document.getElementById('explainText');
        const lobbyArea = document.getElementById('quizLobbyArea');
        const explainArea = document.getElementById('quizExplanationArea');

        if (explainTitle && explainText && lobbyArea && explainArea) {
            explainTitle.innerHTML = `📖 Spielregeln: ${modeTitle}`;
            explainText.innerHTML = `
                ${modeDesc}
                <br><br>
                ${categoryLine}
                <strong>Spielregeln:</strong>
                <ul style="margin: 5px 0 0 18px; padding: 0; line-height: 1.4;">
                    <li>Carl liest die Frage vor – die Antworten sind zunächst verborgen.</li>
                    <li>Sobald die Sektionaltore herunterfahren, beginnt der Punktezähler von 1000 auf 200 Punkte zu schrumpfen.</li>
                    <li>Sei schnell und klicke auf die richtige Antwort, um maximale Punkte abzuräumen!</li>
                </ul>
            `;
            lobbyArea.style.display = 'none';
            explainArea.style.display = 'block';
            document.getElementById('quizGamePlayArea').style.display = 'none';
            document.getElementById('quizGameOverArea').style.display = 'none';
            document.getElementById('quizCountdownArea').style.display = 'none';
        } else {
            // Fallback
            window.startCountdownTimer();
        }
    };

    /**
     * Führt den pulsierenden 3-Sekunden-Countdown aus.
     */
    window.startCountdownTimer = function () {
        const explainArea = document.getElementById('quizExplanationArea');
        const countdownArea = document.getElementById('quizCountdownArea');
        const countdownCircle = document.getElementById('countdownCircle');
        
        if (explainArea) explainArea.style.display = 'none';
        
        if (!countdownArea || !countdownCircle) {
            window.startQuizPlayEngine();
            return;
        }
        
        countdownArea.style.display = 'flex';
        
        let count = 3;
        countdownCircle.innerText = count;
        countdownCircle.style.transform = "scale(1.2)";
        setTimeout(() => { countdownCircle.style.transform = "scale(1)"; }, 150);

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownCircle.innerText = count;
                countdownCircle.style.transform = "scale(1.2)";
                setTimeout(() => { countdownCircle.style.transform = "scale(1)"; }, 150);
            } else {
                clearInterval(interval);
                countdownArea.style.display = 'none';
                window.startQuizPlayEngine();
            }
        }, 1000);
    };

    /**
     * Bringt den Spieler zurück in die Lobby.
     */
    window.resetToLobby = function () {
        window.isQuizGameActive = false;
        document.getElementById('quizGameOverArea').style.display = 'none';
        document.getElementById('quizExplanationArea').style.display = 'none';
        document.getElementById('quizCountdownArea').style.display = 'none';
        document.getElementById('quizGamePlayArea').style.display = 'none';
        document.getElementById('quizLobbyArea').style.display = 'block';
        window.updateLobbyQuestionsCount();
    };

    /**
     * Startet ein neues Spiel im aktuell gewählten Modus mit Countdown.
     */
    window.restartCurrentGameMode = function () {
        document.getElementById('quizGameOverArea').style.display = 'none';
        window.startCountdownTimer();
    };

    // --- FRAGEN ERSTELLEN (ADMIN GENERATOR) ---

    window.generateQuizQuestions = async function () {
        const apiKeyInput = document.getElementById('quizGeminiApiKey');
        const memoTextNode = document.getElementById('quizMemoText');
        const categorySelect = document.getElementById('quizCategorySelect');

        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
        const memoText = memoTextNode ? memoTextNode.value.trim() : "";
        generatorCategory = categorySelect ? categorySelect.value : "Hörmann Allgemein";

        if (!apiKey) {
            alert("Bitte geben Sie Ihren Gemini API-Key ein.");
            return;
        }
        if (!memoText) {
            alert("Bitte geben Sie einen Memo-Text ein, aus dem Fragen generiert werden sollen.");
            return;
        }

        // Key dauerhaft lokal sichern
        localStorage.setItem('quiz_gemini_api_key', apiKey);

        // UI-Ladezustand aktivieren
        const btnGen = document.getElementById('btnGenerateQuizQuestions');
        const loader = document.getElementById('quizGenerateLoading');
        const preview = document.getElementById('quizPreviewArea');

        if (btnGen) btnGen.disabled = true;
        if (loader) loader.style.display = 'block';
        if (preview) preview.style.display = 'none';

        try {
            const generatedData = await callGeminiAPI(apiKey, memoText, generatorCategory);
            currentGeneratedQuestions = generatedData;
            
            // Render Preview Cards
            renderQuestionPreview();
            
            if (loader) loader.style.display = 'none';
            if (preview) preview.style.display = 'block';
        } catch (err) {
            alert("Fehler bei der Generierung: " + err.message);
            console.error(err);
            if (loader) loader.style.display = 'none';
        } finally {
            if (btnGen) btnGen.disabled = false;
        }
    };

    /**
     * Sendet den API-Request an Gemini 3.1 Flash Lite.
     */
    async function callGeminiAPI(apiKey, text, category) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

        const systemPrompt = `Du bist der ultimative Quiz-Master für das Hörmann-Unternehmensquiz "Hörmann, das Quiz - Sicher geraten!" im sarkastischen und humorvollen Stil der legendären Quiz-Reihe "You Don't Know Jack" (YDKJ). 
Deine Aufgabe ist es, aus dem übergebenen Memo/Text genau 3 Multiple-Choice-Fragen zu erstellen. 

Tonfall & Spielregeln (Der YDKJ-Vibe):
1. Sei witzig, ironisch, frech und schreibe mit einer gesunden Portion Humor. Verwende Wortspiele und stelle Bezüge her, die um die Ecke gedacht sind.
2. Die Fragen dürfen gerne auch etwas länger und detaillierter sein, um eine kleine humorvolle Geschichte oder einen spannenden Kontext aufzubauen. Halte sie packend, ohne jedoch unnötig abzuschweifen.
3. Die Antwortmöglichkeiten müssen REGULÄR REALISTISCH und anspruchsvoll bleiben! Vermeide allzu alberne oder offensichtlich abwegige Optionen, die man sofort durch einfaches Ausschlussverfahren oder Allgemeinwissen entlarven kann. Die Mischung der falschen Antworten muss täuschend echt klingen (z.B. nah beieinander liegende Zeiträume, plausible Fachbegriffe oder typische Verwechslungen), sodass man wirklich Bescheid wissen oder scharf nachdenken muss, um die richtige Antwort zu finden.
4. Struktur der Fragen:
   - Frage 1: Eine klassische Wissensfrage, verpackt in eine charmante/lustige Story.
   - Frage 2: Eine witzige, doppeldeutige Frage mit kniffligen, realistischen Antwortmöglichkeiten, bei der man genau aufpassen muss.
   - Frage 3: Eine verrückte, um die Ecke gedachte "Kombinationsfrage" oder ein humorvoller Bezug zur Kategorie: "${category}".

Rückgabe-Format:
Antworte AUSSCHLIESSLICH im validen JSON-Format als ein Array mit genau 3 Objekten. Verwende keine Markdown-Formatierungen (wie \`\`\`json ...) im Output. 

Jedes Objekt MUSS exakt folgende Struktur haben:
{
  "questionText": "Die humorvolle Frage...",
  "answers": [
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4"
  ],
  "correctAnswerIndex": 0, // Eine Zahl von 0 bis 3, die auf die korrekte Antwort zeigt
  "explanation": "Kurze, lustige Explanation, warum diese Antwort stimmt (basierend auf dem Memo)."
}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: systemPrompt },
                        { text: `Hier ist das Memo:\n\n${text}` }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const errMsg = errJson?.error?.message || response.statusText;
            throw new Error(`Gemini-API Fehler: ${response.status} - ${errMsg}`);
        }

        const resData = await response.json();
        const responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error("Ungültige Antwort von der Gemini-API erhalten.");
        }

        // Eventuelle Markdown-Fences entfernen, falls das Modell sie trotz Anweisung ausgegeben hat
        let cleanText = responseText.trim();
        if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        try {
            const parsed = JSON.parse(cleanText);
            if (!Array.isArray(parsed) || parsed.length !== 3) {
                throw new Error("Die KI hat nicht exakt 3 Fragen zurückgegeben.");
            }
            return parsed;
        } catch (e) {
            console.error("Parse Fehler des KI-JSONs. Rohdaten:", cleanText);
            throw new Error("Fehler beim Parsen der generierten Fragen: Das KI-Ergebnis war kein gültiges JSON-Fragen-Array.");
        }
    }

    /**
     * Rendert die generierten Fragen in der Vorschau-Sektion als interaktive Karten.
     */
    function renderQuestionPreview() {
        const container = document.getElementById('quizGeneratedQuestionsContainer');
        if (!container) return;

        container.innerHTML = "";

        currentGeneratedQuestions.forEach((q, qIdx) => {
            const card = document.createElement('div');
            card.style.cssText = "background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;";

            let badgeText = "Klassiker";
            if (qIdx === 1) badgeText = "Querdenker";
            if (qIdx === 2) badgeText = "Kategorie-Spezial";

            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">
                    <span style="font-weight: bold; color: var(--color-tools); font-size: 0.9rem;">Frage ${qIdx + 1} (${badgeText})</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="window.deleteLocalQuestion(${qIdx})" style="background: none; border: none; color: var(--error-red); cursor: pointer; font-size: 1.1rem; padding: 2px 6px; font-weight: bold; transition: transform 0.2s; height: auto; width: auto; line-height: 1;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='none'" title="Diese Frage verwerfen / löschen">🗑️</button>
                        <span class="card-badge" style="background: #eaf4fb; color: var(--hormann-blue); font-size: 0.65rem;">Vorschau</span>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 0.8rem; display: block; margin-bottom: 4px;">Fragetext:</label>
                    <textarea id="editQText_${qIdx}" rows="2" 
                        oninput="window.updateLocalQuestionText(${qIdx}, this.value)"
                        style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:0.85rem; resize:vertical; font-family:sans-serif; line-height:1.4;">${escapeHtml(q.questionText)}</textarea>
                </div>

                <label style="font-weight: bold; font-size: 0.8rem; display: block; margin-bottom: 6px;">Antwortoptionen (korrekte links anhaken):</label>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
            `;

            q.answers.forEach((ans, ansIdx) => {
                const isCorrect = q.correctAnswerIndex === ansIdx;
                html += `
                    <div style="display: flex; gap: 10px; align-items: center; width: 100%;">
                        <input type="radio" name="correctRadio_${qIdx}" id="correctRadio_${qIdx}_${ansIdx}" 
                            ${isCorrect ? 'checked' : ''} 
                            onchange="window.updateLocalCorrectIndex(${qIdx}, ${ansIdx})"
                            style="cursor: pointer; width: 18px; height: 18px;">
                        <input type="text" value="${escapeHtml(ans)}" 
                            oninput="window.updateLocalAnswerText(${qIdx}, ${ansIdx}, this.value)"
                            style="flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 0.8rem; ${isCorrect ? 'border-color: var(--friendly-green); background-color: #f4faf6;' : ''}">
                    </div>
                `;
            });

            html += `
                </div>

                <div>
                    <label style="font-weight: bold; font-size: 0.8rem; display: block; margin-bottom: 4px;">Lustige Erklärung für die Lösung:</label>
                    <textarea id="editQExplain_${qIdx}" rows="2" 
                        oninput="window.updateLocalQuestionExplanation(${qIdx}, this.value)"
                        style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:0.8rem; resize:vertical;">${escapeHtml(q.explanation || '')}</textarea>
                </div>
            `;

            card.innerHTML = html;
            container.appendChild(card);
        });
    }

    // --- GENERATOR LOKALE UPDATE HANDLER ---

    window.updateLocalQuestionText = function (qIdx, text) {
        if (currentGeneratedQuestions[qIdx]) {
            currentGeneratedQuestions[qIdx].questionText = text;
        }
    };

    window.updateLocalAnswerText = function (qIdx, ansIdx, text) {
        if (currentGeneratedQuestions[qIdx] && currentGeneratedQuestions[qIdx].answers) {
            currentGeneratedQuestions[qIdx].answers[ansIdx] = text;
        }
    };

    window.updateLocalCorrectIndex = function (qIdx, ansIdx) {
        if (currentGeneratedQuestions[qIdx]) {
            currentGeneratedQuestions[qIdx].correctAnswerIndex = ansIdx;
            renderQuestionPreview();
        }
    };

    window.updateLocalQuestionExplanation = function (qIdx, text) {
        if (currentGeneratedQuestions[qIdx]) {
            currentGeneratedQuestions[qIdx].explanation = text;
        }
    };

    window.deleteLocalQuestion = function (qIdx) {
        if (!confirm("Möchtest du diese generierte Frage wirklich verwerfen?")) return;
        currentGeneratedQuestions.splice(qIdx, 1);
        renderQuestionPreview();
    };

    window.saveQuizQuestionsToDB = async function () {
        const db = window.db;
        const auth = window.auth;

        if (!db) {
            alert("Fehler: Firestore-Datenbank wurde nicht gefunden.");
            return;
        }

        for (let i = 0; i < currentGeneratedQuestions.length; i++) {
            const q = currentGeneratedQuestions[i];
            if (!q.questionText.trim()) {
                alert(`Frage ${i + 1} besitzt keinen Fragetext!`);
                return;
            }
            if (q.answers.some(a => !a.trim())) {
                alert(`Frage ${i + 1} besitzt leere Antwortmöglichkeiten!`);
                return;
            }
        }

        const btnSave = document.getElementById('btnSaveQuizQuestions');
        const originalText = btnSave.innerText;
        btnSave.disabled = true;
        btnSave.innerText = "⏳ Speichere in Firestore...";

        try {
            const user = auth?.currentUser;
            const authorUid = user ? user.uid : "system-admin";

            let saveCount = 0;
            for (const q of currentGeneratedQuestions) {
                await addDoc(collection(db, "questions"), {
                    questionText: q.questionText.trim(),
                    answers: q.answers.map(a => a.trim()),
                    correctAnswerIndex: q.correctAnswerIndex,
                    explanation: (q.explanation || "").trim(),
                    category: generatorCategory,
                    createdAt: serverTimestamp(),
                    authorUid: authorUid,
                    tags: [generatorCategory.toLowerCase().replace(/\s+/g, "_")]
                });
                saveCount++;
            }

            alert(`Erfolgreich! ${saveCount} Fragen wurden in der Kategorie "${generatorCategory}" in Firestore gespeichert.`);
            
            document.getElementById('quizMemoText').value = "";
            document.getElementById('quizPreviewArea').style.display = "none";
            currentGeneratedQuestions = [];
        } catch (e) {
            alert("Fehler beim Speichern in Firestore: " + e.message);
            console.error(e);
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = originalText;
        }
    };

    // --- HELPERS ---

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- DATENBANK-MANAGER LOGIK & TABS ---

    window.switchQuizManagerTab = function (subTabId) {
        document.querySelectorAll('#quizManagerArea .sub-nav-btn').forEach(btn => btn.classList.remove('active'));
        
        if (subTabId === 'questions') {
            document.getElementById('btnQuizSubInnerQuestions').classList.add('active');
            document.getElementById('quizManagerQuestionsSection').style.display = 'block';
            document.getElementById('quizManagerFeedbackSection').style.display = 'none';
            document.getElementById('quizManagerAvatarsSection').style.display = 'none';
            window.loadQuestionsManagerTable();
        } else if (subTabId === 'feedback') {
            document.getElementById('btnQuizSubInnerFeedback').classList.add('active');
            document.getElementById('quizManagerQuestionsSection').style.display = 'none';
            document.getElementById('quizManagerFeedbackSection').style.display = 'block';
            document.getElementById('quizManagerAvatarsSection').style.display = 'none';
            window.loadFeedbackManagerTable();
        } else if (subTabId === 'avatars') {
            document.getElementById('btnQuizSubInnerAvatars').classList.add('active');
            document.getElementById('quizManagerQuestionsSection').style.display = 'none';
            document.getElementById('quizManagerFeedbackSection').style.display = 'none';
            document.getElementById('quizManagerAvatarsSection').style.display = 'block';
            window.loadAvatarModerationGrid();
        }
    };

    let managerLoadedQuestions = [];

    window.loadQuestionsManagerTable = async function () {
        const db = window.db;
        if (!db) return;

        const tbody = document.getElementById('questionsManagerTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">Lade Fragendatenbank... 🔄</td></tr>`;

        try {
            const querySnapshot = await getDocs(collection(db, "questions"));
            managerLoadedQuestions = [];
            querySnapshot.forEach(docSnap => {
                managerLoadedQuestions.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sortieren nach Erstellungsdatum absteigend
            managerLoadedQuestions.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            window.filterQuestionsTable();
        } catch (e) {
            console.error("Fehler beim Laden des Fragen-Managers:", e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--error-red);">Pool konnte nicht geladen werden ❌</td></tr>`;
        }
    };

    window.filterQuestionsTable = function () {
        const queryText = document.getElementById('questionsSearchInput')?.value.toLowerCase() || '';
        const catFilter = document.getElementById('questionsCategoryFilter')?.value || 'all';
        const tbody = document.getElementById('questionsManagerTableBody');

        if (!tbody) return;
        tbody.innerHTML = "";

        let filtered = [...managerLoadedQuestions];

        if (catFilter !== 'all') {
            filtered = filtered.filter(q => {
                const cats = q.categories || (q.category ? [q.category] : []);
                return cats.includes(catFilter);
            });
        }

        if (queryText) {
            filtered = filtered.filter(q => {
                return q.questionText.toLowerCase().includes(queryText) || 
                       (q.explanation && q.explanation.toLowerCase().includes(queryText));
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#666;">Keine Fragen entsprechen den Suchkriterien.</td></tr>`;
            return;
        }

        filtered.forEach(q => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #e2e8f0";

            const cats = q.categories || (q.category ? [q.category] : ["Allgemein"]);
            const catBadges = cats.map(c => `<span class="card-badge" style="background:#f1f5f9; color:#475569; font-size:0.7rem; margin-right:4px; display:inline-block; margin-top:2px;">${escapeHtml(c)}</span>`).join('');

            tr.innerHTML = `
                <td style="padding:10px; font-weight:600; line-height:1.4;">${escapeHtml(q.questionText)}</td>
                <td style="padding:10px; vertical-align:middle;">${catBadges}</td>
                <td style="padding:10px; text-align:center; vertical-align:middle;">
                    <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
                        <button class="btn-edit" onclick="window.openEditQuestionModal('${q.id}')" title="Frage bearbeiten" style="padding: 4px 8px; font-size: 0.8rem; margin:0; height:auto;">✏️ Bearbeiten</button>
                        <button class="btn-delete" onclick="window.deleteQuestionFromManager('${q.id}')" title="Löschen" style="padding: 4px 8px; font-size: 0.8rem; margin:0; height:auto;">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    window.openEditQuestionModal = function (questionId) {
        const q = managerLoadedQuestions.find(item => item.id === questionId);
        if (!q) return;

        document.getElementById('editModalQuestionId').value = q.id;
        document.getElementById('editModalQuestionText').value = q.questionText;
        document.getElementById('editModalExplanation').value = q.explanation || '';

        q.answers.forEach((ans, idx) => {
            const input = document.getElementById(`editModalAnswer_${idx}`);
            if (input) input.value = ans;
            
            const radio = document.getElementById(`editModalCorrectRadio_${idx}`);
            if (radio) radio.checked = (q.correctAnswerIndex === idx);
        });

        // Kategorien-Grid befüllen (Mehrfachauswahl Checkboxen!)
        const categoriesList = [
            "Werk Ichtershausen",
            "Werk Brockhagen",
            "Werk Amshausen",
            "Werk Eckelhausen",
            "Werk Brandis",
            "Werk Antriebstechnik",
            "Werk HUGA",
            "Werk Freisen",
            "Werk Werne",
            "Hörmann Allgemein"
        ];

        const qCats = q.categories || (q.category ? [q.category] : []);
        const catsGrid = document.getElementById('editModalCategoriesGrid');
        if (catsGrid) {
            catsGrid.innerHTML = "";
            categoriesList.forEach((c, idx) => {
                const label = document.createElement('label');
                label.style.cssText = "display: flex; gap: 8px; align-items: center; font-size: 0.8rem; cursor: pointer;";
                
                const cb = document.createElement('input');
                cb.type = "checkbox";
                cb.value = c;
                cb.className = "edit-modal-category-checkbox";
                cb.checked = qCats.includes(c);
                
                label.appendChild(cb);
                label.appendChild(document.createTextNode(c));
                catsGrid.appendChild(label);
            });
        }

        document.getElementById('editQuestionModal').style.display = 'flex';
    };

    window.closeEditQuestionModal = function () {
        document.getElementById('editQuestionModal').style.display = 'none';
    };

    window.saveEditedQuestionDirectly = async function () {
        const db = window.db;
        if (!db) return;

        const qId = document.getElementById('editModalQuestionId').value;
        const qText = document.getElementById('editModalQuestionText').value.trim();
        const explain = document.getElementById('editModalExplanation').value.trim();

        if (!qText) {
            alert("Der Fragetext darf nicht leer sein!");
            return;
        }

        const answers = [];
        let correctIdx = -1;

        for (let i = 0; i < 4; i++) {
            const ans = document.getElementById(`editModalAnswer_${i}`).value.trim();
            if (!ans) {
                alert(`Antwort ${i + 1} darf nicht leer sein!`);
                return;
            }
            answers.push(ans);

            const radio = document.getElementById(`editModalCorrectRadio_${i}`);
            if (radio && radio.checked) {
                correctIdx = i;
            }
        }

        if (correctIdx === -1) {
            alert("Bitte wähle eine korrekte Antwort aus!");
            return;
        }

        // Ausgewählte Kategorien einsammeln
        const checkedCategories = [];
        document.querySelectorAll('.edit-modal-category-checkbox').forEach(cb => {
            if (cb.checked) {
                checkedCategories.push(cb.value);
            }
        });

        if (checkedCategories.length === 0) {
            alert("Bitte wähle mindestens eine Kategorie für die Frage aus!");
            return;
        }

        const btnSave = document.getElementById('btnSaveModalQuestion');
        btnSave.disabled = true;
        btnSave.innerText = "⏳ Speichere...";

        try {
            await updateDoc(doc(db, "questions", qId), {
                questionText: qText,
                answers: answers,
                correctAnswerIndex: correctIdx,
                explanation: explain,
                categories: checkedCategories,
                category: checkedCategories[0] // Fallback Abwärtskompatibilität
            });

            alert("Frage erfolgreich aktualisiert!");
            window.closeEditQuestionModal();
            window.loadQuestionsManagerTable();
        } catch (e) {
            alert("Fehler beim Speichern der Frage: " + e.message);
            console.error(e);
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = "Speichern 💾";
        }
    };

    window.deleteQuestionFromManager = async function (questionId) {
        const db = window.db;
        if (!db) return;

        if (!confirm("Möchtest du diese Frage wirklich unwiderruflich aus der Spieledatenbank löschen?")) return;

        try {
            await deleteDoc(doc(db, "questions", questionId));
            alert("Frage erfolgreich gelöscht!");
            window.loadQuestionsManagerTable();
        } catch (e) {
            alert("Fehler beim Löschen der Frage: " + e.message);
            console.error(e);
        }
    };

    // --- FEEDBACK-SPRÜCHE DATENBANK LOGIK ---

    let managerLoadedFeedback = [];

    window.loadFeedbackManagerTable = async function () {
        const db = window.db;
        if (!db) return;

        const tbody = document.getElementById('feedbackManagerTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">Lade Feedback-Sprüche... 🔄</td></tr>`;

        try {
            const querySnapshot = await getDocs(collection(db, "feedback_pool"));
            managerLoadedFeedback = [];
            querySnapshot.forEach(docSnap => {
                managerLoadedFeedback.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sortieren nach Typ und Erstellung absteigend
            managerLoadedFeedback.sort((a, b) => {
                if (a.type !== b.type) return a.type.localeCompare(b.type);
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            tbody.innerHTML = "";

            if (managerLoadedFeedback.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#666;">Keine Feedback-Sprüche in der Datenbank. Die Standard-Sprüche aus dem Code werden als Fallback genutzt.</td></tr>`;
                return;
            }

            managerLoadedFeedback.forEach(f => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #e2e8f0";

                const isCorrect = f.type === 'correct';
                const typeBadge = isCorrect ? 
                    `<span class="card-badge" style="background:#f4faf6; color:var(--friendly-green); font-size:0.75rem;">🎉 Richtig</span>` :
                    `<span class="card-badge" style="background:#fdf2f2; color:var(--error-red); font-size:0.75rem;">😢 Falsch</span>`;

                tr.innerHTML = `
                    <td style="padding:10px; vertical-align:middle;">${typeBadge}</td>
                    <td style="padding:10px; font-weight:600; line-height:1.4;">${escapeHtml(f.text)}</td>
                    <td style="padding:10px; text-align:center; vertical-align:middle;">
                        <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
                            <button class="btn-edit" onclick="window.editFeedbackDirectly('${f.id}')" title="Bearbeiten" style="padding: 4px 8px; font-size: 0.8rem; margin:0; height:auto;">✏️ Bearbeiten</button>
                            <button class="btn-delete" onclick="window.deleteFeedbackDirectly('${f.id}')" title="Löschen" style="padding: 4px 8px; font-size: 0.8rem; margin:0; height:auto;">🗑️ Löschen</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error("Fehler beim Laden des Feedback-Managers:", e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--error-red);">Pool konnte nicht geladen werden ❌</td></tr>`;
        }
    };

    window.saveNewFeedbackDirectly = async function () {
        const db = window.db;
        if (!db) return;

        const textInput = document.getElementById('newFeedbackText');
        const text = textInput ? textInput.value.trim() : "";
        const type = document.getElementById('newFeedbackType')?.value || "correct";

        if (!text) {
            alert("Bitte geben Sie einen Spruch-Text ein!");
            return;
        }

        try {
            await addDoc(collection(db, "feedback_pool"), {
                text: text,
                type: type,
                createdAt: serverTimestamp()
            });

            if (textInput) textInput.value = "";
            alert("Feedback-Spruch erfolgreich gespeichert!");
            
            window.loadFeedbackManagerTable();
            loadFeedbackPoolFromFirestore();
        } catch (e) {
            alert("Fehler beim Hinzufügen des Spruchs: " + e.message);
            console.error(e);
        }
    };

    window.deleteFeedbackDirectly = async function (feedbackId) {
        const db = window.db;
        if (!db) return;

        if (!confirm("Möchtest du diesen Spruch wirklich löschen?")) return;

        try {
            await deleteDoc(doc(db, "feedback_pool", feedbackId));
            alert("Spruch erfolgreich gelöscht!");
            
            window.loadFeedbackManagerTable();
            loadFeedbackPoolFromFirestore();
        } catch (e) {
            alert("Fehler beim Löschen des Spruchs: " + e.message);
            console.error(e);
        }
    };

    window.editFeedbackDirectly = async function (feedbackId) {
        const db = window.db;
        if (!db) return;

        const f = managerLoadedFeedback.find(item => item.id === feedbackId);
        if (!f) return;

        const newText = prompt("Feedback-Spruch bearbeiten:", f.text);
        if (newText === null) return; // Abgebrochen

        const cleanText = newText.trim();
        if (!cleanText) {
            alert("Der Spruch-Text darf nicht leer sein!");
            return;
        }

        try {
            await updateDoc(doc(db, "feedback_pool", feedbackId), {
                text: cleanText
            });
            alert("Spruch erfolgreich aktualisiert!");
            
            window.loadFeedbackManagerTable();
            loadFeedbackPoolFromFirestore();
        } catch (e) {
            alert("Fehler beim Aktualisieren des Spruchs: " + e.message);
            console.error(e);
        }
    };

    window.generateFeedbackWithGemini = async function () {
        const db = window.db;
        if (!db) return;

        const apiKey = localStorage.getItem('quiz_gemini_api_key') || "";
        if (!apiKey) {
            alert("Bitte geben Sie zuerst unter dem Tab 'Fragen erstellen' Ihren Gemini API-Key ein, damit dieser lokal gespeichert wird!");
            return;
        }

        const type = document.getElementById('aiFeedbackType')?.value || "correct";

        const btnGen = document.getElementById('btnGenerateFeedbackAI');
        const loader = document.getElementById('feedbackAiLoading');

        if (btnGen) btnGen.disabled = true;
        if (loader) loader.style.display = 'block';

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
            const typeText = type === 'correct' ? "richtige Antworten (Lob, Anerkennung, humorvolle Übertreibung)" : "falsche Antworten (Spott, Ironie, witziges Schimpfen)";
            
            const systemPrompt = `Du bist ein sarkastischer, schlagfertiger und humorvoller Autor für das Hörmann-Unternehmensquiz "Hörmann, das Quiz - Sicher geraten!". Die Zielgruppe sind Mitarbeiter in den Werken und Niederlassungen. 
Deine Aufgabe ist es, genau 5 verschiedene, extrem witzige, leicht sarkastische und freche Kurz-Sprüche (maximal 15 Wörter pro Spruch) für ${typeText} zu dichten. Verwende gerne thematisch passende Emojis (z.B. Tore, Paneele, Werkzeuge, Federspannung, Carl, Kantinen-Kaffee, Sascha).

Rückgabe-Format:
Antworte AUSSCHLIESSLICH im validen JSON-Format als ein Array mit genau 5 Strings. Verwende keine Markdown-Formatierungen (wie \`\`\`json ...) im Output.`;

            const requestBody = {
                contents: [
                    {
                        parts: [
                            { text: systemPrompt },
                            { text: "Dichte 5 Sprüche:" }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API Fehler: ${response.status}`);
            }

            const resData = await response.json();
            const responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!responseText) throw new Error("Keine Daten erhalten.");

            let cleanText = responseText.trim();
            if (cleanText.startsWith("```")) {
                cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(cleanText);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error("KI hat kein gültiges Sprüche-Array generiert.");
            }

            let saveCount = 0;
            for (const text of parsed) {
                await addDoc(collection(db, "feedback_pool"), {
                    text: text.trim(),
                    type: type,
                    createdAt: serverTimestamp()
                });
                saveCount++;
            }

            alert(`Erfolgreich! ${saveCount} neue KI-Sprüche wurden in Firestore eingetragen.`);
            
            window.loadFeedbackManagerTable();
            loadFeedbackPoolFromFirestore();
        } catch (err) {
            alert("Fehler bei der KI-Generierung: " + err.message);
            console.error(err);
        } finally {
            if (btnGen) btnGen.disabled = false;
            if (loader) loader.style.display = 'none';
        }
    };

    async function calculateUserRank(score, mode, category) {
        const db = window.db;
        if (!db) return 1;
        try {
            // Abfrage ohne komplexe Filter, um Index-Fehler zu vermeiden (Limit 300 ist performant)
            const q = query(collection(db, "leaderboards"), orderBy("score", "desc"), limit(300));
            const snap = await getDocs(q);
            
            let filteredScores = [];
            snap.forEach(docSnap => {
                const d = docSnap.data();
                // Admins ausschließen
                if (d.userRole === 'admin' || d.userRole === 'developer') return;
                
                // Filtern nach Modus und Kategorie
                if (d.mode === mode && (category === 'all' || d.category === category)) {
                    filteredScores.push(d.score);
                }
            });
            
            // Finde heraus, wie viele Scores höher sind als der aktuelle Score
            const higherCount = filteredScores.filter(s => s > score).length;
            return higherCount + 1;
        } catch (e) {
            console.error("Fehler bei der Rank-Ermittlung:", e);
            return 1;
        }
    }

    window.startConfettiRain = function () {
        let canvas = document.getElementById('confettiCanvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'confettiCanvas';
            canvas.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 99999;";
            document.body.appendChild(canvas);
        }
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22'];
        const particles = [];
        for (let i = 0; i < 120; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * -height - 20,
                r: Math.random() * 5 + 3,
                d: Math.random() * height,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.05 + 0.02,
                tiltAngle: 0
            });
        }

        let animationFrame;
        let startTime = Date.now();

        function draw() {
            ctx.clearRect(0, 0, width, height);
            let active = false;

            particles.forEach((p, idx) => {
                p.tiltAngle += p.tiltAngleIncremental;
                p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2.5;
                p.x += Math.sin(p.tiltAngle);
                p.tilt = Math.sin(p.tiltAngle - idx / 3) * 12;

                if (p.y < height) {
                    active = true;
                }

                ctx.beginPath();
                ctx.lineWidth = p.r;
                ctx.strokeStyle = p.color;
                ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                ctx.stroke();
            });

            // Beende nach 6 Sekunden oder wenn alle Partikel unten sind
            if (active && Date.now() - startTime < 6000) {
                animationFrame = requestAnimationFrame(draw);
            } else {
                cancelAnimationFrame(animationFrame);
                window.removeEventListener('resize', handleResize);
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            }
        }
        draw();
    };
    window.getAvatarSvg = function (seed) {
        // Deterministic pseudo-random number generator based on seed
        let currentSeed = seed;
        function random() {
            let x = Math.sin(currentSeed++) * 10000;
            return x - Math.floor(x);
        }

        // 1. Gradients background
        const bgGradients = [
            ['#3498db', '#2980b9'], // Ocean Blue
            ['#1abc9c', '#16a085'], // Teal
            ['#2ecc71', '#27ae60'], // Emerald Green
            ['#9b59b6', '#8e44ad'], // Amethyst Purple
            ['#e67e22', '#d35400'], // Solar Orange
            ['#e74c3c', '#c0392b'], // Crimson Red
            ['#1ad1d7', '#0097a7'], // Cyan Accent
            ['#ff8a80', '#e53935'], // Bright Rose
            ['#a1887f', '#4e342e'], // Wooden Brown
            ['#90a4ae', '#37474f']  // Sleek Slate
        ];
        const bg = bgGradients[Math.floor(random() * bgGradients.length)];
        
        // 2. Face Skin Colors
        const skinColors = ['#f3c299', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#eed098', '#dfc18d'];
        const skin = skinColors[Math.floor(random() * skinColors.length)];
        
        // 3. Eyes Styles (Standard, Winking, Happy, Glasses)
        const eyeStyles = [
            // Standard eyes
            '<circle cx="85" cy="95" r="5" fill="#333"/><circle cx="115" cy="95" r="5" fill="#333"/>',
            // Winking eye
            '<path d="M78 95 Q85 90 92 95" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="115" cy="95" r="5" fill="#333"/>',
            // Happy closed eyes
            '<path d="M78 95 Q85 88 92 95" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M108 95 Q115 88 122 95" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>',
            // Glasses
            '<circle cx="85" cy="95" r="9" stroke="#333" stroke-width="2.5" fill="none"/><circle cx="115" cy="95" r="9" stroke="#333" stroke-width="2.5" fill="none"/><line x1="94" y1="95" x2="106" y2="95" stroke="#333" stroke-width="2.5"/>'
        ];
        const eyes = eyeStyles[Math.floor(random() * eyeStyles.length)];
        
        // 4. Mouth Styles (Smile, Big smile, Whistle, Smirk, Neutral)
        const mouthStyles = [
            // Smile
            '<path d="M88 122 Q100 135 112 122" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
            // Big open smile
            '<path d="M86 120 Q100 135 114 120 Z" fill="#e74c3c" stroke="#333" stroke-width="2" stroke-linecap="round"/>',
            // Whistle/O mouth
            '<circle cx="100" cy="122" r="5" stroke="#333" stroke-width="3" fill="none"/>',
            // Smirk
            '<path d="M90 125 Q105 120 112 125" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>',
            // Straight neutral
            '<line x1="90" y1="122" x2="110" y2="122" stroke="#333" stroke-width="3" stroke-linecap="round"/>'
        ];
        const mouth = mouthStyles[Math.floor(random() * mouthStyles.length)];

        // 5. Hair & Headwear Styles
        const hairColors = ['#2c3e50', '#7f8c8d', '#e67e22', '#d35400', '#f1c40f', '#34495e', '#a0522d', '#8b4513'];
        const hc = hairColors[Math.floor(random() * hairColors.length)];
        
        const hairStyles = [
            // Short hair
            `<path d="M70 70 Q100 45 130 70 Q135 85 130 90 Q120 75 100 80 Q80 75 70 90 Z" fill="${hc}"/>`,
            // Curly / Afro hair
            `<circle cx="75" cy="70" r="15" fill="${hc}"/><circle cx="100" cy="60" r="18" fill="${hc}"/><circle cx="125" cy="70" r="15" fill="${hc}"/><circle cx="85" cy="62" r="15" fill="${hc}"/><circle cx="115" cy="62" r="15" fill="${hc}"/>`,
            // Bald / No hair
            '',
            // Long hair
            `<path d="M68 85 V125 Q68 135 75 135 Q80 120 80 80 Z M132 85 V125 Q132 135 125 135 Q120 120 120 80 Z" fill="${hc}"/><path d="M70 70 Q100 50 130 70 Z" fill="${hc}"/>`,
            // Cap / Basecap
            `<path d="M68 70 Q100 40 132 70 Z" fill="#e74c3c"/><path d="M50 70 Q100 65 135 60" stroke="#c0392b" stroke-width="6" fill="none" stroke-linecap="round"/>`,
            // Bauhelm (Yellow construction helmet)
            `<path d="M66 72 C66 45 134 45 134 72 Z" fill="#f1c40f"/><rect x="62" y="70" width="76" height="5" rx="2" fill="#d35400"/><rect x="97" y="42" width="6" height="28" fill="#f39c12"/>`,
            // Safety helmet white
            `<path d="M66 72 C66 45 134 45 134 72 Z" fill="#ffffff"/><rect x="62" y="70" width="76" height="5" rx="2" fill="#cbd5e1"/><rect x="97" y="42" width="6" height="28" fill="#e2e8f0"/>`
        ];
        const hair = hairStyles[Math.floor(random() * hairStyles.length)];

        // 6. Body & Clothes
        const suitColors = ['#34495e', '#2c3e50', '#1abc9c', '#e74c3c', '#9b59b6', '#3498db', '#f39c12'];
        const sc = suitColors[Math.floor(random() * suitColors.length)];
        
        // Safety vest (Warnweste) or regular crew t-shirt
        const isSafetyVest = random() > 0.65;
        const clothes = isSafetyVest ? 
            `<path d="M60 160 C60 140 70 135 100 135 C130 135 140 140 140 160 Z" fill="#ff7f00"/>
             <path d="M85 135 L80 160 M115 135 L120 160" stroke="#ffff00" stroke-width="10"/>
             <path d="M85 135 L80 160 M115 135 L120 160" stroke="#cbd5e1" stroke-width="4"/>
             <path d="M60 150 H140" stroke="#cbd5e1" stroke-width="6"/>` :
            `<path d="M60 160 C60 140 70 135 100 135 C130 135 140 140 140 160 Z" fill="${sc}"/>
             <path d="M88 135 C92 142 108 142 112 135 Z" fill="${skin}"/>
             <path d="M88 135 Q100 144 112 135" stroke="#1d4ed8" stroke-width="3" fill="none"/>`;

        // 7. Facial Hair (beard)
        const hasBeard = random() > 0.75;
        const beardStyle = hasBeard ? 
            `<path d="M82 116 Q100 136 118 116 Q118 126 100 134 Q82 126 82 116 Z" fill="${hc}" opacity="0.9"/>` : 
            '';

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style="width:100%; height:100%; border-radius:50%; display:block;">
            <defs>
                <linearGradient id="bgGrad_${seed}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${bg[0]}" />
                    <stop offset="100%" stop-color="${bg[1]}" />
                </linearGradient>
            </defs>
            <rect width="200" height="200" fill="url(#bgGrad_${seed})" />
            
            <!-- Neck -->
            <rect x="92" y="120" width="16" height="22" rx="4" fill="${skin}" />
            
            <!-- Clothes -->
            ${clothes}
            
            <!-- Face Back / Ears -->
            <circle cx="70" cy="100" r="10" fill="${skin}"/>
            <circle cx="130" cy="100" r="10" fill="${skin}"/>
            
            <!-- Head Base -->
            <rect x="68" y="75" width="64" height="52" rx="26" fill="${skin}" />
            
            <!-- Beard -->
            ${beardStyle}
            
            <!-- Face features -->
            ${eyes}
            ${mouth}
            
            <!-- Hair / Hat -->
            ${hair}
            
            <!-- Frame circle highlight -->
            <circle cx="100" cy="100" r="98" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="none" />
        </svg>`;
        
        return svg;
    };

    window.openUserSettingsModal = async function () {
        const db = window.db;
        const auth = window.auth;
        if (!db || !auth || !auth.currentUser) {
            alert("Du musst eingeloggt sein, um deine Einstellungen zu ändern!");
            return;
        }

        const user = auth.currentUser;
        
        // Schließe das Profil-Dropdown
        const menu = document.getElementById('profileMenu');
        if (menu) menu.style.display = 'none';

        // 1. Hole moderierte Avatare (Zensur-Liste)
        let disabledSeeds = [];
        try {
            const configSnap = await getDoc(doc(db, "system_config", "moderated_avatars"));
            if (configSnap.exists()) {
                disabledSeeds = configSnap.data().disabledSeeds || [];
            }
        } catch (e) {
            console.error("Fehler beim Laden der Avatar-Zensurliste:", e);
        }

        // 2. Lade aktuelle Benutzerdaten aus Firestore
        let currentSeed = 1;
        let nameMode = "full";
        let showBranch = true;

        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                currentSeed = data.avatarSeed || 1;
                nameMode = data.nameDisplayMode || "full";
                showBranch = data.showBranchNumber !== false; // Standardmäßig true
            }
        } catch (e) {
            console.error("Fehler beim Laden des Benutzerprofils:", e);
        }

        // 3. Grid mit 100 Avataren befüllen
        const grid = document.getElementById('settingsAvatarGrid');
        if (grid) {
            grid.innerHTML = "";
            for (let i = 1; i <= 100; i++) {
                if (disabledSeeds.includes(i)) continue; // Überspringe gesperrte Avatare

                const div = document.createElement('div');
                div.id = `settingsAvatarItem_${i}`;
                div.style.cssText = "width: 70px; height: 70px; border-radius: 50%; cursor: pointer; padding: 3px; box-sizing: border-box; transition: transform 0.15s ease; border: 3px solid transparent;";
                div.innerHTML = window.getAvatarSvg(i);
                
                if (i === currentSeed) {
                    div.style.borderColor = "var(--hormann-blue)";
                    div.style.transform = "scale(1.05)";
                }

                div.onclick = () => window.selectAvatarInSettings(i);
                grid.appendChild(div);
            }
        }

        // 4. Formularfelder befüllen
        document.getElementById('settingsSelectedAvatarSeed').value = currentSeed;
        
        const radioShort = document.getElementById('settingsNameMode_short');
        const radioFull = document.getElementById('settingsNameMode_full');
        if (nameMode === 'full') {
            if (radioFull) radioFull.checked = true;
        } else {
            if (radioShort) radioShort.checked = true;
        }

        const cbShowBranch = document.getElementById('settingsShowBranchNumber');
        if (cbShowBranch) cbShowBranch.checked = showBranch;

        // 4.5 Abzeichen für den aktuellen User berechnen & einfärben in der Benutzerübersicht
        try {
            const q = query(collection(db, "leaderboards"), where("userId", "==", user.uid));
            const scoreSnap = await getDocs(q);

            let hasPlayed = false;
            let maxScore = 0;
            let hasPlayedUpdate = false;
            let marathonMaxScore = 0;

            scoreSnap.forEach(docSnap => {
                const s = docSnap.data();
                hasPlayed = true;
                maxScore = Math.max(maxScore, s.score);
                if (s.mode === 'update') {
                    hasPlayedUpdate = true;
                }
                if (s.mode === 'marathon') {
                    marathonMaxScore = Math.max(marathonMaxScore, s.score);
                }
            });

            // Torfuchs
            const bTorfuchs = document.getElementById('badgeHunt_torfuchs');
            if (bTorfuchs) {
                if (hasPlayed) {
                    bTorfuchs.innerHTML = "🦊 Torfuchs";
                    bTorfuchs.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #ffeeba; background: #fff3cd; color: #856404; opacity: 1;";
                } else {
                    bTorfuchs.innerHTML = "🔒 🦊 Torfuchs";
                    bTorfuchs.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #d6d8db; background: #e2e3e5; color: #6c757d; opacity: 0.65;";
                }
            }

            // Federspannung
            const bFederspannung = document.getElementById('badgeHunt_federspannung');
            if (bFederspannung) {
                if (maxScore >= 2500) {
                    bFederspannung.innerHTML = "⚡ Federspannung";
                    bFederspannung.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #c3e6cb; background: #d4edda; color: #155724; opacity: 1;";
                } else {
                    bFederspannung.innerHTML = "🔒 ⚡ Federspannung";
                    bFederspannung.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #d6d8db; background: #e2e3e5; color: #6c757d; opacity: 0.65;";
                }
            }

            // Sektions-Guru
            const bSektionsguru = document.getElementById('badgeHunt_sektionsguru');
            if (bSektionsguru) {
                if (maxScore >= 8500) {
                    bSektionsguru.innerHTML = "🌌 Sektions-Guru";
                    bSektionsguru.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #d6d8db; background: #343a40; color: #ffffff; opacity: 1;";
                } else {
                    bSektionsguru.innerHTML = "🔒 🌌 Sektions-Guru";
                    bSektionsguru.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #d6d8db; background: #e2e3e5; color: #6c757d; opacity: 0.65;";
                }
            }

            // Update-Profi
            const bUpdateprofi = document.getElementById('badgeHunt_updateprofi');
            if (bUpdateprofi) {
                if (hasPlayedUpdate) {
                    bUpdateprofi.innerHTML = "📈 Update-Profi";
                    bUpdateprofi.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #b8daff; background: #cce5ff; color: #004085; opacity: 1;";
                } else {
                    bUpdateprofi.innerHTML = "🔒 📈 Update-Profi";
                    bUpdateprofi.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #d6d8db; background: #e2e3e5; color: #6c757d; opacity: 0.65;";
                }
            }

            // Marathon-Legende
            const bMarathon = document.getElementById('badgeHunt_marathon');
            if (bMarathon) {
                if (marathonMaxScore >= 1500) {
                    bMarathon.innerHTML = "❤️ Marathon-Legende";
                    bMarathon.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #f5c6cb; background: #f8d7da; color: #721c24; opacity: 1;";
                } else {
                    bMarathon.innerHTML = "🔒 ❤️ Marathon-Legende";
                    bMarathon.style.cssText = "font-size: 0.72rem; font-weight: bold; padding: 4px 10px; border-radius: 6px; border: 1px solid #d6d8db; background: #e2e3e5; color: #6c757d; opacity: 0.65;";
                }
            }
        } catch (err) {
            console.error("Fehler beim Berechnen der Benutzer-Abzeichen:", err);
        }

        // Modal anzeigen
        document.getElementById('userSettingsModal').style.display = 'flex';
        
        // Nach dem Öffnen zum ausgewählten Avatar scrollen
        setTimeout(() => {
            const activeItem = document.getElementById(`settingsAvatarItem_${currentSeed}`);
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            }
        }, 100);
    };

    window.closeUserSettingsModal = function () {
        document.getElementById('userSettingsModal').style.display = 'none';
    };

    window.selectAvatarInSettings = function (seed) {
        const prevSeed = parseInt(document.getElementById('settingsSelectedAvatarSeed').value);
        
        // Vorheriges Highlight entfernen
        const prevItem = document.getElementById(`settingsAvatarItem_${prevSeed}`);
        if (prevItem) {
            prevItem.style.borderColor = "transparent";
            prevItem.style.transform = "none";
        }

        // Neues Highlight hinzufügen
        const newItem = document.getElementById(`settingsAvatarItem_${seed}`);
        if (newItem) {
            newItem.style.borderColor = "var(--hormann-blue)";
            newItem.style.transform = "scale(1.05)";
        }

        document.getElementById('settingsSelectedAvatarSeed').value = seed;
    };

    window.saveUserSettingsDirectly = async function () {
        const db = window.db;
        const auth = window.auth;
        if (!db || !auth || !auth.currentUser) return;

        const user = auth.currentUser;
        const btnSave = document.getElementById('btnSaveUserSettings');
        btnSave.disabled = true;
        btnSave.innerText = "⏳ Speichere...";

        const seed = parseInt(document.getElementById('settingsSelectedAvatarSeed').value);
        const showBranch = document.getElementById('settingsShowBranchNumber')?.checked !== false;
        
        let nameMode = "short";
        if (document.getElementById('settingsNameMode_full')?.checked) {
            nameMode = "full";
        }

        try {
            // In /users/{userId} speichern
            await updateDoc(doc(db, "users", user.uid), {
                avatarSeed: seed,
                showBranchNumber: showBranch,
                nameDisplayMode: nameMode
            });

            alert("Profil-Einstellungen erfolgreich gespeichert!");
            window.closeUserSettingsModal();
            
            // Wenn in Bestenliste-Ansicht, lade diese neu
            if (document.getElementById('quizLeaderboardArea').style.display === 'block') {
                window.loadQuizLeaderboards();
            }
        } catch (e) {
            alert("Fehler beim Speichern: " + e.message);
            console.error(e);
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = "Speichern 💾";
        }
    };

    window.openUserProfilePopup = async function (userId) {
        const db = window.db;
        if (!db) return;

        // Reset elements first
        document.getElementById('profilePopupName').innerText = "Lade Profil... ⏳";
        document.getElementById('profilePopupBranch').innerText = "---";
        document.getElementById('profilePopupQuickieBest').innerText = "0 Pkt.";
        document.getElementById('profilePopupUpdateBest').innerText = "0 Pkt.";
        document.getElementById('profilePopupMarathonBest').innerText = "0 Pkt.";
        document.getElementById('profilePopupGoldWins').innerText = "0-mal";
        document.getElementById('profilePopupAvatarContainer').innerHTML = "⏳";

        document.getElementById('userProfilePopup').style.display = 'flex';

        try {
            // 1. Benutzerdaten laden
            const userSnap = await getDoc(doc(db, "users", userId));
            if (!userSnap.exists()) {
                document.getElementById('profilePopupName').innerText = "Benutzer nicht gefunden 👻";
                return;
            }
            const userData = userSnap.data();
            
            // Format name based on preferences
            let displayName = `${userData.firstName} ${userData.lastName}`;
            if (userData.nameDisplayMode === "short") {
                displayName = `${userData.firstName} ${userData.lastName.charAt(0)}.`;
            }
            
            const showBranchVal = userData.showBranchNumber !== false;
            const branchText = showBranchVal ? (userData.branch || "Allgemein") : (userData.branch || "Allgemein").replace(/\d/g, '').trim();
            const avatarSeed = userData.avatarSeed || 1;

            document.getElementById('profilePopupName').innerText = displayName;
            document.getElementById('profilePopupBranch').innerText = branchText || "Allgemein";
            document.getElementById('profilePopupAvatarContainer').innerHTML = window.getAvatarSvg(avatarSeed);

            // 2. Highscores laden
            const q = query(collection(db, "leaderboards"), where("userId", "==", userId));
            const scoreSnap = await getDocs(q);

            let quickieMax = 0;
            let updateMax = 0;
            let marathonMax = 0;
            let goldWinsCount = 0;
            let hasSuperGuru = false;

            scoreSnap.forEach(docSnap => {
                const s = docSnap.data();
                if (s.mode === 'quickie') {
                    quickieMax = Math.max(quickieMax, s.score);
                } else if (s.mode === 'update') {
                    updateMax = Math.max(updateMax, s.score);
                } else if (s.mode === 'marathon') {
                    marathonMax = Math.max(marathonMax, s.score);
                }

                // Ein Score von über 3500 gilt als "Gold-Standard" / Rekord für den Counter
                if (s.score >= 3500) {
                    goldWinsCount++;
                }
                if (s.score >= 8500) {
                    hasSuperGuru = true;
                }
            });

            document.getElementById('profilePopupQuickieBest').innerText = quickieMax.toLocaleString('de-DE') + " Pkt.";
            document.getElementById('profilePopupUpdateBest').innerText = updateMax.toLocaleString('de-DE') + " Pkt.";
            document.getElementById('profilePopupMarathonBest').innerText = marathonMax.toLocaleString('de-DE') + " Pkt.";
            document.getElementById('profilePopupGoldWins').innerText = goldWinsCount + "-mal";

            // 3. Abzeichen berechnen & dynamisch rendern
            const badgesContainer = document.getElementById('profilePopupBadgesContainer');
            if (badgesContainer) {
                badgesContainer.innerHTML = "";
                let badgesCount = 0;

                // Torfuchs: Mindestens 1 Runde gespielt
                if (scoreSnap.size > 0) {
                    const span = document.createElement('span');
                    span.className = "card-badge";
                    span.style.cssText = "background: #fff3cd; color: #856404; font-size: 0.7rem; font-weight: bold; border: 1px solid #ffeeba;";
                    span.title = "Spiele mindestens 1 Quiz-Runde";
                    span.innerText = "🦊 Torfuchs";
                    badgesContainer.appendChild(span);
                    badgesCount++;
                }

                // Federspannung: Score >= 2500
                if (quickieMax >= 2500 || updateMax >= 2500 || marathonMax >= 2500) {
                    const span = document.createElement('span');
                    span.className = "card-badge";
                    span.style.cssText = "background: #d4edda; color: #155724; font-size: 0.7rem; font-weight: bold; border: 1px solid #c3e6cb;";
                    span.title = "Erziele mindestens 2.500 Punkte in einer Spielrunde";
                    span.innerText = "⚡ Federspannung";
                    badgesContainer.appendChild(span);
                    badgesCount++;
                }

                // Sektions-Guru: Score >= 8500
                if (quickieMax >= 8500 || updateMax >= 8500 || marathonMax >= 8500) {
                    const span = document.createElement('span');
                    span.className = "card-badge";
                    span.style.cssText = "background: #343a40; color: #ffffff; font-size: 0.7rem; font-weight: bold; border: 1px solid #d6d8db;";
                    span.title = "Erziele mindestens 8.500 Punkte in einer Spielrunde";
                    span.innerText = "🌌 Sektions-Guru";
                    badgesContainer.appendChild(span);
                    badgesCount++;
                }

                // Update-Profi: Update-Modus gespielt
                const playedUpdate = scoreSnap.docs.some(docSnap => docSnap.data().mode === 'update');
                if (playedUpdate) {
                    const span = document.createElement('span');
                    span.className = "card-badge";
                    span.style.cssText = "background: #cce5ff; color: #004085; font-size: 0.7rem; font-weight: bold; border: 1px solid #b8daff;";
                    span.title = "Spiele mindestens einmal den Update-Modus";
                    span.innerText = "📈 Update-Profi";
                    badgesContainer.appendChild(span);
                    badgesCount++;
                }

                // Marathon-Legende: Marathon-Score >= 1500
                if (marathonMax >= 1500) {
                    const span = document.createElement('span');
                    span.className = "card-badge";
                    span.style.cssText = "background: #f8d7da; color: #721c24; font-size: 0.7rem; font-weight: bold; border: 1px solid #f5c6cb;";
                    span.title = "Erziele mindestens 1.500 Punkte im Marathon-Modus";
                    span.innerText = "❤️ Marathon-Legende";
                    badgesContainer.appendChild(span);
                    badgesCount++;
                }

                if (badgesCount === 0) {
                    badgesContainer.innerHTML = `<span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">Noch keine Abzeichen freigeschaltet. Jagd gestartet! 🏹</span>`;
                }
            }
        } catch (e) {
            console.error("Fehler beim Laden des User-Profils:", e);
            document.getElementById('profilePopupName').innerText = "Fehler beim Laden ❌";
        }
    };

    window.closeUserProfilePopup = function () {
        const popup = document.getElementById('userProfilePopup');
        if (popup) {
            popup.style.display = 'none';
        }
    };

    window.toggleChatEmojiDrawer = function () {
        const d = document.getElementById('chatEmojiDrawer');
        if (d) d.style.display = d.style.display === 'none' ? 'grid' : 'none';
    };

    window.insertEmojiInInput = function (emoji) {
        const input = document.getElementById('chatMessageInput');
        if (input) {
            input.value += emoji;
            input.focus();
        }
        const d = document.getElementById('chatEmojiDrawer');
        if (d) d.style.display = 'none';
    };

    window.initLiveLeaderboardChat = function () {
        const db = window.db;
        const auth = window.auth;
        if (!db) return;

        // Wenn bereits ein aktiver Listener besteht, beende ihn zuerst (Verhindert Duplikate)
        if (unsubscribeChat && typeof unsubscribeChat === 'function') {
            unsubscribeChat();
            unsubscribeChat = null;
        }

        const flow = document.getElementById('chatMessageFlow');
        if (flow) flow.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; margin: auto 0; font-style: italic;">Lade Flurfunk... ⏳</div>`;

        // Zeitfenster: Letzte 72 Stunden
        const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

        try {
            const q = query(
                collection(db, "chat_messages"),
                where("createdAt", ">=", seventyTwoHoursAgo),
                orderBy("createdAt", "asc")
            );

            unsubscribeChat = onSnapshot(q, (snapshot) => {
                if (!flow) return;
                flow.innerHTML = "";

                if (snapshot.empty) {
                    flow.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; margin: auto 0; padding: 20px; line-height: 1.4; font-style: italic;">
                        Noch keine Nachrichten in den letzten 72h. 🤫<br>
                        Schreib den ersten Kommentar! ✏️
                    </div>`;
                    return;
                }

                snapshot.forEach(docSnap => {
                    const msg = docSnap.data();
                    const msgId = docSnap.id;
                    const currentUser = auth?.currentUser;
                    const isSelf = currentUser && msg.userId === currentUser.uid;
                    const isAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'developer';

                    // Blase erstellen
                    const bubbleWrapper = document.createElement('div');
                    bubbleWrapper.style.cssText = `display: flex; gap: 8px; width: 100%; align-items: flex-end; ${isSelf ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}`;

                    // Avatar erstellen (nur für Fremde links anzeigen)
                    let avatarHtml = "";
                    if (!isSelf) {
                        const seed = msg.avatarSeed || 1;
                        avatarHtml = `<div style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #e2e8f0; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;" onclick="window.openUserProfilePopup('${msg.userId}')" title="Profil anzeigen">
                            ${window.getAvatarSvg(seed)}
                        </div>`;
                    }

                    // Formatierte Zeit
                    let timeStr = "";
                    if (msg.createdAt) {
                        const date = msg.createdAt.toDate();
                        timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    } else {
                        timeStr = "Gerade eben";
                    }

                    // Zensur/Moderation Check
                    const isModerated = msg.moderated === true;
                    const displayMsgText = isModerated ? "(Gelöscht durch Sascha)" : msg.text;

                    // Löschen Knopf für Admins (nur wenn nicht bereits gelöscht)
                    let deleteBtnHtml = "";
                    if (isAdmin && !isModerated) {
                        deleteBtnHtml = `<button onclick="window.moderateChatMessageDirectly('${msgId}')" style="background:none; border:none; color:var(--error-red); cursor:pointer; font-size:0.75rem; margin:0; padding:2px; height:auto; width:auto; display:inline-block; vertical-align:middle; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Nachricht löschen / moderieren">🗑️</button>`;
                    }

                    // Kronen-Badge für Admins / Entwickler
                    let roleBadge = "";
                    if (msg.userRole === 'admin' || msg.userRole === 'developer') {
                        roleBadge = `<span style="font-size:0.7rem; color:#e67e22; font-weight:bold; margin-left:3px; background:#fff3cd; padding:1px 4px; border-radius:4px; border:1px solid #ffeeba;" title="Administrator / Moderator">👑 Admin</span>`;
                    }

                    // Sprechblase Aufbau
                    const bubble = document.createElement('div');
                    bubble.style.cssText = `max-width: 75%; display: flex; flex-direction: column;`;
                    
                    const senderInfo = isSelf ? "" : `<span style="font-size: 0.75rem; font-weight: bold; color: #475569; margin-left: 2px; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
                        <span onclick="window.openUserProfilePopup('${msg.userId}')" style="cursor: pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" title="Profil anzeigen">${escapeHtml(msg.displayName)}</span> <small style="font-weight: normal; color: #94a3b8;">(${escapeHtml(msg.branch)})</small>${roleBadge}
                    </span>`;

                    const textBubble = document.createElement('div');
                    textBubble.style.cssText = `
                        padding: 8px 12px; 
                        border-radius: 12px; 
                        font-size: 0.85rem; 
                        line-height: 1.4; 
                        word-break: break-word;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                        ${isSelf ? 'background: var(--hormann-blue); color: white; border-bottom-right-radius: 2px;' : 'background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 2px;'}
                        ${isModerated ? 'background: #e2e8f0; color: #94a3b8; font-style: italic; border: 1px dashed #cbd5e1;' : ''}
                    `;
                    textBubble.innerHTML = escapeHtml(displayMsgText);

                    const metaInfo = `<div style="display: flex; gap: 5px; align-items: center; font-size: 0.68rem; color: #94a3b8; margin-top: 3px; ${isSelf ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
                        <span>${timeStr}</span>
                        ${deleteBtnHtml}
                    </div>`;

                    bubble.innerHTML = senderInfo;
                    bubble.appendChild(textBubble);
                    bubble.innerHTML += metaInfo;

                    if (isSelf) {
                        bubbleWrapper.appendChild(bubble);
                    } else {
                        bubbleWrapper.appendChild(avatarHtml ? document.createRange().createContextualFragment(avatarHtml) : document.createTextNode(''));
                        bubbleWrapper.appendChild(bubble);
                    }

                    flow.appendChild(bubbleWrapper);
                });

                // Automatisch ganz nach unten scrollen
                setTimeout(() => {
                    flow.scrollTop = flow.scrollHeight;
                }, 50);
            }, (err) => {
                console.error("Fehler beim Abonnieren des Chats:", err);
                if (flow) {
                    flow.innerHTML = `<div style="text-align: center; color: var(--error-red); font-size: 0.85rem; margin: auto 0; padding: 15px;">
                        Verbindung zum Chat fehlgeschlagen ❌<br>
                        <small style="color: #64748b;">Eventuell fehlen Berechtigungen in den Firestore-Regeln.</small>
                    </div>`;
                }
            });
        } catch (e) {
            console.error("Fehler bei Chat-Initialisierung:", e);
        }
    };

    window.sendChatMessageDirectly = async function () {
        const db = window.db;
        const auth = window.auth;
        if (!db || !auth || !auth.currentUser) return;

        const input = document.getElementById('chatMessageInput');
        const text = input ? input.value.trim() : "";
        if (!text) return;

        // Emoji drawer schließen
        const d = document.getElementById('chatEmojiDrawer');
        if (d) d.style.display = 'none';

        // 1. Spam-Schutz / Rate Limiting
        const now = Date.now();
        const warning = document.getElementById('chatSpamWarning');

        // Limit 1: Mindestens 1.5 Sekunden Pause (erlaubt schnelles Tippen hintereinander)
        if (lastMessageTimestamps.length > 0 && now - lastMessageTimestamps[lastMessageTimestamps.length - 1] < 1500) {
            if (warning) {
                warning.innerText = "⚠️ Bitte warte kurz zwischen deinen Nachrichten!";
                warning.style.display = 'block';
            }
            setTimeout(() => { if(warning) warning.style.display = 'none'; }, 3000);
            return;
        }

        // Limit 2: Maximal 5 Nachrichten in 30 Sekunden (verhindert Spammen der Datenbank)
        const thirtySecsAgo = now - 30000;
        lastMessageTimestamps = lastMessageTimestamps.filter(t => t > thirtySecsAgo);
        if (lastMessageTimestamps.length >= 5) {
            if (warning) {
                warning.innerText = "⚠️ Zu viele Nachrichten! Bitte warte 30 Sekunden.";
                warning.style.display = 'block';
            }
            setTimeout(() => { if(warning) warning.style.display = 'none'; }, 6000);
            return;
        }

        // Input kurz sperren
        input.disabled = true;
        const btn = document.getElementById('btnSendChatMessage');
        if (btn) btn.disabled = true;

        try {
            const user = auth.currentUser;
            
            // Nutzerdaten abfragen für Präferenzen
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (!userSnap.exists()) return;
            const userData = userSnap.data();

            // Name formatieren
            let displayName = `${userData.firstName} ${userData.lastName}`;
            if (userData.nameDisplayMode === "short") {
                displayName = `${userData.firstName} ${userData.lastName.charAt(0)}.`;
            }

            const showBranch = userData.showBranchNumber !== false;
            const branchText = showBranch ? (userData.branch || "Allgemein") : (userData.branch || "Allgemein").replace(/\d/g, '').trim();
            const avatarSeed = userData.avatarSeed || 1;

            // In Firestore abspeichern
            await addDoc(collection(db, "chat_messages"), {
                userId: user.uid,
                displayName: displayName,
                avatarSeed: avatarSeed,
                text: text,
                userRole: userData.role || "employee",
                branch: branchText || "Allgemein",
                moderated: false,
                createdAt: serverTimestamp()
            });

            // Timestamps pflegen
            lastMessageTimestamps.push(now);
            if (input) input.value = "";
        } catch (e) {
            alert("Fehler beim Senden der Nachricht: " + e.message);
            console.error(e);
        } finally {
            if (input) {
                input.disabled = false;
                input.focus();
            }
            if (btn) btn.disabled = false;
        }
    };

    window.moderateChatMessageDirectly = async function (msgId) {
        const db = window.db;
        if (!db) return;

        if (!confirm("Möchtest du diese Nachricht wirklich moderieren / zensieren?")) return;

        try {
            await updateDoc(doc(db, "chat_messages", msgId), {
                text: "(Gelöscht durch Sascha)",
                moderated: true
            });
            console.log("[Chat] Nachricht erfolgreich durch Administrator moderiert.");
        } catch (e) {
            alert("Fehler beim Moderieren: " + e.message);
            console.error(e);
        }
    };

    window.loadAvatarModerationGrid = async function () {
        const db = window.db;
        if (!db) return;

        const grid = document.getElementById('adminAvatarsGrid');
        if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; font-size: 0.85rem; padding: 20px;">Lade Avatare... 🔄</div>`;

        try {
            let disabledSeeds = [];
            const docRef = doc(db, "system_config", "moderated_avatars");
            const configSnap = await getDoc(docRef);
            if (configSnap.exists()) {
                disabledSeeds = configSnap.data().disabledSeeds || [];
            }

            if (grid) {
                grid.innerHTML = "";
                for (let i = 1; i <= 100; i++) {
                    const isBanned = disabledSeeds.includes(i);
                    const card = document.createElement('div');
                    card.style.cssText = `
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        padding: 10px; 
                        background: ${isBanned ? '#fff5f5' : '#f8fafc'}; 
                        border: 1px solid ${isBanned ? '#feb2b2' : '#e2e8f0'}; 
                        border-radius: 8px; 
                        box-sizing: border-box;
                        transition: all 0.2s;
                        position: relative;
                    `;

                    // SVG Avatar
                    const avatarContainer = document.createElement('div');
                    avatarContainer.style.cssText = "width: 50px; height: 50px; border-radius: 50%; overflow: hidden; background: #e2e8f0; margin-bottom: 8px; flex-shrink: 0;";
                    avatarContainer.innerHTML = window.getAvatarSvg(i);
                    card.appendChild(avatarContainer);

                    // Seed Label
                    const label = document.createElement('span');
                    label.style.cssText = "font-size: 0.72rem; font-weight: bold; color: #475569; margin-bottom: 8px;";
                    label.innerText = `Seed #${i} ${isBanned ? '🚫' : ''}`;
                    card.appendChild(label);

                    // Sperren / Freigeben Button
                    const btn = document.createElement('button');
                    btn.style.cssText = `
                        margin: 0; 
                        padding: 4px 8px; 
                        font-size: 0.7rem; 
                        font-weight: bold; 
                        height: 24px;
                        border-radius: 4px;
                        cursor: pointer;
                        border: none;
                        width: 100%;
                        color: white;
                        background: ${isBanned ? 'var(--friendly-green)' : 'var(--error-red)'};
                    `;
                    btn.innerText = isBanned ? "Freigeben ✅" : "Sperren 🚫";
                    btn.onclick = () => window.toggleAvatarModerationStatus(i, !isBanned);
                    card.appendChild(btn);

                    grid.appendChild(card);
                }
            }
        } catch (e) {
            console.error("Fehler beim Laden der Avatar-Moderation:", e);
            if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--error-red); font-size: 0.85rem; padding: 20px;">Fehler beim Laden der Avatare: ${e.message}</div>`;
        }
    };

    window.toggleAvatarModerationStatus = async function (seed, block) {
        const db = window.db;
        if (!db) return;

        try {
            const docRef = doc(db, "system_config", "moderated_avatars");
            const configSnap = await getDoc(docRef);
            let disabledSeeds = [];

            if (configSnap.exists()) {
                disabledSeeds = configSnap.data().disabledSeeds || [];
            }

            if (block) {
                if (!disabledSeeds.includes(seed)) {
                    disabledSeeds.push(seed);
                }
            } else {
                disabledSeeds = disabledSeeds.filter(s => s !== seed);
            }

            await setDoc(docRef, { disabledSeeds: disabledSeeds }, { merge: true });
            console.log(`[Avatar] Seed #${seed} erfolgreich ${block ? 'gesperrt' : 'freigegeben'}.`);
            
            // Grid neu laden
            await window.loadAvatarModerationGrid();
        } catch (e) {
            alert("Fehler beim Ändern des Moderationsstatus: " + e.message);
            console.error(e);
        }
    };

    window.openSummonSaschaModal = function () {
        const reasonSelect = document.getElementById('summonSaschaReason');
        const detailsInput = document.getElementById('summonSaschaDetails');
        if (reasonSelect) reasonSelect.value = "Spam / Wiederholte Nachrichten";
        if (detailsInput) detailsInput.value = "";
        const m = document.getElementById('summonSaschaModal');
        if (m) m.style.display = 'flex';
    };

    window.closeSummonSaschaModal = function () {
        const m = document.getElementById('summonSaschaModal');
        if (m) m.style.display = 'none';
    };

    window.submitSummonSascha = async function () {
        const auth = window.auth;
        const db = window.db;
        const user = auth ? auth.currentUser : null;
        if (!user) {
            alert("Fehler: Du musst eingeloggt sein, um Sascha zu rufen.");
            return;
        }

        const reasonSelect = document.getElementById('summonSaschaReason');
        const detailsInput = document.getElementById('summonSaschaDetails');
        const reason = reasonSelect ? reasonSelect.value : "Sonstiges";
        const details = detailsInput ? detailsInput.value.trim() : "";

        const submitBtn = document.querySelector('#summonSaschaModal .btn-calc[onclick*="submitSummonSascha"]');
        const originalText = submitBtn ? submitBtn.innerText : "🚨 Sascha rufen";
        if (submitBtn) {
            submitBtn.innerText = "Sende Ruf...";
            submitBtn.disabled = true;
        }

        try {
            // 1. Letzte 10 Chatnachrichten abrufen
            let chatLog = "Keine aktuellen Nachrichten vorhanden.";
            try {
                const q = query(
                    collection(db, "chat_messages"),
                    orderBy("createdAt", "desc"),
                    limit(10)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const messages = [];
                    snap.forEach(d => {
                        const mData = d.data();
                        const time = mData.createdAt ? mData.createdAt.toDate().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : "Gerade eben";
                        messages.push(`[${time}] ${mData.displayName} (${mData.branch}): ${mData.text}`);
                    });
                    // Umdrehen, damit die ältesten zuerst stehen (chronologisch)
                    chatLog = messages.reverse().join('\n');
                }
            } catch (chatErr) {
                console.error("Fehler beim Abrufen der Chat-Historie für Meldung:", chatErr);
                chatLog = `(Fehler beim Abrufen der Nachrichten: ${chatErr.message})`;
            }

            const userName = document.getElementById('profileRole') ? document.getElementById('profileRole').previousElementSibling?.innerText : 'User';
            const finalMessage = `Meldung durch: ${userName} (${user.email})\n\nGrund: ${reason}\nDetails: ${details || 'Keine Angabe'}\n\n--- LETZTE 10 CHAT-NACHRICHTEN (CHRONOLOGISCH) ---\n${chatLog}`;

            // 2. Ticket in Firestore speichern
            await addDoc(collection(db, "tickets"), {
                userId: user.uid,
                userEmail: user.email,
                userName: userName,
                type: "Flurfunk-Meldung",
                subject: `🚨 Sascha gerufen: ${reason}`,
                message: finalMessage,
                fileUrl: null,
                status: 'open',
                createdAt: serverTimestamp(),
                adminReply: ''
            });

            // 3. E-Mail triggern
            if (typeof window.sendEmailSmart === 'function') {
                const emailParams = {
                    type: "Flurfunk-Meldung",
                    subject: `🚨 Flurfunk-Meldung: ${reason}`,
                    message: finalMessage,
                    user_email: user.email,
                    has_file: "Nein"
                };
                await window.sendEmailSmart('report', emailParams);
            }

            alert("🚨 Sascha wurde erfolgreich gerufen! Ein Support-Ticket inklusive Chatverlauf wurde erstellt.");
            window.closeSummonSaschaModal();
        } catch (e) {
            console.error(e);
            alert("Fehler beim Absetzen des Rufs: " + e.message);
        } finally {
            if (submitBtn) {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();

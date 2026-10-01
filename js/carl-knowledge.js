/**
 * Carl - Lokales Dokumenten-Wissen & Suchmaschine (RAG)
 * 
 * Verarbeitet PDFs und Bilder vollständig clientseitig im Browser des Benutzers (100% offline).
 * Enthält eine schlanke TF-IDF Vektor-Suchmaschine für schnellen Dokumentenabgleich.
 */

(function () {
    // Globale Variablen für das importierte Wissen
    window.carlKnowledgeList = [];

    // PDF.js Worker initialisieren
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Deutsche Stopwörter zur Such-Optimierung
    const GERMAN_STOPWORDS = new Set([
        'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'und', 'ist', 'sind', 'war', 'wäre', 'ein', 'eine', 
        'einer', 'eines', 'einem', 'einen', 'der', 'die', 'das', 'den', 'dem', 'des', 'in', 'im', 'zu', 
        'zur', 'zum', 'auf', 'mit', 'von', 'vor', 'für', 'über', 'unter', 'nach', 'bei', 'aus', 'an', 
        'am', 'als', 'wie', 'so', 'oder', 'aber', 'auch', 'dass', 'daß', 'dies', 'diese', 'dieser', 
        'dieses', 'einige', 'man', 'nur', 'noch', 'um', 'was', 'wer', 'wie', 'wo', 'welche', 'welcher', 
        'welches', 'sich', 'nicht', 'nein', 'ja'
    ]);

    // ==========================================
    // 1. DOKUMENTEN-TEXTEXTRAKTION (LOKAL)
    // ==========================================

    /**
     * Extrahiert Text aus einer PDF-Datei seitenweise komplett offline.
     */
    window.extractTextFromPDF = async function (file, progressCallback) {
        if (!window.pdfjsLib) {
            throw new Error("pdf.js Bibliothek ist nicht geladen.");
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        let fullText = "";

        for (let i = 1; i <= totalPages; i++) {
            if (progressCallback) {
                progressCallback(i, totalPages, `Lese Seite ${i} von ${totalPages}...`);
            }
            
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += `--- Seite ${i} (${file.name}) ---\n${pageText}\n\n`;
        }

        return fullText.trim();
    };

    /**
     * Führt OCR auf einem Bild (PNG/JPG) aus, um Text komplett offline zu extrahieren.
     */
    window.extractTextFromImage = async function (file, progressCallback) {
        if (typeof Tesseract === 'undefined') {
            throw new Error("Tesseract.js Bibliothek ist nicht geladen.");
        }

        if (progressCallback) {
            progressCallback(0, 100, "Initialisiere OCR-Scanner...");
        }

        const worker = await Tesseract.createWorker('deu');
        
        // Fortschritt überwachen
        // In Tesseract V5 wird der Logger über die createWorker-Konfiguration oder event listeners realisiert.
        // Für eine einfache Visualisierung simulieren wir den OCR-Verlauf.
        if (progressCallback) {
            progressCallback(30, 100, "Scanne Bildstruktur...");
        }

        const ret = await worker.recognize(file);
        
        if (progressCallback) {
            progressCallback(90, 100, "Text wird aufbereitet...");
        }

        await worker.terminate();

        if (progressCallback) {
            progressCallback(100, 100, "OCR erfolgreich abgeschlossen!");
        }

        return ret.data.text.trim();
    };

    // ==========================================
    // 2. TF-IDF SUCHMASCHINE IN JAVASCRIPT
    // ==========================================

    /**
     * Bereinigt Text und zerlegt ihn in signifikante Token (Wörter).
     */
    function tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?§\"\'\d]/g, " ") // Sonderzeichen & Zahlen entfernen
            .split(/\s+/)
            .filter(word => word.length > 2 && !GERMAN_STOPWORDS.has(word));
    }

    /**
     * Zerlegt ein großes Dokument in kleinere Sinnabschnitte (Chunks) für präzise Treffer.
     */
    function chunkText(docTitle, docText, chunkSize = 350, overlap = 50) {
        // Trenne nach Absätzen oder Zeilenumbrüchen
        const paragraphs = docText.split(/\n+/).filter(p => p.trim().length > 10);
        const chunks = [];

        paragraphs.forEach((p, index) => {
            // Falls ein Absatz sehr lang ist, zusätzlich nach Wörtern splitten
            const words = p.split(/\s+/);
            if (words.length > 80) {
                for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
                    const chunkWords = words.slice(i, i + chunkSize);
                    if (chunkWords.length > 20) {
                        chunks.push({
                            title: docTitle,
                            text: chunkWords.join(" "),
                            source: `${docTitle} (Absatz ${index + 1})`
                        });
                    }
                }
            } else {
                chunks.push({
                    title: docTitle,
                    text: p,
                    source: `${docTitle} (Absatz ${index + 1})`
                });
            }
        });

        return chunks;
    }

    /**
     * Durchsucht die Wissensdatenbank nach den relevantesten Abschnitten für eine Frage.
     * Nutzt TF-IDF Gewichtung zur Relevanzbewertung.
     */
    window.searchCarlKnowledge = function (queryText, maxResults = 3) {
        // 1. Alle Wissensbausteine in Chunks zerlegen
        let allChunks = [];
        window.carlKnowledgeList.forEach(item => {
            const chunks = chunkText(item.title, item.text);
            allChunks = allChunks.concat(chunks);
        });

        // Falls kein Wissen vorhanden ist, leeres Array liefern
        if (allChunks.length === 0) return [];

        const queryTokens = tokenize(queryText);
        if (queryTokens.length === 0) return [];

        // 2. Dokumentenhäufigkeit (DF) berechnen
        const docCount = allChunks.length;
        const df = {};

        allChunks.forEach(chunk => {
            const tokens = new Set(tokenize(chunk.text));
            tokens.forEach(token => {
                df[token] = (df[token] || 0) + 1;
            });
        });

        // 3. IDF für Suchbegriffe ermitteln
        const idf = {};
        queryTokens.forEach(token => {
            const dfCount = df[token] || 0;
            // Glättung der Division durch Null verhindern
            idf[token] = Math.log(1 + (docCount / (1 + dfCount)));
        });

        // 4. Jedes Chunk bewerten (TF-IDF Score)
        const scoredChunks = allChunks.map(chunk => {
            const tokens = tokenize(chunk.text);
            
            // Termhäufigkeiten (TF) im Chunk zählen
            const tf = {};
            tokens.forEach(token => {
                tf[token] = (tf[token] || 0) + 1;
            });

            // Score berechnen
            let score = 0;
            queryTokens.forEach(token => {
                if (tf[token]) {
                    // Logarithmisches TF zur Dämpfung sehr häufiger Wörter
                    const tfScore = 1 + Math.log(tf[token]);
                    score += tfScore * idf[token];
                }
            });

            return {
                ...chunk,
                score: score
            };
        });

        // 5. Sortieren nach Relevanz-Score und Filtern
        return scoredChunks
            .filter(item => item.score > 0.1) // Mindestmaß an Relevanz
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    };

    // ==========================================
    // 3. DATENSYNCHRONISATION
    // ==========================================

    /**
     * Initialisiert den Wissens-Abonnenten über Firestore.
     * Falls offline oder Firebase fehlschlägt, wird der LocalStorage geladen.
     */
    window.initCarlKnowledgeSync = function () {
        // Lokales Fallback laden
        try {
            const localData = localStorage.getItem('carl_local_knowledge');
            if (localData) {
                window.carlKnowledgeList = JSON.parse(localData);
                console.log(`Carl: ${window.carlKnowledgeList.length} Wissensbausteine aus lokalem Speicher geladen.`);
            }
        } catch (e) {
            console.error("Fehler beim Laden des lokalen Wissens-Fallbacks:", e);
        }

        // Firestore Listener aktivieren (falls live verbunden)
        if (typeof window.listenToCarlKnowledge === 'function') {
            window.listenToCarlKnowledge((cloudKnowledge) => {
                if (cloudKnowledge && cloudKnowledge.length > 0) {
                    window.carlKnowledgeList = cloudKnowledge;
                    // Lokales Fallback aktualisieren
                    localStorage.setItem('carl_local_knowledge', JSON.stringify(cloudKnowledge));
                    console.log(`Carl: ${cloudKnowledge.length} Wissensbausteine erfolgreich mit Firestore synchronisiert.`);
                }
            });
        }
    };

    // Synchronisation beim Laden des Skripts direkt starten
    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
            window.initCarlKnowledgeSync();
        }, 1000); // Kurze Verzögerung für sichere Firebase-Initialisierung
    });

})();

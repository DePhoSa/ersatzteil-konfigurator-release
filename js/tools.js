// =========================================================
// INTERNE WERKZEUGE FÜR MITARBEITER
// =========================================================

// --- SIDEBAR STEUERUNG ---
window.openToolsSidebar = (toolId, title) => {
    // Profil-Dropdown schließen, falls offen
    const menu = document.getElementById('profileMenu');
    if (menu) menu.style.display = 'none';

    // Titel setzen
    document.getElementById('toolsSidebarTitle').innerText = title;

    // Alle Tools ausblenden, dann das gewählte einblenden
    // KORRIGIERT: Nutzt nun die neuen IDs
    document.getElementById('toolBestellPruefung').style.display = 'none';
    document.getElementById('toolTextKonverter').style.display = 'none';

    // Das gewählte Tool einblenden
    const targetTool = document.getElementById(toolId);
    if (targetTool) targetTool.style.display = 'block';

    // Sidebar ins Bild schieben
    const sidebar = document.getElementById('employeeToolsSidebar');
    sidebar.style.display = 'flex';
    setTimeout(() => { sidebar.style.right = '0px'; }, 10);
};

window.closeToolsSidebar = () => {
    const sidebar = document.getElementById('employeeToolsSidebar');
    sidebar.style.right = '-500px';
    setTimeout(() => { sidebar.style.display = 'none'; }, 300);
};


// =========================================================
// TOOL 1: AUFTRAGSERFASSUNG HELPER (Ehemals Python)
// =========================================================

function analyzeOrderText(text) {
    const searchTerms = /Haustür|Eingangstür|IsoPro|Aktionstür/i;
    let product_group = searchTerms.test(text) ? "Haustür" : "Unbekannt";
    let lines = [];

    if (product_group === "Haustür") {
        const find = (pattern) => {
            const match = text.match(pattern);
            return match && match[1] ? match[1].replace(/\s+/g, ' ').trim() : "";
        };

        // --- TYP & PRODUKT LOGIK ---
        let kuerzel = "?", produkt_name = "Unbekannt";

        const thermo_match = text.match(/(Thermo\d+)/i);
        const isopro_match = /IsoPro/i.test(text);
        const secur_match = /Secur/i.test(text);

        if (thermo_match) {
            kuerzel = "TP";
            produkt_name = thermo_match[1];
        } else if (isopro_match) {
            kuerzel = "IP";
            produkt_name = secur_match ? "ISOPRO Secur (RC2)" : "ISOPRO";
        }

        // --- EXTRAKTION ---
        let motiv = find(/Motiv\s+(THP\s*[\w\d]+|IPS?\s*[\w\d]+)/i);
        if (!motiv) motiv = find(/Motiv\s+(IP\s*[\w\d]+)/i);

        const anlagenmass = find(/Rahmenaußenmaß:(\s*\d+\s*x\s*\d+\s*mm)/i);
        const tuer = find(/Haustür:(\s*\d+\s*x\s*\d+\s*mm)/i);
        const oberlicht = find(/Oberlicht:(\s*\d+\s*x\s*\d+\s*mm)/i);
        const rc_ausfuehrung = find(/Ausführung\s*in\s*(RC\s?\d)/i);

        const anschlag_raw = find(/Anschlag:(.*?)Öffnungsrichtung:/is);
        const oeffnung_raw = find(/Öffnungsrichtung:(.*?)Anzahl\s*Flügel:/is);

        let din_richtung = anschlag_raw;
        if (anschlag_raw.toLowerCase().includes("links")) din_richtung = "DIN Links";
        else if (anschlag_raw.toLowerCase().includes("rechts")) din_richtung = "DIN Rechts";

        const hat_seitenteil = /Seitenteil/i.test(text);
        let tueranlage = `1-flg. Tür ${din_richtung}`;
        if (hat_seitenteil) tueranlage += " mit Seitenteil";

        const zargenart = find(/Zargenvariante:(.*?)\s+Material:/is);

        // --- FARBE ---
        let farbe = "";
        const ob_match = text.match(/Oberfläche(.*?)(?=\s*Beschlagsausstattung|\s*Zusatzausstattung|$)/is);
        if (ob_match) {
            const ma = ob_match[1].match(/außen:(.*?)(?=\s*innen:)/is);
            const mi = ob_match[1].match(/innen:(.*?)(?=$)/is);
            if (ma && mi) farbe = `Außen: ${ma[1].replace(/\s+/g, ' ').trim()} | Innen: ${mi[1].replace(/\s+/g, ' ').trim()}`;
        }
        if (!farbe) {
            const farbe_match = text.match(/((?:RAL|CH)\s*\d+\s*[^\n]*)/i);
            if (farbe_match) farbe = farbe_match[1].replace(/\s+/g, ' ').trim();
        }

        const bodenschwelle = find(/(Bodenschwelle\s+S\d+\s*\(.*?\))/is);
        let aussengriff = find(/Außengriff\s*:\s*(.*?)(?=\s*Innendrücker\s*:)/is);
        const innendruecker = find(/Innendrücker\s*:\s*(.*?)(?=\s*(?:Schloss|Verriegelung|\d-fach|Profilzylinder|$))/is);
        
        // Fallback 1: Wenn kein "Innendrücker:" vorhanden ist (z.B. bei Drücker/Drücker Garnituren)
        if (!aussengriff) {
            aussengriff = find(/Außengriff\s*:\s*(.*?)(?=\s*(?:\d-fach|Schloss|Verriegelung|Profilzylinder|Automatikschloss|Sicherheitsschloss|Zusatzausstattung|Hinweis|Grundpreis|$))/is);
        }
        
        // Fallback 2: Wenn der Text direkt eine Rosetten-/Wechsel-/Drückergarnitur nennt
        if (!aussengriff) {
            const m_direct = text.match(/((?:Rosettengarnitur|Wechselgarnitur|Drückergarnitur|Drücker\s*\/\s*Drücker|Knopf\s*\/\s*Drücker)[^\n\r]*(?:Typ\s+[^\n\r]+)?)/i);
            if (m_direct) {
                aussengriff = m_direct[1].replace(/\s+/g, ' ').trim();
            }
        }

        let schloss = find(/Schloss\s*\/\s*Verriegelung\s*:\s*(.*?)(?=\s*(?:Profilzylinder|Zusatzausstattung|Hinweis|$))/is);
        if (!schloss) schloss = find(/(\d-fach\s*Sicherheitsschloss.*?)(?=\s*(?:Profilzylinder|Zusatzausstattung|Hinweis|$))/is);
        const bolzen = /Sicherungsbolzen\s*auf\s*Bandseite/i.test(text);
        const oberlicht_glas = find(/Oberlicht\s*Glas\s*\/\s*Füllung:([^\n]+)/i);

        // --- ZUSATZAUSSTATTUNG LOGIK ---
        let zusatz_items = [];

        if (/E-Öffner\s*mit\s*Tagesfalle/i.test(text)) zusatz_items.push("Zusatzausstattung: E-Öffner mit Tagesfalle (lose)");
        else if (/E-Öffner/i.test(text)) zusatz_items.push("Zusatzausstattung: E-Öffner");

        if (/verstärkung/i.test(text) && /türschließer/i.test(text)) {
            if (/Verstärkung.*Türschließer/is.test(text)) zusatz_items.push("Türschließer: Verstärkung für Türschließer");
        }

        if (/HDC\s*35/i.test(text)) zusatz_items.push("Türschließer: HDC 35-1");

        const alu = text.match(/(\d+\s*Stäbe\s*Aluminium-Flach.*?)(?=\s*\d+\s*x\s*Verbreiterung|\s*Hinweis|ISS-|Oberfläche|Beschlagsausstattung|\s*Montage|$)/is);
        if (alu) zusatz_items.push(alu[1].replace(/\s+/g, ' ').trim());

        const vp_pat = /(\d+\s*x\s*Verbreiterungs?[\-\s]*profil.*?)(?=\d+\s*x\s*Verbreiterungs?[\-\s]*profil|Hinweis|ISS-|Oberfläche|Beschlagsausstattung|Zusatzausstattung|\s*Montage|$)/igs;
        let vps_match;
        while ((vps_match = vp_pat.exec(text)) !== null) {
            const c = vps_match[1].replace(/\s+/g, ' ').trim();
            if (c && c.toLowerCase().includes("erbreiterung")) zusatz_items.push(c);
        }

        const zusatz_block_match = text.match(/Zusatzausstattung(.*?)(?:Hinweise|$)/is);
        const raw_zusatz = zusatz_block_match ? zusatz_block_match[1] : "";
        let montage_raw = raw_zusatz.match(/(Montage\s.*?)(?=\s*Hinweis|$)/is);
        if (!montage_raw) montage_raw = text.match(/(Montage\s.*?)(?=\s*Hinweis|$)/is);

        if (montage_raw) {
            const m_text = montage_raw[1].replace(/\s+/g, ' ').trim();
            const keywords = ["verstärkung", "türschließer", "e-öffner", "tagesfalle"];
            const is_redundant = keywords.some(k => m_text.toLowerCase().includes(k));
            if (!is_redundant) zusatz_items.push(m_text);
        }

        // --- ZUSAMMENBAU ---
        if (kuerzel) lines.push(`- Konfiguration Kürzel: ${kuerzel}`);
        if (produkt_name) lines.push(`- Produkt: ${produkt_name}`);
        if (motiv) lines.push(`- Motiv: ${motiv}`);
        if (tueranlage) lines.push(`- Türanlage: ${tueranlage}`);
        if (din_richtung) lines.push(`- DIN-Richtung: ${din_richtung}`);
        if (oeffnung_raw) lines.push(`- Öffnungsrichtung: ${oeffnung_raw}`);
        if (zargenart && motiv && !motiv.toLowerCase().includes("isopro") && !motiv.toLowerCase().includes("ips")) lines.push(`- Zargenart: ${zargenart}`);
        if (anlagenmass) lines.push(`- Anlagenmaß: ${anlagenmass}`);
        if (rc_ausfuehrung && !produkt_name.includes("ISOPRO Secur")) lines.push(`- Sicherheit: ${rc_ausfuehrung}`);
        if (tuer) lines.push(`- Haustürmaß: ${tuer}`);
        if (oberlicht) lines.push(`- Oberlicht: ${oberlicht}`);
        if (farbe) lines.push(`- Farbe: ${farbe}`);
        if (bodenschwelle) lines.push(`- Bodenschwelle: ${bodenschwelle}`);
        if (aussengriff) lines.push(`- Außengriff: ${aussengriff}`);
        if (innendruecker) lines.push(`- Innendrücker: ${innendruecker}`);
        if (schloss) {
            let st = schloss.endsWith(" mit") ? schloss.slice(0, -4).trim() : schloss;
            lines.push(`- Schloss: ${st}${bolzen ? ' (mit Sicherungsbolzen)' : ''}`);
        }
        if (oberlicht_glas) {
            const ga = (oberlicht_glas.toLowerCase().includes("satiniert") || oberlicht_glas.toLowerCase().includes("sandgestrahlt")) ? "Satiniert" : (oberlicht_glas.toLowerCase().includes("klar") ? "Klarglas" : "Unbekannt");
            lines.push(`- Verglasung Oberlicht: ${ga} (${oberlicht_glas})`);
        }

        if (zusatz_items.length > 0) {
            lines.push("\n🔹 Zusatzausstattung:");
            const unique_items = [...new Set(zusatz_items)];
            unique_items.forEach(i => lines.push(`- ${i}`));
        }
    }

    return { product_group, formatted: lines.join("\n") };
}

window.copyChecklistToClipboard = () => {
    const container = document.getElementById('toolOrderChecklist');
    if (!container) return;

    const lines = [];
    Array.from(container.children).forEach(child => {
        if (child.tagName === 'LABEL') {
            const cb = child.querySelector('input[type="checkbox"]');
            const span = child.querySelector('span');
            if (span) {
                const prefix = cb && cb.checked ? '[x] ' : '[ ] ';
                lines.push(prefix + span.innerText);
            }
        } else if (child.tagName === 'DIV') {
            lines.push(child.innerText);
        } else {
            lines.push(child.textContent || "");
        }
    });

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert("Checkliste in die Zwischenablage kopiert!");
        })
        .catch(err => {
            console.error("Kopieren mit Clipboard API fehlgeschlagen, nutze Fallback:", err);
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                alert("Checkliste in die Zwischenablage kopiert!");
            } catch (copyErr) {
                alert("Fehler beim Kopieren.");
            }
            document.body.removeChild(textarea);
        });
};

window.runOrderAnalysis = () => {
    const input = document.getElementById('toolOrderInput').value.trim();
    if (!input) return alert("Bitte Text einfügen.");

    const result = analyzeOrderText(input);
    const resultBox = document.getElementById('toolOrderResult');
    const checklistContainer = document.getElementById('toolOrderChecklist');
    const actionsContainer = document.getElementById('toolOrderResultActions');

    if (result.formatted === "") {
        checklistContainer.innerHTML = "<span style='color:#e74c3c; font-weight:bold; display:block; padding: 20px; text-align:center;'>Konnte keine relevanten Daten im Text finden.</span>";
        if (actionsContainer) actionsContainer.style.display = 'none';
    } else {
        const lines = result.formatted.split('\n');
        let html = '';

        lines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            if (trimmedLine.startsWith('-')) {
                const cleanText = trimmedLine.substring(1).trim();
                html += `
                    <label class="checklist-item">
                        <input type="checkbox" class="checklist-checkbox" onchange="this.nextElementSibling.style.textDecoration = this.checked ? 'line-through' : 'none'; this.nextElementSibling.style.color = this.checked ? '#94a3b8' : '#334155';">
                        <span class="checklist-text">${cleanText}</span>
                    </label>
                `;
            } else {
                html += `<div class="checklist-header-line">${trimmedLine}</div>`;
            }
        });
        checklistContainer.innerHTML = html;
        if (actionsContainer) actionsContainer.style.display = 'flex';
    }
    if (resultBox) resultBox.style.display = 'flex';
};
// =========================================================
// TOOL 2: BESTELL-PRÜFUNG (SMART ORDER CHECK FUZZY)
// =========================================================

// PDF.js Worker initialisieren
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let ocrFiles = [];

// --- INITIALISIERUNG DER EVENT-LISTENER ---
// Wir verpacken das in eine Funktion, die vom Hauptskript aufgerufen werden kann,
// sobald das DOM bereit ist.
function initOcrToolListeners() {
    const dz = document.getElementById('ocrDropZone');
    const fi = document.getElementById('ocrFileInput');

    if (!dz || !fi) return;

    dz.addEventListener('click', () => fi.click());

    fi.addEventListener('change', () => {
        addOcrFiles(fi.files);
        fi.value = ''; // Reset
    });

    dz.addEventListener('dragover', e => {
        e.preventDefault();
        dz.classList.add('dragover');
    });

    dz.addEventListener('dragleave', () => {
        dz.classList.remove('dragover');
    });

    dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('dragover');
        addOcrFiles(e.dataTransfer.files);
    });

    // Strg+V (Paste) für Bilder
    document.addEventListener('paste', (e) => {
        // Nur abfangen, wenn das Werkzeug auch geöffnet ist!
        const toolDiv = document.getElementById('toolTextUmwandler');
        if (toolDiv && toolDiv.style.display === 'block') {
            if (e.clipboardData && e.clipboardData.items) {
                let added = false;
                Array.from(e.clipboardData.items).forEach(item => {
                    if (item.type.indexOf("image") !== -1) {
                        const file = new File([item.getAsFile()], `Zwischenablage_${Date.now()}.png`, { type: item.type });
                        addOcrFiles([file]);
                        added = true;
                    }
                });
                if (added) e.preventDefault(); // Verhindert das Einfügen von Text im Hintergrund
            }
        }
    });
}

function addOcrFiles(files) {
    Array.from(files).forEach(f => {
        // Verhindert Duplikate
        if (!ocrFiles.some(x => x.name === f.name && x.size === f.size)) {
            ocrFiles.push(f);
        }
    });
    updateOcrUI();
}

window.removeOcrFile = (e, i) => {
    if (e) e.stopPropagation();
    ocrFiles.splice(i, 1);
    updateOcrUI();
};

function updateOcrUI() {
    const list = document.getElementById('ocrFileList');
    const dropMsg = document.getElementById('ocrDropMessage');
    const submitBtn = document.getElementById('btnStartOcrCheck');

    if (!list || !dropMsg || !submitBtn) return;

    list.innerHTML = '';

    ocrFiles.forEach((f, i) => {
        const isPdf = f.name.toLowerCase().endsWith('.pdf');
        list.innerHTML += `
            <div class="file-badge ${isPdf ? 'pdf' : 'img'}">
                ${isPdf ? '📄' : '🖼️'} ${f.name}
                <span class="btn-remove-file" onclick="removeOcrFile(event, ${i})">✖</span>
            </div>`;
    });

    submitBtn.disabled = ocrFiles.length === 0;
    dropMsg.style.display = ocrFiles.length ? 'none' : 'block';
}

function ocrLog(msg) {
    const logBox = document.getElementById('ocrStatusLog');
    if (logBox) {
        logBox.style.display = 'block';
        logBox.innerHTML = `<div>${msg}</div>` + logBox.innerHTML;
    }
}

async function readPdfTextLocal(file) {
    ocrLog("📄 Lese PDF...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n";
    }
    return text;
}

async function readImageTextLocal(file) {
    ocrLog(`🖼️ Scanne Bild: ${file.name}`);
    const imgBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scale = 2.0;
    let w = imgBitmap.width;
    let h = imgBitmap.height;
    canvas.width = w * scale;
    canvas.height = h * scale;

    ctx.filter = 'grayscale(100%) contrast(200%) brightness(100%)';
    ctx.drawImage(imgBitmap, 0, 0, w * scale, h * scale);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
    const worker = await Tesseract.createWorker('deu');

    // Die Tesseract-Optionen wurden in v5 leicht angepasst, aber das funktioniert weiterhin
    await worker.setParameters({ tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,:()/ ' });

    const ret = await worker.recognize(blob);
    await worker.terminate();
    return ret.data.text;
}

// Die Bereinigungs- und Extraktions-Funktionen (Identisch zu Python)
function cleanOcrText(txt) { return txt.toLowerCase().replace(/[il|]/g, '1').replace(/o/g, '0').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, ''); }
function extractOcrCodes(txt) { const m = txt.match(/([KDH][B]?[- ]?\d{2,}[-]?\d*)/gi); return m ? m.map(c => cleanOcrText(c)) : []; }
function formatOcrOutput(txt) { return txt.replace(/\b([aA][1235])\b/g, m => m.toUpperCase()).replace(/ral/i, 'RAL').replace(/din/i, 'DIN'); }

function parsePdfDataLocal(text) {
    let data = {};
    const dimHaustur = text.match(/Haustür:\s*(\d+\s*x\s*\d+)/i);
    const dimSeitenteil = text.match(/Seitenteil.*:\s*(\d+\s*x\s*\d+)/i);
    if (dimHaustur || dimSeitenteil) {
        if (dimHaustur) data['Maß Haustür'] = dimHaustur[1].replace(/\s/g, '');
        if (dimSeitenteil) data['Maß Seitenteil'] = dimSeitenteil[1].replace(/\s/g, '');
    }
    const ram = text.match(/Rahmenaußenmaß.*?(\d{3,4})\s*[xX]\s*(\d{3,4})/s);
    if (ram) {
        const keyName = (dimHaustur || dimSeitenteil) ? 'Maß Gesamt' : 'Maße';
        data[keyName] = `${ram[1]} x ${ram[2]}`;
    }

    const din = text.match(/DIN\s+(Rechts|Links)/i); if (din) data['DIN-Richtung'] = `DIN ${din[1]}`;
    const ral = text.match(/RAL\s*(\d{4})/); if (ral) data['Farbe'] = `RAL ${ral[1]}`;
    const offnung = text.match(/Öffnungsrichtung:\s*(nach\s+(?:innen|außen)\s+öffnend)/i);
    if (offnung) data['Öffnungsrichtung'] = offnung[1];

    const isopro = text.match(/(IP|IPS)\s?(\d+[S]?)/i);
    const motiv = text.match(/Motiv\s*(TPS)?\s*(\d{3,4}[A-ZI]?)/i);
    if (isopro) {
        let modelName = isopro[0].replace(/\s/g, '').toUpperCase();
        if (modelName.startsWith('IPS') && !text.includes('RC2')) modelName += " (ACHTUNG: RC2 fehlt in PDF!)";
        data['Modell'] = modelName;
    } else if (motiv) data['Modell'] = motiv[0]; else if (text.includes('Thermo46')) data['Modell'] = 'Thermo46';

    if (text.includes("Automatikschloss")) data['Schloss'] = "Automatikschloss"; else if (text.includes("Mehrfachverriegelung")) data['Schloss'] = "Mehrfachverriegelung";
    const zarge = text.match(/Zargenvariante:.*?(A[1235])/s);
    if (zarge) data['Zarge'] = `Profil ${zarge[1]}`; else if (text.includes("A2")) data['Zarge'] = "Profil A2";

    const griffAussen = text.split(/Außengriff:?/i);
    if (griffAussen.length > 1) {
        let raw = griffAussen[1].split(/\n|Innendrücker|3-fach|Sicherheitsschloss|Profilzylinder|Zusatzausstattung|Grundpreis/)[0].trim();
        if (raw.length < 3) raw = griffAussen[1].split('\n')[1].trim();
        data['Griff/Beschlag'] = raw;
    } else {
        const griffMatch = text.match(/(Knopf|Drücker|Wechselgarnitur|Rosettengarnitur).*?(K-?\d+|D-?\d+|HB-?\s?\d+[-/]\d+)/i);
        if (griffMatch) data['Griff/Beschlag'] = griffMatch[0];
    }

    const zusatzBlock = text.match(/Zusatzausstattung\s*([\s\S]*?)\s*Grundpreis/i);
    if (zusatzBlock) {
        zusatzBlock[1].split('\n').forEach(l => {
            let cleanL = l.trim().replace(/^[=\-_]+|[=\-_]+$/g, '');
            if (cleanL.length > 3 && !cleanL.match(/^\d+/) && !cleanL.includes('...') && !cleanL.match(/^[=\-_]+$/)) {
                data['Zusatz: ' + cleanL.replace(/^[•\-\*]\s*/, '').split('(')[0].trim()] = cleanL.replace(/^[•\-\*]\s*/, '');
            }
        });
    }
    return data;
}

function findInOcrTextSmart(cat, fullText, sollWert) {
    const tl = fullText.toLowerCase();

    if (cat.startsWith('Zusatz:')) { const item = cat.replace('Zusatz: ', '').toLowerCase(); return tl.includes(item) ? "Gefunden: " + item : "Nicht gefunden"; }

    if (cat === 'Öffnungsrichtung') {
        const regex = /(?:öffnungsrichtung|offnungsrichtung|öffn..ungsrichtung)[\s\S]{0,150}?(nach\s+(?:innen|außen|aussen)\s+öffnend)/i;
        const match = fullText.match(regex);
        if (match) return match[1].toLowerCase().replace('aussen', 'außen');
        return "Nicht gefunden";
    }

    if (cat === 'Maß Haustür') {
        const m = tl.match(/t[uü]rma[ssß].*?\b(\d{3,4})\s*mm\s+(\d{3,4})\s*mm/);
        return m ? `${m[1]} x ${m[2]}` : "Nicht gefunden";
    }
    if (cat === 'Maß Seitenteil') {
        const m = tl.match(/seitenteil.*?(?:gr[oö][ssß]e)?\s*(\d{3,4})\s*mm/);
        return m ? `${m[1]} mm` : "Nicht gefunden";
    }
    if (cat === 'Maß Gesamt' || cat === 'Maße') {
        const m = tl.match(/(?:anlagenma[ssß]|bestellma[ssß]|rahmenau[ssß]enma[ssß]).*?\b(\d{3,4})\s*mm\s+(\d{3,4})\s*mm/);
        if (m) return `${m[1]} x ${m[2]}`;
        if (sollWert) {
            const nums = sollWert.match(/\d+/g);
            if (nums && nums.length >= 2) {
                const regex = new RegExp(`${nums[0]}[^\\d]{0,20}${nums[1]}`, 's');
                if (fullText.match(regex)) return sollWert;
            }
        }
        return "Nicht gefunden";
    }

    if (cat === 'Modell') {
        if (sollWert) {
            let target = sollWert.replace(/^(IP|IPS|Motiv|Thermo\d*)\s*/i, '').trim().toUpperCase();
            target = target.split(' ')[0];
            let targetFuzzy = target.replace(/S/g, '[S5]');
            if (target === '010') targetFuzzy = '(010|070)';

            let searchRegex = new RegExp(`(?:motiv|stiv|mo1iv|model|modell|typ).*?\\b(${targetFuzzy})`, 'i');
            const match = tl.match(searchRegex);
            if (match) return "Motiv " + match[1].replace('070', '010');
        }
        const m = tl.match(/(?:motiv|stiv|mo1iv).*?([0-9oO]{3,}[a-z5S]?)/i);
        if (m) {
            let code = m[1].replace(/o/gi, '0').replace('5', 'S').toUpperCase();
            return "Motiv " + code;
        }
        return 'Nicht gefunden';
    }

    if (cat === 'DIN-Richtung') {
        const m = tl.match(/din\s+(rechts|links)/);
        if (m) return `DIN ${m[1].charAt(0).toUpperCase() + m[1].slice(1)}`;
        return 'Nicht gefunden';
    }

    if (cat === 'Farbe') { const m = tl.match(/ral\s*(\d{4})/); return m ? `RAL ${m[1]}` : 'Nicht gefunden'; }
    if (cat === 'Schloss') { if (tl.includes('automatik')) return 'Automatikschloss'; if (tl.includes('mehrfach')) return 'Mehrfachverriegelung'; return 'Nicht gefunden'; }
    if (cat === 'Zarge') { const m = tl.match(/(profil|zarge)\s*(a[1235])/i); return m ? `Profil ${m[2].toUpperCase()}` : 'Nicht gefunden'; }

    if (cat === 'Griff/Beschlag') {
        if (tl.includes("hb 38-2") || tl.includes("hb38-2")) {
            let res = "Griff HB 38-2"; if (tl.includes("schwarz")) res += " schwarz"; else if (tl.includes("edelstahl")) res += " Edelstahl"; return res;
        }
        if (tl.match(/(hb|h8|nb)\s?[-_.]?\s?14\s?[-_.]?\s?2/)) return "HB 14-2 Edelstahl";
        const m = tl.match(/(k-?\d{2,}|d-?\d{2,})/i); return m ? `Griff ${m[0].toUpperCase()}` : 'Nicht gefunden';
    }
    return 'Nicht gefunden';
}

// Hauptfunktion: Wird beim Klicken auf "Prüfung starten" aufgerufen
window.startOcrCheck = async () => {
    const submitBtn = document.getElementById('btnStartOcrCheck');
    const resultDiv = document.getElementById('ocrResultContainer');
    const pContainer = document.getElementById('ocrProgressContainer');
    const pBar = document.getElementById('ocrProgressBar');
    const logBox = document.getElementById('ocrStatusLog');

    if (!submitBtn || !resultDiv || !pContainer || !pBar) return;

    submitBtn.disabled = true;
    resultDiv.innerHTML = '';
    logBox.innerHTML = '';
    pContainer.style.display = 'block';
    pBar.style.width = '10%';

    ocrLog("🚀 Starte Analyse...");

    const pdfFile = ocrFiles.find(f => f.name.toLowerCase().endsWith('.pdf'));
    const imgFiles = ocrFiles.filter(f => !f.name.toLowerCase().endsWith('.pdf'));

    if (!pdfFile || imgFiles.length === 0) {
        alert("Bitte mindestens ein PDF (Bestellung) und einen Screenshot (Konfigurator) ablegen!");
        submitBtn.disabled = false;
        pContainer.style.display = 'none';
        return;
    }

    try {
        const pdfText = await readPdfTextLocal(pdfFile);
        const sollDaten = parsePdfDataLocal(pdfText);
        const isIsoPro = sollDaten['Modell'] && (sollDaten['Modell'].startsWith('IP') || sollDaten['Modell'].startsWith('IPS'));

        pBar.style.width = '40%';

        const imgPromises = imgFiles.map(f => readImageTextLocal(f));
        const imgTexts = await Promise.all(imgPromises);
        const fullImgText = imgTexts.join("\n");

        pBar.style.width = '90%';

        let errors = [];
        for (const [key, soll] of Object.entries(sollDaten)) {
            if (key === 'Zarge' && isIsoPro) continue;

            let gefundenerWert = findInOcrTextSmart(key, fullImgText, soll);
            let isError = false;
            const cleanSoll = cleanOcrText(soll);
            const cleanFund = cleanOcrText(gefundenerWert);

            if (key === 'Maße' || key.startsWith('Maß ')) {
                const widthSoll = cleanSoll.split('x')[0].replace(/\D/g, '');
                const heightSoll = cleanSoll.split('x')[1].replace(/\D/g, '');
                const regexMass = new RegExp(widthSoll + "\\D{0,20}" + heightSoll);

                if (cleanFund.replace(/\D/g, '') !== widthSoll + heightSoll) {
                    if (!fullImgText.replace(/\s/g, '').includes(widthSoll + heightSoll) && !fullImgText.match(regexMass)) {
                        isError = true;
                    } else {
                        if (gefundenerWert === "Nicht gefunden") gefundenerWert = `${widthSoll} x ${heightSoll} (Gefunden)`;
                    }
                }
            }
            else if (key === 'Modell') {
                if (isIsoPro) {
                    let rawCodeSoll = soll.replace(/^(IP|IPS|Motiv|Thermo)\s*/i, '').trim();
                    let cleanCodeSoll = cleanOcrText(rawCodeSoll);

                    let rawCodeIst = gefundenerWert.replace(/^Motiv\s+/i, '').trim();
                    rawCodeIst = rawCodeIst.replace(/o/gi, '0');
                    if (rawCodeIst === "070" || rawCodeIst === "O7O") rawCodeIst = "010";
                    rawCodeIst = rawCodeIst.replace(/^\D+/, '');

                    let cleanCodeIst = cleanOcrText(rawCodeIst);
                    if (cleanCodeIst.endsWith('5')) cleanCodeIst = cleanCodeIst.slice(0, -1) + 's';

                    let codeMatch = cleanCodeIst.includes(cleanCodeSoll) || cleanCodeSoll.includes(cleanCodeIst);

                    const pdfIsSecur = cleanSoll.startsWith('ips');
                    const imgIsSecur = fullImgText.toLowerCase().includes('isopro secur') || fullImgText.toLowerCase().includes('rc2');

                    let constructedPrefix = imgIsSecur ? "IPS" : "IP";
                    let displayCode = rawCodeIst.replace(/5$/, 'S');
                    if (codeMatch) displayCode = rawCodeSoll;
                    if (rawCodeIst === "Nicht gefunden") displayCode = "????";

                    let constructedIst = constructedPrefix + displayCode;

                    let errorSuffix = "";
                    if (pdfIsSecur && !imgIsSecur) errorSuffix = " (Falsch: Secur fehlt)";
                    else if (!pdfIsSecur && imgIsSecur) errorSuffix = " (Falsch: Secur ausgewählt)";

                    if (rawCodeIst === "Nicht gefunden") { isError = true; gefundenerWert = "Nicht gefunden"; }
                    else if (!codeMatch) { isError = true; gefundenerWert = constructedIst + errorSuffix; }
                    else if (errorSuffix !== "") { isError = true; gefundenerWert = constructedIst + errorSuffix; }
                    else { isError = false; gefundenerWert = constructedIst; }
                } else {
                    if (!cleanFund.includes(cleanSoll) && !cleanSoll.includes(cleanFund)) isError = true;
                }
                if (soll.includes('RC2 fehlt')) isError = true;
            }
            else if (key === 'DIN-Richtung') {
                const sollBase = cleanSoll.replace('din ', '');
                const istBase = cleanFund.replace('din ', '').split(' ')[0];
                if (!istBase.includes(sollBase)) isError = true;
            }
            else if (key === 'Öffnungsrichtung') {
                if (gefundenerWert === "Nicht gefunden") {
                    isError = true;
                } else {
                    const sollAussen = cleanSoll.includes('außen') || cleanSoll.includes('aussen');
                    const istAussen = gefundenerWert.includes('außen');
                    if (sollAussen !== istAussen) isError = true;
                }
            }
            else if (key === 'Griff/Beschlag') {
                const sollLower = soll.toLowerCase(); const istLower = gefundenerWert.toLowerCase();
                if (gefundenerWert === "Nicht gefunden") isError = true;
                else if (sollLower.includes("hb 38-2") && istLower.includes("hb 38-2")) {
                    if (sollLower.includes("schwarz") && !istLower.includes("schwarz")) isError = true;
                    if (sollLower.includes("edelstahl") && !istLower.includes("edelstahl")) isError = true;
                } else {
                    const codesSoll = extractOcrCodes(soll); const codesIstFull = extractOcrCodes(fullImgText);
                    if (codesSoll.filter(c => !codesIstFull.includes(c)).length > 0) isError = true;
                }
            }
            else if (key === 'Zarge') {
                const typSoll = soll.match(/A[1235]/i); const typIst = gefundenerWert.match(/A[1235]/i);
                if ((typSoll && typIst && typSoll[0].toUpperCase() !== typIst[0].toUpperCase()) || (typSoll && !typIst)) isError = true;
            }
            else if (key.startsWith('Zusatz:')) {
                if (gefundenerWert === "Nicht gefunden") isError = true;
            }

            if (isError) errors.push({ bauteil: key, soll: soll, ist: formatOcrOutput(gefundenerWert) });
        }

        pBar.style.width = '100%';

        // --- ERGEBNIS AUSGEBEN ---
        if (errors.length === 0) {
            resultDiv.innerHTML = `<div style='text-align:center; padding: 20px; background:#eafaf1; border-radius:6px;'><h3 style='color:var(--friendly-green); margin:0;'>✅ Keine Fehler gefunden!</h3><p style="color:#666; margin-top:5px;">Alle Werte stimmen scheinbar überein.</p></div>`;
        } else {
            let html = `<h4 style='color:var(--error-red); margin-top:0;'>⚠️ Abweichungen gefunden</h4>
                        <table class='result-table'>
                            <thead><tr><th>Bauteil</th><th>PDF (Soll)</th><th>Konfigurator (Ist)</th></tr></thead>
                            <tbody>`;
            errors.forEach(e => {
                html += `<tr>
                            <td><strong>${e.bauteil}</strong></td>
                            <td>${e.soll}</td>
                            <td style="color:var(--error-red); font-weight:bold;">${e.ist}</td>
                         </tr>`;
            });
            resultDiv.innerHTML = html + `</tbody></table>`;
        }

    } catch (e) {
        console.error(e);
        ocrLog("FEHLER: " + e.message);
        resultDiv.innerHTML = `<p style="color:var(--error-red);">Ein kritischer Fehler ist aufgetreten.</p>`;
    } finally {
        submitBtn.disabled = false;
        setTimeout(() => { pContainer.style.display = 'none'; }, 2000);
    }
};

// =========================================================
// TEXT-KONVERTER FEHLERBERICHT METHODEN
// =========================================================
window.openTextConverterErrorModal = () => {
    const userEmail = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.email : '';
    const emailInput = document.getElementById('txtConvUserEmail');
    if (emailInput) {
        emailInput.value = userEmail;
    }
    const commentInput = document.getElementById('txtConvUserComment');
    if (commentInput) {
        commentInput.value = '';
    }
    const fb = document.getElementById('textConverterErrorFeedback');
    if (fb) fb.style.display = 'none';

    document.getElementById('textConverterErrorModal').style.display = 'flex';
};

window.closeTextConverterErrorModal = () => {
    document.getElementById('textConverterErrorModal').style.display = 'none';
};

window.submitTextConverterError = async (event) => {
    if (event) event.preventDefault();

    const originalText = document.getElementById('toolOrderInput').value.trim();
    const generatedChecklistText = document.getElementById('toolOrderChecklist').innerText || "";
    const userEmail = document.getElementById('txtConvUserEmail').value.trim();
    const userComment = document.getElementById('txtConvUserComment').value.trim();

    if (!userEmail || !userComment) {
        alert("Bitte füllen Sie alle Pflichtfelder aus.");
        return;
    }

    const feedbackDiv = document.getElementById('textConverterErrorFeedback');
    const submitBtn = document.querySelector('#textConverterErrorForm button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "Senden";

    if (submitBtn) {
        submitBtn.innerHTML = "Sende...";
        submitBtn.disabled = true;
    }

    try {
        const payload = {
            originalText: originalText,
            generatedChecklistText: generatedChecklistText,
            userEmail: userEmail,
            userComment: userComment
        };

        if (typeof window.saveTextConverterTicket === 'function') {
            const docId = await window.saveTextConverterTicket(payload);
            if (docId) {
                if (feedbackDiv) {
                    feedbackDiv.style.display = 'block';
                    feedbackDiv.style.background = '#eafaf1';
                    feedbackDiv.style.color = '#137333';
                    feedbackDiv.innerText = "Fehlerbericht erfolgreich übermittelt!";
                }
                setTimeout(() => {
                    window.closeTextConverterErrorModal();
                    document.getElementById('textConverterErrorForm').reset();
                }, 2000);
            } else {
                throw new Error("Konnte Bericht nicht in der Datenbank speichern.");
            }
        } else {
            throw new Error("Datenbankfunktion saveCarlFeedback nicht gefunden.");
        }
    } catch (err) {
        console.error("Fehler beim Senden des Text-Konverter Fehlerberichts:", err);
        if (feedbackDiv) {
            feedbackDiv.style.display = 'block';
            feedbackDiv.style.background = '#fde8e8';
            feedbackDiv.style.color = '#9b1c1c';
            feedbackDiv.innerText = "Fehler beim Senden: " + err.message;
        }
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }
};

// Startet den Listener
document.addEventListener('DOMContentLoaded', initOcrToolListeners);
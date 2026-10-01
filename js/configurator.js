        let currentFittingLeft = 'Z'; let currentFittingRight = 'Z'; let currentSeries = 'BR40'; // Standard ist 40
        // LEER! Wird später gefüllt.
        let partsDB = {};
        let lamellenMatrix = []; // Speichert alle Kombinationen
        let lamellenGlobals = { weiss: 0, color: 0, ral: 0 }; // Speichert die globalen Farb-Aufpreise
        let currentViewList = []; let calculatedList = []; let isGraphicMode = false; const freightCost = 15.00;

        function markDirty() {
            const btn = document.getElementById('btnCalculate');
            if (!btn) return;

            const useTop = document.getElementById('checkTop') ? document.getElementById('checkTop').checked : false;
            const useMiddle = document.getElementById('checkMiddle') ? document.getElementById('checkMiddle').checked : false;
            const useBottom = document.getElementById('checkBottom') ? document.getElementById('checkBottom').checked : false;

            // Blockiert den Button, wenn keine Sektion angewählt ist
            if (!useTop && !useMiddle && !useBottom) {
                btn.disabled = true;
                btn.classList.remove('dirty');
                btn.innerText = "Mind. 1 Sektion wählen!";
                return;
            }

            btn.disabled = false;
            btn.classList.add('dirty');
            btn.innerText = "Änderungen übernehmen (Neu berechnen)";
        }

        function handleOptionAToggle(toggledId) {
            const ids = ['checkRC2', 'checkTVS', 'check170kg', 'check170kgSchlupf'];
            const current = document.getElementById(toggledId);
            if (current && current.checked) {
                ids.forEach(id => {
                    if (id !== toggledId) {
                        const el = document.getElementById(id);
                        if (el) el.checked = false;
                    }
                });
            }
            markDirty();
        }
        window.handleOptionAToggle = handleOptionAToggle;

        function handleOptionBToggle(toggledId) {
            const ids = ['checkRC2_B', 'checkTVS_B', 'check170kg_B', 'check170kgSchlupf_B', 'check5001mm_B'];
            const current = document.getElementById(toggledId);
            if (current && current.checked) {
                ids.forEach(id => {
                    if (id !== toggledId) {
                        const el = document.getElementById(id);
                        if (el) el.checked = false;
                    }
                });
            }
            updateListFromGraphic();
        }
        window.handleOptionBToggle = handleOptionBToggle;

        function checkZConstraints() {
            const w = parseInt(document.getElementById('inputWidth')?.value) || 0;
            const h = parseInt(document.getElementById('inputHeight')?.value) || 0;

            const oberflaecheSelect = document.getElementById('lamOberflaeche');
            const oberflaeche = oberflaecheSelect ? oberflaecheSelect.value : '';

            const rowTVS_B = document.getElementById('rowTVS_B');
            const checkTVS_B = document.getElementById('checkTVS_B');
            const row170_B = document.getElementById('row170kg_B');
            const check170_B = document.getElementById('check170kg_B');
            const row170Schlupf_B = document.getElementById('row170kgSchlupf_B');
            const check170Schlupf_B = document.getElementById('check170kgSchlupf_B');

            const optionRows_B = [rowTVS_B, row170_B, row170Schlupf_B];
            const optionChecks_B = [checkTVS_B, check170_B, check170Schlupf_B];

            if (currentSeries !== 'BR40') {
                optionRows_B.forEach(r => { if (r) r.style.display = 'none'; });
                optionChecks_B.forEach(c => { if (c) c.checked = false; });
                return;
            }

            const btnR = document.getElementById('btnFitZ_R');
            let zPossible = true;

            // REGELWERK Z-BESCHLAG (Standard):
            if (w > 4000) zPossible = false;
            else if (w > 3500 && h > 2250) zPossible = false;
            else if (w > 3250 && h > 2375) zPossible = false;
            else {
                if (h > 2625) zPossible = false;
            }

            if (oberflaeche === 'Silkgrain' || oberflaeche === 'Sandgrain' || oberflaeche === 'D-Sicke') {
                if (w > 3000 || h > 2625) {
                    zPossible = false;
                }
            }

            if (!zPossible) {
                if (btnR) btnR.classList.add('disabled');
                if (currentFittingRight === 'Z') selectFittingRight('N');
                optionRows_B.forEach(r => { if (r) r.style.display = 'flex'; });
            } else {
                if (btnR) btnR.classList.remove('disabled');
                if (currentFittingRight === 'N' || currentFittingRight === 'L') {
                    optionRows_B.forEach(r => { if (r) r.style.display = 'flex'; });
                } else {
                    optionRows_B.forEach(r => { if (r) r.style.display = 'none'; });
                    optionChecks_B.forEach(c => { if (c) c.checked = false; });
                }
            }
        }
        window.checkZConstraints = checkZConstraints;

        function validateInput(input) {
            let val = parseInt(input.value) || 0;
            let min = 0; let max = 9999;

            if (input.id === 'inputWidth') { min = 1250; max = 6000; }
            if (input.id === 'inputHeight') { min = 1500; max = 3000; }

            if (val > max) { input.value = max; val = max; }
            if (val < min) { input.value = min; val = min; }

            onDimensionsChanged();
        }
        window.validateInput = validateInput;

        function changeValue(inputId, delta) {
            const input = document.getElementById(inputId);
            if (!input) return;

            let val = parseInt(input.value) || 0;
            let newVal = val + delta;

            let min = parseInt(input.getAttribute('min')) || 0;
            let max = parseInt(input.getAttribute('max')) || 9999;

            if (newVal > max) newVal = max;
            if (newVal < min) newVal = min;

            input.value = newVal;
            onDimensionsChanged();
        }
        window.changeValue = changeValue;

        function onDimensionsChanged() {
            checkZConstraints();
            renderDynamicGateGraphic();
            updateListFromGraphic();
        }
        window.onDimensionsChanged = onDimensionsChanged;

        function selectFittingRight(type) {
            currentFittingRight = type;
            currentFittingLeft = type;
            document.querySelectorAll('#fitting-options-B .fitting-btn').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById('btnFit' + type + '_R');
            if (btn) btn.classList.add('active');

            const row170_B = document.getElementById('row170kg_B');
            const check170_B = document.getElementById('check170kg_B');
            const row170Schlupf_B = document.getElementById('row170kgSchlupf_B');
            const check170Schlupf_B = document.getElementById('check170kgSchlupf_B');
            const rowTVS_B = document.getElementById('rowTVS_B');
            const checkTVS_B = document.getElementById('checkTVS_B');

            const optionRows_B = [rowTVS_B, row170_B, row170Schlupf_B];
            const optionChecks_B = [checkTVS_B, check170_B, check170Schlupf_B];

            if (currentSeries === 'BR40' && (type === 'N' || type === 'L')) {
                optionRows_B.forEach(r => { if (r) r.style.display = 'flex'; });
            } else {
                optionRows_B.forEach(r => { if (r) r.style.display = 'none'; });
                optionChecks_B.forEach(c => { if (c) c.checked = false; });
            }

            renderDynamicGateGraphic();
            updateListFromGraphic();
        }
        window.selectFittingRight = selectFittingRight;

        function autoCalc() {
            const inputH = document.getElementById('inputHeight');
            const h = inputH ? (parseInt(inputH.value) || 0) : 0;
            const inputCount = document.getElementById('inputMiddleCount');
            let totalSections = 4;
            if (h <= 2250) totalSections = 4;
            else if (h <= 2750) totalSections = 5;
            else totalSections = 6;
            let maxMiddleSections = Math.max(0, totalSections - 2);
            if (inputCount) {
                inputCount.setAttribute('max', maxMiddleSections);
                inputCount.value = maxMiddleSections;
            }
        }

        // --- NEU: Toggle-Funktion für die Grafik (Mit starkem visuellem Feedback) ---
        window.toggleVisualGraphic = () => {
            const wrap = document.getElementById('visualCollapsible');
            const header = document.getElementById('optionBHeader');
            const arrow = document.getElementById('visualArrow');
            const hintText = document.getElementById('visualHintText');

            if (!wrap) return;

            if (wrap.classList.contains('visual-collapsed')) {
                // AUFKLAPPEN (Grafik ist wieder da)
                wrap.classList.remove('visual-collapsed');
                if (header) header.classList.remove('header-collapsed-mode');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
                if (hintText) hintText.innerText = "Zeichnung ausblenden";

                // Prüfen, ob Punkte aktiv sind. Wenn ja, Filter-Liste laden.
                const activeMarkers = document.querySelectorAll('.part-marker.active');
                if (activeMarkers.length > 0) {
                    updateListFromGraphic();
                } else if (calculatedList.length > 0) {
                    // Ansonsten die berechnete Liste von Option A anzeigen
                    renderTable(calculatedList);
                }
            } else {
                // EINKLAPPEN (Grafik ist weg)
                wrap.classList.add('visual-collapsed');
                if (header) header.classList.add('header-collapsed-mode');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
                if (hintText) hintText.innerText = "Zeichnung einblenden";

                // WICHTIG: Tabelle muss beim Einklappen sichtbar bleiben!
                if (calculatedList.length > 0) {
                    isGraphicMode = false;
                    renderTable(calculatedList);
                    const resetBtn = document.getElementById('btnResetFilter');
                    if (resetBtn) resetBtn.style.display = 'none';
                }
            }
        };

        // --- BERECHNUNG: SEKTIONEN & BAUTEILE (Baureihe 40 & 30) ---
        window.calculateSidebar = () => {
            const btnCalc = document.getElementById('btnCalculate');

            // --- SICHERHEITS-CHECK VOR DER BERECHNUNG ---
            if (currentSeries === 'BR30') {
                const yearSelect = document.getElementById('selectBR30Year');
                if (yearSelect && yearSelect.value === "") {
                    alert("Bitte wählen Sie zuerst das Baujahr aus (oben unter dem Reiter 'Baureihe 30'), um die korrekten Teile zu berechnen.");
                    yearSelect.classList.add('shake-element', 'input-required');
                    setTimeout(() => yearSelect.classList.remove('shake-element'), 400);
                    return;
                } else if (yearSelect) {
                    yearSelect.classList.remove('input-required');
                }
            }

            btnCalc.classList.remove('dirty');
            btnCalc.innerText = "Berechne...";
            btnCalc.disabled = true;

            const width = parseInt(document.getElementById('inputWidth').value) || 2500;
            const middleCount = parseInt(document.getElementById('inputMiddleCount').value) || 2;
            const useBottom = document.getElementById('checkBottom').checked;
            const useMiddle = document.getElementById('checkMiddle').checked;
            const useTop = document.getElementById('checkTop').checked;

            const isRC2 = document.getElementById('checkRC2') ? document.getElementById('checkRC2').checked : false;
            const isTVS = document.getElementById('checkTVS') ? document.getElementById('checkTVS').checked : false;
            const is170kg = document.getElementById('check170kg') ? document.getElementById('check170kg').checked : false;
            const is170kgSchlupf = document.getElementById('check170kgSchlupf') ? document.getElementById('check170kgSchlupf').checked : false;
            const isOver5001 = width >= 5001;
            const isHeavyDuty = is170kg || is170kgSchlupf || isOver5001 || isTVS;

            const yearSelect = document.getElementById('selectBR30Year');
            const year = yearSelect ? yearSelect.value : "";

            let tempList = [];

            const add = (idStr, q, customProps = null, preventLinks = false) => {
                let p = partsDB[idStr];
                if (!p) return;

                let item = { ...p, id: idStr, qty: q, selected: true, uniqueId: Math.random(), preventLinks: preventLinks };
                if (customProps) {
                    item = { ...item, ...customProps };
                }
                tempList.push(item);
            };

            const addConn = (m) => {
                if (m > 0) {
                    if (currentSeries === 'BR30' && year === 'old') {
                        add('br30_rollenbock_42', 2 * m);
                    } else if (currentSeries === 'BR40') {
                        // Bei RC2, TVS, >170kg, Schlupftür oder >=5001mm nutzen wir die RC2-Stütze als Basis (zieht alle verknüpften Zubehörteile)
                        if (isRC2 || isHeavyDuty) {
                            add('rc2_stuetze_L', 1 * m);
                            add('rc2_stuetze_R', 1 * m);
                        } else {
                            add('rollenbock_L', 1 * m);
                            add('rollenbock_R', 1 * m);
                        }
                    } else {
                        add('rollenbock_L', 1 * m);
                        add('rollenbock_R', 1 * m);
                    }
                }
            };

            // --- 1. BODENSEKTION ---
            if (useBottom) {
                if (currentSeries === 'BR30') {
                    add('br30_aufsetz_L', 1);
                    add('br30_aufsetz_R', 1);
                } else {
                    if (currentFittingLeft === 'Z') {
                        add('aufsetz_L', 1);
                        add('aufsetz_R', 1);
                    } else if (currentFittingLeft === 'N' || currentFittingLeft === 'L') {
                        add('aufsetz_N_L', 1);
                        add('aufsetz_N_R', 1);
                    }
                    if (isRC2) {
                        add('rc2_sich_bolzen_z', 1);
                    }
                }

                const sealLengthMM = width + 54;
                const calculatedPrice = (sealLengthMM / 1000) * (partsDB['bottom_seal']?.price || 0);

                add('bottom_seal', 1, {
                    name: "Bodendichtung",
                    desc: `Länge: ${sealLengthMM} mm`,
                    price: calculatedPrice
                });
            }

            // --- 2. TOPSEKTION ---
            if (useTop) {
                if (currentSeries === 'BR30' && year === 'old') {
                    add('br30_top_halter_L_alt', 1);
                    add('br30_top_halter_R_alt', 1);
                } else if (currentSeries === 'BR30' && year === 'new') {
                    if (currentFittingLeft === 'N') {
                        add('top_rollenbock_N_L', 1, null, true);
                        add('top_rollenbock_N_R', 1, null, true);
                        add('top_holder_N_L', 1, null, true);
                        add('top_holder_N_R', 1, null, true);
                    } else if (currentFittingLeft === 'L') {
                        add('top_rollenbock_N_L', 1, null, true);
                        add('top_rollenbock_N_R', 1, null, true);
                        add('top_holder_N_R', 1, null, true);
                        add('top_holder_N_L', 1, null, true);
                    }
                } else {
                    if (currentFittingLeft === 'Z') {
                        if (isRC2) {
                            add('rc2_top_z_L', 1);
                            add('rc2_top_z_R', 1);
                        } else {
                            add('top_rollenhalter_L', 1);
                            add('top_rollenhalter_R', 1);
                        }
                    } else if (currentFittingLeft === 'N') {
                        add('top_holder_N_L', 1);
                        add('top_holder_N_R', 1);
                        if (isRC2) {
                            add('rc2_verstaerkung_n_L', 1);
                            add('rc2_verstaerkung_n_R', 1);
                        }
                    } else if (currentFittingLeft === 'L') {
                        if (isRC2) {
                            add('rc2_top_l_L', 1);
                            add('rc2_top_l_R', 1);
                        } else {
                            add('top_holder_L_R', 2);
                        }
                    }
                }
            }

            // --- 3. EXAKTE BERECHNUNG DER VERBINDUNGEN ---
            let connectionCount = 0;
            if (useMiddle) connectionCount += (middleCount + 1);
            if (useBottom && !useMiddle) connectionCount += 1;
            if (useTop && !useMiddle) connectionCount += 1;
            addConn(connectionCount);

            // --- 4. SCHARNIERE (Mittelscharniere) ---
            let totalSections = 0;
            if (useBottom) totalSections++;
            if (useMiddle) totalSections += middleCount;
            if (useTop) totalSections++;

            let hingeRows = Math.max(0, totalSections - 1);
            if (hingeRows > 0) {
                let hpr = 0;
                if (width <= 2500) hpr = 1;
                else if (width <= 3500) hpr = 2;
                else if (width <= 4500) hpr = 3;
                else if (width <= 5500) hpr = 4;
                else if (width <= 6000) hpr = 5;

                if (hpr > 0) {
                    if (currentSeries === 'BR30' && year === 'old') {
                        add('br30_scharnier_alt', hpr * hingeRows);
                    } else {
                        if (isOver5001 || isTVS) add('scharnier_6', hpr * hingeRows);
                        else add('scharnier', hpr * hingeRows);
                    }
                }
            }

            // --- 5. MERGE & RENDER ---
            const merged = {};
            tempList.forEach(i => {
                if (!merged[i.id]) merged[i.id] = { ...i };
                else merged[i.id].qty += i.qty;

                if (i.linkedParts && !i.preventLinks) {
                    i.linkedParts.forEach(linkId => {
                        const linkedPart = partsDB[linkId];
                        if (linkedPart) {
                            if (!merged[linkId]) merged[linkId] = { ...linkedPart, id: linkId, qty: i.qty, selected: true };
                            else merged[linkId].qty += i.qty;
                        }
                    });
                }
            });

            // --- BEREINIGUNG SCHARNIERE BEI TVS / >= 5001 ---
            if (isOver5001 || isTVS) {
                if (merged['scharnier']) delete merged['scharnier'];
                for (let k in merged) {
                    if (k !== 'scharnier_6') {
                        let lowerName = (merged[k].name || '').toLowerCase();
                        if (lowerName.includes('scharnier typ 2') && !lowerName.includes('rc')) delete merged[k];
                    }
                }
            }

            // --- ROLLENHALTER LOGIK: HEAVY DUTY vs STANDARD RC2 ---
            if (isHeavyDuty) {
                let qty = 0;
                if (merged['rc2_rollenhalter']) {
                    qty = merged['rc2_rollenhalter'].qty;
                    delete merged['rc2_rollenhalter'];
                }
                for (let k in merged) {
                    if (merged[k].artNr === '3054772') delete merged[k];
                }
                if (partsDB['rollenhalter_h']) {
                    if (!merged['rollenhalter_h']) {
                        merged['rollenhalter_h'] = { ...partsDB['rollenhalter_h'], id: 'rollenhalter_h', qty: qty || (2 * connectionCount), selected: true, uniqueId: Math.random() };
                    } else if (qty > 0) {
                        merged['rollenhalter_h'].qty = Math.max(merged['rollenhalter_h'].qty, qty);
                    }
                }
            } else if (isRC2) {
                // Bei Standard RC2 (ohne Schwerlast): Rollenhalter H (3039948) entfernen!
                delete merged['rollenhalter_h'];
                for (let k in merged) {
                    if (merged[k].artNr === '3039948') delete merged[k];
                }
            }

            // --- STÜTZE FÜR ROLLENBOCK (3041156 / 3041155) BEI > 170kg MIT SCHLUPFTÜR ENTFERNEN ---
            if (is170kgSchlupf) {
                delete merged['rc2_stuetze_L'];
                delete merged['rc2_stuetze_R'];
                for (let k in merged) {
                    const art = String(merged[k].artNr || '').trim();
                    const name = (merged[k].name || '').toLowerCase();
                    if (art === '3041156' || art === '3041155' || name.includes('stütze für rollenbock')) {
                        delete merged[k];
                    }
                }
            }

            calculatedList = Object.values(merged);
            renderTable(calculatedList);

            // FIX: Button wird wieder grau und gesperrt (wie früher)
            btnCalc.disabled = true;
            btnCalc.classList.remove('dirty');
            btnCalc.innerText = "Berechnet ✓";

            const btnPdf = document.getElementById('btnPdf');
            if (btnPdf) btnPdf.disabled = false;
            const btnPdfMail = document.getElementById('btnPdfMail');
            if (btnPdfMail) btnPdfMail.disabled = false;
            // Skizze sauber über die Hauptfunktion einklappen, falls sie offen ist
            const visualWrap = document.getElementById('visualCollapsible');
            if (visualWrap && !visualWrap.classList.contains('visual-collapsed')) {
                window.toggleVisualGraphic();
            }

            // Scrollt weich nach oben zu Option B, passend zur Einklapp-Animation
            setTimeout(() => {
                const target = document.getElementById('optionBCard');
                if (target) {
                    const yOffset = -20; // Leichter Abstand zum oberen Bildschirmrand
                    const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }, 350); // 350ms Verzögerung, damit die CSS-Höhenänderung fast abgeschlossen ist
        };
        // ==========================================
        // DYNAMISCHE 2D-VEKTORGRAFIK (ECHTZEIT)
        // ==========================================
        function renderDynamicGateGraphic() {
            const wrapper = document.getElementById('visualWrapper');
            if (!wrapper) return;

            const width = parseInt(document.getElementById('inputWidth')?.value) || 2500;
            const height = parseInt(document.getElementById('inputHeight')?.value) || 2125;

            // Bestehende Markerauswahl merken
            const previouslyActive = new Set();
            wrapper.querySelectorAll('.part-marker.active').forEach(m => {
                const id = m.getAttribute('data-marker-id');
                if (id) previouslyActive.add(id);
            });
            const wasBottomSealActive = !!wrapper.querySelector('.pos-bottom-seal.active');

            let numPanels = 4;
            if (height <= 2250) numPanels = 4;
            else if (height <= 2750) numPanels = 5;
            else numPanels = 6;

            let hingesPerRow = 1;
            if (width <= 2500) hingesPerRow = 1;
            else if (width <= 3500) hingesPerRow = 2;
            else if (width <= 4500) hingesPerRow = 3;
            else if (width <= 5500) hingesPerRow = 4;
            else hingesPerRow = 5;

            const numSeams = numPanels - 1;

            // Breiteres Panorama-Format für ein realistisch proportioniertes Sektionaltor
            const svgW = 750;
            const svgH = 460;
            const doorX = 35;
            const doorW = 670;
            const doorTopY = 28;
            const doorH = 390;
            const panelH = doorH / numPanels;

            let svgHtml = `
            <svg viewBox="0 0 ${svgW} ${svgH}" class="visual-img-bg" style="width: 100%; height: auto; display: block; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.06));" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="gatePanelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="60%" stop-color="#f8fafc"/>
                        <stop offset="100%" stop-color="#f1f5f9"/>
                    </linearGradient>
                    <linearGradient id="metalTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#64748b"/>
                        <stop offset="50%" stop-color="#94a3b8"/>
                        <stop offset="100%" stop-color="#475569"/>
                    </linearGradient>
                    <linearGradient id="hingeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#cbd5e1"/>
                        <stop offset="50%" stop-color="#94a3b8"/>
                        <stop offset="100%" stop-color="#64748b"/>
                    </linearGradient>
                </defs>

                <!-- Sturz-Querträger / Header -->
                <rect x="18" y="12" width="704" height="16" rx="2" fill="url(#metalTrackGrad)"/>
                <rect x="22" y="15" width="696" height="2" fill="#e2e8f0" opacity="0.6"/>

                <!-- Linke Führungsschiene / Zarge -->
                <rect x="18" y="26" width="16" height="${doorH + 4}" fill="url(#metalTrackGrad)" rx="1"/>
                
                <!-- Rechte Führungsschiene / Zarge -->
                <rect x="706" y="26" width="16" height="${doorH + 4}" fill="url(#metalTrackGrad)" rx="1"/>
            `;

            // Lamellen (Panels) zeichnen (3 innere Sicken / Striche pro Lamelle)
            const lockPanelIndex = numPanels - 2; // Schloss sitzt immer auf der zweituntersten Lamelle

            for (let i = 0; i < numPanels; i++) {
                const pY = doorTopY + i * panelH;
                svgHtml += `
                <!-- Lamelle ${i + 1} -->
                <rect x="${doorX}" y="${pY}" width="${doorW}" height="${panelH}" fill="url(#gatePanelGrad)" stroke="#94a3b8" stroke-width="1.5"/>
                <line x1="${doorX + 8}" y1="${pY + panelH * 0.25}" x2="${doorX + doorW - 8}" y2="${pY + panelH * 0.25}" stroke="#e2e8f0" stroke-width="1.2"/>
                <line x1="${doorX + 8}" y1="${pY + panelH * 0.50}" x2="${doorX + doorW - 8}" y2="${pY + panelH * 0.50}" stroke="#e2e8f0" stroke-width="1.2"/>
                <line x1="${doorX + 8}" y1="${pY + panelH * 0.75}" x2="${doorX + doorW - 8}" y2="${pY + panelH * 0.75}" stroke="#e2e8f0" stroke-width="1.2"/>
                `;

                // Exakte technische Griff- und Verriegelungsgarnitur mit Schubstange zur rechten Zarge (kompakt skaliert)
                if (i === lockPanelIndex) {
                    const lockX = doorX + doorW - 135;
                    const lockY = pY + panelH * 0.45;
                    const rodLength = (doorX + doorW - 10) - (lockX + 8);

                    svgHtml += `
                    <!-- Griff- & Schlossgarnitur mit Schubstange (Hörmann Originalgetreu, kompakt skaliert) -->
                    <g id="gateLockAssembly">
                        <!-- Schlosskasten (Gehäuse) -->
                        <g transform="translate(${lockX}, ${lockY}) scale(0.55)">
                            <rect x="-14" y="-18" width="28" height="40" rx="3" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
                            <rect x="-11" y="-15" width="22" height="34" rx="2" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.8"/>
                            
                            <!-- Befestigungsschrauben oben rechts -->
                            <circle cx="7" cy="-9" r="2" fill="#1e293b"/>
                            <circle cx="7" cy="-9" r="0.8" fill="#ffffff"/>
                            <circle cx="7" cy="-1" r="2" fill="#1e293b"/>
                            <circle cx="7" cy="-1" r="0.8" fill="#ffffff"/>

                            <!-- Drehmechanismus / Führungsauge -->
                            <path d="M -7 10 Q 0 3 7 10" fill="none" stroke="#1e293b" stroke-width="1.8"/>
                            <circle cx="0" cy="10" r="4.2" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.6"/>
                            <circle cx="0" cy="10" r="1.4" fill="#1e293b"/>

                            <!-- T-Griff / Griffmulde (Horizontaler Ovalgriff) -->
                            <g transform="translate(0, 30)">
                                <rect x="-3" y="-8" width="6" height="8" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
                                <path d="M -20 -2 C -20 -7, 20 -7, 20 -2 C 22 4, 16 7, 10 7 L -10 7 C -16 7, -22 4, -20 -2 Z" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
                                <path d="M -13 -1 C -13 -3.5, 13 -3.5, 13 -1 C 14 2.5, 10 3.5, 7 3.5 L -7 3.5 C -10 3.5, -14 2.5, -13 -1 Z" fill="#ffffff" stroke="#1e293b" stroke-width="0.8"/>
                            </g>
                        </g>

                        <!-- Verriegelungsstange / Schubstange zur rechten Zarge -->
                        <g transform="translate(${lockX + 8}, ${lockY + 5.5})">
                            <rect x="0" y="-2" width="${rodLength}" height="4" rx="1" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
                            
                            <!-- Drehgelenk-Auge am Schloss -->
                            <circle cx="0" cy="0" r="2.8" fill="#cbd5e1" stroke="#1e293b" stroke-width="1.2"/>
                            <circle cx="0" cy="0" r="1" fill="#1e293b"/>

                            <!-- Mittlere Führungs- und Einstell-Lasche -->
                            <g transform="translate(${rodLength * 0.65}, -4)">
                                <rect x="0" y="0" width="9" height="8" rx="1.5" fill="#cbd5e1" stroke="#1e293b" stroke-width="1.2"/>
                                <circle cx="4.5" cy="4" r="1.6" fill="#1e293b"/>
                                <circle cx="4.5" cy="4" r="0.6" fill="#ffffff"/>
                            </g>
                        </g>

                        <!-- Schnäpper / Arretierung an der rechten Zarge -->
                        <g transform="translate(${doorX + doorW - 10}, ${lockY + 5.5}) scale(0.55)">
                            <rect x="0" y="-18" width="14" height="36" rx="2" fill="#e2e8f0" stroke="#1e293b" stroke-width="2"/>
                            <circle cx="7" cy="-12" r="1.8" fill="#1e293b"/>
                            <circle cx="7" cy="12" r="1.8" fill="#1e293b"/>
                            <rect x="-6" y="-6" width="10" height="12" rx="1.5" fill="#cbd5e1" stroke="#1e293b" stroke-width="1.5"/>
                            <line x1="-2" y1="-8" x2="-2" y2="8" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="-2" cy="-8" r="1.5" fill="#475569"/>
                            <circle cx="-2" cy="8" r="1.5" fill="#475569"/>
                        </g>
                    </g>
                    `;
                }
            }

            // Obere Rollenhalter / Top fixtures (Rollen zentriert bei X=29 und X=711)
            svgHtml += `
            <g transform="translate(${doorX + 2}, ${doorTopY + 2})">
                <rect x="0" y="0" width="18" height="24" rx="2" fill="url(#hingeGrad)" stroke="#475569"/>
                <circle cx="-8" cy="12" r="5.5" fill="#1e293b" stroke="#cbd5e1"/>
            </g>
            <g transform="translate(${doorX + doorW - 20}, ${doorTopY + 2})">
                <rect x="0" y="0" width="18" height="24" rx="2" fill="url(#hingeGrad)" stroke="#475569"/>
                <circle cx="26" cy="12" r="5.5" fill="#1e293b" stroke="#cbd5e1"/>
            </g>
            `;

            // Stoßfugen, Rollenböcke und Mittelscharniere
            for (let s = 0; s < numSeams; s++) {
                const seamY = doorTopY + (s + 1) * panelH;
                svgHtml += `
                <!-- Fuge ${s + 1} -->
                <line x1="${doorX}" y1="${seamY - 1}" x2="${doorX + doorW}" y2="${seamY - 1}" stroke="#475569" stroke-width="2"/>
                <line x1="${doorX}" y1="${seamY + 1}" x2="${doorX + doorW}" y2="${seamY + 1}" stroke="#1e293b" stroke-width="1.5"/>

                <!-- Rollenbock links -->
                <g transform="translate(${doorX + 2}, ${seamY - 13})">
                    <rect x="0" y="0" width="18" height="26" rx="2" fill="url(#hingeGrad)" stroke="#334155"/>
                    <circle cx="9" cy="5" r="2" fill="#fff"/>
                    <circle cx="9" cy="21" r="2" fill="#fff"/>
                    <circle cx="-8" cy="13" r="5.5" fill="#1e293b" stroke="#cbd5e1"/>
                </g>

                <!-- Rollenbock rechts -->
                <g transform="translate(${doorX + doorW - 20}, ${seamY - 13})">
                    <rect x="0" y="0" width="18" height="26" rx="2" fill="url(#hingeGrad)" stroke="#334155"/>
                    <circle cx="9" cy="5" r="2" fill="#fff"/>
                    <circle cx="9" cy="21" r="2" fill="#fff"/>
                    <circle cx="26" cy="13" r="5.5" fill="#1e293b" stroke="#cbd5e1"/>
                </g>
                `;

                // Mittelscharniere
                for (let c = 0; c < hingesPerRow; c++) {
                    const hingeX = doorX + doorW * ((c + 1) / (hingesPerRow + 1));
                    svgHtml += `
                    <!-- Mittelscharnier ${s}_${c} -->
                    <g transform="translate(${hingeX - 10}, ${seamY - 14})">
                        <rect x="0" y="0" width="20" height="28" rx="2" fill="url(#hingeGrad)" stroke="#334155"/>
                        <line x1="2" y1="14" x2="18" y2="14" stroke="#1e293b" stroke-width="1.5"/>
                        <circle cx="10" cy="5" r="2" fill="#fff"/>
                        <circle cx="10" cy="23" r="2" fill="#fff"/>
                    </g>
                    `;
                }
            }

            // Bodensektion Aufsetzstücke & Dichtung (bündig, ohne Überstand und ohne graue Striche)
            svgHtml += `
            <g transform="translate(${doorX + 2}, ${doorTopY + doorH - 26})">
                <rect x="0" y="0" width="18" height="24" rx="2" fill="url(#hingeGrad)" stroke="#475569"/>
                <circle cx="-8" cy="10" r="5.5" fill="#1e293b" stroke="#cbd5e1"/>
            </g>
            <g transform="translate(${doorX + doorW - 20}, ${doorTopY + doorH - 26})">
                <rect x="0" y="0" width="18" height="24" rx="2" fill="url(#hingeGrad)" stroke="#475569"/>
                <circle cx="26" cy="10" r="5.5" fill="#1e293b" stroke="#cbd5e1"/>
            </g>

            <!-- Bodendichtung Profil (bündig am unteren Torabschluss) -->
            <rect x="${doorX}" y="${doorTopY + doorH - 4}" width="${doorW}" height="5" rx="1" fill="#1e293b"/>
            </svg>
            `;

            // HTML Marker Overlays
            let markersHtml = '';
            const getMarkerClass = (id) => previouslyActive.has(id) ? 'part-marker active' : 'part-marker';

            // Seitliche Marker exakt im Mittelpunkt zwischen Scharnier und Rolle zentrieren
            const leftXPct = (37 / svgW) * 100;   // ~4.93%
            const rightXPct = (703 / svgW) * 100; // ~93.73%

            // Top Marker
            const topYPct = (40 / svgH) * 100;

            markersHtml += `
            <div class="${getMarkerClass('top_L')}" data-marker-id="top_L" data-pos-key="top_L" style="top: ${topYPct}%; left: ${leftXPct}%;" onclick="toggleDynamicMarker('top_L', this)" title="Topsektion links"></div>
            <div class="${getMarkerClass('top_R')}" data-marker-id="top_R" data-pos-key="top_R" style="top: ${topYPct}%; left: ${rightXPct}%;" onclick="toggleDynamicMarker('top_R', this)" title="Topsektion rechts"></div>
            `;

            // Zwischensektionen (Rollenböcke & Mittelscharniere)
            for (let s = 0; s < numSeams; s++) {
                const seamY = doorTopY + (s + 1) * panelH;
                const seamYPct = (seamY / svgH) * 100;
                const mlId = `middle_L_${s}`;
                const mrId = `middle_R_${s}`;

                markersHtml += `
                <div class="${getMarkerClass(mlId)}" data-marker-id="${mlId}" data-pos-key="middle_L" style="top: ${seamYPct}%; left: ${leftXPct}%;" onclick="toggleDynamicMarker('middle_L', this)" title="Zwischensektion links (${s + 1})"></div>
                <div class="${getMarkerClass(mrId)}" data-marker-id="${mrId}" data-pos-key="middle_R" style="top: ${seamYPct}%; left: ${rightXPct}%;" onclick="toggleDynamicMarker('middle_R', this)" title="Zwischensektion rechts (${s + 1})"></div>
                `;

                for (let c = 0; c < hingesPerRow; c++) {
                    const hingeX = doorX + doorW * ((c + 1) / (hingesPerRow + 1));
                    const hingeXPct = (hingeX / svgW) * 100;
                    const cId = `center_${s}_${c}`;

                    markersHtml += `
                    <div class="${getMarkerClass(cId)}" data-marker-id="${cId}" data-pos-key="center" style="top: ${seamYPct}%; left: ${hingeXPct}%;" onclick="toggleDynamicMarker('center', this)" title="Mittelscharnier (Reihe ${s + 1}, Pos ${c + 1})"></div>
                    `;
                }
            }

            // Bodensektion Marker
            const botYPct = (402 / svgH) * 100;
            markersHtml += `
            <div class="${getMarkerClass('bottom_L')}" data-marker-id="bottom_L" data-pos-key="bottom_L" style="top: ${botYPct}%; left: ${leftXPct}%;" onclick="toggleDynamicMarker('bottom_L', this)" title="Bodensektion links"></div>
            <div class="${getMarkerClass('bottom_R')}" data-marker-id="bottom_R" data-pos-key="bottom_R" style="top: ${botYPct}%; left: ${rightXPct}%;" onclick="toggleDynamicMarker('bottom_R', this)" title="Bodensektion rechts"></div>
            `;

            // Bodendichtung
            const sealClass = wasBottomSealActive ? 'part-marker pos-bottom-seal active' : 'part-marker pos-bottom-seal';
            const sealYPct = ((doorTopY + doorH - 2) / svgH) * 100;
            markersHtml += `
            <div class="${sealClass}" data-marker-id="bottom_seal" data-pos-key="bottom_seal" style="top: ${sealYPct}%; left: 50%; transform: translate(-50%, -50%); width: 75%; height: 18px; border-radius: 9px;" onclick="toggleDynamicMarker('bottom_seal', this)" title="Bodendichtung"></div>
            `;

            wrapper.innerHTML = `
            <div style="position: relative; width: 100%; max-width: 100%; margin: 0 auto; user-select: none;">
                ${svgHtml}
                ${markersHtml}
            </div>
            `;
        }
        window.renderDynamicGateGraphic = renderDynamicGateGraphic;

        function updateDeselectButtonState() {
            const btn = document.getElementById('btnDeselectAllMarkers');
            if (!btn) return;
            const activeMarkers = document.querySelectorAll('.part-marker.active');
            const isSealActive = !!document.querySelector('.pos-bottom-seal.active');
            const hasSelection = activeMarkers.length > 0 || isSealActive;
            
            if (hasSelection) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.style.borderColor = '#fca5a5';
                btn.style.background = '#fef2f2';
                btn.style.color = '#b91c1c';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.45';
                btn.style.cursor = 'not-allowed';
                btn.style.borderColor = '#cbd5e1';
                btn.style.background = '#f1f5f9';
                btn.style.color = '#94a3b8';
            }
        }
        window.updateDeselectButtonState = updateDeselectButtonState;

        function toggleDynamicMarker(posKey, element) {
            element.classList.toggle('active');
            updateListFromGraphic();
        }
        window.toggleDynamicMarker = toggleDynamicMarker;
        window.toggleMarker = toggleDynamicMarker;

        function selectAllMarkers() {
            const wrapper = document.getElementById('visualWrapper');
            if (!wrapper) return;
            wrapper.querySelectorAll('.part-marker').forEach(m => m.classList.add('active'));
            updateListFromGraphic();
        }
        window.selectAllMarkers = selectAllMarkers;

        function deselectAllMarkers() {
            const wrapper = document.getElementById('visualWrapper');
            if (!wrapper) return;
            wrapper.querySelectorAll('.part-marker').forEach(m => m.classList.remove('active'));
            updateListFromGraphic();
        }
        window.deselectAllMarkers = deselectAllMarkers;

        function resetMarkersVisuals() {
            const wrapper = document.getElementById('visualWrapper');
            if (!wrapper) return;
            wrapper.querySelectorAll('.part-marker').forEach(m => m.classList.remove('active'));
            updateDeselectButtonState();
        }
        window.resetMarkersVisuals = resetMarkersVisuals;

        // Aktualisiert die Artikelliste in Echtzeit basierend auf der Grafik & Maßen
        function updateListFromGraphic() {
            updateDeselectButtonState();
            const activeElements = document.querySelectorAll('.part-marker.active');
            const isSealActive = !!document.querySelector('.pos-bottom-seal.active');

            if (activeElements.length === 0 && !isSealActive) {
                resetGraphicFilter();
                return;
            }

            const yearSelect = document.getElementById('selectBR30Year');
            const year = yearSelect ? yearSelect.value : "";

            if (currentSeries === 'BR30') {
                if (year === "") {
                    if (yearSelect) {
                        yearSelect.classList.add('shake-element', 'input-required');
                        setTimeout(() => yearSelect.classList.remove('shake-element'), 400);
                    }
                    alert("Bitte wählen Sie zuerst das Baujahr aus, damit die Baureihe 30 korrekt berechnet werden kann.");
                    if (typeof renderTable === 'function') renderTable([]);
                    return;
                } else if (yearSelect) {
                    yearSelect.classList.remove('input-required');
                }
            }

            const btnReset = document.getElementById('btnResetFilter');
            if (btnReset) btnReset.style.display = 'block';

            isGraphicMode = true;
            let graphicListMap = {};

            const width = parseInt(document.getElementById('inputWidth')?.value) || 2500;

            // Schalter auslesen
            const isRC2 = document.getElementById('checkRC2_B') ? document.getElementById('checkRC2_B').checked : false;
            const isTVS = document.getElementById('checkTVS_B') ? document.getElementById('checkTVS_B').checked : false;
            const is170kg = document.getElementById('check170kg_B') ? document.getElementById('check170kg_B').checked : false;
            const is170kgSchlupf = document.getElementById('check170kgSchlupf_B') ? document.getElementById('check170kgSchlupf_B').checked : false;
            const isOver5001 = width >= 5001;
            const isHeavyDuty = is170kg || is170kgSchlupf || isOver5001 || isTVS;

            const addPartWithQty = (id, qty = 1, preventLinks = false) => {
                if (!partsDB[id]) return;
                if (!graphicListMap[id]) {
                    graphicListMap[id] = { ...partsDB[id], id: id, qty: qty, selected: true, uniqueId: Math.random() };
                } else {
                    graphicListMap[id].qty += qty;
                }

                if (!preventLinks && partsDB[id].linkedParts) {
                    partsDB[id].linkedParts.forEach(linkId => {
                        const linkedPart = partsDB[linkId];
                        if (linkedPart) {
                            if (!graphicListMap[linkId]) {
                                graphicListMap[linkId] = { ...linkedPart, id: linkId, qty: qty, selected: true, uniqueId: Math.random() };
                            } else {
                                graphicListMap[linkId].qty += qty;
                            }
                        }
                    });
                }
            };

            let countMiddleL = 0;
            let countMiddleR = 0;
            let countCenter = 0;
            let hasTopL = false;
            let hasTopR = false;
            let hasBottomL = false;
            let hasBottomR = false;

            activeElements.forEach(el => {
                const pos = el.getAttribute('data-pos-key') || el.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (pos === 'middle_L') countMiddleL++;
                else if (pos === 'middle_R') countMiddleR++;
                else if (pos === 'center') countCenter++;
                else if (pos === 'top_L') hasTopL = true;
                else if (pos === 'top_R') hasTopR = true;
                else if (pos === 'bottom_L') hasBottomL = true;
                else if (pos === 'bottom_R') hasBottomR = true;
            });

            // 1. Bodendichtung
            if (isSealActive) {
                if (currentSeries === 'BR20') {
                    if (partsDB.br20_bottom_seal) {
                        graphicListMap['br20_bottom_seal'] = {
                            ...partsDB.br20_bottom_seal,
                            id: 'br20_bottom_seal',
                            qty: width,
                            isMeterware: true,
                            selected: true,
                            uniqueId: Math.random()
                        };
                    }
                } else {
                    if (partsDB.bottom_seal) {
                        const sealLengthMM = width + 54;
                        const calculatedPrice = (sealLengthMM / 1000) * (partsDB['bottom_seal']?.price || 0);
                        graphicListMap['bottom_seal'] = {
                            ...partsDB.bottom_seal,
                            id: 'bottom_seal',
                            qty: 1,
                            desc: `Länge: ${sealLengthMM} mm`,
                            price: calculatedPrice,
                            selected: true,
                            uniqueId: Math.random()
                        };
                    }
                }
            }

            // 2. Bodensektion Aufsetzstücke
            if (hasBottomL) {
                if (currentSeries === 'BR20') addPartWithQty('br20_aufsetz_L', 1);
                else if (currentSeries === 'BR30') addPartWithQty('br30_aufsetz_L', 1);
                else addPartWithQty(currentFittingRight === 'Z' ? 'aufsetz_L' : 'aufsetz_N_L', 1);
            }
            if (hasBottomR) {
                if (currentSeries === 'BR20') addPartWithQty('br20_aufsetz_R', 1);
                else if (currentSeries === 'BR30') addPartWithQty('br30_aufsetz_R', 1);
                else addPartWithQty(currentFittingRight === 'Z' ? 'aufsetz_R' : 'aufsetz_N_R', 1);
            }

            // 3. Seitliche Scharniere / Rollenböcke
            if (countMiddleL > 0) {
                if (currentSeries === 'BR20') addPartWithQty('br20_scharnier_seitlich_L', countMiddleL);
                else if (currentSeries === 'BR30' && year === 'old') addPartWithQty('br30_rollenbock_42', countMiddleL);
                else {
                    if ((isRC2 || isHeavyDuty) && currentSeries === 'BR40') addPartWithQty('rc2_stuetze_L', countMiddleL);
                    else addPartWithQty('rollenbock_L', countMiddleL);
                }
            }
            if (countMiddleR > 0) {
                if (currentSeries === 'BR20') addPartWithQty('br20_scharnier_seitlich_R', countMiddleR);
                else if (currentSeries === 'BR30' && year === 'old') addPartWithQty('br30_rollenbock_42', countMiddleR);
                else {
                    if ((isRC2 || isHeavyDuty) && currentSeries === 'BR40') addPartWithQty('rc2_stuetze_R', countMiddleR);
                    else addPartWithQty('rollenbock_R', countMiddleR);
                }
            }

            // 4. Mittelscharniere
            if (countCenter > 0) {
                if (currentSeries === 'BR20') addPartWithQty('br20_mittelscharnier', countCenter);
                else if (currentSeries === 'BR30' && year === 'old') addPartWithQty('br30_scharnier_alt', countCenter);
                else {
                    if (isTVS || isOver5001) addPartWithQty('scharnier_6', countCenter);
                    else addPartWithQty('scharnier', countCenter);
                }
            }

            // 5. Topsektion
            if (hasTopL) {
                if (currentSeries === 'BR20') addPartWithQty('br20_top_befestigung_L', 1);
                else if (currentSeries === 'BR30' && year === 'old') addPartWithQty('br30_top_halter_L_alt', 1);
                else if (currentSeries === 'BR30' && year === 'new') {
                    if (currentFittingRight === 'N') {
                        addPartWithQty('top_rollenbock_N_L', 1, true);
                        addPartWithQty('top_holder_N_L', 1, true);
                    } else if (currentFittingRight === 'L') {
                        addPartWithQty('top_rollenbock_N_L', 1, true);
                        addPartWithQty('top_holder_N_R', 1, true);
                    }
                } else {
                    // BR40
                    if (currentFittingRight === 'Z') {
                        if (isRC2) addPartWithQty('rc2_top_z_L', 1); else addPartWithQty('top_rollenhalter_L', 1);
                    } else if (currentFittingRight === 'N') {
                        addPartWithQty('top_holder_N_L', 1);
                        if (isRC2) addPartWithQty('rc2_verstaerkung_n_L', 1);
                    } else if (currentFittingRight === 'L') {
                        if (isRC2) addPartWithQty('rc2_top_l_L', 1); else addPartWithQty('top_holder_L_R', 1);
                    }
                }
            }

            if (hasTopR) {
                if (currentSeries === 'BR20') addPartWithQty('br20_top_befestigung_R', 1);
                else if (currentSeries === 'BR30' && year === 'old') addPartWithQty('br30_top_halter_R_alt', 1);
                else if (currentSeries === 'BR30' && year === 'new') {
                    if (currentFittingRight === 'N') {
                        addPartWithQty('top_rollenbock_N_R', 1, true);
                        addPartWithQty('top_holder_N_R', 1, true);
                    } else if (currentFittingRight === 'L') {
                        addPartWithQty('top_rollenbock_N_R', 1, true);
                        addPartWithQty('top_holder_N_L', 1, true);
                    }
                } else {
                    // BR40
                    if (currentFittingRight === 'Z') {
                        if (isRC2) addPartWithQty('rc2_top_z_R', 1); else addPartWithQty('top_rollenhalter_R', 1);
                    } else if (currentFittingRight === 'N') {
                        addPartWithQty('top_holder_N_R', 1);
                        if (isRC2) addPartWithQty('rc2_verstaerkung_n_R', 1);
                    } else if (currentFittingRight === 'L') {
                        if (isRC2) addPartWithQty('rc2_top_l_R', 1); else addPartWithQty('top_holder_L_R', 1);
                    }
                }
            }

            // Sicherungsbolzen bei RC2 Bodensektion
            if (isRC2 && currentSeries === 'BR40' && (hasBottomL || hasBottomR)) {
                if (partsDB['rc2_sich_bolzen_z'] && !graphicListMap['rc2_sich_bolzen_z']) {
                    graphicListMap['rc2_sich_bolzen_z'] = { ...partsDB['rc2_sich_bolzen_z'], id: 'rc2_sich_bolzen_z', qty: 1, selected: true, uniqueId: Math.random() };
                }
            }

            // Scharniere bereinigen bei TVS oder >= 5001
            if (isTVS || isOver5001) {
                if (graphicListMap['scharnier']) delete graphicListMap['scharnier'];
                for (let k in graphicListMap) {
                    if (k !== 'scharnier_6') {
                        let lowerName = (graphicListMap[k].name || '').toLowerCase();
                        if (lowerName.includes('scharnier typ 2') && !lowerName.includes('rc')) delete graphicListMap[k];
                    }
                }
            }

            // Rollenhalter Logik: Heavy Duty vs Standard RC2
            if (isHeavyDuty) {
                let qty = 0;
                if (graphicListMap['rc2_rollenhalter']) {
                    qty = graphicListMap['rc2_rollenhalter'].qty;
                    delete graphicListMap['rc2_rollenhalter'];
                }
                for (let k in graphicListMap) {
                    if (graphicListMap[k].artNr === '3054772') delete graphicListMap[k];
                }
                if (partsDB['rollenhalter_h']) {
                    if (!graphicListMap['rollenhalter_h']) {
                        graphicListMap['rollenhalter_h'] = { ...partsDB['rollenhalter_h'], id: 'rollenhalter_h', qty: qty || (countMiddleL + countMiddleR) || 1, selected: true, uniqueId: Math.random() };
                    } else if (qty > 0) {
                        graphicListMap['rollenhalter_h'].qty = Math.max(graphicListMap['rollenhalter_h'].qty, qty);
                    }
                }
            } else if (isRC2) {
                delete graphicListMap['rollenhalter_h'];
                for (let k in graphicListMap) {
                    if (graphicListMap[k].artNr === '3039948') delete graphicListMap[k];
                }
            }

            // Stütze für Rollenbock bei >170kg mit Schlupftür entfernen
            if (is170kgSchlupf) {
                delete graphicListMap['rc2_stuetze_L'];
                delete graphicListMap['rc2_stuetze_R'];
                for (let k in graphicListMap) {
                    const art = String(graphicListMap[k].artNr || '').trim();
                    const name = (graphicListMap[k].name || '').toLowerCase();
                    if (art === '3041156' || art === '3041155' || name.includes('stütze für rollenbock')) {
                        delete graphicListMap[k];
                    }
                }
            }

            currentViewList = Object.values(graphicListMap);
            renderTable(currentViewList);
        }
        window.updateListFromGraphic = updateListFromGraphic;

        function resetGraphicFilter() {
            resetMarkersVisuals();
            const btnReset = document.getElementById('btnResetFilter');
            if (btnReset) btnReset.style.display = 'none';

            const resCont = document.getElementById('resultContainer');
            if (resCont) resCont.style.display = 'none';
            const btnPdf = document.getElementById('btnPdf');
            if (btnPdf) btnPdf.disabled = true;
            const btnPdfMail = document.getElementById('btnPdfMail');
            if (btnPdfMail) btnPdfMail.disabled = true;
            currentViewList = [];
        }
        window.resetGraphicFilter = resetGraphicFilter;
        function copyArtNr(artNr, btnElement) { navigator.clipboard.writeText(artNr).then(() => { btnElement.innerText = "✅"; btnElement.classList.add('success'); setTimeout(() => { btnElement.innerText = "📋"; btnElement.classList.remove('success'); }, 1500); }); }
        function updatePdfButtonState() {
            const anySelected = currentViewList.some(i => i.selected);
            const btnPdf = document.getElementById('btnPdf');
            const btnPdfMail = document.getElementById('btnPdfMail');
            if (btnPdf) btnPdf.disabled = !anySelected;
            if (btnPdfMail) btnPdfMail.disabled = !anySelected;
        }
        function formatEur(v) { return v.toFixed(2).replace('.', ',') + " €"; }
        function openModal(src, title) { const m = document.getElementById('imageModal'); document.getElementById('modalImg').src = src; document.getElementById('modalTitle').innerText = title; m.style.display = 'flex'; }
        function closeModal() { document.getElementById('imageModal').style.display = 'none'; }
        async function getBase64ImageFromUrl(u) { if (!u) return null; try { const r = await fetch(u); const b = await r.blob(); return new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(b); }); } catch (e) { return null; } }

        function renderTable(items) {
            currentViewList = items || [];

            const resCont = document.getElementById('resultContainer');
            const btnPdf = document.getElementById('btnPdf');
            const btnPdfMail = document.getElementById('btnPdfMail');

            // --- NEU: SICHERHEITSSPERRE FÜR LEERE LISTEN ---
            // Wenn gar keine Bauteile drin sind, blenden wir den Kasten komplett aus
            if (!items || items.length === 0) {
                if (resCont) resCont.style.display = 'none';
                if (btnPdf) btnPdf.disabled = true;
                if (btnPdfMail) btnPdfMail.disabled = true;
                return; // Funktion hier sofort beenden!
            }
            // ------------------------------------------------

            function getItemSectionRank(item) {
                if (!item) return 0;
                if (item.isMeterware || item.id === 'bottom_seal' || item.id === 'br20_bottom_seal') return 0;
                const tags = (item.positionTags || []).map(t => String(t).toLowerCase());
                const name = (item.name || '').toLowerCase();
                const id = (item.id || '').toLowerCase();

                // Top-Sektion ganz oben
                if (tags.includes('top') || name.includes('top') || id.includes('top')) return 300;
                // Mitte-Sektion in der Mitte
                if (tags.includes('mitte') || name.includes('mitte') || id.includes('middle') || id.includes('scharnier') || id.includes('rollenbock')) return 200;
                // Boden-Sektion unten
                if (tags.includes('boden') || name.includes('boden') || name.includes('aufsetz') || id.includes('aufsetz') || id.includes('bottom')) return 100;

                return item.sortIndex !== undefined ? item.sortIndex : 150;
            }
            window.getItemSectionRank = getItemSectionRank;

            items.sort((a, b) => {
                const aMeter = (a.isMeterware || a.id === 'bottom_seal' || a.id === 'br20_bottom_seal') ? 1 : 0;
                const bMeter = (b.isMeterware || b.id === 'bottom_seal' || b.id === 'br20_bottom_seal') ? 1 : 0;
                if (aMeter !== bMeter) return aMeter - bMeter;

                const rankA = getItemSectionRank(a);
                const rankB = getItemSectionRank(b);
                if (rankA !== rankB) return rankB - rankA;

                const sortA = a.sortIndex !== undefined ? a.sortIndex : 100;
                const sortB = b.sortIndex !== undefined ? b.sortIndex : 100;
                if (sortA !== sortB) return sortB - sortA;

                return 0;
            });

            // Ab hier wissen wir: Es GIBT Artikel, also Kasten anzeigen
            if (resCont) resCont.style.display = 'block';
            const tbody = document.getElementById('tableBody');
            if (tbody) tbody.innerHTML = '';

            const fallbackImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

            items.forEach((item, index) => {
                let total = 0;
                let rowClass = item.selected ? "" : "row-disabled";

                if (item.selected) {
                    if (item.isMeterware) {
                        let offset = item.id === 'br20_bottom_seal' ? 0 : 54;
                        total = ((item.qty + offset) / 1000) * item.price;
                    } else {
                        total = item.qty * item.price;
                    }
                }

                const hasImage = item.path && item.path.length > 5;
                const img = hasImage ? item.path : fallbackImg;

                // --- NEU: Mini-Badges für die Pos-Spalte ---
                const renderTablePosBadges = (tags) => {
                    if (!tags || tags.length === 0) return '<span style="color:#ccc;">-</span>';
                    return tags.map(t => `<span style="background:var(--friendly-green); color:white; padding:2px 4px; border-radius:3px; font-size:0.6rem; font-weight:bold; display:block; margin-bottom:3px; text-transform:uppercase; text-align:center; box-shadow:0 1px 2px rgba(0,0,0,0.2);">${t}</span>`).join('');
                };
                const posContent = renderTablePosBadges(item.positionTags);
                const rowId = `row-${index}`;

                let inputField = `<input type="text" value="${item.qty}" readonly>`;
                if (item.isMeterware) {
                    inputField = `<input type="text" value="${item.qty}" readonly>`;
                }

                tbody.innerHTML += `
                <tr id="${rowId}" class="${rowClass}">
                    <td class="text-center"><input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleItemInTable(${index}, this.checked)"></td>
                    <td class="text-center section-id">${posContent}</td>
                    <td class="text-center">
                        <img src="${img}" class="part-img" onclick="openModal('${img}','${item.name}')" onerror="this.src='${fallbackImg}'">
                    </td>
                    <td>
                        <div class="clickable-part-name" onclick="openSearchModal('${item.id}')" title="Details & Zubehör anzeigen">
                            <strong>${item.name}</strong>
                            <span class="info-icon">i</span>
                        </div><br>
                        <small style="color:#666">${item.desc}</small>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:2px;">
                            <span onclick="copyArtNr('${item.artNr}', this.nextElementSibling)" style="cursor:pointer;" title="Klicken zum Kopieren">${item.artNr}</span>
                            <button class="copy-btn" onclick="copyArtNr('${item.artNr}', this)" title="Kopieren">📋</button>
                        </div>
                    </td>
                    <td class="text-center">
                        <div class="qty-wrapper">
                            <button onclick="updateQty(${index}, -1)">-</button>
                            ${inputField}
                            <button onclick="updateQty(${index}, 1)">+</button>
                        </div>
                    </td>
                    <td class="text-right">${formatEur(item.price)}</td>
                    <td class="text-right" id="total-${index}"><strong>${formatEur(total)}</strong></td>
                </tr>`;
            });
            updateSums(); updatePdfButtonState();
        }

        function toggleItemInTable(index, isChecked) { if (currentViewList[index]) { currentViewList[index].selected = isChecked; const row = document.getElementById(`row-${index}`); if (row) { if (isChecked) row.classList.remove('row-disabled'); else row.classList.add('row-disabled'); } updateSums(); updatePdfButtonState(); } }

        function updateQty(index, delta) {
            if (currentViewList[index]) {
                const item = currentViewList[index];
                let step = 1;

                // Schrittweite
                if (item.isMeterware) {
                    step = 125;
                }

                let newVal = item.qty + (delta * step);
                if (newVal < 0) newVal = 0;

                item.qty = newVal;

                const row = document.getElementById(`row-${index}`);
                if (row) {
                    row.querySelector('.qty-wrapper input').value = newVal;

                    // Neuberechnung Preis
                    let newTotal = 0;
                    if (item.isMeterware) {
                        let offset = item.id === 'br20_bottom_seal' ? 0 : 54;
                        newTotal = ((newVal + offset) / 1000) * item.price;
                    } else {
                        newTotal = newVal * item.price;
                    }

                    document.getElementById(`total-${index}`).innerHTML = `<strong>${formatEur(newTotal)}</strong>`;
                }
                updateSums();
            }
        }

        function updateSums() {
            let sum = 0;
            currentViewList.forEach(item => {
                if (item.selected) {
                    if (item.isMeterware) {
                        let offset = item.id === 'br20_bottom_seal' ? 0 : 54;
                        sum += ((item.qty + offset) / 1000) * item.price;
                    } else {
                        sum += item.qty * item.price;
                    }
                }
            });
            document.getElementById('sumNetto').innerText = formatEur(sum);
            document.getElementById('sumTotal').innerText = formatEur(sum + freightCost);
        }
        async function exportPDF(mode = 'download') {
            try {
                if (!currentViewList.length) { alert("Liste leer."); return; }
                document.body.style.cursor = 'wait'; const { jsPDF } = window.jspdf; const doc = new jsPDF();
                const logoImg = await getBase64ImageFromUrl('img/logo.png');
                if (logoImg) { const imgProps = doc.getImageProperties(logoImg); const targetWidth = 45; const targetHeight = (imgProps.height * targetWidth) / imgProps.width; doc.addImage(logoImg, 'PNG', 195 - targetWidth, 10, targetWidth, targetHeight); }
                doc.setFontSize(14); doc.setTextColor(0, 50, 100); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "normal");
                doc.text(`Datum: ${new Date().toLocaleDateString()}`, 14, 45);
                doc.setFont("helvetica", "bold");
                doc.text(`Angebot für Sektionaltor: ${currentSeries}`, 14, 52);
                doc.setFont("helvetica", "normal");
                const introText = "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage, zu der wir gern ein Angebot unter Zugrundelegung unserer allgemeinen Verkaufs- und Lieferbedingungen erstellen.\nDiese finden Sie unter: www.hoermann.com/de/agb\n\nDie im Angebot genannten Preise sind nicht übertragbar, gelten ohne Aufmaß und Montage, wenn nicht anders angegeben, und sind nur bei komplettem Abruf gültig.";
                const textStartY = 60; doc.text(doc.splitTextToSize(introText, 180), 14, textStartY);
                let yPos = textStartY + (doc.splitTextToSize(introText, 180).length * 5) + 5;
                const d1 = parseFloat(document.getElementById('inputDiscount1').value) || 0; const d2 = parseFloat(document.getElementById('inputDiscount2').value) || 0;
                const body = []; let totalNettoSum = 0; let posCounter = 1;
                const exportList = [...currentViewList].sort((a, b) => {
                    const aMeter = (a.isMeterware || a.id === 'bottom_seal' || a.id === 'br20_bottom_seal') ? 1 : 0;
                    const bMeter = (b.isMeterware || b.id === 'bottom_seal' || b.id === 'br20_bottom_seal') ? 1 : 0;
                    if (aMeter !== bMeter) return aMeter - bMeter;
                    const rankA = typeof getItemSectionRank === 'function' ? getItemSectionRank(a) : 150;
                    const rankB = typeof getItemSectionRank === 'function' ? getItemSectionRank(b) : 150;
                    if (rankA !== rankB) return rankB - rankA;
                    const sortA = a.sortIndex !== undefined ? a.sortIndex : 100;
                    const sortB = b.sortIndex !== undefined ? b.sortIndex : 100;
                    return sortB - sortA;
                });
                for (const i of exportList) {
                    if (i.selected) {
                        let listPrice = i.price; let priceAfterD1 = listPrice * (1 - d1 / 100); let finalSingleNet = priceAfterD1 * (1 - d2 / 100); let lineTotalNet = finalSingleNet * i.qty; totalNettoSum += lineTotalNet;
                        let textEinzel = formatEur(listPrice); if (d1 > 0 || d2 > 0) { if (d1 > 0) textEinzel += `\n- ${d1.toFixed(1)} %`; if (d2 > 0) textEinzel += `\n- ${d2.toFixed(1)} %`; textEinzel += `\n= ${formatEur(finalSingleNet)}`; }
                        const img = await getBase64ImageFromUrl(i.path); body.push({ img: img, row: [posCounter, '', i.artNr, `${i.name}\n${i.desc}`, i.qty, textEinzel, formatEur(lineTotalNet)] }); posCounter++;
                    }
                }

                let colStylesA = {
                    0: { halign: 'center', cellWidth: 12 },
                    1: { halign: 'center', cellWidth: 16 },
                    2: { cellWidth: 24 },
                    3: { halign: 'left' },
                    4: { halign: 'center', cellWidth: 16 },
                    5: { halign: 'right', cellWidth: 22 },
                    6: { halign: 'right', cellWidth: 22 }
                };

                doc.autoTable({
                    startY: yPos,
                    head: [['Pos.', 'Bild', 'Art.-Nr.', 'Artikel-Bezeichnung', 'Menge', 'Einzelpreis', 'Gesamtpreis']],
                    body: body.map(x => x.row),
                    theme: 'plain',
                    styles: { fontSize: 9, valign: 'middle', cellPadding: 2 },
                    columnStyles: colStylesA,
                    headStyles: { fillColor: [245, 247, 250], textColor: [50, 50, 50], fontStyle: 'bold' },
                    bodyStyles: { fillColor: [255, 255, 255] },
                    didParseCell: function (data) {
                        // ERZWINGT DIE RECHTSBÜNDIGKEIT AUCH FÜR DIE ÜBERSCHRIFTEN!
                        if (data.section === 'head' && colStylesA[data.column.index] && colStylesA[data.column.index].halign) {
                            data.cell.styles.halign = colStylesA[data.column.index].halign;
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.section === 'head') {
                            doc.setDrawColor(220, 220, 220);
                            doc.setLineWidth(0.5);
                            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                        }

                        const rowData = body[data.row.index];
                        if (!rowData) return;

                        if (data.column.index === 1 && data.cell.section === 'body') {
                            const im = rowData.img;
                            if (im) {
                                try {
                                    const imgProps = doc.getImageProperties(im);
                                    const maxW = 14;
                                    const maxH = 10;
                                    const ratio = imgProps.width / imgProps.height;
                                    let finalW = maxW;
                                    let finalH = maxW / ratio;

                                    if (finalH > maxH) {
                                        finalH = maxH;
                                        finalW = maxH * ratio;
                                    }

                                    const xPos = data.cell.x + (data.cell.width / 2) - (finalW / 2);
                                    const yPos = data.cell.y + (data.cell.height / 2) - (finalH / 2);
                                    doc.addImage(im, 'PNG', xPos, yPos, finalW, finalH);
                                } catch (e) { }
                            }
                        }
                    },
                    showFoot: 'lastPage',
                    foot: [['', '', '', '', '', 'Summe Positionen:', formatEur(totalNettoSum)], ['', '', '', '', '', 'Fracht & Verpackung:', formatEur(freightCost)], ['', '', '', '', '', 'Gesamtwert-Netto:', formatEur(totalNettoSum + freightCost)]],
                    footStyles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [255, 255, 255] }
                });

                const pageCount = doc.internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(9); doc.setTextColor(100); doc.text(`Seite ${i} von ${pageCount}`, (doc.internal.pageSize.getWidth() / 2), doc.internal.pageSize.getHeight() - 10, { align: 'center' }); }
                let finalY = doc.lastAutoTable.finalY + 15; if (finalY > 230) { doc.addPage(); finalY = 20; }
                doc.setFontSize(10); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "normal");
                doc.text("Zahlungskondition: Gemäß vertraglicher Vereinbarung\nVersandbedingung: Gemäß vertraglicher Vereinbarung - Standard", 14, finalY); finalY += 15;
                const outroText = "Für dieses Angebot gilt eine Zuschlagsfrist innerhalb des oben genannten Zeitraums. Preise und Lieferzeiten werden bei Bestellung nach technischer Klarstellung durch unsere Auftragsbestätigung verbindlich.\nSollten sich beim Aufmaß konstruktive Änderungen ergeben, können Mehr- oder Minderpreise entstehen.\n\nHörmann KG Verkaufsgesellschaft";
                doc.text(doc.splitTextToSize(outroText, 180), 14, finalY);

                let fileName = "Angebot.pdf";
                if (mode === 'email') {
                    await window.triggerPdfShare(doc.output('blob'), fileName);
                } else {
                    doc.save(fileName);
                }
            } catch (error) { console.error(error); alert("Fehler PDF: " + error.message); } finally { document.body.style.cursor = 'default'; }
        }

        // 1. Grafik speichern oder kopieren (Mit Prüfung)
        async function captureGraphic(mode) {
            // --- NEU: TÜRSTEHER ---
            // Prüfen, ob überhaupt Punkte in der Grafik aktiv (grün) sind
            const activeMarkers = document.querySelectorAll('.part-marker.active');

            if (activeMarkers.length === 0) {
                alert("Diese Funktion ist nur für die visuelle Auswahl (Option B) gedacht.\n\nBitte klicken Sie Teile in der Grafik an, um sie zu speichern.");
                return; // Abbruch
            }
            // ----------------------

            const visualElement = document.getElementById('visualWrapper');
            document.body.style.cursor = 'wait';

            try {
                const canvas = await html2canvas(visualElement, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false
                });

                if (mode === 'download') {
                    const link = document.createElement('a');
                    link.download = `Tor-Grafik_${new Date().toLocaleDateString()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }
                else if (mode === 'clipboard') {
                    canvas.toBlob(blob => {
                        try {
                            const item = new ClipboardItem({ 'image/png': blob });
                            navigator.clipboard.write([item]);
                            alert("Grafik wurde in die Zwischenablage kopiert!");
                        } catch (err) {
                            alert("Kopieren nicht unterstützt.");
                        }
                    });
                }
            } catch (err) {
                console.error(err);
                alert("Fehler bei Grafik-Erstellung.");
            } finally {
                document.body.style.cursor = 'default';
            }
        }

        // --- PDF EINSTELLUNGEN MODAL SYSTEM (Session vs Standard) ---
        window.currentPdfSessionSettings = null;

        window.getPdfSettings = function (context = 'visual') {
            if (window.currentPdfSessionSettings) {
                return Object.assign({}, window.currentPdfSessionSettings);
            }
            try {
                const saved = localStorage.getItem(`pdfSettings_${context}`);
                if (saved) return JSON.parse(saved);
            } catch (e) { }
            return {
                project: '',
                graphic: true,
                img: true,
                artnr: true,
                ep: true,
                gp: true,
                freight: true,
                discount: false,
                discount1: 25,
                discount2: 0,
                markup: false,
                markupVal: 15,
                vat: false,
                notes: ''
            };
        };

        window.openPdfSettingsModal = function (context = 'visual') {
            const modal = document.getElementById('pdfSettingsModal');
            if (!modal) return;

            window.activePdfSettingsContext = context;
            const settings = window.getPdfSettings(context);

            const projectEl = document.getElementById('pdfProjectName');
            if (projectEl) projectEl.value = settings.project || '';

            const graphicEl = document.getElementById('pdfSetGraphic');
            if (graphicEl) graphicEl.checked = settings.graphic !== false;

            const imgEl = document.getElementById('pdfSetImg');
            if (imgEl) imgEl.checked = settings.img !== false;

            const artnrEl = document.getElementById('pdfSetArtNr');
            if (artnrEl) artnrEl.checked = settings.artnr !== false;

            const epEl = document.getElementById('pdfSetEP');
            if (epEl) epEl.checked = settings.ep !== false;

            const gpEl = document.getElementById('pdfSetGP');
            if (gpEl) gpEl.checked = settings.gp !== false;

            const freightEl = document.getElementById('pdfSetFreight');
            if (freightEl) freightEl.checked = settings.freight !== false;

            const discountEl = document.getElementById('pdfSetDiscount');
            const discountValWrap = document.getElementById('pdfDiscountValWrap');
            const d1El = document.getElementById('pdfDiscount1Val');
            const d2El = document.getElementById('pdfDiscount2Val');
            if (discountEl) {
                discountEl.checked = !!settings.discount;
                if (discountValWrap) discountValWrap.style.display = settings.discount ? 'flex' : 'none';
            }
            if (d1El) d1El.value = settings.discount1 !== undefined ? settings.discount1 : 25;
            if (d2El) d2El.value = settings.discount2 !== undefined ? settings.discount2 : 0;

            const markupEl = document.getElementById('pdfSetMarkup');
            const markupValWrap = document.getElementById('pdfMarkupValWrap');
            const markupValEl = document.getElementById('pdfMarkupVal');
            if (markupEl) {
                markupEl.checked = !!settings.markup;
                if (markupValWrap) markupValWrap.style.display = settings.markup ? 'flex' : 'none';
            }
            if (markupValEl) markupValEl.value = settings.markupVal !== undefined ? settings.markupVal : 15;

            const vatEl = document.getElementById('pdfSetVat');
            if (vatEl) vatEl.checked = !!settings.vat;

            const notesEl = document.getElementById('pdfAdditionalText');
            if (notesEl) notesEl.value = settings.notes || '';

            modal.style.display = 'flex';
        };

        window.closePdfSettingsModal = function () {
            const modal = document.getElementById('pdfSettingsModal');
            if (modal) modal.style.display = 'none';
        };

        window.readSettingsFromModal = function () {
            return {
                project: document.getElementById('pdfProjectName')?.value || '',
                graphic: document.getElementById('pdfSetGraphic')?.checked ?? true,
                img: document.getElementById('pdfSetImg')?.checked ?? true,
                artnr: document.getElementById('pdfSetArtNr')?.checked ?? true,
                ep: document.getElementById('pdfSetEP')?.checked ?? true,
                gp: document.getElementById('pdfSetGP')?.checked ?? true,
                freight: document.getElementById('pdfSetFreight')?.checked ?? true,
                discount: document.getElementById('pdfSetDiscount')?.checked ?? false,
                discount1: parseFloat(document.getElementById('pdfDiscount1Val')?.value) || 0,
                discount2: parseFloat(document.getElementById('pdfDiscount2Val')?.value) || 0,
                markup: document.getElementById('pdfSetMarkup')?.checked ?? false,
                markupVal: parseFloat(document.getElementById('pdfMarkupVal')?.value) || 0,
                vat: document.getElementById('pdfSetVat')?.checked ?? false,
                notes: document.getElementById('pdfAdditionalText')?.value || ''
            };
        };

        window.applyPdfSettingsSessionOnly = function () {
            window.currentPdfSessionSettings = window.readSettingsFromModal();
            window.closePdfSettingsModal();
        };

        window.savePdfSettingsPermanent = function (context) {
            context = context || window.activePdfSettingsContext || 'visual';
            const settings = window.readSettingsFromModal();
            window.currentPdfSessionSettings = settings;
            try {
                localStorage.setItem(`pdfSettings_${context}`, JSON.stringify(settings));
            } catch (e) { }
            window.closePdfSettingsModal();
        };

        // Legacy Stubs falls aufgerufen
        window.togglePdfSettings = (event, areaId, btnId) => window.openPdfSettingsModal(areaId?.includes('lamellen') ? 'lamellen' : 'visual');
        window.closePdfSettings = () => window.closePdfSettingsModal();
        window.forceClosePdfSettings = () => window.closePdfSettingsModal();

        // --- 1. DIE PDF VORSCHAU ---
        window.openPdfPreview = async function () {
            const activeMarkers = document.querySelectorAll('.part-marker.active');
            if (activeMarkers.length === 0) {
                alert("Bitte wählen Sie zuerst Bauteile in der Grafik aus.");
                return;
            }

            const settings = window.getPdfSettings('visual');
            const docHtml = document.getElementById('pdfDocument');

            let html = '';

            // Header
            html += `<div style="display:flex; justify-content: space-between; border-bottom: 2px solid var(--hormann-blue); padding-bottom: 10px; margin-bottom: 20px;">
                <div>
                    <h2 style="margin: 0; color: var(--hormann-blue); font-size: 18px;">Ersatzteile Sektionaltor</h2>
                    <div style="font-size: 12px; color: #666;">Visuelle Auswahl - Datum: ${new Date().toLocaleDateString()}</div>
                </div>
            </div>`;

            if (settings.project && settings.project.trim() !== "") {
                html += `<div style="margin-bottom: 15px; font-size: 14px;"><strong>Bauvorhaben:</strong> ${settings.project}</div>`;
            }

            if (settings.graphic) {
                html += `<div style="text-align: center; margin-bottom: 20px; border: 1px solid #ddd; padding: 20px; background: #f9f9f9; border-radius: 4px;">
                    <em style="color:#888; font-size: 0.9rem;">[ 🖼️ Die Skizze wird hier im finalen PDF hochauflösend eingefügt ]</em>
                </div>`;
            }

            // Tabellen-Kopf
            html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f0f2f5; border-bottom: 2px solid #ccc;">
                        <th style="padding: 8px; text-align: left;">Pos</th>
                        ${settings.img ? `<th style="padding: 8px; text-align: left;">Bild</th>` : ''}
                        ${settings.artnr ? `<th style="padding: 8px; text-align: left;">Art.-Nr.</th>` : ''}
                        <th style="padding: 8px; text-align: left;">Beschreibung</th>
                        <th style="padding: 8px; text-align: center;">Menge</th>
                        ${settings.ep ? `<th style="padding: 8px; text-align: right;">Einzel</th>` : ''}
                        ${settings.gp ? `<th style="padding: 8px; text-align: right;">Gesamt</th>` : ''}
                    </tr>
                </thead>
                <tbody>`;

            const activeItems = [...currentViewList].filter(i => i.selected);
            let sum = 0; let pos = 1;
            const markupFactor = (settings.markup && settings.markupVal > 0) ? (1 + (parseFloat(settings.markupVal) || 0) / 100) : 1;

            activeItems.forEach(item => {
                let basePrice = item.price;
                if (settings.discount) {
                    const d1 = Math.max(0, Math.min(100, parseFloat(settings.discount1) || 0));
                    const d2 = Math.max(0, Math.min(100, parseFloat(settings.discount2) || 0));
                    basePrice = basePrice * (1 - (d1 / 100)) * (1 - (d2 / 100));
                }
                let unitPrice = basePrice * markupFactor;
                let total = 0; let qtyDisplay = item.qty;
                if (item.isMeterware) {
                    let offset = item.id === 'br20_bottom_seal' ? 0 : 54;
                    total = ((item.qty + offset) / 1000) * basePrice * markupFactor;
                    qtyDisplay = item.qty + " mm";
                } else {
                    total = item.qty * unitPrice;
                }
                sum += total;

                let imgHtml = '';
                if (settings.img) {
                    const imgPath = item.path && item.path.length > 5 ? item.path : 'img/placeholder.png';
                    imgHtml = `<td style="padding: 8px; border-bottom: 1px solid #eee;"><img src="${imgPath}" style="height:25px;" onerror="this.style.display='none'"></td>`;
                }

                html += `<tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${pos++}</td>
                    ${imgHtml}
                    ${settings.artnr ? `<td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${item.artNr || ''}</td>` : ''}
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${item.name}</strong><br><span style="color:#666; font-size:10px;">${item.desc || ''}</span></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${qtyDisplay}</td>
                    ${settings.ep ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatEur(unitPrice)}</td>` : ''}
                    ${settings.gp ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatEur(total)}</td>` : ''}
                </tr>`;
            });

            html += `</tbody></table>`;

            if (settings.gp) {
                let netTotal = sum + (settings.freight ? freightCost : 0);
                html += `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 20px; font-size: 13px;">
                    <div>Summe Positionen netto: <strong>${formatEur(sum)}</strong></div>`;
                if (settings.freight) {
                    html += `<div>Fracht, Verpackung & Bearbeitung: <strong>${formatEur(freightCost)}</strong></div>`;
                }
                html += `<div style="font-weight: bold; margin-top: 4px; border-top: 1px solid #ccc; padding-top: 4px;">Gesamtbetrag netto: <span style="color: var(--hormann-blue); font-size: 15px;">${formatEur(netTotal)}</span></div>`;
                if (settings.vat) {
                    const vatAmount = netTotal * 0.19;
                    const grossTotal = netTotal + vatAmount;
                    html += `<div>+ 19 % MwSt.: <strong>${formatEur(vatAmount)}</strong></div>
                    <div style="font-weight: bold; font-size: 16px; color: #16a34a; border-top: 2px solid #16a34a; padding-top: 4px; margin-top: 4px;">Gesamtbetrag brutto: ${formatEur(grossTotal)}</div>`;
                }
                html += `</div>`;
            }

            if (settings.notes && settings.notes.trim() !== "") {
                html += `<div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; font-size: 12px; white-space: pre-wrap;">
                    <strong>Bemerkungen:</strong><br>${settings.notes}
                </div>`;
            }

            docHtml.innerHTML = html;
            document.getElementById('pdfPreviewModal').style.display = 'flex';
        };

        window.closePdfPreview = function () {
            document.getElementById('pdfPreviewModal').style.display = 'none';
        };

        window.triggerPdfShare = async function (pdfBlob, fileName) {
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: fileName.replace('.pdf', ''),
                        text: 'Anbei das konfigurierte Ersatzteil-Angebot als PDF.'
                    });
                } catch (err) {
                    console.log("Teilen abgebrochen", err);
                }
            } else {
                alert("Ihr System unterstützt das direkte Anhängen an E-Mails aus dem Browser heraus nicht. Die Datei wird stattdessen heruntergeladen.");
                const link = document.createElement('a');
                link.href = URL.createObjectURL(pdfBlob);
                link.download = fileName;
                link.click();
            }
        };

        window.exportVisualPDF = async function (fromPreview = false, mode = 'download') {
            const activeMarkers = document.querySelectorAll('.part-marker.active');
            if (activeMarkers.length === 0) {
                alert("Bitte wählen Sie zuerst Bauteile in der Grafik aus."); return;
            }

            if (fromPreview) closePdfPreview();
            document.body.style.cursor = 'wait';

            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const settings = window.getPdfSettings('visual');

                let titleText = `Ersatzteile Sektionaltor - Baureihe ${currentSeries.replace('BR', '')}`;
                if (currentSeries === 'BR30') {
                    const ySel = document.getElementById('selectBR30Year');
                    if (ySel && ySel.value) {
                        const yearText = ySel.options[ySel.selectedIndex].text;
                        titleText += ` (${yearText})`;
                    }
                }

                doc.setFontSize(14); doc.setTextColor(0, 85, 150); doc.setFont("helvetica", "bold");
                doc.text(titleText, 14, 20);

                doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal");
                doc.text(`Datum: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.getWidth() - 14, 20, { align: "right" });

                let currentY = 32;

                if (settings.project && settings.project.trim() !== "") {
                    doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "bold");
                    doc.text(`Bauvorhaben: ${settings.project}`, 14, currentY);
                    doc.setFont("helvetica", "normal");
                    currentY += 10;
                }

                if (settings.graphic) {
                    const visualElement = document.getElementById('visualWrapper');
                    const canvas = await html2canvas(visualElement, {
                        scale: 2,
                        backgroundColor: '#ffffff',
                        logging: false
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);

                    const maxPdfWidth = 120;
                    const pdfHeight = (imgProps.height * maxPdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'PNG', 14, currentY, maxPdfWidth, pdfHeight);

                    let rightColX = 144;
                    let rightColY = currentY + 5;

                    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 85, 150);
                    doc.text("Ausgewählter Beschlag:", rightColX, rightColY);
                    rightColY += 6;
                    try {
                        const fitImgStr = currentFittingRight ? currentFittingRight.toLowerCase() : 'z';
                        const fitImg = await getBase64ImageFromUrl('img/beschlag_' + fitImgStr + '.png');
                        if (fitImg) {
                            doc.addImage(fitImg, 'PNG', rightColX, rightColY, 25, 18);
                            rightColY += 24;
                        }
                    } catch (e) { }

                    let optionsSelected = [];
                    if (document.getElementById('checkRC2_B') && document.getElementById('checkRC2_B').checked) optionsSelected.push("RC 2 (Einbruchschutz)");
                    if (document.getElementById('checkTVS_B') && document.getElementById('checkTVS_B').checked) optionsSelected.push("Torblattverstärkung (TVS)");
                    if (document.getElementById('check170kg_B') && document.getElementById('check170kg_B').checked) optionsSelected.push("> 170 kg Torblattgewicht");
                    if (document.getElementById('check170kgSchlupf_B') && document.getElementById('check170kgSchlupf_B').checked) optionsSelected.push("> 170 kg mit Schlupftür");
                    if (document.getElementById('check5001mm_B') && document.getElementById('check5001mm_B').checked) optionsSelected.push("≥ 5001 mm Torbreite");

                    if (optionsSelected.length > 0) {
                        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 85, 150);
                        doc.text("Eigenschaften:", rightColX, rightColY);
                        rightColY += 6;
                        doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
                        optionsSelected.forEach(opt => {
                            doc.text("• " + opt, rightColX, rightColY);
                            rightColY += 5;
                        });
                        rightColY += 2;
                    }

                    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 85, 150);
                    doc.text("Legende Skizze:", rightColX, rightColY);
                    rightColY += 6;

                    doc.setFillColor(39, 174, 96);
                    doc.circle(rightColX + 2, rightColY - 1.5, 2, 'F');
                    doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); doc.setFontSize(9);
                    doc.text("Ausgewähltes Bauteil", rightColX + 6, rightColY);
                    rightColY += 6;

                    doc.setFillColor(231, 76, 60);
                    doc.circle(rightColX + 2, rightColY - 1.5, 2, 'F');
                    doc.text("Mögliches Bauteil", rightColX + 6, rightColY);

                    currentY += Math.max(pdfHeight, (rightColY - currentY)) + 12;
                }

                const activeItems = [...currentViewList].filter(i => i.selected);
                let pos = 1; let sum = 0;
                const markupFactor = (settings.markup && settings.markupVal > 0) ? (1 + (parseFloat(settings.markupVal) || 0) / 100) : 1;
                const body = [];

                let headRow = [];
                let dynamicColumnStyles = {};
                let colIdx = 0;

                headRow.push('Pos.');
                dynamicColumnStyles[colIdx++] = { halign: 'center', cellWidth: 12 };

                if (settings.img) {
                    headRow.push('Bild');
                    dynamicColumnStyles[colIdx++] = { halign: 'center', cellWidth: 16 };
                }
                if (settings.artnr) {
                    headRow.push('Art.-Nr.');
                    dynamicColumnStyles[colIdx++] = { cellWidth: 24 };
                }

                headRow.push('Beschreibung');
                dynamicColumnStyles[colIdx++] = { halign: 'left' };

                headRow.push('Menge');
                dynamicColumnStyles[colIdx++] = { halign: 'center', cellWidth: 16 };

                if (settings.ep) {
                    headRow.push('Einzel');
                    dynamicColumnStyles[colIdx++] = { halign: 'right', cellWidth: 22 };
                }
                if (settings.gp) {
                    headRow.push('Gesamt');
                    dynamicColumnStyles[colIdx++] = { halign: 'right', cellWidth: 22 };
                }

                for (const item of activeItems) {
                    let basePrice = item.price;
                    if (settings.discount) {
                        const d1 = Math.max(0, Math.min(100, parseFloat(settings.discount1) || 0));
                        const d2 = Math.max(0, Math.min(100, parseFloat(settings.discount2) || 0));
                        basePrice = basePrice * (1 - (d1 / 100)) * (1 - (d2 / 100));
                    }
                    let unitPrice = basePrice * markupFactor;
                    let total = 0; let qtyDisplay = item.qty;
                    if (item.isMeterware) {
                        let offset = item.id === 'br20_bottom_seal' ? 0 : 54;
                        total = ((item.qty + offset) / 1000) * basePrice * markupFactor;
                        qtyDisplay = item.qty + " mm";
                    } else {
                        total = item.qty * unitPrice;
                    }
                    sum += total;

                    let row = [pos++];
                    if (settings.img) {
                        const imgB64 = await getBase64ImageFromUrl(item.path);
                        row.push(imgB64 ? { content: "", image: imgB64 } : "");
                    }
                    if (settings.artnr) row.push(item.artNr || '');
                    row.push(`${item.name}\n${item.desc || ''}`);
                    row.push(qtyDisplay);
                    if (settings.ep) row.push(formatEur(unitPrice));
                    if (settings.gp) row.push(formatEur(total));

                    body.push(row);
                }

                doc.autoTable({
                    startY: currentY,
                    head: [headRow],
                    body: body.map(row => row.map(cell => (typeof cell === 'object' && cell !== null && cell.image) ? cell.content : cell)),
                    theme: 'plain',
                    styles: { fontSize: 9, valign: 'middle', cellPadding: 2 },
                    columnStyles: dynamicColumnStyles,
                    headStyles: { fillColor: [245, 247, 250], textColor: [50, 50, 50], fontStyle: 'bold' },
                    bodyStyles: { fillColor: [255, 255, 255] },
                    didParseCell: function (data) {
                        if (data.section === 'head' && dynamicColumnStyles[data.column.index] && dynamicColumnStyles[data.column.index].halign) {
                            data.cell.styles.halign = dynamicColumnStyles[data.column.index].halign;
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.section === 'head') {
                            doc.setDrawColor(220, 220, 220);
                            doc.setLineWidth(0.5);
                            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                        }

                        if (settings.img && data.column.index === 1 && data.cell.section === 'body') {
                            const rowData = body[data.row.index];
                            if (rowData[1] && rowData[1].image) {
                                try {
                                    const imgProps = doc.getImageProperties(rowData[1].image);
                                    const maxW = 14;
                                    const maxH = 10;
                                    const ratio = imgProps.width / imgProps.height;
                                    let finalW = maxW;
                                    let finalH = maxW / ratio;

                                    if (finalH > maxH) {
                                        finalH = maxH;
                                        finalW = maxH * ratio;
                                    }
                                    const xPos = data.cell.x + (data.cell.width / 2) - (finalW / 2);
                                    const yPos = data.cell.y + (data.cell.height / 2) - (finalH / 2);
                                    doc.addImage(rowData[1].image, 'PNG', xPos, yPos, finalW, finalH);
                                } catch (e) { }
                            }
                        }
                    }
                });

                currentY = doc.lastAutoTable.finalY + 15;

                if (settings.gp) {
                    const rightMargin = doc.internal.pageSize.getWidth() - 14;
                    const textX = rightMargin - 30;

                    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
                    doc.text("Summe Positionen netto:", textX, currentY, { align: "right" });
                    doc.text(formatEur(sum), rightMargin, currentY, { align: "right" });
                    currentY += 6;

                    if (settings.freight) {
                        doc.text("Fracht, Verpackung & Bearbeitung:", textX, currentY, { align: "right" });
                        doc.text(formatEur(freightCost), rightMargin, currentY, { align: "right" });
                        sum += freightCost;
                        currentY += 6;
                    }

                    doc.setDrawColor(220, 220, 220);
                    doc.line(rightMargin - 80, currentY - 3, rightMargin, currentY - 3);
                    currentY += 4;

                    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 85, 150);
                    doc.text("Gesamtbetrag netto:", textX, currentY, { align: "right" });
                    doc.text(formatEur(sum), rightMargin, currentY, { align: "right" });
                    currentY += 6;

                    if (settings.vat) {
                        const vatAmount = sum * 0.19;
                        const grossTotal = sum + vatAmount;
                        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
                        doc.text("+ 19 % MwSt.:", textX, currentY, { align: "right" });
                        doc.text(formatEur(vatAmount), rightMargin, currentY, { align: "right" });
                        currentY += 4;

                        doc.setDrawColor(220, 220, 220);
                        doc.line(rightMargin - 80, currentY - 2, rightMargin, currentY - 2);
                        currentY += 4;

                        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(22, 163, 74);
                        doc.text("Gesamtbetrag brutto:", textX, currentY, { align: "right" });
                        doc.text(formatEur(grossTotal), rightMargin, currentY, { align: "right" });
                        currentY += 6;
                    }

                    currentY += 10;
                }

                if (settings.notes && settings.notes.trim() !== "") {
                    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(50, 50, 50);
                    doc.text("Bemerkungen:", 14, currentY);
                    currentY += 6;
                    doc.setFont("helvetica", "normal");
                    const splitNotes = doc.splitTextToSize(settings.notes, doc.internal.pageSize.getWidth() - 28);
                    doc.text(splitNotes, 14, currentY);
                }

                let fileName = settings.project ? `Ersatzteile_${settings.project.replace(/[^a-z0-9]/gi, '_')}.pdf` : `Ersatzteile_Skizze.pdf`;
                if (mode === 'email') {
                    await window.triggerPdfShare(doc.output('blob'), fileName);
                } else {
                    doc.save(fileName);
                }
            } catch (e) {
                console.error(e);
                alert("PDF Fehler: " + e.message);
            } finally {
                document.body.style.cursor = 'default';
            }
        };

        // --- SIDEBAR TOGGLE LOGIK ---
        window.toggleSidebar = () => {
            const container = document.getElementById('mainAppContainer');
            const btn = document.querySelector('#optionACard .toggle-sidebar-btn');

            // Klasse umschalten (auf/zu)
            container.classList.toggle('sidebar-collapsed');

            // Prüfen: Ist es jetzt zu?
            const isCollapsed = container.classList.contains('sidebar-collapsed');

            // Button Icon und Titel anpassen
            if (btn) {
                btn.innerText = isCollapsed ? "▶" : "◀";
                btn.title = isCollapsed ? "Option A einblenden" : "Option A ausblenden";
            }

            // Zustand im Browser speichern (bleibt nach Neuladen erhalten)
            localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
        };

        // --- WINDOW ONLOAD (Start-Logik) ---
        window.onload = function () {
            // 1. Deine Standard-Berechnungen
            if (window.autoCalc) window.autoCalc();
            if (document.getElementById('inputWidth')) validateInput(document.getElementById('inputWidth'));
            if (document.getElementById('inputHeight')) validateInput(document.getElementById('inputHeight'));
            if (window.checkZConstraints) window.checkZConstraints();

            // 2. Sidebar Zustand wiederherstellen
            const savedState = localStorage.getItem('sidebarState');
            if (savedState === 'collapsed') {
                const container = document.getElementById('mainAppContainer');
                const btn = document.querySelector('#optionACard .toggle-sidebar-btn');

                if (container) container.classList.add('sidebar-collapsed');
                if (btn) btn.innerText = "▶";
            }

            if (window.markDirty) window.markDirty();
        };

        // --- HILFSFUNKTION: E-Mail Versand (EmailJS) ---
        async function sendEmailSmart(type, data) {

            const serviceId = "service_1sikmt9";
            const publicKey = "oA1tt5qrwi5RM_-v_";
            const universalTemplateId = "template_freigabe";

            let params = {
                to_name: "",
                user_email: "",
                email_subject: "",
                email_body: "",
                email_footer: "Automatische Nachricht vom Tor-Konfigurator System."
            };

            // --- FALL 1: REGISTRIERUNG (Info an Admin) ---
            if (type === 'register') {
                params.to_name = "Admin";
                params.user_email = "saphoder@gmail.com";
                params.email_subject = "🔔 Neue Registrierung: " + data.firstName + " " + data.lastName;

                params.email_body = `
                Ein neuer Nutzer hat Zugang angefordert:<br><br>
                <div style="border-left: 4px solid #e67e22; padding-left: 10px; color:#555;">
                    <strong>Name:</strong> ${data.firstName} ${data.lastName}<br>
                    <strong>E-Mail:</strong> ${data.email}
                </div>
                <br>
                Bitte gehe ins Admin-Panel, um den Nutzer freizuschalten.
                <br><br>
                <a href="https://dephosa.github.io/ersatzteil-konfigurator/" style="color:#005596;">Zum Admin-Login</a>`;
            }

            // --- FALL 2: FREIGABE (An User) ---
            else if (type === 'approve') {
                params.to_name = data.firstName;
                params.user_email = data.user_email;
                params.email_subject = "✅ Dein Account ist aktiv!";

                // Schickes HTML-Design
                params.email_body = `
                Gute Nachrichten!<br><br>
                
                Dein Account wurde soeben geprüft und freigeschaltet.<br>
                Du hast ab sofort Zugriff mit der Rolle: <strong style="color:#005596;">${data.role_name}</strong>
                <br><br>
                Klicke auf den Button, um direkt zu starten:
                <br><br>
                <a href="https://dephosa.github.io/ersatzteil-konfigurator/" 
                   style="background-color:#005596; color:#ffffff; padding:10px 15px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;">
                   Zum Ersatzteil-Konfigurator
                </a>
                <br><br>
                Viel Erfolg bei der Nutzung!<br>
                Viele Grüße,<br>Sascha`;
            }

            // --- FALL 3: NEUES TICKET (An Admin) ---
            else if (type === 'report') {
                params.to_name = "Admin";
                params.user_email = "saphoder@gmail.com";
                params.email_subject = (data.type === 'Bug' ? '🐞 Fehler' : '✨ Vorschlag') + ": " + data.subject;

                let fileInfo = data.has_file ? "<br>📎 Ein Dateianhang liegt vor (siehe Admin-Panel)." : "";

                params.email_body = `Neues Support-Ticket von: ${data.user_email}<br><br><strong>Nachricht:</strong><br>"${data.message}"${fileInfo}<br><br>Bitte im Ticket-Manager prüfen.`;
            }

            // --- FALL 4: ANTWORT AUF TICKET (An User) ---
            else if (type === 'reply') {
                // Hier nehmen wir den Namen, der übergeben wurde
                params.to_name = data.to_name || "Kunde";
                params.user_email = data.user_email;
                params.email_subject = "Re: " + data.ticket_subject;

                // Antworttext: Umbrüche erhalten (Browser macht \n, HTML braucht <br>)
                const formattedReply = data.reply_message.replace(/\n/g, "<br>");

                // DER LINK (HTML) - Sauber formatiert
                params.email_body = `
                Auf dein Ticket gibt es eine Antwort:<br><br>
                
                <div style="background-color:#f4f6f9; padding:15px; border-left:4px solid #005596; margin-bottom:20px; font-family:sans-serif; color:#333;">
                    ${formattedReply}
                </div>
                
                <a href="https://dephosa.github.io/ersatzteil-konfigurator/" 
                   style="background-color:#005596; color:#ffffff; padding:10px 15px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;">
                   Hier geht es zum Ersatzteil-Konfigurator
                </a>
                <br><br>
                Viele Grüße,<br>Sascha`;
            }

            // --- FALL 5: NEWSLETTER (An User) ---
            // --- FALL 5: NEWSLETTER (An User) ---
            else if (type === 'newsletter') {
                params.to_name = data.to_name || "Nutzer";
                params.user_email = data.user_email;
                params.email_subject = data.email_subject;

                let formattedMessage = data.reply_message.replace(/\n/g, "<br>");
                // Smart-Newline-Korrektur: Entferne unerwünschte <br>s direkt neben Block-HTML-Tags (z.B. <h3>, <p>, <hr>, <ul>, <li>, <img>)
                formattedMessage = formattedMessage.replace(/(?:<br>\s*)*(<\/?(?:h[1-6]|p|hr|ul|ol|li|div|blockquote|section|article|header|footer|img)[^>]*>)(?:\s*<br>)*/gi, "$1");
                let attachmentHtml = "";

                if (data.attachment_url) {
                    attachmentHtml = `
                    <br><br>
                    <a href="${data.attachment_url}" 
                       style="background-color:#e74c3c; color:#ffffff; padding:10px 15px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;">
                       📄 PDF Anhang herunterladen
                    </a>`;
                }

                params.email_body = `
                es gibt Neuigkeiten zum Ersatzteil-Konfigurator:<br><br>
                
                <div style="background-color:#f4f6f9; padding:15px; border-left:4px solid #005596; margin-bottom:20px; font-family:sans-serif; color:#333;">
                    ${formattedMessage}
                </div>
                
                <a href="https://dephosa.github.io/ersatzteil-konfigurator/" 
                   style="background-color:#005596; color:#ffffff; padding:10px 15px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;">
                   Konfigurator öffnen
                </a>
                ${attachmentHtml}
                <br><br>
                <small style="color:#999;">Sie erhalten diese Nachricht, weil Sie im System registriert sind. Sie können diese Benachrichtigungen jederzeit in Ihrem Profil deaktivieren.</small>
                <br><br>
                Viele Grüße,<br>Sascha`;
            }

            try {
                emailjs.init(publicKey);
                await emailjs.send(serviceId, universalTemplateId, params);
                console.log(`E-Mail (${type}) erfolgreich gesendet.`);
                return true;
            } catch (error) {
                console.error("Mail-Fehler:", error);
                return false;
            }

        }

        window.activeSeilFitting = 'Z';

        window.switchSubTab = function (mode) {
            const btnBeschlag = document.getElementById('btnSubBeschlag');
            const btnAllgZubehoer = document.getElementById('btnSubAllgZubehoer');
            const btnLamellen = document.getElementById('btnSubLamellen');
            const btnAufmass = document.getElementById('btnSubAufmass');

            const contBeschlag = document.getElementById('mainAppContainer');
            const contAllgZubehoer = document.getElementById('allgZubehoerAppContainer');
            const contLamellen = document.getElementById('lamellenAppContainer');
            const contAufmass = document.getElementById('aufmassAppContainer');
            const resCont = document.getElementById('resultContainer');

            // Button-Status resetten
            [btnBeschlag, btnAllgZubehoer, btnLamellen, btnAufmass].forEach(b => {
                if (b) b.classList.remove('active');
            });

            // Container verstecken
            if (contBeschlag) contBeschlag.style.display = 'none';
            if (contAllgZubehoer) contAllgZubehoer.style.display = 'none';
            if (contLamellen) contLamellen.style.display = 'none';
            if (contAufmass) contAufmass.style.display = 'none';
            if (resCont && mode !== 'beschlag') resCont.style.display = 'none';

            // Logik für die Tab-Anzeige
            if (mode === 'beschlag') {
                if (btnBeschlag) btnBeschlag.classList.add('active');
                if (contBeschlag) contBeschlag.style.display = 'grid';
                if (typeof window.renderDynamicGateGraphic === 'function') {
                    window.renderDynamicGateGraphic();
                }
                if (resCont && window.currentViewList && window.currentViewList.length > 0) {
                    resCont.style.display = 'block';
                }
            } else if (mode === 'allg_zubehoer') {
                if (btnAllgZubehoer) btnAllgZubehoer.classList.add('active');
                if (contAllgZubehoer) contAllgZubehoer.style.display = 'grid';
                if (!window.activeSeilFitting) window.activeSeilFitting = 'Z';
                if (typeof window.selectSeilFitting === 'function') window.selectSeilFitting(window.activeSeilFitting);
                else if (typeof window.calcSeil === 'function') window.calcSeil();
            } else if (mode === 'lamellen') {
                if (btnLamellen) btnLamellen.classList.add('active');
                if (contLamellen) contLamellen.style.display = 'grid';
                if (typeof window.updateLamellenCalculation === 'function') window.updateLamellenCalculation();
            } else if (mode === 'aufmass') {
                if (btnAufmass) btnAufmass.classList.add('active');
                if (contAufmass) contAufmass.style.display = 'grid';

                const isHidden = localStorage.getItem('hideAufmassPilotNote');
                if (!isHidden) {
                    const infoModal = document.getElementById('aufmassInfoModal');
                    if (infoModal) infoModal.style.display = 'flex';
                }
            }
        };

        // --- DRAHTSEILE MINI-KONFIGURATOR LOGIK ---
        window.getSeilHeightSteps = function (fitting) {
            if (fitting === 'Z') return [1875, 1955, 2000, 2080, 2125, 2205, 2250, 2375, 2500, 2625];
            if (fitting === 'L') return [2065, 2190, 2240, 2250, 2490, 2830, 3000];
            return [1875, 2000, 2125, 2250, 2375, 2500, 2625, 2750, 2875, 3000];
        };

        window.stepSeilHeight = function (delta) {
            const input = document.getElementById('inputSeilHeight');
            if (!input) return;
            let val = parseInt(input.value) || 2125;
            val += delta * 125;
            if (val < 1500) val = 1500;
            if (val > 3000) val = 3000;
            if (window.activeSeilFitting === 'Z' && val > 2625) val = 2625;
            input.value = val;
            window.calcSeil();
        };

        window.onSeilHeightChange = function (input) {
            let val = parseInt(input.value);
            if (isNaN(val) || val < 1000) val = 1500;
            if (val > 3500) val = 3000;
            input.value = val;
            window.calcSeil();
        };

        window.selectSeilFitting = function (f) {
            window.activeSeilFitting = f;
            const btnZ = document.getElementById('btnSeilFitZ');
            const btnN = document.getElementById('btnSeilFitN');
            const btnL = document.getElementById('btnSeilFitL');
            const secProp = document.getElementById('ctrlSectionSeilProperties');
            const row170 = document.getElementById('rowSeil170kg');
            const check170 = document.getElementById('checkSeil170kg');

            if (btnZ) btnZ.classList.toggle('active', f === 'Z');
            if (btnN) btnN.classList.toggle('active', f === 'N');
            if (btnL) btnL.classList.toggle('active', f === 'L');

            if (f === 'Z') {
                if (secProp) secProp.style.display = 'none';
                if (row170) row170.style.display = 'none';
                if (check170) check170.checked = false;
            } else {
                if (secProp) secProp.style.display = 'block';
                if (row170) row170.style.display = 'flex';
            }

            // Bei Z-Beschlag maximale Höhe auf 2625 begrenzen falls überschritten
            const input = document.getElementById('inputSeilHeight');
            if (input) {
                let curVal = parseInt(input.value) || 2125;
                if (f === 'Z' && curVal > 2625) {
                    input.value = 2625;
                }
            }

            window.calcSeil();
        };

        window.calcSeil = function () {
            const input = document.getElementById('inputSeilHeight');
            const container = document.getElementById('seilResultContainer');
            if (!input || !container) return;

            const height = parseInt(input.value) || 2125;
            const fitting = window.activeSeilFitting || 'Z';
            const is170 = (fitting !== 'Z') && (document.getElementById('checkSeil170kg')?.checked || false);

            let foundId = null;
            let foundMeta = null;

            if (fitting === 'Z') {
                const tableZ = [
                    { maxH: 1875, id: 'seil_z_2365', len: 2365, artNr: '3064346', price: 65.00, date: '01.02.2001', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 1955, id: 'seil_z_2445', len: 2445, artNr: '3064347', price: 65.00, date: '01.07.2002', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2000, id: 'seil_z_2490', len: 2490, artNr: '3064348', price: 65.00, date: '01.09.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2080, id: 'seil_z_2570', len: 2570, artNr: '3064349', price: 65.00, date: '01.07.2002', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2125, id: 'seil_z_2615', len: 2615, artNr: '3064350', price: 67.00, date: '01.09.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2205, id: 'seil_z_2695', len: 2695, artNr: '3064351', price: 67.00, date: '01.03.2003', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2250, id: 'seil_z_2740', len: 2740, artNr: '3064352', price: 67.00, date: '01.09.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2375, id: 'seil_z_2865', len: 2865, artNr: '3064353', price: 67.00, date: '01.02.2001', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 2500, id: 'seil_z_2990', len: 2990, artNr: '3064354', price: 67.00, date: '01.02.2001', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' },
                    { maxH: 9999, id: 'seil_z_3115', len: 3115, artNr: '3064355', price: 67.00, date: '01.06.2003', desc: 'Drahtseile Ø 3 mm, Beschlagsart Z mit Seilaufnahme' }
                ];
                foundMeta = tableZ.find(t => height <= t.maxH) || tableZ[tableZ.length - 1];
                foundId = foundMeta.id;
            } else if (fitting === 'N') {
                if (!is170) {
                    if (height <= 2250) {
                        foundMeta = { id: 'seil_n_3040', len: 3040, maxH: 2250, artNr: '3064375', price: 24.00, date: '01.03.2005', desc: 'Drahtseile Ø 3 mm, Beschlagsart N, mit Kausche' };
                    } else {
                        foundMeta = { id: 'seil_n_3780', len: 3780, maxH: 3000, artNr: '3064376', price: 28.00, date: '01.06.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart N, mit Kausche' };
                    }
                } else {
                    if (height <= 2250) {
                        foundMeta = { id: 'seil_verstaerkt_n_3040', len: 3040, maxH: 2250, artNr: '3086779', price: 161.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, N-Beschlag mit Kausche (> 170 kg)' };
                    } else {
                        foundMeta = { id: 'seil_verstaerkt_n_3780', len: 3780, maxH: 3000, artNr: '3086778', price: 194.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, N-Beschlag mit Kausche (> 170 kg)' };
                    }
                }
                foundId = foundMeta.id;
            } else if (fitting === 'L') {
                if (!is170) {
                    const tableL = [
                        { maxH: 2065, id: 'seil_l_5280', len: 5280, artNr: '3064358', price: 65.00, date: '01.03.2005', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' },
                        { maxH: 2190, id: 'seil_l_5475', len: 5475, artNr: '3064359', price: 71.00, date: '01.03.2005', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' },
                        { maxH: 2240, id: 'seil_l_5600', len: 5600, artNr: '3064360', price: 70.00, date: '01.03.2005', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' },
                        { maxH: 2250, id: 'seil_l_5655', len: 5655, artNr: '3064361', price: 70.00, date: '01.03.2005', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' },
                        { maxH: 2490, id: 'seil_l_6250', len: 6250, artNr: '3064362', price: 70.00, date: '01.06.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' },
                        { maxH: 2830, id: 'seil_l_6900', len: 6900, artNr: '3064363', price: 77.00, date: '01.06.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' },
                        { maxH: 9999, id: 'seil_l_7300', len: 7300, artNr: '3064364', price: 81.00, date: '01.06.1999', desc: 'Drahtseile Ø 3 mm, Beschlagsart L, mit Kausche' }
                    ];
                    foundMeta = tableL.find(t => height <= t.maxH) || tableL[tableL.length - 1];
                } else {
                    const tableLVerst = [
                        { maxH: 2065, id: 'seil_verstaerkt_l_5280', len: 5280, artNr: '3086771', price: 264.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' },
                        { maxH: 2190, id: 'seil_verstaerkt_l_5475', len: 5475, artNr: '3086772', price: 273.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' },
                        { maxH: 2240, id: 'seil_verstaerkt_l_5600', len: 5600, artNr: '3086773', price: 280.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' },
                        { maxH: 2250, id: 'seil_verstaerkt_l_5655', len: 5655, artNr: '3086774', price: 282.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' },
                        { maxH: 2490, id: 'seil_verstaerkt_l_6250', len: 6250, artNr: '3086775', price: 306.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' },
                        { maxH: 2830, id: 'seil_verstaerkt_l_6900', len: 6900, artNr: '3086776', price: 336.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' },
                        { maxH: 9999, id: 'seil_verstaerkt_l_7300', len: 7300, artNr: '3086777', price: 355.00, date: '01.11.2009', desc: 'Verstärkte Drahtseile Ø 2,9 mm, L-Beschlag mit Kausche (> 170 kg)' }
                    ];
                    foundMeta = tableLVerst.find(t => height <= t.maxH) || tableLVerst[tableLVerst.length - 1];
                }
                foundId = foundMeta.id;
            }

            // Preis und Name aus Live-Datenbank falls verfügbar
            let livePrice = foundMeta.price;
            let liveArtNr = foundMeta.artNr;
            let liveName = (foundMeta.len ? `Drahtseil L = ${foundMeta.len} mm` : 'Drahtseil');
            if (typeof partsDB !== 'undefined' && partsDB[foundId]) {
                const dbItem = partsDB[foundId];
                if (dbItem.price !== undefined) livePrice = parseFloat(dbItem.price) || livePrice;
                if (dbItem.artNr) liveArtNr = dbItem.artNr;
                if (dbItem.name) liveName = dbItem.name;
            }

            const priceFormatted = (livePrice).toFixed(2).replace('.', ',') + ' €';
            const maxHTxt = (foundMeta.maxH === 9999 || foundMeta.maxH === 3000) ? (fitting === 'N' ? 'für Torhöhen > 2250 mm' : 'bis Torhöhe 3000 mm') : `bis Torhöhe ${foundMeta.maxH} mm`;
            const staerkeTxt = is170 ? 'Ø 2,9 mm (verstärkt)' : 'Ø 3,0 mm';
            const finishTxt = (fitting === 'Z') ? 'mit Seilaufnahme' : 'mit Kausche';

            container.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: bold; margin-bottom: 4px;">Ermitteltes Drahtseil</div>
                            <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.25rem;">${liveName}</h3>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span style="background: #eaf4fb; color: var(--hormann-blue); font-weight: bold; font-family: monospace; font-size: 1.15rem; padding: 4px 10px; border-radius: 4px; border: 1px solid #c2e0f4;">Art.-Nr. ${liveArtNr}</span>
                                <span style="background: #f5eef8; color: #8e44ad; font-weight: bold; font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; border: 1px solid #8e44ad30;">Beschlag ${fitting}</span>
                                ${is170 ? '<span style="background: #fef2f2; color: #dc2626; font-weight: bold; font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; border: 1px solid #fecaca;">> 170 kg Torblatt</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: #64748b;">Listenpreis netto</div>
                            <div style="font-size: 1.6rem; font-weight: bold; color: var(--hormann-blue);">${priceFormatted}</div>
                            <small style="color: #888;">je Tor Stück</small>
                        </div>
                    </div>

                    <!-- DETAIL-TABELLE -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
                        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                            <small style="color: #64748b; display: block; font-size: 0.75rem;">Seillänge (L)</small>
                            <strong style="color: #1e293b; font-size: 1rem;">${foundMeta.len} mm</strong>
                        </div>
                        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                            <small style="color: #64748b; display: block; font-size: 0.75rem;">Seilstärke & Ausführung</small>
                            <strong style="color: #1e293b; font-size: 1rem;">${staerkeTxt}, ${finishTxt}</strong>
                        </div>
                        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                            <small style="color: #64748b; display: block; font-size: 0.75rem;">Auslegung für Torhöhe</small>
                            <strong style="color: #1e293b; font-size: 1rem;">${maxHTxt}</strong>
                        </div>
                        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                            <small style="color: #64748b; display: block; font-size: 0.75rem;">Gültigkeit / Baujahr</small>
                            <strong style="color: #1e293b; font-size: 1rem;">ab ${foundMeta.date}</strong>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="navigator.clipboard.writeText('${liveArtNr}'); this.innerText='✓ Art.-Nr. kopiert!'; setTimeout(() => this.innerText='📋 Art.-Nr. kopieren', 2000);"
                            class="btn-calc" style="width: auto; margin: 0; padding: 8px 18px; font-size: 0.85rem;">📋 Art.-Nr. kopieren</button>
                    </div>
                </div>
            `;
        };

        // --- NEU: FUNKTION ZUM SCHLIESSEN UND SPEICHERN DES POPUPS ---
        window.closeAufmassInfo = function () {
            const checkbox = document.getElementById('hideAufmassNote');
            if (checkbox && checkbox.checked) {
                localStorage.setItem('hideAufmassPilotNote', 'true');
            }
            const infoModal = document.getElementById('aufmassInfoModal');
            if (infoModal) infoModal.style.display = 'none';
        };
        // -------------------------------------------------------------

        // Die hinterlegten Normgrößen aus der App
        const standardSizesZ = [
            [2190, 2080], [2250, 1900], [2250, 2000], [2250, 2125], [2315, 2080], [2315, 2205],
            [2375, 1900], [2375, 2000], [2375, 2080], [2375, 2125], [2375, 2250],
            [2440, 2080], [2440, 2205],
            [2500, 1900], [2500, 2000], [2500, 2080], [2500, 2125], [2500, 2250], [2500, 2375], [2500, 2500],
            [2625, 2125], [2750, 2000], [2750, 2125], [2750, 2250], [2750, 2375], [2750, 2500],
            [2940, 2080], [3000, 2000], [3000, 2125], [3000, 2250], [3000, 2375], [3000, 2500],
            [3250, 2000], [3250, 2125], [3250, 2250],
            [3500, 2000], [3500, 2125], [3500, 2250],
            [3750, 2000], [3750, 2125], [3750, 2250],
            [4000, 2000], [4000, 2125], [4000, 2250]
        ];

        const standardSizesNL = [
            [2500, 2750], [2750, 2750], [3000, 3000],
            [4250, 2000], [4250, 2125], [4250, 2250],
            [4500, 2000], [4500, 2125], [4500, 2250],
            [4750, 2000], [4750, 2125], [4750, 2250],
            [5000, 2000], [5000, 2125], [5000, 2250], [5000, 2375], [5000, 2500],
            [5500, 2000], [5500, 2125], [5500, 2250],
            [6000, 2000], [6000, 2125], [6000, 2250]
        ];

        // RenoMatic-Aktionsgrößen
        const renoMaticSizesZ = [
            [2315, 2080],
            [2375, 2000], [2375, 2080], [2375, 2125],
            [2440, 2080],
            [2500, 1900], [2500, 2000], [2500, 2080], [2500, 2125], [2500, 2250], [2500, 2500],
            [2750, 2125], [2750, 2250], [2750, 2500],
            [3000, 2000], [3000, 2125], [3000, 2250], [3000, 2500],
            [3500, 2125], [3500, 2250], [3500, 2500],
            [4000, 2000], [4000, 2125], [4000, 2250], [4000, 2500]
        ];

        const renoMaticSizesNL = [
            [3000, 3000],
            [4500, 2125],
            [5000, 2000], [5000, 2125], [5000, 2250], [5000, 2500],
            [5500, 2125], [5500, 2250]
        ];

        // Auf window für ES-Module freigeben
        window.standardSizesZ = standardSizesZ;
        window.standardSizesNL = standardSizesNL;
        window.renoMaticSizesZ = renoMaticSizesZ;
        window.renoMaticSizesNL = renoMaticSizesNL;

        window.switchToLpuModel = function() {
            const tormodellSelect = document.getElementById('aufmassTormodell');
            if (tormodellSelect) {
                tormodellSelect.value = 'LPU';
                if (typeof window.updateAufmassSurfaces === 'function') {
                    window.updateAufmassSurfaces();
                } else if (typeof window.updateAufmassSickeOptions === 'function') {
                    window.updateAufmassSickeOptions();
                }
                if (typeof window.calculateAufmass === 'function') {
                    window.calculateAufmass();
                }
            }
        };

        window.calculateAufmass = function () {
            const isMontageIn = document.getElementById('aufmassMontage').value === 'in';
            const isAntrieb = document.getElementById('aufmassBedienung').value === 'antrieb';

            const A = parseInt(document.getElementById('aufmassA').value) || 0;
            const B = parseInt(document.getElementById('aufmassB').value) || 0;
            let C1 = parseInt(document.getElementById('aufmassC1').value) || 0;
            let C2 = parseInt(document.getElementById('aufmassC2').value) || 0;
            let D = parseInt(document.getElementById('aufmassD').value) || 0;
            const G = parseInt(document.getElementById('aufmassG').value) || 0;
            const originalG = G;

            const userA = A;
            const userB = B;
            const userC1 = parseInt(document.getElementById('aufmassC1').value) || 0;
            const userC2 = parseInt(document.getElementById('aufmassC2').value) || 0;
            const userD = parseInt(document.getElementById('aufmassD').value) || 0;
            const userG = G;

            const E1 = parseInt(document.getElementById('aufmassE1').value) || 0;
            const E2 = parseInt(document.getElementById('aufmassE2').value) || 0;
            const F1 = parseInt(document.getElementById('aufmassF1').value) || 0;
            const F2 = parseInt(document.getElementById('aufmassF2').value) || 0;

            const resContainer = document.getElementById('aufmassResultContainer');

            if (A === 0 || B === 0) {
                resContainer.innerHTML = '<p style="color:var(--error-red); font-weight:bold;">Bitte mindestens Lichte Breite (A) und Lichte Höhe (B) ausfüllen.</p>';
                return;
            }

            // Hindernis-Reduzierungen anwenden
            const deductions = window.applyObstacleDeductions ? window.applyObstacleDeductions(A, B, C1, C2, D, G) : { C1, C2, D, G, explanations: [], affectedZones: {} };
            C1 = deductions.C1;
            C2 = deductions.C2;
            D = deductions.D;
            if (deductions.B !== undefined) B = deductions.B;
            // We do NOT overwrite G with deductions.G so that the search can explore heights dynamically using originalG!
            window.lastObstacleDeductions = deductions.explanations;
            window.lastObstacleAffectedZones = deductions.affectedZones;

            let origD = D, origC1 = C1, origC2 = C2;
            let alertMessages = [];
            if (window.lastObstacleDeductions && window.lastObstacleDeductions.length > 0) {
                alertMessages = alertMessages.concat(window.lastObstacleDeductions);
            }

            let minF = Math.min(F1 || Infinity, F2 || Infinity);
            if (minF !== Infinity && minF < (B + origD)) {
                let diff = (B + origD) - minF;
                D = Math.max(0, origD - diff);
                alertMessages.push(`Die lichte Raumhöhe (${minF} mm) ist geringer als die benötigte Gesamthöhe vorne (${B + origD} mm). Die nutzbare Sturzhöhe (D) wurde intern von ${origD} mm auf ${D} mm reduziert.`);
            }

            let minE = Math.min(E1 || Infinity, E2 || Infinity);
            let frontTotalWidth = A + origC1 + origC2;

            if (minE !== Infinity && minE < frontTotalWidth) {
                if (minE >= A) {
                    let diff = frontTotalWidth - minE;
                    C1 = Math.max(0, origC1 - Math.floor(diff / 2));
                    C2 = Math.max(0, origC2 - Math.ceil(diff / 2));
                    alertMessages.push(`Die Raumbreite (${minE} mm) ist geringer als die benötigte Gesamtbreite vorne (${frontTotalWidth} mm). Die seitlichen Anschläge wurden intern reduziert.`);
                } else {
                    C1 = 0;
                    C2 = 0;
                    alertMessages.push(`Die Raumbreite (${minE} mm) ist sogar geringer als die Torbreite A (${A} mm). Einbau nicht möglich! Anschläge auf 0 gesetzt.`);
                }
            }

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

            let proposals = [];

            if (!hasLogicError) {
                let best = window.findBestProposal ? window.findBestProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn) : null;
                if (best) proposals.push(best);

                if (!isMontageIn) {
                    let alt = window.findAlternativeNormProposal ? window.findAlternativeNormProposal(A, B, C1, C2, D, G, isAntrieb, best) : null;
                    if (alt) proposals.push(alt);
                }

                let sonder = window.findSonderanfertigungProposal ? window.findSonderanfertigungProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn) : null;
                if (sonder) {
                    if (!proposals.find(p => p.w === sonder.w && p.h === sonder.h && p.type === sonder.type)) {
                        proposals.push(sonder);
                    }
                }
            }

            // Roh-Suche ohne Hindernis-Kompensationen durchführen zum Relevanz-Vergleich
            let rawProposals = [];
            const originalObstacles = window.aufmassObstacles;
            window.aufmassObstacles = [];

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

                let rawBest = window.findBestProposal ? window.findBestProposal(userA, userB, tempC1, tempC2, tempD, userG, isAntrieb, isMontageIn) : null;
                if (rawBest) rawProposals.push(rawBest);
                if (!isMontageIn) {
                    let rawAlt = window.findAlternativeNormProposal ? window.findAlternativeNormProposal(userA, userB, tempC1, tempC2, tempD, userG, isAntrieb, rawBest) : null;
                    if (rawAlt) rawProposals.push(rawAlt);
                }
                let rawSonder = window.findSonderanfertigungProposal ? window.findSonderanfertigungProposal(userA, userB, tempC1, tempC2, tempD, userG, isAntrieb, isMontageIn) : null;
                if (rawSonder) {
                    if (!rawProposals.find(p => p.w === rawSonder.w && p.h === rawSonder.h && p.type === rawSonder.type)) {
                        rawProposals.push(rawSonder);
                    }
                }
            }

            window.aufmassObstacles = originalObstacles;

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
                let gapP = B - (p1.h + 100);
                let gapR = B - (r1.h + 100);
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

            // Hintergrund-Prüfung: Wenn RenoMatic gewählt, aber kein Vorschlag ermittelt,
            // prüfen wir, ob LPU ein Ergebnis geliefert hätte.
            const tormodellSelect = document.getElementById('aufmassTormodell');
            const isRenoMatic = tormodellSelect && tormodellSelect.value === 'RenoMatic';
            window.lpuAlternativePossible = false;

            if (isRenoMatic && proposals.length === 0 && !hasLogicError) {
                // Temporär auf LPU schalten
                tormodellSelect.value = 'LPU';
                
                let lpuProposals = [];
                let lpuBest = window.findBestProposal ? window.findBestProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn) : null;
                if (lpuBest) lpuProposals.push(lpuBest);
                
                if (!isMontageIn) {
                    let lpuAlt = window.findAlternativeNormProposal ? window.findAlternativeNormProposal(A, B, C1, C2, D, G, isAntrieb, lpuBest) : null;
                    if (lpuAlt) lpuProposals.push(lpuAlt);
                }
                
                let lpuSonder = window.findSonderanfertigungProposal ? window.findSonderanfertigungProposal(A, B, C1, C2, D, G, isAntrieb, isMontageIn) : null;
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
            if (!isMontageIn) {
                proposals.forEach(p => {
                    let gap = B - (p.h + 100);
                    p.fascia = null;
                    p.isPU = false;

                    if (gap > 0) {
                        const standardFascias = [95, 125, 150, 173];
                        let maxAllowed = gap + 100;
                        let bestFascia = null;

                        // 1. Standard-Blenden prüfen
                        for (let i = standardFascias.length - 1; i >= 0; i--) {
                            if (standardFascias[i] >= gap && standardFascias[i] <= maxAllowed) {
                                bestFascia = standardFascias[i];
                                break;
                            }
                        }

                        // 2. PU-Blende prüfen (Maximalmaß = individuelle Rasterhöhe)
                        if (!bestFascia) {
                            // Sektionsanzahl präzise nach Torhöhe bestimmen
                            let numSections;
                            if (p.h <= 2250) {
                                numSections = 4;
                            } else if (p.h <= 2875) {
                                numSections = 5;
                            } else if (p.h <= 3500) {
                                numSections = 6;
                            } else {
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
                    let gap = B - (p.h + 100);
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
                fascia: p.fascia,
                isPU: p.isPU
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
                    let usableG = window.getUsableDepthForHeight ? window.getUsableDepthForHeight(sH, A, C1, C2, originalG) : originalG;
                    
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
                    let usableG = window.getUsableDepthForHeight ? window.getUsableDepthForHeight(B, A, C1, C2, originalG) : originalG;
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
            if (typeof update3D === 'function') {
                update3D();
            }
        };

        // Bereinigte Hilfsfunktion (ohne Desc-Parameter)
        function generateProposalBox(title, size) {
            return `
            <div style="background:#eaf4fb; border:1px solid var(--hormann-blue); padding:15px; border-radius:6px; margin-bottom:10px;">
                <h4 style="margin:0 0 5px 0; color:var(--hormann-blue);">${title}</h4>
                <p style="margin:0; font-size:1.4rem; font-weight:bold; color:#333;">${size}</p>
            </div>`;
        }

        let lamQtyMap = { 'Topsektion': 1, 'Zwischensektion': 1, 'Zwischensektion (Schloss)': 1, 'Bodensektion': 1 };

        window.changeLamellenValue = function (inputId, delta) {
            const input = document.getElementById(inputId);
            if (!input) return;
            let val = parseInt(input.value) || 0;
            let min = parseInt(input.getAttribute('min')) || 0;
            let max = parseInt(input.getAttribute('max')) || 9999;
            let newVal = val + delta;
            if (newVal > max) newVal = max;
            if (newVal < min) newVal = min;
            input.value = newVal;

            updateLamellenCalculation();
        };

        window.validateLamellenInput = function (input) {
            let val = parseInt(input.value) || 0;
            let min = parseInt(input.getAttribute('min')) || 0;
            let max = parseInt(input.getAttribute('max')) || 9999;
            if (val > max) input.value = max;
            if (val < min) input.value = min;
            updateLamellenCalculation();
        };

        window.resetLamellaSelection = function () {
            document.querySelectorAll('.lamella-box').forEach(b => b.classList.remove('active'));
            lamQtyMap = { 'Topsektion': 1, 'Zwischensektion': 1, 'Zwischensektion (Schloss)': 1, 'Bodensektion': 1 };
            updateLamellenCalculation();
        };

        // --- DYNAMISCHE OBERFLÄCHEN-AUSWAHL ---
        const surfaceMapping = {
            "S": ["Woodgrain"],
            "M": ["Woodgrain", "Slategrain", "Plaingrain", "Silkgrain", "Sandgrain", "Decograin"],
            "L": ["Woodgrain", "Slategrain", "Plaingrain", "Silkgrain", "Sandgrain", "Decograin", "Duragrain", "Planar"],
            "D": ["Silkgrain"],
            "S-Kassette": ["Woodgrain", "Decograin"]
        };

        // --- FARB-LOGIK FÜR DEN AUFMASS-PILOT ---
        window.aufmassColorData = {
            "RAL 9016 (Verkehrsweiß)": 0xF4F8FA,
            "RAL 1015 (Hellelfenbein)": 0xE6D9BD,
            "RAL 6005 (Moosgrün)": 0x114232,
            "RAL 6009 (Tannengrün)": 0x213529,
            "RAL 9006 (Weißaluminium)": 0xA5A5A5,
            "RAL 9007 (Graualuminium)": 0x8F8F8F,
            "RAL 7012 (Basaltgrau)": 0x595E60,
            "RAL 7015 (Schiefergrau)": 0x51565C,
            "RAL 7016 (Anthrazitgrau)": 0x383E42,
            "RAL 7030 (Steingrau)": 0x929288,
            "RAL 7035 (Lichtgrau)": 0xD3D8D8,
            "RAL 7039 (Quarzgrau)": 0x6C6960,
            "RAL 7040 (Fenstergrau)": 0x9DA3A6,
            "RAL 8028 (Terrabraun)": 0x4E3B31,
            "RAL 9005 (Tiefschwarz)": 0x0A0A0A,
            "CH 703 (Anthrazit metallic)": 0x4A4F54,
            "Noir 2100 Sablé": 0x2B2D2F,
            "CH 907": 0x808080,
            "DB 703": 0x4A4F54,
            "RAL 8077 (Braun)": 0x3A2A22,

            // Planar (Matt deluxe)
            "CH 9016 Matt deluxe Verkehrsweiß": 0xF4F8FA,
            "CH 905 Matt deluxe Schwarz": 0x0A0A0A,
            "CH 9006 Matt deluxe Weißaluminium": 0xA5A5A5,
            "CH 9007 Matt deluxe Graualuminium": 0x8F8F8F,
            "CH 7016 Matt deluxe Anthrazitgrau": 0x383E42,
            "CH 8028 Matt deluxe Terrabraun": 0x4E3B31,
            "CH 703 Matt deluxe Anthrazit Metallic": 0x4A4F54
        };

        window.updateAufmassSurfaces = function () {
            const tormodellSelect = document.getElementById('aufmassTormodell');
            const isRenoMatic = tormodellSelect && tormodellSelect.value === 'RenoMatic';
            const obfSelect = document.getElementById('aufmassOberflaeche');
            if (!obfSelect) return;

            let allowedSurfaces = [];
            if (isRenoMatic) {
                // RenoMatic unterstützt nur Woodgrain und Planar
                allowedSurfaces = ["Woodgrain", "Planar"];
            } else {
                // LPU unterstützt alle Oberflächen
                allowedSurfaces = ["Woodgrain", "Slategrain", "Plaingrain", "Silkgrain", "Decograin", "Duragrain", "Planar"];
            }

            const currentObf = obfSelect.value;
            obfSelect.innerHTML = '';
            allowedSurfaces.forEach(s => {
                obfSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });

            // Standardmäßig Woodgrain auswählen, falls erlaubt/erster Besuch
            if (allowedSurfaces.includes(currentObf)) {
                obfSelect.value = currentObf;
            } else {
                obfSelect.value = "Woodgrain"; // Standard: Woodgrain
            }

            window.updateAufmassSickeOptions();
        };

        window.updateAufmassSickeOptions = function () {
            const tormodellSelect = document.getElementById('aufmassTormodell');
            const obfSelect = document.getElementById('aufmassOberflaeche');
            const sickeSelect = document.getElementById('aufmassSicke');
            if (!tormodellSelect || !obfSelect || !sickeSelect) return;

            const isRenoMatic = tormodellSelect.value === 'RenoMatic';
            const obf = obfSelect.value;
            const currentSicke = sickeSelect.value;

            // Invertiertes Mapping für LPU (Oberfläche -> Sicke)
            const sickeMapping = {
                "Woodgrain": ["S", "M", "L", "S-Kassette"],
                "Slategrain": ["M", "L"],
                "Plaingrain": ["M", "L"],
                "Silkgrain": ["M", "L", "D"],
                "Decograin": ["M", "L", "S-Kassette"],
                "Duragrain": ["L"],
                "Planar": ["L"]
            };

            let allowedSicken = [];
            if (isRenoMatic) {
                if (obf === "Woodgrain") {
                    allowedSicken = ["M"]; // Woodgrain bei RenoMatic ist nur in M-Sicke möglich
                } else if (obf === "Planar") {
                    allowedSicken = ["M", "L"]; // Planar bei RenoMatic gibt es in M- und L-Sicke
                }
            } else {
                allowedSicken = sickeMapping[obf] || ["L"];
            }

            sickeSelect.innerHTML = '';
            allowedSicken.forEach(s => {
                const labels = {
                    "S": "S-Sicke",
                    "M": "M-Sicke",
                    "L": "L-Sicke",
                    "D": "D-Sicke",
                    "S-Kassette": "S-Kassette"
                };
                sickeSelect.innerHTML += `<option value="${s}">${labels[s] || s}</option>`;
            });

            // Standardmäßig M-Sicke auswählen, wenn vorhanden, sonst erste Option
            if (allowedSicken.includes(currentSicke)) {
                sickeSelect.value = currentSicke;
            } else if (allowedSicken.includes("M")) {
                sickeSelect.value = "M"; // Standard: M-Sicke
            } else {
                sickeSelect.value = allowedSicken[0];
            }

            window.updateAufmassColors();
        };

        window.updateAufmassColors = function () {
            const tormodellSelect = document.getElementById('aufmassTormodell');
            const isRenoMatic = tormodellSelect && tormodellSelect.value === 'RenoMatic';
            const obf = document.getElementById('aufmassOberflaeche').value;
            const colorSelect = document.getElementById('aufmassFarbe');
            if (!colorSelect) return;

            let colors = [];
            if (isRenoMatic && obf === "Woodgrain") {
                // RenoMatic Woodgrain ist auf genau 7 spezifische Farben eingeschränkt
                colors = [
                    "RAL 9016 (Verkehrsweiß)",
                    "RAL 7016 (Anthrazitgrau)",
                    "RAL 9006 (Weißaluminium)",
                    "RAL 9007 (Graualuminium)",
                    "RAL 8028 (Terrabraun)",
                    "RAL 9005 (Tiefschwarz)",
                    "CH 703 (Anthrazit metallic)"
                ];
            } else if (obf.includes("Slategrain") || obf.includes("Plaingrain")) {
                colors = [
                    "RAL 9016 (Verkehrsweiß)", "RAL 7016 (Anthrazitgrau)",
                    "RAL 9006 (Weißaluminium)", "RAL 9007 (Graualuminium)",
                    "CH 703 (Anthrazit metallic)"
                ];
            } else if (obf === "Decograin") {
                colors = [
                    "Golden Oak", "Dark Oak", "Titan Metallic CH 703"
                ];
            } else if (obf === "Duragrain") {
                colors = [
                    "Antique Parket", "Bambus", "Beige", "Beton", "Burned Oak", "Cherry",
                    "Concrete Surface", "Corten Steel", "Fichte", "Grigio", "Grigio scuro",
                    "Grunge Wall", "Limestone", "Malt Oak", "Moca", "Nature Oak", "Night Oak",
                    "Noce sorrento balsamico", "Noce sorrento nature", "Rosewood", "Rusty Oak",
                    "Rusty Steel", "Sapeli", "Screed", "Sheffield", "Stadelholz grau", "Teak",
                    "Toffee Oak", "Used Look", "Vintage Boards", "Walnuss Kolonial",
                    "Walnuss Terra", "White brushed", "White Oak", "Whiteoiled Oak",
                    "Whitewashed Oak", "Winchester Oak"
                ];
            } else if (obf === "Planar") {
                colors = [
                    "CH 9016 Matt deluxe Verkehrsweiß",
                    "CH 905 Matt deluxe Schwarz",
                    "CH 9006 Matt deluxe Weißaluminium",
                    "CH 9007 Matt deluxe Graualuminium",
                    "CH 7016 Matt deluxe Anthrazitgrau",
                    "CH 8028 Matt deluxe Terrabraun",
                    "CH 703 Matt deluxe Anthrazit Metallic"
                ];
            } else {
                colors = [
                    "RAL 9016 (Verkehrsweiß)", "RAL 1015 (Hellelfenbein)", "RAL 6005 (Moosgrün)", "RAL 6009 (Tannengrün)",
                    "RAL 9006 (Weißaluminium)", "RAL 9007 (Graualuminium)", "RAL 7012 (Basaltgrau)", "RAL 7015 (Schiefergrau)",
                    "RAL 7016 (Anthrazitgrau)", "RAL 7030 (Steingrau)", "RAL 7035 (Lichtgrau)", "RAL 7039 (Quarzgrau)",
                    "RAL 7040 (Fenstergrau)", "RAL 8028 (Terrabraun)", "RAL 9005 (Tiefschwarz)", "CH 703 (Anthrazit metallic)",
                    "Noir 2100 Sablé", "CH 907", "DB 703", "RAL 8077 (Braun)"
                ];
            }

            const currentColor = colorSelect.value;
            colorSelect.innerHTML = '';
            colors.forEach(c => { colorSelect.innerHTML += `<option value="${c}">${c}</option>`; });

            if (colors.includes(currentColor)) colorSelect.value = currentColor;
            else colorSelect.value = colors[0];

            if (typeof update3D === 'function') update3D();
        };

        // Beim Laden der Seite einmal initiieren
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => { 
                if (typeof window.updateAufmassSurfaces === 'function') {
                    window.updateAufmassSurfaces();
                } else if (typeof window.updateAufmassSickeOptions === 'function') {
                    window.updateAufmassSickeOptions(); 
                }
            }, 600);
        });

        window.updateLamSickeOptions = function () {
            const modelSelect = document.getElementById('lamTormodell');
            const sickeSelect = document.getElementById('lamSicke');
            if (!modelSelect || !sickeSelect) return;

            const isRenoMatic = modelSelect.value === 'RenoMatic';
            const currentSicke = sickeSelect.value;

            let allowedSicken = ["S", "M", "L", "D", "T", "S-Kassette"];
            if (isRenoMatic) {
                allowedSicken = ["M", "L"];
            }

            sickeSelect.innerHTML = '';
            allowedSicken.forEach(s => {
                const labels = {
                    "S": "S-Sicke",
                    "M": "M-Sicke",
                    "L": "L-Sicke",
                    "D": "D-Sicke",
                    "T": "T-Sicke",
                    "S-Kassette": "S-Kassette"
                };
                const opt = document.createElement('option');
                opt.value = s;
                opt.innerText = labels[s] || s;
                sickeSelect.appendChild(opt);
            });

            if (allowedSicken.includes(currentSicke)) {
                sickeSelect.value = currentSicke;
            } else {
                sickeSelect.value = allowedSicken[0];
            }

            window.updateSurfaceOptions();
        };

        window.updateSurfaceOptions = function () {
            const modelSelect = document.getElementById('lamTormodell');
            const sickeSelect = document.getElementById('lamSicke');
            const obfSelect = document.getElementById('lamOberflaeche');
            if (!sickeSelect || !obfSelect) return;

            const isRenoMatic = modelSelect && modelSelect.value === 'RenoMatic';
            const currentSicke = sickeSelect.value;
            const currentObf = obfSelect.value;

            let allowedSurfaces = [];
            if (isRenoMatic) {
                if (currentSicke === "M") {
                    allowedSurfaces = ["Woodgrain", "Planar"];
                } else if (currentSicke === "L") {
                    allowedSurfaces = ["Planar"];
                }
            } else {
                allowedSurfaces = surfaceMapping[currentSicke] || [];
            }

            // 1. Dropdown leeren
            obfSelect.innerHTML = '';

            // 2. Nur erlaubte Oberflächen hinzufügen
            allowedSurfaces.forEach(surface => {
                const opt = document.createElement('option');
                opt.value = surface;
                opt.innerText = surface;
                obfSelect.appendChild(opt);
            });

            // 3. Alte Auswahl wiederherstellen, falls kompatibel
            if (allowedSurfaces.includes(currentObf)) {
                obfSelect.value = currentObf;
            } else {
                obfSelect.value = allowedSurfaces[0];
            }

            // 4. Farben aktualisieren
            window.updateLamColors();
        };

        window.updateLamColors = function () {
            const modelSelect = document.getElementById('lamTormodell');
            const colorSelect = document.getElementById('lamFarbe');
            if (!colorSelect) return;

            const isRenoMatic = modelSelect && modelSelect.value === 'RenoMatic';
            const currentColor = colorSelect.value;

            let allowedColors = [
                { value: "Standard", text: "Verkehrsweiß (Standard)" },
                { value: "Vorzugsfarbe", text: "Color / Vorzugsfarben" },
                { value: "RAL", text: "RAL nach Wahl" }
            ];

            if (isRenoMatic) {
                allowedColors = [
                    { value: "Standard", text: "Verkehrsweiß (Standard)" },
                    { value: "Vorzugsfarbe", text: "Color / Vorzugsfarben" }
                ];
            }

            colorSelect.innerHTML = '';
            allowedColors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.value;
                opt.innerText = c.text;
                colorSelect.appendChild(opt);
            });

            if (allowedColors.some(c => c.value === currentColor)) {
                colorSelect.value = currentColor;
            } else {
                colorSelect.value = allowedColors[0].value;
            }

            // 5. Preis direkt neu kalkulieren
            if (typeof window.updateLamellenCalculation === 'function') {
                window.updateLamellenCalculation();
            }
        };

        // Event-Listener für Live-Aktualisierung (Ersetzt die fehlenden HTML onchange Attribute)
        document.addEventListener('DOMContentLoaded', () => {
            const mSelect = document.getElementById('lamTormodell');
            const sSelect = document.getElementById('lamSicke');
            const oSelect = document.getElementById('lamOberflaeche');
            const fSelect = document.getElementById('lamFarbe');

            if (mSelect) mSelect.addEventListener('change', window.updateLamSickeOptions);
            if (sSelect) sSelect.addEventListener('change', window.updateSurfaceOptions);
            if (oSelect) oSelect.addEventListener('change', window.updateLamellenCalculation);
            if (fSelect) fSelect.addEventListener('change', window.updateLamellenCalculation);

            // Initial-Setup nach 500ms, um Standardwerte zu triggern
            setTimeout(() => {
                if (typeof window.updateLamSickeOptions === 'function') window.updateLamSickeOptions();
            }, 500);
        });

        window.toggleLamella = function (element) {
            element.classList.toggle('active');
            updateLamellenCalculation();
        };

        window.updateLamQty = function (secName, delta) {
            if (!lamQtyMap[secName]) lamQtyMap[secName] = 1;

            const h = parseInt(document.getElementById('inputLamHeight').value) || 2125;
            const rasterList = [1900, 2000, 2080, 2125, 2205, 2250, 2375, 2500, 2600, 2750, 2850, 3000];
            let targetRaster = 3000;
            for (let r of rasterList) {
                if (h <= r) { targetRaster = r; break; }
            }
            let lamellenAnzahl = 4;
            if (targetRaster >= 2850) lamellenAnzahl = 6;
            else if (targetRaster >= 2375) lamellenAnzahl = 5;

            let maxZwischen = lamellenAnzahl - 3;
            if (maxZwischen < 1) maxZwischen = 1;

            lamQtyMap[secName] += delta;

            if (lamQtyMap[secName] < 1) lamQtyMap[secName] = 1;
            if (secName === 'Zwischensektion' && lamQtyMap[secName] > maxZwischen) {
                lamQtyMap[secName] = maxZwischen;
            } else if (secName !== 'Zwischensektion' && lamQtyMap[secName] > 1) {
                lamQtyMap[secName] = 1;
            }

            updateLamellenCalculation();
        };

        window.updateLamellenCalculation = function () {
            window.currentLamellenExportList = []; // Leert die Export-Liste bei jeder Neuberechnung
            const w = parseInt(document.getElementById('inputLamWidth').value) || 2500;
            const h = parseInt(document.getElementById('inputLamHeight').value) || 2125;
            const sicke = document.getElementById('lamSicke').value;
            const surface = document.getElementById('lamOberflaeche').value;
            const color = document.getElementById('lamFarbe').value;

            const rasterList = [1900, 2000, 2080, 2125, 2205, 2250, 2375, 2500, 2600, 2750, 2850, 3000];
            let targetRaster = 3000;
            let isCut = false;

            for (let r of rasterList) {
                if (h <= r) {
                    targetRaster = r;
                    if (h < r) isCut = true;
                    break;
                }
            }

            let lamellenAnzahl = 4;
            if (targetRaster >= 2850) lamellenAnzahl = 6;
            else if (targetRaster >= 2375) lamellenAnzahl = 5;

            let maxZwischen = lamellenAnzahl - 3;
            if (maxZwischen < 1) maxZwischen = 1;

            const warnIcon = document.getElementById('lamHeightWarn');
            const warnText = document.getElementById('lamHeightWarnText');
            if (lamellenAnzahl > 4) {
                if (warnIcon) warnIcon.style.display = 'block';
                if (warnText) warnText.style.display = 'block';
            } else {
                if (warnIcon) warnIcon.style.display = 'none';
                if (warnText) warnText.style.display = 'none';
            }

            const activeBoxes = document.querySelectorAll('.lamella-box.active');
            const resCard = document.getElementById('lamellenResultCard');
            const listContainer = document.getElementById('lamellenSelectedList');
            const totalDisplay = document.getElementById('lamellenTotalDisplay');

            if (activeBoxes.length === 0) {
                if (resCard) resCard.style.display = 'none';
                return;
            }

            // KUGELSICHER: Prüft auf window.lamellenMatrix
            if (!window.lamellenMatrix || window.lamellenMatrix.length === 0) {
                listContainer.innerHTML = '<div style="color:red; font-size:0.8rem;">Datenbank lädt oder ist leer. Bitte warten...</div>';
                totalDisplay.innerText = "0,00 €";
                if (resCard) resCard.style.display = 'block';
                return;
            }

            // Exakte Rundung der Höhe gegen Nachkommastellen!
            const lamellenHoehe = Math.round(targetRaster / lamellenAnzahl);
            const qm = (w / 1000) * (lamellenHoehe / 1000);
            const cleanStr = (s) => String(s).toLowerCase().replace(/\s+/g, '');

            const sortOrder = { 'Topsektion': 1, 'Zwischensektion': 2, 'Zwischensektion (Schloss)': 3, 'Bodensektion': 4 };

            let arr = Array.from(activeBoxes).map(b => b.getAttribute('data-secname'));
            arr.sort((a, b) => sortOrder[a] - sortOrder[b]);

            let html = '';
            let grandTotal = 0;

            arr.forEach(secName => {
                // Abbruch, falls etwas schiefgegangen ist
                if (!secName) return;

                let searchType = secName.includes('Zwischensektion') ? 'Zwischensektion' : secName;
                let searchSurface = surface;
                if (surface === 'Sandgrain') {
                    searchSurface = 'Silkgrain';
                }
                const match = window.lamellenMatrix.find(m =>
                    cleanStr(m.sicke) === cleanStr(sicke) &&
                    cleanStr(m.oberflaeche) === cleanStr(searchSurface) &&
                    cleanStr(m.typ) === cleanStr(searchType)
                );

                let qty = lamQtyMap[secName] || 1;

                if (secName === 'Zwischensektion' && qty > maxZwischen) {
                    lamQtyMap[secName] = maxZwischen;
                    qty = maxZwischen;
                } else if (secName !== 'Zwischensektion' && qty > 1) {
                    lamQtyMap[secName] = 1;
                    qty = 1;
                }

                if (!match) {
                    html += `<div style="background:#fff; border:1px solid #fcc; padding:10px; border-radius:4px;">
                        <strong style="color:red; font-size:0.85rem;">${secName}</strong><br>
                        <span style="font-size:0.75rem; color:#888;">Kein Preis hinterlegt.</span>
                     </div>`;
                    return;
                }

                let basePricePerQm = match.preisQm;
                let colorSurcharge = 0;
                const modelSelect = document.getElementById('lamTormodell');
                const isRenoMatic = modelSelect && modelSelect.value === 'RenoMatic';
                if (!isRenoMatic) {
                    if (color === 'Standard') colorSurcharge = window.lamellenGlobals.weiss * qm;
                    if (color === 'Vorzugsfarbe') colorSurcharge = window.lamellenGlobals.color * qm;
                    if (color === 'RAL') colorSurcharge = window.lamellenGlobals.ral * qm;
                }

                let topCutSurcharge = 0;
                if (isCut && searchType === 'Topsektion') topCutSurcharge = match.aufpreisKuerzung || 0;

                let singlePrice = (qm * basePricePerQm) + colorSurcharge + topCutSurcharge;
                let positionTotal = singlePrice * qty;
                grandTotal += positionTotal;

                let artNrStr = match.artNr || '-';

                // --- NEU: FÜR DEN PDF EXPORT SPEICHERN ---
                window.currentLamellenExportList.push({
                    name: `${match.typ} (${match.sicke}, ${surface})`,
                    desc: `Breite: ${w} mm, Sektionshöhe: ${lamellenHoehe} mm\nFarbe: ${color}`,
                    artNr: artNrStr,
                    qty: qty,
                    singlePrice: singlePrice,
                    totalPrice: positionTotal
                });
                // -----------------------------------------

                let qtyControls = '';
                if (secName === 'Zwischensektion' && maxZwischen > 1) {
                    qtyControls = `
                <div class="number-control" style="width: 95px; height: 28px; margin: 0;">
                    <button style="flex: 0 0 30px; font-size: 1.1rem; line-height: 1; border: none; border-right: 1px solid #ddd; background: #f9f9f9; font-weight: bold; cursor: pointer; color: #333; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="updateLamQty('${secName}', -1)">-</button>
                    <input type="number" value="${qty}" readonly style="flex: 1; min-width: 0; width: 100%; text-align: center; border: none; font-weight: bold; font-size: 1rem; background: #fff; color: #333; padding: 0; margin: 0; outline: none;">
                    <button style="flex: 0 0 30px; font-size: 1.1rem; line-height: 1; border: none; border-left: 1px solid #ddd; background: #f9f9f9; font-weight: bold; cursor: pointer; color: #333; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="updateLamQty('${secName}', 1)">+</button>
                </div>
            `;
                }

                html += `
            <div style="background:#fff; border:1px solid #ddd; padding:10px; border-radius:4px; display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:0.85rem; color:#333;">${secName}</strong>
                    <strong style="font-size:0.9rem; color:var(--hormann-blue);">${formatEur(positionTotal)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#666;">
                    <div style="display:flex; align-items:center; gap:2px;">
                        <span>Art.-Nr:</span> 
                        <span onclick="copyArtNr('${artNrStr}', this.nextElementSibling)" style="font-family:monospace; color:#d35400; font-weight:bold; cursor:pointer; margin-left:3px;" title="Klicken zum Kopieren">${artNrStr}</span>
                        <button class="copy-btn" onclick="copyArtNr('${artNrStr}', this)" title="Kopieren" style="font-size: 1rem; margin-left: 2px;">📋</button>
                    </div>
                    <div style="display:flex; align-items:center;">
                        ${qtyControls}
                    </div>
                </div>
            </div>
        `;
            });

            listContainer.innerHTML = html;
            totalDisplay.innerText = formatEur(grandTotal);
            if (resCard) resCard.style.display = 'block';
        };

        // --- PDF EINSTELLUNGEN SPEICHERN & LADEN (Refactored) ---
        window.savePdfSettings = function (context = 'visual') {
            const prefix = context === 'lamellen' ? 'Lam' : '';
            const settings = {
                project: document.getElementById(`pdf${prefix}ProjectName`)?.value || '',
                graphic: document.getElementById(`pdf${prefix}SetGraphic`)?.checked ?? true,
                img: document.getElementById(`pdf${prefix}SetImg`)?.checked ?? true,
                artnr: document.getElementById(`pdf${prefix}SetArtNr`)?.checked ?? true,
                ep: document.getElementById(`pdf${prefix}SetEP`)?.checked ?? false,
                gp: document.getElementById(`pdf${prefix}SetGP`)?.checked ?? false,
                freight: document.getElementById(`pdf${prefix}SetFreight`)?.checked ?? true,
                notes: document.getElementById(`pdf${prefix}AdditionalText`)?.value || ''
            };
            localStorage.setItem(`pdfSettings_${context}`, JSON.stringify(settings));
        };

        window.loadPdfSettings = function () {
            ['visual', 'lamellen'].forEach(context => {
                try {
                    const saved = localStorage.getItem(`pdfSettings_${context}`);
                    if (saved) {
                        const settings = JSON.parse(saved);
                        const prefix = context === 'lamellen' ? 'Lam' : '';

                        const projectEl = document.getElementById(`pdf${prefix}ProjectName`);
                        if (projectEl) projectEl.value = settings.project || '';

                        const graphicEl = document.getElementById(`pdf${prefix}SetGraphic`);
                        if (graphicEl) graphicEl.checked = settings.graphic ?? true;

                        const imgEl = document.getElementById(`pdf${prefix}SetImg`);
                        if (imgEl) imgEl.checked = settings.img ?? true;

                        const artnrEl = document.getElementById(`pdf${prefix}SetArtNr`);
                        if (artnrEl) artnrEl.checked = settings.artnr ?? true;

                        const epEl = document.getElementById(`pdf${prefix}SetEP`);
                        if (epEl) epEl.checked = settings.ep ?? false;

                        const gpEl = document.getElementById(`pdf${prefix}SetGP`);
                        if (gpEl) gpEl.checked = settings.gp ?? false;

                        const freightEl = document.getElementById(`pdf${prefix}SetFreight`);
                        if (freightEl) freightEl.checked = settings.freight ?? true;

                        const notesEl = document.getElementById(`pdf${prefix}AdditionalText`);
                        if (notesEl) notesEl.value = settings.notes || '';
                    }
                } catch (e) { console.error(`Fehler beim Laden der PDF Settings für ${context}`, e); }
            });
        };
        // --- LAMELLEN PDF VORSCHAU ---
        window.openLamellenPdfPreview = async function () {
            if (!window.currentLamellenExportList || window.currentLamellenExportList.length === 0) {
                alert("Bitte konfigurieren und wählen Sie zuerst eine Ersatzlamelle in der Skizze aus.");
                return;
            }

            const settings = window.getPdfSettings('lamellen');
            const docHtml = document.getElementById('pdfDocument');
            let html = '';

            html += `<div style="display:flex; justify-content: space-between; border-bottom: 2px solid var(--hormann-blue); padding-bottom: 10px; margin-bottom: 20px;">
        <div>
            <h2 style="margin: 0; color: var(--hormann-blue); font-size: 18px;">Ersatzteile Sektionaltor</h2>
            <div style="font-size: 12px; color: #666;">Ersatzlamellen - Datum: ${new Date().toLocaleDateString()}</div>
        </div>
    </div>`;

            if (settings.project && settings.project.trim() !== "") html += `<div style="margin-bottom: 15px; font-size: 14px;"><strong>Bauvorhaben:</strong> ${settings.project}</div>`;

            if (settings.graphic !== false) {
                html += `<div style="text-align: center; margin-bottom: 20px; border: 1px solid #ddd; padding: 20px; background: #f9f9f9; border-radius: 4px;">
            <em style="color:#888; font-size: 0.9rem;">[ 🖼️ Die Skizze wird hier im finalen PDF hochauflösend eingefügt ]</em>
        </div>`;
            }

            html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead>
            <tr style="background: #f0f2f5; border-bottom: 2px solid #ccc;">
                <th style="padding: 8px; text-align: left;">Pos</th>
                ${settings.artnr !== false ? `<th style="padding: 8px; text-align: left;">Art.-Nr.</th>` : ''}
                <th style="padding: 8px; text-align: left;">Beschreibung</th>
                <th style="padding: 8px; text-align: center;">Menge</th>
                ${settings.ep !== false ? `<th style="padding: 8px; text-align: right;">Einzel</th>` : ''}
                ${settings.gp !== false ? `<th style="padding: 8px; text-align: right;">Gesamt</th>` : ''}
            </tr>
        </thead>
        <tbody>`;

            let sum = 0; let pos = 1;
            const markupFactor = (settings.markup && settings.markupVal > 0) ? (1 + (parseFloat(settings.markupVal) || 0) / 100) : 1;
            window.currentLamellenExportList.forEach(item => {
                let baseSingle = item.singlePrice;
                if (settings.discount) {
                    const d1 = Math.max(0, Math.min(100, parseFloat(settings.discount1) || 0));
                    const d2 = Math.max(0, Math.min(100, parseFloat(settings.discount2) || 0));
                    baseSingle = baseSingle * (1 - (d1 / 100)) * (1 - (d2 / 100));
                }
                let singlePrice = baseSingle * markupFactor;
                let totalPrice = item.qty * singlePrice;
                sum += totalPrice;
                html += `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${pos++}</td>
            ${settings.artnr !== false ? `<td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${item.artNr}</td>` : ''}
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${item.name}</strong><br><span style="color:#666; font-size:10px; white-space:pre-wrap;">${item.desc}</span></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
            ${settings.ep !== false ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatEur(singlePrice)}</td>` : ''}
            ${settings.gp !== false ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatEur(totalPrice)}</td>` : ''}
        </tr>`;
            });

            html += `</tbody></table>`;

            if (settings.gp !== false) {
                let netTotal = sum + (settings.freight !== false ? freightCost : 0);
                html += `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 20px; font-size: 13px;">
                    <div>Summe Positionen netto: <strong>${formatEur(sum)}</strong></div>`;
                if (settings.freight !== false) {
                    html += `<div>Fracht, Verpackung & Bearbeitung: <strong>${formatEur(freightCost)}</strong></div>`;
                }
                html += `<div style="font-weight: bold; margin-top: 4px; border-top: 1px solid #ccc; padding-top: 4px;">Gesamtbetrag netto: <span style="color: var(--hormann-blue); font-size: 15px;">${formatEur(netTotal)}</span></div>`;
                if (settings.vat) {
                    const vatAmount = netTotal * 0.19;
                    const grossTotal = netTotal + vatAmount;
                    html += `<div>+ 19 % MwSt.: <strong>${formatEur(vatAmount)}</strong></div>
                    <div style="font-weight: bold; font-size: 16px; color: #16a34a; border-top: 2px solid #16a34a; padding-top: 4px; margin-top: 4px;">Gesamtbetrag brutto: ${formatEur(grossTotal)}</div>`;
                }
                html += `</div>`;
            }

            if (settings.notes && settings.notes.trim() !== "") {
                html += `<div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; font-size: 12px; white-space: pre-wrap;">
            <strong>Bemerkungen:</strong><br>${settings.notes}
        </div>`;
            }

            docHtml.innerHTML = html;

            // Modal-Titel und Button-Funktion für Lamellen umstellen
            document.querySelector('#pdfPreviewModal h3').innerText = "📄 Druck-Vorschau (Ersatzlamellen)";
            const exportBtn = document.querySelector('#pdfPreviewModal .btn-calc[style*="background: #e74c3c"]');
            if (exportBtn) exportBtn.setAttribute('onclick', 'exportLamellenPDF(true)');

            document.getElementById('pdfPreviewModal').style.display = 'flex';
        };

        // --- LAMELLEN PDF EXPORT ---
        window.exportLamellenPDF = async function (fromPreview = false, mode = 'download') {
            if (!window.currentLamellenExportList || window.currentLamellenExportList.length === 0) {
                alert("Bitte konfigurieren und wählen Sie zuerst eine Ersatzlamelle aus."); return;
            }

            if (fromPreview) closePdfPreview();
            document.body.style.cursor = 'wait';
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            try {
                const settings = window.getPdfSettings('lamellen');

                doc.setFontSize(14); doc.setTextColor(0, 85, 150); doc.setFont("helvetica", "bold");
                doc.text("Ersatzteile Sektionaltor (Ersatzlamellen)", 14, 20);
                doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal");
                doc.text(`Datum: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.getWidth() - 14, 20, { align: "right" });

                let currentY = 32;

                if (settings.project && settings.project.trim() !== "") {
                    doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "bold");
                    doc.text(`Bauvorhaben: ${settings.project}`, 14, currentY);
                    doc.setFont("helvetica", "normal");
                    currentY += 10;
                }

                if (settings.graphic !== false) {
                    const visualElement = document.getElementById('lamellen-graphic-wrapper');
                    const canvas = await html2canvas(visualElement, {
                        scale: 2,
                        backgroundColor: '#ffffff',
                        logging: false
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);

                    const h = parseInt(document.getElementById('inputLamHeight').value) || 2125;
                    const rasterList = [1900, 2000, 2080, 2125, 2205, 2250, 2375, 2500, 2600, 2750, 2850, 3000];
                    let targetRaster = 3000;
                    for (let r of rasterList) { if (h <= r) { targetRaster = r; break; } }

                    let lamellenAnzahl = 4;
                    if (targetRaster >= 2850) lamellenAnzahl = 6;
                    else if (targetRaster >= 2375) lamellenAnzahl = 5;

                    if (lamellenAnzahl > 4) {
                        const pdfWidth = 115;
                        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                        doc.addImage(imgData, 'PNG', 14, currentY, pdfWidth, pdfHeight);

                        const warningX = 14 + pdfWidth + 8;
                        let warningY = currentY + 15;
                        const warnBoxW = 210 - warningX - 14;

                        doc.setFillColor(255, 243, 205);
                        doc.setDrawColor(230, 126, 34);
                        doc.setLineWidth(0.5);

                        const warnText = `Aufgrund der Torhöhe besteht das Tor aus ${lamellenAnzahl} Sektionen.\n\nDie Skizze dient daher nur als beispielhafte Orientierung und zeigt stets 4 Sektionen an.`;
                        doc.setFontSize(8);
                        const splitWarn = doc.splitTextToSize(warnText, warnBoxW - 6);
                        const warnBoxH = 10 + (splitWarn.length * 3.5);

                        doc.rect(warningX, warningY, warnBoxW, warnBoxH, 'FD');
                        doc.setTextColor(211, 84, 0);
                        doc.setFont("helvetica", "bold");
                        doc.text("Hinweis zur Skizze:", warningX + 3, warningY + 5);
                        doc.setTextColor(50, 50, 50);
                        doc.setFont("helvetica", "normal");
                        doc.text(splitWarn, warningX + 3, warningY + 10);

                        currentY += Math.max(pdfHeight, warnBoxH) + 10;
                    } else {
                        const pdfWidth = 130;
                        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                        const startX = (doc.internal.pageSize.getWidth() - pdfWidth) / 2;
                        doc.addImage(imgData, 'PNG', startX, currentY, pdfWidth, pdfHeight);
                        currentY += pdfHeight + 10;
                    }
                }

                let pos = 1; let sum = 0;
                const body = [];

                // Aufbau der Kopfzeile als Simple-Strings (Sicher gegen Abstürze!)
                let headRow = [];
                let dynamicColumnStyles = {};
                let colIdx = 0;

                headRow.push('Pos.');
                dynamicColumnStyles[colIdx++] = { halign: 'center', cellWidth: 12 };

                if (settings.artnr !== false) {
                    headRow.push('Art.-Nr.');
                    dynamicColumnStyles[colIdx++] = { cellWidth: 24 };
                }

                headRow.push('Beschreibung');
                dynamicColumnStyles[colIdx++] = { halign: 'left' };

                headRow.push('Menge');
                dynamicColumnStyles[colIdx++] = { halign: 'center', cellWidth: 16 };

                if (settings.ep !== false) {
                    headRow.push('Einzel');
                    dynamicColumnStyles[colIdx++] = { halign: 'right', cellWidth: 22 };
                }
                if (settings.gp !== false) {
                    headRow.push('Gesamt');
                    dynamicColumnStyles[colIdx++] = { halign: 'right', cellWidth: 22 };
                }

                const markupFactor = (settings.markup && settings.markupVal > 0) ? (1 + (parseFloat(settings.markupVal) || 0) / 100) : 1;
                window.currentLamellenExportList.forEach(item => {
                    let baseSingle = item.singlePrice;
                    if (settings.discount) {
                        const d1 = Math.max(0, Math.min(100, parseFloat(settings.discount1) || 0));
                        const d2 = Math.max(0, Math.min(100, parseFloat(settings.discount2) || 0));
                        baseSingle = baseSingle * (1 - (d1 / 100)) * (1 - (d2 / 100));
                    }
                    let singlePrice = baseSingle * markupFactor;
                    let totalPrice = item.qty * singlePrice;
                    sum += totalPrice;
                    let row = [pos++];
                    if (settings.artnr !== false) row.push(item.artNr);
                    row.push(`${item.name}\n${item.desc}`);
                    row.push(item.qty);
                    if (settings.ep !== false) row.push(formatEur(singlePrice));
                    if (settings.gp !== false) row.push(formatEur(totalPrice));
                    body.push(row);
                });

                doc.autoTable({
                    startY: currentY,
                    head: [headRow],
                    body: body,
                    theme: 'plain',
                    styles: { fontSize: 9, valign: 'middle', cellPadding: 2 },
                    columnStyles: dynamicColumnStyles,
                    headStyles: { fillColor: [245, 247, 250], textColor: [50, 50, 50], fontStyle: 'bold' },
                    bodyStyles: { fillColor: [255, 255, 255] },
                    didParseCell: function (data) {
                        // ERZWINGT DIE RECHTSBÜNDIGKEIT AUCH FÜR DIE ÜBERSCHRIFTEN!
                        if (data.section === 'head' && dynamicColumnStyles[data.column.index] && dynamicColumnStyles[data.column.index].halign) {
                            data.cell.styles.halign = dynamicColumnStyles[data.column.index].halign;
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.section === 'head') {
                            doc.setDrawColor(220, 220, 220);
                            doc.setLineWidth(0.5);
                            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                        }
                    }
                });

                currentY = doc.lastAutoTable.finalY + 15;

                if (settings.gp !== false) {
                    const rightMargin = doc.internal.pageSize.getWidth() - 14;
                    const textX = rightMargin - 30;

                    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
                    doc.text("Summe Positionen netto:", textX, currentY, { align: "right" });
                    doc.text(formatEur(sum), rightMargin, currentY, { align: "right" });
                    currentY += 6;

                    if (settings.freight !== false) {
                        doc.text("Fracht, Verpackung & Bearbeitung:", textX, currentY, { align: "right" });
                        doc.text(formatEur(freightCost), rightMargin, currentY, { align: "right" });
                        sum += freightCost;
                        currentY += 6;
                    }

                    doc.setDrawColor(220, 220, 220);
                    doc.line(rightMargin - 80, currentY - 3, rightMargin, currentY - 3);
                    currentY += 4;

                    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 85, 150);
                    doc.text("Gesamtbetrag netto:", textX, currentY, { align: "right" });
                    doc.text(formatEur(sum), rightMargin, currentY, { align: "right" });
                    currentY += 6;

                    if (settings.vat) {
                        const vatAmount = sum * 0.19;
                        const grossTotal = sum + vatAmount;
                        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
                        doc.text("+ 19 % MwSt.:", textX, currentY, { align: "right" });
                        doc.text(formatEur(vatAmount), rightMargin, currentY, { align: "right" });
                        currentY += 4;

                        doc.setDrawColor(220, 220, 220);
                        doc.line(rightMargin - 80, currentY - 2, rightMargin, currentY - 2);
                        currentY += 4;

                        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(22, 163, 74);
                        doc.text("Gesamtbetrag brutto:", textX, currentY, { align: "right" });
                        doc.text(formatEur(grossTotal), rightMargin, currentY, { align: "right" });
                        currentY += 6;
                    }

                    currentY += 10;
                }

                if (settings.notes && settings.notes.trim() !== "") {
                    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(50, 50, 50);
                    doc.text("Bemerkungen:", 14, currentY);
                    currentY += 6;
                    doc.setFont("helvetica", "normal");
                    const splitNotes = doc.splitTextToSize(settings.notes, doc.internal.pageSize.getWidth() - 28);
                    doc.text(splitNotes, 14, currentY);
                }

                let fileName = settings.project ? `Ersatzlamellen_${settings.project.replace(/[^a-z0-9]/gi, '_')}.pdf` : `Ersatzlamellen.pdf`;

                if (mode === 'email') {
                    await window.triggerPdfShare(doc.output('blob'), fileName);
                } else {
                    doc.save(fileName);
                }
            } catch (e) {
                console.error(e);
                alert("PDF Fehler: " + e.message);
            } finally {
                document.body.style.cursor = 'default';
            }
        };

        // Lädt die Einstellungen, sobald die Seite aufgebaut ist
        document.addEventListener('DOMContentLoaded', loadPdfSettings);

        // --- ZUSTANDS- UND FUNKTIONS-EXPOSURE FÜR KOLLABORATION MIT MODULES ---
        function resetConfiguratorState() {
            resetMarkersVisuals();
            calculatedList = [];
            currentViewList = [];
            isGraphicMode = false;
            
            const btnReset = document.getElementById('btnResetFilter');
            if (btnReset) btnReset.style.display = 'none';
            
            const resultContainer = document.getElementById('resultContainer');
            if (resultContainer) resultContainer.style.display = 'none';
            
            const btnPdf = document.getElementById('btnPdf');
            if (btnPdf) btnPdf.disabled = true;
            
            const btnPdfMail = document.getElementById('btnPdfMail');
            if (btnPdfMail) btnPdfMail.disabled = true;
            
            renderTable([]);
            
            const btnCalc = document.getElementById('btnCalculate');
            if (btnCalc) {
                btnCalc.classList.remove('dirty');
                btnCalc.innerText = "Berechnung starten";
                btnCalc.disabled = false;
            }
        }

        window.resetConfiguratorState = resetConfiguratorState;
        window.selectFittingRight = selectFittingRight;
        window.selectFittingLeft = (fit) => selectFittingRight(fit);
        window.resetGraphicFilter = resetGraphicFilter;
        window.resetMarkersVisuals = resetMarkersVisuals;
        window.renderTable = renderTable;
        window.updateListFromGraphic = updateListFromGraphic;

        window.currentViewList = currentViewList;
        window.calculatedList = calculatedList;
        window.currentSeries = currentSeries;
        window.currentFittingRight = currentFittingRight;
        window.currentFittingLeft = currentFittingLeft;

        Object.defineProperty(window, 'currentViewList', {
            get: () => currentViewList,
            set: (val) => { currentViewList = val; },
            configurable: true
        });
        Object.defineProperty(window, 'calculatedList', {
            get: () => calculatedList,
            set: (val) => { calculatedList = val; },
            configurable: true
        });
        Object.defineProperty(window, 'currentSeries', {
            get: () => currentSeries,
            set: (val) => { currentSeries = val; },
            configurable: true
        });
        Object.defineProperty(window, 'currentFittingRight', {
            get: () => currentFittingRight,
            set: (val) => { currentFittingRight = val; },
            configurable: true
        });
        Object.defineProperty(window, 'currentFittingLeft', {
            get: () => currentFittingRight,
            set: (val) => { currentFittingRight = val; },
            configurable: true
        });

        function initConfiguratorGraphic() {
            if (typeof renderDynamicGateGraphic === 'function') {
                renderDynamicGateGraphic();
            }
            if (typeof checkZConstraints === 'function') {
                checkZConstraints();
            }
        }
        window.initConfiguratorGraphic = initConfiguratorGraphic;

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(initConfiguratorGraphic, 50);
        } else {
            document.addEventListener('DOMContentLoaded', initConfiguratorGraphic);
        }
        window.addEventListener('load', initConfiguratorGraphic);


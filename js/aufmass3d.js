            let scene, camera, renderer, controls, garageGroup;
            let is3DActive = false;
            let calculatedProposals = [];
            let selectedProposalId = null;

            // --- NEU: EINGABE-BEGRENZUNG & SYNC LOGIK ---
            const requires4Digits = ['aufmassA', 'aufmassB', 'aufmassE1', 'aufmassE2', 'aufmassF1', 'aufmassF2', 'aufmassG'];

            const applyClamping = (input) => {
                let val = input.value.trim();
                const id = input.id.replace('quick_', '');
                
                const mainInput = document.getElementById(id) || input;
                
                if (requires4Digits.includes(id)) {
                    if (val.length > 4) {
                        val = val.slice(0, 4);
                        input.value = val;
                    }
                    if (val.length === 4) {
                        let num = parseInt(val);
                        let min = parseInt(mainInput.getAttribute('min'));
                        let max = parseInt(mainInput.getAttribute('max'));
                        if (!isNaN(max) && num > max) {
                            input.value = max;
                            val = String(max);
                        }
                        if (!isNaN(min) && num < min) {
                            input.value = min;
                            val = String(min);
                        }
                    }
                    if (val.length > 0 && val.length < 4) {
                        return false; // Skip update
                    }
                } else {
                    let maxValAttr = mainInput.getAttribute('max');
                    let maxLen = (maxValAttr && parseInt(maxValAttr) > 999) ? 4 : 3;
                    if (val.length > maxLen) {
                        val = val.slice(0, maxLen);
                        input.value = val;
                    }
                    let num = parseInt(val);
                    let max = parseInt(maxValAttr);
                    if (!isNaN(max) && num > max) {
                        input.value = max;
                        val = String(max);
                    }
                }
                return true;
            };
            window.aufmassApplyClamping = applyClamping; // Expose to other modules if needed

            function initClampingAndSync() {
                // Attach listeners to main inputs
                document.querySelectorAll('.spatial-input').forEach(input => {
                    // Initial validation/clamping on load
                    applyClamping(input);
                    validateMinMax(input);

                    input.addEventListener('input', (e) => {
                        const shouldUpdate = applyClamping(e.target);
                        const quickInput = document.getElementById('quick_' + e.target.id);
                        if (quickInput) quickInput.value = e.target.value;
                        
                        if (shouldUpdate && typeof window.handleInputChange === 'function') {
                            window.handleInputChange();
                        }
                    });
                    input.addEventListener('change', (e) => {
                        validateMinMax(e.target);
                        const quickInput = document.getElementById('quick_' + e.target.id);
                        if (quickInput) quickInput.value = e.target.value;
                        if (typeof window.handleInputChange === 'function') window.handleInputChange();
                    });
                });

                // --- QUICK-PANEL SYNC LOGIK ---
                const measureFields = ['aufmassA', 'aufmassB', 'aufmassC1', 'aufmassC2', 'aufmassD', 'aufmassG', 'aufmassE1', 'aufmassE2', 'aufmassF1', 'aufmassF2'];

                measureFields.forEach(id => {
                    const mainInput = document.getElementById(id);
                    const quickInput = document.getElementById('quick_' + id);
                    const pointKey = id.replace('aufmass', ''); // Zieht "A", "B" etc. aus der ID

                    if (mainInput && quickInput) {
                        quickInput.value = mainInput.value;

                        // 1. Wert synchronisieren
                        quickInput.addEventListener('input', (e) => {
                            const shouldUpdate = applyClamping(e.target);
                            mainInput.value = e.target.value;
                            if (shouldUpdate && typeof window.handleInputChange === 'function') {
                                window.handleInputChange();
                            }
                        });
                        quickInput.addEventListener('change', (e) => {
                            validateMinMax(e.target);
                            mainInput.value = e.target.value;
                            if (typeof window.handleInputChange === 'function') window.handleInputChange();
                        });

                        mainInput.addEventListener('input', (e) => { quickInput.value = e.target.value; });

                        // 2. Pfeil einfärben (3D Material)
                        const highlightArrow = (active) => {
                            if (window.measureArrows) {
                                window.measureArrows.forEach(arr => {
                                    if (arr.userData.pointKey === pointKey) {
                                        arr.children.forEach(child => {
                                            child.material.color.setHex(active ? 0xf1c40f : child.userData.originalColor);
                                        });
                                    }
                                });
                            }
                        };

                        // 3. Fokus synchronisieren (Gelber Rahmen im HTML + 3D Pfeil)
                        quickInput.addEventListener('focus', () => {
                            mainInput.classList.add('input-highlight');
                            highlightArrow(true);
                        });
                        quickInput.addEventListener('blur', () => {
                            mainInput.classList.remove('input-highlight');
                            highlightArrow(false);
                        });

                        mainInput.addEventListener('focus', () => {
                            quickInput.classList.add('input-highlight');
                            highlightArrow(true);
                        });
                        mainInput.addEventListener('blur', () => {
                            quickInput.classList.remove('input-highlight');
                            highlightArrow(false);
                        });
                    }
                    // Auto-Show Tor bei Bestätigung eines neuen Maßes
                    const autoShowDoor = () => {
                        const cb = document.getElementById('toggleDoorDetail');
                        if (cb && !cb.checked) {
                            if (typeof window.toggleMainDoor === 'function') {
                                window.toggleMainDoor(true);
                            }
                        }
                    };
                    if (mainInput) mainInput.addEventListener('change', autoShowDoor);
                    if (quickInput) quickInput.addEventListener('change', autoShowDoor);
                });
            }

            // Immediately run sync & clamping initialization on page load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initClampingAndSync);
            } else {
                initClampingAndSync();
            }


            const normSizes = [
                [2000, 2000], [2000, 2125], [2250, 2000], [2250, 2125],
                [2375, 2000], [2375, 2080], [2375, 2125], [2375, 2250],
                [2500, 2000], [2500, 2080], [2500, 2125], [2500, 2250],
                [2750, 2000], [2750, 2125], [2750, 2250],
                [3000, 2000], [3000, 2125], [3000, 2250],
                [3500, 2000], [3500, 2125], [3500, 2250],
                [4000, 2000], [4000, 2125], [4000, 2250],
                [4500, 2000], [4500, 2125], [4500, 2250],
                [5000, 2000], [5000, 2125], [5000, 2250]
            ];

            window.toggleMenu = function (menuId) {
                const menu = document.getElementById(menuId);
                const allMenus = document.querySelectorAll('.view-options');

                allMenus.forEach(m => {
                    if (m.id !== menuId) {
                        m.classList.remove('active');
                        m.parentElement.style.zIndex = '1'; // Andere Menüs nach hinten
                    }
                });

                const isActive = menu.classList.toggle('active');
                // Zwingt den Eltern-Container des aktiven Menüs ganz nach vorne
                menu.parentElement.style.zIndex = isActive ? '9999' : '1';

                // Sync classes on rightSidePanel
                const panel = document.getElementById('rightSidePanel');
                if (panel) {
                    const obstaclesActive = document.getElementById('obstacleMenuContent').classList.contains('active');
                    const settingsActive = document.getElementById('settingsOptions').classList.contains('active');

                    if (obstaclesActive) {
                        panel.classList.add('obstacles-open');
                    } else {
                        panel.classList.remove('obstacles-open');
                    }

                    if (settingsActive) {
                        panel.classList.add('settings-open');
                    } else {
                        panel.classList.remove('settings-open');
                    }
                }

                // Sync proposal menu state
                if (typeof window.syncSceneProposalMenuState === 'function') {
                    window.syncSceneProposalMenuState();
                }
            };

            window.toggleUIClass = function (className, isChecked) {
                const container = document.getElementById('sceneWrapper');
                if (isChecked) container.classList.add(className);
                else container.classList.remove(className);
            };


                      window.handleLabelToggles = function (source) {
                // 1. Elemente holen
                const cbShort = document.getElementById('cbShortLabels');
                const cbNoLabels = document.getElementById('cbNoLabels');
                const cbNoInputs = document.getElementById('cbNoInputs');
                const cbNoObstacles = document.getElementById('cbNoObstacles');
                const cbSketchMode = document.getElementById('cbSketchMode');
                const cbArrows = document.getElementById('toggleArrows'); // Maßpfeile ausblenden

                const labelCbShort = document.getElementById('labelCbShort');
                const labelCbNoLabels = document.getElementById('labelCbNoLabels');
                const labelCbNoInputs = document.getElementById('labelCbNoInputs');
                const labelCbNoObstacles = document.getElementById('labelCbNoObstacles');
                const labelToggleArrows = document.getElementById('labelToggleArrows');

                // Sicherheitsabbruch, falls IDs im HTML fehlen
                if (!cbShort || !cbNoLabels || !cbNoInputs) return;

                // 2. Ausfallsicheren Speicher im Window-Objekt anlegen
                if (typeof window.savedLabelState === 'undefined') {
                    window.savedLabelState = { 
                        short: false, 
                        noLabels: false, 
                        noInputs: false, 
                        noObstacles: false, 
                        arrows: false 
                    };
                }

                let needs3DUpdate = false;

                // 3. Haupt-Logik für das Schalten und Merken (Skizzenmodus)
                if (source === 'sketchMode') {
                    if (cbSketchMode.checked) {
                        // Zustand VOR dem Ausblenden merken
                        window.savedLabelState.short = cbShort.checked;
                        window.savedLabelState.noLabels = cbNoLabels.checked;
                        window.savedLabelState.noInputs = cbNoInputs.checked;
                        if (cbNoObstacles) window.savedLabelState.noObstacles = cbNoObstacles.checked;
                        if (cbArrows) window.savedLabelState.arrows = cbArrows.checked;

                        // Alles ausblenden
                        cbNoLabels.checked = true;
                        cbNoInputs.checked = true;
                        if (cbNoObstacles) {
                            cbNoObstacles.checked = true;
                            needs3DUpdate = true;
                        }
                        if (cbArrows) {
                            cbArrows.checked = true; // Haken rein -> Maßpfeile ausblenden!
                            needs3DUpdate = true;
                        }
                    } else {
                        // Alten Zustand wiederherstellen
                        cbShort.checked = window.savedLabelState.short;
                        cbNoLabels.checked = window.savedLabelState.noLabels;
                        cbNoInputs.checked = window.savedLabelState.noInputs;
                        if (cbNoObstacles) {
                            cbNoObstacles.checked = window.savedLabelState.noObstacles;
                            needs3DUpdate = true;
                        }
                        if (cbArrows) {
                            cbArrows.checked = window.savedLabelState.arrows;
                            needs3DUpdate = true;
                        }
                    }
                }
                else if (source === 'noLabels') {
                    if (!cbNoLabels.checked && cbSketchMode) {
                        cbSketchMode.checked = false;
                    }
                }
                else if (source === 'noInputs') {
                    if (!cbNoInputs.checked && cbSketchMode) {
                        cbSketchMode.checked = false;
                    }
                }
                else if (source === 'noObstacles') {
                    needs3DUpdate = true;
                    if (cbNoObstacles && !cbNoObstacles.checked && cbSketchMode) {
                        cbSketchMode.checked = false;
                    }
                }

                // 4. Optisches Ausgrauen der gesperrten Labels
                const isSketchActive = !!(cbSketchMode && cbSketchMode.checked);
                
                if (isSketchActive || cbNoLabels.checked) {
                    cbShort.disabled = true;
                    if (labelCbShort) labelCbShort.style.opacity = '0.5';
                } else {
                    cbShort.disabled = false;
                    if (labelCbShort) labelCbShort.style.opacity = '1';
                }

                // Elemente sperren, wenn Skizzen-Modus aktiv ist
                if (cbSketchMode) {
                    cbNoLabels.disabled = isSketchActive;
                    if (labelCbNoLabels) labelCbNoLabels.style.opacity = isSketchActive ? '0.5' : '1';
                    
                    cbNoInputs.disabled = isSketchActive;
                    if (labelCbNoInputs) labelCbNoInputs.style.opacity = isSketchActive ? '0.5' : '1';

                    if (cbNoObstacles) {
                        cbNoObstacles.disabled = isSketchActive;
                        if (labelCbNoObstacles) labelCbNoObstacles.style.opacity = isSketchActive ? '0.5' : '1';
                    }

                    if (cbArrows) {
                        cbArrows.disabled = isSketchActive;
                        if (labelToggleArrows) labelToggleArrows.style.opacity = isSketchActive ? '0.5' : '1';
                    }
                }

                // 5. CSS-Klassen in der 3D-Ansicht anwenden
                if (typeof window.toggleUIClass === 'function') {
                    window.toggleUIClass('hide-label-text', cbShort.checked || cbNoLabels.checked);
                    window.toggleUIClass('hide-all-labels', cbNoLabels.checked);
                    window.toggleUIClass('hide-inputs', cbNoInputs.checked);
                }

                // 6. 3D-Ansicht aktualisieren
                if (typeof update3D === 'function') {
                    update3D();
                }
            };

            window.toggleFullscreen = function () {
                const elem = document.getElementById('sceneWrapper');
                if (!document.fullscreenElement) {
                    if (elem.requestFullscreen) elem.requestFullscreen();
                    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
                } else {
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    else if (document.msExitFullscreen) document.msExitFullscreen();
                }
            };

            document.addEventListener('fullscreenchange', () => {
                const fsBtn = document.getElementById('fsBtn');
                if (fsBtn) fsBtn.innerHTML = document.fullscreenElement ? '✖ Schließen' : '⛶ Vollbild';
            });

            // --- 1. Funktion toggleMontageUI() komplett ersetzen ---
            function toggleMontageUI() {
                const montageEl = document.getElementById('aufmassMontage');
                const montageValue = montageEl ? montageEl.value : 'hinter';
                const isHinter = montageValue === 'hinter';
                const isKlinker = montageValue === 'in_klinker';
                const klinkerControls = document.getElementById('aufmassKlinkerControls');
                if (klinkerControls) klinkerControls.style.display = isKlinker ? 'block' : 'none';

                // 3D-Skizzen Labels
                document.querySelectorAll('.input-node').forEach(node => {
                    const point = node.getAttribute('data-point');
                    if (point === 'C1' || point === 'C2' || point === 'D') {
                        node.style.display = isHinter ? 'block' : 'none';
                    }
                });

                // Quick-Panel Zeilen
                document.querySelectorAll('.quick-input-row').forEach(row => {
                    const point = row.getAttribute('data-point');
                    if (point === 'C1' || point === 'C2' || point === 'D') {
                        row.style.display = isHinter ? 'flex' : 'none';
                    }
                });
            }

            window.getBenoetigteEinschubtiefe = function (bestellmassHoehe, beschlagTypKurz, isAntrieb) {
                if (isAntrieb) {
                    if (beschlagTypKurz === 'N') {
                        if (bestellmassHoehe <= 2250) return 3200;
                        if (bestellmassHoehe <= 2500) return 3450;
                        return 4125;
                    } else {
                        if (bestellmassHoehe <= 2125) return 3200;
                        if (bestellmassHoehe <= 2375) return 3450;
                        return 4125;
                    }
                } else {
                    if (beschlagTypKurz === 'N' || beschlagTypKurz === 'Z') return bestellmassHoehe + 510;
                    else return bestellmassHoehe + 750;
                }
            };

            window.validate3DConstraints = function () {
                const isAntrieb = document.getElementById('aufmassBedienung').value === 'antrieb';
                const warnContainer = document.getElementById('aufmassWarningContainer');
                if (!warnContainer) return;

                let warnings = [];
                let errorFields = new Set();

                const getVal = (id) => parseFloat(document.getElementById(id) ? document.getElementById(id).value : 0) || 0;

                const valA = getVal('aufmassA');
                const valB = getVal('aufmassB');
                const valC1 = getVal('aufmassC1');
                const valC2 = getVal('aufmassC2');
                const valD = getVal('aufmassD');
                const valG = getVal('aufmassG');

                const valE1 = getVal('aufmassE1');
                const valE2 = getVal('aufmassE2') > 0 ? getVal('aufmassE2') : valE1;
                const valF1 = getVal('aufmassF1');
                const valF2 = getVal('aufmassF2') > 0 ? getVal('aufmassF2') : valF1;

                // A. Tiefe (G) prüfen
                const minDepth = window.getBenoetigteEinschubtiefe ? window.getBenoetigteEinschubtiefe(valB, 'Z', isAntrieb) : valB + 1000;
                if (valG > 0 && valG < minDepth) {
                    warnings.push(`⚠️ Garagentiefe G (${valG} mm) zu gering! Benötigt: ${minDepth} mm.`);
                    errorFields.add('aufmassG');
                }

                // B. Raumhöhe (F1, F2) - Reine Logik prüfen (Kein Platzmangel-Check mehr)
                if (valF1 > 0) {
                    if (valF1 < valB) {
                        warnings.push(`🚨 LOGIK-FEHLER: Die Raumhöhe Vorn (F1: ${valF1} mm) kann nicht niedriger sein als die lichte Toröffnung (B: ${valB} mm)! *Hinweis: Falls hier ein Deckenbalken/Unterzug im Weg ist, tragen Sie bitte die volle Deckenhöhe bei F1/F2 ein und fügen Sie den Unterzug links im Menü unter 'Hindernisse' hinzu.*`);
                        errorFields.add('aufmassF1');
                        errorFields.add('aufmassB');
                    }
                }
                
                const rawF2 = document.getElementById('aufmassF2') ? document.getElementById('aufmassF2').value.trim() : "";
                if (rawF2 !== "") {
                    const valF2Num = parseFloat(rawF2) || 0;
                    if (valF2Num > 0 && valF2Num < valB) {
                        warnings.push(`🚨 LOGIK-FEHLER: Die Raumhöhe Hinten (F2: ${valF2Num} mm) kann nicht niedriger sein als die Toröffnung (B: ${valB} mm)!`);
                        errorFields.add('aufmassF2');
                    }
                }

                // C. Raumbreite (E1, E2) prüfen
                if (valE1 > 0 && valE1 < valA) {
                    warnings.push(`🚨 LOGIK-FEHLER: Deckenbreite Vorn (E1: ${valE1} mm) ist kleiner als die Torbreite A (${valA} mm). Einbau unmöglich!`);
                    errorFields.add('aufmassE1');
                }
                const rawE2 = document.getElementById('aufmassE2') ? document.getElementById('aufmassE2').value.trim() : "";
                if (rawE2 !== "") {
                    const valE2Num = parseFloat(rawE2) || 0;
                    if (valE2Num > 0 && valE2Num < valA) {
                        warnings.push(`🚨 LOGIK-FEHLER: Deckenbreite Hinten (E2: ${valE2Num} mm) ist kleiner als die Torbreite A (${valA} mm). Einbau unmöglich!`);
                        errorFields.add('aufmassE2');
                    }
                }

                // --- 2. In validate3DConstraints() den CSS-Farben-Block ersetzen ---
                // CSS FARBEN ZUWEISEN (Inkl. Quick-Panel Sync)
                const allInputs = ['aufmassA', 'aufmassC1', 'aufmassC2', 'aufmassG', 'aufmassE1', 'aufmassE2', 'aufmassF1', 'aufmassF2', 'aufmassB', 'aufmassD'];
                allInputs.forEach(id => {
                    const el = document.getElementById(id);
                    const quickEl = document.getElementById('quick_' + id);

                    if (el) {
                        if (errorFields.has(id)) {
                            el.classList.add('input-error');
                            if (quickEl) quickEl.classList.add('input-error');
                        } else {
                            el.classList.remove('input-error');
                            if (quickEl) quickEl.classList.remove('input-error');
                        }
                    }
                });

                // WARNUNGEN ANZEIGEN
                if (warnings.length > 0) {
                    warnContainer.innerHTML = `<div style="background: rgba(220, 53, 69, 0.95); color: white; padding: 10px; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid #ff4d4d; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 6px;">
            ${warnings.map(w => `<span>${w}</span>`).join('')}
        </div>`;
                } else {
                    warnContainer.innerHTML = '';
                }
            };

            window.selectProposal = function (id) {
                selectedProposalId = id;
                renderProposals();
                update3D();
            };

            function renderProposals() {
                const container = document.getElementById('aufmassResultContainer');
                const sceneMenu = document.getElementById('sceneProposalMenu');
                const sceneList = document.getElementById('sceneProposalList');

                let html = '';
                let sceneHtml = '';

                const showReductions = window.obstacleDeductionIsRelevant || window.roomKompensationIsActive;

                if (showReductions) {
                    let heightReductionInfo = "";
                    let sceneHeightReductionInfo = "";

                    if (typeof window.lastAlertMessages !== 'undefined') {
                        const heightMsg = window.lastAlertMessages.find(m => m.includes("ermittelte Torhöhe") && m.includes("reduziert"));
                        if (heightMsg) {
                            heightReductionInfo = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(239, 68, 68, 0.3); font-weight: bold; color: #b91c1c; font-size: 0.85rem;">💡 Hinweis: ${heightMsg}</div>`;
                            if (window.bestProposalHeightBeforeDeductions && typeof calculatedProposals !== 'undefined' && calculatedProposals.length > 0) {
                                sceneHeightReductionInfo = `<span style="font-weight: bold; color: #f87171; margin-top: 2px; font-size: 0.7rem;">💡 Torhöhe verringert: ${window.bestProposalHeightBeforeDeductions}mm ➔ ${calculatedProposals[0].h}mm</span>`;
                            }
                        }
                    }

                    html += `
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.3); color: #7f1d1d; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 8px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight: bold;">
                <span>⚠️ Einschränkungen &amp; Platzreduzierungen aktiv</span>
                <button onclick="window.showObstacleDeductionModal()" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; margin-left: auto;">Detail-Erklärung</button>
            </div>
            <span>Einige Einbaumaße wurden aufgrund der platzierten Hindernisse (Unterzüge, Rohre) oder unzureichender Raummaße automatisch reduziert. Die Torauswahl basiert auf den verbleibenden nutzbaren Netto-Maßen.${heightReductionInfo}</span>
        </div>`;
                    
                    sceneHtml += `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fecaca; padding: 8px; border-radius: 4px; font-size: 0.75rem; margin-bottom: 8px; text-align: left; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-weight: bold; color: #f87171;">⚠️ Platzreduzierung aktiv</span>
            <span>Maße wurden durch Hindernisse oder Raumgrenzen reduziert.</span>${sceneHeightReductionInfo}
            <button onclick="window.showObstacleDeductionModal()" style="background: #ef4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 0.65rem; cursor: pointer; font-weight: bold; align-self: flex-start; margin-top: 2px;">Details</button>
        </div>`;
                }

                if (window.lastWarnG) {
                    html += window.lastWarnG;
                }

                if (window.largeOverlapWarning) {
                    html += window.largeOverlapWarning;
                }

                if (window.lpuAlternativePossible) {
                    const currentSicke = document.getElementById('aufmassSicke') ? document.getElementById('aufmassSicke').value : "";
                    const currentObf = document.getElementById('aufmassOberflaeche') ? document.getElementById('aufmassOberflaeche').value : "";
                    const isRM_M_Planar = (currentSicke === 'M' && currentObf === 'Planar');
                    const noticeText = isRM_M_Planar ? " <b>(Hinweis: Bei LPU ist dies in dieser Größe jedoch nur in L-Sicke möglich!)</b>" : "";

                    html += `
        <div style="background: rgba(2, 132, 199, 0.06); border: 1px solid rgba(2, 132, 199, 0.35); color: #1e293b; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 8px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 8px; color: #0284c7; font-weight: bold;">
                <span>💡 LPU Tortyp möglich</span>
            </div>
            <span style="color: #334155; line-height: 1.4;">Mit dem flexibleren <b>LPU 42 Standard-Modell</b> ist eine Konfiguration bei diesen Maßen möglich!${noticeText}</span>
            <button onclick="window.switchToLpuModel()" style="background: #0284c7; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; transition: all 0.2s; align-self: flex-start; margin-top: 4px;"
                onmouseover="this.style.background='#0369a1'"
                onmouseout="this.style.background='#0284c7'">
                Sollen wir diesen Tortypen auswählen?
            </button>
        </div>`;

                    sceneHtml += `
        <div style="color: #f1f5f9; font-size: 0.8rem; line-height: 1.4; display: flex; flex-direction: column; gap: 8px; padding: 4px;">
            <div style="display: flex; align-items: center; gap: 6px; color: #38bdf8; font-weight: bold; font-size: 0.85rem;">
                <span>💡 LPU möglich</span>
            </div>
            <span>Mit dem flexibleren <b>LPU 42 Modell</b> konfigurierbar!${noticeText}</span>
            <button onclick="window.switchToLpuModel()" style="background: #38bdf8; color: #0f172a; border: none; padding: 6px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; transition: all 0.2s; width: 100%; text-align: center; margin-top: 4px;"
                onmouseover="this.style.background='#0284c7'; this.style.color='#ffffff'"
                onmouseout="this.style.background='#38bdf8'; this.style.color='#0f172a'">
                Zu LPU wechseln
            </button>
        </div>`;
                }

                if (typeof calculatedProposals === 'undefined' || calculatedProposals.length === 0) {
                    html += '<p style="color:#e74c3c; text-align:center; padding: 20px 0; font-weight:bold;">Kein passendes Tor ermittelt.</p>';
                    if (container) container.innerHTML = html;
                    
                    if ((window.lpuAlternativePossible || (window.lastObstacleDeductions && window.lastObstacleDeductions.length > 0)) && sceneList && sceneMenu) {
                        sceneList.innerHTML = sceneHtml;
                        sceneMenu.style.display = 'block';
                    } else {
                        if (sceneMenu) sceneMenu.style.display = 'none';
                    }
                    return;
                }

                calculatedProposals.forEach(p => {
                    const isActive = p.id === selectedProposalId;

                    // 1. Listenansicht unten
                    html += `
        <div class="proposal-item ${isActive ? 'active' : ''}" onclick="window.selectProposal('${p.id}')">
            <div class="custom-radio"></div>
            <div class="proposal-text-content">
                <span class="proposal-title">${p.title}</span>
                <span class="proposal-size">Bestellmaß: <b>${p.w} x ${p.h} mm</b> (${p.type})</span>
            </div>
        </div>`;

                    // 2. Overlay-Menü in der 3D-Ansicht
                    sceneHtml += `
        <button class="scene-proposal-btn ${isActive ? 'active' : ''}" onclick="window.selectProposal('${p.id}')">
            <span class="sp-title">${p.title}</span>
            <span class="sp-size">${p.w} x ${p.h} mm</span>
        </button>`;
                });

                if (container) container.innerHTML = html;

                if (sceneList && sceneMenu) {
                    sceneList.innerHTML = sceneHtml;
                    sceneMenu.style.display = 'block';
                }
            }

            function init3D() {
                if (is3DActive) return;
                const container = document.getElementById('garage3DCanvas');
                if (!container || container.clientWidth === 0) return;

                scene = new THREE.Scene();
                // Sichtweite (far plane) von 15000 auf 30000 erhöht, um das Abschneiden zu verhindern
                camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 50, 30000);
                camera.position.set(0, 1500, -4500);
                camera.lookAt(0, 1000, 0);

                if (!scene.userData.lightsAdded) {
                    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                    scene.add(ambientLight);
                    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
                    dirLight.position.set(2000, 3000, 4000);
                    scene.add(dirLight);
                    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
                    dirLight2.position.set(-2000, 2000, -4000);
                    scene.add(dirLight2);
                    scene.userData.lightsAdded = true;
                }

                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setSize(container.clientWidth, container.clientHeight);
                container.appendChild(renderer.domElement);
                
                // Add obstacle mouse listeners!
                renderer.domElement.addEventListener('pointermove', onPointerMove);
                renderer.domElement.addEventListener('pointerdown', onPointerDown);
                renderer.domElement.addEventListener('pointerup', onPointerUp);

                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.maxPolarAngle = Math.PI / 2 + 0.35;

                // NEU: Begrenzung des Zooms
                controls.maxDistance = 16000; // Verhindert extremes Herauszoomen ins Nichts
                controls.minDistance = 800;   // Verhindert das Durchscrollen durch die vordere Wand

                garageGroup = new THREE.Group();
                scene.add(garageGroup);

                const resizeObserver = new ResizeObserver(() => {
                    if (container.clientWidth > 0 && camera && renderer) {
                        camera.aspect = container.clientWidth / container.clientHeight;
                        camera.updateProjectionMatrix();
                        renderer.setSize(container.clientWidth, container.clientHeight);
                    }
                });
                resizeObserver.observe(container);

                const montageSelect = document.getElementById('aufmassMontage');
                if (montageSelect) {
                    montageSelect.addEventListener('change', () => {
                        toggleMontageUI();
                        handleInputChange();
                    });
                }

                is3DActive = true;
                toggleMontageUI();

                // 1. Erst alle Maße initial berechnen lassen
                handleInputChange();

                // 2. NEU: Direkt die dynamische "Von Hinten" Ansicht erzwingen, 
                // exakt so, als hätte man den Button geklickt.
                if (typeof setCameraView === 'function') {
                    setCameraView('back');
                }
                // ------------------------------

                // 3. Dann die Animation/das Rendering starten
                animate();
                
                // Hindernisse UI initialisieren
                if (typeof window.renderObstacleListUI === 'function') {
                    window.renderObstacleListUI();
                }
            }

            window.handleInputChange = function () {
                toggleMontageUI();
                calculateAufmass();
                update3D();
            }

            window.normalizeKlinkerInputs = function () {
                ['aufmassKlinkerL', 'aufmassKlinkerR'].forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const value = parseInt(el.value, 10);
                    if (Number.isNaN(value) || value < 20) {
                        el.value = 20;
                    }
                });
                handleInputChange();
            }

            window.setCameraView = function (viewType) {
                if (!camera || !controls) return;
                const v = getVisualVars();

                // 1. Blickziel: Kamera guckt immer exakt auf halbe Torhöhe
                const targetY = v.B / 2;
                controls.target.set(0, targetY, 0);

                // 2. Dynamische Distanzen (Der intelligente Zoom)
                // Vorne/Hinten: Je breiter das Tor (A), desto weiter weg
                const distZ = Math.max(5000, v.A * 2.1);

                // Seite: Je tiefer die Garage (G) UND je breiter das Tor (A), desto weiter weg
                const distX = Math.max(6000, (v.G * 1.5) + (v.A * 0.8));

                switch (viewType) {
                    case 'front':
                        camera.position.set(0, targetY + 200, distZ);
                        break;
                    case 'back':
                        camera.position.set(0, targetY + 200, -distZ);
                        break;
                    case 'left':
                        camera.position.set(distX, targetY + 200, 0);
                        break;
                    case 'right':
                        camera.position.set(-distX, targetY + 200, 0);
                        break;
                    case 'top':
                        camera.position.set(0, Math.max(6000, v.G * 2.0), 0.1);
                        break;
                }

                controls.update();

                // Kameramenü wieder einklappen
                const menu = document.getElementById('cameraViewOptions');
                if (menu) menu.classList.remove('active');
            };

            function validateMinMax(input) {
                const id = input.id.replace('quick_', '');
                const mainInput = document.getElementById(id) || input;
                const isOptional = mainInput.getAttribute('placeholder') === 'opt.';

                if (input.value === "") {
                    if (!isOptional) {
                        let minAttr = mainInput.getAttribute('min');
                        if (minAttr !== null && minAttr !== "") {
                            input.value = minAttr;
                        } else {
                            if (id === 'aufmassA' || id === 'aufmassB') input.value = "1500";
                            else if (id === 'aufmassG') input.value = "2000";
                            else input.value = "0";
                        }
                    }
                    return;
                }
                
                let val = parseInt(input.value);
                let min = parseInt(mainInput.getAttribute('min'));
                let max = parseInt(mainInput.getAttribute('max'));
                if (!isNaN(min) && val < min) input.value = min;
                if (!isNaN(max) && val > max) input.value = max;
            }

            function animate() {
                requestAnimationFrame(animate);
                if (controls) controls.update();
                updateSpatialPositions();
                if (renderer && scene && camera) renderer.render(scene, camera);
            }

            function getVisualVars() {
                // Liste der IDs, die 4 Ziffern benötigen
                const requires4Digits = ['aufmassA', 'aufmassB', 'aufmassE1', 'aufmassE2', 'aufmassF1', 'aufmassF2', 'aufmassG'];

                const getVal = (id, def) => {
                    const el = document.getElementById(id);
                    if (!el || el.value === "") return def;

                    const valStr = el.value.trim();

                    // Wenn die Eingabe 1-3 stellig ist, frieren wir den Wert für die Grafik ein, 
                    // indem wir den letzten gültigen Wert (lastValid) laden.
                    if (requires4Digits.includes(id) && valStr.length > 0 && valStr.length < 4) {
                        return el.dataset.lastValid ? parseFloat(el.dataset.lastValid) : def;
                    }

                    const v = parseFloat(valStr);
                    if (!isNaN(v)) {
                        el.dataset.lastValid = v; // Gültigen Wert als Fallback für später merken
                        return v;
                    }
                    return def;
                };

                const getOpt = (id) => {
                    const el = document.getElementById(id);
                    if (!el || el.value === "") return NaN;

                    const valStr = el.value.trim();
                    if (requires4Digits.includes(id) && valStr.length > 0 && valStr.length < 4) {
                        return el.dataset.lastValid ? parseFloat(el.dataset.lastValid) : NaN;
                    }

                    const v = parseFloat(valStr);
                    if (!isNaN(v)) {
                        el.dataset.lastValid = v;
                        return v;
                    }
                    return NaN;
                };

                const montageEl = document.getElementById('aufmassMontage');
                const montageValue = montageEl ? montageEl.value : 'hinter';
                const isHinter = montageValue === 'hinter';
                const isKlinker = montageValue === 'in_klinker';

                let A = getVal('aufmassA', 2500);
                let B = getVal('aufmassB', 2125);
                let G = getVal('aufmassG', 4000);
                let C1 = isHinter ? getVal('aufmassC1', 90) : 0;
                let C2 = isHinter ? getVal('aufmassC2', 90) : 0;
                let D = isHinter ? getVal('aufmassD', 115) : 0;

                let rawE1 = getOpt('aufmassE1');
                let rawE2 = getOpt('aufmassE2');
                let rawF1 = getOpt('aufmassF1');
                let rawF2 = getOpt('aufmassF2');

                A = Math.max(1500, A);

                let F1 = isNaN(rawF1) ? (B + D) : Math.max(B + D, rawF1);
                let F2 = isNaN(rawF2) ? F1 : Math.max(0, rawF2);
                let E1 = isNaN(rawE1) ? (A + C1 + C2) : Math.max(0, rawE1);
                let E2 = isNaN(rawE2) ? E1 : Math.max(0, rawE2);
                let K1 = isKlinker ? Math.max(20, getVal('aufmassKlinkerL', 50)) : 0;
                let K2 = isKlinker ? Math.max(20, getVal('aufmassKlinkerR', 50)) : 0;
                let KO = isKlinker ? getVal('aufmassKlinkerO', 50) : 0;

                return { A, B, C1, C2, D, G, F1, F2, E1, E2, isHinter, isKlinker, K1, K2, KO };
            }

            function getPointCoords(key) {
                const v = getVisualVars();
                const visCenter = (v.C1 - v.C2) / 2;

                // Holt sich Live-Werte vom Slider (falls das Tool existiert)
                const offset = (window.debugOffsets && window.debugOffsets[key]) ? window.debugOffsets[key] : { x: 0, y: 0, z: 0 };

                let baseVec;
                switch (key) {
                    case 'A':
                        baseVec = new THREE.Vector3(v.A * 0.3, 600, v.G / 2);
                        break;
                    case 'B':
                        baseVec = new THREE.Vector3(-v.A * 0.35 - 99, v.B * 0.6, v.G / 2);
                        break;
                    case 'C1':
                        baseVec = new THREE.Vector3(v.A / 2 + v.C1 / 2, 200, v.G / 2);
                        break;
                    case 'C2':
                        baseVec = new THREE.Vector3(-(v.A / 2 + v.C2 / 2), 200, v.G / 2);
                        break;
                    case 'D':
                        baseVec = new THREE.Vector3(667, v.B + (v.D * 0.5), v.G / 2);
                        break;
                    case 'G':
                        baseVec = new THREE.Vector3((visCenter + v.E1 / 2) + 150, v.F1 * 0.35, 0);
                        break;
                    case 'E1':
                        baseVec = new THREE.Vector3((visCenter + v.E1 / 2) * 0.5 - 889, v.F1 + 150 - 211, v.G / 2 - 815);
                        break;
                    case 'F1':
                        baseVec = new THREE.Vector3((visCenter - v.E1 / 2) - 450 + 469, v.F1 * 0.6 + 446, v.G / 2 - 593);
                        break;
                    case 'E2':
                        baseVec = new THREE.Vector3((visCenter - v.E2 / 2) * 0.5, v.F2 - 150, -v.G / 2 + 642);
                        break;
                    case 'F2':
                        baseVec = new THREE.Vector3((visCenter - v.E2 / 2) + 250 - 222, v.F2 * 0.4 + 480, -v.G / 2 + 1235);
                        break;
                    default:
                        baseVec = new THREE.Vector3(0, 0, 0);
                }

                // Addiert die Live-Verschiebung aus dem Editor dazu!
                baseVec.x += offset.x;
                baseVec.y += offset.y;
                baseVec.z += offset.z;

                return baseVec;
            }

            function updateSpatialPositions() {
                const container = document.getElementById('garage3DCanvas');
                if (!container) return;
                const halfW = container.clientWidth / 2;
                const halfH = container.clientHeight / 2;

                // Weich ausblenden/einblenden basierend auf placementMode
                if (window.globalOpacityScale === undefined) window.globalOpacityScale = 1.0;
                if (window.placementMode) {
                    window.globalOpacityScale = Math.max(0, window.globalOpacityScale - 0.1);
                } else {
                    window.globalOpacityScale = Math.min(1, window.globalOpacityScale + 0.1);
                }

                // 1. Blickrichtung der Kamera in der 3D-Welt ermitteln
                const dir = new THREE.Vector3();
                camera.getWorldDirection(dir);

                // 2. Ansichts-Gewichtungen berechnen (0 = unsichtbar, 1 = voll sichtbar)
                // Der Multiplikator (* 1.5) sorgt dafür, dass die Elemente etwas schneller 100% 
                // erreichen und es beim Drehen einen schönen, fließenden Übergang gibt.
                const boost = (val) => Math.min(1, Math.max(0, val * 1.5));

                const frontW = boost(Math.max(0, -dir.z)); // Blick von Vorne
                const backW = boost(Math.max(0, dir.z));   // Blick von Hinten (Innenansicht)
                const sideW = boost(Math.abs(dir.x));      // Seitenansicht (Links oder Rechts)
                const topW = boost(Math.max(0, -dir.y));   // Draufsicht

                document.querySelectorAll('.input-node').forEach(node => {
                    if (node.style.display === 'none') return;
                    const pointKey = node.getAttribute('data-point');
                    if (!pointKey) return;

                    const p = getPointCoords(pointKey);
                    p.project(camera);

                    const x = (p.x * halfW) + halfW;
                    const y = -(p.y * halfH) + halfH;

                    const input = node.querySelector('.spatial-input');
                    const label = node.querySelector('.spatial-label');

                    if (input && label) {
                        input.style.left = `${x - 25}px`;
                        input.style.top = `${y - 11}px`;
                        label.style.left = `${x - 25}px`;
                        label.style.top = `${y - 25}px`;

                        // 3. Dein exaktes Regelwerk anwenden!
                        let currentOpacity = 0;

                        // Regel 1: Nur Breite (A) und Höhe (B) sind von Vorne UND Hinten sichtbar
                        if (['A', 'B'].includes(pointKey)) {
                            currentOpacity = Math.max(frontW, backW);
                        }
                        // Regel 2: Alle anderen (C1, C2, D, E1, E2, F1, F2, G) sind NUR von Hinten (Innenansicht) sichtbar
                        else {
                            currentOpacity = backW;
                        }

                        // Regel 3: Sobald man von oben guckt (topW), wird generell alles ausgeblendet!
                        // (Selbst wenn man manuell mit der Maus die Kamera nach oben zieht)
                        currentOpacity = currentOpacity * (1 - topW);

                        // Sicherheits-Check: Befindet sich der Punkt hinter der Kamera?
                        if (p.z > 1) {
                            currentOpacity = 0;
                        } else if (input.classList.contains('input-error')) {
                            // Wenn ein Fehlerfeld existiert, wird es IMMER eingeblendet
                            currentOpacity = Math.max(currentOpacity, 0.85);
                        }

                        // 4. Transparenz (Fading) zuweisen
                        let finalOpacity = currentOpacity * window.globalOpacityScale;
                        input.style.opacity = finalOpacity;
                        label.style.opacity = finalOpacity;

                        // NEU: Den 3D-Pfeil exakt synchron mit den Texten ein- und ausblenden!
                        if (window.measureArrows) {
                            window.measureArrows.forEach(arr => {
                                if (arr.userData.pointKey === pointKey) {
                                    arr.children.forEach(child => {
                                        child.material.opacity = finalOpacity;
                                    });
                                    // Pfeil komplett abschalten, wenn er unsichtbar wird (bessere Performance)
                                    arr.visible = finalOpacity > 0.05;
                                }
                            });
                        }

                        // 5. Verhindern, dass man auf unsichtbare Inputs klickt
                        input.style.pointerEvents = finalOpacity > 0.15 ? 'auto' : 'none';
                    }
                });

                // Maßketten/Raster-Labels verhalten sich wie bisher
                document.querySelectorAll('.raster-label').forEach(label => {
                    const p = new THREE.Vector3(
                        parseFloat(label.dataset.x),
                        parseFloat(label.dataset.y),
                        parseFloat(label.dataset.z)
                    );
                    p.project(camera);
                    const x = (p.x * halfW) + halfW;
                    const y = -(p.y * halfH) + halfH;
                    label.style.left = `${x}px`;
                    label.style.top = `${y}px`;
                    label.style.display = (p.z > 1 || window.globalOpacityScale < 0.05) ? 'none' : 'block';
                    label.style.opacity = window.globalOpacityScale;
                });

                // 3D-Ziehpunkte (Handles) dynamisch ausblenden bei Frontalansicht
                let handleOpacity = 1.0;
                const toggleDoor = document.getElementById('toggleDoorDetail');
                const showDoorDetail = toggleDoor ? toggleDoor.checked : true;
                const currentProposal = typeof calculatedProposals !== 'undefined' ? calculatedProposals.find(p => p.id === selectedProposalId) : null;
                const isDoorVisible = showDoorDetail && currentProposal && !window.placementMode;

                if (isDoorVisible) {
                    // Verblassen, wenn sich die Kamera der Frontalansicht nähert (-dir.z nähert sich 1)
                    // Wir nutzen Math.pow(-dir.z, 4), um die Punkte nahe der Frontalansicht schnell verschwinden zu lassen,
                    // sie aber bei Drehung zügig wieder einzublenden.
                    const frontFactor = Math.max(0, -dir.z);
                    handleOpacity = 1.0 - Math.pow(frontFactor, 4);
                }

                const finalHandleOpacity = handleOpacity * window.globalOpacityScale;

                if (garageGroup) {
                    garageGroup.children.forEach(child => {
                        if (child.userData && child.userData.isHandle) {
                            child.material.opacity = finalHandleOpacity * 0.9;
                            child.visible = finalHandleOpacity > 0.05;
                        }
                    });
                }
            }



            function update3D() {

                if (!garageGroup) return;
                while (garageGroup.children.length > 0) garageGroup.remove(garageGroup.children[0]);

                const v = getVisualVars();

                // --- NEU: RAW WERTE ERZWINGEN (Für realistische Fehler-Grafik) ---
                const rawF1 = parseFloat(document.getElementById('aufmassF1').value);
                const rawF2 = parseFloat(document.getElementById('aufmassF2').value);
                if (!isNaN(rawF1) && rawF1 > 0) v.F1 = rawF1;
                if (!isNaN(rawF2) && rawF2 > 0) v.F2 = rawF2;
                const bedienungSelect = document.getElementById('aufmassBedienung');
                const isAntrieb = bedienungSelect ? bedienungSelect.value === 'antrieb' : true;

                const toggleRear = document.getElementById('toggleRearWall');
                const toggleLeft = document.getElementById('toggleLeftWall');
                const toggleRight = document.getElementById('toggleRightWall');
                const toggleCeiling = document.getElementById('toggleCeiling');
                const toggleDoor = document.getElementById('toggleDoorDetail');

                const hideRearWall = toggleRear ? toggleRear.checked : false;
                const hideLeftWall = toggleLeft ? toggleLeft.checked : false;
                const hideRightWall = toggleRight ? toggleRight.checked : false;
                const hideCeiling = toggleCeiling ? toggleCeiling.checked : false;
                const showDoorDetail = toggleDoor ? toggleDoor.checked : true;

                if (typeof validate3DConstraints === 'function') validate3DConstraints();

                const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
                const matDoor = new THREE.LineBasicMaterial({ color: 0xf1c40f, linewidth: 2 });
                const matFloor = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 });

                const visCenter = (v.C1 - v.C2) / 2;

                // --- NEU: MASSIVER 3D RAUM-AUFBAU ---
                const wallThickness = 300; // Echte Dicke/Stärke der Wände (30 cm)
                const wallDepth = 150;     // Frontansicht Tiefe (15 cm)

                const fZ_out = v.G / 2;
                const fZ_in = fZ_out - wallDepth;
                const rZ = -v.G / 2;

                // Materialien für Beton und Boden
                // Materialien für Wände und Boden
                const intMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, side: THREE.FrontSide, roughness: 0.8 }); // Beton Innen
                const extMat = new THREE.MeshStandardMaterial({ color: 0xF4F6F8, side: THREE.FrontSide, roughness: 0.8 }); // Reinweiß Außen
                const revealMat = new THREE.MeshStandardMaterial({ color: 0xE2E6EA, side: THREE.FrontSide, roughness: 0.8 }); // Minimal abgedunkeltes Weiß für die Laibung
                const klinkerMats = [
                    new THREE.MeshStandardMaterial({ color: 0xd7dde3, side: THREE.FrontSide, roughness: 0.85 }),
                    new THREE.MeshStandardMaterial({ color: 0xc8d0d8, side: THREE.FrontSide, roughness: 0.85 }),
                    new THREE.MeshStandardMaterial({ color: 0xe5e9ed, side: THREE.FrontSide, roughness: 0.85 }),
                    new THREE.MeshStandardMaterial({ color: 0xb9c3cc, side: THREE.FrontSide, roughness: 0.85 })
                ];
                const klinkerEdgeMat = new THREE.LineBasicMaterial({ color: 0x8a96a3, transparent: true, opacity: 0.55 });

                const screedMat = new THREE.MeshStandardMaterial({ color: 0x64748b, side: THREE.FrontSide, roughness: 0.9 });

                // Multi-Material-Arrays für die 6 Seiten einer Box: [Rechts(+X), Links(-X), Oben(+Y), Unten(-Y), Vorne(+Z), Hinten(-Z)]
                const leftWallMat = [extMat, intMat, extMat, intMat, extMat, extMat];
                const rightWallMat = [intMat, extMat, extMat, intMat, extMat, extMat];
                const ceilMat = [extMat, extMat, extMat, intMat, extMat, extMat];
                const rearWallMat = [extMat, extMat, extMat, intMat, intMat, extMat];

                // Front-Rahmen (Die "Lücke" für das Tor) exakt zuweisen
                const buildFrontWall = (zPos, widthLeft, widthRight, heightTotal, heightDoor, widthDoor) => {
                    const group = new THREE.Group();

                    // lMesh (steht bei +X, ist also von außen betrachtet der rechte Pfeiler)
                    // Links (-X) ist die Laibung, alles andere außen ist Weiß, hinten ist Beton
                    const rightPillarMat = [extMat, revealMat, extMat, intMat, extMat, intMat];

                    // rMesh (steht bei -X, ist also von außen betrachtet der linke Pfeiler)
                    // Rechts (+X) ist die Laibung, alles andere außen ist Weiß, hinten ist Beton
                    const leftPillarMat = [revealMat, extMat, extMat, intMat, extMat, intMat];

                    // Querblende / Sturz
                    // Unten (-Y) ist die Laibung, alles andere außen ist Weiß, hinten ist Beton
                    const lintelMat = [extMat, extMat, extMat, revealMat, extMat, intMat];

                    if (widthLeft > 0) {
                        const lGeo = new THREE.BoxGeometry(widthLeft, heightTotal, wallDepth);
                        const lMesh = new THREE.Mesh(lGeo, rightPillarMat);
                        lMesh.position.set(widthDoor / 2 + widthLeft / 2, heightTotal / 2, zPos + wallDepth / 2);
                        group.add(lMesh);
                    }
                    if (widthRight > 0) {
                        const rGeo = new THREE.BoxGeometry(widthRight, heightTotal, wallDepth);
                        const rMesh = new THREE.Mesh(rGeo, leftPillarMat);
                        rMesh.position.set(-widthDoor / 2 - widthRight / 2, heightTotal / 2, zPos + wallDepth / 2);
                        group.add(rMesh);
                    }
                    const topHeight = heightTotal - heightDoor;
                    if (topHeight > 0) {
                        const tGeo = new THREE.BoxGeometry(widthDoor + widthLeft + widthRight, topHeight, wallDepth);
                        const tMesh = new THREE.Mesh(tGeo, lintelMat);
                        tMesh.position.set((widthLeft - widthRight) / 2, heightDoor + topHeight / 2, zPos + wallDepth / 2);
                        group.add(tMesh);
                    }
                    return group;
                };

                const frontWall = buildFrontWall(fZ_in, v.C1 + wallThickness, v.C2 + wallThickness, v.F1 + wallThickness, v.B, v.A);
                garageGroup.add(frontWall);

                if (v.isKlinker) {
                    const addKlinkerPart = (geo, x, y, z, matIndex = 0) => {
                        const mesh = new THREE.Mesh(geo, klinkerMats[matIndex % klinkerMats.length]);
                        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), klinkerEdgeMat);
                        mesh.add(edges);
                        mesh.position.set(x, y, z);
                        garageGroup.add(mesh);
                        return mesh;
                    };

                    const addKlinkerWall = (xMin, xMax, yMin, yMax, z, orientation, matOffset = 0) => {
                        const width = xMax - xMin;
                        const height = yMax - yMin;
                        if (width <= 1 || height <= 1) return;

                        const joint = 4;
                        const targetBrickW = orientation === 'vertical' ? 42 : 170;
                        const targetBrickH = orientation === 'vertical' ? 150 : 44;
                        const rowCount = Math.max(1, Math.round((height + joint) / (targetBrickH + joint)));
                        const brickH = Math.max(12, (height - ((rowCount - 1) * joint)) / rowCount);

                        for (let row = 0; row < rowCount; row++) {
                            const y = yMin + row * (brickH + joint);
                            const stagger = orientation === 'vertical' ? 0 : ((row % 2) * (targetBrickW / 2));
                            const startX = xMin - stagger;
                            const colCount = Math.max(1, Math.ceil((xMax - startX + stagger) / (targetBrickW + joint)));
                            const brickW = Math.max(24, (xMax - startX - ((colCount - 1) * joint)) / colCount);

                            for (let col = 0; col < colCount; col++) {
                                const x = startX + col * (brickW + joint);
                                if (x >= xMax - 1) continue;

                                let bxMin = Math.max(xMin, x);
                                let bxMax = Math.min(xMax, x + brickW);
                                if (bxMax - bxMin < 24 && col > 0) {
                                    bxMin = Math.max(xMin, bxMax - 24);
                                }
                                const w = bxMax - bxMin;
                                if (w <= 1) continue;

                                addKlinkerPart(
                                    new THREE.BoxGeometry(w, brickH, klinkerDepth),
                                    bxMin + (w / 2),
                                    y + (brickH / 2),
                                    z,
                                    matOffset + row + col
                                );
                            }
                        }
                    };

                    const klinkerDepth = 120;
                    const klinkerZ = fZ_out + (klinkerDepth / 2) + 4;
                    const openingLeft = -v.A / 2;
                    const openingRight = v.A / 2;
                    const visibleLeft = openingLeft + v.K1;
                    const visibleRight = openingRight - v.K2;
                    const outerLeftWidth = Math.max(0, v.C2 + wallThickness);
                    const outerRightWidth = Math.max(0, v.C1 + wallThickness);
                    const outerLeft = openingLeft - outerLeftWidth;
                    const outerRight = openingRight + outerRightWidth;

                    const horizontalCourseHeight = 44;
                    const joint = 4;
                    const lintelHeaderHeight = horizontalCourseHeight + joint;
                    const lintelInset = Math.max(0, v.KO);

                    addKlinkerWall(outerLeft, visibleLeft, 0, v.B + lintelHeaderHeight, klinkerZ, 'horizontal', 0);
                    addKlinkerWall(visibleRight, outerRight, 0, v.B + lintelHeaderHeight, klinkerZ, 'horizontal', 1);
                    addKlinkerWall(outerLeft, outerRight, v.B + lintelHeaderHeight, v.B + wallThickness, klinkerZ, 'horizontal', 2);
                    addKlinkerWall(visibleLeft, visibleRight, v.B - lintelInset, v.B + lintelHeaderHeight, klinkerZ, 'vertical', 4);
                }

                // --- Massive Wände generieren ---
                const roomDepth = v.G - wallDepth;
                const zCenterRoom = fZ_in - (roomDepth / 2);
                const avgCeilHeight = (v.F1 + v.F2) / 2;

                // Boden (Bleibt als etwas breiteres Fundament)
                const floorWidth = v.E1 + v.E2 + wallThickness * 2;
                const floorDepth = v.G + wallThickness;
                const floorGeo = new THREE.BoxGeometry(floorWidth, wallThickness, floorDepth);
                const floorMesh = new THREE.Mesh(floorGeo, screedMat);
                const floorZCenter = fZ_out - (floorDepth / 2);
                floorMesh.position.set(visCenter, -wallThickness / 2, floorZCenter);
                garageGroup.add(floorMesh);

                // Decke (Exakt bündig mit den Außenkanten der Seitenwände)
                if (!hideCeiling) {
                    const ceilWidth = (v.E1 + v.E2) / 2 + wallThickness * 2;
                    const ceilX = visCenter + (v.E1 - v.E2) / 4;
                    const ceilGeo = new THREE.BoxGeometry(ceilWidth, wallThickness, roomDepth);
                    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
                    ceilMesh.position.set(ceilX, avgCeilHeight + (wallThickness / 2), zCenterRoom);
                    garageGroup.add(ceilMesh);
                }

                // Linke Seitenwand
                if (!hideLeftWall) {
                    const leftWallGeo = new THREE.BoxGeometry(wallThickness, avgCeilHeight, roomDepth);
                    const leftWallMesh = new THREE.Mesh(leftWallGeo, leftWallMat);
                    leftWallMesh.position.set(visCenter + (v.E1 / 2) + (wallThickness / 2), avgCeilHeight / 2, zCenterRoom);
                    garageGroup.add(leftWallMesh);
                }

                // Rechte Seitenwand
                if (!hideRightWall) {
                    const rightWallGeo = new THREE.BoxGeometry(wallThickness, avgCeilHeight, roomDepth);
                    const rightWallMesh = new THREE.Mesh(rightWallGeo, rightWallMat);
                    rightWallMesh.position.set(visCenter - (v.E2 / 2) - (wallThickness / 2), avgCeilHeight / 2, zCenterRoom);
                    garageGroup.add(rightWallMesh);
                }

                // Rückwand (Perfekt bündig mit Decke und Seitenwänden)
                if (!hideRearWall) {
                    const rearWallGeo = new THREE.BoxGeometry(ceilWidth, avgCeilHeight + wallThickness, wallThickness);
                    const rearWallMesh = new THREE.Mesh(rearWallGeo, rearWallMat);
                    rearWallMesh.position.set(ceilX, (avgCeilHeight + wallThickness) / 2, rZ - (wallThickness / 2));
                    garageGroup.add(rearWallMesh);
                }

                // Tor Detail Rendering
                let currentProposal = typeof calculatedProposals !== 'undefined' ? calculatedProposals.find(p => p.id === selectedProposalId) : null;
                const drawDoor = showDoorDetail && currentProposal && !window.placementMode;

                if (drawDoor) {
                    let BB = currentProposal.w;
                    let BH = currentProposal.h;
                    const showRaster = document.getElementById('toggleRasterLabels')?.checked || false;

                    let X_center = 0;
                    if (v.isKlinker) {
                        // Bei asymmetrischen Überständen liegt die lichte
                        // Klinkeröffnung nicht auf der Gesamtöffnungsachse.
                        X_center = (v.K1 - v.K2) / 2;
                    }
                    let frameWidth = v.isHinter ? 80 : 95;
                    let topBlendeHeight = 100;

                    if (v.isHinter) {
                        let left_max_space = v.A / 2 + v.C1;
                        let right_max_space = -v.A / 2 - v.C2;
                        let frame_half_width = BB / 2 + frameWidth;
                        if (frame_half_width > left_max_space) X_center = left_max_space - frame_half_width;
                        if (-frame_half_width + X_center < right_max_space) X_center = right_max_space + frame_half_width;
                    }

                    // ==========================================
                    // --- DYNAMISCHE FARBEN & INNEN/AUSSEN LOGIK ---
                    // ==========================================
                    const selectedColorName = document.getElementById('aufmassFarbe') ? document.getElementById('aufmassFarbe').value : "RAL 9016 (Verkehrsweiß)";
                    const selectedObf = document.getElementById('aufmassOberflaeche') ? document.getElementById('aufmassOberflaeche').value : "Woodgrain";

                    let outHex = 0xF4F8FA; // Standard Verkehrsweiß

                    // Vorgabe: Duragrain und Decograin bleiben im 3D Modell vorerst stur Weiß
                    if (selectedObf === "Duragrain" || selectedObf === "Decograin") {
                        outHex = 0xF4F8FA;
                    } else if (window.aufmassColorData && window.aufmassColorData[selectedColorName]) {
                        // Andernfalls weisen wir die echte RAL Farbe als Hex-Wert zu
                        outHex = window.aufmassColorData[selectedColorName];
                    }

                    // --- TEXTUREN FÜR OBERFLÄCHEN-STRUKTUREN (WOODGRAIN & SLATEGRAIN) ---
                    if (!window._woodgrainNormal) {
                        window._woodgrainNormal = new THREE.TextureLoader().load('img/normal_woodgrain.png');
                        window._woodgrainNormal.wrapS = THREE.ClampToEdgeWrapping;
                        window._woodgrainNormal.wrapT = THREE.ClampToEdgeWrapping;
                        window._woodgrainNormal.repeat.set(1, 1);
                    }
                    if (!window._slategrainNormal) {
                        window._slategrainNormal = new THREE.TextureLoader().load('img/normal_slategrain.png');
                        window._slategrainNormal.wrapS = THREE.ClampToEdgeWrapping;
                        window._slategrainNormal.wrapT = THREE.ClampToEdgeWrapping;
                        window._slategrainNormal.repeat.set(1, 1);
                    }
                    if (!window._woodgrainTexture) {
                        window._woodgrainTexture = new THREE.TextureLoader().load('img/texture_woodgrain.png');
                        window._woodgrainTexture.wrapS = THREE.ClampToEdgeWrapping;
                        window._woodgrainTexture.wrapT = THREE.ClampToEdgeWrapping;
                        window._woodgrainTexture.repeat.set(1, 1);
                    }
                    if (!window._slategrainTexture) {
                        window._slategrainTexture = new THREE.TextureLoader().load('img/texture_slategrain.png');
                        window._slategrainTexture.wrapS = THREE.ClampToEdgeWrapping;
                        window._slategrainTexture.wrapT = THREE.ClampToEdgeWrapping;
                        window._slategrainTexture.repeat.set(1, 1);
                    }

                    let panelNormalMap = null;
                    let panelNormalScale = new THREE.Vector2(1, 1);
                    let panelBumpMap = null;
                    let panelBumpScale = 0;
                    let panelRoughness = 0.5;

                    if (selectedObf === "Woodgrain") {
                        panelNormalMap = window._woodgrainNormal;
                        panelNormalScale = new THREE.Vector2(3.0, 3.0); // Kräftige 3D-Lichtbrechung für Sägeschnitt
                        panelBumpMap = window._woodgrainTexture;
                        panelBumpScale = 0.40;
                        panelRoughness = 0.55;
                    } else if (selectedObf === "Slategrain") {
                        panelNormalMap = window._slategrainNormal;
                        panelNormalScale = new THREE.Vector2(2.5, 2.5); // Geradere Schiefer-Prägung
                        panelBumpMap = window._slategrainTexture;
                        panelBumpScale = 0.35;
                        panelRoughness = 0.50;
                    } else if (selectedObf === "Silkgrain" || selectedObf === "Planar" || selectedObf === "Plaingrain") {
                        panelRoughness = 0.25; // Glatt / seidenmatt
                    }

                    // Feste Innenfarben
                    const inHex = 0xE9E5CE;   // RAL 9002 Grauweiß (Torblatt Innen)
                    const zinkHex = 0xB0B0B0; // Verzinkt (Zarge & Blenden Innen)
                    const hellgrauHex = 0xd3d3d3;

                    // Erstellt ein Box-Material-Array (Rechts, Links, Oben, Unten, Vorne/Außen, Hinten/Innen)
                    function getTwoSidedMat(outColor, inColor, normalMap = null, normalScale = null, bumpMap = null, bumpScale = 0, roughness = 0.6) {
                        const outMat = new THREE.MeshStandardMaterial({
                            color: outColor,
                            side: THREE.FrontSide,
                            roughness: roughness,
                            normalMap: normalMap,
                            normalScale: normalScale || new THREE.Vector2(1, 1),
                            bumpMap: bumpMap,
                            bumpScale: bumpScale
                        });
                        const inMat = new THREE.MeshStandardMaterial({ color: inColor, side: THREE.FrontSide, roughness: 0.7 });
                        const edgeM = new THREE.MeshStandardMaterial({ color: 0x94a3b8, side: THREE.FrontSide });
                        // Index 4 ist +Z (Betrachter von Vorne), Index 5 ist -Z (Innenansicht)
                        return [edgeM, edgeM, edgeM, edgeM, outMat, inMat];
                    }

                    // Zuweisung (Diese Variablen werden automatisch von der Geometrie erkannt!)
                    const panelMat = getTwoSidedMat(outHex, inHex, panelNormalMap, panelNormalScale, panelBumpMap, panelBumpScale, panelRoughness);   // Lamellen & PU-Blenden
                    const frameMat = getTwoSidedMat(outHex, hellgrauHex);

                const sealMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, side: THREE.FrontSide });

                // Stärkere Linien für bessere Außenoptik:
                const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000 });
                const sealEdgeMat = new THREE.LineBasicMaterial({ color: 0x000000 });

                    const frameDepth = 175;
                    const doorOffsetX = 2;
                    const doorOffsetZ = 8;
                    let frameZPos = v.isHinter ? (fZ_in - (frameDepth / 2) - doorOffsetZ) : (fZ_out - (frameDepth / 2));

                    // ==========================================
                    // 🛠️ ZENTRALE EINSTELLUNG FÜR DIE TOR-TIEFE
                    // ==========================================
                    // Minus = Weiter nach vorne (zur Mauer) | Plus = Weiter nach hinten
                    const torTiefenOffset = -40;
                    // ==========================================

                    const addPartWithEdges = (geo, mat, edgeMaterial, x, y, z) => {
                        const mesh = new THREE.Mesh(geo, mat);
                        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMaterial);
                        mesh.add(edges);
                        mesh.position.set(x, y, z);
                        garageGroup.add(mesh);
                        return mesh;
                    };

                    // --- 1. ZARGEN-GRUNDGERÜST (Immer gleich) ---
                    frameWidth = v.isHinter ? 80 : 95;
                    topBlendeHeight = 100;

                    // Neues, dezentes Fugen-Material für die Zargen-Optik
                    const zargenEdgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });

                    // --- KUNSTSTOFF-ZARGENFUSS & SEITENTEILE ---
                    const zargenFussHeight = 35;

                    // Die restliche Höhe der Zarge ist die Gesamthöhe minus den Fuß
                    const restHeight = (BH + topBlendeHeight) - zargenFussHeight;
                    const fussY = zargenFussHeight / 2;
                    const restY = zargenFussHeight + (restHeight / 2);

                    // Linkes Seitenteil (geteilt in Fuß und Rest)
                    let zargeL_X = X_center + (BB / 2) + (frameWidth / 2) - doorOffsetX;
                    // 1. Zargenfuß (Schwarz/Bodendichtung)
                    addPartWithEdges(new THREE.BoxGeometry(frameWidth, zargenFussHeight, frameDepth), sealMat, zargenEdgeMat, zargeL_X, fussY, frameZPos);
                    // 2. Restliche Zarge (Zargenfarbe)
                    addPartWithEdges(new THREE.BoxGeometry(frameWidth, restHeight, frameDepth), frameMat, zargenEdgeMat, zargeL_X, restY, frameZPos);

                    // Rechtes Seitenteil (geteilt in Fuß und Rest)
                    let zargeR_X = X_center - (BB / 2) - (frameWidth / 2) + doorOffsetX;
                    // 1. Zargenfuß (Schwarz/Bodendichtung)
                    addPartWithEdges(new THREE.BoxGeometry(frameWidth, zargenFussHeight, frameDepth), sealMat, zargenEdgeMat, zargeR_X, fussY, frameZPos);
                    // 2. Restliche Zarge (Zargenfarbe)
                    addPartWithEdges(new THREE.BoxGeometry(frameWidth, restHeight, frameDepth), frameMat, zargenEdgeMat, zargeR_X, restY, frameZPos);

                    // Obere Zargenblende (sitzt exakt DAZWISCHEN)
                    let zargeObenBreite = BB - (2 * doorOffsetX); // Breite entspricht exakt der Lücke
                    let zargeObenY = BH + (topBlendeHeight / 2); // Sitzt oberhalb des Torblattes (BH) auf
                    addPartWithEdges(new THREE.BoxGeometry(zargeObenBreite, topBlendeHeight, frameDepth), frameMat, zargenEdgeMat, X_center, zargeObenY, frameZPos);

                    // --- ZUSÄTZLICHE BLENDE (EINWANDIG ODER PU) VISUALISIERUNG ---
                    if ((v.isHinter || v.isKlinker) && currentProposal && currentProposal.fascia) {
                        let fHeight = currentProposal.fascia;
                        let isPU = currentProposal.isPU || false;

                        let fWidth = v.isKlinker ? (v.A - v.K1 - v.K2) : v.A + Math.abs(X_center);
                        let fXCenter = v.isKlinker ? X_center : X_center / 2;
                        let fYCenter = v.isKlinker
                            ? (v.B - v.KO - (fHeight / 2))
                            : (v.B - (fHeight / 2));

                        const wallDepth = 150;
                        const fZ_in = (v.G / 2) - wallDepth;
                        const blackMat = new THREE.LineBasicMaterial({ color: 0x000000 });

                        if (!isPU) {
                            // 1. ZUSÄTZLICHE EINWANDIGE BLENDE
                            let fThickness = 15;
                            let fZCenter = v.isKlinker ? (fZ_out + (fThickness / 2) + 2) : (fZ_in + (fThickness / 2));
                            const blendeMat = getTwoSidedMat(outHex, 0xd3d3d3);

                            addPartWithEdges(new THREE.BoxGeometry(fWidth, fHeight, fThickness), blendeMat, blackMat, fXCenter, fYCenter, fZCenter);
                        } else {
                            // 2. PU-BLENDE
                            let fThickness = 42;
                            let fZCenter = v.isKlinker ? (fZ_out + (fThickness / 2) + 2) : (fZ_in + (fThickness / 2));

                            addPartWithEdges(new THREE.BoxGeometry(fWidth, fHeight, fThickness), panelMat, blackMat, fXCenter, fYCenter, fZCenter);

                            // Rahmen (Außen und Innen)
                            const frameW = 25;
                            const frameD = 2;
                            const frameZ_out = fZCenter + (fThickness / 2) + (frameD / 2);
                            const frameZ_in = fZCenter - (fThickness / 2) - (frameD / 2);

                            const addDoubleFrame = (w, h, x, y) => {
                                addPartWithEdges(new THREE.BoxGeometry(w, h, frameD), panelMat, blackMat, x, y, frameZ_out);
                                addPartWithEdges(new THREE.BoxGeometry(w, h, frameD), panelMat, blackMat, x, y, frameZ_in);
                            };

                            const leftX = fXCenter + (fWidth / 2) - (frameW / 2);
                            addDoubleFrame(frameW, fHeight, leftX, fYCenter);

                            const rightX = fXCenter - (fWidth / 2) + (frameW / 2);
                            addDoubleFrame(frameW, fHeight, rightX, fYCenter);

                            const topWidth = fWidth - (2 * frameW);
                            const topY = fYCenter + (fHeight / 2) - (frameW / 2);
                            addDoubleFrame(topWidth, frameW, fXCenter, topY);

                            // --- SICKEN-AUFTEILUNG (INNEN & AUSSEN) ---
                            let doorH = currentProposal ? currentProposal.h : v.B;
                            const rList = [1900, 2000, 2080, 2125, 2205, 2250, 2375, 2500, 2600, 2750, 2850, 3000];
                            let tRaster = 3000;
                            for (let r of rList) {
                                if (doorH <= r) { tRaster = r; break; }
                            }

                            let pCount = 4;
                            if (tRaster >= 2850) pCount = 6;
                            else if (tRaster >= 2375) pCount = 5;

                            const rHeight = Math.round(tRaster / pCount);

                            // Sicke aus dem Menü auslesen (Standard: L)
                            const selectedSicke = document.getElementById('aufmassSicke') ? document.getElementById('aufmassSicke').value : 'L';
                            let frontRibs = 0;
                            if (selectedSicke === 'M') frontRibs = 1;      // M-Sicke: 1 Linie (halbiert)
                            else if (selectedSicke === 'S') frontRibs = 3; // S-Sicke: 3 Linien (geviertelt)

                            const zFaceOut = fZCenter + (fThickness / 2) + 0.5;
                            const zFaceIn = fZCenter - (fThickness / 2) - 0.5;
                            const puBottomY = fYCenter - (fHeight / 2);
                            const puTopY = fYCenter + (fHeight / 2);

                            const lineStartX = fXCenter - fWidth / 2 + frameW;
                            const lineEndX = fXCenter + fWidth / 2 - frameW;

                            // 1. Sicken auf der Außenseite (gleiche Sickenteilung wie das Torblatt für fortlaufende Optik)
                            if (frontRibs > 0) {
                                const frontRibSpacing = rHeight / (frontRibs + 1);
                                for (let y = 0; y < puTopY; y += frontRibSpacing) {
                                    if (y > puBottomY + 1 && y < puTopY - frameW - 1) {
                                        const lineGeo = new THREE.BufferGeometry().setFromPoints([
                                            new THREE.Vector3(lineStartX, y, zFaceOut),
                                            new THREE.Vector3(lineEndX, y, zFaceOut)
                                        ]);
                                        garageGroup.add(new THREE.Line(lineGeo, blackMat));
                                    }
                                }
                            }

                            // 2. S-Sicke auf der Innenseite (Innenseite ist IMMER S-Sicke)
                            const backRibSpacing = rHeight / 4;
                            for (let y = 0; y < puTopY; y += backRibSpacing) {
                                if (y > puBottomY + 1 && y < puTopY - frameW - 1) {
                                    const lineGeo = new THREE.BufferGeometry().setFromPoints([
                                        new THREE.Vector3(lineStartX, y, zFaceIn),
                                        new THREE.Vector3(lineEndX, y, zFaceIn)
                                    ]);
                                    garageGroup.add(new THREE.Line(lineGeo, blackMat));
                                }
                            }
                        }
                    }

                    // --- DICHTUNGEN (Zarge & Sturz) ---
                    if (v.isHinter) {
                        const sealMat = new THREE.MeshStandardMaterial({
                            color: 0x111111,
                            roughness: 0.9
                        });
                        const sSize = 5;

                        const torW = currentProposal ? currentProposal.w : v.A;
                        const torH = currentProposal ? currentProposal.h : v.B;

                        // Festgeschriebene Kalibrierungswerte
                        const offsetX = -2;
                        const offsetY = 0;

                        // Die Dichtung klebt jetzt automatisch immer 23mm hinter dem Torblatt!
                        const sealZ = frameZPos + (frameDepth / 2) + torTiefenOffset + 23;

                        const leftX = X_center + (torW / 2) + offsetX;
                        const rightX = X_center - (torW / 2) - offsetX;

                        const topY = torH + offsetY;
                        const sideHeight = topY;

                        // Linke Zargendichtung
                        addPartWithEdges(new THREE.BoxGeometry(sSize, sideHeight, sSize), sealMat, zargenEdgeMat, leftX, sideHeight / 2, sealZ);

                        // Rechte Zargendichtung
                        addPartWithEdges(new THREE.BoxGeometry(sSize, sideHeight, sSize), sealMat, zargenEdgeMat, rightX, sideHeight / 2, sealZ);

                        // Sturzdichtung
                        const sealWidth = torW + (2 * offsetX) + sSize;
                        addPartWithEdges(new THREE.BoxGeometry(sealWidth, sSize, sSize), sealMat, zargenEdgeMat, X_center, topY, sealZ);
                    }

                    // --- 3. BLENDRAHMEN-SET (NUR BEI "IN DER ÖFFNUNG") ---
                    if (!v.isHinter) {
                        let hasBlendrahmen = false;
                        let blendrahmenBreite = 95;

                        if (currentProposal && currentProposal.title.includes("Blendrahmen")) {
                            hasBlendrahmen = true;
                            if (currentProposal.title.includes("125mm")) blendrahmenBreite = 125;
                        }

                        if (hasBlendrahmen) {
                            let brThickness = 15;
                            // Der Blendrahmen sitzt VOR der Zarge (Richtung Betrachter)
                            let brZCenter = frameZPos + (frameDepth / 2) + (brThickness / 2);

                            // Das Material für den Blendrahmen (wir nutzen das gleiche wie für die Zarge)
                            const brMat = frameMat;
                            const brEdgeMat = new THREE.LineBasicMaterial({ color: 0xa0aec0, transparent: true, opacity: 0.6 }); // Dezente Fugen-Farbe

                            // --- Seitliche Blendrahmen ---
                            // Gehen von unten (0) bis ganz nach oben zum Sturz (v.B)
                            let brSeiteHoehe = v.B;

                            // Die Außenkante der Blendrahmen ist exakt das Lichte Maß (Maueröffnung A)
                            // Die Breite ist blendrahmenBreite.
                            let wandL = v.A / 2;
                            let wandR = -v.A / 2;

                            // Linker Blendrahmen (von außen betrachtet rechts)
                            let brSeiteL_X = wandL - (blendrahmenBreite / 2);
                            addPartWithEdges(new THREE.BoxGeometry(blendrahmenBreite, brSeiteHoehe, brThickness), brMat, brEdgeMat, brSeiteL_X, brSeiteHoehe / 2, brZCenter);

                            // Rechter Blendrahmen (von außen betrachtet links)
                            let brSeiteR_X = wandR + (blendrahmenBreite / 2);
                            addPartWithEdges(new THREE.BoxGeometry(blendrahmenBreite, brSeiteHoehe, brThickness), brMat, brEdgeMat, brSeiteR_X, brSeiteHoehe / 2, brZCenter);

                            // --- Obere Querblende ---
                            // Sitzt DAZWISCHEN.
                            // Breite = Gesamte Maueröffnung (A) minus die beiden seitlichen Blendrahmen
                            let brObenBreite = v.A - (2 * blendrahmenBreite);
                            // Höhe = blendrahmenBreite (Die obere Blende ist genauso hoch wie die seitlichen breit sind)
                            // Ausnahme: Wenn das Loch kleiner ist, als die Blendrahmenbreite? Nein, laut deiner Beschreibung 
                            // ist es ein komplettes Set aus 3 Teilen gleicher "Breite".
                            let brObenHoehe = blendrahmenBreite;

                            // Sie schließt OBEN bündig mit dem Sturz (v.B) ab.
                            // Das heißt, der Mittelpunkt ist v.B minus halbe Höhe der Querblende.
                            let brObenYCenter = v.B - (brObenHoehe / 2);

                            addPartWithEdges(new THREE.BoxGeometry(brObenBreite, brObenHoehe, brThickness), brMat, brEdgeMat, X_center, brObenYCenter, brZCenter);
                        }
                    }
                    // --- ENDE ---

                    const panelThickness = 42;
                    const overlap = 20;
                    const totalPanelWidth = BB + (overlap * 2);

                    // Das Torblatt nutzt jetzt unseren Master-Schalter
                    const panelZ = frameZPos + (frameDepth / 2) + torTiefenOffset;

                    // --- NEUE LOGIK AUS ERSATZLAMELLEN ---
                    const rasterList = [1900, 2000, 2080, 2125, 2205, 2250, 2375, 2500, 2600, 2750, 2850, 3000];
                    let targetRaster = 3000;
                    for (let r of rasterList) {
                        if (BH <= r) { targetRaster = r; break; }
                    }

                    let panelCount = 4;
                    if (targetRaster >= 2850) panelCount = 6;
                    else if (targetRaster >= 2375) panelCount = 5;

                    // Das exakte Rastermaß für die ungeschnittenen Basis-Lamellen
                    const rasterHeight = Math.round(targetRaster / panelCount);
                    const sealHeight = 30;
                    // -------------------------------------

                    // Hilfsfunktion für Maß-Labels
                    const addRasterLabel = (y, text) => {
                        if (!showRaster) return;
                        const label = document.createElement('div');
                        label.className = 'raster-label';
                        label.innerText = text;
                        label.dataset.y = y;
                        label.dataset.x = X_center + BB / 2 + frameWidth + 20;
                        label.dataset.z = panelZ;
                        document.getElementById('sceneWrapper').appendChild(label);
                    };

                    // Labels säubern
                    document.querySelectorAll('.raster-label').forEach(l => l.remove());

                    // Sicke aus dem Menü auslesen (Standard: L)
                    const selectedSicke = document.getElementById('aufmassSicke') ? document.getElementById('aufmassSicke').value : 'L';
                    let currentYPos = 0; // Startpunkt unten am Boden

                    for (let i = 0; i < panelCount; i++) {
                        let isTopPanel = (i === panelCount - 1);

                        // Höhe der aktuellen Lamelle (Ist es die oberste, wird der Restbetrag genommen = Kürzung)
                        let currentPanelHeight = isTopPanel ? (BH - currentYPos) : rasterHeight;
                        let h = currentPanelHeight - 2; // -2 für den optischen Spalt
                        let yCenter = currentYPos + (currentPanelHeight / 2);

                        if (i === 0) {
                            // Bodensektion mit Dichtung
                            addPartWithEdges(new THREE.BoxGeometry(totalPanelWidth, sealHeight, panelThickness), sealMat, sealEdgeMat, X_center, sealHeight / 2, panelZ);
                            h = currentPanelHeight - sealHeight - 2;
                            yCenter = sealHeight + h / 2;
                        }

                        // Haupt-Torblatt (die Lamelle selbst) zeichnen
                        addPartWithEdges(new THREE.BoxGeometry(totalPanelWidth, h, panelThickness), panelMat, edgeMat, X_center, yCenter, panelZ);

                        // ==========================================
                        // --- NEU: OPTISCHE SICKEN (FUGEN) ZEICHNEN ---
                        // ==========================================

                        // Wie viele Linien brauchen wir außen?
                        let frontRibs = 0;
                        if (selectedSicke === 'M') frontRibs = 1;      // M-Sicke: 1 Linie (halbiert)
                        else if (selectedSicke === 'S') frontRibs = 3; // S-Sicke: 3 Linien (geviertelt)

                        // Wie viele Linien brauchen wir innen?
                        let backRibs = 3; // Innenseite ist IMMER S-Sicke!

                        const drawRibs = (numRibs, isFront) => {
                            if (numRibs === 0) return;

                            // Um flackern (Z-Fighting) zu verhindern, legen wir die Linie 0.5mm VOR die Fläche
                            const zFace = isFront ? (panelZ + panelThickness / 2 + 0.5) : (panelZ - panelThickness / 2 - 0.5);

                            // Der Abstand orientiert sich IMMER an der originalen Rasterhöhe (ungeschnitten)
                            const ribSpacing = rasterHeight / (numRibs + 1);

                            for (let r = 1; r <= numRibs; r++) {
                                // Die Sicke wird absolut von der Unterkante der Sektion hochgerechnet
                                let ribY = currentYPos + (r * ribSpacing);

                                // Prüfen: Liegt die Sicke überhaupt noch auf dem Blech? 
                                // (Fällt weg, wenn die Topsektion zu stark gekürzt ist)
                                let minY = (i === 0) ? sealHeight : currentYPos;
                                let maxY = currentYPos + currentPanelHeight - 2;

                                if (ribY > minY && ribY < maxY) {
                                    const lineGeo = new THREE.BufferGeometry().setFromPoints([
                                        new THREE.Vector3(X_center - totalPanelWidth / 2, ribY, zFace),
                                        new THREE.Vector3(X_center + totalPanelWidth / 2, ribY, zFace)
                                    ]);
                                    const ribLine = new THREE.Line(lineGeo, edgeMat); // Selbe Farbe wie die Ränder
                                    garageGroup.add(ribLine);
                                }
                            }
                        };

                        drawRibs(frontRibs, true);  // Linien Außenseite zeichnen
                        drawRibs(backRibs, false);  // Linien Innenseite zeichnen
                        // ==========================================

                        // Maßzahl zeichnen
                        addRasterLabel(yCenter, Math.round(currentPanelHeight) + " mm");

                        // Für die nächste Lamelle den Y-Startpunkt nach oben verschieben
                        currentYPos += currentPanelHeight;
                    }

                    // --- HÖRMANN LOGO / PLAKETTE (UNTEN RECHTS AUF DER BODENSEKTION) ---
                    const badgeW = 160; // Schildbreite: 160 mm
                    const badgeH = 30;  // Schildhöhe: 30 mm
                    const badgeDistBottom = 80; // 80 mm von OFF (Unterkante Tor) bis Unterkante Schild
                    const badgeDistSide = 45;   // 45 mm von der Zarge (Lichte Öffnung rechts) bis Schild

                    // Y-Position: Unterkante bei 80 mm -> Center bei 80 + (30 / 2) = 95 mm
                    const badgeY = badgeDistBottom + (badgeH / 2);

                    // X-Position: Von der sichtbaren rechten Zargen- bzw. Öffnungskante (positive X-Achse) 45 mm nach innen
                    let rightInnerEdge;
                    if (v.isHinter) {
                        const zargeEdge = X_center + (BB / 2) - doorOffsetX;
                        const wallEdge = +(v.A / 2);
                        rightInnerEdge = Math.min(zargeEdge, wallEdge);
                    } else {
                        rightInnerEdge = X_center + (BB / 2) - doorOffsetX;
                    }
                    const badgeX = rightInnerEdge - badgeDistSide - (badgeW / 2);

                    // Z-Position: Exakt auf der Front des Torblattes
                    const badgeZ = panelZ + (panelThickness / 2) + 0.8;

                    if (!window._hoermannBadgeTexture) {
                        window._hoermannBadgeTexture = new THREE.TextureLoader().load('img/hoermann_badge.png');
                    }

                    const badgeMat = new THREE.MeshBasicMaterial({
                        map: window._hoermannBadgeTexture,
                        transparent: true,
                        side: THREE.FrontSide
                    });

                    const badgeGeo = new THREE.PlaneGeometry(badgeW, badgeH);
                    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
                    badgeMesh.position.set(badgeX, badgeY, badgeZ);
                    garageGroup.add(badgeMesh);
                } else {
                    // Öffnung bleibt leer
                }
                // ==========================================
                // --- MASS-PFEILE (FINAL) ---
                // ==========================================
                const hideArrows = document.getElementById('toggleArrows') ? document.getElementById('toggleArrows').checked : false;
                const showArrows = !hideArrows;

                window.getMeasurementData = function (key, v) {
                    const arrVisCenter = (v.C1 - v.C2) / 2;
                    const wallDepth = 150;
                    const fZ_in = (v.G / 2) - wallDepth;

                    const pos = { len: 0, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

                    switch (key) {
                        case 'A': pos.len = v.A; pos.x = 0; pos.y = 80; pos.z = fZ_in + wallDepth + 30; pos.rz = Math.PI / 2; break;
                        case 'B': pos.len = v.B; pos.x = -v.A / 2 + 200; pos.y = v.B / 2; pos.z = fZ_in + wallDepth + 30; break;
                        case 'C1': pos.len = v.C1; pos.x = v.A / 2 + v.C1 / 2; pos.y = 80; pos.z = fZ_in + wallDepth + 30; pos.rz = Math.PI / 2; break;
                        case 'C2': pos.len = v.C2; pos.x = -v.A / 2 - v.C2 / 2; pos.y = 80; pos.z = fZ_in + wallDepth + 30; pos.rz = Math.PI / 2; break;
                        case 'D': pos.len = v.D; pos.x = v.A / 2 - 200; pos.y = v.B + v.D / 2; pos.z = fZ_in + wallDepth + 30; break;

                        case 'G': pos.len = v.G; pos.x = arrVisCenter + v.E1 / 2 - 250; pos.y = 80; pos.z = fZ_in - v.G / 2; pos.rx = Math.PI / 2; break;
                        case 'E1': pos.len = v.E1; pos.x = arrVisCenter; pos.y = v.F1 + 250; pos.z = fZ_in - 50; pos.rz = Math.PI / 2; break;
                        case 'E2': pos.len = v.E2; pos.x = arrVisCenter; pos.y = v.F2 + 250; pos.z = fZ_in - v.G + 50; pos.rz = Math.PI / 2; break;
                        case 'F1': pos.len = v.F1; pos.x = arrVisCenter - v.E1 / 2 - 250; pos.y = v.F1 / 2; pos.z = fZ_in - 50; break;
                        case 'F2': pos.len = v.F2; pos.x = arrVisCenter - v.E2 / 2 - 250; pos.y = v.F2 / 2; pos.z = fZ_in - v.G + 50; break;
                    }

                    const off = window.arrowOffsets && window.arrowOffsets[key] ? window.arrowOffsets[key] : { l: 0, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
                    pos.len += off.l; pos.x += off.x; pos.y += off.y; pos.z += off.z;
                    pos.rx += off.rx * (Math.PI / 180); pos.ry += off.ry * (Math.PI / 180); pos.rz += off.rz * (Math.PI / 180);

                    return pos;
                };

                getPointCoords = function (key) {
                    const v = getVisualVars();
                    const data = window.getMeasurementData(key, v);

                    let yOffset = 0, xOffset = 0;
                    const off = window.arrowOffsets && window.arrowOffsets[key] ? window.arrowOffsets[key] : null;
                    if (off && off.hx !== undefined && off.hy !== undefined) {
                        xOffset = off.hx;
                        yOffset = off.hy;
                    }

                    return new THREE.Vector3(data.x + xOffset, data.y + yOffset, data.z);
                };

                if (showArrows && garageGroup) {
                    window.arrowOffsets = {
                        'A': { "l": 0, "x": 0, "y": 650, "z": -70, "rx": 0, "ry": 0, "rz": 0, "hx": 183, "hy": 60 },
                        'B': { "l": -50, "x": 450, "y": 0, "z": -70, "rx": 0, "ry": 0, "rz": 0, "hx": 0, "hy": 100 },
                        'C1': { "l": 10, "x": 0, "y": 250, "z": -200, "rx": 0, "ry": 0, "rz": 0, "hx": 0, "hy": 150 },
                        'C2': { "l": 10, "x": 0, "y": 250, "z": -200, "rx": 0, "ry": 0, "rz": 0, "hx": 0, "hy": 150 },
                        'D': { "l": 10, "x": -400, "y": 0, "z": -200, "rx": 0, "ry": 0, "rz": 0, "hx": 250, "hy": 18 },
                        'G': { "l": -200, "x": 220, "y": 1160, "z": 70, "rx": 0, "ry": 0, "rz": 0, "hx": 0, "hy": 60 },
                        'E1': { "l": -50, "x": 0, "y": -315, "z": 0, "rx": 0, "ry": 0, "rz": 0, "hx": -658, "hy": 100 },
                        'E2': { "l": -50, "x": 0, "y": -315, "z": 1020, "rx": 0, "ry": 0, "rz": 0, "hx": 0, "hy": 60 },
                        'F1': { "l": -50, "x": 370, "y": 0, "z": 10, "rx": 0, "ry": 0, "rz": 0, "hx": -120, "hy": 530 },
                        'F2': { "l": -90, "x": 370, "y": 0, "z": 850, "rx": 0, "ry": 0, "rz": 0, "hx": -70, "hy": 530 }
                    };

                    window.measureArrows = [];

                    const createDoubleArrow = (length, colorHex) => {
                        const group = new THREE.Group();
                        if (length <= 0) return group;

                        const coneHeight = Math.min(60, length * 0.35);
                        const coneRadius = Math.min(25, coneHeight * (25 / 60));

                        const mat = new THREE.MeshBasicMaterial({ 
                            color: colorHex, 
                            transparent: true, 
                            opacity: 1,
                            depthTest: false,
                            depthWrite: false
                        });

                        const lineLen = Math.max(1, length - coneHeight);
                        const line = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, lineLen, 8), mat);
                        line.renderOrder = 9999;
                        line.userData.originalColor = colorHex;

                        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);

                        const cone1 = new THREE.Mesh(coneGeo, mat);
                        cone1.position.y = (length / 2) - (coneHeight / 2);
                        cone1.renderOrder = 9999;
                        cone1.userData.originalColor = colorHex;

                        const cone2 = new THREE.Mesh(coneGeo, mat);
                        cone2.position.y = -(length / 2) + (coneHeight / 2);
                        cone2.rotation.x = Math.PI;
                        cone2.renderOrder = 9999;
                        cone2.userData.originalColor = colorHex;

                        group.add(line); group.add(cone1); group.add(cone2);
                        return group;
                    };

                    ['A', 'B', 'C1', 'C2', 'D', 'G', 'E1', 'E2', 'F1', 'F2'].forEach(key => {
                        const data = window.getMeasurementData(key, v);
                        if (data.len <= 0) return;
                        if (!v.isHinter && (key === 'C1' || key === 'C2' || key === 'D')) return;

                        // Rote Warnfarbe, falls diese Maßzone durch ein Hindernis verringert wurde!
                        const isDeducted = window.lastObstacleAffectedZones && window.lastObstacleAffectedZones[key];
                        const arrowColor = isDeducted ? 0xef4444 : 0x38bdf8;

                        const arrow = createDoubleArrow(data.len, arrowColor);
                        arrow.userData.pointKey = key;
                        window.measureArrows.push(arrow);

                        arrow.position.set(data.x, data.y, data.z);
                        arrow.rotation.set(data.rx, data.ry, data.rz);
                        garageGroup.add(arrow);
                    });
                }

                if (garageGroup) {
                    // --- NEU: HINDERNISSE RENDERN IN THREE.JS ---
                    const cbNoObstacles = document.getElementById('cbNoObstacles');
                    const hideObstacles = cbNoObstacles ? cbNoObstacles.checked : false;

                    if (!hideObstacles && window.aufmassObstacles && window.aufmassObstacles.length > 0) {
                        window.aufmassObstacles.forEach(obs => {
                            let geom;
                            const isSelected = window.selectedObstacleId === obs.id;
                            const isLocked = !!obs.locked;
                            
                            let colorHex, opacityVal, isTransparent;
                            if (isLocked) {
                                colorHex = 0x64748b; // Edles Schiefergrau
                                opacityVal = 1.0;
                                isTransparent = false;
                            } else {
                                colorHex = isSelected ? 0x38bdf8 : 0x0284c7;
                                opacityVal = isSelected ? 0.75 : 0.6;
                                isTransparent = true;
                            }
                            
                            const mat = new THREE.MeshStandardMaterial({
                                color: colorHex,
                                transparent: isTransparent,
                                opacity: opacityVal,
                                roughness: isLocked ? 0.9 : 0.4,
                                metalness: isLocked ? 0.2 : 0.1,
                                side: THREE.DoubleSide
                            });
                            
                            const visCenter = (v.C1 - v.C2) / 2;
                            const leftWall = visCenter + v.E1/2;
                            const frontZ = v.G/2 - 150;
                            
                            let mesh;
                            if (obs.type === 'rohr') {
                                const dia = parseInt(obs.diameter) || 70;
                                const len = parseInt(obs.length) || 1000;
                                const dir = obs.direction || 'vertical';
                                
                                geom = new THREE.CylinderGeometry(dia/2, dia/2, len, 16);
                                mesh = new THREE.Mesh(geom, mat);
                                
                                // Positionierung & Rotation basierend auf der Richtung
                                if (dir === 'vertical') {
                                     const x = leftWall - (parseInt(obs.abstandLinks) || 0) - dia/2;
                                     const y = (parseInt(obs.abstandBoden) || 0) + len/2;
                                     const z = frontZ - (parseInt(obs.abstandTor) || 0) - dia/2;
                                     mesh.position.set(x, y, z);
                                } else if (dir === 'horizontalX') {
                                     const x = leftWall - (parseInt(obs.abstandLinks) || 0) - len/2;
                                     const y = (parseInt(obs.abstandBoden) || 0) + dia/2;
                                     const z = frontZ - (parseInt(obs.abstandTor) || 0) - dia/2;
                                     mesh.position.set(x, y, z);
                                     mesh.rotation.z = Math.PI / 2;
                                } else { // horizontalZ
                                     const x = leftWall - (parseInt(obs.abstandLinks) || 0) - dia/2;
                                     const y = (parseInt(obs.abstandBoden) || 0) + dia/2;
                                     const z = frontZ - (parseInt(obs.abstandTor) || 0) - len/2;
                                     mesh.position.set(x, y, z);
                                     mesh.rotation.x = Math.PI / 2;
                                }
                            } else { // unterzug or sonderteil
                                const w = parseInt(obs.w) || 150;
                                const h = parseInt(obs.h) || 150;
                                const d = parseInt(obs.d) || 150;
                                
                                geom = new THREE.BoxGeometry(w, h, d);
                                mesh = new THREE.Mesh(geom, mat);
                                
                                const x = leftWall - (parseInt(obs.abstandLinks) || 0) - w/2;
                                const y = (parseInt(obs.abstandBoden) || 0) + h/2;
                                const z = frontZ - (parseInt(obs.abstandTor) || 0) - d/2;
                                mesh.position.set(x, y, z);
                            }
                            
                            mesh.userData = { obstacleId: obs.id, isObstacle: true };
                            garageGroup.add(mesh);
                            
                            // WENN SELEKTIERT: INTERAKTIVE ZIEHGRIFFE (Handles) RENDERN
                            if (isSelected && !obs.locked && !window.placementMode) {
                                renderObstacleHandles(obs, mesh, leftWall, frontZ);
                            }
                        });
                    }

                    // Render snapping highlights
                    if (window.selectedObstacleId) {
                        const selectedObs = window.aufmassObstacles.find(o => o.id === window.selectedObstacleId);
                        if (selectedObs) {
                            window.updateSnappingHighlights(selectedObs);
                        } else {
                            window.updateSnappingHighlights(null);
                        }
                    } else {
                        window.updateSnappingHighlights(null);
                    }

                    // Falls der Debugger im HTML noch existiert, entfernen
                    const debugElement = document.getElementById('arrowDebugUI');
                    if (debugElement) {
                        debugElement.remove();
                    }
                }
                // ==========================================
            }

            const startObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) setTimeout(init3D, 150);
                });
            });
            startObserver.observe(document.getElementById('aufmassAppContainer'));

            // --- NEU: FOKUS-MANAGEMENT FÜR EINGABEFELDER (Verbessert) ---

            // 1. Fokus global verlieren bei Klick irgendwo anders (z.B. beim Drehen der 3D-Grafik)
            // 'capture: true' zwingt den Browser, das Feld abzuwählen, BEVOR die 3D-Kamera den Klick verschluckt.
            document.addEventListener('pointerdown', (event) => {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                    // Nur abwählen, wenn man nicht gerade absichtlich auf ein anderes Eingabefeld klickt
                    if (event.target.tagName !== 'INPUT') {
                        document.activeElement.blur();
                    }
                }
            }, { capture: true });

            // 2. Fokus verlieren bei Drücken der Enter-Taste
            document.querySelectorAll('.spatial-input, .admin-input, .discount-input').forEach(input => {
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Verhindert Standardverhalten
                        event.target.blur();    // Entzieht dem Feld den Fokus
                    }
                });
            });
            // ------------------------------------------------
            window.toggleQuickInputs = function() {
                const panel = document.getElementById('quickInputsPanel');
                const btn = document.getElementById('quickInputsToggle');
                if (!panel || !btn) return;
                panel.classList.toggle('collapsed');
                if (panel.classList.contains('collapsed')) {
                    btn.innerHTML = '▶';
                    btn.title = 'Menü ausklappen';
                } else {
                    btn.innerHTML = '◀';
                    btn.title = 'Menü einklappen';
                }
            };

            window.toggleRightMenu = function() {
                const panel = document.getElementById('rightSidePanel');
                const btn = document.getElementById('rightMenuToggleBtn');
                if (!panel || !btn) return;
                panel.classList.toggle('collapsed');
                if (panel.classList.contains('collapsed')) {
                    btn.innerHTML = '◀';
                    btn.title = 'Menü ausklappen';
                } else {
                    btn.innerHTML = '▶';
                    btn.title = 'Menü einklappen';
                }
            };

            window.toggleFaqButton = function() {
                const container = document.getElementById('aufmassFaqButtonContainer');
                const btn = document.getElementById('faqButtonToggle');
                if (!container || !btn) return;
                
                const isCollapsed = container.classList.toggle('collapsed');
                if (isCollapsed) {
                    btn.innerHTML = '▲';
                    btn.title = 'Hinweise ausklappen';
                } else {
                    btn.innerHTML = '▼';
                    btn.title = 'Hinweise einklappen';
                }
            };

            window.toggleSceneProposalMenu = function() {
                const menu = document.getElementById('sceneProposalMenu');
                const btn = document.getElementById('sceneProposalToggle');
                if (!menu || !btn) return;
                menu.classList.toggle('collapsed');
                if (menu.classList.contains('collapsed')) {
                    btn.innerHTML = '▲';
                    btn.title = 'Torauswahl ausklappen';
                } else {
                    btn.innerHTML = '▼';
                    btn.title = 'Torauswahl einklappen';
                }
            };

            window.syncSceneProposalMenuState = function() {
                const settingsActive = document.getElementById('settingsOptions').classList.contains('active');
                const obstaclesActive = document.getElementById('obstacleMenuContent').classList.contains('active');
                
                const proposalMenu = document.getElementById('sceneProposalMenu');
                const proposalToggle = document.getElementById('sceneProposalToggle');
                if (!proposalMenu || !proposalToggle) return;
                
                const numObstacles = (window.aufmassObstacles || []).length;
                const isEditingObstacle = window.selectedObstacleId !== null;
                
                const shouldCollapse = settingsActive || (obstaclesActive && (numObstacles >= 5 || isEditingObstacle));
                
                if (shouldCollapse) {
                    if (!proposalMenu.classList.contains('collapsed')) {
                        proposalMenu.classList.add('collapsed');
                        proposalToggle.innerHTML = '▲';
                        proposalToggle.title = 'Torauswahl ausklappen';
                    }
                } else {
                    if (proposalMenu.classList.contains('collapsed')) {
                        proposalMenu.classList.remove('collapsed');
                        proposalToggle.innerHTML = '▼';
                        proposalToggle.title = 'Torauswahl einklappen';
                    }
                }
            };

            window.toggleMainDoor = function(forceShow = null) {
                const cb = document.getElementById('toggleDoorDetail');
                const btn = document.getElementById('mainDoorToggleBtn');

                if (!cb || !btn) return;

                if (forceShow !== null) {
                    cb.checked = forceShow;
                } else {
                    cb.checked = !cb.checked;
                }

                const sectionalDoorSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /></svg>';

                if (cb.checked) {
                    btn.innerHTML = sectionalDoorSvg + ' Tor ausblenden';
                    btn.style.background = '#38bdf8';
                    btn.style.color = '#0f172a';
                } else {
                    btn.innerHTML = sectionalDoorSvg + ' Tor einblenden';
                    btn.style.background = '#1e293b';
                    btn.style.color = '#38bdf8';
                }

                if (typeof update3D === 'function') update3D();
            };

            function setCameraView(view) {
                if (!camera || !controls) return;

                const v = typeof getVisualVars === 'function' ? getVisualVars() : { A: 2500, B: 2125, G: 4000 };

                const distFront = Math.max(v.A * 1.7, 4500);
                const distBack = Math.max(v.A * 1.4, 3500);
                const distSide = Math.max(v.G * 1.6, 5000);

                const targetLookAt = { x: 0, y: v.B / 2, z: 0 };
                let targetPos = { x: 0, y: v.B / 2 + 500, z: distFront };

                switch (view) {
                    case 'front':
                        targetPos = { x: 0, y: v.B / 2 + 500, z: distFront };
                        break;
                    case 'back':
                        targetPos = { x: 0, y: v.B / 2 + 500, z: -distBack };
                        break;
                    case 'left':
                        targetPos = { x: -distSide, y: v.B / 2 + 500, z: 0 };
                        break;
                    case 'right':
                        targetPos = { x: distSide, y: v.B / 2 + 500, z: 0 };
                        break;
                }

                if (typeof gsap !== 'undefined') {
                    gsap.to(camera.position, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1, ease: "power2.inOut" });
                    gsap.to(controls.target, { x: targetLookAt.x, y: targetLookAt.y, z: targetLookAt.z, duration: 1, ease: "power2.inOut", onUpdate: () => controls.update() });
                } else {
                    camera.position.set(targetPos.x, targetPos.y, targetPos.z);
                    controls.target.set(targetLookAt.x, targetLookAt.y, targetLookAt.z);
                    controls.update();
                }
            }

            // --- HINDERNIS-STEUERUNGS & INTERAKTIONS-FUNKTIONEN ---
            function renderObstacleHandles(obs, mesh, leftWall, frontZ) {
                const handleGeo = new THREE.SphereGeometry(35, 16, 16);
                
                const w = parseInt(obs.w) || 150;
                const h = parseInt(obs.h) || 150;
                const d = parseInt(obs.d) || 150;
                
                const dia = parseInt(obs.diameter) || 70;
                const len = parseInt(obs.length) || 1000;
                const dir = obs.direction || 'vertical';
                
                const createHandle = (pos, axis, colorHex) => {
                    const mat = new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false, transparent: true, opacity: 0.9 });
                    const handle = new THREE.Mesh(handleGeo, mat);
                    handle.position.copy(pos);
                    handle.renderOrder = 999;
                    handle.userData = { isHandle: true, axis: axis, obstacleId: obs.id, originalColor: colorHex };
                    garageGroup.add(handle);
                };
                
                if (obs.type === 'rohr') {
                    if (dir === 'vertical') {
                        const x = leftWall - (parseInt(obs.abstandLinks) || 0) - dia/2;
                        const yTop = (parseInt(obs.abstandBoden) || 0) + len;
                        const z = frontZ - (parseInt(obs.abstandTor) || 0) - dia/2;
                        createHandle(new THREE.Vector3(x, yTop, z), 'len', 0x22c55e); // Green (length)
                        createHandle(new THREE.Vector3(x - dia/2, (parseInt(obs.abstandBoden) || 0) + len/2, z), 'dia', 0xef4444); // Red (dia)
                    } else if (dir === 'horizontalX') {
                        const xStart = leftWall - (parseInt(obs.abstandLinks) || 0);
                        const y = (parseInt(obs.abstandBoden) || 0) + dia/2;
                        const z = frontZ - (parseInt(obs.abstandTor) || 0) - dia/2;
                        createHandle(new THREE.Vector3(xStart - len, y, z), 'len', 0x3b82f6); // Blue (length)
                        createHandle(new THREE.Vector3(xStart - len/2, y + dia/2, z), 'dia', 0x22c55e); // Green (dia)
                    } else { // horizontalZ
                        const x = leftWall - (parseInt(obs.abstandLinks) || 0) - dia/2;
                        const y = (parseInt(obs.abstandBoden) || 0) + dia/2;
                        const zStart = frontZ - (parseInt(obs.abstandTor) || 0);
                        createHandle(new THREE.Vector3(x, y, zStart - len), 'len', 0xf59e0b); // Orange (length)
                        createHandle(new THREE.Vector3(x, y + dia/2, zStart - len/2), 'dia', 0x22c55e); // Green (dia)
                    }
                } else {
                    const xL = leftWall - (parseInt(obs.abstandLinks) || 0);
                    const yB = (parseInt(obs.abstandBoden) || 0);
                    const zT = frontZ - (parseInt(obs.abstandTor) || 0);
                    createHandle(new THREE.Vector3(xL - w, yB + h/2, zT - d/2), 'w', 0x3b82f6); // Blue (w)
                    createHandle(new THREE.Vector3(xL - w/2, yB + h, zT - d/2), 'h', 0x22c55e); // Green (h)
                    createHandle(new THREE.Vector3(xL - w/2, yB + h/2, zT - d), 'd', 0xf59e0b); // Orange (d)
                }

                // Spezial-Repositionierungs-Griff (Magentafarbener Pin) intelligent platzieren, sodass er nie in Decke/Wand liegt
                const v = getVisualVars();
                const avgCeilHeight = (v.F1 + v.F2) / 2;
                let repoPos;
                if (obs.type === 'rohr') {
                    if (dir === 'vertical') {
                        const x = leftWall - (parseInt(obs.abstandLinks) || 0) - dia/2;
                        const yBottom = (parseInt(obs.abstandBoden) || 0);
                        const z = frontZ - (parseInt(obs.abstandTor) || 0) - dia/2;
                        repoPos = new THREE.Vector3(x, Math.max(50, yBottom - 60), z);
                    } else if (dir === 'horizontalX') {
                        const xStart = leftWall - (parseInt(obs.abstandLinks) || 0);
                        const y = (parseInt(obs.abstandBoden) || 0) + dia/2;
                        const z = frontZ - (parseInt(obs.abstandTor) || 0) - dia/2;
                        repoPos = new THREE.Vector3(xStart + 60, y, z);
                    } else { // horizontalZ
                        const x = leftWall - (parseInt(obs.abstandLinks) || 0) - dia/2;
                        const y = (parseInt(obs.abstandBoden) || 0) + dia/2;
                        const zStart = frontZ - (parseInt(obs.abstandTor) || 0);
                        repoPos = new THREE.Vector3(x, y, zStart + 60);
                    }
                } else {
                    const xL = leftWall - (parseInt(obs.abstandLinks) || 0);
                    const yB = (parseInt(obs.abstandBoden) || 0);
                    const zT = frontZ - (parseInt(obs.abstandTor) || 0);
                    if (obs.type === 'unterzug' || yB + h > avgCeilHeight - 150) {
                        // Deckenbalken oder hohes Bauteil -> Pin IMMER unten hängen lassen
                        repoPos = new THREE.Vector3(xL - w/2, yB - 60, zT - d/2);
                    } else {
                        repoPos = new THREE.Vector3(xL - w/2, yB + h + 60, zT - d/2);
                    }
                }
                createHandle(repoPos, 'reposition', 0xd946ef); // Magenta Repositionierungs-Pin
            }

            // --- HINDERNISSE UI & INTERAKTION LOGIK ---
            window.selectedObstacleId = null;
            window.placementMode = false;
            window.activeDragHandle = null;
            
            window.clampObstaclePositions = function (obs) {
                const v = getVisualVars();
                const avgCeilHeight = (v.F1 + v.F2) / 2;
                
                // 1. Zuerst die Abmessungen des Objekts selbst auf die physikalischen Grenzen des Raums begrenzen
                const maxRoomW = (v.E1 + v.E2) / 2;
                const maxRoomH = avgCeilHeight;
                const maxRoomD = v.G;

                if (obs.type === 'rohr') {
                    const dia = Math.max(10, Math.min(parseInt(obs.diameter) || 70, 1000));
                    obs.diameter = dia;
                    const dir = obs.direction || 'vertical';
                    if (dir === 'vertical') {
                        obs.length = Math.max(10, Math.min(parseInt(obs.length) || 1000, maxRoomH));
                    } else if (dir === 'horizontalX') {
                        obs.length = Math.max(10, Math.min(parseInt(obs.length) || 1000, maxRoomW));
                    } else { // horizontalZ
                        obs.length = Math.max(10, Math.min(parseInt(obs.length) || 1000, maxRoomD));
                    }
                } else {
                    obs.w = Math.max(10, Math.min(parseInt(obs.w) || 150, maxRoomW));
                    obs.h = Math.max(10, Math.min(parseInt(obs.h) || 150, maxRoomH));
                    obs.d = Math.max(10, Math.min(parseInt(obs.d) || 150, maxRoomD));
                }

                let obsW = 0, obsH = 0, obsD = 0;
                if (obs.type === 'rohr') {
                    const dia = parseInt(obs.diameter) || 70;
                    const len = parseInt(obs.length) || 1000;
                    const dir = obs.direction || 'vertical';
                    if (dir === 'vertical') {
                        obsW = dia;
                        obsH = len;
                        obsD = dia;
                    } else if (dir === 'horizontalX') {
                        obsW = len;
                        obsH = dia;
                        obsD = dia;
                    } else { // horizontalZ
                        obsW = dia;
                        obsH = dia;
                        obsD = len;
                    }
                } else {
                    obsW = parseInt(obs.w) || 150;
                    obsH = parseInt(obs.h) || 150;
                    obsD = parseInt(obs.d) || 150;
                }
                
                // Grenzen berechnen und anwenden (Kollisionsschutz)
                const maxLinks = Math.max(0, (v.E1 + v.E2) / 2 - obsW);
                obs.abstandLinks = Math.min(Math.max(0, parseInt(obs.abstandLinks) || 0), maxLinks);
                
                if (obs.type === 'unterzug') {
                    obs.abstandBoden = Math.max(0, avgCeilHeight - obsH);
                } else {
                    const maxBoden = Math.max(0, avgCeilHeight - obsH);
                    obs.abstandBoden = Math.min(Math.max(0, parseInt(obs.abstandBoden) || 0), maxBoden);
                }
                
                const maxTor = Math.max(0, v.G - obsD);
                obs.abstandTor = Math.min(Math.max(0, parseInt(obs.abstandTor) || 0), maxTor);
            };
            
            window.addObstacleDirect = function (type) {
                const select = document.getElementById('obsTypeAdd');
                if (select) {
                    select.value = type;
                    window.addObstacleFromUI();
                }
            };

            window.addObstacleFromUI = function () {
                const typeSelect = document.getElementById('obsTypeAdd');
                if (!typeSelect) return;
                const type = typeSelect.value;
                
                // Anzahllimits prüfen
                const countByType = window.aufmassObstacles.filter(o => o.type === type).length;
                if (type === 'unterzug' && countByType >= 2) {
                    alert("Maximal 2 Unterzüge sind erlaubt.");
                    return;
                }
                if (type === 'rohr' && countByType >= 3) {
                    alert("Maximal 3 Rohrleitungen sind erlaubt.");
                    return;
                }
                if (type === 'sonderteil' && countByType >= 3) {
                    alert("Maximal 3 Sonderteile sind erlaubt.");
                    return;
                }
                
                let w = 150, h = 150, d = 150;
                let diameter = 70, length = 1000, direction = 'vertical';
                let name = "Unterzug";
                let index = countByType + 1;
                
                if (type === 'unterzug') {
                    const v = getVisualVars();
                    w = v.A + v.C1 + v.C2;
                    h = 200;
                    d = 150;
                    name = `Unterzug ${index}`;
                } else if (type === 'rohr') {
                    diameter = 70;
                    length = 1000;
                    direction = 'vertical';
                    name = `Rohr ${index}`;
                } else {
                    w = 150;
                    h = 150;
                    d = 150;
                    name = `Sonderteil ${index}`;
                }
                
                const newObs = {
                    id: 'obs_' + Date.now(),
                    type: type,
                    name: name,
                    w: w, h: h, d: d,
                    diameter: diameter,
                    length: length,
                    direction: direction,
                    abstandLinks: 0,
                    abstandTor: 100,
                    abstandBoden: type === 'unterzug' ? 1800 : 0
                };
                
                window.aufmassObstacles.push(newObs);
                window.selectedObstacleId = newObs.id;
                
                window.placementMode = true;
                window.placementObstacleId = newObs.id;
                if (controls) controls.enabled = false;
                
                window.saveObstaclesToStorage();
                window.renderObstacleListUI();
                window.selectObstacleUI(newObs.id);
                
                calculateAufmass();
                update3D();
            };
            
            window.renderObstacleListUI = function () {
                const addAndListContainer = document.getElementById('obsAddAndListContainer');
                const editPanel = document.getElementById('obsEditPanel');
                if (window.selectedObstacleId) {
                    if (addAndListContainer) addAndListContainer.style.display = 'none';
                    if (editPanel) editPanel.style.display = 'block';
                } else {
                    if (addAndListContainer) addAndListContainer.style.display = 'block';
                    if (editPanel) editPanel.style.display = 'none';
                }

                const listContainer = document.getElementById('obsListContainer');
                if (!listContainer) return;
                listContainer.innerHTML = '';
                
                if (!window.aufmassObstacles || window.aufmassObstacles.length === 0) {
                    listContainer.innerHTML = '<p style="color:#94a3b8; font-size:0.8rem; font-style:italic; margin:4px 0; text-align:center; width:100%;">Keine Hindernisse eingetragen.</p>';
                    return;
                }
                
                window.aufmassObstacles.forEach(obs => {
                    const isSelected = obs.id === window.selectedObstacleId;
                    const item = document.createElement('div');
                    item.className = 'obs-chip' + (isSelected ? ' active' : '');
                    item.style.display = 'inline-flex';
                    item.style.alignItems = 'center';
                    item.style.gap = '6px';
                    item.style.padding = '4px 8px';
                    item.style.background = isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.05)';
                    item.style.border = isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)';
                    item.style.borderRadius = '20px';
                    item.style.fontSize = '0.75rem';
                    item.style.color = '#e2e8f0';
                    item.style.cursor = 'pointer';
                    item.style.opacity = '1.0';
                    item.style.transition = 'all 0.2s';
                    
                    item.onclick = () => {
                        window.selectObstacleUI(obs.id);
                    };
                    
                    let typeIcon = "📦";
                    if (obs.type === 'rohr') typeIcon = "🔘";
                    else if (obs.type === 'sonderteil') typeIcon = "💡";
                    
                    const label = document.createElement('span');
                    label.style.fontWeight = isSelected ? 'bold' : 'normal';
                    label.style.color = isSelected ? '#38bdf8' : '#e2e8f0';
                    label.innerHTML = `${typeIcon} ${obs.name}`;
                    item.appendChild(label);
                    
                    const lockBtn = document.createElement('span');
                    lockBtn.innerHTML = obs.locked ? '🔒' : '🔓';
                    lockBtn.style.cursor = 'pointer';
                    lockBtn.style.fontSize = '0.8rem';
                    lockBtn.title = obs.locked ? 'Entsperren' : 'Sperren';
                    lockBtn.onclick = (e) => {
                        e.stopPropagation();
                        window.toggleObstacleLock(obs.id);
                    };
                    item.appendChild(lockBtn);

                    if (!obs.locked) {
                        const delBtn = document.createElement('span');
                        delBtn.innerHTML = '🗑️';
                        delBtn.style.cursor = 'pointer';
                        delBtn.style.fontSize = '0.8rem';
                        delBtn.title = 'Löschen';
                        delBtn.onclick = (e) => {
                            e.stopPropagation();
                            window.deleteObstacle(obs.id);
                        };
                        item.appendChild(delBtn);
                    }
                    
                    listContainer.appendChild(item);
                });
                if (typeof window.syncSceneProposalMenuState === 'function') {
                    window.syncSceneProposalMenuState();
                }
            };
            
            window.selectObstacleUI = function (id) {
                // Sidebar auto-expand if collapsed
                const panel = document.getElementById('rightSidePanel');
                const btn = document.getElementById('rightMenuToggleBtn');
                if (panel && panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    if (btn) {
                        btn.innerHTML = '▶';
                        btn.title = 'Menü einklappen';
                    }
                }

                // Auto-expand "Hindernisse" accordion
                const obstacleMenu = document.getElementById('obstacleMenuContent');
                if (obstacleMenu && !obstacleMenu.classList.contains('active')) {
                    window.toggleMenu('obstacleMenuContent');
                }

                window.selectedObstacleId = id;
                window.renderObstacleListUI();
                
                const obs = window.aufmassObstacles.find(o => o.id === id);
                const editPanel = document.getElementById('obsEditPanel');
                if (!obs || !editPanel) {
                    if (editPanel) editPanel.style.display = 'none';
                    return;
                }
                
                editPanel.style.display = 'block';
                
                // Schloss-Symbol im Editierpanel aktualisieren
                const lockBtn = document.getElementById('obsEditLockBtn');
                if (lockBtn) {
                    lockBtn.innerHTML = obs.locked ? '🔒' : '🔓';
                    lockBtn.title = obs.locked ? 'Entsperren' : 'Sperren';
                }
                
                const isLocked = !!obs.locked;
                document.getElementById('obsEditName').disabled = isLocked;
                document.getElementById('obsEditPosLinks').disabled = isLocked;
                document.getElementById('obsEditPosTor').disabled = isLocked;
                document.getElementById('obsEditPosBoden').disabled = isLocked;
                document.getElementById('obsEditDia').disabled = isLocked;
                document.getElementById('obsEditLen').disabled = isLocked;
                document.getElementById('obsEditDir').disabled = isLocked;
                document.getElementById('obsEditW').disabled = isLocked;
                document.getElementById('obsEditH').disabled = isLocked;
                document.getElementById('obsEditD').disabled = isLocked;

                const delBtn = document.getElementById('obsEditDelBtn');
                if (delBtn) {
                    delBtn.disabled = isLocked;
                    delBtn.style.opacity = isLocked ? '0.5' : '1.0';
                    delBtn.style.cursor = isLocked ? 'not-allowed' : 'pointer';
                }

                const replaceBtn = document.getElementById('obsEditReplaceBtn');
                if (replaceBtn) {
                    replaceBtn.disabled = isLocked;
                    replaceBtn.style.opacity = isLocked ? '0.5' : '1.0';
                    replaceBtn.style.cursor = isLocked ? 'not-allowed' : 'pointer';
                }
                
                document.getElementById('obsEditName').value = obs.name;
                document.getElementById('obsEditPosLinks').value = obs.abstandLinks;
                document.getElementById('obsEditPosTor').value = obs.abstandTor;
                document.getElementById('obsEditPosBoden').value = obs.abstandBoden;
                
                const dimBox = document.getElementById('obsEditDimBox');
                const dimRohr = document.getElementById('obsEditDimRohr');
                const dirBox = document.getElementById('obsEditDirBox');
                
                if (obs.type === 'rohr') {
                    dimBox.style.display = 'none';
                    dimRohr.style.display = 'flex';
                    dirBox.style.display = 'block';
                    
                    document.getElementById('obsEditDia').value = obs.diameter;
                    document.getElementById('obsEditLen').value = obs.length;
                    document.getElementById('obsEditDir').value = obs.direction;
                } else {
                    dimBox.style.display = 'flex';
                    dimRohr.style.display = 'none';
                    dirBox.style.display = 'none';
                    
                    document.getElementById('obsEditW').value = obs.w;
                    document.getElementById('obsEditH').value = obs.h;
                    document.getElementById('obsEditD').value = obs.d;
                }
                
                update3D();
                if (typeof window.syncSceneProposalMenuState === 'function') {
                    window.syncSceneProposalMenuState();
                }
            };
            
            window.updateSelectedObstacleInputsUI = function (obs) {
                document.getElementById('obsEditPosLinks').value = obs.abstandLinks;
                document.getElementById('obsEditPosTor').value = obs.abstandTor;
                document.getElementById('obsEditPosBoden').value = obs.abstandBoden;
                if (obs.type === 'rohr') {
                    document.getElementById('obsEditDia').value = obs.diameter;
                    document.getElementById('obsEditLen').value = obs.length;
                } else {
                    document.getElementById('obsEditW').value = obs.w;
                    document.getElementById('obsEditH').value = obs.h;
                    document.getElementById('obsEditD').value = obs.d;
                }
            };
            
            window.deselectObstacleUI = function () {
                window.selectedObstacleId = null;
                window.placementMode = false;
                if (controls) controls.enabled = true;
                const editPanel = document.getElementById('obsEditPanel');
                if (editPanel) editPanel.style.display = 'none';
                window.renderObstacleListUI();
                update3D();
                if (typeof window.syncSceneProposalMenuState === 'function') {
                    window.syncSceneProposalMenuState();
                }
            };
            
            window.updateSelectedObstacleFromUI = function () {
                if (!window.selectedObstacleId) return;
                const obs = window.aufmassObstacles.find(o => o.id === window.selectedObstacleId);
                if (!obs) return;
                
                obs.name = document.getElementById('obsEditName').value || obs.name;
                obs.abstandLinks = parseInt(document.getElementById('obsEditPosLinks').value) || 0;
                obs.abstandTor = parseInt(document.getElementById('obsEditPosTor').value) || 0;
                obs.abstandBoden = parseInt(document.getElementById('obsEditPosBoden').value) || 0;
                
                if (obs.type === 'rohr') {
                    obs.diameter = parseInt(document.getElementById('obsEditDia').value) || 70;
                    obs.length = parseInt(document.getElementById('obsEditLen').value) || 1000;
                    obs.direction = document.getElementById('obsEditDir').value;
                } else {
                    obs.w = parseInt(document.getElementById('obsEditW').value) || 150;
                    obs.h = parseInt(document.getElementById('obsEditH').value) || 150;
                    obs.d = parseInt(document.getElementById('obsEditD').value) || 150;
                }
                
                window.clampObstaclePositions(obs);
                window.updateSelectedObstacleInputsUI(obs);
                
                window.saveObstaclesToStorage();
                window.renderObstacleListUI();
                calculateAufmass();
                update3D();
            };
            
            window.deleteObstacle = function (id) {
                const obs = window.aufmassObstacles.find(o => o.id === id);
                const name = obs ? obs.name : "dieses Bauteil";

                const modal = document.getElementById('aufmassConfirmModal');
                const msg = document.getElementById('aufmassConfirmMessage');
                const cancelBtn = document.getElementById('aufmassConfirmCancelBtn');
                const okBtn = document.getElementById('aufmassConfirmOkBtn');

                if (modal && msg && cancelBtn && okBtn) {
                    msg.innerHTML = `Möchten Sie <strong>"${name}"</strong> wirklich löschen?`;
                    modal.style.display = 'flex';

                    cancelBtn.onclick = function() {
                        modal.style.display = 'none';
                    };

                    okBtn.onclick = function() {
                        modal.style.display = 'none';
                        executeDelete(id);
                    };
                } else {
                    // Fallback
                    if (confirm('Möchten Sie "' + name + '" wirklich löschen?')) {
                        executeDelete(id);
                    }
                }
            };

            function executeDelete(id) {
                window.aufmassObstacles = window.aufmassObstacles.filter(o => o.id !== id);
                if (window.selectedObstacleId === id) {
                    window.selectedObstacleId = null;
                    window.placementMode = false;
                    if (controls) controls.enabled = true;
                    const editPanel = document.getElementById('obsEditPanel');
                    if (editPanel) editPanel.style.display = 'none';
                }
                window.saveObstaclesToStorage();
                window.renderObstacleListUI();
                calculateAufmass();
                update3D();
            }
            
            window.deleteSelectedObstacle = function () {
                if (window.selectedObstacleId) {
                    window.deleteObstacle(window.selectedObstacleId);
                }
            };
            
            window.toggleObstacleLock = function (id) {
                const obs = window.aufmassObstacles.find(o => o.id === id);
                if (!obs) return;
                obs.locked = !obs.locked;
                
                if (obs.locked && window.placementMode && window.placementObstacleId === id) {
                    window.placementMode = false;
                    if (controls) controls.enabled = true;
                }
                
                window.saveObstaclesToStorage();
                
                if (obs.locked && window.selectedObstacleId === id) {
                    window.deselectObstacleUI();
                    return;
                }
                
                window.renderObstacleListUI();
                if (window.selectedObstacleId === id) {
                    window.selectObstacleUI(id);
                }
                calculateAufmass();
                update3D();
            };
            
            window.toggleSelectedObstacleLock = function () {
                if (window.selectedObstacleId) {
                    window.toggleObstacleLock(window.selectedObstacleId);
                }
            };
            
            window.repositionSelectedObstacle = function () {
                if (!window.selectedObstacleId) return;
                const obs = window.aufmassObstacles.find(o => o.id === window.selectedObstacleId);
                if (!obs) return;
                if (obs.locked) {
                    alert("Dieses Bauteil ist gesperrt und kann nicht neu platziert werden.");
                    return;
                }
                window.placementMode = true;
                window.placementObstacleId = window.selectedObstacleId;
                if (controls) controls.enabled = false;
                update3D();
            };

            window.showObstacleDeductionModal = function () {
                const list = [];
                if (window.obstacleDeductionIsRelevant && window.lastObstacleDeductions) {
                    list.push(...window.lastObstacleDeductions);
                }
                if (window.roomKompensationIsActive && window.lastRoomAlertMessages) {
                    list.push(...window.lastRoomAlertMessages);
                }
                
                // Zusammenführen und Duplikate filtern
                const combined = Array.from(new Set(list));
                if (combined.length === 0) return;
                
                const listHtml = combined.map(d => `<li style="margin-bottom:8px; line-height:1.4;">${d}</li>`).join('');
                
                const modal = document.createElement('div');
                modal.id = 'obsDeductionModal';
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
                modal.style.background = 'rgba(15, 23, 42, 0.6)';
                modal.style.backdropFilter = 'blur(4px)';
                modal.style.zIndex = '9999';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                
                modal.innerHTML = `
                    <div style="background: white; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); max-width: 500px; width: 90%; padding: 20px; box-sizing: border-box; text-align: left; border-top: 5px solid #ef4444;">
                        <h3 style="margin-top: 0; color: #ef4444; display: flex; align-items: center; gap: 8px; font-size: 1.15rem; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                            <span>ℹ️ Einschränkungs-Detail-Erklärung</span>
                        </h3>
                        <p style="font-size: 0.9rem; color: #475569; margin-bottom: 15px; line-height: 1.4;">
                            Folgende Faktoren schränken den Montageraum in der Garage ein. Die Maße wurden entsprechend reduziert:
                        </p>
                        <ul style="margin: 0; padding-left: 20px; font-size: 0.9rem; color: #1e293b; margin-bottom: 20px; line-height: 1.4;">
                            ${listHtml}
                        </ul>
                        <button onclick="document.getElementById('obsDeductionModal').remove()" style="background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">Schließen</button>
                    </div>
                `;
                
                const targetContainer = document.fullscreenElement || document.getElementById('sceneWrapper') || document.body;
                targetContainer.appendChild(modal);
            };

            // --- RAYCASTER MOUSE INTERAKTION IN 3D ---
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            function onPointerMove(event) {
                const container = document.getElementById('garage3DCanvas');
                if (!container || !renderer || !camera) return;
                
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                
                if (window.placementMode && window.selectedObstacleId) {
                    raycaster.setFromCamera(mouse, camera);
                    const intersects = raycaster.intersectObjects(garageGroup.children, true);
                    if (intersects.length > 0) {
                        const hit = intersects.find(i => !i.object.userData.isObstacle && !i.object.userData.isHandle);
                        if (hit) {
                            const pt = hit.point;
                            const obs = window.aufmassObstacles.find(o => o.id === window.selectedObstacleId);
                            if (obs) {
                                const v = getVisualVars();
                                const visCenter = (v.C1 - v.C2) / 2;
                                const leftWall = visCenter + v.E1/2;
                                const frontZ = v.G/2 - 150;
                                
                                obs.abstandLinks = Math.max(0, Math.round(leftWall - pt.x));
                                obs.abstandBoden = Math.max(0, Math.round(pt.y));
                                obs.abstandTor = Math.max(0, Math.round(frontZ - pt.z));
                                
                                window.clampObstaclePositions(obs);
                                window.updateSelectedObstacleInputsUI(obs);
                                window.saveObstaclesToStorage();
                                calculateAufmass();
                                update3D();
                            }
                        }
                    }
                    return;
                }
                
                if (window.activeDragHandle && camera) {
                    raycaster.setFromCamera(mouse, camera);
                    const currentPoint = new THREE.Vector3();
                    if (raycaster.ray.intersectPlane(window.dragPlane, currentPoint)) {
                        const delta = currentPoint.clone().sub(window.activeDragHandle.initialDragPoint);
                        const obs = window.aufmassObstacles.find(o => o.id === window.activeDragHandle.obstacleId);
                        if (obs) {
                            const axis = window.activeDragHandle.axis;
                            let change = 0;
                            if (axis === 'w') change = -delta.x;
                            else if (axis === 'h') change = delta.y;
                            else if (axis === 'd') change = -delta.z;
                            else if (axis === 'len') {
                                const dir = obs.direction || 'vertical';
                                if (dir === 'vertical') change = delta.y;
                                else if (dir === 'horizontalX') change = -delta.x;
                                else change = -delta.z;
                            } else if (axis === 'dia') {
                                change = Math.max(-delta.x, delta.y);
                            }
                            
                            const newVal = Math.max(10, Math.round(window.activeDragHandle.initialHandleVal + change));
                            if (axis === 'w') obs.w = newVal;
                            else if (axis === 'h') obs.h = newVal;
                            else if (axis === 'd') obs.d = newVal;
                            else if (axis === 'len') obs.length = newVal;
                            else if (obs.type === 'rohr') obs.diameter = newVal;
                            
                            window.clampObstaclePositions(obs);
                            window.updateSelectedObstacleInputsUI(obs);
                            window.saveObstaclesToStorage();
                            calculateAufmass();
                            update3D();
                        }
                    }
                }

                // Tooltip initialisieren/holen
                let tooltip = document.getElementById('obs3DTooltip');
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.id = 'obs3DTooltip';
                    tooltip.style.position = 'fixed';
                    tooltip.style.background = 'rgba(15, 23, 42, 0.9)';
                    tooltip.style.color = '#38bdf8'; // Premium light blue!
                    tooltip.style.border = '1px solid rgba(56, 189, 248, 0.5)';
                    tooltip.style.padding = '6px 12px';
                    tooltip.style.borderRadius = '6px';
                    tooltip.style.fontSize = '0.8rem';
                    tooltip.style.fontWeight = 'bold';
                    tooltip.style.pointerEvents = 'none';
                    tooltip.style.zIndex = '9999';
                    tooltip.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
                    tooltip.style.display = 'none';
                    tooltip.innerHTML = '📍 Bauteil neu platzieren';
                    document.body.appendChild(tooltip);
                }

                // Haptisches & Grafisches Feedback: Alle Griffe zurücksetzen
                if (garageGroup) {
                    garageGroup.children.forEach(child => {
                        if (child.userData && child.userData.isHandle) {
                            child.scale.set(1.0, 1.0, 1.0);
                            if (child.userData.originalColor !== undefined) {
                                child.material.color.setHex(child.userData.originalColor);
                            }
                        }
                    });
                }

                if (window.activeDragHandle) {
                    // Wenn aktiv gezogen wird: den gezogenen Griff markieren und Mauszeiger anpassen
                    document.body.style.cursor = 'ns-resize';
                    const activeId = window.activeDragHandle.obstacleId;
                    const activeAxis = window.activeDragHandle.axis;
                    if (garageGroup) {
                        garageGroup.children.forEach(child => {
                            if (child.userData && child.userData.isHandle && child.userData.obstacleId === activeId && child.userData.axis === activeAxis) {
                                child.scale.set(1.6, 1.6, 1.6);
                                child.material.color.setHex(0xffffff); // Reinweiß beim Ziehen
                            }
                        });
                    }
                    if (tooltip) tooltip.style.display = 'none';
                    return;
                }

                // Falls nicht im Drag-Modus: Raycasting für Hover durchführen
                let showTooltip = false;
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(garageGroup.children, true);
                if (intersects.length > 0) {
                    const handleHit = intersects.find(i => i.object.userData && i.object.userData.isHandle);
                    const hit = handleHit || intersects[0];
                    if (hit.object.userData.isHandle) {
                        const obsId = hit.object.userData.obstacleId;
                        const obs = window.aufmassObstacles.find(o => o.id === obsId);
                        if (obs && !obs.locked) {
                            if (hit.object.userData.axis === 'reposition') {
                                document.body.style.cursor = 'pointer';
                                showTooltip = true;
                                tooltip.style.left = (event.clientX + 15) + 'px';
                                tooltip.style.top = (event.clientY + 15) + 'px';
                            } else {
                                document.body.style.cursor = 'ns-resize';
                            }
                            hit.object.scale.set(1.4, 1.4, 1.4);
                            hit.object.material.color.setHex(0xffeb3b); // Leuchtgelb bei Hover
                        } else {
                            document.body.style.cursor = 'default';
                        }
                    } else if (hit.object.userData.isObstacle) {
                        document.body.style.cursor = 'pointer';
                    } else {
                        document.body.style.cursor = 'default';
                    }
                } else {
                    document.body.style.cursor = 'default';
                }

                if (tooltip) tooltip.style.display = showTooltip ? 'block' : 'none';
            }
            
            function onPointerDown(event) {
                if (event.button !== 0) return;
                
                const container = document.getElementById('garage3DCanvas');
                if (!container || !renderer || !camera) return;
                
                // Mauskoordinaten für Klick-vs-Drag-Prüfung speichern
                window.placementDownX = event.clientX;
                window.placementDownY = event.clientY;
                
                if (window.placementMode) {
                    return; // In Platzierungs-Modus: Behandlung auf mouse up verlagern!
                }
                
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(garageGroup.children, true);
                
                if (intersects.length > 0) {
                    const handleHit = intersects.find(i => i.object.userData && i.object.userData.isHandle);
                    const hit = handleHit || intersects[0];
                    
                    if (hit.object.userData.isHandle) {
                        const axis = hit.object.userData.axis;
                        const obsId = hit.object.userData.obstacleId;
                        const obs = window.aufmassObstacles.find(o => o.id === obsId);
                        
                        if (obs && obs.locked) {
                            return;
                        }
                        
                        if (axis === 'reposition') {
                            const tooltip = document.getElementById('obs3DTooltip');
                            if (tooltip) tooltip.style.display = 'none';
                            window.repositionSelectedObstacle();
                            return;
                        }
                        
                        if (controls) controls.enabled = false;
                        
                        if (obs) {
                            window.dragPlane = new THREE.Plane();
                            const dir = new THREE.Vector3();
                            camera.getWorldDirection(dir);
                            window.dragPlane.setFromNormalAndCoplanarPoint(dir.negate(), hit.object.position);
                            
                            const intersectPoint = new THREE.Vector3();
                            raycaster.ray.intersectPlane(window.dragPlane, intersectPoint);
                            
                            let initialVal = obs.w;
                            if (axis === 'h') initialVal = obs.h;
                            else if (axis === 'd') initialVal = obs.d;
                            else if (axis === 'len') initialVal = obs.length;
                            else if (axis === 'dia') initialVal = obs.diameter;
                            
                            window.activeDragHandle = {
                                axis: axis,
                                obstacleId: obsId,
                                initialDragPoint: intersectPoint.clone(),
                                initialHandleVal: initialVal
                            };
                        }
                        return;
                    }
                    
                    if (hit.object.userData.isObstacle) {
                        window.selectObstacleUI(hit.object.userData.obstacleId);
                        return;
                    }
                }
            }
            
            function onPointerUp(event) {
                if (window.placementMode) {
                    // Abstand prüfen (Click-Toleranz)
                    const dx = event.clientX - (window.placementDownX || 0);
                    const dy = event.clientY - (window.placementDownY || 0);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 5) { // Reiner Klick zum Absetzen!
                        window.placementMode = false;
                        if (controls) controls.enabled = true;
                        window.renderObstacleListUI();
                        update3D();
                    }
                    return;
                }
                
                if (window.activeDragHandle) {
                    window.activeDragHandle = null;
                    if (controls) controls.enabled = true;
                }
            }
            
            window.updateSnappingHighlights = function (obs) {
                if (!scene || !obs) {
                    if (window.snapHighlightsGroup) {
                        while (window.snapHighlightsGroup.children.length > 0) {
                            window.snapHighlightsGroup.remove(window.snapHighlightsGroup.children[0]);
                        }
                    }
                    return;
                }

                if (!window.snapHighlightsGroup) {
                    window.snapHighlightsGroup = new THREE.Group();
                    scene.add(window.snapHighlightsGroup);
                }

                // Clear previous highlights
                while (window.snapHighlightsGroup.children.length > 0) {
                    window.snapHighlightsGroup.remove(window.snapHighlightsGroup.children[0]);
                }

                // Check if in placement mode or actively dragging
                if (!window.placementMode && !window.activeDragHandle) {
                    return;
                }

                const v = getVisualVars();
                const avgCeilHeight = (v.F1 + v.F2) / 2;
                const visCenter = (v.C1 - v.C2) / 2;
                const leftWallX = visCenter + v.E1 / 2;
                const rightWallX = visCenter - v.E2 / 2;
                const roomDepth = v.G - 150;
                const frontZ = v.G / 2 - 150;
                const zCenterRoom = frontZ - roomDepth / 2;

                let obsW = 0, obsH = 0, obsD = 0;
                if (obs.type === 'rohr') {
                    const dia = parseInt(obs.diameter) || 70;
                    const len = parseInt(obs.length) || 1000;
                    const dir = obs.direction || 'vertical';
                    if (dir === 'vertical') {
                        obsW = dia; obsH = len; obsD = dia;
                    } else if (dir === 'horizontalX') {
                        obsW = len; obsH = dia; obsD = dia;
                    } else {
                        obsW = dia; obsH = dia; obsD = len;
                    }
                } else {
                    obsW = parseInt(obs.w) || 150;
                    obsH = parseInt(obs.h) || 150;
                    obsD = parseInt(obs.d) || 150;
                }

                const maxLinks = Math.max(0, (v.E1 + v.E2) / 2 - obsW);
                const maxBoden = Math.max(0, avgCeilHeight - obsH);

                const snapDist = 5; // Snap detection within 5mm

                const isSnappedLeft = obs.abstandLinks <= snapDist;
                const isSnappedRight = obs.abstandLinks >= maxLinks - snapDist;
                const isSnappedFloor = obs.abstandBoden <= snapDist;
                const isSnappedCeiling = obs.abstandBoden >= maxBoden - snapDist;
                const isSnappedFront = obs.abstandTor <= snapDist;

                // Glowing material for snapping highlights
                const glowMat = new THREE.MeshBasicMaterial({
                    color: 0x22c55e, // Neon Green
                    transparent: true,
                    opacity: 0.35,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });

                const lineMat = new THREE.LineBasicMaterial({
                    color: 0x22c55e,
                    linewidth: 2,
                    depthWrite: false
                });

                const addHighlightPlane = (width, height, pos, rot) => {
                    const planeGeo = new THREE.PlaneGeometry(width, height);
                    const planeMesh = new THREE.Mesh(planeGeo, glowMat);
                    planeMesh.position.copy(pos);
                    if (rot) planeMesh.rotation.copy(rot);
                    window.snapHighlightsGroup.add(planeMesh);

                    // Add outline
                    const edges = new THREE.EdgesGeometry(planeGeo);
                    const line = new THREE.LineSegments(edges, lineMat);
                    line.position.copy(pos);
                    if (rot) line.rotation.copy(rot);
                    window.snapHighlightsGroup.add(line);
                };

                // 1. Left Wall (near C1, positive X)
                if (isSnappedLeft) {
                    addHighlightPlane(
                        roomDepth,
                        avgCeilHeight,
                        new THREE.Vector3(leftWallX, avgCeilHeight / 2, zCenterRoom),
                        new THREE.Euler(0, -Math.PI / 2, 0)
                    );
                }

                // 2. Right Wall (near C2, negative X)
                if (isSnappedRight) {
                    addHighlightPlane(
                        roomDepth,
                        avgCeilHeight,
                        new THREE.Vector3(rightWallX, avgCeilHeight / 2, zCenterRoom),
                        new THREE.Euler(0, Math.PI / 2, 0)
                    );
                }

                // 3. Floor
                if (isSnappedFloor) {
                    addHighlightPlane(
                        leftWallX - rightWallX,
                        roomDepth,
                        new THREE.Vector3(visCenter + (v.E1 - v.E2) / 4, 1, zCenterRoom),
                        new THREE.Euler(Math.PI / 2, 0, 0)
                    );
                }

                // 4. Ceiling
                if (isSnappedCeiling) {
                    addHighlightPlane(
                        leftWallX - rightWallX,
                        roomDepth,
                        new THREE.Vector3(visCenter + (v.E1 - v.E2) / 4, avgCeilHeight - 1, zCenterRoom),
                        new THREE.Euler(-Math.PI / 2, 0, 0)
                    );
                }

                // 5. Front Wall / Reveal (Torwand)
                if (isSnappedFront) {
                    addHighlightPlane(
                        leftWallX - rightWallX,
                        avgCeilHeight,
                        new THREE.Vector3(visCenter + (v.E1 - v.E2) / 4, avgCeilHeight / 2, frontZ - 1),
                        new THREE.Euler(0, Math.PI, 0)
                    );
                }
            };


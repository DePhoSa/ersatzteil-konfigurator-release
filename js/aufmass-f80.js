/**
 * Aufmaß-Pilot: Schwingtor F80
 * Berechnungs- und 2D-Visualisierungs-Engine
 */

(function () {
    'use strict';

    window.f80State = {
        width: 2720,
        height: 2200,
        fasche: '',
        anschlag: 30,
        wandstaerke: 101,
        selectedBRB: 2635,
        selectedBRH: 2150,
        userCustomBRB: false,
        userCustomBRH: false
    };

    window.initAufmassF80 = function () {
        const inputW = document.getElementById('inputF80Width');
        const inputH = document.getElementById('inputF80Height');
        const inputFasche = document.getElementById('inputF80Fasche');
        const inputAnschlag = document.getElementById('inputF80Anschlag');
        const inputWand = document.getElementById('inputF80Wandstaerke');

        if (inputW) inputW.value = window.f80State.width;
        if (inputH) inputH.value = window.f80State.height;
        if (inputFasche) inputFasche.value = window.f80State.fasche;
        if (inputAnschlag) inputAnschlag.value = window.f80State.anschlag;
        if (inputWand) inputWand.value = window.f80State.wandstaerke;

        window.calcF80();
    };

    window.stepF80Input = function (fieldId, step) {
        const input = document.getElementById(fieldId);
        if (!input) return;
        let val = parseInt(input.value) || 0;
        val += step;
        if (fieldId === 'inputF80Width') val = Math.max(1000, Math.min(4000, val));
        if (fieldId === 'inputF80Height') val = Math.max(1000, Math.min(3000, val));
        if (fieldId === 'inputF80Anschlag') val = Math.max(0, Math.min(200, val));
        if (fieldId === 'inputF80Wandstaerke') val = Math.max(50, Math.min(500, val));
        input.value = val;
        window.calcF80();
    };

    window.stepF80BRB = function (step) {
        let cur = window.f80State.selectedBRB || 2635;
        cur += step;
        cur = Math.round(cur / 5) * 5;
        window.f80State.selectedBRB = cur;
        window.f80State.userCustomBRB = true;
        const brbInput = document.getElementById('inputF80BRB');
        if (brbInput) brbInput.value = cur;
        window.calcF80(false);
    };

    window.stepF80BRH = function (step) {
        let cur = window.f80State.selectedBRH || 2150;
        cur += step;
        cur = Math.round(cur / 5) * 5;
        window.f80State.selectedBRH = cur;
        window.f80State.userCustomBRH = true;
        const brhInput = document.getElementById('inputF80BRH');
        if (brhInput) brhInput.value = cur;
        window.calcF80(false);
    };

    window.onF80BRBChange = function () {
        const brbInput = document.getElementById('inputF80BRB');
        if (!brbInput) return;
        let val = parseInt(brbInput.value) || 2635;
        val = Math.round(val / 5) * 5;
        brbInput.value = val;
        window.f80State.selectedBRB = val;
        window.f80State.userCustomBRB = true;
        window.calcF80(false);
    };

    window.onF80BRHChange = function () {
        const brhInput = document.getElementById('inputF80BRH');
        if (!brhInput) return;
        let val = parseInt(brhInput.value) || 2150;
        val = Math.round(val / 5) * 5;
        brhInput.value = val;
        window.f80State.selectedBRH = val;
        window.f80State.userCustomBRH = true;
        window.calcF80(false);
    };

    window.resetF80ToOptimal = function () {
        window.f80State.userCustomBRB = false;
        window.f80State.userCustomBRH = false;
        window.calcF80(true);
    };

    window.calcF80 = function (resetCustom = false) {
        const inputW = document.getElementById('inputF80Width');
        const inputH = document.getElementById('inputF80Height');
        const inputAnschlag = document.getElementById('inputF80Anschlag');
        const inputWand = document.getElementById('inputF80Wandstaerke');

        const width = inputW ? (parseInt(inputW.value) || 2720) : 2720;
        const height = inputH ? (parseInt(inputH.value) || 2200) : 2200;
        const anschlag = inputAnschlag ? (parseInt(inputAnschlag.value) || 0) : 30;
        const wandstaerke = inputWand ? (parseInt(inputWand.value) || 101) : 101;

        window.f80State.width = width;
        window.f80State.height = height;
        window.f80State.anschlag = anschlag;
        window.f80State.wandstaerke = wandstaerke;

        if (resetCustom) {
            window.f80State.userCustomBRB = false;
            window.f80State.userCustomBRH = false;
        }

        // 1. Montageart (Dübel vs. Klemm)
        const isDuebel = wandstaerke >= 101;
        const montageBadge = document.getElementById('f80MontageBadge');
        if (montageBadge) {
            if (isDuebel) {
                montageBadge.innerHTML = `<span style="background: #e6f7ec; color: #16a34a; padding: 6px 12px; border-radius: 6px; border: 1px solid #bbf7d0; font-weight: bold; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">✅ Dübel ohne Faschen</span>`;
            } else {
                montageBadge.innerHTML = `<span style="background: #eff6ff; color: #2563eb; padding: 6px 12px; border-radius: 6px; border: 1px solid #bfdbfe; font-weight: bold; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">🔧 Klemm ohne Faschen</span>`;
            }
        }

        // 2. Mathematische Grenzwerte BREITE
        // Min BRB: ÖB - 114 mm -> aufgerundet auf 5er Raster
        const minBRB = Math.ceil((width - 114) / 5) * 5;
        // Max BRB: ÖB - 74 mm -> abgerundet auf 5er Raster
        const maxBRB = Math.floor((width - 74) / 5) * 5;
        // Optimal: Max BRB - 10 mm
        const optBRB = maxBRB - 10;
        const rambProposal = width + 50;
        const brbProposalExact = Math.round(width - 84);

        if (!window.f80State.userCustomBRB) {
            window.f80State.selectedBRB = optBRB;
        }

        const selectedBRB = window.f80State.selectedBRB;
        const brbInput = document.getElementById('inputF80BRB');
        if (brbInput && document.activeElement !== brbInput) {
            brbInput.value = selectedBRB;
        }

        // RAMB bei gewähltem BRB: BRB + 134 mm
        const selectedRAMB = selectedBRB + 134;
        // Überdeckung links/rechts: (RAMB - ÖB) / 2
        const ueberdeckungB = (selectedRAMB - width) / 2;

        // 3. Mathematische Grenzwerte HÖHE
        const hEff = height + anschlag;
        // Min BRH: hEff - 90 mm -> aufgerundet auf 5er Raster
        const minBRH = Math.ceil((hEff - 90) / 5) * 5;
        // Max BRH: hEff - 75 mm -> abgerundet auf 5er Raster
        const maxBRH = Math.floor((hEff - 75) / 5) * 5;
        // Optimal: hEff - 80 mm -> gerundet auf 5er Raster
        const optBRH = Math.round((hEff - 80) / 5) * 5;
        const ramhProposal = hEff + 25;
        const brhProposalExact = Math.round(hEff - 78);

        if (!window.f80State.userCustomBRH) {
            window.f80State.selectedBRH = optBRH;
        }

        const selectedBRH = window.f80State.selectedBRH;
        const brhInput = document.getElementById('inputF80BRH');
        if (brhInput && document.activeElement !== brhInput) {
            brhInput.value = selectedBRH;
        }

        // RAMH bei gewähltem BRH: BRH + 103 mm
        const selectedRAMH = selectedBRH + 103;
        // Überdeckung oben: RAMH - hEff
        const ueberdeckungH = selectedRAMH - hEff;

        // 4. Status-Bewertung Überdeckung
        // Breite: Zulässig 10 bis 30 mm
        let statusB = 'OK';
        let statusColorB = '#16a34a';
        let statusBgB = '#dcfce7';
        if (ueberdeckungB < 10) {
            statusB = 'zu klein';
            statusColorB = '#dc2626';
            statusBgB = '#fee2e2';
        } else if (ueberdeckungB > 30) {
            statusB = 'zu groß';
            statusColorB = '#b45309';
            statusBgB = '#fef3c7';
        }

        // Höhe: Zulässig 10 bis 30 mm
        let statusH = 'OK';
        let statusColorH = '#16a34a';
        let statusBgH = '#dcfce7';
        if (ueberdeckungH < 10) {
            statusH = 'zu klein';
            statusColorH = '#dc2626';
            statusBgH = '#fee2e2';
        } else if (ueberdeckungH > 30) {
            statusH = 'zu groß';
            statusColorH = '#b45309';
            statusBgH = '#fef3c7';
        }

        // 5. UI Elemente aktualisieren
        const txtRambProp = document.getElementById('txtF80RambProposal');
        const txtBrbProp = document.getElementById('txtF80BrbProposal');
        const txtRamhProp = document.getElementById('txtF80RamhProposal');
        const txtBrhProp = document.getElementById('txtF80BrhProposal');

        if (txtRambProp) txtRambProp.innerText = rambProposal;
        if (txtBrbProp) txtBrbProp.innerText = brbProposalExact;
        if (txtRamhProp) txtRamhProp.innerText = ramhProposal;
        if (txtBrhProp) txtBrhProp.innerText = brhProposalExact;

        const badgeUebB = document.getElementById('badgeF80UeberdeckungB');
        if (badgeUebB) {
            badgeUebB.style.background = statusBgB;
            badgeUebB.style.color = statusColorB;
            badgeUebB.style.borderColor = statusColorB;
            badgeUebB.innerHTML = `<strong>${statusB}</strong> <span style="margin-left:6px; font-weight:bold;">${ueberdeckungB.toFixed(1).replace('.', ',')} mm</span>`;
        }

        const badgeUebH = document.getElementById('badgeF80UeberdeckungH');
        if (badgeUebH) {
            badgeUebH.style.background = statusBgH;
            badgeUebH.style.color = statusColorH;
            badgeUebH.style.borderColor = statusColorH;
            badgeUebH.innerHTML = `<strong>${statusH}</strong> <span style="margin-left:6px; font-weight:bold;">${ueberdeckungH.toFixed(1).replace('.', ',')} mm</span>`;
        }

        const txtMinMaxB = document.getElementById('txtF80MinMaxB');
        if (txtMinMaxB) txtMinMaxB.innerText = `Min: ${minBRB} mm | Max: ${maxBRB} mm | Opt: ${optBRB} mm`;

        const txtMinMaxH = document.getElementById('txtF80MinMaxH');
        if (txtMinMaxH) txtMinMaxH.innerText = `Min: ${minBRH} mm | Max: ${maxBRH} mm | Opt: ${optBRH} mm`;

        // 6. Zusammenfassung & Ergebnis
        const resBestellgroesse = document.getElementById('f80ResBestellgroesse');
        const resRAM = document.getElementById('f80ResRAM');
        if (resBestellgroesse) resBestellgroesse.innerText = `${selectedBRB} × ${selectedBRH} mm`;
        if (resRAM) resRAM.innerText = `${selectedRAMB} × ${selectedRAMH} mm`;

        // 7. 2D Schema neu zeichnen
        window.renderF802DSchema(width, height, anschlag, selectedBRB, selectedBRH, selectedRAMB, selectedRAMH, ueberdeckungB, ueberdeckungH);
    };

    /**
     * Zeichnet das 2D Schema für Horizontal- und Vertikalschnitt analog zur Excel-Vorlage
     */
    window.renderF802DSchema = function (oeb, oeh, anschlag, brb, brh, ramb, ramh, uebB, uebH) {
        const svgContainer = document.getElementById('f80SchemaContainer');
        if (!svgContainer) return;

        const isOkB = uebB >= 10 && uebB <= 30;
        const isOkH = uebH >= 10 && uebH <= 30;

        const strokeColorB = isOkB ? '#16a34a' : (uebB < 10 ? '#dc2626' : '#d97706');
        const strokeColorH = isOkH ? '#16a34a' : (uebH < 10 ? '#dc2626' : '#d97706');

        // Render clean 2D schematic SVGs
        svgContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch;">
                
                <!-- A) HORIZONTALSCHNITT (BREITE) -->
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                        <strong style="color: var(--hormann-blue); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                            <span>📐 A - Horizontalschnitt</span>
                            <span style="font-size: 0.75rem; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px;">Innenansicht</span>
                        </strong>
                        <span style="font-size: 0.8rem; font-weight: bold; color: ${strokeColorB};">Überdeckung: ${uebB.toFixed(1).replace('.', ',')} mm</span>
                    </div>

                    <div style="flex: 1; display: flex; justify-content: center; align-items: center; min-height: 200px;">
                        <svg viewBox="0 0 360 190" style="width: 100%; max-height: 220px;">
                            <!-- Mauerwerk links -->
                            <rect x="20" y="35" width="55" height="110" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 3"/>
                            <pattern id="brickPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                                <path d="M 0 5 L 10 5 M 5 0 L 5 5 M 0 10 L 10 10" fill="none" stroke="#cbd5e1" stroke-width="1"/>
                            </pattern>
                            <rect x="20" y="35" width="55" height="110" fill="url(#brickPattern)"/>
                            <text x="47" y="25" text-anchor="middle" font-size="10" font-weight="bold" fill="#64748b">Wand</text>

                            <!-- Mauerwerk rechts -->
                            <rect x="285" y="35" width="55" height="110" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 3"/>
                            <rect x="285" y="35" width="55" height="110" fill="url(#brickPattern)"/>
                            <text x="312" y="25" text-anchor="middle" font-size="10" font-weight="bold" fill="#64748b">Wand</text>

                            <!-- Öffnungsmaß Bemaßung oben -->
                            <line x1="75" y1="50" x2="285" y2="50" stroke="#0284c7" stroke-width="1.5"/>
                            <polygon points="75,50 82,47 82,53" fill="#0284c7"/>
                            <polygon points="285,50 278,47 278,53" fill="#0284c7"/>
                            <rect x="135" y="38" width="90" height="24" rx="4" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/>
                            <text x="180" y="54" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">${oeb} mm</text>
                            <text x="180" y="72" text-anchor="middle" font-size="9.5" fill="#64748b">Öffnungsbreite</text>

                            <!-- F80 Zarge / Rahmen (RAMB) -->
                            <!-- Zargenprofil links -->
                            <rect x="58" y="90" width="22" height="45" rx="2" fill="#0284c7" stroke="#0369a1" stroke-width="1.5"/>
                            <!-- Zargenprofil rechts -->
                            <rect x="280" y="90" width="22" height="45" rx="2" fill="#0284c7" stroke="#0369a1" stroke-width="1.5"/>
                            <!-- Torblatt Verbindungslinie -->
                            <line x1="80" y1="112" x2="280" y2="112" stroke="#0369a1" stroke-width="4" stroke-linecap="round"/>

                            <!-- Überdeckung links Bemaßung -->
                            <line x1="58" y1="145" x2="75" y2="145" stroke="${strokeColorB}" stroke-width="1.5"/>
                            <text x="66" y="158" text-anchor="middle" font-size="9" font-weight="bold" fill="${strokeColorB}">${uebB.toFixed(1).replace('.', ',')}</text>

                            <!-- Überdeckung rechts Bemaßung -->
                            <line x1="285" y1="145" x2="302" y2="145" stroke="${strokeColorB}" stroke-width="1.5"/>
                            <text x="294" y="158" text-anchor="middle" font-size="9" font-weight="bold" fill="${strokeColorB}">${uebB.toFixed(1).replace('.', ',')}</text>

                            <!-- RAMB Bemaßung unten -->
                            <line x1="58" y1="172" x2="302" y2="172" stroke="#64748b" stroke-width="1.2"/>
                            <polygon points="58,172 64,169 64,175" fill="#64748b"/>
                            <polygon points="302,172 296,169 296,175" fill="#64748b"/>
                            <text x="180" y="184" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#334155">RAMB: ${ramb} mm (BRB: ${brb} mm)</text>
                        </svg>
                    </div>
                </div>

                <!-- B) VERTIKALSCHNITT (HÖHE) -->
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                        <strong style="color: var(--hormann-blue); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                            <span>📐 E - Vertikalschnitt</span>
                            <span style="font-size: 0.75rem; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px;">Innenansicht</span>
                        </strong>
                        <span style="font-size: 0.8rem; font-weight: bold; color: ${strokeColorH};">Überdeckung oben: ${uebH.toFixed(1).replace('.', ',')} mm</span>
                    </div>

                    <div style="flex: 1; display: flex; justify-content: center; align-items: center; min-height: 200px;">
                        <svg viewBox="0 0 360 190" style="width: 100%; max-height: 220px;">
                            <!-- Sturz Mauerwerk oben -->
                            <rect x="50" y="15" width="260" height="35" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 3"/>
                            <rect x="50" y="15" width="260" height="35" fill="url(#brickPattern)"/>
                            <text x="325" y="32" text-anchor="start" font-size="10" font-weight="bold" fill="#64748b">Sturz</text>

                            <!-- Fußboden / OFF unten -->
                            <line x1="30" y1="165" x2="330" y2="165" stroke="#334155" stroke-width="2"/>
                            <text x="35" y="160" font-size="9.5" font-weight="bold" fill="#334155">OFF</text>

                            <!-- Anschlag unten Stufe -->
                            ${anschlag > 0 ? `
                                <rect x="80" y="${165 - (anschlag > 50 ? 20 : 12)}" width="140" height="${anschlag > 50 ? 20 : 12}" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
                                <text x="150" y="${160 - (anschlag > 50 ? 10 : 4)}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#475569">Anschlag: ${anschlag} mm</text>
                            ` : ''}

                            <!-- Zarge oben Überdeckung am Sturz -->
                            <rect x="90" y="35" width="120" height="20" rx="2" fill="#0284c7" stroke="#0369a1" stroke-width="1.5"/>
                            <!-- Torblatt vertikal -->
                            <rect x="95" y="55" width="110" height="95" fill="#f8fafc" stroke="#0284c7" stroke-width="1.5"/>
                            <!-- Lamellen / Schwingtor Rippen -->
                            <line x1="95" y1="85" x2="205" y2="85" stroke="#94a3b8" stroke-width="1"/>
                            <line x1="95" y1="115" x2="205" y2="115" stroke="#94a3b8" stroke-width="1"/>

                            <!-- Öffnungshöhe Bemaßung rechts -->
                            <line x1="230" y1="50" x2="230" y2="165" stroke="#0284c7" stroke-width="1.5"/>
                            <polygon points="230,50 227,57 233,57" fill="#0284c7"/>
                            <polygon points="230,165 227,158 233,158" fill="#0284c7"/>
                            <rect x="240" y="90" width="85" height="24" rx="4" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/>
                            <text x="282" y="106" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">${oeh} mm</text>
                            <text x="282" y="122" text-anchor="middle" font-size="9" fill="#64748b">Öffnungshöhe</text>

                            <!-- Überdeckung oben Bemaßung links -->
                            <line x1="75" y1="35" x2="75" y2="50" stroke="${strokeColorH}" stroke-width="1.5"/>
                            <text x="65" y="45" text-anchor="end" font-size="9" font-weight="bold" fill="${strokeColorH}">${uebH.toFixed(1).replace('.', ',')}</text>

                            <!-- RAMH Bemaßung ganz links -->
                            <text x="150" y="185" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#334155">RAMH: ${ramh} mm (BRH: ${brh} mm)</text>
                        </svg>
                    </div>
                </div>

            </div>
        `;
    };

})();

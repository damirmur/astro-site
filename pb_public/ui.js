const UiService = {
    renderUserPanel(user) {
        document.getElementById("auth-block").classList.add("hidden");
        document.getElementById("app-block").classList.remove("hidden");
        document.getElementById("user-name").innerText = user.name || user.username;
        document.getElementById("user-id").innerText = user.id;
    },

    renderSettingsForm(data, remainderJson) {
        document.getElementById("set-city").value = data.city || "";
        document.getElementById("set-lat").value = data.latitude || "";
        document.getElementById("set-lon").value = data.longitude || "";
        document.getElementById("set-tz").value = data.tz || "";
        document.getElementById("set-houses").value = data.houses || "P";
        document.getElementById("settings-raw").value = JSON.stringify(remainderJson, null, 2);

        if (data.latitude && data.longitude) {
            document.getElementById("geo-lat").value = data.latitude;
            document.getElementById("geo-lon").value = data.longitude;
        }
    },

    renderHoroscopesList(items, selectedId) {
        const container = document.getElementById("horoscopes-list-container");
        if (!items || items.length === 0) {
            container.innerHTML = `<p style="color:#94a3b8; font-style:italic;">В вашей базе пока нет сохраненных карт. Создайте первый расчет ниже.</p>`;
            return;
        }

        let html = `<table border="1" style="width:100%; border-collapse:collapse; text-align:left; font-size:14px; background:#0f172a;">
            <tr style="background:#334155; color:#bae6fd;">
                <th style="padding:6px 10px;">Название (Title)</th>
                <th style="padding:6px 10px;">Дата события (UTC)</th>
                <th style="padding:6px 10px; text-align:center; width:190px;">Действия</th>
            </tr>`;

        items.forEach(item => {
            const isSelected = item.id === selectedId;
            const rowStyle = isSelected ? `style="background:#3b0764; border-left:3px solid #a855f7;"` : `style="border-bottom:1px solid #1e293b;"`;
            const btnText = isSelected ? "🎯 Активна" : "Выбрать";
            const btnClass = isSelected ? "btn-success" : "btn";

            const formattedDate = item.event_date ? item.event_date.replace("T", " ").substring(0, 19) : "—";
            const safeTitle = item.title.replace(/'/g, "\\'");

            html += `<tr ${rowStyle}>
                <td style="padding:6px 10px; font-weight:bold;">${item.title}</td>
                <td style="padding:6px 10px; color:#94a3b8;">${formattedDate}</td>
                <td style="padding:6px 10px; text-align:center;">
                    <button onclick="selectNatalCard('${item.id}', '${safeTitle}')" class="${btnClass}" style="padding:3px 8px; font-size:12px; font-weight:bold;">${btnText}</button>
                    <!-- НОВАЯ КНОПКА УДАЛЕНИЯ -->
                    <button onclick="deleteNatalCard('${item.id}', '${safeTitle}')" style="background:#b91c1c; color:white; border:none; border-radius:4px; padding:3px 8px; font-size:12px; margin-left:5px; cursor:pointer;">Удалить ❌</button>
                </td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    },

    renderRawJson(data) {
        document.getElementById("json-output").innerText = JSON.stringify(data, null, 2);
    },

    renderNatalReport(title, data, scoresData) {
        let html = `<h4 class="report-title">📊 ${title}</h4>`;
        html += `<h5>Положения планет в знаках и домах:</h5><ul class="report-list">`;
        
        data.chart.pl.forEach(p => {
            const zod = ElementsService.getZodiacData(p.lon);
            const pName = PLANET_NAMES[p.id] || `Планета ${p.id}`;
            const retroText = p.ir ? " <span class='retro-label'>[Ретроградная ℞]</span>" : "";
            html += `<li><b>${pName}</b> в знаке <b>${zod.name}</b> (${zod.text}), в <b>${p.h}-м доме</b>${retroText}.</li>`;
        });
        html += `</ul>`;

        if (data.chart.as && data.chart.as.length > 0) {
            html += `<h5>Аспектные связи натальной карты:</h5><ul class="report-list">`;
            data.chart.as.forEach(a => {
                const pA = PLANET_NAMES[a.a] || `Пл.${a.a}`;
                const pB = PLANET_NAMES[a.b] || `Пл.${a.b}`;
                const aName = ASPECT_NAMES[a.t] || `Аспект ${a.t}°`;
                html += `<li>🪐 <b>${pA}</b> образует <b>${aName}</b> к <b>${pB}</b> (точность: ${a.orb}°).</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p><i>Мажорных аспектов не обнаружено.</i></p>`;
        }

        html += this.generateMetricsHtml(scoresData);
        document.getElementById("text-output").innerHTML = html;
    },

    // Вспомогательная функция для определения, в какой натальный дом попал транзитный градус
    getHouseNumber(lon, houses) {
        if (!houses || houses.length < 12) return 0;
        
        // Перебираем дома с 1 по 11
        for (let i = 0; i < 11; i++) {
            let currentCusp = houses[i];
            let nextCusp = houses[i + 1];
            
            if (currentCusp < nextCusp) {
                if (lon >= currentCusp && lon < nextCusp) return i + 1;
            } else {
                // Случай перехода через 360° / 0° Овна
                if (lon >= currentCusp || lon < nextCusp) return i + 1;
            }
        }
        // Если не попало в 1-11 дома, значит планета строго в 12-м доме (между куспидом 12 и 1)
        return 12;
    },

    renderTransitReport(title, data, serverTime) {
        let html = `<h4 class="report-title">⚡ ${title}</h4>`;
        
        // Вытаскиваем массив куспидов домов ИЗ ВЫБРАННОЙ НАТАЛЬНОЙ КАРТЫ, который сохранен в кэше приложения
        const activeCard = cachedHoroscopes.find(h => h.id === currentNatalId);
        const natalHouses = activeCard && activeCard.astrological_data ? activeCard.astrological_data.hs : null;

        html += `<h5>Положение текущих планет на небе в домах вашего Натала:</h5><ul class="report-list" style="margin-bottom:20px;">`;
        
        if (data.pl) {
            data.pl.forEach(p => {
                const zod = ElementsService.getZodiacData(p.lon);
                const pName = PLANET_NAMES[p.id] || `Планета ${p.id}`;
                const retroText = p.ir ? " <span class='retro-label'>[Ретро ℞]</span>" : "";
                
                // РАССЧИТЫВАЕМ ДОМ СТРОГО ПО НАТАЛЬНОЙ СЕТКЕ КУСПИДОВ
                let correctHouse = p.h; // запасной вариант бэкенда
                if (natalHouses) {
                    correctHouse = this.getHouseNumber(p.lon, natalHouses);
                }

                html += `<li><b>${pName}</b> идет по знаку <b>${zod.name}</b> и проецируется в ваш <b style="color:#fbbf24;">${correctHouse}-й натальный дом</b>${retroText}.</li>`;
            });
        }
        html += `</ul>`;

        // ВЫВОД АСПЕКТОВ
        html += `<h5>Точные касания к натальной карте рождения (Орбис 1°):</h5><ul class="report-list">`;
        if (data.as && data.as.length > 0) {
            data.as.forEach(a => {
                const nPlanet = PLANET_NAMES[a.a] || `Натал Пл.${a.a}`;
                const tPlanet = PLANET_NAMES[a.b] || `Транзит Пл.${a.b}`;
                const aName = ASPECT_NAMES[a.t] || `Аспект ${a.t}°`;
                html += `<li>🌍 Транзитное <b>${tPlanet}</b> делает <b>${aName}</b> к вашему натальному <b>${nPlanet}</b> (орбис: ${a.orb}°).</li>`;
            });
        } else {
            html += `<li><i>На текущую секунду точных планетарных транзитов нет. Небо спокойно.</i></li>`;
        }
        html += `</ul>`;
        
        document.getElementById("text-output").innerHTML = html;
    },

    generateMetricsHtml(sd) {
        let html = `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #334155;">`;
        if (sd.activatedOuterPlanets.length > 0) {
            html += `<p style="font-size:12px; color:#a7f3d0; background:#065f46; padding:6px 12px; border-radius:6px; margin-bottom:15px;">
                ℹ️ <b>Высшие планеты:</b> Поскольку ${sd.activatedOuterPlanets.join(", ")} аспектируют Луну, они включены в баланс стихий (+1 балл).
            </p>`;
        }

        html += `<h5>🔥 Баланс Стихий:</h5><div style="margin-bottom:15px;">`;
        for (const [el, score] of Object.entries(sd.elementsScore)) {
            const pct = sd.totalScore > 0 ? Math.round((score / sd.totalScore) * 100) : 0;
            html += `<div style="margin-bottom: 8px;">
                <span style="display:inline-block; width:100px;"><b>${el}:</b></span> 
                <span style="color:#38bdf8;">${score} б. (${pct}%)</span>
                <div style="background:#0f172a; border:1px solid #475569; height:8px; border-radius:4px; margin-top:4px;">
                    <div style="background:#38bdf8; width:${pct}%; height:100%; border-radius:3px;"></div>
                </div>
            </div>`;
        }
        html += `</div><h5>🌀 Баланс Крестов:</h5>`;
        for (const [cr, score] of Object.entries(sd.crossesScore)) {
            const pct = sd.totalScore > 0 ? Math.round((score / sd.totalScore) * 100) : 0;
            html += `<div style="margin-bottom: 5px;">
                <span style="display:inline-block; width:140px;"><b>${cr}:</b></span> 
                <span style="color:#4ade80;">${score} б. (${pct}%)</span>
            </div>`;
        }
        html += `</div>`;
        return html;
    }
};

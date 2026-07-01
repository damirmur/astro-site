const UiService = {
    renderUserPanel(user) {
        document.getElementById("auth-block").classList.add("hidden");
        document.getElementById("app-block").classList.remove("hidden");
        document.getElementById("user-name").innerText = user.name || user.username;
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

        let html = `<table>
            <tr>
                <th>Название (Title)</th>
                <th>Дата события (UTC)</th>
                <th style="text-align:center; width:190px;">Действия</th>
            </tr>`;

        items.forEach(item => {
            const isSelected = item.id === selectedId;
            const rowClass = isSelected ? `class="row-selected"` : "";
            const btnText = isSelected ? "🎯 Активна" : "Выбрать";
            const btnClass = isSelected ? "btn-success" : "btn";

            const formattedDate = item.event_date ? item.event_date.replace("T", " ").substring(0, 19) : "—";
            const safeTitle = item.title.replace(/'/g, "\\'");

            html += `<tr ${rowClass}>
                <td style="padding:10px 12px; font-weight:600;">${item.title}</td>
                <td style="padding:10px 12px; color:#475569;">${formattedDate}</td>
                <td style="padding:10px 12px; text-align:center;">
                    <button onclick="selectNatalCard('${item.id}', '${safeTitle}', '${formattedDate}')" class="${btnClass}" style="padding:4px 10px; font-size:12px; font-weight:bold; box-shadow:none;">${btnText}</button>
                    <button onclick="deleteNatalCard('${item.id}', '${safeTitle}')" class="btn-danger" style="padding:4px 10px; font-size:12px; margin-left:5px; cursor:pointer;">Удалить</button>
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
        
        html += `<h5>Положения планет в знаках и домах:</h5>`;
        html += `<table style="margin-bottom:20px;">
            <tr>
                <th>Планета</th>
                <th>Абс. Долгота</th>
                <th>Знак Зодиака</th>
                <th>Градус Знака</th>
                <th>Дом</th>
                <th>Ретро</th>
            </tr>`;
            
        data.chart.pl.forEach(p => {
            const zod = ElementsService.getZodiacData(p.lon);
            const pName = PLANET_NAMES[p.id] || `Планета ${p.id}`;
            
            // Вынесли символы планет и знаков строго НАПЕРЕД названия
            const planetEmoji = pName.split(" ").pop() || "";
            const planetText = pName.split(" ").shift() || "";
            const signEmoji = zod.name.split(" ").pop() || "";
            const signText = zod.name.split(" ").shift() || "";

            html += `<tr>
                <td style="font-weight:600; color:#b45309;">${planetEmoji} ${planetText}</td>
                <td>${p.lon}°</td>
                <td style="font-weight:500;">${signEmoji} ${signText}</td>
                <td>${zod.text}</td>
                <td style="font-weight:600; color:#ea580c;">${p.h} дом</td>
                <td style="color:#ef4444; font-weight:bold;">${p.ir ? "℞" : "—"}</td>
            </tr>`;
        });
        html += `</table>`;

        if (data.chart.as && data.chart.as.length > 0) {
            html += `<h5>Аспектные связи натальной карты:</h5><ul class="report-list" style="margin-bottom:20px;">`;
            data.chart.as.forEach(a => {
                const pA = PLANET_NAMES[a.a] || `Пл.${a.a}`;
                const pB = PLANET_NAMES[a.b] || `Пл.${a.b}`;
                const aName = ASPECT_NAMES[a.t] || `Аспект ${a.t}°`;
                
                const emojiA = pA.split(" ").pop() || "";
                const emojiB = pB.split(" ").pop() || "";
                const emojiAsp = aName.split(" ").pop() || "";

                html += `<li>${emojiA} ${emojiAsp} ${emojiB} — <b>${pA.split(" ")[0]}</b> образует <b>${aName.split(" ")[0]}</b> к <b>${pB.split(" ")[0]}</b> (точность: ${a.orb}°).</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p><i>Мажорных аспектов не обнаружено.</i></p>`;
        }

        html += this.generateMetricsHtml(scoresData);
        document.getElementById("text-output").innerHTML = html;
    },

    getHouseNumber(lon, houses) {
        if (!houses || houses.length < 12) return 0;
        for (let i = 0; i < 11; i++) {
            let currentCusp = houses[i];
            let nextCusp = houses[i + 1];
            if (currentCusp < nextCusp) {
                if (lon >= currentCusp && lon < nextCusp) return i + 1;
            } else {
                if (lon >= currentCusp || lon < nextCusp) return i + 1;
            }
        }
        return 12;
    },

    renderTransitReport(title, data, serverTime) {
        let html = `<h4 class="report-title">⚡ ${title}</h4>`;
        const activeCard = cachedHoroscopes.find(h => h.id === currentNatalId);
        const natalHouses = activeCard && activeCard.astrological_data ? activeCard.astrological_data.hs : null;

        html += `<h5>Положение текущих планет на небе в домах вашего Натала:</h5>`;
        html += `<table style="margin-bottom:20px;">
            <tr>
                <th>Транзитная Планета</th>
                <th>Текущий Знак</th>
                <th>Точные Координаты</th>
                <th>Натальный Дом Проекции</th>
                <th>Статус</th>
            </tr>`;
            
        if (data.pl) {
            data.pl.forEach(p => {
                const zod = ElementsService.getZodiacData(p.lon);
                const pName = PLANET_NAMES[p.id] || `Планета ${p.id}`;
                
                const planetEmoji = pName.split(" ").pop() || "";
                const planetText = pName.split(" ").shift() || "";
                const signEmoji = zod.name.split(" ").pop() || "";
                const signText = zod.name.split(" ").shift() || "";

                let correctHouse = p.h;
                if (natalHouses) {
                    correctHouse = this.getHouseNumber(p.lon, natalHouses);
                }
                html += `<tr>
                    <td style="font-weight:600; color:#15803d;">${planetEmoji} ${planetText}</td>
                    <td>${signEmoji} ${signText}</td>
                    <td>${zod.text}</td>
                    <td style="font-weight:600; color:#b45309; background:#fffbeb;">${correctHouse}-й дом</td>
                    <td style="color:#ea580c;">${p.ir ? "Ретро ℞" : "Прямая"}</td>
                </tr>`;
            });
        }
        html += `</table>`;

        html += `<h5>Точные касания к натальной карте рождения (Орбис 1°):</h5><ul class="report-list">`;
        if (data.as && data.as.length > 0) {
            data.as.forEach(a => {
                const nPlanet = PLANET_NAMES[a.a] || `Натал Пл.${a.a}`;
                const tPlanet = PLANET_NAMES[a.b] || `Транзит Пл.${a.b}`;
                const aName = ASPECT_NAMES[a.t] || `Аспект ${a.t}°`;
                
                const emojiN = nPlanet.split(" ").pop() || "";
                const emojiT = tPlanet.split(" ").pop() || "";
                const emojiAsp = aName.split(" ").pop() || "";

                html += `<li>${emojiT} ${emojiAsp} ${emojiN} — Транзитное <b>${tPlanet.split(" ")[0]}</b> делает <b>${aName.split(" ")[0]}</b> к вашему натальному <b>${nPlanet.split(" ")[0]}</b> (орбис: ${a.orb}°).</li>`;
            });
        } else {
            html += `<li><i>На текущую секунду точных планетарных транзитов нет. Небо спокойно.</i></li>`;
        }
        html += `</ul>`;
        document.getElementById("text-output").innerHTML = html;
    },

    generateMetricsHtml(sd) {
        if (!sd) return '<p>Нет данных для анализа</p>';
        
        let html = `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #eae2d5;">`;
        
        if (sd.activatedOuterPlanets && sd.activatedOuterPlanets.length > 0) {
            html += `<p style="font-size:12px; color:#065f46; background:#ecfdf5; padding:8px 12px; border-radius:6px; margin-bottom:15px; border:1px solid #a7f3d0;">
                ℹ️ <b>Высшие планеты:</b> Поскольку ${sd.activatedOuterPlanets.join(", ")} аспектируют Луну, они включены в баланс стихий (+1 балл).
            </p>`;
        }

        // Баланс стихий
        if (sd.elementsScore) {
            html += `<h5>🔥 Баланс Стихий:</h5><div style="margin-bottom:15px;">`;
            const totalScore = sd.totalScore || 0;
            for (const [el, score] of Object.entries(sd.elementsScore)) {
                const pct = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
                html += `<div style="margin-bottom: 8px;">
                    <span style="display:inline-block; width:100px;"><b>${el}:</b></span> 
                    <span style="color:#b45309; font-weight:600;">${score} б. (${pct}%)</span>
                </div>`;
            }
            html += `</div>`;
        }

        // Баланс крестов
        if (sd.crossesScore) {
            html += `<h5>🌀 Баланс Крестов:</h5><div style="margin-bottom:15px;">`;
            const totalScore = sd.totalScore || 0;
            for (const [cr, score] of Object.entries(sd.crossesScore)) {
                const pct = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
                html += `<div style="margin-bottom: 8px;">
                    <span style="display:inline-block; width:100px;"><b>${cr}:</b></span> 
                    <span style="color:#b45309; font-weight:600;">${score} б. (${pct}%)</span>
                </div>`;
            }
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }
};

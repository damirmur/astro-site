let currentNatalId = "";
let cachedHoroscopes = [];

document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("token")) showApp();
});

async function onTelegramAuth(user) {
    try {
        const data = await ApiService.loginTelegram(user);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.record));
        showApp();
    } catch (err) { alert(err.message); }
}

function showApp() {
    const user = JSON.parse(localStorage.getItem("user"));
    UiService.renderUserPanel(user);
    loadSettings();
    loadHoroscopes();
}

async function loadHoroscopes() {
    try {
        cachedHoroscopes = await ApiService.getHoroscopesList();
        
        // Автовыбор: если в базе есть карты, а currentNatalId пустой — берем самую первую (свежую)
        if (cachedHoroscopes.length > 0 && !currentNatalId) {
            const latest = cachedHoroscopes[0];
            currentNatalId = latest.id;
            document.getElementById("selected-natal-name").innerText = `"${latest.title}" (ID: ${latest.id})`;
        }
        
        UiService.renderHoroscopesList(cachedHoroscopes, currentNatalId);
    } catch (err) { console.error("Ошибка загрузки архива карт:", err); }
}

function selectNatalCard(id, title) {
    currentNatalId = id;
    document.getElementById("selected-natal-name").innerText = `"${title}" (ID: ${id})`;
    UiService.renderHoroscopesList(cachedHoroscopes, currentNatalId);
}

// НОВАЯ ФУНКЦИЯ: Интерактивное удаление выбранного гороскопа
async function deleteNatalCard(id, title) {
    if (!confirm(`Вы действительно хотите безвозвратно удалить гороскоп "${title}" из вашей базы данных?`)) {
        return;
    }

    try {
        await ApiService.deleteHoroscope(id);
        
        // Если была удалена активная натальная карта, сбрасываем выбор
        if (currentNatalId === id) {
            currentNatalId = "";
            document.getElementById("selected-natal-name").innerText = "Последний расчет";
        }
        
        // Перечитываем и перерисовываем базу
        loadHoroscopes();
    } catch (err) {
        alert(err.message);
    }
}

async function loadSettings() {
    try {
        const data = await ApiService.getSettings();
        let jsonRemainder = { ...data };
        ['city', 'latitude', 'longitude', 'tz', 'houses'].forEach(k => delete jsonRemainder[k]);
        UiService.renderSettingsForm(data, jsonRemainder);
    } catch (err) { console.error(err); }
}

async function saveSettings() {
    let remainderData = {};
    const rawJsonText = document.getElementById("settings-raw").value.trim();
    if (rawJsonText) {
        try { remainderData = JSON.parse(rawJsonText); } 
        catch (e) { return alert("Ошибка синтаксиса в поле JSON!"); }
    }
    const finalSettings = {
        city: document.getElementById("set-city").value,
        latitude: parseFloat(document.getElementById("set-lat").value) || 0,
        longitude: parseFloat(document.getElementById("set-lon").value) || 0,
        tz: document.getElementById("set-tz").value,
        houses: document.getElementById("set-houses").value,
        ...remainderData
    };
    try {
        await ApiService.saveSettings(finalSettings);
        alert("Настройки сохранены!");
        loadSettings();
    } catch (err) { alert(err.message); }
}

async function calculateNatal() {
    const dateInput = document.getElementById("birth-date").value;
    if (!dateInput) return alert("Укажите дату");

    const date = new Date(dateInput + ":00.000Z").toISOString();
    const lat = document.getElementById("geo-lat").value;
    const lon = document.getElementById("geo-lon").value;

    let title = document.getElementById("calc-title").value.trim();
    if (!title) title = `Натал от ${dateInput.replace("T", " ")}`;

    document.getElementById("text-output").innerText = "Вычисления...";

    try {
        const data = await ApiService.getNatalChart(date, lat, lon, title);
        UiService.renderRawJson(data);

        const planets = data.pl || (data.chart && data.chart.pl);
        const aspects = data.as || (data.chart && data.chart.as);

        if (planets && planets.length > 0) {
            const normalizedData = data.chart ? data : { chart: { pl: planets, as: aspects }, saved_id: data.saved_id };
            const scores = ElementsService.calculateScores(planets, aspects);
            UiService.renderNatalReport(title, normalizedData, scores);
            loadHoroscopes();
        } else {
            document.getElementById("text-output").innerText = "Бэкенд вернул пустую карту";
        }
    } catch (err) { 
        document.getElementById("text-output").innerHTML = `<span style="color:#f87171;"><b>Ошибка вычислений:</b> ${err.message}</span>`;
    }
}

async function calculateTransit() {
    document.getElementById("text-output").innerText = "Вычисления транзитов...";
    try {
        const data = await ApiService.getTransitChart(currentNatalId);
        UiService.renderRawJson(data);
        const serverTime = data.ts ? new Date(data.ts).toLocaleString("ru-RU") : new Date().toLocaleString("ru-RU");
        
        let title = document.getElementById("calc-title").value.trim();
        if (!title) {
            const activeCard = cachedHoroscopes.find(h => h.id === currentNatalId);
            const activeTitle = activeCard ? activeCard.title : "Натал";
            title = `Транзит неба к карте "${activeTitle}"`;
        }
        UiService.renderTransitReport(title, data, serverTime);
    } catch (err) { 
        document.getElementById("text-output").innerHTML = `<span style="color:#f87171;"><b>Ошибка транзита:</b> ${err.message}</span>`;
    }
}
async function interpretAi(type) {
    if (!currentNatalId) {
        return alert("Сначала выберите активную натальную карту в таблице 'Ваша база гороскопов'!");
    }

    const outputDiv = document.getElementById("text-output");
    outputDiv.innerHTML = `<div style="color:#fda4af; font-weight:bold;">🤖 Gemma анализирует JSON-данные эфемерид... Пожалуйста, подождите (это может занять до 30-40 секунд)...</div>`;

    try {
        const data = await ApiService.getAiInterpretation(type, currentNatalId);
        
        // Превращаем переносы строк от нейросети (\n) в красивые HTML абзацы
        const formattedText = data.interpretation.replace(/\n/g, "<br>");
        
        outputDiv.innerHTML = `<div class="text-report" style="border-color:#e11d48; background:#0f172a; color:#ffe4e6; font-size:15px; line-height:1.6;">
            <h4 style="color:#fda4af; margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">🧠 ИИ-Интерпретация от Gemma</h4>
            ${formattedText}
        </div>`;
    } catch (err) {
        outputDiv.innerHTML = `<span style="color:#f87171;"><b>Ошибка ИИ-интерпретатора:</b> ${err.message}. Проверьте, загружена ли модель в LM Studio на 10 chain-сервере.</span>`;
    }
}

function logout() { localStorage.clear(); window.location.reload(); }

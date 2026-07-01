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

    // Используем ваш эталонный парсинг с миллисекундами
    const date = new Date(dateInput + ":00.000Z").toISOString();
    const lat = document.getElementById("geo-lat").value;
    const lon = document.getElementById("geo-lon").value;

    let title = document.getElementById("calc-title").value.trim();
    if (!title) title = `Натал от ${dateInput.replace("T", " ")}`;

    document.getElementById("text-output").innerText = "Вычисления...";

    try {
        const data = await ApiService.getNatalChart(date, lat, lon, title);
        UiService.renderRawJson(data);

        // Проверяем, вернул ли бэкенд массив планет в поле pl или внутри объекта chart
        const planets = data.pl || (data.chart && data.chart.pl);
        const aspects = data.as || (data.chart && data.chart.as);

        if (planets && planets.length > 0) {
            // Перепаковываем данные для UiService, если бэкенд обернул их в {chart: ...}
            const normalizedData = data.chart ? data : { chart: { pl: planets, as: aspects }, saved_id: data.saved_id };
            
            const scores = ElementsService.calculateScores(planets, aspects);
            UiService.renderNatalReport(title, normalizedData, scores);
        } else {
            document.getElementById("text-output").innerText = "Бэкенд вернул пустую карту (проверьте файлы эфемерид)";
        }
    } catch (err) { 
        console.error("Сбой fetch расчетов:", err);
        document.getElementById("text-output").innerHTML = `<span style="color:#f87171;"><b>Ошибка вычислений:</b> ${err.message}</span>`;
    }
}

async function calculateTransit() {
    document.getElementById("text-output").innerText = "Вычисления транзитов...";

    try {
        const data = await ApiService.getTransitChart();
        UiService.renderRawJson(data);

        const serverTime = data.ts ? new Date(data.ts).toLocaleString("ru-RU") : new Date().toLocaleString("ru-RU");
        let title = document.getElementById("calc-title").value.trim();
        if (!title) title = `Транзит на ${serverTime}`;

        UiService.renderTransitReport(title, data, serverTime);
    } catch (err) { 
        document.getElementById("text-output").innerHTML = `<span style="color:#f87171;"><b>Ошибка транзита:</b> ${err.message}</span>`;
    }
}

function logout() { localStorage.clear(); window.location.reload(); }

const API_URL = window.location.origin;

const ZODIAC_SIGNS = [
    "Овен ♈", "Телец ♉", "Близнецы ♊", "Рак ♋", "Лев ♌", "Дева ♍",
    "Весы ♎", "Скорпион ♏", "Стрелец ♐", "Козерог ♑", "Водолей ♒", "Рыбы ♓"
];

const PLANET_NAMES = {
    0: "Солнце ☀️", 1: "Луна 🌙", 2: "Меркурий ☿", 3: "Венера ♀", 4: "Марс ♂",
    5: "Юпитер ♃", 6: "Сатурн ♄", 7: "Уран ♅", 8: "Нептун ♆", 9: "Плутон ♇",
    10: "Раху ☊", 12: "Лилит ⚓"
};

const ASPECT_NAMES = {
    0: "Соединение ☌", 72: "Квинтиль ▰", 90: "Квадрат ▢", 120: "Трин △", 180: "Оппозиция ☍"
};

function getZodiacData(lon) {
    const idx = Math.floor(lon / 30);
    const deg = Math.floor(lon % 30);
    const min = Math.round(((lon % 30) - deg) * 60);
    return { name: ZODIAC_SIGNS[idx], text: `${deg}° ${min}'` };
}

document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("token")) showApp();
});

async function onTelegramAuth(user) {
    try {
        const response = await fetch(`${API_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        if (!response.ok) throw new Error('Ошибка входа');
        const data = await response.json();
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.record));
        showApp();
    } catch (err) { alert(err.message); }
}

function showApp() {
    document.getElementById("auth-block").classList.add("hidden");
    document.getElementById("app-block").classList.remove("hidden");
    const user = JSON.parse(localStorage.getItem("user"));
    document.getElementById("user-name").innerText = user.name || user.username;
    document.getElementById("user-id").innerText = user.id;
    loadSettings();
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/api/astrology/settings`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        
        // Заполняем форму настроек
        document.getElementById("set-city").value = data.city || "";
        document.getElementById("set-lat").value = data.latitude || "";
        document.getElementById("set-lon").value = data.longitude || "";
        document.getElementById("set-tz").value = data.tz || "";
        document.getElementById("set-houses").value = data.houses || "P";
        
        document.getElementById("settings-raw").innerText = JSON.stringify(data, null, 2);

        // Синхронизируем Оренбургские координаты с формой расчетов
        if (data.latitude && data.longitude) {
            document.getElementById("geo-lat").value = data.latitude;
            document.getElementById("geo-lon").value = data.longitude;
        }
    } catch (err) { console.log(err); }
}

async function saveSettings() {
    const settings = {
        city: document.getElementById("set-city").value,
        latitude: parseFloat(document.getElementById("set-lat").value),
        longitude: parseFloat(document.getElementById("set-lon").value),
        tz: document.getElementById("set-tz").value,
        houses: document.getElementById("set-houses").value,
        planets: ["0","1","2","3","4","5","6","7","8","9","10","12"],
        aspects: ["0","72","90","120","180"],
        transit_orb: "1",
        natal_orb: {"0":10,"1":9,"2":7,"3":7,"4":7,"5":6,"6":6,"7":5,"8":5,"9":5,"10":5,"12":3}
    };

    try {
        await fetch(`${API_URL}/api/astrology/settings`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(settings)
        });
        alert("Настройки успешно сохранены!");
        loadSettings();
    } catch (err) { alert("Ошибка сохранения"); }
}

async function calculateNatal() {
    const dateInput = document.getElementById("birth-date").value;
    if (!dateInput) return alert("Укажите дату");

    let title = document.getElementById("calc-title").value.trim();
    // 2. Если Title пустой — ставим отформатированную дату натала
    if (!title) { title = `Натал от ${dateInput.replace("T", " ")}`; }

    const lat = document.getElementById("geo-lat").value;
    const lon = document.getElementById("geo-lon").value;
    const date = new Date(dateInput).toISOString();

    try {
        const res = await fetch(`${API_URL}/api/astrology/chart?date=${date}&lat=${lat}&lon=${lon}&title=${encodeURIComponent(title)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        
        // 3. Прячем сырой JSON в свернутый блок
        document.getElementById("json-output").innerText = JSON.stringify(data, null, 2);

        // 4. ТЕКСТОВЫЙ РЕЗУЛЬТАТ (Интерпретация на русском)
        let textReport = `<h4 class="report-title">📊 ${title}</h4>`;
        textReport += `<h5>Положения планет в знаках и домах:</h5><ul class="report-list">`;
        
        data.pl.forEach(p => {
            const zod = getZodiacData(p.lon);
            const pName = PLANET_NAMES[p.id] || `Планета ${p.id}`;
            const retroText = p.ir ? " <span class='retro-label'>[Ретроградная ℞]</span>" : "";
            textReport += `<li><b>${pName}</b> находится в знаке <b>${zod.name}</b> (${zod.text}), в <b>${p.h}-м доме</b>${retroText}.</li>`;
        });
        textReport += `</ul>`;

        if (data.as && data.as.length > 0) {
            textReport += `<h5>Аспектные связи натальной карты:</h5><ul class="report-list">`;
            data.as.forEach(a => {
                const pA = PLANET_NAMES[a.a] || `Пл.${a.a}`;
                const pB = PLANET_NAMES[a.b] || `Пл.${a.b}`;
                const aName = ASPECT_NAMES[a.t] || `Аспект ${a.t}°`;
                textReport += `<li>🪐 <b>${pA}</b> образует <b>${aName}</b> к <b>${pB}</b> (точность: ${a.orb}°).</li>`;
            });
            textReport += `</ul>`;
        } else {
            textReport += `<p><i>Мажорных аспектов между планетами не обнаружено.</i></p>`;
        }

        document.getElementById("text-output").innerHTML = textReport;
    } catch (err) { alert("Ошибка вычислений"); }
}

async function calculateTransit() {
    let title = document.getElementById("calc-title").value.trim();
    const now = new Date();
    // 2. Если Title пустой — ставим текущее время транзита
    if (!title) { title = `Транзит на ${now.toLocaleString("ru-RU")}`; }

    try {
        const res = await fetch(`${API_URL}/api/astrology/transit`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        
        document.getElementById("json-output").innerText = JSON.stringify(data, null, 2);

        let textReport = `<h4 class="report-title">⚡ ${title}</h4>`;
        textReport += `<h5>Касания транзитных планет к натальной карте рождения (Орбис 1°):</h5><ul class="report-list">`;
        
        if (data.as && data.as.length > 0) {
            data.as.forEach(a => {
                const nPlanet = PLANET_NAMES[a.a] || `Натал Пл.${a.a}`;
                const tPlanet = PLANET_NAMES[a.b] || `Транзит Пл.${a.b}`;
                const aName = ASPECT_NAMES[a.t] || `Аспект ${a.t}°`;
                textReport += `<li>🌍 Транзитное <b>${tPlanet}</b> бьет по вашему натальному <b>${nPlanet}</b> через <b>${aName}</b> (орбис: ${a.orb}°).</li>`;
            });
        } else {
            textReport += `<li><i>На текущую секунду точных планетарных аспектных транзитов к вашей карте нет. Небо спокойно.</i></li>`;
        }
        textReport += `</ul>`;

        document.getElementById("text-output").innerHTML = textReport;
    } catch (err) { alert("Сначала рассчитайте базовую натальную карту."); }
}

function logout() { localStorage.clear(); window.location.reload(); }

const API_URL = window.location.origin; // Автоматически подставит https://astro3d.ru

// Проверяем наличие сохраненного токена при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (token) {
        showApp();
    }
});

// Настоящая рабочая функция для виджета Telegram
async function onTelegramAuth(user) {
    try {
        // Отправляем данные на наш Go-бэкенд для проверки хэша и Bot Token
        const response = await fetch(`${API_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Ошибка авторизации на бэкенде');
        }

        const data = await response.json();
        
        // Сохраняем полученный JWT-токен и профиль пользователя PocketBase в браузер
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.record));

        // Переключаем экран на панель расчетов
        showApp();
    } catch (err) {
        alert("Ошибка входа: " + err.message);
    }
}

async function showApp() {
    document.getElementById("auth-block").classList.add("hidden");
    document.getElementById("app-block").classList.remove("hidden");

    const user = JSON.parse(localStorage.getItem("user"));
    document.getElementById("user-name").innerText = user.name || user.username;
    document.getElementById("user-id").innerText = user.id;

    // Выгружаем и сразу подставляем настройки в поля ввода
    loadSettings();
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/api/astrology/settings`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        document.getElementById("settings-output").innerText = JSON.stringify(data, null, 2);
        
        // АВТОЗАПОЛНЕНИЕ: подставляем Оренбургские координаты из базы данных прямо в инпуты
        if (data.latitude && data.longitude) {
            document.getElementById("geo-lat").value = data.latitude;
            document.getElementById("geo-lon").value = data.longitude;
        }
    } catch (err) {
        document.getElementById("settings-output").innerText = "Не удалось загрузить настройки";
    }
}

async function calculateNatal() {
    const dateInput = document.getElementById("birth-date").value;
    if (!dateInput) return alert("Выберите дату рождения");
    
    const date = new Date(dateInput).toISOString();
    const lat = document.getElementById("geo-lat").value;
    const lon = document.getElementById("geo-lon").value;

    document.getElementById("json-output").innerText = "Вычисления эфемерид...";

    try {
        const res = await fetch(`${API_URL}/api/astrology/chart?date=${date}&lat=${lat}&lon=${lon}&title=Natal`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        document.getElementById("json-output").innerText = JSON.stringify(data, null, 2);
    } catch (err) {
        document.getElementById("json-output").innerText = "Ошибка расчета натальной карты";
    }
}

async function calculateTransit() {
    document.getElementById("json-output").innerText = "Вычисления транзитов на текущую секунду...";

    try {
        const res = await fetch(`${API_URL}/api/astrology/transit`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        document.getElementById("json-output").innerText = JSON.stringify(data, null, 2);
    } catch (err) {
        document.getElementById("json-output").innerText = "Ошибка расчета транзитов";
    }
}

function logout() {
    localStorage.clear();
    window.location.reload();
}

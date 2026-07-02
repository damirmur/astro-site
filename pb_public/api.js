const ApiService = {
    getUrl() {
        return window.location.origin;
    },
    
    getHeaders() {
        const token = localStorage.getItem("token");
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    },

async login(provider, userData) {
    const res = await fetch(`${this.getUrl()}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            provider: provider, // 'telegram', 'vk', etc.
            data: userData
        })
    });
    if (!res.ok) throw new Error('Ошибка авторизации на сервере');
    return res.json();
},

    async getSettings() {
        const res = await fetch(`${this.getUrl()}/api/astrology/settings`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Не удалось загрузить настройки');
        return res.json();
    },

    async saveSettings(settingsData) {
        const res = await fetch(`${this.getUrl()}/api/astrology/settings`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(settingsData)
        });
        if (!res.ok) throw new Error('Ошибка сохранения настроек');
        return res.json();
    },

    async getHoroscopesList() {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) return [];
        const url = `${this.getUrl()}/api/collections/horoscopes/records?filter=(user='${user.id}')&sort=-created`;
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Не удалось загрузить базу гороскопов');
        const data = await res.json();
        return data.items || [];
    },

    // НОВЫЙ МЕТОД: Удаление записи из коллекции horoscopes по ID
    async deleteHoroscope(id) {
        const url = `${this.getUrl()}/api/collections/horoscopes/records/${id}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!res.ok) throw new Error('Не удалось удалить запись из базы данных');
        return true;
    },

    async getNatalChart(date, lat, lon, title) {
        const url = `${this.getUrl()}/api/astrology/chart?date=${date}&lat=${lat}&lon=${lon}&title=${encodeURIComponent(title)}`;
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Ошибка вычисления натальной карты');
        return res.json();
    },

    async getTransitChart(natalId = "") {
        let url = `${this.getUrl()}/api/astrology/transit`;
        if (natalId) {
            url += `?natal_id=${natalId}`;
        }
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Ошибка вычисления транзитов');
        }
        return res.json();
    },
    async getAiInterpretation(type, natalId) {
        const res = await fetch(`${this.getUrl()}/api/astrology/interpret`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ type, natal_id: natalId })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Ошибка вызова нейросети');
        }
        return res.json();
    }
};

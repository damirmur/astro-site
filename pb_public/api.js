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

    async loginTelegram(userData) {
        const res = await fetch(`${this.getUrl()}/api/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
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

    async getNatalChart(date, lat, lon, title) {
        const url = `${this.getUrl()}/api/astrology/chart?date=${date}&lat=${lat}&lon=${lon}&title=${encodeURIComponent(title)}`;
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Ошибка вычисления натальной карты');
        return res.json();
    },

    async getTransitChart() {
        const res = await fetch(`${this.getUrl()}/api/astrology/transit`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Ошибка вычисления транзитов');
        return res.json();
    }
};

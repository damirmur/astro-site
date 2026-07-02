/**
* Copyright 2023, Muratov Damir.
*astro3d.ru
* https://github.com/damirmur/
* All rights reserved.
* Licensed under the MIT license
v 0.0.6
*/
class Source {
    constructor() { }
    static #zeroPadded = (val) => {
        return (val >= 10) ? String(val) : ('0' + String(val));
    };
    //local_
    static #local_plName = {
        '0': 'Sun',
        '1': 'Moon',
        '2': 'Mercury',
        '3': 'Venus',
        '4': 'Mars',
        '5': 'Jupiter',
        '6': 'Saturn',
        '7': 'Uranus',
        '8': 'Neptune',
        '9': 'Pluto',
        '10': 'mean Node',
        '11': 'North Node',//'true Node'
        '12': "Lilith",//'mean Apogee',
        '13': 'osc. Apogee',
    };
    static #local_aspSign = {
        0: '☌', 30: '⚺', 60: '⚹', 72: '⚻', 90: '□', 120: '∆', 135: '⚼', 180: '☍',
    };
    static #local_housesNames = {
        "A": "equal",
        "B": "Alcabitius",
        "C": "Campanus",
        "G": "Gauquelin sectors",
        "H": "horizon/azimut",
        "K": "Koch",
        "M": "Morinus",
        "O": "Porphyry",
        "P": "Placidus",
        "R": "Regiomontanus",
        "T": "Polich/Page",
        "U": "Krusinski-Pisa-Goelzer",
        "W": "equal/ whole sign",
        "X": "axial rotation system/Meridian houses",
        "Y": "APC houses",
    };
    static #getJSON = (async (url) => {
        let res = fetch(url, { method: 'GET', redirect: 'follow'})
            .catch(error => console.log('Request failed', error))
            .then(response =>
                response.json().then(data => ({ data: data, status: response.status }))
                    .then(result => {
                        if (result.status == 200) { result.data.status = 'OK'; return result.data; }
                    }))
        return res;
    });
    static #postJSON = (async (url, data) => {
        let res = fetch(url, {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ data })
        }
        )
            .catch(error => console.log('Request failed', error))
            .then(response =>
                response.json().then(data => ({ data: data, status: response.status }))
                    .then(result => {
                        if (result.status == 200) { result.data.status = 'OK'; return result.data; }
                    }))
        return res;
    });
    static #net_getSolar = (async (chart, flag = (Swe.SEFLG_SPEED | Swe.SEFLG_SWIEPH)) => {
        chart.flag = flag;
        return await Source.#postJSON('api/astro/solar', chart)
            .then((res) => { return res });
    });
    static #local_getDateSolar = ((chart, flag = (Swe.SEFLG_SPEED | Swe.SEFLG_MOSEPH)) => {
        let serr;
        let sunpos = Source.#local_getAstroData(chart, flag).planets[0][1][0];
        const sweph = new SwissEph();
        sweph.init();
        let dateSolar = new Date(chart.dateSolar)||new Date();
        let s_jd = new SweDate(dateSolar.getUTCFullYear(), dateSolar.getUTCMonth() + 1, dateSolar.getUTCDate(), dateSolar.getUTCHours(), sweph.sd.SE_GREG_CAL).jd;
        s_jd = sweph.swe_solcross_ut(sunpos, s_jd, flag, serr);
        dateSolar= sweph.sd.swe_revjul(s_jd, sweph.sd.SE_GREG_CAL);
        let dateSolarJSON=String(dateSolar.year)+'-'+Source.#zeroPadded(dateSolar.month)+'-'+Source.#zeroPadded(dateSolar.day)+'T'+
        Source.#zeroPadded(Math.trunc(dateSolar.hour))+':'+Source.#zeroPadded(Math.trunc(dateSolar.hour%1*60))+':'+Source.#zeroPadded(Math.trunc(((dateSolar.hour*60)%1)*60))+'.000Z';
        chart.dateSolar = dateSolarJSON;
        return chart.dateSolar;
    });
    static #net_getLunar = (async (chart, flag = (Swe.SEFLG_SPEED | Swe.SEFLG_SWIEPH)) => {
        chart.flag = flag;
        return await Source.#postJSON('api/astro/lunar', chart)
            .then((res) => { return res });
    });
    static #local_getDateLunar = ((chart, flag = (Swe.SEFLG_SPEED | Swe.SEFLG_MOSEPH)) => {
        let serr;
        let moonpos = Source.#local_getAstroData(chart, flag).planets[1][1][0];
        const sweph = new SwissEph();
        sweph.init();
        let dateLunar = new Date(chart.dateLunar);
        let s_jd = new SweDate(dateLunar.getUTCFullYear(), dateLunar.getUTCMonth() + 1, dateLunar.getUTCDate(), dateLunar.getUTCHours(), sweph.sd.SE_GREG_CAL).jd;
        s_jd = sweph.swe_mooncross_ut(moonpos, s_jd, flag, serr);
        dateLunar= sweph.sd.swe_revjul(s_jd, sweph.sd.SE_GREG_CAL);
        let dateLunarJSON=String(dateLunar.year)+'-'+Source.#zeroPadded(dateLunar.month)+'-'+Source.#zeroPadded(dateLunar.day)+'T'+
        Source.#zeroPadded(Math.trunc(dateLunar.hour))+':'+Source.#zeroPadded(Math.trunc(dateLunar.hour%1*60))+':'+Source.#zeroPadded(Math.trunc(((dateLunar.hour*60)%1)*60))+'.000Z';
        chart.dateLunar = dateLunarJSON;
        return chart.dateLunar;

    });

    static #net_getAstroData = (async (chart) => {
        const dMatch = chart.in.dateToJSON.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
        const date = dMatch ? dMatch[1] : '';
        const time = dMatch ? dMatch[2] : '12:00';
        const params = new URLSearchParams({
            date: date,
            time: time,
            lat: chart.in.latitude,
            lon: chart.in.longitude,
            hsys: chart.set.house || 'P',
            planets: chart.set.planets ? chart.set.planets.join(',') : '',
            aspects: chart.set.aspects ? chart.set.aspects.join(',') : ''
        });
        return await Source.#getJSON('/api/v1/natal?' + params.toString())
            .then(res => {
                if (!res) return null;
                return {
                    planets: res.planets.map(p => [p.id, [p.longitude, p.speed]]),
                    cusps: res.houses.map(h => h.longitude)
                };
            });
    });
    static #local_getAstroData = ((chart, flag = (Swe.SEFLG_SPEED | Swe.SEFLG_MOSEPH)) => {
        let [, year, month, day, hour, min, sec] = (chart.in.dateToJSON).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})/);
        const swe = new SwissEph();
        swe.init();
        const sd = new SweDate(Number(year), Number(month), Number(day), Number(hour) + Number(min) / 60 + Number(sec) / 3600, true);
        let arrPls = [];
        let out = {};
        chart.set.planets.forEach((el, i) => {
            let pl = [];
            swe.swe_calc_ut(sd.jd, el, flag, pl);
            arrPls[i] = [el, [pl[0], pl[3]]];
        })
        out.planets = arrPls;
        if (chart.set.type == 'horo') {
            let cusp = [];
            let ascmc = [];
            swe.swe_houses(sd.jd, flag, Number(chart.in.latitude), Number(chart.in.longitude), chart.set.house, cusp, ascmc);
            cusp.shift();
            out.cusps = cusp;
        }
        if (chart.set.type == 'zod') {
            let cusp = [];
            for (let index = 0; index < 12; index++) {
                let deg = (Number(chart.set.house) + index) * 30;
                cusp[index] = (deg < 360) ? deg : (deg - 360);
            }
            out.cusps = cusp;
        }
        if (chart.set.type == 'planets') {
            const degPl = out.planets[out.planets.findIndex((el) => { return (el[0] == Number(chart.set.house)) })][1][0];
            let cusp = [];
            for (let index = 0; index < 12; index++) {
                let deg = degPl + index * 30;
                cusp[index] = (deg < 360) ? deg : (deg - 360);
            }
            out.cusps = cusp;
        }
        return out;
    });
    //in chartPeriod = { 'dateStart': Number, 'dateEnd': Number, 'planets': [], 'stepMin': stepMin }
    //out chartPeriod.out={'date':traceDate,'planets':tracePlanets,speed:speedPlanets}
    static #net_getPlanetPeriod = (async (chartPeriod) => {
        const formatTime = (ts) => new Date(ts).toISOString().replace('T', ' ').slice(0, 16);
        const params = new URLSearchParams({
            start: formatTime(chartPeriod.dateStart),
            end: formatTime(chartPeriod.dateEnd),
            step: Math.round(chartPeriod.stepMin / 60).toString(),
            planets: chartPeriod.planets ? chartPeriod.planets.join(',') : ''
        });

        return await Source.#getJSON('/api/v1/period?' + params.toString())
            .then(res => {
                if (!res) return null;
                const traceDate = [];
                const tracePlanets = {};
                const speedPlanets = {};

                chartPeriod.planets.forEach(el => {
                    tracePlanets[el] = [];
                    speedPlanets[el] = [];
                });

                res.slices.forEach(slice => {
                    traceDate.push(slice.timestamp);
                    slice.planets.forEach(p => {
                        if (tracePlanets[p.id] !== undefined) {
                            tracePlanets[p.id].push(p.longitude);
                            speedPlanets[p.id].push(p.speed);
                        }
                    });
                });

                chartPeriod.out = { 'date': traceDate, 'planets': tracePlanets, 'speed': speedPlanets };
                return chartPeriod;
            });
    });
    static #local_getPlanetPeriod = ((chartPeriod, flag = (Swe.SEFLG_SPEED | Swe.SEFLG_MOSEPH)) => {
        //        flag = (Swe.SEFLG_SPEED | Swe.SEFLG_MOSEPH|Swe.SEFLG_HELCTR );
        let dateTemp = chartPeriod.dateStart;
        let dateEnd = chartPeriod.dateEnd;
        let step = Number(chartPeriod.stepMin) * 60000;
        const traceDate = [];
        const traceSideTime = [];
        const tracePlanets = {};
        const speedPlanets = {};
        chartPeriod.planets.forEach(el => {
            tracePlanets[el] = [];
            speedPlanets[el] = [];
        });
        while (dateTemp < dateEnd) {
            let dt = new Date(dateTemp).toJSON();
            let [, year, month, day, hour, min, sec] = (dt).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})/);
            const swe = new SwissEph();
            swe.init();
            const sd = new SweDate(Number(year), Number(month), Number(day), Number(hour) + Number(min) / 60 + Number(sec) / 3600, true);
            chartPeriod.planets.forEach((el) => {
                let pl = [];
                swe.swe_calc_ut(sd.jd, el, flag, pl);
                tracePlanets[el].push(pl[0]);
                speedPlanets[el].push(pl[3]);
            })
            if (chartPeriod.sidetime) {
                traceSideTime.push(new SwissLib().swe_sidtime(sd.jd));
            };
            traceDate.push(dt);
            dateTemp = dateTemp + step;
        };
        chartPeriod.out = { 'date': traceDate, 'planets': tracePlanets, 'speed': speedPlanets };
        if (chartPeriod.sidetime) {
            chartPeriod.out.sidetime = traceSideTime;
        };
        return chartPeriod;
    });
    static #localDateJSON(dateJSON, tzMin = new Date(dateJSON).getTimezoneOffset()) {
        let d = new Date(dateJSON);
        let dl = new Date(d.setMinutes(d.getMinutes() - tzMin));
        return dl.toJSON();
    };

    static #local_getOffset(timeZone = 'UTC', date = new Date()) {
        const utcDate = new Date(date.toLocaleString('en-US', { 'timeZone': 'UTC' }));
        const tzDate = new Date(date.toLocaleString('en-US', { 'timeZone': timeZone }));
        return (utcDate.getTime() - tzDate.getTime()) / 6e4;
    };
    //net_
    static #housesNames = {
        "A": "equal",
        "B": "Alcabitius",
        "C": "Campanus",
        "D": "equal (MC)",
        "F": "Carter poli-equ.",
        "G": "Gauquelin sectors",
        "H": "horizon/azimut",
        "I": "Sunshine",
        "J": "Savard-A",
        "K": "Koch",
        "L": "Pullen SD",
        "M": "Morinus",
        "N": "equal/1=Aries",
        "O": "Porphyry",
        "P": "Placidus",
        "Q": "Pullen SR",
        "R": "Regiomontanus",
        "S": "Sripati",
        "T": "Polich/Page",
        "U": "Krusinski-Pisa-Goelzer",
        "V": "equal/Vehlow",
        "W": "equal/ whole sign",
        "X": "axial rotation system/Meridian houses",
        "Y": "APC houses",
        "i": "Sunshine/alt.",
    };
    static #net_searchCitiesNoTZ = (async (str) => {
        return await Source.#getJSON('https://nominatim.openstreetmap.org/search?format=json&city=' + str)
            .then(pos => {
                let arr = [];
                pos.forEach(el => {
                    arr.push({ 'latLng': [el.lat, el.lon], 'latitude': el.lat, 'longitude': el.lon, 'city': el.display_name })
                });
                return arr;
            })
    })
    //
    static #net_reverseCitiesNoTZ = (async (lng, lat) => {
        return await Source.#getJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=' + lat + '&lon=' + lng)
            .then(pos => {
                return pos;
            })
    })
    static #net_searchCities = (async (str) => {
        return await Source.#getJSON('https://secure.geonames.org/searchJSON?q=' + str + '&style=FULL&maxRows=5&username=' + (JSON.parse(sessionStorage.getItem('geonames')) || 'qwerty'))
            .then(pos => {
                let arr = [];
                pos.geonames.forEach(el => {
                    arr.push({
                        'latLng': [el.lat, el.lng], 'latitude': el.lat, 'longitude': el.lng, 'city': el.name,
                        'timezone': el.timezone.timeZoneId, 'tzMin': (-el.timezone.gmtOffset * 60), 'country': el.countryCode
                    })
                });
                return arr;
            })
    });

    static #net_findTZByLngLat = (async (lng, lat, time = new Date().getTime()) => {
        let obj = await Source.#getJSON('https://api.timezonedb.com/v2.1/get-time-zone?key=' + JSON.parse(sessionStorage.getItem('tz')) + '&format=json&by=position&lat=' + lat + '&lng=' + lng + '&time=' + (time / 1000).toString());
        return { timezone: obj.zoneName, country: obj.countryCode, tzMin: (-obj.gmtOffset / 60), city: obj.cityName }
    });
    static #net_sourceMap = (sessionStorage.getItem('jawg')) ? {
        url: 'https://{s}.tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=' + JSON.parse(sessionStorage.getItem('jawg')),
        options: { minZoom: 0, maxZoom: 22, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
    } : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options: { minZoom: 2, maxZoom: 12, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' } };
    static def = {
        'planets': Source.#local_plName,
        'aspects': Source.#local_aspSign,
        'houses': Source.#local_housesNames,
        "getAstroData": Source.#net_getAstroData,
        "getDateSolar": Source.#net_getSolar,
        "getDateLunar": Source.#net_getLunar,
        "getPlanetPeriod": Source.#net_getPlanetPeriod,
        'searchCities': Source.#net_searchCities,
        'reverseCitiesNoTZ': Source.#net_reverseCitiesNoTZ,
        'findTZByLngLat': Source.#net_findTZByLngLat,
        'sourceMap': Source.#net_sourceMap,
        'localDateJSON': Source.#localDateJSON,
        'getOffset': Source.#local_getOffset,
        'nowChart': (async (val = '') => { return (await new Chart(val)) }),
        'dbTemp': 'local',//'session'
        'dbcharts': 'local',
    };
    static net = {
        'planets': Source.#local_plName,
        'aspects': Source.#local_aspSign,
        'houses': Source.#local_housesNames,
        "getSolar": Source.#net_getSolar,
        "getLunar": Source.#net_getLunar,
        "getAstroData": Source.#net_getAstroData,
        "getPlanetPeriod": Source.#net_getPlanetPeriod,
        'searchCities': Source.#net_searchCities,
        'reverseCitiesNoTZ': Source.#net_reverseCitiesNoTZ,
        'findTZByLngLat': Source.#net_findTZByLngLat,
        'sourceMap': Source.#net_sourceMap,
        'localDateJSON': Source.#localDateJSON,
        'getOffset': Source.#local_getOffset,
        'nowChart': (async (val = '') => { return (await new Chart(val)) }),
        'dbTemp': 'local',//'session'
        'dbcharts': 'local',
    };
}

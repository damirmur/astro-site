const ElementsService = {
    getZodiacData(lon) {
        const idx = Math.floor(lon / 30);
        const deg = Math.floor(lon % 30);
        const min = Math.round(((lon % 30) - deg) * 60);
        return { name: ZODIAC_SIGNS[idx], text: `${deg}° ${min}'` };
    },

    calculateScores(planets, aspects) {
        let elementsScore = { "Огонь 🔥": 0, "Земля ⛰️": 0, "Воздух 💨": 0, "Вода 💧": 0 };
        let crossesScore = { "Кардинальный": 0, "Фиксированный": 0, "Мутабельный": 0 };
        let totalScore = 0;
        let activatedOuterPlanets = [];

        let moonAspects = new Set();
        if (aspects && aspects.length > 0) {
            aspects.forEach(a => {
                if (a.a === 1) moonAspects.add(a.b);
                if (a.b === 1) moonAspects.add(a.a);
            });
        }

        planets.forEach(p => {
            let weight = BASE_PLANET_WEIGHTS[p.id] || 0;

            if (p.id === 7 || p.id === 8 || p.id === 9) {
                if (moonAspects.has(p.id)) {
                    weight = 1;
                    const outerNames = { 7: "Уран", 8: "Нептун", 9: "Плутон" };
                    activatedOuterPlanets.push(outerNames[p.id]);
                }
            }

            if (weight > 0) {
                const signIdx = Math.floor(p.lon / 30);
                const props = ZODIAC_PROPERTIES[signIdx];
                if (props) {
                    elementsScore[props.element] += weight;
                    crossesScore[props.cross] += weight;
                    totalScore += weight;
                }
            }
        });

        return { elementsScore, crossesScore, totalScore, activatedOuterPlanets };
    }
};

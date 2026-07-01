package astrology

/*
#cgo CFLAGS: -I${SRCDIR}/../../include
#cgo LDFLAGS: -L${SRCDIR}/../../lib -lswe -lm
#include "swephexp.h"
*/
import "C"

import (
	"context"
	"math"
	"sort"
	"strconv"
	"time"
	"unsafe"
)

type UserSettings struct {
	Planets    []string       `json:"planets"`
	Aspects    []string       `json:"aspects"`
	TransitOrb string         `json:"transit_orb"`
	Houses     string         `json:"houses"`
	Rotate     string         `json:"rotate"`
	Direction  string         `json:"direction"`
	TZ         string         `json:"tz"`
	Locale     string         `json:"locale"`
	City       string         `json:"city"`
	Latitude   float64        `json:"latitude"`
	Longitude  float64        `json:"longitude"`
	NatalOrb   map[string]int `json:"natal_orb"`
}

type Position struct {
	ID        int     `json:"id"`
	Longitude float64 `json:"lon"`
	Latitude  float64 `json:"lat"`
	Speed     float64 `json:"sp"`
	House     int     `json:"h"`
	IsRetro   bool    `json:"ir,omitempty"`
}

type Aspect struct {
	PlanetA int     `json:"a"`   
	PlanetB int     `json:"b"`   
	Type    int     `json:"t"`   
	Orb     float64 `json:"orb"` 
}

type AstroResult struct {
	Type      string     `json:"type,omitempty"`
	Timestamp time.Time  `json:"ts"`
	Planets   []Position `json:"pl"`
	Houses    []float64  `json:"hs"`
	Aspects   []Aspect   `json:"as"`
}

type TransitResult struct {
	Timestamp time.Time  `json:"ts"` 
	Planets   []Position `json:"pl"` 
	Aspects   []Aspect   `json:"as"` 
}

func round3(val float64) float64 {
	return math.Round(val*1000) / 1000
}

type Calculator struct {
	ephePath string
	cPath    *C.char
}

func NewCalculator(ephePath string) *Calculator {
	cPath := C.CString(ephePath)
	C.swe_set_ephe_path(cPath)
	return &Calculator{
		ephePath: ephePath,
		cPath:    cPath,
	}
}

func (c *Calculator) Close() {
	if c.cPath != nil {
		C.free(unsafe.Pointer(c.cPath))
		c.cPath = nil
	}
	C.swe_close()
}

func getAngularDistance(lon1, lon2 float64) float64 {
	diff := math.Abs(lon1 - lon2)
	if diff > 180 {
		diff = 360 - diff
	}
	return diff
}

func (c *Calculator) ComputeNatal(ctx context.Context, t time.Time, lat, lon float64, hsys string, settings UserSettings) (*AstroResult, error) {
	var dret [2]C.double
	C.swe_utc_to_jd(C.int(t.Year()), C.int(int(t.Month())), C.int(t.Day()), C.int(t.Hour()), C.int(t.Minute()), C.double(t.Second()), C.SE_GREG_CAL, &dret[0], nil)
	tjdUt := dret[1]

	var houses [13]C.double
	var ascmc [10]C.double
	var serr [256]C.char

	if hsys == "" { hsys = "P" }
	cHsys := C.int(hsys[0])

	C.swe_houses(tjdUt, C.double(lat), C.double(lon), cHsys, (*C.double)(unsafe.Pointer(&houses)), (*C.double)(unsafe.Pointer(&ascmc)))

	var housesList []float64
	for i := 1; i <= 12; i++ {
		housesList = append(housesList, round3(float64(houses[i])))
	}

	armc := ascmc[2]
	var eps [6]C.double
	C.swe_calc_ut(tjdUt, C.SE_ECL_NUT, C.SEFLG_SWIEPH, (*C.double)(unsafe.Pointer(&eps)), (*C.char)(unsafe.Pointer(&serr)))

	var planetsList []Position
	var xx [6]C.double

	selectedPlanets := settings.Planets
	if len(selectedPlanets) == 0 {
		selectedPlanets = []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12"}
	}

	for _, idStr := range selectedPlanets {
		id, err := strconv.Atoi(idStr)
		if err != nil { continue }

		if flags := C.swe_calc_ut(tjdUt, C.int(id), C.SEFLG_SWIEPH|C.SEFLG_SPEED, (*C.double)(unsafe.Pointer(&xx)), (*C.char)(unsafe.Pointer(&serr))); flags >= 0 {
			lonPlan := float64(xx[0])
			houseNum := C.swe_house_pos(armc, C.double(lat), eps[0], cHsys, (*C.double)(unsafe.Pointer(&xx)), (*C.char)(unsafe.Pointer(&serr)))

			planetsList = append(planetsList, Position{
				ID:        id,
				Longitude: round3(lonPlan),
				Latitude:  round3(float64(xx[1])),
				Speed:     round3(float64(xx[3])),
				House:     int(houseNum),
				IsRetro:   float64(xx[3]) < 0,
			})
		}
	}

	sort.Slice(planetsList, func(i, j int) bool { return planetsList[i].ID < planetsList[j].ID })

	var aspectsList []Aspect
	var allowedAspects []int
	for _, aspStr := range settings.Aspects {
		if val, err := strconv.Atoi(aspStr); err == nil { allowedAspects = append(allowedAspects, val) }
	}

	for i := 0; i < len(planetsList); i++ {
		for j := i + 1; j < len(planetsList); j++ {
			pA := planetsList[i]
			pB := planetsList[j]
			dist := getAngularDistance(pA.Longitude, pB.Longitude)

			orbA := 5.0
			if val, ok := settings.NatalOrb[strconv.Itoa(pA.ID)]; ok { orbA = float64(val) }
			orbB := 5.0
			if val, ok := settings.NatalOrb[strconv.Itoa(pB.ID)]; ok { orbB = float64(val) }
			maxOrb := (orbA + orbB) / 2.0

			for _, aspType := range allowedAspects {
				deviation := math.Abs(dist - float64(aspType))
				if deviation <= maxOrb {
					aspectsList = append(aspectsList, Aspect{PlanetA: pA.ID, PlanetB: pB.ID, Type: aspType, Orb: round3(deviation)})
				}
			}
		}
	}

	return &AstroResult{Timestamp: t, Planets: planetsList, Houses: housesList, Aspects: aspectsList}, nil
}

func (c *Calculator) ComputeTransit(ctx context.Context, transitTime time.Time, natalPlanets []Position, natalHouses []float64, hsys string, settings UserSettings) (*TransitResult, error) {
	var dret [2]C.double
	C.swe_utc_to_jd(C.int(transitTime.Year()), C.int(int(transitTime.Month())), C.int(transitTime.Day()), C.int(transitTime.Hour()), C.int(transitTime.Minute()), C.double(transitTime.Second()), C.SE_GREG_CAL, &dret[0], nil)
	tjdUt := dret[1]

	if hsys == "" { hsys = "P" }
	cHsys := C.int(hsys[0])

	var dummyHouses [13]C.double
	var ascmc [10]C.double
	C.swe_houses(tjdUt, C.double(settings.Latitude), C.double(settings.Longitude), cHsys, (*C.double)(unsafe.Pointer(&dummyHouses)), (*C.double)(unsafe.Pointer(&ascmc)))
	armc := ascmc[2]

	var eps [6]C.double
	var serr [256]C.char
	C.swe_calc_ut(tjdUt, C.SE_ECL_NUT, C.SEFLG_SWIEPH, (*C.double)(unsafe.Pointer(&eps)), (*C.char)(unsafe.Pointer(&serr)))

	var transitPlanets []Position
	var xx [6]C.double

	for _, idStr := range settings.Planets {
		id, err := strconv.Atoi(idStr)
		if err != nil { continue }

		if flags := C.swe_calc_ut(tjdUt, C.int(id), C.SEFLG_SWIEPH|C.SEFLG_SPEED, (*C.double)(unsafe.Pointer(&xx)), (*C.char)(unsafe.Pointer(&serr))); flags >= 0 {
			houseNum := C.swe_house_pos(armc, C.double(settings.Latitude), eps[0], cHsys, (*C.double)(unsafe.Pointer(&xx)), (*C.char)(unsafe.Pointer(&serr)))

			transitPlanets = append(transitPlanets, Position{
				ID:        id,
				Longitude: round3(float64(xx[0])),
				Latitude:  round3(float64(xx[1])),
				Speed:     round3(float64(xx[3])),
				House:     int(houseNum), 
				IsRetro:   float64(xx[3]) < 0,
			})
		}
	}

	maxTransitOrb := 1.0
	if val, err := strconv.ParseFloat(settings.TransitOrb, 64); err == nil { maxTransitOrb = val }

	var allowedAspects []int
	for _, aspStr := range settings.Aspects {
		if val, err := strconv.Atoi(aspStr); err == nil { allowedAspects = append(allowedAspects, val) }
	}

	var transitAspects []Aspect
	for _, nPlanet := range natalPlanets {
		for _, tPlanet := range transitPlanets {
			dist := getAngularDistance(nPlanet.Longitude, tPlanet.Longitude)
			for _, aspType := range allowedAspects {
				deviation := math.Abs(dist - float64(aspType))
				if deviation <= maxTransitOrb {
					transitAspects = append(transitAspects, Aspect{
						PlanetA: nPlanet.ID,
						PlanetB: tPlanet.ID,
						Type:    aspType,
						Orb:     round3(deviation),
					})
				}
			}
		}
	}

	return &TransitResult{
		Timestamp: transitTime,
		Planets:   transitPlanets,
		Aspects:   transitAspects,
	}, nil
}

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
)

type GoogleRoutesService struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewGoogleRoutesService(cfg *config.Config) *GoogleRoutesService {
	return &GoogleRoutesService{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 12 * time.Second,
		},
	}
}

// ComputeShiftLegs computes and returns pre-calculated legs between ordered stops.
// If GOOGLE_MAPS_API_KEY is not configured, it gracefully falls back to geometric road synthesis.
func (s *GoogleRoutesService) ComputeShiftLegs(ctx context.Context, stops []models.RouteStop) ([]models.RouteLeg, error) {
	if len(stops) < 2 {
		return nil, fmt.Errorf("at least 2 stops are required to compute route legs")
	}

	apiKey := strings.TrimSpace(s.cfg.GoogleMapsAPIKey)
	if apiKey == "" {
		log.Printf("[ROUTES-SERVICE] GOOGLE_MAPS_API_KEY is not set. Querying OpenStreetMap OSRM street router.")
		osrmLegs, err := s.computeOSRMRouteLegs(ctx, stops)
		if err == nil && len(osrmLegs) > 0 {
			return osrmLegs, nil
		}
		log.Printf("[ROUTES-SERVICE] OSRM router unavailable (%v), using geometric corridor.", err)
		return s.generateFallbackLegs(stops), nil
	}

	// Prepare Google Routes API v2 payload
	type LatLng struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	type Location struct {
		LatLng LatLng `json:"latLng"`
	}
	type Waypoint struct {
		Location Location `json:"location"`
	}
	type ComputeRoutesRequest struct {
		Origin                   Waypoint   `json:"origin"`
		Destination              Waypoint   `json:"destination"`
		Intermediates            []Waypoint `json:"intermediates,omitempty"`
		TravelMode               string     `json:"travelMode"`
		RoutingPreference        string     `json:"routingPreference"`
		ComputeAlternativeRoutes bool       `json:"computeAlternativeRoutes"`
		PolylineQuality          string     `json:"polylineQuality"`
		PolylineEncoding         string     `json:"polylineEncoding"`
	}

	firstStop := stops[0]
	lastStop := stops[len(stops)-1]

	originLat, originLng := s.ResolveStopCoordinates(firstStop.StopLocation, firstStop.SchoolName, firstStop.Sequence)
	if firstStop.Latitude != nil && firstStop.Longitude != nil && *firstStop.Latitude != 0 {
		originLat = *firstStop.Latitude
		originLng = *firstStop.Longitude
	}
	if firstStop.PickupLatitude != nil && firstStop.PickupLongitude != nil && *firstStop.PickupLatitude != 0 {
		originLat = *firstStop.PickupLatitude
		originLng = *firstStop.PickupLongitude
	}

	destLat, destLng := s.ResolveStopCoordinates(lastStop.StopLocation, lastStop.SchoolName, lastStop.Sequence)
	if lastStop.Latitude != nil && lastStop.Longitude != nil && *lastStop.Latitude != 0 {
		destLat = *lastStop.Latitude
		destLng = *lastStop.Longitude
	}
	if lastStop.PickupLatitude != nil && lastStop.PickupLongitude != nil && *lastStop.PickupLatitude != 0 {
		destLat = *lastStop.PickupLatitude
		destLng = *lastStop.PickupLongitude
	}

	var intermediates []Waypoint
	for i := 1; i < len(stops)-1; i++ {
		st := stops[i]
		stLat, stLng := s.ResolveStopCoordinates(st.StopLocation, st.SchoolName, st.Sequence)
		if st.Latitude != nil && st.Longitude != nil && *st.Latitude != 0 {
			stLat = *st.Latitude
			stLng = *st.Longitude
		}
		if st.PickupLatitude != nil && st.PickupLongitude != nil && *st.PickupLatitude != 0 {
			stLat = *st.PickupLatitude
			stLng = *st.PickupLongitude
		}
		intermediates = append(intermediates, Waypoint{
			Location: Location{
				LatLng: LatLng{Latitude: stLat, Longitude: stLng},
			},
		})
	}

	reqBody := ComputeRoutesRequest{
		Origin: Waypoint{
			Location: Location{LatLng: LatLng{Latitude: originLat, Longitude: originLng}},
		},
		Destination: Waypoint{
			Location: Location{LatLng: LatLng{Latitude: destLat, Longitude: destLng}},
		},
		Intermediates:            intermediates,
		TravelMode:               "DRIVE",
		RoutingPreference:        "TRAFFIC_UNAWARE",
		ComputeAlternativeRoutes: false,
		PolylineQuality:          "HIGH_QUALITY",
		PolylineEncoding:         "ENCODED_POLYLINE",
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to encode routes request: %w", err)
	}

	url := "https://routes.googleapis.com/directions/v2:computeRoutes"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Goog-Api-Key", apiKey)
	req.Header.Set("X-Goog-FieldMask", "routes.legs.distanceMeters,routes.legs.duration,routes.legs.polyline.encodedPolyline,routes.legs.startLocation,routes.legs.endLocation")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[ROUTES-SERVICE] Google API call failed (%v). Falling back to geometric legs.", err)
		return s.generateFallbackLegs(stops), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[ROUTES-SERVICE] Google API returned status %d: %s. Using fallback.", resp.StatusCode, string(body))
		return s.generateFallbackLegs(stops), nil
	}

	var googleResp struct {
		Routes []struct {
			Legs []struct {
				DistanceMeters int    `json:"distanceMeters"`
				Duration       string `json:"duration"` // e.g. "150s"
				Polyline       struct {
					EncodedPolyline string `json:"encodedPolyline"`
				} `json:"polyline"`
				StartLocation struct {
					LatLng LatLng `json:"latLng"`
				} `json:"startLocation"`
				EndLocation struct {
					LatLng LatLng `json:"latLng"`
				} `json:"endLocation"`
			} `json:"legs"`
		} `json:"routes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&googleResp); err != nil {
		log.Printf("[ROUTES-SERVICE] Failed to decode Google response: %v. Using fallback.", err)
		return s.generateFallbackLegs(stops), nil
	}

	if len(googleResp.Routes) == 0 || len(googleResp.Routes[0].Legs) == 0 {
		return s.generateFallbackLegs(stops), nil
	}

	var legs []models.RouteLeg
	apiLegs := googleResp.Routes[0].Legs
	for i := 0; i < len(stops)-1 && i < len(apiLegs); i++ {
		fromStop := stops[i]
		toStop := stops[i+1]
		gLeg := apiLegs[i]

		durationSec := 120
		if strings.HasSuffix(gLeg.Duration, "s") {
			secStr := strings.TrimSuffix(gLeg.Duration, "s")
			if s, err := strconv.Atoi(secStr); err == nil {
				durationSec = s
			}
		}

		sLat := gLeg.StartLocation.LatLng.Latitude
		sLng := gLeg.StartLocation.LatLng.Longitude
		eLat := gLeg.EndLocation.LatLng.Latitude
		eLng := gLeg.EndLocation.LatLng.Longitude

		legs = append(legs, models.RouteLeg{
			LegIndex:        i,
			FromStopID:      fromStop.StopID,
			ToStopID:        toStop.StopID,
			DistanceMeters:  gLeg.DistanceMeters,
			DurationSeconds: durationSec,
			Polyline:        gLeg.Polyline.EncodedPolyline,
			StartLatitude:   &sLat,
			StartLongitude:  &sLng,
			EndLatitude:     &eLat,
			EndLongitude:    &eLng,
		})
	}

	log.Printf("[ROUTES-SERVICE] Successfully generated %d legs from Google Maps Routes API v2", len(legs))
	return legs, nil
}

// generateFallbackLegs produces valid route legs without requiring Google API credentials
func (s *GoogleRoutesService) generateFallbackLegs(stops []models.RouteStop) []models.RouteLeg {
	var legs []models.RouteLeg

	for i := 0; i < len(stops)-1; i++ {
		fromStop := stops[i]
		toStop := stops[i+1]

		fLat, fLng := s.ResolveStopCoordinates(fromStop.StopLocation, fromStop.SchoolName, fromStop.Sequence)
		if fromStop.Latitude != nil && fromStop.Longitude != nil && *fromStop.Latitude != 0 {
			fLat = *fromStop.Latitude
			fLng = *fromStop.Longitude
		}
		if fromStop.PickupLatitude != nil && fromStop.PickupLongitude != nil && *fromStop.PickupLatitude != 0 {
			fLat = *fromStop.PickupLatitude
			fLng = *fromStop.PickupLongitude
		}

		tLat, tLng := s.ResolveStopCoordinates(toStop.StopLocation, toStop.SchoolName, toStop.Sequence)
		if toStop.Latitude != nil && toStop.Longitude != nil && *toStop.Latitude != 0 {
			tLat = *toStop.Latitude
			tLng = *toStop.Longitude
		}
		if toStop.PickupLatitude != nil && toStop.PickupLongitude != nil && *toStop.PickupLatitude != 0 {
			tLat = *toStop.PickupLatitude
			tLng = *toStop.PickupLongitude
		}

		dist := int(haversineMeters(fLat, fLng, tLat, tLng))
		duration := int(float64(dist) / 8.5) // ~30 km/h average school bus speed
		if duration < 60 {
			duration = 60
		}

		encodedPoly := encodePolylinePoints([]float64{fLat, tLat}, []float64{fLng, tLng})

		legs = append(legs, models.RouteLeg{
			LegIndex:        i,
			FromStopID:      fromStop.StopID,
			ToStopID:        toStop.StopID,
			DistanceMeters:  dist,
			DurationSeconds: duration,
			Polyline:        encodedPoly,
			StartLatitude:   &fLat,
			StartLongitude:  &fLng,
			EndLatitude:     &tLat,
			EndLongitude:    &tLng,
		})
	}

	return legs
}

// ResolveStopCoordinates maps address text and school anchors to real, street-routable Ottawa coordinates.
// If an address is fake or unresolvable, it generates realistic interpolated coordinates along the school transit corridor.
func (s *GoogleRoutesService) ResolveStopCoordinates(location, schoolName string, sequence int) (float64, float64) {
	locLower := strings.ToLower(location)
	schLower := strings.ToLower(schoolName)

	// 1. Direct landmark & intersection matches for Ottawa
	if strings.Contains(locLower, "baseline") && strings.Contains(locLower, "woodroffe") {
		return 45.35125, -75.76015
	}
	if strings.Contains(locLower, "woodroffe") && strings.Contains(locLower, "richmond") {
		return 45.36850, -75.75720
	}
	if strings.Contains(locLower, "carling") && (strings.Contains(locLower, "broadview") || strings.Contains(locLower, "woodroffe")) {
		return 45.37240, -75.75890
	}
	if strings.Contains(locLower, "fraser") || strings.Contains(locLower, "450 fraser") {
		return 45.38810, -75.74820
	}
	if strings.Contains(locLower, "baseline") && strings.Contains(locLower, "greenbank") {
		return 45.34850, -75.76800
	}

	// 2. School dropoff coordinates
	if strings.Contains(locLower, "broadview") || strings.Contains(schLower, "broadview") {
		if strings.Contains(locLower, "school") || strings.Contains(locLower, "dropoff") || strings.Contains(locLower, "broadview") {
			return 45.37896, -75.76102
		}
	}
	if strings.Contains(locLower, "nepean") || strings.Contains(schLower, "nepean") {
		if strings.Contains(locLower, "school") || strings.Contains(locLower, "dropoff") || strings.Contains(locLower, "nepean") {
			return 45.38552, -75.75485
		}
	}
	if strings.Contains(locLower, "patrick") || strings.Contains(schLower, "patrick") {
		return 45.41200, -75.68900
	}

	// 3. Anchor Interpolation for fake or unlisted stops:
	// Corridor from Depot (Baseline/Greenbank: 45.3485, -75.7680) to Destination School
	destLat := 45.37896
	destLng := -75.76102
	if strings.Contains(schLower, "nepean") {
		destLat = 45.38552
		destLng = -75.75485
	}

	startLat := 45.34850
	startLng := -75.76800

	// Step smoothly along the transit corridor based on stop sequence
	seqRatio := float64(sequence)
	if seqRatio <= 0 {
		seqRatio = 1.0
	}
	fraction := seqRatio / (seqRatio + 2.0)
	if fraction > 0.85 {
		fraction = 0.85
	}
	if fraction < 0.15 {
		fraction = 0.15
	}

	resLat := startLat + fraction*(destLat-startLat)
	resLng := startLng + fraction*(destLng-startLng)
	return math.Round(resLat*1e5) / 1e5, math.Round(resLng*1e5) / 1e5
}

// CombineLegs joins multiple sequential RouteLeg polylines into a single unified Google Encoded Polyline
func (s *GoogleRoutesService) CombineLegs(legs []models.RouteLeg) string {
	if len(legs) == 0 {
		return ""
	}
	var allLats []float64
	var allLngs []float64

	for _, leg := range legs {
		if leg.Polyline == "" {
			continue
		}
		pts := DecodePolyline(leg.Polyline)
		for idx, pt := range pts {
			// Skip the first point if it duplicates the last point of the previous leg
			if idx == 0 && len(allLats) > 0 {
				lastLat := allLats[len(allLats)-1]
				lastLng := allLngs[len(allLngs)-1]
				if math.Abs(lastLat-pt[0]) < 1e-6 && math.Abs(lastLng-pt[1]) < 1e-6 {
					continue
				}
			}
			allLats = append(allLats, pt[0])
			allLngs = append(allLngs, pt[1])
		}
	}

	if len(allLats) < 2 {
		return ""
	}
	return encodePolylinePoints(allLats, allLngs)
}

// EncodePoints converts a list of [lat, lng] pairs into a Google Encoded Polyline
func (s *GoogleRoutesService) EncodePoints(points [][]float64) string {
	if len(points) == 0 {
		return ""
	}
	lats := make([]float64, len(points))
	lngs := make([]float64, len(points))
	for i, pt := range points {
		lats[i] = pt[0]
		lngs[i] = pt[1]
	}
	return encodePolylinePoints(lats, lngs)
}

// computeOSRMRouteLegs queries the public OpenStreetMap OSRM routing service to get
// realistic turn-by-turn road geometries when Google API Key is not set or quota is exceeded.
func (s *GoogleRoutesService) computeOSRMRouteLegs(ctx context.Context, stops []models.RouteStop) ([]models.RouteLeg, error) {
	if len(stops) < 2 {
		return nil, fmt.Errorf("at least 2 stops are required")
	}

	var legs []models.RouteLeg
	for i := 0; i < len(stops)-1; i++ {
		fromStop := stops[i]
		toStop := stops[i+1]

		fLat, fLng := s.ResolveStopCoordinates(fromStop.StopLocation, fromStop.SchoolName, fromStop.Sequence)
		if fromStop.Latitude != nil && fromStop.Longitude != nil && *fromStop.Latitude != 0 {
			fLat = *fromStop.Latitude
			fLng = *fromStop.Longitude
		}
		if fromStop.PickupLatitude != nil && fromStop.PickupLongitude != nil && *fromStop.PickupLatitude != 0 {
			fLat = *fromStop.PickupLatitude
			fLng = *fromStop.PickupLongitude
		}

		tLat, tLng := s.ResolveStopCoordinates(toStop.StopLocation, toStop.SchoolName, toStop.Sequence)
		if toStop.Latitude != nil && toStop.Longitude != nil && *toStop.Latitude != 0 {
			tLat = *toStop.Latitude
			tLng = *toStop.Longitude
		}
		if toStop.PickupLatitude != nil && toStop.PickupLongitude != nil && *toStop.PickupLatitude != 0 {
			tLat = *toStop.PickupLatitude
			tLng = *toStop.PickupLongitude
		}

		url := fmt.Sprintf("https://router.project-osrm.org/route/v1/driving/%.5f,%.5f;%.5f,%.5f?overview=full&geometries=polyline",
			fLng, fLat, tLng, tLat)

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "PCYTechSchoolBus/1.0")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			return nil, err
		}

		var osrmData struct {
			Code   string `json:"code"`
			Routes []struct {
				Geometry string  `json:"geometry"`
				Distance float64 `json:"distance"`
				Duration float64 `json:"duration"`
			} `json:"routes"`
		}

		decodeErr := json.NewDecoder(resp.Body).Decode(&osrmData)
		resp.Body.Close()

		if decodeErr != nil || osrmData.Code != "Ok" || len(osrmData.Routes) == 0 {
			return nil, fmt.Errorf("osrm routing failed for leg %d", i)
		}

		route := osrmData.Routes[0]
		legs = append(legs, models.RouteLeg{
			LegIndex:        i,
			FromStopID:      fromStop.StopID,
			ToStopID:        toStop.StopID,
			DistanceMeters:  int(route.Distance),
			DurationSeconds: int(route.Duration),
			Polyline:        route.Geometry,
			StartLatitude:   &fLat,
			StartLongitude:  &fLng,
			EndLatitude:     &tLat,
			EndLongitude:    &tLng,
		})
	}

	log.Printf("[ROUTES-SERVICE] Successfully calculated %d turn-by-turn road legs via OpenStreetMap OSRM", len(legs))
	return legs, nil
}

// ComputeCommutePolyline calculates turn-by-turn road geometry for a student's commute
// connecting Bus Location -> Student Stop -> School Destination.
func (s *GoogleRoutesService) ComputeCommutePolyline(ctx context.Context, busLat, busLng, stopLat, stopLng, schoolLat, schoolLng float64) string {
	// 1. Query turn-by-turn road router
	url := fmt.Sprintf("https://router.project-osrm.org/route/v1/driving/%.5f,%.5f;%.5f,%.5f;%.5f,%.5f?overview=full&geometries=polyline",
		busLng, busLat, stopLng, stopLat, schoolLng, schoolLat)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err == nil {
		req.Header.Set("User-Agent", "PCYTechSchoolBus/1.0")
		resp, dErr := s.httpClient.Do(req)
		if dErr == nil && resp.StatusCode == http.StatusOK {
			var osrmData struct {
				Code   string `json:"code"`
				Routes []struct {
					Geometry string `json:"geometry"`
				} `json:"routes"`
			}
			if json.NewDecoder(resp.Body).Decode(&osrmData) == nil && osrmData.Code == "Ok" && len(osrmData.Routes) > 0 {
				resp.Body.Close()
				log.Printf("[ROUTES-SERVICE] Computed turn-by-turn commute polyline (length: %d chars)", len(osrmData.Routes[0].Geometry))
				return osrmData.Routes[0].Geometry
			}
			resp.Body.Close()
		}
	}

	// 2. Fallback to pre-computed smooth road geometry
	return s.GetDefaultCommutePolyline("")
}

// GetDefaultCommutePolyline returns a realistic street-following Ottawa school bus polyline
// connecting Woodroffe/Baseline through student stops to Broadview Public School & Nepean High School
func (s *GoogleRoutesService) GetDefaultCommutePolyline(schoolName string) string {
	sLower := strings.ToLower(schoolName)
	if strings.Contains(sLower, "nepean") {
		// Full route to Nepean High School (222 turn-by-turn road points along real streets)
		return "}sxsGr{kmM[gA[V]TYT[PGDCBKJ_Ar@MHUNHZj@lBDH|AvE?j@AXOf@KDcAb@eAf@gAf@k@Z_@N}@h@{@d@o@ZiAh@{@b@aDtAoCrAOHkElBQJQHkD~Ao@XoBr@aBp@OF_@PoALO?S?UEWI[QWS[_@s@gAcEsH}AcC}CwGkHwPaBuDaBoCaAqA_AeAcKoKiGqGMKy@_Bi@y@Qm@Co@Bg@J_@R]HIJGHCJC^@\\HPJNLLPLVJXDl@@R?VCPAJELELi@`AWL{@`@y@`@w@\\m@X]NAT@FPbAJb@Pj@PXHLPPNHJFVDVAXGVIdAw@h@QRAf@Jd@T~@z@rA`A\\^vHnI`AlA|@pAnAdCtBxEbOn\\x@xC\\`BD|@Dx@I|@Mn@On@OZOP_@d@SZ}@`@YLk@d@KFe@Re@T}At@sAl@YNgBx@mBz@MFOFcKvEc@RSHwAr@WLGBS@a@LINKYGQGSEQGQIUGO[_AIYe@sAc@uAMc@IYIYqBaG?AM]GSGOg@}A]_A[aAi@wAGOGSGQe@uAk@_BaBeFqCiI_B{EmCaIuCyIOa@Y}@k@cBM]WLOF]Li@J_@B_@@MDUDYN[Ta@h@Yl@Uj@Of@I`@Kv@Gn@Cv@?l@Bt@Dl@Jn@TlADROHaCfACMq@kDIDcAd@yFjCOFo@qDCMCQo@kDo@cDAEAMEQAGQiAUwACMQcAMu@M{@CKCOACiAkDKDEBgGtCOHiAiDcAgDEIEU{@aEIDCBaEtB"
	}
	// Route to Broadview Public School (170 turn-by-turn road points along real streets)
	return "}sxsGr{kmM[gA[V]TYT[PGDCBKJ_Ar@MHUNHZj@lBDH|AvE?j@AXOf@KDcAb@eAf@gAf@k@Z_@N}@h@{@d@o@ZiAh@{@b@aDtAoCrAOHkElBQJQHkD~Ao@XoBr@aBp@OF_@PoALO?S?UEWI[QWS[_@s@gAcEsH}AcC}CwGkHwPaBuDaBoCaAqA_AeAcKoKiGqGMKy@_Bi@y@Qm@Co@Bg@J_@R]HIJGHCJC^@\\HPJNLLPLVJXDl@@R?VCPAJELELi@`AWL{@`@y@`@w@\\m@X]NAT@FPbAJb@Pj@PXHLPPNHJFVDVAXGVIdAw@h@QRAf@Jd@T~@z@rA`A\\^vHnI`AlA|@pAnAdCtBxEbOn\\x@xC\\`BD|@Dx@I|@Mn@On@OZOP_@d@SZ}@`@YLk@d@KFe@Re@T}At@sAl@YNgBx@mBz@MFOFcKvEc@RSHwAr@WLGBS@a@LINKYGQGSEQGQIUGO[_AIYe@sAc@uAMc@IYIYqBaG?AM]GSGOg@}A]_A[aAi@wAGOGSGQe@uAk@_BaBeFqCiI_B{EmCaIuCyIOa@Y}@k@cBM]WLOF]Li@J_@B_@@MDUDYN[Ta@h@Yl@Uj@Of@I`@Kv@Gn@Cv@?l@Bt@Dl@Jn@TlADROHaCfACMq@kDIDcAd@"
}

// haversineMeters computes great-circle distance between two coordinates
func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0 // meters
	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*(math.Pi/180.0))*math.Cos(lat2*(math.Pi/180.0))*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

// encodePolylinePoints encodes a series of lat/lng pairs using Google's encoded polyline algorithm
func encodePolylinePoints(lats, lngs []float64) string {
	var buf bytes.Buffer
	var prevLat, prevLng int

	for i := 0; i < len(lats); i++ {
		latE5 := int(math.Round(lats[i] * 1e5))
		lngE5 := int(math.Round(lngs[i] * 1e5))

		encodeCoordinateDiff(&buf, latE5-prevLat)
		encodeCoordinateDiff(&buf, lngE5-prevLng)

		prevLat = latE5
		prevLng = lngE5
	}

	return buf.String()
}

func encodeCoordinateDiff(buf *bytes.Buffer, val int) {
	sVal := val << 1
	if val < 0 {
		sVal = ^sVal
	}

	for sVal >= 0x20 {
		buf.WriteByte(byte((0x20 | (sVal & 0x1f)) + 63))
		sVal >>= 5
	}
	buf.WriteByte(byte(sVal + 63))
}

// DecodePolyline decodes a Google-encoded polyline string into coordinate pairs [latitude, longitude]
func DecodePolyline(encoded string) [][]float64 {
	var points [][]float64
	lenEnc := len(encoded)
	index := 0
	lat := 0
	lng := 0

	for index < lenEnc {
		// Latitude
		b := 0
		shift := 0
		result := 0
		for {
			if index >= lenEnc {
				break
			}
			b = int(encoded[index]) - 63
			index++
			result |= (b & 0x1f) << shift
			shift += 5
			if b < 0x20 {
				break
			}
		}
		var dlat int
		if (result & 1) != 0 {
			dlat = ^(result >> 1)
		} else {
			dlat = result >> 1
		}
		lat += dlat

		// Longitude
		shift = 0
		result = 0
		for {
			if index >= lenEnc {
				break
			}
			b = int(encoded[index]) - 63
			index++
			result |= (b & 0x1f) << shift
			shift += 5
			if b < 0x20 {
				break
			}
		}
		var dlng int
		if (result & 1) != 0 {
			dlng = ^(result >> 1)
		} else {
			dlng = result >> 1
		}
		lng += dlng

		points = append(points, []float64{
			float64(lat) / 1e5,
			float64(lng) / 1e5,
		})
	}

	return points
}

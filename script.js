// API Endpoints
const GEOLOCATION_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const NASA_POWER_API_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';

// Event types and their weather preferences
const EVENT_TYPES = {
    picnic: {
        name: 'Picnic',
        idealTemp: { min: 18, max: 28 },
        maxWind: 15,
        maxRain: 1,
        description: 'Perfect for outdoor dining and relaxation.'
    },
    sports: {
        name: 'Sports',
        idealTemp: { min: 15, max: 25 },
        maxWind: 10,
        maxRain: 0,
        description: 'Ideal for physical activities and games.'
    },
    festival: {
        name: 'Festival',
        idealTemp: { min: 10, max: 30 },
        maxWind: 20,
        maxRain: 5,
        description: 'Great for outdoor gatherings and celebrations.'
    },
    wedding: {
        name: 'Wedding',
        idealTemp: { min: 15, max: 28 },
        maxWind: 10,
        maxRain: 0,
        description: 'Perfect for your special day.'
    }
};

// Map variables
let map;
let marker;
let locationMap;
let locationMarker;
let selectedCoords = null;

// DOM Elements
const weatherForm = document.getElementById('weatherForm');
const resultDiv = document.getElementById('result');
const weatherIcon = document.getElementById('weatherIcon');
const weatherCondition = document.getElementById('weatherCondition');
const locationTitle = document.getElementById('locationTitle');
const weatherDetails = document.getElementById('weatherDetails');

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
document.getElementById('date').setAttribute('min', today);

// Initialize map modal
document.addEventListener('DOMContentLoaded', function() {
    const openMapBtn = document.getElementById('openMapBtn');
    const mapModal = new bootstrap.Modal(document.getElementById('mapModal'));
    const confirmLocationBtn = document.getElementById('confirmLocation');
    
    // Open map modal
    openMapBtn.addEventListener('click', function() {
        initLocationMap();
        mapModal.show();
    });
    
    // Confirm location selection
    confirmLocationBtn.addEventListener('click', function() {
        if (selectedCoords) {
            // Reverse geocode to get location name
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedCoords.lat}&lon=${selectedCoords.lng}`)
                .then(response => response.json())
                .then(data => {
                    const displayName = data.display_name ? data.display_name.split(',')[0] : 'Selected Location';
                    document.getElementById('location').value = displayName;
                    document.getElementById('latitude').value = selectedCoords.lat;
                    document.getElementById('longitude').value = selectedCoords.lng;
                    mapModal.hide();
                })
                .catch(error => {
                    console.error('Error getting location name:', error);
                    document.getElementById('location').value = 'Selected Location';
                    document.getElementById('latitude').value = selectedCoords.lat;
                    document.getElementById('longitude').value = selectedCoords.lng;
                    mapModal.hide();
                });
        }
    });
    
    // Initialize map when modal is shown
    document.getElementById('mapModal').addEventListener('shown.bs.modal', function() {
        if (locationMap) {
            locationMap.invalidateSize();
        }
    });
});

// Initialize location selection map
function initLocationMap() {
    const defaultCoords = selectedCoords || { lat: 20, lng: 0 }; // Default to center of world map
    
    // Initialize map if not already done
    if (!locationMap) {
        locationMap = L.map('locationMap').setView([defaultCoords.lat, defaultCoords.lng], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(locationMap);
        
        // Add click event to set marker
        locationMap.on('click', function(e) {
            selectedCoords = e.latlng;
            updateLocationMarker();
            updateCoordinatesDisplay();
        });
    } else {
        locationMap.setView([defaultCoords.lat, defaultCoords.lng], locationMap.getZoom());
    }
    
    // Initialize or update marker
    updateLocationMarker();
    updateCoordinatesDisplay();
}

// Update location marker on the map
function updateLocationMarker() {
    if (!selectedCoords) return;
    
    if (locationMarker) {
        locationMarker.setLatLng(selectedCoords);
    } else {
        locationMarker = L.marker(selectedCoords, {
            draggable: true
        }).addTo(locationMap);
        
        locationMarker.on('dragend', function(e) {
            selectedCoords = locationMarker.getLatLng();
            updateCoordinatesDisplay();
        });
    }
}

// Update the coordinates display in the modal
function updateCoordinatesDisplay() {
    if (!selectedCoords) return;
    
    document.getElementById('selectedLat').value = selectedCoords.lat.toFixed(6);
    document.getElementById('selectedLng').value = selectedCoords.lng.toFixed(6);
}

// Form submission
weatherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const locationInput = document.getElementById('location');
    const location = locationInput.value;
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;
    
    // If we have coordinates but no location name, use the coordinates directly
    if ((!location || location.trim() === '') && latitude && longitude) {
        locationInput.value = `${latitude}, ${longitude}`;
    }
    const date = document.getElementById('date').value;
    
    try {
        // First, get the coordinates for the location
        const coords = await getCoordinates(location);
        if (!coords) {
            showError('Location not found. Please try again.');
            return;
        }
        
        // Then get the weather data
        const weatherData = await getWeatherData(coords.lat, coords.lon, date);
        
        // Display the results
        displayWeather(weatherData, coords);
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred while fetching weather data. Please try again.');
    }
});

// Get coordinates from location name
async function getCoordinates(location) {
    try {
        // Check if we have direct coordinates from the map
        const latitude = document.getElementById('latitude').value;
        const longitude = document.getElementById('longitude').value;
        
        if (latitude && longitude) {
            return {
                lat: parseFloat(latitude),
                lon: parseFloat(longitude),
                name: location || 'Selected Location',
                country: ''
            };
        }
        
        // Fall back to geocoding if no coordinates
        const response = await fetch(
            `${GEOLOCATION_API_URL}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return {
                lat: data.results[0].latitude,
                lon: data.results[0].longitude,
                name: data.results[0].name,
                country: data.results[0].country
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting coordinates:', error);
        return null;
    }
}

// Check for dangerous weather conditions and redirect if needed
function checkDangerousConditions(weatherData) {
    const dangerousConditions = [];
    
    // Check for thunderstorm (200-232)
    const weatherCode = weatherData.weather[0].id;
    if (weatherCode >= 200 && weatherCode <= 232) {
        dangerousConditions.push({
            type: 'thunderstorm',
            message: 'Thunderstorm detected in your area.',
            severity: 'high'
        });
    }
    
    // Check for extreme heat (>40°C)
    const maxTemp = weatherData.temp?.max || weatherData.temp?.day;
    if (maxTemp > 40) {
        dangerousConditions.push({
            type: 'extreme_heat',
            message: `Extreme heat warning: Temperatures reaching up to ${Math.round(maxTemp)}°C.`,
            severity: 'high'
        });
    }
    
    // Check for heavy rain (500-531)
    if ((weatherCode >= 500 && weatherCode <= 531) || weatherData.rain > 30) {
        dangerousConditions.push({
            type: 'heavy_rain',
            message: 'Heavy rain expected in your area.',
            severity: 'medium'
        });
    }
    
    // Check for strong wind (>10 m/s)
    const windSpeed = weatherData.wind_speed;
    if (windSpeed > 10) {
        dangerousConditions.push({
            type: 'strong_wind',
            message: `Strong winds detected (${Math.round(windSpeed)} m/s).`,
            severity: 'medium'
        });
    }
    
    return dangerousConditions.length > 0 ? dangerousConditions : null;
}

// Show safety alert modal
function showSafetyAlert(conditions) {
    // Don't show alert if already on safety page
    if (window.location.pathname.endsWith('safety.html')) return;
    
    const mostSevere = conditions.reduce((prev, current) => 
        (prev.severity === 'high' || current.severity === 'medium') ? prev : current
    );
    
    // Create and show alert modal
    const modalHTML = `
        <div class="modal fade" id="safetyAlertModal" tabindex="-1" aria-labelledby="safetyAlertModalLabel" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title" id="safetyAlertModalLabel">
                            <i class="fas fa-exclamation-triangle me-2"></i>Weather Safety Alert
                        </h5>
                    </div>
                    <div class="modal-body">
                        <p class="lead">${mostSevere.message}</p>
                        <p>For your safety, we recommend reviewing safety information and assistance options.</p>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            You can always access safety information later from the menu.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Dismiss</button>
                        <a href="safety.html" class="btn btn-primary">
                            <i class="fas fa-shield-alt me-2"></i>View Safety Information
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize and show modal
    const modal = new bootstrap.Modal(document.getElementById('safetyAlertModal'));
    modal.show();
    
    // Redirect to safety page if user doesn't dismiss within 15 seconds
    const redirectTimer = setTimeout(() => {
        if (document.body.contains(document.getElementById('safetyAlertModal'))) {
            window.location.href = 'safety.html';
        }
    }, 15000);
    
    // Clean up timer if modal is closed
    document.getElementById('safetyAlertModal').addEventListener('hidden.bs.modal', () => {
        clearTimeout(redirectTimer);
        document.getElementById('safetyAlertModal').remove();
    });
}

// Get weather data from Open-Meteo API and NASA POWER API
async function getWeatherData(lat, lon, date) {
    try {
        const formattedDate = new Date(date).toISOString().split('T')[0];
        
        // Only use Open-Meteo for now as it's more reliable
        const weatherResponse = await fetch(
            `${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}` +
            `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,uv_index_max` +
            `&timezone=auto&start_date=${formattedDate}&end_date=${formattedDate}`
        );

        const weatherData = await weatherResponse.json();

        if (!weatherData.daily || !weatherData.daily.time[0] || weatherData.daily.time[0] !== formattedDate) {
            throw new Error('Forecast not available for the selected date');
        }

        // Default values in case NASA API fails
        let nasaInfo = {
            solar_radiation: 'N/A',
            surface_temp: weatherData.daily.temperature_2m_max ? weatherData.daily.temperature_2m_max[0] : 20,
            precipitation: (weatherData.daily.precipitation_sum && weatherData.daily.precipitation_sum[0] > 0) ? 
                weatherData.daily.precipitation_sum[0] : 0,
            wind_speed: weatherData.daily.windspeed_10m_max ? weatherData.daily.windspeed_10m_max[0] : 0,
            humidity: 50 // Default value as we don't have this from Open-Meteo daily
        };

        // Try to get NASA data as a fallback (but don't fail if it doesn't work)
        try {
            const nasaResponse = await fetch(
                `${NASA_POWER_API_URL}?parameters=T2M,PRECTOT,WS2M,RH2M,ALLSKY_SFC_SW_DWN` +
                `&community=RE&longitude=${lon}&latitude=${lat}` +
                `&start=${formattedDate.replace(/-/g, '')}` +
                `&end=${formattedDate.replace(/-/g, '')}` +
                `&format=JSON`
            );
            
            if (nasaResponse.ok) {
                const nasaData = await nasaResponse.json();
                if (nasaData?.properties?.parameter) {
                    const params = nasaData.properties.parameter;
                    const dateKey = Object.keys(params.T2M || {})[0];
                    
                    if (dateKey) {
                        const safeGet = (obj, key, fallback) => {
                            const val = obj?.[key]?.[dateKey];
                            return val !== undefined ? val : fallback;
                        };
                        
                        nasaInfo = {
                            solar_radiation: safeGet(params, 'ALLSKY_SFC_SW_DWN', nasaInfo.solar_radiation),
                            surface_temp: safeGet(params, 'T2M', nasaInfo.surface_temp),
                            precipitation: safeGet(params, 'PRECTOT', nasaInfo.precipitation),
                            wind_speed: safeGet(params, 'WS2M', nasaInfo.wind_speed),
                            humidity: safeGet(params, 'RH2M', nasaInfo.humidity)
                        };
                    }
                }
            }
        } catch (nasaError) {
            console.warn('Could not fetch NASA data, using fallback data:', nasaError);
            // Continue with default values if NASA API fails
        }

        return {
            temp: {
                day: weatherData.daily.temperature_2m_max[0],
                min: weatherData.daily.temperature_2m_min[0],
                max: weatherData.daily.temperature_2m_max[0]
            },
            humidity: parseFloat(nasaInfo.humidity) || 50,
            wind_speed: parseFloat(nasaInfo.wind_speed) || weatherData.daily.windspeed_10m_max[0],
            rain: parseFloat(nasaInfo.precipitation) || (weatherData.daily.precipitation_sum[0] > 0 ? weatherData.daily.precipitation_sum[0] : 0),
            uv_index: weatherData.daily.uv_index_max?.[0] || 0,
            solar_radiation: nasaInfo.solar_radiation || 'N/A',
            weather: [{
                main: getWeatherCondition(weatherData.daily.weathercode[0])
            }],
            isDaily: true,
            date: formattedDate,
            nasaData: nasaInfo
        };
    } catch (error) {
        console.error('Error getting weather data:', error);
        throw error;
    }
}

// Helper function to convert weather code to condition
function getWeatherCondition(weatherCode) {
    // Weather codes from Open-Meteo documentation
    if (weatherCode >= 0 && weatherCode <= 3) return 'Clear';
    if (weatherCode >= 45 && weatherCode <= 48) return 'Fog';
    if (weatherCode >= 51 && weatherCode <= 67) return 'Rain';
    if (weatherCode >= 71 && weatherCode <= 77) return 'Snow';
    if (weatherCode >= 80 && weatherCode <= 82) return 'Rain';
    if (weatherCode >= 85 && weatherCode <= 86) return 'Snow';
    if (weatherCode >= 95 && weatherCode <= 99) return 'Thunderstorm';
    return 'Clouds';
}

// Check if weather is suitable for specific events
function checkEventSuitability(weatherData) {
    const temp = weatherData.temp.day;
    const wind = weatherData.wind_speed;
    const rain = weatherData.rain;
    
    const suitability = {};
    
    for (const [eventType, criteria] of Object.entries(EVENT_TYPES)) {
        const tempSuitable = temp >= criteria.idealTemp.min && temp <= criteria.idealTemp.max;
        const windSuitable = wind <= criteria.maxWind;
        const rainSuitable = rain <= criteria.maxRain;
        
        suitability[eventType] = {
            suitable: tempSuitable && windSuitable && rainSuitable,
            reasons: []
        };
        
        if (!tempSuitable) {
            if (temp < criteria.idealTemp.min) {
                suitability[eventType].reasons.push(`Too cold (${temp}°C < ${criteria.idealTemp.min}°C)`);
            } else if (temp > criteria.idealTemp.max) {
                suitability[eventType].reasons.push(`Too hot (${temp}°C > ${criteria.idealTemp.max}°C)`);
            }
        }
        
        if (!windSuitable) {
            suitability[eventType].reasons.push(`Too windy (${wind.toFixed(1)} m/s > ${criteria.maxWind} m/s)`);
        }
        
        if (!rainSuitable) {
            suitability[eventType].reasons.push(`Too much rain (${rain}mm > ${criteria.maxRain}mm)`);
        }
    }
    
    return suitability;
}

// Display weather information with enhanced details
function displayWeather(data, coords) {
    // Check for dangerous conditions
    const dangerousConditions = checkDangerousConditions(data);
    if (dangerousConditions) {
        showSafetyAlert(dangerousConditions);
    }
    // Show result section if it exists
    if (resultDiv) resultDiv.classList.remove('d-none');
    
    // Set location title if it exists
    if (locationTitle) locationTitle.textContent = `${coords.name}, ${coords.country}`;
    
    // Determine weather condition and icon with more precise temperature ranges
    let condition, icon, recommendation, temperatureNote = '';
    const weatherMain = data.weather[0].main.toLowerCase();
    const temp = data.temp?.day || data.temp;
    const feelsLike = data.feels_like?.day || data.feels_like || temp;
    const tempDiff = Math.abs(temp - feelsLike);
    
    // Add temperature note if there's a significant difference between actual and feels like
    if (tempDiff > 2) {
        temperatureNote = ` (Feels like ${feelsLike.toFixed(1)}°C)`;
    }
    
    // Ultra-detailed weather conditions with precise categorization
    if (weatherMain.includes('thunderstorm')) {
        if (weatherMain.includes('heavy') || data.rain > 20) {
            condition = '⚡🌧️ Severe Thunderstorm';
            icon = '⚡🌧️';
            recommendation = 'SEVERE THUNDERSTORM WARNING. Take shelter immediately. Avoid using electrical equipment and stay away from windows.';
        } else if (weatherMain.includes('lightning') || data.wind_speed > 30) {
            condition = '⚡⛈️ Thunder & Lightning';
            icon = '⚡';
            recommendation = 'Thunder and lightning in the area. When thunder roars, go indoors! Wait 30 minutes after the last thunder before going outside.';
        } else {
            condition = '⛈️ Thunderstorm';
            icon = '⛈️';
            recommendation = 'Thunderstorms expected. Stay indoors if possible and avoid open areas, tall objects, and water.';
        }
    } else if (weatherMain.includes('drizzle')) {
        if (data.humidity > 85) {
            condition = '🌧️ Misty Drizzle';
            icon = '🌫️💧';
            recommendation = 'Misty conditions with light drizzle. Reduced visibility likely. Use headlights when driving.';
        } else if (data.wind_speed > 15) {
            condition = '🌬️💨 Windy Drizzle';
            icon = '💨💧';
            recommendation = 'Windy with light rain. A windproof jacket and umbrella are recommended.';
        } else {
            condition = '🌧️ Light Rain';
            icon = '🌦️';
            recommendation = 'Light rain or drizzle expected. A light jacket or umbrella is recommended.';
        }
    } else if (weatherMain.includes('rain')) {
        if (temp <= 0.5 && temp > -2) {
            condition = '❄️💧 Freezing Drizzle';
            icon = '💧❄️';
            recommendation = 'FREEZING DRIZZLE WARNING. Extremely slippery conditions. Black ice likely on roads and walkways.';
        } else if (temp <= 3 && temp > 0.5) {
            condition = '🌨️ Freezing Rain';
            icon = '🌨️';
            recommendation = 'FREEZING RAIN WARNING. Icy conditions developing. Avoid travel if possible. Watch for black ice.';
        } else if (temp <= -2) {
            condition = '🧊❄️ Ice Storm';
            icon = '🧊';
            recommendation = 'ICE STORM WARNING. Dangerous travel conditions. Icy buildup on trees and power lines likely. Stay indoors.';
        } else if (data.rain > 30) {
            condition = '🌊⛈️ Torrential Rain';
            icon = '🌊';
            recommendation = 'TORRENTIAL RAIN WARNING. Flash flooding possible. Avoid low-lying areas and never drive through floodwaters.';
        } else if (data.rain > 20) {
            condition = '🌧️💦 Downpour';
            icon = '💦';
            recommendation = 'HEAVY DOWNPOUR. Localized flooding possible. Avoid walking or driving through flood waters.';
        } else if (data.rain > 10) {
            condition = '🌧️ Heavy Rain';
            icon = '☔';
            recommendation = 'Heavy rainfall expected. Poor drainage flooding possible. Consider postponing outdoor activities.';
        } else if (data.rain > 5) {
            condition = '🌧️ Moderate Rain';
            icon = '🌧️';
            recommendation = 'Steady rainfall. Waterproof outerwear and footwear recommended. Reduced visibility when driving.';
        } else {
            condition = '🌦️ Light Rain';
            icon = '🌦️';
            recommendation = 'Light rain expected. A compact umbrella or water-resistant jacket is recommended.';
        }
    } else if (weatherMain.includes('snow')) {
        if (temp < -10) {
            condition = '❄️❄️ Extreme Cold & Snow';
            icon = '🥶❄️';
            recommendation = 'Dangerously cold with heavy snow. Avoid outdoor exposure. Risk of frostbite and hypothermia.';
        } else if (temp < -5) {
            condition = '❄️ Heavy Snow';
            icon = '❄️🥶';
            recommendation = 'Heavy snowfall and very cold. Only essential travel recommended. Dress in multiple warm layers.';
        } else if (temp < 0) {
            condition = '🌨️ Snowy';
            icon = '❄️';
            recommendation = 'Snow expected. Wear insulated, waterproof clothing and be cautious of slippery surfaces.';
        } else {
            condition = '🌨️ Wet Snow';
            icon = '🌨️';
            recommendation = 'Wet snow expected. Roads may be slippery. Wear waterproof footwear.';
        }
    } else if (weatherMain.includes('fog') || weatherMain.includes('mist')) {
        condition = '🌫️ ' + (weatherMain.includes('fog') ? 'Foggy' : 'Misty');
        icon = '🌫️';
        recommendation = 'Reduced visibility. Use low-beam headlights and maintain safe following distances when driving.';
    } else if (temp >= 40) {
        condition = '☠️ Extreme Heat Warning';
        icon = '☠️☀️';
        recommendation = 'DANGEROUS HEAT. Stay in air-conditioned spaces. Heat stroke likely with prolonged exposure. Avoid outdoor activities.';
    } else if (temp >= 37) {
        condition = '🥵 Scorching Heat';
        icon = '☀️☀️';
        recommendation = 'Extremely hot. Stay hydrated, avoid strenuous activities, and never leave children or pets in vehicles.';
    } else if (temp >= 35) {
        condition = '🥵 Extreme Heat';
        icon = '☀️☀️';
        recommendation = 'Dangerously hot. Stay in air-conditioned spaces, drink plenty of water, and avoid direct sun exposure between 10 AM - 4 PM.';
    } else if (temp >= 33) {
        condition = '☀️ Very Hot';
        icon = '☀️';
        recommendation = 'Very hot conditions. Stay hydrated, wear light clothing, and seek shade during peak hours.';
    } else if (temp >= 30) {
        condition = '☀️ Hot';
        icon = '☀️';
        recommendation = 'Hot weather. Stay hydrated, use sun protection, and take breaks in the shade.';
    } else if (temp >= 28) {
        condition = '😎 Warm & Sunny';
        icon = '😎☀️';
        recommendation = 'Warm and sunny. Perfect for outdoor activities. Use sunscreen and stay hydrated.';
    } else if (temp >= 26) {
        condition = '🌤️ Pleasantly Warm';
        icon = '🌤️';
        recommendation = 'Pleasantly warm. Great weather for being outdoors. Stay hydrated.';
    } else if (temp >= 24) {
        condition = '😊 Comfortable';
        icon = '😊';
        recommendation = 'Very comfortable conditions. Ideal for all outdoor activities.';
    } else if (temp >= 22) {
        condition = '🌤️ Mild & Pleasant';
        icon = '🌤️';
        recommendation = 'Mild and pleasant weather. Enjoy outdoor activities.';
    } else if (temp >= 20) {
        condition = '🌥️ Mild';
        icon = '🌥️';
        recommendation = 'Mild conditions. A light jacket might be needed in the evening.';
    } else if (temp >= 18) {
        condition = '⛅ Slightly Cool';
        icon = '⛅';
        recommendation = 'Slightly cool. A light jacket or sweater is recommended.';
    } else if (temp >= 15) {
        condition = '🌥️ Cool';
        icon = '🌥️';
        recommendation = 'Cool conditions. Wear layers that you can adjust as needed.';
    } else if (temp >= 12) {
        condition = '🌬️ Chilly';
        icon = '🧥';
        recommendation = 'Chilly weather. A warm jacket is recommended.';
    } else if (temp >= 8) {
        condition = '❄️ Cold';
        icon = '🧣';
        recommendation = 'Cold. Wear a heavy coat, hat, and gloves when going outside.';
    } else if (temp >= 4) {
        condition = '❄️ Very Cold';
        icon = '🧤';
        recommendation = 'Very cold. Dress in multiple warm layers and limit time outdoors.';
    } else if (temp >= 0) {
        condition = '🥶 Freezing';
        icon = '🧊';
        recommendation = 'Freezing temperatures. Risk of frostbite. Dress appropriately and limit exposure.';
    } else if (temp >= -10) {
        condition = '🥶❄️ Dangerously Cold';
        icon = '🥶';
        recommendation = 'Dangerously cold. Frostbite can occur in minutes. Avoid being outside if possible.';
    } else {
        condition = '☠️❄️ Extreme Cold Warning';
        icon = '☠️❄️';
        recommendation = 'EXTREME COLD WARNING. Life-threatening conditions. Stay indoors. Frostbite can occur in minutes.';
    }
    
    // Add wind chill or heat index note if significant
    if (temp < 10 && data.wind_speed > 5) {
        temperatureNote += ' (Wind chill makes it feel colder)';
    } else if (temp > 27 && data.humidity > 60) {
        temperatureNote += ' (High humidity makes it feel hotter)';
    }
    
    // Set weather icon, condition, and temperature - safely
    if (weatherIcon && weatherIcon.textContent !== undefined) weatherIcon.textContent = icon;
    if (weatherCondition && weatherCondition.textContent !== undefined) {
        weatherCondition.innerHTML = `${condition} <span class="temperature-display">${temp.toFixed(1)}°C${temperatureNote}</span>`;
    }
    
    // Check event suitability
    const eventSuitability = checkEventSuitability(data);
    
    // Helper function to safely format values
    const safeFormat = (value, suffix = '', fallback = 'N/A') => {
        if (value === undefined || value === null) return fallback;
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 
                `${value}${suffix}` : 
                `${value.toFixed(1)}${suffix}`;
        }
        return `${value}${suffix}`;
    };

    // Prepare weather details with enhanced information
    const details = [
        { 
            icon: '🌡️', 
            label: 'Temperature', 
            value: `${temp.toFixed(1)}°C (Feels like ${feelsLike.toFixed(1)}°C)`,
            extra: temperatureNote ? `<small class="text-muted">${temperatureNote}</small>` : ''
        },
        { 
            icon: '💧', 
            label: 'Humidity', 
            value: safeFormat(data.humidity, '%')
        },
        { 
            icon: '💨', 
            label: 'Wind', 
            value: `${safeFormat(data.wind_speed, ' m/s')} (${getWindDescription(data.wind_speed)})`
        },
        { 
            icon: '🌤️', 
            label: 'UV Index', 
            value: data.uv_index !== undefined ? 
                `${data.uv_index} (${getUvDescription(data.uv_index)})` : 'N/A'
        },
        { 
            icon: '☀️', 
            label: 'Solar Radiation', 
            value: data.solar_radiation ? 
                `${parseFloat(data.solar_radiation).toFixed(2)} kWh/m²/day` : 'N/A' 
        },
        { 
            icon: '📅', 
            label: 'Date', 
            value: data.date ? 
                new Date(data.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }) : 'N/A'
        },
        { 
            icon: '💡', 
            label: 'Recommendation', 
            value: recommendation || 'No specific recommendations available.'
        }
    ];
    
    // Add rain information
    if (data.rain || data.rain === 0) {
        const rainAmount = data.rain['1h'] !== undefined ? data.rain['1h'] : data.rain;
        details.splice(3, 0, { 
            icon: '🌧️', 
            label: 'Precipitation', 
            value: `${rainAmount} mm (${getRainDescription(rainAmount)})` 
        });
    }
    
    // Generate HTML for weather details
    let html = `
        <div class="weather-summary text-center mb-4">
            <div class="display-1 mb-2">${icon || '🌤️'}</div>
            <h2 class="mb-2">${condition || 'Weather Information'}</h2>
            <h1 class="display-4 fw-bold">${temp !== undefined ? Math.round(temp) + '°C' : '--°C'}</h1>
            <p class="lead">${recommendation || 'No specific recommendations available.'}</p>
        </div>
        
        <h4 class="mb-3">Weather Details</h4>
        <div class="row">
            <div class="col-md-6">
                ${details.slice(0, Math.ceil(details.length / 2)).map(detail => `
                    <div class="row weather-detail mb-2">
                        <div class="col-5 text-end">${detail.icon} ${detail.label}:</div>
                        <div class="col-7 fw-bold">${detail.value}</div>
                    </div>
                `).join('')}
            </div>
            <div class="col-md-6">
                ${details.slice(Math.ceil(details.length / 2)).map(detail => `
                    <div class="row weather-detail mb-2">
                        <div class="col-5 text-end">${detail.icon} ${detail.label}:</div>
                        <div class="col-7 fw-bold">${detail.value}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <h4 class="mt-4 mb-3">Event Suitability</h4>
        <div class="row">
            ${Object.entries(eventSuitability).map(([eventType, info]) => `
                <div class="col-md-6 mb-3">
                    <div class="card h-100 ${info.suitable ? 'border-success' : 'border-danger'}">
                        <div class="card-body">
                            <h5 class="card-title d-flex justify-content-between align-items-center">
                                ${EVENT_TYPES[eventType].name}
                                <span class="badge ${info.suitable ? 'bg-success' : 'bg-danger'}">
                                    ${info.suitable ? 'Suitable' : 'Not Suitable'}
                                </span>
                            </h5>
                            <p class="card-text">${EVENT_TYPES[eventType].description}</p>
                            ${info.reasons.length > 0 ? `
                                <p class="card-text text-muted small mb-0">
                                    <strong>Considerations:</strong> ${info.reasons.join('; ')}
                                </p>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Safely update the weather details
    if (weatherDetails && weatherDetails.innerHTML !== undefined) {
        weatherDetails.innerHTML = html;
    } else {
        console.error('Weather details container not found');
    }
    
    // Initialize or update the map
    initMap(coords.lat, coords.lon, condition);
}

// Initialize or update the map
function initMap(lat, lon, condition) {
    // Get the location name from the input field if it exists
    const locationInput = document.getElementById('location');
    const locationName = locationInput ? locationInput.value : 'Selected Location';
    
    // Remove existing map if it exists
    if (map) {
        map.off();
        map.remove();
    }
    
    // Create a new map instance
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Map container not found');
        return;
    }
    
    map = L.map(mapElement).setView([lat, lon], 12);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Determine marker color based on weather condition
    let markerColor = 'blue';
    if (condition && condition.includes) {
        if (condition.includes('Hot')) markerColor = 'red';
        else if (condition.includes('Rainy')) markerColor = 'blue';
        else if (condition.includes('Windy')) markerColor = 'orange';
        else if (condition.includes('Cold')) markerColor = 'lightblue';
        else markerColor = 'green';
    }
    
    // Create a custom icon
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${markerColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; transform: translate(-12px, -12px);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    // Add marker to the map
    marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
    
    // Add popup with weather info
    marker.bindPopup(`<b>${condition || 'Weather'}</b><br>Location: ${locationName}`).openPopup();
}

// Show error message
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger mt-3';
    alertDiv.textContent = message;
    
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // Add the new alert
    weatherForm.parentNode.insertBefore(alertDiv, weatherForm.nextSibling);
    
    // Auto-remove the alert after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Helper function to get wind description
function getWindDescription(speed) {
    if (speed < 0.5) return 'Calm';
    if (speed < 1.5) return 'Light air';
    if (speed < 3.3) return 'Light breeze';
    if (speed < 5.5) return 'Gentle breeze';
    if (speed < 7.9) return 'Moderate breeze';
    if (speed < 10.7) return 'Fresh breeze';
    if (speed < 13.8) return 'Strong breeze';
    if (speed < 17.1) return 'Moderate gale';
    if (speed < 20.7) return 'Fresh gale';
    if (speed < 24.4) return 'Strong gale';
    if (speed < 28.4) return 'Storm';
    if (speed < 32.6) return 'Violent storm';
    return 'Hurricane';
}

// Helper function to get UV index description
function getUvDescription(uvIndex) {
    if (uvIndex === undefined || uvIndex === null) return 'N/A';
    if (uvIndex <= 2) return 'Low';
    if (uvIndex <= 5) return 'Moderate';
    if (uvIndex <= 7) return 'High';
    if (uvIndex <= 10) return 'Very High';
    return 'Extreme';
}

// Helper function to get rain description
function getRainDescription(rainAmount) {
    if (rainAmount === undefined || rainAmount === null) return 'No rain';
    if (rainAmount < 0.1) return 'No rain';
    if (rainAmount < 2.5) return 'Light rain';
    if (rainAmount < 7.6) return 'Moderate rain';
    if (rainAmount < 50) return 'Heavy rain';
    return 'Violent rain';
}

// Theme Toggle Functionality
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.querySelector('#theme-icon i');
    
    if (!themeToggle || !themeIcon) {
        return;
    }
    
    // Function to set theme
    const setTheme = (isDark) => {
        const html = document.documentElement;
        
        if (isDark) {
            html.setAttribute('data-theme', 'dark');
            themeIcon.className = 'fas fa-sun';
            themeToggle.checked = true;
            localStorage.setItem('theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
            themeIcon.className = 'fas fa-moon';
            themeToggle.checked = false;
            localStorage.setItem('theme', 'light');
        }
        
        // Update meta theme color
        const themeColor = isDark ? '#121212' : '#4361ee';
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute('content', themeColor);
        
        // Add animation
        themeIcon.classList.add('rotating');
        setTimeout(() => {
            themeIcon.classList.remove('rotating');
        }, 500);
    };
    
    // Initialize theme on page load
    const initializeTheme = () => {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        const savedTheme = localStorage.getItem('theme');
        
        // Check for saved theme, then check system preference
        if (savedTheme) {
            setTheme(savedTheme === 'dark');
        } else {
            setTheme(prefersDarkScheme.matches);
        }
        
        // Listen for system theme changes
        prefersDarkScheme.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) { // Only if user hasn't set a preference
                setTheme(e.matches);
            }
        });
    };
    
    // Set up event listeners
    const setupEventListeners = () => {
        // Toggle theme on checkbox change
        themeToggle.addEventListener('change', (e) => {
            setTheme(e.target.checked);
        });
        
        // Also make the icon clickable
        const themeIconContainer = document.getElementById('theme-icon');
        if (themeIconContainer) {
            themeIconContainer.addEventListener('click', (e) => {
                e.preventDefault();
                themeToggle.checked = !themeToggle.checked;
                setTheme(themeToggle.checked);
            });
        }
    };
    
    // Initialize everything
    initializeTheme();
    setupEventListeners();
}

// Language configuration
const translations = {
    en: {
        // Navigation
        home: "Home",
        about: "About Us",
        contact: "Contact Us",
        language: "LANGUAGE",
        english: "ENGLISH",
        arabic: "العربية",
        
        // Hero Section
        heroTitle: "Our Key Features",
        heroSubtitle: "Discover the perfect time for your outdoor plans",
        heroButton: "Discover More",
        
        // Weather Form
        locationLabel: "Location",
        locationPlaceholder: "Enter city or place",
        locationError: "Please enter a location.",
        dateLabel: "Date",
        dateError: "Please select a date.",
        checkWeather: "Check Weather",
        checkWeatherText: "Check Weather",
        
        // Features Section
        whyChooseUs: "Why Choose Us",
        featuresTitle: "Our Key Features",
        featuresSubtitle: "Discover what makes our weather planning tool the best choice for your outdoor activities",
        
        // Feature Items
        accurateForecasts: "Accurate Forecasts",
        accurateForecastsDesc: "Get hyper-local weather predictions with up to 90% accuracy using advanced forecasting technology.",
        
        personalizedExp: "Personalized Experience",
        personalizedExpDesc: "Customized recommendations based on your specific activity type and preferences.",
        
        mobileFriendly: "Mobile-Friendly",
        mobileFriendlyDesc: "Fully responsive design that works perfectly on all devices, from mobile to desktop.",
        
        smartAlerts: "Smart Alerts",
        smartAlertsDesc: "Real-time notifications about weather changes that might affect your plans.",
        
        // Stats
        accuracy: "Accuracy",
        support: "Support",
        users: "Users",
        locations: "Locations",
        
        // Event Types
        allEvents: "All Events",
        picnic: "Picnic",
        sports: "Sports",
        festival: "Festival",
        wedding: "Wedding"
    },
    ar: {
        // Navigation
        home: "الرئيسية",
        about: "من نحن",
        contact: "اتصل بنا",
        language: "اللغة",
        english: "الإنجليزية",
        arabic: "العربية",
        
        // Hero Section
        heroTitle: "مميزاتنا الرئيسية",
        heroSubtitle: "اكتشف الوقت المثالي لخططك الخارجية",
        heroButton: "اكتشف المزيد",
        
        // Weather Form
        locationLabel: "الموقع",
        locationPlaceholder: "أدخل اسم المدينة أو المكان",
        locationError: "الرجاء إدخال الموقع.",
        dateLabel: "التاريخ",
        dateError: "الرجاء تحديد تاريخ.",
        checkWeather: "تحقق من الطقس",
        checkWeatherText: "تحقق من الطقس",
        
        // Features Section
        whyChooseUs: "لماذا تختارنا",
        featuresTitle: "مميزاتنا الرئيسية",
        featuresSubtitle: "اكتشف ما يجعل أداة تخطيط الطقس الخاصة بنا الخيار الأفضل لأنشطتك الخارجية",
        
        // Feature Items
        accurateForecasts: "تنبؤات دقيقة",
        accurateForecastsDesc: "احصل على تنبؤات طقس محلية بدقة تصل إلى 90٪ باستخدام تقنية التنبؤ المتقدمة.",
        
        personalizedExp: "تجربة مخصصة",
        personalizedExpDesc: "توصيات مخصصة بناءً على نوع النشاط المحدد وتفضيلاتك.",
        
        mobileFriendly: "يتناسب مع الجوال",
        mobileFriendlyDesc: "تصميم متجاوب يعمل بشكل مثالي على جميع الأجهزة، من الجوال إلى سطح المكتب.",
        
        smartAlerts: "تنبيهات ذكية",
        smartAlertsDesc: "إشعارات فورية حول تغيرات الطقس التي قد تؤثر على خططك.",
        
        // Stats
        accuracy: "دقة",
        support: "دعم",
        users: "مستخدم",
        locations: "موقع",
        
        // Event Types
        allEvents: "جميع الفعاليات",
        picnic: "نزهة",
        sports: "رياضة",
        festival: "مهرجان",
        wedding: "حفل زفاف"
    }
};

// Function to set the language
function setLanguage(lang) {
    if (!translations[lang]) return; // Make sure the language exists
    
    // Save language preference
    localStorage.setItem('language', lang);
    
    // Update HTML lang and dir attributes
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    // Add/remove RTL class to body
    document.body.classList.toggle('rtl', lang === 'ar');
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = translations[lang][key];
        
        if (translation !== undefined) {
            if (element.hasAttribute('placeholder') || element.hasAttribute('data-i18n-placeholder')) {
                element.placeholder = translation;
            } else if (element.tagName === 'INPUT' && element.type === 'submit') {
                element.value = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
    
    // Update elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });
    
    // Update navbar items
    const navElements = {
        'nav-home': translations[lang].home,
        'nav-about': translations[lang].about,
        'nav-contact': translations[lang].contact,
        'language-toggle': translations[lang].language
    };
    
    Object.entries(navElements).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    });
    
    // Update language selector in dropdown
    document.querySelectorAll('.language-selector').forEach(item => {
        const langCode = item.getAttribute('data-lang');
        if (langCode === 'en' || langCode === 'ar') {
            item.innerHTML = `<i class="fas fa-language me-2"></i>${translations[lang][langCode === 'en' ? 'english' : 'arabic']}`;
        }
    });
    
    // Update form elements
    const formElements = {
        'location': translations[lang].locationPlaceholder,
        'date': translations[lang].dateLabel
    };
    
    Object.entries(formElements).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) element.placeholder = text;
    });
    
    // Force RTL/LTR for specific elements if needed
    const rtlElements = document.querySelectorAll('.force-rtl');
    rtlElements.forEach(el => {
        el.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
    });
    
    const buttons = document.querySelectorAll('button[data-i18n]');
    buttons.forEach(button => {
        const key = button.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            button.textContent = translations[lang][key];
        }
    });
}

// Add event listeners for language switcher
document.addEventListener('click', (e) => {
    const languageSelector = e.target.closest('.language-selector');
    if (languageSelector) {
        e.preventDefault();
        const lang = languageSelector.getAttribute('data-lang');
        setLanguage(lang);
        
        // Close the dropdown
        const dropdown = document.querySelector('.dropdown-menu.show');
        if (dropdown) {
            const dropdownInstance = bootstrap.Dropdown.getInstance(dropdown);
            if (dropdownInstance) {
                dropdownInstance.hide();
            }
        }
    }
});

// Initialize the page when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.min = today;
            dateInput.value = today;
        } else {
            console.error('Date input element not found');
        }
        
        // Set up theme toggle
        setupThemeToggle();
        
        // Set up language switcher
        const savedLanguage = localStorage.getItem('language') || 'en';
        setLanguage(savedLanguage);
        
        // Add click event listeners for language switcher
        document.querySelectorAll('.language-selector').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = e.currentTarget.getAttribute('data-lang');
                setLanguage(lang);
            });
        });
        
        // Log theme toggle status
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            console.log('Theme toggle found:', themeToggle);
            themeToggle.addEventListener('change', (e) => {
                console.log('Theme toggled:', e.target.checked);
            });
        } else {
            console.error('Theme toggle element not found');
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

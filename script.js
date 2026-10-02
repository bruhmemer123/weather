// Application State Management
const AppState = {
    currentUnit: 'C', // 'C' or 'F'
    currentTheme: localStorage.getItem('atmosphere_theme') || 'dark',
    recentSearches: JSON.parse(localStorage.getItem('atmosphere_recent')) || ['Mumbai', 'London', 'New York'],
    lastLocationData: null,
    lastWeatherData: null,
    debounceTimer: null
};

// Standard WMO Weather Interpretation Codes
const WMO_CODES = {
    0: { label: 'Clear Sky', icon: '☀️' },
    1: { label: 'Mainly Clear', icon: '🌤️' },
    2: { label: 'Partly Cloudy', icon: '⛅' },
    3: { label: 'Overcast', icon: '☁️' },
    45: { label: 'Foggy', icon: '🌫️' },
    48: { label: 'Rime Fog', icon: '🌫️' },
    51: { label: 'Light Drizzle', icon: '🌦️' },
    53: { label: 'Moderate Drizzle', icon: '🌧️' },
    55: { label: 'Dense Drizzle', icon: '🌧️' },
    61: { label: 'Slight Rain', icon: '🌦️' },
    63: { label: 'Moderate Rain', icon: '🌧️' },
    65: { label: 'Heavy Rain', icon: '🌧️' },
    71: { label: 'Slight Snow', icon: '🌨️' },
    73: { label: 'Moderate Snow', icon: '❄️' },
    75: { label: 'Heavy Snow', icon: '❄️' },
    80: { label: 'Light Showers', icon: '🌦️' },
    81: { label: 'Moderate Showers', icon: '🌧️' },
    82: { label: 'Violent Showers', icon: '⛈️' },
    95: { label: 'Thunderstorm', icon: '🌩️' },
    96: { label: 'Thunderstorm Hail', icon: '⛈️' },
    99: { label: 'Heavy Hailstorm', icon: '⛈️' }
};

const DOM = {
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    unitToggle: document.getElementById('unitToggle'),
    unitLabel: document.getElementById('unitLabel'),
    geoBtn: document.getElementById('geoBtn'),
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    suggestionsDropdown: document.getElementById('suggestionsDropdown'),
    chipsContainer: document.getElementById('chipsContainer'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    skeletonContainer: document.getElementById('skeletonContainer'),
    mainDashboard: document.getElementById('mainDashboard'),
    cityName: document.getElementById('cityName'),
    currentDate: document.getElementById('currentDate'),
    currentTemp: document.getElementById('currentTemp'),
    currentUnit: document.getElementById('currentUnit'),
    weatherCondition: document.getElementById('weatherCondition'),
    humidityVal: document.getElementById('humidityVal'),
    windVal: document.getElementById('windVal'),
    feelsLikeVal: document.getElementById('feelsLikeVal'),
    uvIndexVal: document.getElementById('uvIndexVal'),
    forecastGrid: document.getElementById('forecastGrid')
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 [INIT] App loaded.");
    console.log("🔒 [SEC] Protocol:", window.location.protocol);
    console.log("🌐 [ENV] Origin:", window.location.origin);
    
    initTheme();
    renderRecentSearches();
    setupEventListeners();
    
    autoDetectLocationOnLoad();
});

function autoDetectLocationOnLoad() {
    console.log("📌 [AUTO-LOAD] Running automatic location lookup on launch...");
    getUserLocation(true);
}

function handleGeolocation() {
    console.log("👆 [USER ACTION] 'My Location' button clicked.");
    getUserLocation(false);
}

// Diagnostic Geolocation Handler
function getUserLocation(isAutoLoad = false) {
    console.log(`\n--- 📍 DIAGNOSTIC GEOLOCATION START (isAutoLoad: ${isAutoLoad}) ---`);
    
    if (!('geolocation' in navigator)) {
        console.error("❌ [GEO] navigator.geolocation is completely UNDEFINED on this browser/environment!");
        handleGeoFallback('Geolocation is not supported by your browser.', isAutoLoad);
        return;
    }

    console.log("✅ [GEO] navigator.geolocation exists in browser.");

    // Check Security Context (Browsers block geolocation on http:// except localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn("⚠️ [GEO WARNING] Insecure context (HTTP)! Browsers reject Geolocation over HTTP unless running on localhost.");
    }

    // Permission API Inspection
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(status => {
                console.log(`🔑 [GEO PERMISSION STATUS]: "${status.state}"`);
                status.onchange = () => console.log(`🔔 [GEO PERMISSION CHANGED]: New state = "${status.state}"`);
            })
            .catch(err => console.log("⚠️ [GEO PERMISSION API ERR]:", err));
    }

    showLoadingState();
    hideError();

    let resolved = false;

    // 8-Second Safety Timeout Logger
    const timeoutTimer = setTimeout(() => {
        if (!resolved) {
            resolved = true;
            console.error("⏱️ [GEO TIMEOUT] 8000ms elapsed without callback from getCurrentPosition()! Browser may be waiting for user prompt or silent-blocking.");
            handleGeoFallback('Location request timed out. Loading default location.', isAutoLoad);
        }
    }, 8000);

    const options = {
        enableHighAccuracy: false, // Set to false to allow fast IP/wifi fallback instead of requiring GPS hardware
        timeout: 8000,
        maximumAge: 60000
    };

    console.log("⏳ [GEO] Invoking navigator.geolocation.getCurrentPosition() with options:", options);

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            if (resolved) {
                console.warn("⚠️ [GEO] Received success position AFTER timeout had already triggered!");
                return;
            }
            resolved = true;
            clearTimeout(timeoutTimer);

            console.log("🎉 [GEO SUCCESS] Coordinates retrieved successfully!");
            console.log(`   └─ Latitude:  ${position.coords.latitude}`);
            console.log(`   └─ Longitude: ${position.coords.longitude}`);
            console.log(`   └─ Accuracy:  ${position.coords.accuracy} meters`);

            const { latitude, longitude } = position.coords;
            let locationName = 'Your Location';

            // Fetch weather directly using exact lat/lon
            await fetchWeatherData(latitude, longitude, locationName);
        },
        (error) => {
            if (resolved) {
                console.warn("⚠️ [GEO] Received error callback AFTER timeout had already triggered!");
                return;
            }
            resolved = true;
            clearTimeout(timeoutTimer);

            console.error("❌ [GEO ERROR REJECTED]:");
            console.error(`   └─ Code:    ${error.code}`);
            console.error(`   └─ Message: "${error.message}"`);

            let msg = 'Unable to retrieve location.';
            if (error.code === error.PERMISSION_DENIED) {
                msg = 'Location permission denied by browser/user.';
                console.error("   └─ Cause: User clicked 'Block' or browser policy denied access.");
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                msg = 'Location position unavailable (e.g. no GPS/WiFi signal).';
                console.error("   └─ Cause: Device cannot determine physical coordinates.");
            } else if (error.code === error.TIMEOUT) {
                msg = 'Location request timed out.';
                console.error("   └─ Cause: Took too long to respond.");
            }

            handleGeoFallback(msg, isAutoLoad);
        },
        options
    );
}

function handleGeoFallback(errorMsg, isAutoLoad) {
    const fallbackCity = AppState.recentSearches[0] || 'Mumbai';
    console.log(`🔄 [GEO FALLBACK] Executing fallback fetch for city: "${fallbackCity}"`);
    fetchWeatherForCity(fallbackCity);
    showError(`[Location Issue] ${errorMsg}`);
}

function setupEventListeners() {
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.unitToggle.addEventListener('click', toggleTemperatureUnit);
    DOM.geoBtn.addEventListener('click', handleGeolocation);

    DOM.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            console.log(`🔍 [SEARCH SUBMITTED] City: "${query}"`);
            hideSuggestions();
            fetchWeatherForCity(query);
            DOM.searchInput.value = '';
        }
    });

    DOM.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(AppState.debounceTimer);

        if (query.length < 2) {
            hideSuggestions();
            return;
        }

        AppState.debounceTimer = setTimeout(() => {
            fetchCitySuggestions(query);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!DOM.searchForm.contains(e.target)) {
            hideSuggestions();
        }
    });

    DOM.clearHistoryBtn.addEventListener('click', clearSearchHistory);
}

function initTheme() {
    document.documentElement.setAttribute('data-theme', AppState.currentTheme);
    DOM.themeIcon.textContent = AppState.currentTheme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    AppState.currentTheme = AppState.currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('atmosphere_theme', AppState.currentTheme);
    initTheme();
}

function toggleTemperatureUnit() {
    AppState.currentUnit = AppState.currentUnit === 'C' ? 'F' : 'C';
    DOM.unitLabel.textContent = `°${AppState.currentUnit}`;
    DOM.currentUnit.textContent = `°${AppState.currentUnit}`;

    if (AppState.lastWeatherData && AppState.lastLocationData) {
        renderCurrentWeather(AppState.lastWeatherData, AppState.lastLocationData);
        renderForecast(AppState.lastWeatherData);
    }
}

function celsiusToFahrenheit(c) {
    return Math.round((c * 9/5) + 32);
}

function formatTemp(celsius) {
    if (celsius === undefined || celsius === null) return '--';
    return AppState.currentUnit === 'F' ? celsiusToFahrenheit(celsius) : Math.round(celsius);
}

async function fetchWeatherForCity(cityName) {
    console.log(`📡 [API FETCH] Geocoding city name: "${cityName}"`);
    showLoadingState();
    hideError();

    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        
        if (!geoRes.ok) throw new Error(`Geocoding HTTP Error ${geoRes.status}`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            showError(`City "${cityName}" not found. Please try another location.`);
            return;
        }

        const location = geoData.results[0];
        console.log(`✅ [GEOCODING SUCCESS] Resolved "${cityName}" to:`, location.name, location.latitude, location.longitude);
        await fetchWeatherData(location.latitude, location.longitude, `${location.name}, ${location.country_code ? location.country_code.toUpperCase() : ''}`);
        
        saveRecentSearch(location.name);
    } catch (err) {
        console.error("❌ [CITY FETCH ERROR]:", err);
        showError(err.message || 'Unable to fetch weather data.');
    }
}

async function fetchWeatherData(lat, lon, displayName) {
    console.log(`📡 [API FETCH] Requesting weather forecast for (${lat}, ${lon}) - Label: "${displayName}"`);
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`;
        
        const response = await fetch(weatherUrl);
        if (!response.ok) throw new Error(`Weather API HTTP Error ${response.status}`);

        const data = await response.json();
        console.log("🎉 [WEATHER DATA SUCCESS] Received payload from Open-Meteo:", data);

        AppState.lastLocationData = { displayName, lat, lon };
        AppState.lastWeatherData = data;

        renderCurrentWeather(data, AppState.lastLocationData);
        renderForecast(data);
        hideLoadingState();
    } catch (err) {
        console.error("❌ [WEATHER FETCH ERROR]:", err);
        showError('Error connecting to weather service: ' + err.message);
    }
}

async function fetchCitySuggestions(query) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=4&language=en&format=json`;
        const res = await fetch(geoUrl);
        if (!res.ok) return;

        const data = await res.json();
        if (data.results && data.results.length > 0) {
            renderSuggestions(data.results);
        } else {
            hideSuggestions();
        }
    } catch (err) {
        // Silently handle autocomplete network errors
    }
}

function renderSuggestions(results) {
    DOM.suggestionsDropdown.innerHTML = '';
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <span><strong>${item.name}</strong>, <small>${item.admin1 ? item.admin1 + ', ' : ''}${item.country || ''}</small></span>
            <small style="color:var(--text-muted)">📍</small>
        `;
        div.addEventListener('click', () => {
            DOM.searchInput.value = '';
            hideSuggestions();
            fetchWeatherData(item.latitude, item.longitude, `${item.name}, ${item.country_code ? item.country_code.toUpperCase() : ''}`);
            saveRecentSearch(item.name);
        });
        DOM.suggestionsDropdown.appendChild(div);
    });
    DOM.suggestionsDropdown.classList.add('active');
}

function hideSuggestions() {
    DOM.suggestionsDropdown.classList.remove('active');
    DOM.suggestionsDropdown.innerHTML = '';
}

function renderCurrentWeather(data, location) {
    const current = data.current;
    const daily = data.daily;

    DOM.cityName.textContent = location.displayName;

    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    DOM.currentDate.textContent = now.toLocaleDateString('en-US', options);

    DOM.currentTemp.textContent = formatTemp(current.temperature_2m);
    
    const wmo = WMO_CODES[current.weather_code] || { label: 'Clear', icon: '☀️️' };
    DOM.weatherCondition.textContent = `${wmo.icon} ${wmo.label}`;

    DOM.humidityVal.textContent = `${current.relative_humidity_2m}%`;
    DOM.windVal.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    DOM.feelsLikeVal.textContent = `${formatTemp(current.apparent_temperature)}°`;
    DOM.uvIndexVal.textContent = daily && daily.uv_index_max ? daily.uv_index_max[0].toFixed(1) : 'N/A';
}

function renderForecast(data) {
    DOM.forecastGrid.innerHTML = '';
    const daily = data.daily;

    if (!daily || !daily.time) return;

    const startIndex = 1;
    const endIndex = Math.min(6, daily.time.length);

    for (let i = startIndex; i < endIndex; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

        const code = daily.weather_code[i];
        const wmo = WMO_CODES[code] || { label: 'Clear', icon: '☀️' };

        const maxTemp = formatTemp(daily.temperature_2m_max[i]);
        const minTemp = formatTemp(daily.temperature_2m_min[i]);
        const pop = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;

        const row = document.createElement('div');
        row.className = 'forecast-row';
        row.innerHTML = `
            <div class="forecast-date-col">
                <span class="forecast-day-name">${dayName}</span>
                <span class="forecast-sub-date">${formattedDate}</span>
            </div>
            <div class="forecast-icon-col">${wmo.icon}</div>
            <div class="forecast-temp-col">
                <span class="forecast-temp-max">${maxTemp}°</span>
                <span class="forecast-temp-min">${minTemp}°</span>
            </div>
            <div class="forecast-pop-col">
                <span class="pop-icon">💧</span>
                <span>${pop}%</span>
            </div>
        `;

        DOM.forecastGrid.appendChild(row);
    }
}

function saveRecentSearch(city) {
    let searches = AppState.recentSearches.filter(item => item.toLowerCase() !== city.toLowerCase());
    searches.unshift(city);
    if (searches.length > 5) searches.pop();

    AppState.recentSearches = searches;
    localStorage.setItem('atmosphere_recent', JSON.stringify(searches));
    renderRecentSearches();
}

function renderRecentSearches() {
    DOM.chipsContainer.innerHTML = '';
    if (AppState.recentSearches.length === 0) {
        DOM.clearHistoryBtn.classList.add('hidden');
        return;
    }

    DOM.clearHistoryBtn.classList.remove('hidden');
    AppState.recentSearches.forEach(city => {
        const chip = document.createElement('button');
        chip.className = 'search-chip';
        chip.type = 'button';
        chip.textContent = city;
        chip.addEventListener('click', () => {
            DOM.searchInput.value = '';
            fetchWeatherForCity(city);
        });
        DOM.chipsContainer.appendChild(chip);
    });
}

function clearSearchHistory() {
    AppState.recentSearches = [];
    localStorage.removeItem('atmosphere_recent');
    renderRecentSearches();
}

function showLoadingState() {
    DOM.skeletonContainer.classList.remove('hidden');
    DOM.mainDashboard.classList.add('hidden');
}

function hideLoadingState() {
    DOM.skeletonContainer.classList.add('hidden');
    DOM.mainDashboard.classList.remove('hidden');
}

function hideError() {
    DOM.errorBanner.classList.add('hidden');
}

function showError(msg) {
    console.warn("⚠️ [UI SHOW ERROR]:", msg);
    DOM.errorMessage.textContent = msg;
    DOM.errorBanner.classList.remove('hidden');
    hideLoadingState();
}
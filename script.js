// Application State Management
const AppState = {
    currentUnit: 'C', // 'C' or 'F'
    currentTheme: localStorage.getItem('weather_theme') || 'dark',
    recentSearches: JSON.parse(localStorage.getItem('weather_recent')) || ['Mumbai', 'London', 'New York'],
    lastLocationData: null,
    lastWeatherData: null,
    debounceTimer: null
};

// Expanded WMO Weather Codes with Icons
const WMO_CODES = {
    0: { label: 'Clear sky', icon: '☀️' },
    1: { label: 'Mainly clear', icon: '🌤️' },
    2: { label: 'Partly cloudy', icon: '⛅' },
    3: { label: 'Overcast', icon: '☁️' },
    45: { label: 'Fog', icon: '🌫️' },
    48: { label: 'Depositing rime fog', icon: '🌫️' },
    51: { label: 'Drizzle: Light', icon: '🌦️' },
    53: { label: 'Drizzle: Moderate', icon: '🌧️' },
    55: { label: 'Drizzle: Dense', icon: '🌧️' },
    56: { label: 'Freezing Drizzle: Light', icon: '🌧️' },
    57: { label: 'Freezing Drizzle: Dense', icon: '🌧️' },
    61: { label: 'Rain: Slight', icon: '🌦️' },
    63: { label: 'Rain: Moderate', icon: '🌧️' },
    65: { label: 'Rain: Heavy', icon: '🌧️' },
    66: { label: 'Freezing Rain: Light', icon: '🌧' },
    67: { label: 'Freezing Rain: Heavy', icon: '🌧️' },
    71: { label: 'Snow fall: Slight', icon: '🌨️' },
    73: { label: 'Snow fall: Moderate', icon: '❄️' },
    75: { label: 'Snow fall: Heavy', icon: '❄️' },
    77: { label: 'Snow grains', icon: '❄️️' },
    80: { label: 'Rain showers: Slight', icon: '🌦️' },
    81: { label: 'Rain showers: Moderate', icon: '🌧️' },
    82: { label: 'Rain showers: Violent', icon: '⛈️' },
    85: { label: 'Snow showers: Slight', icon: '🌨️' },
    86: { label: 'Snow showers: Heavy', icon: '❄️' },
    95: { label: 'Thunderstorm: Slight or moderate', icon: '🌩️' },
    96: { label: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { label: 'Thunderstorm with heavy hail', icon: '⛈️' }
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
    initTheme();
    renderRecentSearches();
    setupEventListeners();
    autoDetectLocationOnLoad();
});

function autoDetectLocationOnLoad() {
    getUserLocation(true);
}

function handleGeolocation() {
    getUserLocation(false);
}

// Optimized Fast & Reliable Geolocation Handler
function getUserLocation(isAutoLoad = false) {
    if (!('geolocation' in navigator)) {
        fallbackToDefaultCity("Geolocation not supported.", isAutoLoad);
        return;
    }

    const cachedLat = localStorage.getItem('geo_last_lat');
    const cachedLon = localStorage.getItem('geo_last_lon');

    let hasRenderedCache = false;

    if (cachedLat && cachedLon) {
        fetchWeatherData(parseFloat(cachedLat), parseFloat(cachedLon), "Your Location");
        hasRenderedCache = true;
    } else {
        showLoadingState();
    }

    hideError();

    const geoOptions = {
        enableHighAccuracy: false,
        maximumAge: 300000 // 5 minutes position caching
    };

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            localStorage.setItem('geo_last_lat', lat);
            localStorage.setItem('geo_last_lon', lon);

            await fetchWeatherData(lat, lon, "Your Location");
        },
        async (err) => {
            if (!hasRenderedCache) {
                fallbackToDefaultCity("Unable to detect current location.", isAutoLoad);
            }
        },
        geoOptions
    );
}

function fallbackToDefaultCity(msg, isAutoLoad) {
    const fallbackCity = AppState.recentSearches[0] || 'Mumbai';
    fetchWeatherForCity(fallbackCity);
    if (!isAutoLoad) {
        showError(msg);
    }
}

function setupEventListeners() {
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.unitToggle.addEventListener('click', toggleTemperatureUnit);
    DOM.geoBtn.addEventListener('click', handleGeolocation);

    DOM.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            hideSuggestions();
            fetchWeatherForCity(query);
            DOM.searchInput.value = ''; // Clear search bar
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
    localStorage.setItem('weather_theme', AppState.currentTheme);
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
    showLoadingState();
    hideError();

    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        
        if (!geoRes.ok) throw new Error('Failed to search city.');
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            showError(`City "${cityName}" not found. Please try another location.`);
            return;
        }

        const location = geoData.results[0];
        await fetchWeatherData(location.latitude, location.longitude, `${location.name}, ${location.country_code ? location.country_code.toUpperCase() : ''}`);
        
        saveRecentSearch(location.name);
    } catch (err) {
        showError(err.message || 'Unable to fetch weather data.');
    }
}

async function fetchWeatherData(lat, lon, displayName) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`;
        
        const response = await fetch(weatherUrl);
        if (!response.ok) throw new Error('Forecast service unavailable.');

        const data = await response.json();

        AppState.lastLocationData = { displayName, lat, lon };
        AppState.lastWeatherData = data;

        renderCurrentWeather(data, AppState.lastLocationData);
        renderForecast(data);
        hideLoadingState();
    } catch (err) {
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
        // Ignore network errors during autocomplete typing
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
            DOM.searchInput.value = ''; // Clear search bar on selection
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
    
    const wmo = WMO_CODES[current.weather_code] || { label: 'Clear sky', icon: '☀️' };
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

    // Render upcoming 5 days starting from Tomorrow (Index 1)
    const startIndex = 1;
    const endIndex = Math.min(6, daily.time.length);

    for (let i = startIndex; i < endIndex; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

        const code = daily.weather_code[i];
        const wmo = WMO_CODES[code] || { label: 'Clear sky', icon: '☀️' };

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
    localStorage.setItem('weather_recent', JSON.stringify(searches));
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
            DOM.searchInput.value = ''; // Clear input on chip click
            fetchWeatherForCity(city);
        });
        DOM.chipsContainer.appendChild(chip);
    });
}

function clearSearchHistory() {
    AppState.recentSearches = [];
    localStorage.removeItem('weather_recent');
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
    DOM.errorMessage.textContent = msg;
    DOM.errorBanner.classList.remove('hidden');
    hideLoadingState();
}
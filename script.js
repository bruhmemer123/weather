const AppState = {
    currentUnit: 'C', // 'C' or 'F'
    currentTheme: localStorage.getItem('atmosphere_theme') || 'dark',
    recentSearches: JSON.parse(localStorage.getItem('atmosphere_recent')) || ['Tokyo', 'London', 'New York'],
    lastLocationData: null,
    lastWeatherData: null,
    debounceTimer: null
};

const WMO_CODES = {
    0: { label: 'Clear Sky', icon: '☀️' },
    1: { label: 'Mainly Clear', icon: '🌤️' },
    2: { label: 'Partly Cloudy', icon: '⛅' },
    3: { label: 'Overcast', icon: '☁️' },
    45: { label: 'Foggy', icon: '🌫️' },
    48: { label: 'Depositing Rime Fog', icon: '🌫️' },
    51: { label: 'Light Drizzle', icon: '🌦️' },
    53: { label: 'Moderate Drizzle', icon: '🌧️' },
    55: { label: 'Dense Drizzle', icon: '🌧️' },
    61: { label: 'Slight Rain', icon: '🌦️️' },
    63: { label: 'Moderate Rain', icon: '🌧️' },
    65: { label: 'Heavy Rain', icon: '🌧️' },
    71: { label: 'Slight Snow', icon: '🌨️' },
    73: { label: 'Moderate Snow', icon: '❄️' },
    75: { label: 'Heavy Snow', icon: '❄️️' },
    80: { label: 'Slight Rain Showers', icon: '🌦' },
    81: { label: 'Moderate Rain Showers', icon: '🌧️' },
    82: { label: 'Violent Rain Showers', icon: '⛈️' },
    95: { label: 'Thunderstorm', icon: '🌩️' },
    96: { label: 'Thunderstorm with Hail', icon: '⛈️' },
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

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderRecentSearches();
    setupEventListeners();
    
    // Auto-request user location immediately on load
    autoDetectLocationOnLoad();
});

function autoDetectLocationOnLoad() {
    if (navigator.geolocation) {
        showLoadingState();
        hideError();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await fetchWeatherData(latitude, longitude, 'Your Location');
            },
            (error) => {
                // If permission is denied or unavailable, load recent city or default
                const fallbackCity = AppState.recentSearches[0] || 'London';
                fetchWeatherForCity(fallbackCity);
            },
            { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
        );
    } else {
        const fallbackCity = AppState.recentSearches[0] || 'London';
        fetchWeatherForCity(fallbackCity);
    }
}

function setupEventListeners() {
    // Theme toggle
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Unit toggle
    DOM.unitToggle.addEventListener('click', toggleTemperatureUnit);

    // Geolocation button
    DOM.geoBtn.addEventListener('click', handleGeolocation);

    // Search Form Submit
    DOM.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            hideSuggestions();
            fetchWeatherForCity(query);
        }
    });

    // Live autocomplete input debouncing
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

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!DOM.searchForm.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Clear history button
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
    const val = AppState.currentUnit === 'F' ? celsiusToFahrenheit(celsius) : Math.round(celsius);
    return val;
}

async function fetchWeatherForCity(cityName) {
    showLoadingState();
    hideError();

    try {
        // Step 1: Geocode City Name
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        
        if (!geoRes.ok) throw new Error('Network error while looking up city.');
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            showError(`City "${cityName}" not found. Please try another location.`);
            return;
        }

        const location = geoData.results[0];
        await fetchWeatherData(location.latitude, location.longitude, `${location.name}, ${location.country_code ? location.country_code.toUpperCase() : ''}`);
        
        saveRecentSearch(location.name);
    } catch (err) {
        showError(err.message || 'Unable to load weather details.');
    }
}

async function fetchWeatherData(lat, lon, displayName) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`;
        
        const response = await fetch(weatherUrl);
        if (!response.ok) throw new Error('Failed to retrieve forecast data.');

        const data = await response.json();

        AppState.lastLocationData = { displayName, lat, lon };
        AppState.lastWeatherData = data;

        renderCurrentWeather(data, AppState.lastLocationData);
        renderForecast(data);
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
        // Silence autocomplete network errors
    }
}

function renderSuggestions(results) {
    DOM.suggestionsDropdown.innerHTML = '';
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <span><strong>${item.name}</strong>, <small>${item.admin1 ? item.admin1 + ', ' : ''}${item.country || ''}</small></span>
            <span style="font-size:0.75rem; opacity:0.6;">📍</span>
        `;
        div.addEventListener('click', () => {
            DOM.searchInput.value = item.name;
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

function handleGeolocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }

    showLoadingState();
    hideError();

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await fetchWeatherData(latitude, longitude, 'Your Location');
        },
        (error) => {
            showError('Location access denied or unavailable.');
        },
        { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
}

function renderCurrentWeather(data, location) {
    const current = data.current;
    const daily = data.daily;

    DOM.cityName.textContent = location.displayName;

    // Date Formatting
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    DOM.currentDate.textContent = now.toLocaleDateString('en-US', options);

    // Temp & Condition
    DOM.currentTemp.textContent = formatTemp(current.temperature_2m);
    
    const wmo = WMO_CODES[current.weather_code] || { label: 'Unknown', icon: '🌤️' };
    DOM.weatherCondition.textContent = `${wmo.icon} ${wmo.label}`;

    // Metrics
    DOM.humidityVal.textContent = `${current.relative_humidity_2m}%`;
    DOM.windVal.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    DOM.feelsLikeVal.textContent = `${formatTemp(current.apparent_temperature)}°`;
    DOM.uvIndexVal.textContent = daily && daily.uv_index_max ? daily.uv_index_max[0].toFixed(1) : 'N/A';
}

function renderForecast(data) {
    DOM.forecastGrid.innerHTML = '';
    const daily = data.daily;

    if (!daily || !daily.time) return;

    // Render 5 upcoming days starting from Tomorrow (skipping Today at index 0)
    const startIndex = 1;
    const endIndex = Math.min(6, daily.time.length);

    for (let i = startIndex; i < endIndex; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayName = i === 1 ? 'Tomorrow' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const code = daily.weather_code[i];
        const wmo = WMO_CODES[code] || { label: 'Clear', icon: '☀️' };

        const maxTemp = formatTemp(daily.temperature_2m_max[i]);
        const minTemp = formatTemp(daily.temperature_2m_min[i]);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-date">${formattedDate}</div>
            <div style="font-size: 2.2rem; margin: 4px 0;">${wmo.icon}</div>
            <div class="forecast-condition">${wmo.label}</div>
            <div class="forecast-temp-range">
                <span class="temp-max">${maxTemp}°</span>
                <span class="temp-min">${minTemp}°</span>
            </div>
        `;

        DOM.forecastGrid.appendChild(card);
    }
}

function saveRecentSearch(city) {
    let searches = AppState.recentSearches.filter(item => item.toLowerCase() !== city.toLowerCase());
    searches.unshift(city);
    if (searches.length > 5) searches.pop(); // Keep top 5

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
        chip.innerHTML = `<span>${city}</span>`;
        chip.addEventListener('click', () => {
            DOM.searchInput.value = city;
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
    DOM.currentTemp.classList.add('skeleton', 'skeleton-text');
    DOM.weatherCondition.classList.add('skeleton', 'skeleton-text');
    DOM.cityName.classList.add('skeleton', 'skeleton-text');
    
    DOM.forecastGrid.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const skelCard = document.createElement('div');
        skelCard.className = 'forecast-card skeleton';
        skelCard.style.height = '160px';
        DOM.forecastGrid.appendChild(skelCard);
    }
}

function hideError() {
    DOM.errorBanner.classList.add('hidden');
    DOM.currentTemp.classList.remove('skeleton', 'skeleton-text');
    DOM.weatherCondition.classList.remove('skeleton', 'skeleton-text');
    DOM.cityName.classList.remove('skeleton', 'skeleton-text');
}

function showError(msg) {
    DOM.errorMessage.textContent = msg;
    DOM.errorBanner.classList.remove('hidden');
    DOM.currentTemp.classList.remove('skeleton', 'skeleton-text');
    DOM.weatherCondition.classList.remove('skeleton', 'skeleton-text');
    DOM.cityName.classList.remove('skeleton', 'skeleton-text');
}
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
    53: { label: 'Moderate Drizzle', icon: '🌧' },
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
    
    // Immediate Geolocation request on page open
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
                // On permission denial or timeout, load default city
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
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.unitToggle.addEventListener('click', toggleTemperatureUnit);
    DOM.geoBtn.addEventListener('click', handleGeolocation);

    DOM.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            hideSuggestions();
            fetchWeatherForCity(query);
        }
    });

    // Autocomplete search input debouncing
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
        // Ignore network error during autocomplete typing
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
            showError('Location access was denied or timed out.');
        },
        { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
}

function renderCurrentWeather(data, location) {
    const current = data.current;
    const daily = data.daily;

    DOM.cityName.textContent = location.displayName;

    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    DOM.currentDate.textContent = now.toLocaleDateString('en-US', options);

    DOM.currentTemp.textContent = formatTemp(current.temperature_2m);
    
    const wmo = WMO_CODES[current.weather_code] || { label: 'Clear', icon: '☀️' };
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
    DOM.currentTemp.classList.add('skeleton');
    DOM.weatherCondition.classList.add('skeleton');
    DOM.cityName.classList.add('skeleton');
    
    DOM.forecastGrid.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const skelRow = document.createElement('div');
        skelRow.className = 'forecast-row skeleton';
        skelRow.style.height = '52px';
        DOM.forecastGrid.appendChild(skelRow);
    }
}

function hideError() {
    DOM.errorBanner.classList.add('hidden');
    DOM.currentTemp.classList.remove('skeleton');
    DOM.weatherCondition.classList.remove('skeleton');
    DOM.cityName.classList.remove('skeleton');
}

function showError(msg) {
    DOM.errorMessage.textContent = msg;
    DOM.errorBanner.classList.remove('hidden');
    DOM.currentTemp.classList.remove('skeleton');
    DOM.weatherCondition.classList.remove('skeleton');
    DOM.cityName.classList.remove('skeleton');
}
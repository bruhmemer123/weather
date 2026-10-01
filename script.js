const searchForm = document.querySelector("[data-search-form]");
const searchInput = document.querySelector("[data-search-input]");
const statusMessage = document.querySelector("[data-status-message]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const locationButton = document.querySelector("[data-location-button]");
const currentLoading = document.querySelector("[data-current-loading]");
const forecastLoading = document.querySelector("[data-forecast-loading]");
const currentContent = document.querySelector("[data-current-content]");
const forecastList = document.querySelector("[data-forecast-list]");
const currentDay = document.querySelector("[data-current-day]");
const currentDate = document.querySelector("[data-current-date]");
const locationName = document.querySelector("[data-location-name]");
const weatherIcon = document.querySelector("[data-weather-icon]");
const currentTemperature = document.querySelector("[data-current-temperature]");
const currentDescription = document.querySelector("[data-current-description]");
const feelsLike = document.querySelector("[data-feels-like]");
const humidity = document.querySelector("[data-humidity]");
const windSpeed = document.querySelector("[data-wind-speed]");
const conditionLabel = document.querySelector("[data-condition-label]");
const forecastTemplate = document.querySelector("#forecast-card-template");

const THEME_STORAGE_KEY = "weather-pulse-theme";
const DEFAULT_THEME = "dark";
const WEATHER_THEME_MAP = {
  clear: "clear",
  partlycloudy: "clouds",
  cloudy: "clouds",
  rain: "rain",
  snow: "snow",
  storm: "storm",
  fog: "fog",
  default: "clouds",
};

const WEATHER_CODE_MAP = {
  0: { label: "clear sky", icon: "☀️", theme: "clear" },
  1: { label: "mostly clear", icon: "🌤️", theme: "clear" },
  2: { label: "partly cloudy", icon: "⛅", theme: "clouds" },
  3: { label: "overcast", icon: "☁️", theme: "clouds" },
  45: { label: "fog", icon: "🌫️", theme: "fog" },
  48: { label: "depositing rime fog", icon: "🌫️", theme: "fog" },
  51: { label: "light drizzle", icon: "🌦️", theme: "rain" },
  53: { label: "drizzle", icon: "🌦️", theme: "rain" },
  55: { label: "dense drizzle", icon: "🌦️", theme: "rain" },
  56: { label: "freezing drizzle", icon: "🌧️", theme: "rain" },
  57: { label: "freezing drizzle", icon: "🌧️", theme: "rain" },
  61: { label: "light rain", icon: "🌧️", theme: "rain" },
  63: { label: "rain", icon: "🌧️", theme: "rain" },
  65: { label: "heavy rain", icon: "🌧️", theme: "rain" },
  66: { label: "freezing rain", icon: "🌧️", theme: "rain" },
  67: { label: "freezing rain", icon: "🌧️", theme: "rain" },
  71: { label: "light snow", icon: "🌨️", theme: "snow" },
  73: { label: "snow", icon: "🌨️", theme: "snow" },
  75: { label: "heavy snow", icon: "🌨️", theme: "snow" },
  77: { label: "snow grains", icon: "🌨️", theme: "snow" },
  80: { label: "slight rain showers", icon: "🌦️", theme: "rain" },
  81: { label: "rain showers", icon: "🌧️", theme: "rain" },
  82: { label: "violent rain showers", icon: "⛈️", theme: "storm" },
  85: { label: "slight snow showers", icon: "🌨️", theme: "snow" },
  86: { label: "snow showers", icon: "🌨️", theme: "snow" },
  95: { label: "thunderstorm", icon: "⛈️", theme: "storm" },
  96: { label: "thunderstorm with hail", icon: "⛈️", theme: "storm" },
  99: { label: "thunderstorm with hail", icon: "⛈️", theme: "storm" },
};

const state = {
  theme: DEFAULT_THEME,
};

function formatLocationLabel(location) {
  return `${location.name}${location.admin1 ? `, ${location.admin1}` : ""}${location.country ? `, ${location.country}` : ""}`;
}

function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

function formatWindSpeed(value) {
  return `${Math.round(value)} km/h`;
}

function formatDayLabel(dateString, includeYear = false) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function formatCurrentDay(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getWeatherMeta(code) {
  return WEATHER_CODE_MAP[code] || { label: "unsettled conditions", icon: "🌡️", theme: "clouds" };
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}

function setLoading(isLoading) {
  currentLoading.classList.toggle("is-hidden", !isLoading);
  forecastLoading.classList.toggle("is-hidden", !isLoading);
  currentContent.classList.toggle("is-hidden", isLoading);
  forecastList.classList.toggle("is-hidden", isLoading);
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  const isDark = theme === "dark";
  themeLabel.textContent = isDark ? "Dark mode" : "Light mode";
  themeToggle.setAttribute("aria-pressed", String(!isDark));
}

function setWeatherTheme(code, isDay) {
  const meta = getWeatherMeta(code);
  const themeName = WEATHER_THEME_MAP[meta.theme] || WEATHER_THEME_MAP.default;
  document.documentElement.dataset.weatherTheme = themeName;
}

function showCurrentConditions(data, location) {
  const weather = getWeatherMeta(data.current.weather_code);

  currentDay.textContent = formatCurrentDay(data.current.time);
  currentDate.textContent = `Updated ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(data.current.time))}`;
  locationName.textContent = location;
  weatherIcon.textContent = weather.icon;
  currentTemperature.textContent = formatTemperature(data.current.temperature_2m);
  currentDescription.textContent = weather.label;
  feelsLike.textContent = formatTemperature(data.current.apparent_temperature);
  humidity.textContent = `${Math.round(data.current.relative_humidity_2m)}%`;
  windSpeed.textContent = formatWindSpeed(data.current.wind_speed_10m);
  conditionLabel.textContent = weather.label;
  setWeatherTheme(data.current.weather_code, Boolean(data.current.is_day));
}

function renderForecast(daily) {
  forecastList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  daily.time.slice(1, 6).forEach((dateString, index) => {
    const sourceIndex = index + 1;
    const weather = getWeatherMeta(daily.weather_code[sourceIndex]);
    const card = forecastTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".forecast-card__day").textContent = formatDayLabel(dateString);
    card.querySelector(".forecast-card__icon").textContent = weather.icon;
    card.querySelector(".forecast-card__temps").textContent = `${formatTemperature(daily.temperature_2m_min[sourceIndex])} / ${formatTemperature(daily.temperature_2m_max[sourceIndex])}`;
    card.querySelector(".forecast-card__label").textContent = weather.label;
    fragment.append(card);
  });

  forecastList.append(fragment);
}

async function geocodeLocation(query) {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);

  if (!response.ok) {
    throw new Error("Unable to look up that location right now.");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("No matching city found. Try another search.");
  }

  return data.results[0];
}

async function fetchWeatherData(location) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: "auto",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    forecast_days: "6",
  }).toString();

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Weather data is unavailable right now.");
  }

  return response.json();
}

async function loadWeatherByCoordinates(latitude, longitude, locationLabel) {
  setStatus("Loading weather data...");
  setLoading(true);

  try {
    const weatherData = await fetchWeatherData({ latitude, longitude });
    showCurrentConditions(weatherData, locationLabel);
    renderForecast(weatherData.daily);
    setStatus(`Showing weather for ${locationLabel}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while loading the forecast.";
    setStatus(message, true);
  } finally {
    setLoading(false);
  }
}

async function loadWeather(query) {
  const searchTerm = query.trim();

  if (!searchTerm) {
    setStatus("Enter a city name to see the forecast.", true);
    return;
  }

  try {
    const location = await geocodeLocation(searchTerm);
    await loadWeatherByCoordinates(location.latitude, location.longitude, formatLocationLabel(location));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while loading the forecast.";
    setStatus(message, true);
  }
}

function requestCurrentLocationWeather() {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported in this browser. Search for a city instead.", true);
    setLoading(false);
    return;
  }

  setStatus("Requesting your location...");
  setLoading(true);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      loadWeatherByCoordinates(latitude, longitude, "Your location");
    },
    (error) => {
      setLoading(false);
      const message =
        error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in the browser prompt, then try again."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Your current location could not be determined right now. Try again in a moment."
            : "Location lookup timed out. Try the location button again.";
      setStatus(message, true);
      searchInput.focus();
    },
    {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 0,
    },
  );
}

function restoreTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme === "light" ? "light" : DEFAULT_THEME);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadWeather(searchInput.value);
});

themeToggle.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
});

locationButton.addEventListener("click", () => {
  requestCurrentLocationWeather();
});

restoreTheme();
requestCurrentLocationWeather();

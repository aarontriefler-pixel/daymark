import type { WeatherSnapshot } from '../types'

const WMO_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  95: 'Thunderstorm',
}

function weatherLabel(code: number): string {
  return WMO_LABELS[code] ?? `Code ${code}`
}

async function geocodeZip(zipCode: string): Promise<{ latitude: number; longitude: number }> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', zipCode)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const res = await fetch(url)
  if (!res.ok) throw new Error('Geocoding failed')
  const data = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number }>
  }
  const first = data.results?.[0]
  if (!first) throw new Error('Location not found for that zip/code')
  return { latitude: first.latitude, longitude: first.longitude }
}

export async function fetchWeatherForZip(zipCode: string): Promise<WeatherSnapshot> {
  const trimmed = zipCode.trim()
  if (!trimmed) throw new Error('Zip/location not set')

  const { latitude, longitude } = await geocodeZip(trimmed)
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,weather_code,surface_pressure',
  )
  url.searchParams.set('temperature_unit', 'fahrenheit')
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather fetch failed')
  const data = (await res.json()) as {
    current: {
      temperature_2m: number
      relative_humidity_2m: number
      weather_code: number
      surface_pressure: number
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    zipCode: trimmed,
    latitude,
    longitude,
    temperatureF: Math.round(data.current.temperature_2m),
    weatherCode: data.current.weather_code,
    weatherLabel: weatherLabel(data.current.weather_code),
    pressureHpa: Math.round(data.current.surface_pressure),
    humidity: Math.round(data.current.relative_humidity_2m),
  }
}

import axios from 'axios'
import { API_URL } from '../../config'

// Logowanie w apce — TEN SAM schemat co backend:
//   CZAS | POZIOM | KATEGORIA | wiadomość | klucz=wartość ...
// Konsola (terminal Metro) pokazuje logi na bieżąco w tym formacie, a batch leci
// na backend (/log), gdzie ląduje w mobile_app.log tym samym formatterem.
//
// Użycie: logger.info('WAGA', 'Wysłano klatkę', { waga: 145.8 })
// Kategorie: SYSTEM, WAGA, MARKER, ARKUSZ, ZDJECIE, AI, SIEC, KAMERA

const LOG_BATCH_SIZE = 10
const FLUSH_INTERVAL = 30000
let logQueue = []

let getStoreState = () => ({ isWeightDetection: true })
const init = getState => {
	getStoreState = getState
}

const urzadzenie = () => (getStoreState().isWeightDetection ? 'Waga' : 'Marker')

// klucz apki -> token poziomu w schemacie (5 znaków, jak na backendzie)
const POZIOMY = { debug: 'DEBUG', info: 'INFO', warn: 'OSTRZ', error: 'BŁĄD' }

// "2026-07-16 12:00:03" w czasie lokalnym telefonu (w PL = Europe/Warsaw)
const czasLokalny = () => {
	const d = new Date()
	const p = n => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// buduje "urzadzenie=Waga klucz=wartość ..." (puste pomijane)
const zbudujKontekst = extra => {
	const czesci = [`urzadzenie=${urzadzenie()}`]
	for (const [k, v] of Object.entries(extra || {})) {
		if (v !== undefined && v !== null && v !== '') czesci.push(`${k}=${v}`)
	}
	return czesci.join(' ')
}

const flushLogs = async () => {
	if (logQueue.length === 0) return
	const logsToSend = [...logQueue]
	logQueue = []
	try {
		await axios.post(`${API_URL}/log`, { logs: logsToSend })
	} catch (e) {
		console.error('Nie udało się wysłać logów na serwer:', e?.message || e)
	}
}

const log = (poziomKey, kategoria, wiadomosc, extra = {}) => {
	const poziom = POZIOMY[poziomKey] || 'INFO'
	const kontekst = zbudujKontekst(extra)
	const czas = czasLokalny()
	const msg = typeof wiadomosc === 'object' ? JSON.stringify(wiadomosc) : wiadomosc

	// Konsola Metro — dokładnie ten sam układ, co linia w pliku na backendzie
	if (__DEV__) {
		const linia = `${czas} | ${poziom.padEnd(5)} | ${String(kategoria).padEnd(7)} | ${msg}${kontekst ? ' | ' + kontekst : ''}`
		const fn = poziomKey === 'error' ? console.error : poziomKey === 'warn' ? console.warn : console.log
		fn(linia)
	}

	logQueue.push({ poziom, kategoria, wiadomosc: msg, kontekst, czas })

	if (poziomKey === 'error' || logQueue.length >= LOG_BATCH_SIZE) {
		flushLogs()
	}
}

setInterval(flushLogs, FLUSH_INTERVAL)

export default {
	init,
	debug: (kategoria, wiadomosc, extra) => log('debug', kategoria, wiadomosc, extra),
	info: (kategoria, wiadomosc, extra) => log('info', kategoria, wiadomosc, extra),
	warn: (kategoria, wiadomosc, extra) => log('warn', kategoria, wiadomosc, extra),
	error: (kategoria, wiadomosc, extra) => log('error', kategoria, wiadomosc, extra),
}

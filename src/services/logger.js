import axios from 'axios'
import { API_URL } from '../../config'

const LOG_BATCH_SIZE = 10
const FLUSH_INTERVAL = 30000
let logQueue = []

let getStoreState = () => ({ isWeightDetection: true })

const init = getState => {
	getStoreState = getState
}

const getDeviceType = () => {
	const { isWeightDetection } = getStoreState()

	return isWeightDetection ? 'Waga' : 'Marker'
}

const flushLogs = async () => {
	if (logQueue.length === 0) {
		return
	}
	const logsToSend = [...logQueue]
	logQueue = []

	try {
		await axios.post(`${API_URL}/log`, { logs: logsToSend })
	} catch (e) {
		console.error('Nie udało się wysłać logów na serwer:', e)
	}
}

const log = (level, message, extra = {}) => {
	const deviceType = getDeviceType()

	const logEntry = {
		level,
		message: typeof message === 'object' ? JSON.stringify(message) : message,
		timestamp: new Date().toISOString(),
		deviceType,
		extra,
	}

	if (__DEV__) {
		console[level](`[${logEntry.deviceType}] ${logEntry.message}`)
	}

	logQueue.push(logEntry)

	if (level === 'error' || logQueue.length >= LOG_BATCH_SIZE) {
		flushLogs()
	}
}

setInterval(flushLogs, FLUSH_INTERVAL)

export default {
	init,
	info: (message, extra) => log('info', message, extra),
	warn: (message, extra) => log('warn', message, extra),
	error: (message, extra) => log('error', message, extra),
}

// src/hooks/useMarkerPolling.js
import { useEffect, useRef } from 'react'
import { useRecordStore, STATUS } from '../store/useRecordStore'
import api from '../services/api'
import logger from '../services/logger'

const POLLING_INTERVAL = 10000

export function useMarkerPolling() {
	const { status, isWeightDetection, startMarkerDetection } = useRecordStore()
	const intervalRef = useRef(null)

	useEffect(() => {
		const pollForRecord = async () => {
			logger.debug('MARKER', 'Odpytuję backend o oczekujący rekord')
			try {
				const data = await api.getWaitingRecord()
				if (data && data.recordId) {
					logger.info('MARKER', 'Backend zgłosił rekord — zaczynam szukać markera', { rekord: data.recordId, waga: data.weight })
					startMarkerDetection(data)
				}
			} catch (error) {
				logger.error('SIEC', 'Odpytywanie o rekord nieudane', { blad: error?.message || error })
			}
		}

		if (!isWeightDetection && (status === STATUS.IDLE || status === STATUS.POLLING)) {
			pollForRecord()
			intervalRef.current = setInterval(pollForRecord, POLLING_INTERVAL)
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current)
				intervalRef.current = null
			}
		}
	}, [isWeightDetection, status, startMarkerDetection])
}

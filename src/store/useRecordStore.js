import { create } from 'zustand'
import api from '../services/api'
import logger from '../services/logger'

const STATUS = {
	IDLE: 'idle', // Aplikacja czeka na akcję
	CAMERA_ACTIVE: 'camera_active', // Kamera jest aktywna
	SUCCESS: 'success', // Sukces, wyświetlanie wyników
	ERROR: 'error', // Wystąpił błąd
	POLLING: 'polling',
	COOLDOWN: 'cooldown',
}

export const useRecordStore = create((set, get) => ({
	// --- STAN ---
	status: STATUS.IDLE,
	isProcessing: false, // ### NOWE: Dedykowany stan do pokazywania spinnera
	isWeightDetection: true,
	error: null,
	lastResult: null,
	recordId: null,
	weight: null,
	frameCount: 0,
	cameraStartTimer: null,

	// --- AKCJE (ACTIONS) ---
	setDetectionMode: isWeight => {
		const existingTimer = get().cameraStartTimer
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		const nextStatus = isWeight ? STATUS.IDLE : STATUS.POLLING
		set({
			isWeightDetection: isWeight,
			status: nextStatus,
			isProcessing: false,
			recordId: null,
			weight: null,
			error: null,
			lastResult: isWeight ? 'Kamera uruchomi się za 10 sekund...' : 'Oczekuję na sygnał od wagi...',
			frameCount: 0,
			cameraStartTimer: null,
		})

		if (isWeight) {
			const newTimer = setTimeout(() => {
				if (get().isWeightDetection) {
					logger.info('Automatyczne uruchamianie kamery w trybie Wagi...')
					get().startCamera()
				}
			}, 10000)

			set({ cameraStartTimer: newTimer })
		}
	},

	startCamera: () => set({ status: STATUS.CAMERA_ACTIVE, error: null, lastResult: null }),

	stopCamera: () => {
		const { isWeightDetection } = get()
		// Po zatrzymaniu kamery wróć do odpowiedniego stanu
		const nextStatus = isWeightDetection ? STATUS.IDLE : STATUS.POLLING
		set({
			status: nextStatus,
			isProcessing: false,
			lastResult: isWeightDetection ? get().lastResult : 'Oczekuję na sygnał od wagi...',
			frameCount: 0,
		})
	},

	startMarkerDetection: recordData => {
		set({
			status: STATUS.CAMERA_ACTIVE,
			recordId: recordData.recordId,
			weight: recordData.weight,
			lastResult: `Wykryto pracę! Waga: ${recordData.weight}. Szukam markera...`,
		})
	},

	processImage: async base64Image => {
		const currentFrameCount = get().frameCount + 1
		set({ frameCount: currentFrameCount })

		if (currentFrameCount % 3 === 0) {
			logger.info(`Wysyłanie klatki testowej nr: ${currentFrameCount}`)
			api.saveTestPhoto(base64Image, get().isWeightDetection)
		}

		if (get().isProcessing) {
			return // Jeśli już coś przetwarzamy, ignorujemy tę klatkę
		}

		set({ isProcessing: true, error: null })

		const { isWeightDetection, recordId, lastResult: currentLastResult } = get()

		try {
			const payload = {
				image: `data:image/jpeg;base64,${base64Image}`,
				isWeightDetection: isWeightDetection,
				recordId: isWeightDetection ? undefined : recordId,
			}

			const response = await api.detectAndSave(payload)

			if (response.status === 'cooldown') {
				set({
					status: STATUS.COOLDOWN,
					lastResult: response.message || 'Zapisano! 60s przerwy.',
					isProcessing: false,
				})
				setTimeout(() => {
					const { isWeightDetection: mode } = get()
					const nextStatus = mode ? STATUS.CAMERA_ACTIVE : STATUS.POLLING
					const nextResult = mode ? 'Skanowanie wagi wznowione...' : 'Oczekuję na sygnał od wagi...'
					set({ status: nextStatus, lastResult: nextResult })
				}, 60000)
				return
			}

			switch (response.status) {
				case 'Weight detected, new record created':
				case 'Weight updated':
					set({
						recordId: response.data.record_id,
						weight: response.data.weight,
						lastResult: `Waga: ${response.data.weight}`,
					})
					break

				case 'Data saved to Google Sheets':
					set({
						status: STATUS.COOLDOWN,
						lastResult: `Zapisano! ${response.data.license_plate}. 60s przerwy.`,
						recordId: null,
						weight: null,
						frameCount: 0,
					})
					setTimeout(() => {
						set({ status: STATUS.POLLING, lastResult: 'Oczekuję na sygnał od wagi...', error: null })
					}, 60000)
					break

				case 'No weight detected':
				case 'Weight ignored (not greater)':
				case 'No marker detected':
				case 'No valid marker detected':
					const message = response.message || 'Skanuję dalej...'
					if (message !== currentLastResult) {
						set({ lastResult: message })
					}
					break

				case 'ignored':
					set({ status: STATUS.ERROR, error: response.message })
					break

				default:
					logger.warn(`Nieobsługiwany status odpowiedzi: ${response.status}`)
					set({ lastResult: 'Otrzymano nieznaną odpowiedź.' })
			}
		} catch (err) {
			const errorMessage = err.response?.data?.error || 'Błąd komunikacji. Próbuję ponownie za 10s...'
			set({ status: STATUS.ERROR, error: errorMessage, isProcessing: false })
			logger.error(`Błąd przetwarzania obrazu: ${err}`)

			setTimeout(() => {
				if (get().status === STATUS.ERROR) {
					logger.info('Automatyczne wznawianie pracy po błędzie...')

					get().startCamera()
				}
			}, 10000) // 10 sekund
		} finally {
			if (get().status !== STATUS.ERROR) {
				set({ isProcessing: false })
			}
		}
	},
}))

export { STATUS }

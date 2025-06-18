import { create } from 'zustand'
import api from '../services/api'

const STATUS = {
	IDLE: 'idle', // Aplikacja czeka na akcję
	CAMERA_ACTIVE: 'camera_active', // Kamera jest aktywna
	SUCCESS: 'success', // Sukces, wyświetlanie wyników
	ERROR: 'error', // Wystąpił błąd
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

	// --- AKCJE (ACTIONS) ---
	setDetectionMode: isWeight =>
		set({
			isWeightDetection: isWeight,
			status: STATUS.IDLE,
			isProcessing: false,
			recordId: null,
			weight: null,
			error: null,
			lastResult: null,
		}),

	startCamera: () => set({ status: STATUS.CAMERA_ACTIVE, error: null, lastResult: null }),

	stopCamera: () => set({ status: STATUS.IDLE, isProcessing: false }),

	processImage: async base64Image => {
		if (get().isProcessing) {
			return // Jeśli już coś przetwarzamy, ignorujemy tę klatkę
		}

		set({ isProcessing: true, error: null })

		const { isWeightDetection, recordId } = get()

		try {
			const payload = {
				image: `data:image/jpeg;base64,${base64Image}`,
				isWeightDetection: isWeightDetection,
				recordId: isWeightDetection ? undefined : recordId,
			}

			const response = await api.detectAndSave(payload)

			switch (response.status) {
				case 'Weight detected, new record created':
				case 'Weight updated':
					set({
						// status pozostaje CAMERA_ACTIVE
						recordId: response.data.record_id,
						weight: response.data.weight,
						lastResult: `Waga: ${response.data.weight}`,
					})
					break

				case 'Data saved to Google Sheets':
					set({
						status: STATUS.SUCCESS,
						lastResult: `Zapisano! Tablica: ${response.data.license_plate}`,
						recordId: null,
						weight: null,
					})
					break

				case 'No weight detected':
				case 'Weight ignored (not greater)':
				case 'No marker detected':
				case 'No valid marker detected':
					set({ lastResult: response.message || 'Skanuję dalej...' })
					break

				case 'ignored':
					set({ status: STATUS.ERROR, error: response.message })
					break

				default:
					console.warn('Nieobsługiwany status odpowiedzi:', response.status)
					set({ lastResult: 'Otrzymano nieznaną odpowiedź.' })
			}
		} catch (err) {
			const errorMessage = err.response?.data?.error || 'Wystąpił błąd komunikacji z serwerem.'
			set({ status: STATUS.ERROR, error: errorMessage })
			console.error('Błąd przetwarzania obrazu:', err)
		} finally {
			set({ isProcessing: false })
		}
	},
}))

export { STATUS }

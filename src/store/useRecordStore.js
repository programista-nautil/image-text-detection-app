import { create } from 'zustand'

import api from '../services/api'

const STATUS = {
	IDLE: 'idle', // Aplikacja czeka na akcję

	CAMERA_ACTIVE: 'camera_active', // Kamera jest aktywna

	PROCESSING: 'processing', // Przetwarzanie obrazu

	SUCCESS: 'success', // Sukces, wyświetlanie wyników

	ERROR: 'error', // Wystąpił błąd
}

export const useRecordStore = create((set, get) => ({
	status: STATUS.IDLE,

	isWeightDetection: true, // true dla wagi, false dla markera

	error: null,

	lastResult: null,

	// Informacje o bieżącym rekordzie

	recordId: null,

	weight: null,

	// Funkcje do modyfikowania stanu

	setDetectionMode: isWeight =>
		set({
			isWeightDetection: isWeight,

			status: STATUS.IDLE,

			recordId: null,

			weight: null,

			error: null,

			lastResult: null,
		}),

	startCamera: () => set({ status: STATUS.CAMERA_ACTIVE, error: null, lastResult: null }),

	stopCamera: () => set({ status: STATUS.IDLE }),

	processImage: async base64Image => {
		const { isWeightDetection, recordId } = get()

		try {
			// W trybie wagowym nie przekazujemy recordId, serwer go stworzy lub znajdzie

			// W trybie markera przekazujemy istniejący recordId

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
						status: STATUS.CAMERA_ACTIVE, // Pozostań w trybie kamery

						recordId: response.data.record_id,

						weight: response.data.weight,

						lastResult: `Waga: ${response.data.weight}`,

						error: null,
					})

					break

				case 'Data saved to Google Sheets':
					set({
						status: STATUS.SUCCESS, // Zmień status na sukces dopiero po zapisie

						lastResult: `Zapisano! Tablica: ${response.data.license_plate}`,

						recordId: null, // Resetuj stan

						weight: null,

						error: null,
					})

					break

				case 'No weight detected':

				case 'Weight ignored (not greater)':

				case 'No marker detected':
					// Po prostu zaktualizuj wiadomość, ale NIE zmieniaj statusu kamery

					set({ lastResult: response.message || 'Nic nie wykryto, skanuję dalej...' })

					break

				case 'ignored':
					set({ status: STATUS.ERROR, error: response.message, lastResult: null })

					break

				default:
					console.warn('Nieobsługiwany status odpowiedzi:', response.status)

					set({ lastResult: 'Otrzymano nieznaną odpowiedź.' })
			}
		} catch (err) {
			const errorMessage = err.response?.data?.error || 'Wystąpił błąd komunikacji z serwerem.'

			set({ status: STATUS.ERROR, error: errorMessage, lastResult: null })

			console.error('Błąd przetwarzania obrazu:', err)
		}
	},
}))

export { STATUS }

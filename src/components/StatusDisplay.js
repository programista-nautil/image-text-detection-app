// src/components/StatusDisplay.js
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ActivityIndicator, Card } from 'react-native-paper'
import { useRecordStore, STATUS } from '../store/useRecordStore'

export function StatusDisplay() {
	const { status, error, lastResult, isWeightDetection, isProcessing, recordId, weight } = useRecordStore()

	const getDescription = () => {
		// Najpierw sprawdzamy stany końcowe lub błędy
		if (status === STATUS.ERROR) return `Błąd: ${error}`
		if (status === STATUS.SUCCESS) return `Sukces: ${lastResult}`

		// ### ZMIANA ZACZYNA SIĘ TUTAJ ###
		// Priorytet: Jeśli mamy już wagę i czekamy na marker, ZAWSZE to pokazuj.
		if (recordId && weight) {
			return `Ostatnia waga: ${weight}. Oczekuję na marker...`
		}

		// Jeśli nie mamy jeszcze wyniku, pokazujemy status kamery
		if (status === STATUS.CAMERA_ACTIVE) {
			if (isProcessing) return 'Przetwarzanie obrazu...'
			if (lastResult) return lastResult // Pokazuje np. "Nie wykryto wagi..."
			return 'Kamera aktywna, skanowanie...'
		}
		// ### ZMIANA KOŃCZY SIĘ TUTAJ ###

		return 'Wybierz tryb i uruchom aparat.'
	}

	return (
		<Card style={styles.descriptionCard}>
			<Card.Content>
				{isProcessing && (
					<ActivityIndicator animating={true} size='small' color='#4682B4' style={{ marginRight: 10 }} />
				)}
				<Text style={styles.descriptionText}>{getDescription()}</Text>
			</Card.Content>
		</Card>
	)
}

const styles = StyleSheet.create({
	descriptionCard: { marginVertical: 10, backgroundColor: '#f0f0f0', color: '#333' },
	descriptionText: { fontSize: 16, color: '#333', textAlign: 'center', flexShrink: 1 },
})

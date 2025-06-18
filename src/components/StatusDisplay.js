// src/components/StatusDisplay.js
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ActivityIndicator, Card } from 'react-native-paper'
import { useRecordStore, STATUS } from '../store/useRecordStore'

export function StatusDisplay() {
	const { status, error, lastResult, isWeightDetection, recordId, weight } = useRecordStore()

	const getDescription = () => {
		if (status === STATUS.PROCESSING) return 'Przetwarzanie obrazu...'
		if (status === STATUS.ERROR) return `Błąd: ${error}`
		if (status === STATUS.SUCCESS) return `Wynik: ${lastResult}`
		if (status === STATUS.CAMERA_ACTIVE)
			return isWeightDetection ? 'Skieruj aparat na wagę.' : 'Skieruj aparat na marker.'

		if (recordId && weight) {
			return `Ostatnia waga: ${weight}. Oczekuję na marker...`
		}

		return 'Wybierz tryb i uruchom aparat.'
	}

	return (
		<Card style={styles.descriptionCard}>
			<Card.Content>
				{status === STATUS.PROCESSING && (
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

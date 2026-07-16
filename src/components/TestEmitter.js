// Symulator zdarzeń (tylko tryb TEST) — wysyła na backend syntetyczne "zdjęcia"
// z dowolną wagą i markerem, bez potrzeby celowania kamerą w wagę/marker.
// Wagę podajemy przez backdoor `_test_mock_weight` (backend pomija wtedy OpenAI),
// a marker to prawdziwy obraz ArUco (ID 1 -> 1235DC), więc detekcję ArUco testuje realnie.
import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Button, TextInput, Text } from 'react-native-paper'
import api from '../services/api'
import { CURRENT_BUILD_MODE, BUILD_MODE } from '../../config'
import { MARKER_PNG, WAGA_JPG } from '../services/testAssets'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const weightPayload = val => ({
	image: `data:image/jpeg;base64,${WAGA_JPG}`,
	isWeightDetection: true,
	_test_mock_weight: Number(val),
})
const markerPayload = () => ({
	image: `data:image/png;base64,${MARKER_PNG}`,
	isWeightDetection: false,
})

const opis = r => {
	if (!r) return 'brak odpowiedzi'
	const plate = r.data?.license_plate ? ` (${r.data.license_plate})` : ''
	const w = r.data?.weight != null ? ` waga ${r.data.weight}` : ''
	return `${r.status}${plate}${w}`
}

export function TestEmitter() {
	if (CURRENT_BUILD_MODE !== BUILD_MODE.TEST) return null

	const [weight, setWeight] = useState('12000')
	const [busy, setBusy] = useState(false)
	const [last, setLast] = useState('—')

	const post = async payload => {
		try {
			return await api.detectAndSave(payload)
		} catch (e) {
			return { status: `BŁĄD: ${e.message || e}` }
		}
	}
	const run = async fn => {
		setBusy(true)
		try {
			await fn()
		} finally {
			setBusy(false)
		}
	}

	const emitWeight = () => run(async () => {
		setLast(`Wysyłam wagę ${weight}...`)
		setLast(`Waga ${weight} → ${opis(await post(weightPayload(weight)))}`)
	})

	const emitMarker = () => run(async () => {
		setLast('Wysyłam marker...')
		setLast(`Marker → ${opis(await post(markerPayload()))}`)
	})

	// Symuluje całe ważenie: rosnąca waga (jak przy ładowaniu) → marker domyka rekord.
	const emitFull = () => run(async () => {
		for (const w of [5000, 12000, 18000]) {
			setLast(`Ładowanie... waga ${w}`)
			await post(weightPayload(w))
			await sleep(800)
		}
		setLast(`Pełne ważenie → ${opis(await post(markerPayload()))}`)
	})

	return (
		<Card style={styles.card}>
			<Card.Content>
				<Text variant="titleMedium" style={styles.title}>Symulator (test)</Text>
				<Text style={styles.hint}>Wysyła zdarzenia na backend bez kamery.</Text>

				<TextInput
					label="Waga (kg)"
					value={weight}
					onChangeText={setWeight}
					keyboardType="numeric"
					mode="outlined"
					dense
					style={styles.input}
				/>
				<View style={styles.row}>
					<Button mode="contained" onPress={emitWeight} disabled={busy} style={styles.btn}>Wyślij wagę</Button>
					<Button mode="contained" onPress={emitMarker} disabled={busy} style={styles.btn}>Wyślij marker</Button>
				</View>
				<Button mode="contained-tonal" onPress={emitFull} disabled={busy} loading={busy} style={styles.full}>
					Pełne ważenie (auto)
				</Button>

				<Text style={styles.last}>{last}</Text>
			</Card.Content>
		</Card>
	)
}

const styles = StyleSheet.create({
	card: { marginBottom: 12, backgroundColor: '#f0f6ff' },
	title: { fontWeight: 'bold' },
	hint: { color: '#666', fontSize: 12, marginBottom: 8 },
	input: { marginBottom: 8 },
	row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
	btn: { flex: 1, marginHorizontal: 4 },
	full: { marginBottom: 10 },
	last: { fontFamily: 'monospace', fontSize: 13, color: '#333' },
})

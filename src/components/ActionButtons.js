import { View, StyleSheet } from 'react-native'
import { Button } from 'react-native-paper'
import { useRecordStore, STATUS } from '../store/useRecordStore'

export function ActionButtons() {
	const { status, stopCamera, isWeightDetection } = useRecordStore()
	const isCameraActive = status === STATUS.CAMERA_ACTIVE

	if (!isWeightDetection || !isCameraActive) {
		return null
	}

	return (
		<View style={styles.buttonContainer}>
			<Button
				mode='contained'
				onPress={stopCamera}
				style={styles.button}
				icon='camera-off'
				labelStyle={{ color: 'white' }}>
				Wyłącz kamerę
			</Button>
		</View>
	)
}

const styles = StyleSheet.create({
	buttonContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
	button: { flex: 1, marginHorizontal: 5, backgroundColor: '#4682B4', paddingVertical: 8, borderRadius: 55 },
})

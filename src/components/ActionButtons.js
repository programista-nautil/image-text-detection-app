import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Button } from 'react-native-paper'
import { useRecordStore, STATUS } from '../store/useRecordStore'

export function ActionButtons() {
	const { status, startCamera, stopCamera } = useRecordStore()
	const isCameraActive = status === STATUS.CAMERA_ACTIVE
	const isLoading = status === STATUS.PROCESSING

	return (
		<View style={styles.buttonContainer}>
			{isCameraActive ? (
				<Button
					mode='contained'
					onPress={stopCamera}
					style={styles.button}
					icon='camera-off'
					labelStyle={{ color: 'white' }}>
					Wyłącz kamerę
				</Button>
			) : (
				<Button
					mode='contained'
					onPress={startCamera}
					style={styles.button}
					icon='camera'
					disabled={isLoading}
					labelStyle={{ color: 'white' }}>
					Uruchom kamerę
				</Button>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	buttonContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
	button: { flex: 1, marginHorizontal: 5, backgroundColor: '#4682B4', paddingVertical: 8, borderRadius: 55 },
})

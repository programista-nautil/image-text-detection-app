import React, { useEffect } from 'react'
import { View, StyleSheet, ScrollView, SafeAreaView } from 'react-native'
import { Provider as PaperProvider } from 'react-native-paper'
import { useCameraPermission } from 'react-native-vision-camera'
import Header from './components/Header' // Używamy starego komponentu nagłówka
import { ModeSelector } from './src/components/ModeSelector'
import { StatusDisplay } from './src/components/StatusDisplay'
import { ActionButtons } from './src/components/ActionButtons'
import { CameraManager } from './src/components/CameraManager'
import { useMarkerPolling } from './src/hooks/useMarkerPolling'
import { useRecordStore } from './src/store/useRecordStore'

export default function App() {
	const { hasPermission, requestPermission } = useCameraPermission()

	useMarkerPolling()

	useEffect(() => {
		if (!hasPermission) {
			requestPermission()
		}
	}, [hasPermission, requestPermission])

	useEffect(() => {
		const { setDetectionMode } = useRecordStore.getState()
		setDetectionMode(true)

		return () => {
			const { cameraStartTimer } = useRecordStore.getState()
			if (cameraStartTimer) {
				clearTimeout(cameraStartTimer)
			}
		}
	}, [])

	return (
		<PaperProvider>
			<SafeAreaView style={styles.container}>
				<Header />
				<ScrollView contentContainerStyle={styles.content}>
					<ModeSelector />
					<StatusDisplay />
					<ActionButtons />
					<CameraManager />
				</ScrollView>
			</SafeAreaView>
		</PaperProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f5f5',
	},
	content: {
		flexGrow: 1,
		padding: 20,
	},
})

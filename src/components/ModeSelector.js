// src/components/ModeSelector.js
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native'
import { useRecordStore } from '../store/useRecordStore'

export function ModeSelector() {
	const { isWeightDetection, setDetectionMode, status } = useRecordStore()
	const isLoading = status === 'processing'
	const { width } = useWindowDimensions()
	const isSmallScreen = width < 400

	const styles = getStyles(isSmallScreen)

	return (
		<>
			<Text style={styles.modeTitle}>Wybierz tryb kamery:</Text>
			<View style={styles.modeSelector}>
				<TouchableOpacity
					style={[styles.modeButton, isWeightDetection ? styles.selectedMode : styles.unselectedMode]}
					onPress={() => setDetectionMode(true)}
					disabled={isLoading}
					accessibilityRole='button'
					accessibilityState={{ selected: isWeightDetection, disabled: isLoading }}>
					<Text style={[styles.modeButtonText, isWeightDetection && styles.selectedModeText]}>Waga</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.modeButton, !isWeightDetection ? styles.selectedMode : styles.unselectedMode]}
					onPress={() => setDetectionMode(false)}
					disabled={isLoading}
					accessibilityRole='button'
					accessibilityState={{ selected: !isWeightDetection, disabled: isLoading }}>
					<Text style={[styles.modeButtonText, !isWeightDetection && styles.selectedModeText]}>Marker</Text>
				</TouchableOpacity>
			</View>
		</>
	)
}

const getStyles = isSmallScreen =>
	StyleSheet.create({
		modeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, paddingLeft: 5 },
		modeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
		modeButton: {
			flex: 1,
			marginHorizontal: 5,
			padding: isSmallScreen ? 10 : 12,
			backgroundColor: '#f0f0f0',
			borderRadius: 10,
			alignItems: 'center',
		},
		modeButtonText: { color: '#333', fontWeight: 'bold', fontSize: isSmallScreen ? 14 : 16 },
		selectedMode: { backgroundColor: '#4682B4' },
		unselectedMode: { borderWidth: 2, borderColor: '#4682B4' },
		selectedModeText: { color: 'white' },
	})

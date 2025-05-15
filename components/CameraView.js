import React, { memo } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { Camera as VisionCamera } from 'react-native-vision-camera'

const { width } = Dimensions.get('window')

const CameraView = ({ cameraRef, device, isActive, onInitialized, onStarted }) => {
	console.log('test')
	return (
		<VisionCamera
			style={[styles.camera, { position: 'relative' }]}
			ref={cameraRef}
			device={device}
			isActive={isActive}
			photo={true}
			onInitialized={onInitialized}
			onStarted={onStarted}
			onError={e => {
				console.error('Camera init error', e)
			}}
		/>
	)
}

export default CameraView

const styles = StyleSheet.create({
	camera: {
		width: width - 40, // Szerokość kamery
		height: ((width - 40) * 3.5) / 3, // Wysokość kamery z zachowaniem proporcji
		borderRadius: 15,
		overflow: 'hidden',
		alignSelf: 'center', // Wyśrodkuj kamerę w kontenerze
	},
})

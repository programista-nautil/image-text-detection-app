// src/components/CameraManager.js
import React, { useRef } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera'
import { useRunOnJS } from 'react-native-worklets-core'
import { crop } from 'vision-camera-cropper'
import { useRecordStore, STATUS } from '../store/useRecordStore'

export function CameraManager() {
	const { status, processImage } = useRecordStore()
	const device = useCameraDevice('back')
	const lastFrameTime = useRef(0)

	const isCameraActive = status === STATUS.CAMERA_ACTIVE

	const sendFrameForProcessing = useRunOnJS(async base64 => {
		await processImage(base64)
	}, [])

	const frameProcessor = useFrameProcessor(
		frame => {
			'worklet'
			const now = Date.now()
			if (now - lastFrameTime.current > 3000) {
				lastFrameTime.current = now

				const result = crop(frame, {
					includeImageBase64: true,
					saveAsFile: false,
				})

				if (result.base64) {
					sendFrameForProcessing(result.base64)
				}
			}
		},
		[sendFrameForProcessing]
	)

	if (device == null) {
		return (
			<View style={styles.camera}>
				<Text>Nie znaleziono kamery</Text>
			</View>
		)
	}

	return (
		<View style={styles.cameraContainer}>
			<Camera
				style={StyleSheet.absoluteFill}
				device={device}
				isActive={isCameraActive}
				frameProcessor={isCameraActive ? frameProcessor : undefined}
				photo={true}
			/>
		</View>
	)
}

const { width } = Dimensions.get('window')
const styles = StyleSheet.create({
	cameraContainer: {
		width: width - 40,
		height: ((width - 40) * 4) / 3,
		borderRadius: 15,
		overflow: 'hidden',
		alignSelf: 'center',
		backgroundColor: '#ccc',
		justifyContent: 'center',
		alignItems: 'center',
	},
})

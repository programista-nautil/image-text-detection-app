import React, { useState, useEffect, useRef } from 'react'
import {
	Text,
	View,
	StyleSheet,
	ScrollView,
	Dimensions,
	TouchableOpacity,
	Image,
	Pressable,
	AccessibilityInfo,
	findNodeHandle,
	Platform,
} from 'react-native'
import { Camera } from 'expo-camera/legacy'
import * as ImagePicker from 'expo-image-picker'
import * as Speech from 'expo-speech'
import axios from 'axios'
import { Provider as PaperProvider, Button, Card, ActivityIndicator } from 'react-native-paper'
import Header from './components/Header'
import { MaterialIcons } from '@expo/vector-icons'

export default function App() {
	const [image, setImage] = useState(null)
	const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
	const [response, setResponse] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [objectDetection, setObjectDetection] = useState(null)
	const [cameraActive, setCameraActive] = useState(false)
	const [hasPermission, setHasPermission] = useState(null)
	const [detectionMode, setDetectionMode] = useState('')
	const cameraRef = useRef(null)
	const detectionIntervalRef = useRef(null)
	const { width } = Dimensions.get('window')
	const [takePictureActive, setTakePictureActive] = useState(false)
	const errorRef = useRef(null)
	const [isSpeaking, setIsSpeaking] = useState(false)

	// Focus on error
	useEffect(() => {
		if (error && errorRef.current) {
			const reactTag = findNodeHandle(errorRef.current)
			if (reactTag) {
				AccessibilityInfo.setAccessibilityFocus(reactTag)
			}
		}
	}, [error])

	useEffect(() => {
		if (loading) {
			AccessibilityInfo.announceForAccessibility('Ładowanie rozpoczęte')
		} else if (!loading && response) {
			AccessibilityInfo.announceForAccessibility('Ładowanie zakończone')
		}
	}, [loading])

	useEffect(() => {
		if (error) {
			AccessibilityInfo.announceForAccessibility(`Błąd: ${error}`)
		}
	}, [error])

	useEffect(() => {
		;(async () => {
			const { status } = await Camera.requestCameraPermissionsAsync()
			setHasPermission(status === 'granted')
		})()
	}, [])

	useEffect(() => {
		if (cameraActive) {
			// Restart detection whenever the detectionMode changes while the camera is active
			stopDetection() // Stop the current detection
		}
	}, [detectionMode])

	useEffect(() => {
		if (response) {
			if (detectionMode === 'microwave' && response.detectedText) {
				// Odczytaj tekst wykryty w trybie microwave
				Speech.speak(response.detectedText)
			} else if (detectionMode === 'car' && response.data) {
				// Sprawdzamy, czy response.data istnieje
				// Odczytaj numer rejestracyjny i wagę w trybie car
				const licensePlate = response.data.license_plate || 'Brak numeru rejestracyjnego'
				const weight = response.data.weight ? `Waga: ${response.data.weight}` : 'Brak wagi'
				Speech.speak(`Wykryty pojazd. Numer rejestracyjny: ${licensePlate}. ${weight}`)
			}
		}
	}, [response, detectionMode])

	const handleModeChange = newMode => {
		// Usunięcie zdjęcia i danych po zmianie trybu
		Speech.stop()
		setImage(null)
		setResponse(null)
		setObjectDetection(null)
		setError(null)

		if (cameraActive || takePictureActive) {
			stopDetection()
			setTakePictureActive(false)
			setCameraActive(false)
		}
		setDetectionMode(newMode) // Set the new detection mode
	}

	const getDescriptionText = () => {
		switch (detectionMode) {
			case 'all':
				return 'Tryb wykrywania wszystkich obiektów w czasie rzeczywistym.'
			case 'car':
				return 'Tryb wykrywania pojazdów i odczytywania ich tablicy rejestracyjnej i wagi.'
			case 'microwave':
				return 'Tryb wykrywania markerów i analizy tekstu.'
			default:
				return 'Aplikacja służy do wykrywania obiektów na zdjęciach oraz analizy ich zawartości.'
		}
	}

	const pickImage = async () => {
		let result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: false,
			quality: 1,
		})

		if (!result.canceled) {
			const selectedImage = result.assets[0].uri
			setImage(selectedImage)
			setObjectDetection(null)
			setResponse(null)
			setError(null)
			Image.getSize(selectedImage, (imgWidth, imgHeight) => {
				setImageSize({ width: imgWidth, height: imgHeight })
			})
		}
	}

	const takePicture = async () => {
		if (cameraRef.current) {
			let photo = await cameraRef.current.takePictureAsync()
			const selectedImage = photo.uri
			setImage(selectedImage)
			setObjectDetection(null)
			setResponse(null)
			setError(null)
			Image.getSize(selectedImage, (imgWidth, imgHeight) => {
				setImageSize({ width: imgWidth, height: imgHeight })
			})

			if (detectionMode === 'microwave') {
				// W trybie "microwave" analizujemy tylko tekst
				//analyzeTextFromImage(selectedImage)
				detectArUcoMarker(selectedImage)
			} else {
				uploadImage(selectedImage) // Dla innych trybów standardowy upload obrazu
			}
			setTakePictureActive(false)
		}
	}

	// Funkcja do przesyłania obrazu i detekcji markerów ArUco
	const detectArUcoMarker = async imageUri => {
		try {
			setLoading(true)
			const base64Image = await getBase64(imageUri)

			const data = {
				image: base64Image,
				mode: detectionMode,
			}

			const detectRes = await axios.post('http://192.168.0.158:5000/detect_and_save_marker', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})

			if (detectRes.data.marker_id) {
				const markerId = detectRes.data.marker_id
				const message = detectRes.data.message || `Wykryto marker o numerze ${markerId}`
				Speech.speak(message) // Odczytaj wiadomość

				if (markerId === 25) {
					setResponse({ detectedObject: 'Wykryto stolik.' })
				}

				if (markerId === 20) {
					setResponse({ detectedObject: 'Wykryto słoik.' })
				}

				if (markerId === 30) {
					setResponse({ detectedObject: 'Wykryto słoik.' })
				}

				if (markerId === 35) {
					setResponse({ detectedObject: 'Wykryto słoik.' })
				}

				if (markerId === 40) {
					setResponse({ detectedObject: 'Wykryto słoik.' })
				}

				// Jeśli wykryto ekspres do kawy (marker o ID 11), uruchom analizę tekstu
				if (markerId === 11) {
					Speech.speak('Rozpoczynam analizę tekstu.')
					analyzeTextFromImage(imageUri) // Analizuj tekst na zdjęciu
				}
			} else {
				setError('Nie wykryto markera.')
				//Speech.speak('Nie wykryto markera.')
			}
		} catch (error) {
			console.error('Error during ArUco detection: ', error)
			setError('Error during marker detection')
			Speech.speak('Wystąpił błąd podczas wykrywania markera.')
		} finally {
			setLoading(false)
		}
	}

	// Funkcja do analizy tekstu z obrazu
	const analyzeTextFromImage = async imageUri => {
		try {
			setLoading(true)
			const base64Image = await getBase64(imageUri)

			const data = {
				image: base64Image,
				mode: detectionMode, // Tryb jest zawsze "microwave" tutaj
			}

			const detectRes = await axios.post('http://192.168.0.158:5000/detect_and_save', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})

			setResponse(detectRes.data)
			if (!detectRes.data.detectedText) {
				setError('Brak wykrytego tekstu.')
				Speech.speak('Brak wykrytego tekstu.')
			}
		} catch (error) {
			console.error('Error during text analysis: ', error)
			setError('Error during text analysis')
			Speech.speak('Wystąpił błąd podczas analizy tekstu.')
		} finally {
			setLoading(false)
		}
	}

	const getBase64 = async fileUri => {
		const response = await fetch(fileUri)
		const blob = await response.blob()
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onloadend = () => resolve(reader.result)
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})
	}

	// Function to analyze and send data to detect_and_save endpoint
	const analyzeImage = async () => {
		if (cameraRef.current) {
			try {
				// Stop real-time object detection and camera feed
				clearInterval(detectionIntervalRef.current)

				// Capture the last frame from the camera and set it as the static image
				let photo = await cameraRef.current.takePictureAsync()
				const selectedImage = photo.uri
				setImage(selectedImage) // Set the captured image as the static image
				setCameraActive(false) // Stop the camera

				// Process the image
				setLoading(true)
				const base64Image = await getBase64(selectedImage)

				const data = {
					image: base64Image,
					mode: detectionMode, // Send the detection mode to the backend
				}

				const detectRes = await axios.post('http://192.168.0.158:5000/detect_and_save', data, {
					headers: {
						'Content-Type': 'application/json',
					},
				})

				// Handle the response
				setResponse(detectRes.data)
			} catch (error) {
				console.error('Error during analysis: ', error)
				setError('Error during analysis')
			} finally {
				setLoading(false)
			}
		}
	}

	const uploadImage = async (selectedImageUri = image) => {
		if (!selectedImageUri) {
			const errorMessage = 'Brak obrazu do przesłania.'
			setError(errorMessage)
			Speech.speak(errorMessage)
			return
		}

		setLoading(true)

		const formData = new FormData()
		formData.append('file', {
			uri: selectedImageUri,
			type: 'image/jpeg',
			name: 'photo.jpg',
		})

		try {
			// Include detection mode in request
			const detectObjectsRes = await axios.post(
				`http://192.168.0.158:5000/detect_objects?mode=${detectionMode}`,
				formData,
				{
					headers: {
						'Content-Type': 'multipart/form-data',
					},
				}
			)

			if (detectObjectsRes.data.length === 0) {
				const noObjectsMessage = 'Nie wykryto żadnych obiektów na zdjęciu.'
				setError(noObjectsMessage)
				//Speech.speak(noObjectsMessage)
				setObjectDetection(null)
				setLoading(false)
				return
			} else {
				setObjectDetection(detectObjectsRes.data)
				setError(null)
				if (detectionMode === 'microwave') {
					Speech.speak('Wykryto ekspres, analizuje tekst.')
				}
			}

			const base64Image = await getBase64(selectedImageUri)

			const data = {
				image: base64Image,
				mode: detectionMode,
			}

			const detectRes = await axios.post('http://192.168.0.158:5000/detect_and_save', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})
			setResponse(detectRes.data)
		} catch (error) {
			console.error('Error uploading image: ', error)
			const uploadErrorMessage = 'Wystąpił błąd podczas przesyłania obrazu.'
			setError(uploadErrorMessage)
			Speech.speak(uploadErrorMessage)
		} finally {
			setLoading(false)
		}
	}

	const startDetection = async () => {
		if (cameraRef.current && !isSpeaking) {
			setLoading(true)
			await detectObjects()
			setLoading(false)

			detectionIntervalRef.current = setInterval(
				async () => {
					if (!isSpeaking) {
						await detectObjects()
					}
				},
				Platform.OS === 'ios' ? 5000 : 7000
			)
		}
	}

	const detectObjects = async () => {
		if (cameraRef.current) {
			try {
				setLoading(true)
				let photo = await cameraRef.current.takePictureAsync()
				const selectedImage = photo.uri
				setImage(selectedImage)

				Image.getSize(selectedImage, (imgWidth, imgHeight) => {
					setImageSize({ width: imgWidth, height: imgHeight })
				})

				let formData = new FormData()
				formData.append('file', {
					uri: selectedImage,
					name: 'realtime.jpg',
					type: 'image/jpeg',
				})

				const detectRes = await axios.post(`http://192.168.0.158:5000/detect_objects?mode=${detectionMode}`, formData, {
					headers: {
						'Content-Type': 'multipart/form-data',
					},
				})

				let detectionData = detectRes.data
				if (typeof detectionData === 'string') {
					detectionData = JSON.parse(detectionData) // Parsowanie JSON, jeśli konieczne
				}

				if (detectionData.length > 0) {
					setObjectDetection(detectionData)
					setLoading(false)
					// W przypadku trybu 'car' lub 'microwave', uruchom analizę obrazu
					if (detectionMode === 'car' || detectionMode === 'microwave') {
						Speech.speak('Wykryto obiekt. Analizuję obraz.')
						analyzeImage() // Analiza obrazu, jeśli są wykryte obiekty
					}
					if (detectionMode === 'all') {
						await readDetectedObjects(detectionData) // Czekaj na zakończenie mowy
					}
				} else {
					setObjectDetection([])
					Speech.speak('Nie wykryto żadnych obiektów.')
				}
			} catch (error) {
				console.error('Error during detection: ', error)
				setError('Error during detection')
			} finally {
				setLoading(false) // Upewnij się, że ładowanie zostaje zatrzymane
			}
		}
	}

	const readDetectedObjects = async detectionData => {
		return new Promise((resolve, reject) => {
			const limitedDetectionData = detectionData.slice(0, 4)
			const objectNames = limitedDetectionData.map(obj => `${obj.name}`).join('. ')

			Speech.stop()
			setIsSpeaking(true) // Oznacz, że zaczynamy czytać

			Speech.speak(objectNames, {
				onDone: () => {
					setIsSpeaking(false) // Oznacz, że odczyt się zakończył
					resolve() // Informuj, że zakończono odczyt
				},
				onError: error => {
					setIsSpeaking(false) // Jeśli błąd, zakończ
					reject(error) // Informuj o błędzie
				},
			})
		})
	}

	// Function to stop the real-time detection
	const stopDetection = () => {
		Speech.stop()
		clearInterval(detectionIntervalRef.current)
		setLoading(false)
		setTakePictureActive(false)
		setCameraActive(false)
		setImage(null)
		setResponse(null)
		setObjectDetection(null)
		setError(null)
	}

	// Function to remove image and stop detection
	const removeImage = () => {
		Speech.stop()
		setImage(null)
		setResponse(null)
		setObjectDetection(null)
		setError(null)
		clearInterval(detectionIntervalRef.current)
	}

	if (!hasPermission) {
		return <View />
	}

	if (hasPermission === false) {
		return <Text>No access to camera</Text>
	}

	const scaleBox = box => {
		if (!imageSize.width || !imageSize.height) return {}
		const viewAspectRatio = imageSize.width / imageSize.height
		const viewWidth = width - 40
		const viewHeight = viewWidth / viewAspectRatio

		const scaleX = viewWidth / imageSize.width
		const scaleY = viewHeight / imageSize.height

		return {
			left: box.x1 * scaleX,
			top: box.y1 * scaleY,
			width: (box.x2 - box.x1) * scaleX,
			height: (box.y2 - box.y1) * scaleY,
		}
	}

	return (
		<PaperProvider>
			<View style={styles.container}>
				<Header />
				<ScrollView
					contentContainerStyle={styles.content}
					ref={ref => {
						this.scrollView = ref
					}}
					onContentSizeChange={() => this.scrollView.scrollToEnd({ animated: true })}>
					<Card style={styles.descriptionCard}>
						<Card.Content>
							<Text style={styles.descriptionText}>{getDescriptionText()}</Text>
						</Card.Content>
					</Card>
					{/* Object detection mode selector using buttons */}
					<Text style={styles.modeTitle}>Wybierz tryb:</Text>
					<View style={styles.modeSelector}>
						<TouchableOpacity
							style={[styles.modeButton, detectionMode === 'all' ? styles.selectedMode : styles.unselectedMode]}
							onPress={() => handleModeChange('all')}
							disabled={loading}
							accessibilityLabel='tryb wszystkie obiekty' // Etykieta dla VoiceOver
							accessibilityRole='button'>
							<Text style={styles.modeButtonText}>Wszystkie obiekty</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modeButton, detectionMode === 'car' ? styles.selectedMode : styles.unselectedMode]}
							onPress={() => {
								if (loading) setLoading(false)
								handleModeChange('car')
							}}
							disabled={loading && detectionMode === 'microwave'}
							accessibilityLabel='tryb tylko pojazdy' // Etykieta dla VoiceOver
							accessibilityRole='button'>
							<Text style={styles.modeButtonText}>Tylko pojazdy</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modeButton, detectionMode === 'microwave' ? styles.selectedMode : styles.unselectedMode]}
							onPress={() => {
								if (loading) setLoading(false)
								handleModeChange('microwave')
							}}
							disabled={loading && detectionMode === 'car'}
							accessibilityLabel='tryb wykryj markery' // Etykieta dla VoiceOver
							accessibilityRole='button'>
							<Text style={styles.modeButtonText}>Wykryj markery</Text>
						</TouchableOpacity>
					</View>
					<View style={styles.buttonContainer}>
						{detectionMode === 'car' && (
							<Button
								mode='contained'
								onPress={pickImage}
								style={styles.button}
								icon='image'
								disabled={loading || cameraActive}
								accessibilityRole='button'>
								Wybierz z galerii
							</Button>
						)}
						{detectionMode === 'microwave' && (
							<Button
								mode='contained'
								onPress={() => {
									if (image) {
										setImage(null)
									}
									setTakePictureActive(true)
								}}
								style={styles.button}
								icon='camera'
								disabled={loading || cameraActive || takePictureActive}
								importantForAccessibility={loading ? 'no-hide-descendants' : 'yes'}
								accessibilityElementsHidden={loading ? true : false}
								accessibilityRole='button'>
								Otwórz aparat
							</Button>
						)}
						{detectionMode === 'all' && (
							<Button
								mode='contained'
								onPress={() => setCameraActive(true)}
								style={styles.button}
								icon='camera'
								disabled={loading || takePictureActive}
								accessibilityRole='button'>
								Wykryj obiekty
							</Button>
						)}
					</View>
					{takePictureActive && (
						<Camera style={styles.camera} ref={cameraRef}>
							<View style={styles.cameraButtonContainer}>
								<Pressable
									onPress={takePicture}
									style={styles.cameraIconButton}
									accessibilityLabel='Zrób zdjęcie' // Etykieta dla VoiceOver
									accessibilityRole='button'>
									<MaterialIcons name='camera' size={35} color='white' />
								</Pressable>
							</View>
							<TouchableOpacity
								style={styles.removeButton}
								onPress={() => setTakePictureActive(false)}
								accessibilityLabel='Wyłącz aparat'
								accessibilityRole='button'
								disabled={loading}>
								<MaterialIcons name='close' size={24} color='white' />
							</TouchableOpacity>
						</Camera>
					)}
					{cameraActive ? (
						<>
							<Camera style={styles.camera} ref={cameraRef} onCameraReady={startDetection}>
								{objectDetection &&
									Platform.OS === 'ios' &&
									objectDetection.slice(0, detectionMode === 'all' ? 4 : 1).map((obj, index) => (
										<View key={index} style={[styles.box, scaleBox(obj.box)]}>
											<View style={styles.labelContainer}>
												<Text style={styles.label}>{obj.name}</Text>
											</View>
										</View>
									))}
								<View style={styles.cameraButtonContainer}>
									<TouchableOpacity
										style={styles.removeButton}
										onPress={stopDetection}
										accessibilityLabel='Wyłącz aparat'
										accessibilityRole='button'>
										<MaterialIcons name='close' size={24} color='white' />
									</TouchableOpacity>
								</View>
							</Camera>
						</>
					) : image && imageSize.width > 0 && imageSize.height > 0 ? (
						<>
							<View style={styles.imageContainer}>
								<ScrollView
									style={[
										styles.imageWrapper,
										{
											height:
												Platform.OS === 'android'
													? (width - 40) * (imageSize.height / imageSize.width) // Skaluje na Androidzie
													: (width - 40) * (imageSize.height / imageSize.width),
										},
									]}
									contentContainerStyle={styles.imageScrollContainer}
									maximumZoomScale={3}>
									<View style={{ position: 'relative' }}>
										<Image
											source={{ uri: image }}
											style={[
												styles.image,
												{
													height:
														Platform.OS === 'android'
															? (width - 40) * (imageSize.height / imageSize.width) // Skaluje na Androidzie
															: (width - 40) * (imageSize.height / imageSize.width),
													borderRadius: 15,
												},
											]}
											accessible={true} // Informacja o dostępności
											accessibilityLabel='' // Etykieta dla VoiceOver
											resizeMode='contain'
										/>
										{objectDetection &&
											objectDetection.map((obj, index) => (
												<View
													key={index}
													style={{
														position: 'absolute',
														borderColor: 'red',
														borderWidth: 2,
														...scaleBox(obj.box),
													}}
												/>
											))}
									</View>
								</ScrollView>
								<TouchableOpacity
									style={styles.removeButton}
									onPress={removeImage}
									accessibilityLabel='Wyłącz aparat'
									accessibilityRole='button'
									disabled={loading}>
									<MaterialIcons name='close' size={24} color='white' />
								</TouchableOpacity>
							</View>

							{detectionMode == 'car' && (
								<Button
									mode='contained'
									onPress={() => {
										uploadImage(image)
									}}
									disabled={loading}
									style={styles.uploadButton}>
									Wyślij obraz
								</Button>
							)}
							{error && <Text style={styles.errorText}>{error}</Text>}
						</>
					) : (
						!cameraActive &&
						!takePictureActive && (
							<View style={styles.imagePlaceholder}>
								<Text style={styles.placeholderText}>Nie dodano jeszcze zdjęcia</Text>
							</View>
						)
					)}
					{loading && (
						<ActivityIndicator animating={true} size='large' style={styles.activityIndicator} color='#4682B4' />
					)}
					{detectionMode === 'all' && objectDetection && cameraActive && loading === false && (
						<View>
							{objectDetection && objectDetection.length > 0 ? (
								<View>
									<Text style={styles.responseText}>Wykryte obiekty:</Text>
									{objectDetection.slice(0, 4).map((obj, index) => (
										<Text key={index} style={styles.responseText}>
											{obj.name} - {Math.round(obj.confidence * 100)}% pewności
										</Text>
									))}
								</View>
							) : (
								<Text style={styles.responseText}>Nie wykryto żadnych obiektów na zdjęciu.</Text>
							)}
						</View>
					)}
					{response && (
						<View style={styles.responseContainer}>
							<Card style={styles.responseCard}>
								<Card.Content>
									{detectionMode === 'microwave' && (
										<View style={styles.responseRow}>
											{response.detectedText && (
												<>
													<Text style={styles.responseText}>
														Wykryty tekst: {response.detectedText || 'Brak tekstu'}
													</Text>

													<TouchableOpacity
														onPress={() => Speech.speak(response.detectedText)}
														accessibilityLabel='Powtórz'
														accessibilityRole='button'>
														<MaterialIcons name='replay' size={24} color='black' />
													</TouchableOpacity>
												</>
											)}
											{response.detectedObject && (
												<Text style={[styles.responseText, { textAlign: 'center' }]}>{response.detectedObject}</Text>
											)}
										</View>
									)}

									{detectionMode === 'car' && (
										<>
											{response.data ? (
												<>
													<Text style={styles.responseText}>
														Numer rejestracyjny: {response.data.license_plate || 'Brak danych'}
													</Text>
													<Text style={styles.responseText}>Waga: {response.data.weight || 'Brak danych'}</Text>
												</>
											) : (
												<Text style={styles.responseText}>Brak danych do wyświetlenia</Text>
											)}
										</>
									)}
								</Card.Content>
							</Card>
						</View>
					)}
				</ScrollView>
			</View>
		</PaperProvider>
	)
}

const { width } = Dimensions.get('window')
const isSmallScreen = width < 400

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f5f5',
	},
	content: {
		flexGrow: 1,
		justifyContent: 'flex-start',
		padding: 20,
	},
	modeSelector: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 10,
	},
	modeButton: {
		flex: 1,
		marginHorizontal: 5,
		padding: isSmallScreen ? 10 : 10, // Zmniejsz rozmiar przycisku dla małych ekranów
		backgroundColor: '#f0f0f0',
		borderRadius: 10,
		alignItems: 'center',
	},
	modeButtonText: {
		color: '#333',
		fontWeight: 'bold',
		fontSize: isSmallScreen ? 11 : 16, // Zmniejsz czcionkę dla mniejszych ekranów
	},
	selectedMode: {
		backgroundColor: '#4682B4',
	},
	unselectedMode: {
		borderWidth: 2,
		borderColor: '#4682B4',
	},
	box: {
		position: 'absolute',
		borderColor: 'red',
		borderWidth: 2,
	},
	labelContainer: {
		position: 'absolute',
		top: -20,
		left: 0,
		flexDirection: 'row',
		backgroundColor: 'rgba(255, 0, 0, 0.5)',
		paddingHorizontal: 5,
		paddingVertical: 2,
		borderRadius: 5,
	},
	label: {
		color: 'white',
		fontSize: 12,
	},
	descriptionCard: {
		marginBottom: 20,
	},
	descriptionText: {
		fontSize: 16,
		color: '#333',
		textAlign: 'center',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginVertical: 10,
	},
	button: {
		flex: 1,
		marginHorizontal: 5,
		backgroundColor: '#4682B4',
		paddingVertical: 8,
		borderRadius: 55,
	},
	uploadButton: {
		marginTop: 20,
		marginBottom: 10,
		backgroundColor: '#4682B4',
	},
	camera: {
		width: width - 40,
		height: ((width - 40) * 3) / 3,
		borderRadius: 15,
		overflow: 'hidden',
		marginTop: 10,
	},
	cameraIconButton: {
		marginBottom: 15,
		backgroundColor: 'rgba(0,0,0,0.5)',
		borderRadius: 25,
		padding: 10,
	},
	cameraButtonContainer: {
		flex: 1,
		gap: 10,
		backgroundColor: 'transparent',
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'flex-end',
		paddingHorizontal: 30,
		paddingBottom: 10,
	},
	cameraText: {
		fontSize: 18,
		marginBottom: 10,
		color: 'white',
	},
	analyzeButton: {
		marginTop: 10,
	},
	imageContainer: {
		position: 'relative',
		marginTop: 10,
	},
	imageWrapper: {
		width: width - 40,
	},
	imageScrollContainer: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	image: {
		width: width - 40,
		borderRadius: 15,
	},
	removeButton: {
		position: 'absolute',
		top: 10,
		right: 10,
		backgroundColor: 'rgba(255, 0, 0, 0.7)',
		padding: 5,
		borderRadius: 15,
		zIndex: 10,
	},
	activityIndicator: {
		marginVertical: 20,
		zIndex: 1000,
	},
	imagePlaceholder: {
		width: width - 40,
		height: Math.min(width - 40, width / 2),
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#e0e0e0',
		borderRadius: 8,
		marginTop: 10,
	},
	placeholderText: {
		color: '#888',
		fontSize: 18,
	},
	responseContainer: {
		marginTop: 10,
	},
	responseCard: {
		backgroundColor: '#fff',
	},
	responseText: {
		color: '#333',
	},
	errorText: {
		color: '#f44336',
		marginTop: 10,
		textAlign: 'center',
		fontWeight: 'bold',
	},
	cameraIconButton: {
		marginBottom: 15,
		backgroundColor: 'rgba(0,0,0,0.5)',
		borderRadius: 25,
		padding: 10,
	},
	cameraButtonContainer: {
		flex: 1,
		gap: 10,
		backgroundColor: 'transparent',
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'flex-end',
		paddingHorizontal: 30,
		paddingBottom: 10,
	},
	cameraText: {
		fontSize: 18,
		marginBottom: 10,
		color: 'white',
	},
	modeTitle: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#333',
		marginBottom: 10,
		textAlign: 'left',
		paddingLeft: 5,
	},
	responseRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
})

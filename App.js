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
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import {
	Camera as VisonCamera,
	useCameraDevice,
	useCameraPermission,
	useFrameProcessor,
	runAtTargetFps,
} from 'react-native-vision-camera'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import { crop } from 'vision-camera-cropper'
import { useRunOnJS } from 'react-native-worklets-core'
import CameraView from './components/CameraView'
import uuid from 'react-native-uuid'

export default function App() {
	const [image, setImage] = useState(null)
	const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
	const [response, setResponse] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [objectDetection, setObjectDetection] = useState([])
	const [cameraActive, setCameraActive] = useState(false)
	const { hasPermission, requestPermission } = useCameraPermission()
	const [detectionMode, setDetectionMode] = useState('car')
	const [isWeightDetection, setIsWeightDetection] = useState(false)
	const cameraRef = useRef(null)
	const device = useCameraDevice('back')
	const detectionIntervalRef = useRef(null)
	const { width } = Dimensions.get('window')
	const [takePictureActive, setTakePictureActive] = useState(false)
	const errorRef = useRef(null)
	const [isSpeaking, setIsSpeaking] = useState(false)
	const [arucoMarkers, setArucoMarkers] = useState({ marker_ids: [], corners: [] })
	const [buttonClicked, setButtonClicked] = useState({
		all: false,
		car: false,
		microwave: false,
	})
	const [carCameraMode, setCarCameraMode] = useState(false)
	const [imageSource, setImageSource] = useState('')
	const [carDetectionMode, setCarDetectionMode] = useState(false)
	const lastFrameSent = useRef(0)
	const [isDetecting, setIsDetecting] = useState(false)
	const [isDetectionRunning, setIsDetectionRunning] = useState(false)
	const [isCameraInitialized, setIsCameraInitialized] = useState(false)
	const isDetectionRunningRef = useRef(false)
	const [recordId, setRecordId] = useState(null)

	const aspectRatio = 4 / 3

	// Oblicz wysokość na podstawie szerokości ekranu i proporcji
	const cameraHeight = (width / aspectRatio) * 1.5

	const takePictureButtonRef = useRef(null)

	const handleRetakePhoto = () => {
		if (image) {
			setImage(null)
			setImageSource('')
		}
		setResponse(null)
		setTakePictureActive(true)

		// Skupienie na przycisku "Zrób zdjęcie"
		const reactTag = findNodeHandle(takePictureButtonRef.current)
		if (reactTag) {
			AccessibilityInfo.setAccessibilityFocus(reactTag)
		}
	}

	useEffect(() => {
		if (detectionMode === 'car' && cameraActive) {
			takePicture() // Rozpocznij robienie zdjęć w trybie car
		}
	}, [detectionMode, cameraActive])

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
			const cameraPermission = await requestPermission()
			if (!cameraPermission) {
				alert('Camera permission are required.')
			}
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
				speakText(response.detectedText)
			} else if (detectionMode === 'car' && response.data) {
				// Sprawdzamy, czy response.data istnieje
				// Odczytaj numer rejestracyjny i wagę w trybie car
				const licensePlate = response.data.license_plate || 'Brak numeru rejestracyjnego'
				const weight = response.data.weight ? `Waga: ${response.data.weight}` : 'Brak wagi'
				speakText(`Wykryty pojazd. Numer rejestracyjny: ${licensePlate}. ${weight}`)
			}
		}
	}, [response, detectionMode])

	useEffect(() => {
		if (detectionMode === 'car' && cameraActive && isCameraInitialized) {
			startCarDetectionLoop() // Rozpocznij robienie zdjęć w trybie car
		}
	}, [detectionMode, cameraActive, isCameraInitialized])

	useEffect(() => {
		const resetRecordIdOnStart = async () => {
			try {
				await axios.post('http://192.168.0.139:8000/set_record_id', {
					record_id: null,
					is_processing: false,
					last_mode: null,
					timestamp_weight_detected: null,
				})
				console.log('Reset record_id.json on app start')
			} catch (error) {
				console.error('Error resetting record_id.json:', error.message)
			}
		}

		resetRecordIdOnStart()
	}, [])

	if (!device)
		return (
			<View>
				<Text>No camera device found</Text>
			</View>
		)

	const handleModeChange = newMode => {
		// Usunięcie zdjęcia i danych po zmianie trybu
		Speech.stop()
		setImage(null)
		setResponse(null)
		setObjectDetection([])
		setError(null)

		if (cameraActive || takePictureActive) {
			stopDetection()
			setTakePictureActive(false)
			setCameraActive(false)
		}

		console.log(newMode)
		// Zaktualizuj tryb detekcji
		setDetectionMode(newMode)

		// Ustaw przycisk jako kliknięty
		setButtonClicked(prevState => ({
			...prevState,
			[newMode]: true,
		}))

		setTimeout(() => {
			setButtonClicked(prevState => ({
				...prevState,
				[newMode]: false, // Zresetuj stan po krótkim czasie
			}))
		}, 1000)

		// Sprawdź, czy VoiceOver lub TalkBack są włączone
		AccessibilityInfo.isScreenReaderEnabled().then(isScreenReaderEnabled => {
			if (isScreenReaderEnabled) {
				// Odczytaj wybrany tryb tylko, jeśli VoiceOver lub TalkBack są aktywne
				let modeMessage = ''
				switch (newMode) {
					case 'all':
						modeMessage = 'Wybrano tryb wykrywania wszystkich obiektów'
						break
					case 'car':
						modeMessage = 'Wybrano tryb wykrywania pojazdów'
						break
					case 'microwave':
						modeMessage = 'Wybrano tryb wykrywania markerów'
						break
					default:
						modeMessage = 'Wybrano nieznany tryb'
				}
				speakText(modeMessage) // Odczytaj wybrany tryb
			}
		})
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

	const keepScreenAwake = () => {
		activateKeepAwakeAsync()
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
			setImageSource('gallery')
			setObjectDetection([])
			setResponse(null)
			setError(null)
			Image.getSize(selectedImage, (imgWidth, imgHeight) => {
				setImageSize({ width: imgWidth, height: imgHeight })
			})
		}
	}

	const takePicture = async () => {
		if (cameraRef.current) {
			const photo = await cameraRef.current.takePhoto({
				flash: 'off', // opcjonalnie: 'on' lub 'off'
			})
			const selectedImage = `file://${photo.path}` // Ścieżka do zapisanego zdjęcia
			setImage(selectedImage)
			setImageSource('camera')
			setObjectDetection([])
			setResponse(null)
			setError(null)
			Image.getSize(selectedImage, (imgWidth, imgHeight) => {
				setImageSize({ width: imgWidth, height: imgHeight })
			})

			if (detectionMode === 'microwave') {
				detectArUcoMarker(selectedImage)
			} else if (detectionMode === 'car') {
				if (takePictureActive) {
					uploadImage(selectedImage)
				}
				//if (cameraActive) await uploadImage(selectedImage)
			}
			setTakePictureActive(false)
		}
	}

	// Funkcja do przesyłania obrazu i detekcji markerów ArUco
	const detectArUcoMarker = async imageUri => {
		try {
			setLoading(true) // Rozpoczynamy ładowanie
			const base64Image = await getBase64(imageUri)

			const data = {
				image: base64Image,
				mode: detectionMode,
			}

			const detectRes = await axios.post('https://debogorze.pl/detect_and_save_marker', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})

			// Sprawdzamy, czy wykryto jakiekolwiek markery
			if (detectRes.data.marker_ids && detectRes.data.marker_ids.length > 0) {
				const detectedMarkers = detectRes.data.marker_ids || []
				const corners = detectRes.data.corners || []
				setArucoMarkers({ marker_ids: detectedMarkers, corners })

				const newResponses = [] // Zmienna do przechowywania wszystkich odpowiedzi

				detectedMarkers.forEach(markerId => {
					let message = '' // Wiadomość, którą wypowiemy

					switch (markerId) {
						case 25:
							message = 'Wykryto stolik.'
							break
						case 20:
							message = 'Wykryto słoik.'
							break
						case 30:
							message = 'Wykryto stojak.'
							break
						case 35:
							message = 'Wykryto krówki.'
							break
						case 40:
							message = 'Wykryto wizytówki.'
							break
						case 45:
							message = 'Wykryto gadżety.'
							break
						case 11:
							message = 'Wykryto ekspres do kawy. Rozpoczynam analizę tekstu.'
							analyzeTextFromImage(imageUri) // Analizuj tekst na zdjęciu
							break
						default:
							message = `Wykryto nieznany marker o ID ${markerId}.`
					}

					if (message) {
						newResponses.push(message)
						speakText(message)
					}
				})

				// Ustawiamy odpowiedzi po zakończeniu pętli
				setResponse(prevResponse => ({
					...prevResponse,
					detectedObjects: newResponses,
				}))
			} else {
				setError('Nie wykryto markera.')
			}
		} catch (error) {
			console.error('Error detectArUcoMarker: ', error)
			setError('Error during marker detection')
			speakText('Wystąpił błąd podczas wykrywania markera.')
		} finally {
			setLoading(false) // Wyłączamy ładowanie niezależnie od wyniku
		}
	}

	// Funkcja do analizy tekstu z obrazu
	const analyzeTextFromImage = async imageUri => {
		try {
			const base64Image = await getBase64(imageUri)

			const data = {
				image: base64Image,
				mode: detectionMode, // Tryb jest zawsze "microwave" tutaj
			}

			const detectRes = await axios.post('https://debogorze.pl/detect_and_save', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})

			setResponse(detectRes.data)
			if (!detectRes.data.detectedText) {
				setError('Brak wykrytego tekstu.')
				speakText('Brak wykrytego tekstu.')
			}
		} catch (error) {
			console.error('Error analyzeTextFromImage: ', error.message, error.response ? error.response.data : null)
			setError('Error during marker detection')
			speakText('Wystąpił błąd podczas wykrywania markera.')
			setLoading(false)
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
	const analyzeImage = async base64Image => {
		try {
			const selectedImage = `data:image/jpeg;base64,${base64Image}`
			if (!carDetectionMode) {
				setImage(selectedImage) // Set the captured image as the static image
				setCameraActive(false) // Stop the camera
			}

			// Process the image
			setLoading(true)

			const data = {
				image: base64Image,
				mode: detectionMode, // Send the detection mode to the backend
			}

			const detectRes = await axios.post('https://debogorze.pl/detect_and_save', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})
			console.log('Wysylam zdjecie do analizy', detectRes.data)

			setResponse(detectRes.data)
		} catch (error) {
			console.error('Error analyzeImage: ', error.message, error.response ? error.response.data : null)
			setError('Error during marker detection')
			speakText('Wystąpił błąd podczas wykrywania markera.')
			setLoading(false)
		} finally {
			setLoading(false)
		}
	}

	//Obecna funkcja do obslugiwania całego procesu wykrywania zdjęć
	const uploadImage = async (selectedImageUri = image) => {
		if (!selectedImageUri) {
			const errorMessage = 'Brak obrazu do przesłania.'
			setError(errorMessage)
			speakText(errorMessage)
			return
		}

		setLoading(true)

		try {
			const base64Image = await getBase64(selectedImageUri)

			let currentRecordId = recordId
			if (!currentRecordId) {
				try {
					const recordStateRes = await axios.get('http://192.168.0.139:8000/get_record_id')
					const { record_id, is_processing } = recordStateRes.data
					if (is_processing) {
						console.log('System jest aktualnie zajęty. Spróbuj ponownie za chwilę.')
						return
					}
					currentRecordId = record_id
					console.log('Fetched recordId from backend:', currentRecordId)
				} catch (error) {
					console.warn('No recordId found on backend, generating a new one.')
					currentRecordId = null
				}
			}

			const data = {
				image: base64Image,
				mode: detectionMode,
				isWeightDetection: isWeightDetection,
				record_id: currentRecordId,
			}

			const detectRes = await axios.post('http://192.168.0.139:8000/detect_and_save', data, {
				headers: {
					'Content-Type': 'application/json',
				},
			})
			const detectData = detectRes.data

			if (detectData.status === 'waiting') {
				console.log('Czekamy na marker, nie resetujemy recordId.')
				return
			}

			if (detectData.status === 'ignored') {
				console.log('Zapytanie zignorowane:', detectData.message)
				return
			}

			if (!currentRecordId && detectData.data?.record_id) {
				const newRecordId = detectData.data.record_id
				try {
					await axios.post('http://192.168.0.139:8000/set_record_id', {
						record_id: newRecordId,
						is_processing: true,
						last_mode: isWeightDetection,
					})
					console.log('Saved new recordId to backend:', newRecordId)
				} catch (error) {
					console.error('Error saving recordId to backend:', error.message)
				}
			}
			console.log('Response from detect_and_save endpoint: ', detectData)

			if (detectData.status === 'Data saved to Google Sheets' || detectData.status === 'Weight detected') {
				// Przygotowanie danych do synchronizacji
				const syncData = {
					link: detectData.data?.image_link || '',
					license_plate: detectData.data?.license_plate || '',
					weight: detectData.data?.weight || '',
					weight_image_link: detectData.data?.weight_image_link || '',
					marker_id: detectData.data?.markers?.[0] || '',
					record_id: recordId || detectData.data.record_id,
					is_new_record: detectData.data?.is_new_record || false,
				}

				console.log('Preparing to sync data: ', syncData)

				// Wywołanie sync_data
				const syncRes = await axios.post('http://192.168.0.139:8000/sync_data', syncData, {
					headers: {
						'Content-Type': 'application/json',
					},
				})

				console.log('Response from sync_data endpoint: ', syncRes.data)

				if (syncRes.data?.message?.includes('zaktualizowany')) {
					console.log('Rekord zaktualizowany, czyszczenie recordId...')
					await axios.post('http://192.168.0.139:8000/set_record_id', {
						record_id: null,
						is_processing: false,
						last_mode: isWeightDetection,
						timestamp_weight_detected: null,
					})
				} else if (syncRes.data?.message?.includes('dodany')) {
					console.log('Synchronizacja nie wymagana, dodano nowy rekord')
					await axios.post('http://192.168.0.139:8000/set_record_id', {
						record_id: syncRes.data.record_id,
						is_processing: false,
						last_mode: isWeightDetection,
					})
				}
			} else {
				console.warn('No data to sync.')

				const recordStateRes = await axios.get('http://192.168.0.139:8000/get_record_id')
				const { timestamp_weight_detected } = recordStateRes.data

				if (!timestamp_weight_detected) {
					console.log('Nie wykryto aktywnego timera, resetujemy recordId.')
					await axios.post('http://192.168.0.139:8000/set_record_id', {
						record_id: null,
						is_processing: false,
						last_mode: isWeightDetection,
						timestamp_weight_detected: null,
					})
				} else {
					console.log('Timer nadal aktywny, nie resetujemy recordId.')
				}
			}

			setResponse(detectData)
		} catch (error) {
			console.error('Error danalyzeImage: ', error.message, error.response ? error.response.data : null)
			setError('Error during marker detection')
			speakText('Wystąpił błąd podczas wykrywania markera.')
			setLoading(false)
		} finally {
			setLoading(false)
		}
	}

	const startCarDetectionLoop = async () => {
		if (!cameraRef.current || !isCameraInitialized || !cameraActive || isDetectionRunning) {
			console.log('Camera not initialized, active, or detection already running')
			return
		}

		isDetectionRunningRef.current = true
		setIsDetectionRunning(true)
		console.log('Starting car detection loop')
		while (isDetectionRunningRef.current) {
			try {
				if (!cameraRef.current || !cameraActive) {
					console.log('Camera reference is null or camera is not active, stopping detection loop')
					break
				}
				if (cameraRef.current) {
					const photo = await cameraRef.current.takePhoto({
						flash: 'off',
					})

					const selectedImage = `file://${photo.path}`
					setImage(selectedImage)

					await uploadImage(selectedImage)
				}
			} catch (error) {
				if (error.message.includes('Camera is closed')) {
					console.log('Camera was closed during detection loop, stopping gracefully')
					break // Wyjdź z pętli, jeśli kamera jest zamknięta
				}
				console.error('Error in detection loop: ', error)
			}
		}
	}

	const stopCarDetectionLoop = () => {
		isDetectionRunningRef.current = false
		setIsDetectionRunning(false)
		setCameraActive(false)
	}

	const processFrameDataJS = useRunOnJS(async base64Image => {
		if (isDetecting) return // Jeśli detekcja jest w toku, zakończ funkcję

		setIsDetecting(true) // Ustaw isDetecting na true
		setLoading(true)
		try {
			const selectedImage = `data:image/jpeg;base64,${base64Image}`
			setImage(selectedImage)

			// Pobranie rozmiarów obrazu
			Image.getSize(
				selectedImage,
				(imgWidth, imgHeight) => {
					setImageSize({ width: imgWidth, height: imgHeight })
				},
				error => {
					console.error('Błąd przy pobieraniu rozmiarów obrazu:', error)
				}
			)

			// Przygotowanie danych w formacie FormData
			let formData = new FormData()
			formData.append('file', {
				uri: selectedImage,
				name: 'realtime.jpg',
				type: 'image/jpeg',
			})

			// Wyślij dane do API

			console.log('ustawiony mode -' + detectionMode)
			const detectRes = await axios.post(`https://debogorze.pl/detect_objects?mode=${detectionMode}`, formData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
			})
			// Obsłuż odpowiedź API
			let detectionData = detectRes.data
			console.log('Detection Data ', JSON.stringify(detectionData))

			if (typeof detectionData === 'string') {
				detectionData = JSON.parse(detectionData) // Parsowanie JSON, jeśli konieczne
			}

			if (detectionData.length > 0) {
				setLoading(false)
				setObjectDetection([...detectionData])

				if (detectionMode === 'car' || detectionMode === 'microwave') {
					speakText('Wykryto obiekt. Analizuję obraz.')
					await analyzeImage(base64Image) // Analiza obrazu, jeśli są wykryte obiekty
				} else if (detectionMode === 'all') {
					await readDetectedObjects() // Czekaj na zakończenie mowy
				}
			} else {
				setObjectDetection([])
				speakText('Nie wykryto żadnych obiektów.')
			}
		} catch (error) {
			console.error('Error processFrameData: ', error.message, error.response ? error.response.data : null)
			setError('Error during marker detection')
			speakText('Wystąpił błąd podczas wykrywania markera.')
		} finally {
			setLoading(false) // Upewnij się, że ładowanie zostaje zatrzymane
			setIsDetecting(false)

			if (detectionMode === 'car') {
				setTimeout(() => {
					setCameraActive(true) // Ustaw cameraActive na true po określonym czasie
				}, 15000) // Opóźnienie 15 sekund
			}
		}
	})

	const frameProcessor = useFrameProcessor(async frame => {
		'worklet'

		// Region wycinania w procentach
		const cropRegion = {
			left: 0,
			top: 0,
			width: 100,
			height: 100, // Wytnij całą klatkę
		}

		const currentTime = Date.now()

		// Sprawdź, czy minęło 15 sekund od ostatniego wysłania i czy detekcja nie jest w toku
		if ((lastFrameSent.current === 0 || currentTime - lastFrameSent.current >= 15000) && !isDetecting) {
			// Aktualizuj czas wysłania klatki
			lastFrameSent.current = currentTime

			const result = crop(frame, {
				cropRegion,
				includeImageBase64: true, // Włącz Base64
				saveAsFile: false, // Nie zapisuj jako plik
			})

			// Przekaż Base64 do funkcji przetwarzania
			processFrameDataJS(result.base64)
		}
	}, [])

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

	const startCarDetection = async () => {
		if (cameraRef.current && !isSpeaking) {
			setLoading(true)
			await detectObjects() // Funkcja wykrywająca obiekty samochodowe
			setLoading(false)

			// Ustaw interwał dla trybu detekcji samochodów
			detectionIntervalRef.current = setInterval(
				async () => {
					if (!isSpeaking) {
						await detectObjects() // Wykrywaj obiekty samochodowe co kilka sekund
					}
				},
				Platform.OS === 'ios' ? 5000 : 7000
			)
		}
	}

	const detectObjects = async () => {
		if (cameraRef.current) {
			try {
				// Zatrzymaj interwał przed zrobieniem zdjęcia
				clearInterval(detectionIntervalRef.current)
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

				//https://debogorze.pl
				const detectRes = await axios.post(`https://debogorze.pl/detect_objects?mode=${detectionMode}`, formData, {
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
						speakText('Wykryto obiekt. Analizuję obraz.')
						analyzeImage() // Analiza obrazu, jeśli są wykryte obiekty
					}
					if (detectionMode === 'all') {
						await readDetectedObjects() // Czekaj na zakończenie mowy
					}
				} else {
					setObjectDetection([])
					speakText('Nie wykryto żadnych obiektów.')
				}
			} catch (error) {
				console.error('Error detectObjects: ', error.message, error.response ? error.response.data : null)
				setError('Error during marker detection')
				speakText('Wystąpił błąd podczas wykrywania markera.')
				setLoading(false)
			} finally {
				setLoading(false) // Upewnij się, że ładowanie zostaje zatrzymane
			}
		}
	}

	const readDetectedObjects = () => {
		return new Promise((resolve, reject) => {
			const limitedDetectionData = objectDetection.slice(0, 4)
			const objectNames = limitedDetectionData.map(obj => `${obj.name}`).join('. ')

			Speech.stop()
			setIsSpeaking(true) // Oznacz, że zaczynamy czytać

			speakText(objectNames, {
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
		if (carDetectionMode) {
			deactivateKeepAwake()
			setCarDetectionMode(false)
		}
		Speech.stop()
		clearInterval(detectionIntervalRef.current)
		stopCarDetectionLoop()
		setLoading(false)
		setTakePictureActive(false)
		setCameraActive(false)
		setImage(null)
		setResponse(null)
		setObjectDetection([])
		setError(null)
	}

	// Function to remove image and stop detection
	const removeImage = () => {
		Speech.stop()
		setImage(null)
		setResponse(null)
		setObjectDetection([])
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

	const scaleMarkerBox = corners => {
		if (!corners || corners.length < 4) return {} // Sprawdzanie, czy mamy wystarczająco dużo narożników
		if (!imageSize.width || !imageSize.height) return {} // Sprawdzanie poprawności rozmiarów obrazu

		// Obliczanie proporcji obrazu do widoku
		const imageAspectRatio = imageSize.width / imageSize.height
		const viewWidth = width - 40
		const viewHeight = viewWidth / imageAspectRatio // Przeskalowanie wysokości na podstawie szerokości obrazu

		// Obliczanie współczynników skalowania dla szerokości i wysokości
		const scaleX = viewWidth / imageSize.width
		const scaleY = viewHeight / imageSize.height

		// Pobieranie poszczególnych narożników
		const [topLeft, topRight, bottomRight, bottomLeft] = corners

		// Zwracanie przeskalowanej pozycji i rozmiarów markera
		return {
			left: topLeft[0] * scaleX,
			top: topLeft[1] * scaleY,
			width: (topRight[0] - topLeft[0]) * scaleX,
			height: (bottomLeft[1] - topLeft[1]) * scaleY,
		}
	}

	const speakText = text => {
		AccessibilityInfo.isScreenReaderEnabled().then(isScreenReaderEnabled => {
			if (isScreenReaderEnabled) {
				// Jeśli czytnik ekranu jest włączony, odczytaj tekst przez czytnik ekranu
				AccessibilityInfo.announceForAccessibility(text)
			} else {
				// Jeśli czytnik ekranu nie jest włączony, użyj Speech.speak
				Speech.speak(text)
			}
		})
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
					<Text style={styles.modeTitle}>Wybierz tryb:</Text>
					<View style={styles.modeSelector}>
						<TouchableOpacity
							style={[styles.modeButton, !isWeightDetection ? styles.selectedMode : styles.unselectedMode]}
							onPress={() => {
								setIsWeightDetection(false)
							}}
							disabled={loading}
							accessibilityRole='button'>
							<Text style={[styles.modeButtonText, !isWeightDetection && styles.selectedModeText]}>Markery</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modeButton, isWeightDetection ? styles.selectedMode : styles.unselectedMode]}
							onPress={() => {
								setIsWeightDetection(true)
							}}
							disabled={loading}
							accessibilityRole='button'>
							<Text style={[styles.modeButtonText, isWeightDetection && styles.selectedModeText]}>Waga</Text>
						</TouchableOpacity>
					</View>
					<Card style={styles.descriptionCard}>
						<Card.Content>
							<Text style={styles.descriptionText}>{getDescriptionText()}</Text>
						</Card.Content>
					</Card>
					<View style={styles.buttonContainer}>
						{detectionMode === 'car' && (
							<>
								{/* <Button
									mode='contained'
									onPress={() => {
										setCarCameraMode(false)
										pickImage()
										setCarDetectionMode(false)
									}}
									style={styles.button}
									icon='image'
									disabled={loading || cameraActive}
									accessibilityRole='button'
									labelStyle={{ color: 'white' }}>
									Wybierz z galerii
								</Button> */}
								<Button
									mode='contained'
									onPress={() => {
										if (image) {
											setImage(null)
										}
										setCarCameraMode(true)
										setTakePictureActive(true)
										setCarDetectionMode(false)
									}}
									style={styles.button}
									icon='camera'
									disabled={loading || cameraActive || takePictureActive}
									accessibilityRole='button'
									labelStyle={{ color: 'white' }}>
									Otwórz aparat
								</Button>
								<Button
									mode='contained'
									onPress={() => {
										if (image) {
											setImage(null)
										}
										setCarCameraMode(true)
										keepScreenAwake()
										setCarDetectionMode(true)
										setCameraActive(true)
									}}
									style={styles.button}
									icon='camera'
									disabled={loading || cameraActive || takePictureActive}
									accessibilityRole='button'
									labelStyle={{ color: 'white' }}>
									Tryb detekcji
								</Button>
							</>
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
								accessibilityRole='button'
								labelStyle={{ color: 'white' }}>
								Otwórz aparat
							</Button>
						)}
					</View>
					{takePictureActive && (
						<>
							<View>
								<VisonCamera
									style={[styles.camera, { position: 'relative' }]}
									ref={cameraRef}
									device={device}
									isActive={true}
									photo={true} // umożliwia robienie zdjęć
									onInitialized={() => console.log('Camera initialized')}></VisonCamera>
								<TouchableOpacity
									style={styles.closeButton}
									onPress={stopDetection}
									accessibilityLabel='Wyłącz aparat'
									accessibilityRole='button'
									disabled={loading}>
									<MaterialIcons name='close' size={24} color='white' />
								</TouchableOpacity>
								{/* Dodaj przycisk zrobienia zdjęcia */}
								<View style={styles.cameraButtonContainer}>
									<Pressable
										onPress={takePicture}
										style={styles.cameraIconButton}
										accessibilityLabel='Zrób zdjęcie'
										accessibilityRole='button'>
										<MaterialIcons name='camera' size={35} color='white' />
									</Pressable>
								</View>
							</View>
						</>
					)}
					{cameraActive ? (
						<>
							<View>
								{detectionMode === 'all' && (
									<VisonCamera
										style={[styles.camera, { position: 'relative' }]}
										ref={cameraRef}
										device={device}
										isActive={true}
										frameProcessor={frameProcessor}
										frameProcessorFps={5} // Ustawienie maksymalnego FPS dla przetwarzania klatek
										photo={false}></VisonCamera>
								)}
								{detectionMode === 'car' && (
									<CameraView
										key={`camera-${cameraActive}-${isCameraInitialized}`} // Dynamiczny klucz
										cameraRef={cameraRef}
										device={device}
										isActive={true}
										onInitialized={() => setIsCameraInitialized(true)}
									/>
								)}

								{objectDetection &&
									Platform.OS === 'ios' &&
									objectDetection.slice(0, detectionMode === 'all' ? 4 : 1).map((obj, index) => (
										<View key={index} style={[styles.box, scaleBox(obj.box)]}>
											<View style={styles.labelContainer}>
												<Text style={styles.label}>{obj.name}</Text>
											</View>
										</View>
									))}

								<TouchableOpacity
									style={styles.closeButton}
									onPress={stopDetection}
									accessibilityLabel='Wyłącz aparat'
									accessibilityRole='button'>
									<MaterialIcons name='close' size={24} color='white' />
								</TouchableOpacity>
							</View>
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
											(Platform.OS === 'ios' || imageSource !== 'camera') &&
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

							{detectionMode == 'car' && !carCameraMode && (
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
							{error && (
								<>
									{(detectionMode === 'microwave' || (detectionMode === 'car' && imageSource === 'camera')) && (
										<Button
											mode='contained'
											onPress={handleRetakePhoto}
											style={[styles.button, { marginVertical: 10 }]}
											icon='camera'
											disabled={loading || cameraActive || takePictureActive}
											importantForAccessibility={loading ? 'no-hide-descendants' : 'yes'}
											accessibilityElementsHidden={loading ? true : false}
											accessibilityRole='button'
											labelStyle={{ color: 'white' }}>
											Zrób zdjęcie ponownie
										</Button>
									)}
									<Text style={styles.errorText}>{error}</Text>
								</>
							)}
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
							{objectDetection.length > 0 ? (
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
					{response &&
						(response.data ||
							response.detectedText ||
							(response.detectedObjects && response.detectedObjects.length > 0)) && (
							<View style={styles.responseContainer}>
								{(detectionMode === 'microwave' ||
									(detectionMode === 'car' && imageSource === 'camera' && !carDetectionMode)) &&
									response && (
										<Button
											mode='contained'
											onPress={handleRetakePhoto}
											style={[styles.button, { marginBottom: 10 }]}
											icon='camera'
											disabled={loading || cameraActive || takePictureActive}
											importantForAccessibility={loading ? 'no-hide-descendants' : 'yes'}
											accessibilityElementsHidden={loading ? true : false}
											accessibilityRole='button'
											labelStyle={{ color: 'white' }}>
											Zrób zdjęcie ponownie
										</Button>
									)}
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
												{response?.detectedObjects && response.detectedObjects.length > 0 && (
													<View>
														{response.detectedObjects.map((detectedObject, index) => (
															<Text key={index} style={styles.responseText}>
																{detectedObject}
															</Text>
														))}
													</View>
												)}
											</View>
										)}

										{detectionMode === 'car' && (
											<>
												{response.data ? (
													<>
														{response.data.license_plate && (
															<Text style={styles.responseText}>
																Numer rejestracyjny: {response.data.license_plate}
															</Text>
														)}
														{response.data.weight && (
															<Text style={styles.responseText}>Waga: {response.data.weight}</Text>
														)}
														{response.data.markers && response.data.markers.length > 0 && (
															<Text style={styles.responseText}>Marker ID: {response.data.markers}</Text>
														)}
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
		fontSize: isSmallScreen ? 13 : 16, // Zmniejsz czcionkę dla mniejszych ekranów
	},
	selectedMode: {
		backgroundColor: '#4682B4',
	},
	unselectedMode: {
		borderWidth: 2,
		borderColor: '#4682B4',
	},
	selectedModeText: { color: 'white' },
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
		marginVertical: 10,
		backgroundColor: '#f0f0f0',
		color: '#333',
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
		width: width - 40, // Szerokość kamery
		height: ((width - 40) * 3.5) / 3, // Wysokość kamery z zachowaniem proporcji
		borderRadius: 15,
		overflow: 'hidden',
		alignSelf: 'center', // Wyśrodkuj kamerę w kontenerze
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
		zIndex: 100,
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
		zIndex: 100,
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
	closeButton: {
		position: 'absolute',
		top: 10,
		right: 10,
		backgroundColor: 'rgba(255, 0, 0, 0.7)',
		padding: 5,
		borderRadius: 15,
		zIndex: 10, // Upewnij się, że przycisk jest nad kamerą
	},
	cameraButtonContainer: {
		position: 'absolute',
		bottom: 20,
		alignSelf: 'center',
		zIndex: 10, // Nad kamerą
	},
	cameraIconButton: {
		backgroundColor: 'rgba(0,0,0,0.5)',
		borderRadius: 25,
		padding: 10,
	},
})

import axios from 'axios'
import logger from './logger'
import { API_URL } from '../../config'

const apiClient = axios.create({
	baseURL: API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
})

const detectAndSave = async payload => {
	try {
		const response = await apiClient.post('/detect_and_save', payload)
		return response.data
	} catch (error) {
		logger.error('SIEC', 'Żądanie /detect_and_save nieudane', { blad: error?.message || error })
		throw error
	}
}

const getWaitingRecord = async () => {
	try {
		const response = await apiClient.get('/record/waiting')
		return response.data
	} catch (error) {
		logger.error('SIEC', 'Żądanie /record/waiting nieudane', { blad: error?.message || error })
		throw error
	}
}

const saveTestPhoto = async (base64Image, isWeightDetection) => {
	try {
		const payload = {
			image: `data:image/jpeg;base64,${base64Image}`,
			isWeightDetection: isWeightDetection,
		}
		const response = await apiClient.post('/save_test_photo', payload)
		logger.debug('ZDJECIE', 'Wysłano klatkę kontrolną')
		return response.data
	} catch (error) {
		logger.error('SIEC', 'Żądanie /save_test_photo nieudane', { blad: error?.message || error })
	}
}

export default {
	detectAndSave,
	getWaitingRecord,
	saveTestPhoto,
}

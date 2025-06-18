import axios from 'axios'

const API_URL = 'http://192.168.0.139:8000'
//const API_URL = 'https://debogorze.pl'

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
		console.error('API call /detect_and_save failed:', error)
		throw error
	}
}

const getWaitingRecord = async () => {
	try {
		const response = await apiClient.get('/record/waiting')
		return response.data
	} catch (error) {
		console.error('API call /record/waiting failed:', error)
		throw error
	}
}

export default {
	detectAndSave,
	getWaitingRecord,
}

export const BUILD_MODE = {
	TEST: 'test', // Tryb deweloperski, pozwala na przełączanie między Wagą a Markerem
	WEIGHT_ONLY: 'weight_only', // Aplikacja działa wyłącznie jako kamera do wagi
	MARKER_ONLY: 'marker_only', // Aplikacja działa wyłącznie jako kamera do markera
}

export const CURRENT_BUILD_MODE = BUILD_MODE.TEST

export const API_URL = 'http://192.168.0.139:8000'
//export const API_URL = 'https://debogorze.pl'

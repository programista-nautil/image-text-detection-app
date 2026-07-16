export const BUILD_MODE = {
	TEST: 'test', // Tryb deweloperski, pozwala na przełączanie między Wagą a Markerem
	WEIGHT_ONLY: 'weight_only', // Aplikacja działa wyłącznie jako kamera do wagi
	MARKER_ONLY: 'marker_only', // Aplikacja działa wyłącznie jako kamera do markera
}

export const CURRENT_BUILD_MODE = BUILD_MODE.TEST

// Produkcja (backend na VPS, HTTPS). Do testów na LAN podmień na adres swojego
// komputera z `ipconfig`, np. 'http://192.168.1.2:8000' (musi być ta sama sieć Wi-Fi).
export const API_URL = 'https://zwirownia.nautil.pl'

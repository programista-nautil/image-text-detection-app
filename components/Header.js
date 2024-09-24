import React from 'react'
import { Appbar } from 'react-native-paper'
import { StyleSheet } from 'react-native'

const Header = () => {
	return (
		<Appbar.Header style={styles.header}>
			<Appbar.Content title='Analiza zdjęcia' titleStyle={styles.headerTitle} />
		</Appbar.Header>
	)
}

const styles = StyleSheet.create({
	header: {
		backgroundColor: '#4682B4', // Updated color
		elevation: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
	},
	headerTitle: {
		color: 'white',
		fontSize: 22, // Increased font size for header title
		fontWeight: 'bold', // Bold header title
	},
})

export default Header

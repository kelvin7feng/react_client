/*
 * @Descripttion: 
 * @Author: kkfeng@tencent.com
 * @version: 1.0
 * @Date: 2025-04-17 08:46:09
 * @LastEditors: kkfeng@tencent.com
 */
import { Text, View, StyleSheet } from 'react-native';

export default function SelectionScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Selection screen</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: 'black',
    },
});

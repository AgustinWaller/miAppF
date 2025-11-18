import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function Table({ columns = [], data = [] }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.row, styles.headerRow]}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.cell, { width: col.width || 80 }]}>
                <Text style={styles.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>

          {data.map((item, idx) => (
            <View key={idx} style={[styles.row, idx % 2 === 0 ? styles.even : styles.odd]}>
              {columns.map((col) => (
                <View key={col.key} style={[styles.cell, { width: col.width || 80 }]}>
                  <Text style={styles.cellText} numberOfLines={1}>{String(item[col.key])}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  headerRow: { backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  cell: { paddingVertical: 10, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: '#eee' },
  headerText: { fontWeight: '700' },
  cellText: { fontSize: 14 },
  even: { backgroundColor: '#fff' },
  odd: { backgroundColor: '#fafafa' }
});
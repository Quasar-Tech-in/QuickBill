import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const dummyParties = [
  { id: '1', name: 'Aarav Sharma', phone: '+91 98765 43210', type: 'Customer', due: 417.0 },
  { id: '2', name: 'Pooja Verma', phone: '+91 98123 45678', type: 'Customer', due: 150.0 },
  { id: '3', name: 'Herbal Naturals Supplier', phone: '+91 99887 76655', type: 'Supplier', payable: 12500.0 }
];

export const PartiesScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <FlatList
        data={dummyParties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone}>{item.phone} • {item.type}</Text>
            </View>
            <View style={styles.balanceCol}>
              {item.due ? (
                <>
                  <Text style={styles.balanceLabel}>Receivable</Text>
                  <Text style={[styles.balanceVal, { color: colors.danger[700] }]}>₹ {item.due.toFixed(2)}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.balanceLabel}>Payable</Text>
                  <Text style={[styles.balanceVal, { color: colors.warning[700] }]}>₹ {item.payable?.toFixed(2)}</Text>
                </>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  list: { padding: 16 },
  card: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface.card, padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.surface.border },
  name: { fontSize: 14, fontWeight: '700', color: colors.neutral[900] },
  phone: { fontSize: 12, color: colors.neutral[400], marginTop: 2 },
  balanceCol: { alignItems: 'flex-end', justifyContent: 'center' },
  balanceLabel: { fontSize: 11, color: colors.neutral[400] },
  balanceVal: { fontSize: 14, fontWeight: '800' },
});

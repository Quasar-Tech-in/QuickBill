import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const dummyTransactions = [
  { id: '1', invoiceNumber: 'INV-2026-000142', partyName: 'Aarav Sharma', amount: 917.0, status: 'PAID', type: 'SALE', time: '10:15 AM' },
  { id: '2', invoiceNumber: 'INV-2026-000141', partyName: 'Pooja Verma', amount: 450.0, status: 'PARTIAL', type: 'SALE', time: '09:40 AM' },
  { id: '3', invoiceNumber: 'PAY-2026-000088', partyName: 'Herbal Naturals Supplier', amount: 5000.0, status: 'PAID', type: 'PAYMENT_OUT', time: 'Yesterday' },
  { id: '4', invoiceNumber: 'EXP-2026-000012', partyName: 'Electricity Bill', amount: 1200.0, status: 'PAID', type: 'EXPENSE', time: '19-Sep' }
];

export const TransactionsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <FlatList
        data={dummyTransactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.left}>
              <Text style={styles.invNumber}>{item.invoiceNumber}</Text>
              <Text style={styles.party}>{item.partyName}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>₹ {item.amount.toFixed(2)}</Text>
              <View style={[
                styles.badge,
                { backgroundColor: item.status === 'PAID' ? colors.success[50] : colors.warning[50] }
              ]}>
                <Text style={[
                  styles.badgeText,
                  { color: item.status === 'PAID' ? colors.success[700] : colors.warning[700] }
                ]}>
                  {item.status}
                </Text>
              </View>
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
  left: { flex: 1 },
  invNumber: { fontSize: 14, fontWeight: '700', color: colors.neutral[900] },
  party: { fontSize: 13, color: colors.neutral[600], marginTop: 2 },
  time: { fontSize: 11, color: colors.neutral[400], marginTop: 4 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '800', color: colors.neutral[900] },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

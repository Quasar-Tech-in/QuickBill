import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const dummyItems = [
  { id: '1', name: 'Organic Almond Milk 1L', sku: 'ALM-1001', stock: 45, price: 240.0, tax: 5.0, status: 'IN_STOCK' },
  { id: '2', name: 'Lavender Body Wash 250ml', sku: 'BW-2002', stock: 12, price: 350.0, tax: 18.0, status: 'IN_STOCK' },
  { id: '3', name: 'Herbal Shampoo 200ml', sku: 'HS-3003', stock: 2, price: 180.0, tax: 18.0, status: 'LOW_STOCK' },
  { id: '4', name: 'Rose Water Toner 100ml', sku: 'RW-4004', stock: 0, price: 120.0, tax: 12.0, status: 'OUT_OF_STOCK' },
];

export const ItemsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <FlatList
        data={dummyItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sku}>SKU: {item.sku} • GST: {item.tax}%</Text>
              <Text style={styles.price}>₹ {item.price.toFixed(2)}</Text>
            </View>

            <View style={styles.stockCol}>
              <Text style={styles.stockNum}>{item.stock} pcs</Text>
              <View style={[
                styles.badge,
                {
                  backgroundColor:
                    item.status === 'IN_STOCK' ? colors.success[50] :
                    item.status === 'LOW_STOCK' ? colors.warning[50] : colors.danger[50]
                }
              ]}>
                <Text style={[
                  styles.badgeText,
                  {
                    color:
                      item.status === 'IN_STOCK' ? colors.success[700] :
                      item.status === 'LOW_STOCK' ? colors.warning[700] : colors.danger[700]
                  }
                ]}>
                  {item.status.replace('_', ' ')}
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
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: colors.neutral[900] },
  sku: { fontSize: 12, color: colors.neutral[400], marginTop: 2 },
  price: { fontSize: 14, fontWeight: '800', color: colors.primary[500], marginTop: 4 },
  stockCol: { alignItems: 'flex-end', justifyContent: 'center' },
  stockNum: { fontSize: 14, fontWeight: '700', color: colors.neutral[900], marginBottom: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

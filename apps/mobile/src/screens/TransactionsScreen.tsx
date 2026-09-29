import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Invoice, Business } from '../types';
import { shareInvoiceOnWhatsApp } from '../utils/shareInvoice';
import { printThermalReceipt, printA4Invoice } from '../utils/printInvoice';

export const TransactionsScreen: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setInvoices(store.getInvoices());
      setBusiness(store.getBusinessProfile());
    });
    return () => { unsubscribe(); };
  }, []);

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      inv.invoiceNumber.toLowerCase().includes(q) || 
      (inv.partyName && inv.partyName.toLowerCase().includes(q)) || 
      (inv.partyPhone && inv.partyPhone.includes(q));
  });

  const handleShareWhatsApp = async (inv: Invoice) => {
    setIsSharing(true);
    try {
      await shareInvoiceOnWhatsApp({
        invoice: inv,
        business,
        format: 'A4',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrintThermal = async (inv: Invoice) => {
    setIsPrinting(true);
    try {
      await printThermalReceipt(inv, business);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print thermal receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintA4 = async (inv: Invoice) => {
    setIsPrinting(true);
    try {
      await printA4Invoice(inv, business);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print A4 invoice.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search by Invoice #, customer, phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Invoice List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <TouchableOpacity 
              style={styles.invoiceCard}
              onPress={() => setSelectedInvoice(item)}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                  <Text style={styles.customerName}>👤 {item.partyName || 'Counter Customer'}</Text>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.grandTotalText}>₹ {item.grandTotal.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, item.status === 'PAID' ? styles.statusPaid : styles.statusPartial]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>{dateStr} • {item.paymentMode}</Text>
                <View style={styles.quickActions}>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handleShareWhatsApp(item)}
                  >
                    <Text style={styles.actionBtnText}>💬 WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handlePrintThermal(item)}
                  >
                    <Text style={styles.actionBtnText}>🖨️ Thermal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.detailTitle}>{selectedInvoice.invoiceNumber}</Text>
                  <Text style={styles.detailSub}>{selectedInvoice.partyName || 'Counter Customer'} • {selectedInvoice.partyPhone || 'No Phone'}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedInvoice(null)}>
                  <Text style={styles.closeDetail}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                <Text style={styles.sectionHeading}>Items Billed ({selectedInvoice.items.length})</Text>
                {selectedInvoice.items.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itName}>{it.name}</Text>
                      <Text style={styles.itSub}>{it.quantity} {it.unit} @ ₹{it.unitPrice.toFixed(2)} (GST {it.taxRate}%)</Text>
                    </View>
                    <Text style={styles.itTotal}>₹ {it.total.toFixed(2)}</Text>
                  </View>
                ))}

                <View style={styles.totalsBox}>
                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Subtotal:</Text>
                    <Text style={styles.totVal}>₹{selectedInvoice.subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Tax Total (GST):</Text>
                    <Text style={styles.totVal}>₹{selectedInvoice.taxTotal.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.totRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: colors.neutral[200], paddingTop: 6 }]}>
                    <Text style={[styles.totLabel, { fontWeight: '800', color: colors.neutral[900] }]}>Grand Total:</Text>
                    <Text style={[styles.totVal, { fontWeight: '900', color: colors.primary[700], fontSize: 16 }]}>
                      ₹{selectedInvoice.grandTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.detailActions}>
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => handleShareWhatsApp(selectedInvoice)}
                  disabled={isSharing}
                >
                  <Text style={styles.modalActionText}>💬 WhatsApp PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: colors.neutral[800] }]}
                  onPress={() => handlePrintThermal(selectedInvoice)}
                  disabled={isPrinting}
                >
                  <Text style={styles.modalActionText}>🖨️ Thermal POS</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: colors.primary[600] }]}
                  onPress={() => handlePrintA4(selectedInvoice)}
                  disabled={isPrinting}
                >
                  <Text style={styles.modalActionText}>📄 A4 Tax PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  searchBar: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  customerName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  grandTotalText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary[600],
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusPaid: {
    backgroundColor: colors.success[50],
  },
  statusPartial: {
    backgroundColor: colors.warning[50],
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success[700],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  dateText: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  detailSub: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
  },
  closeDetail: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[600],
    padding: 4,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  itName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  itSub: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  itTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  totalsBox: {
    backgroundColor: colors.neutral[50],
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  totRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  totLabel: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  totVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
});

import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';
import {
  activateCard,
  blockCard,
  deactivateCard,
  getCards,
  registerCard,
  reportLostCard,
  type CardSummary,
} from '@/features/passenger/services/passengerApi';

export default function CardsScreen() {
  const insets = useSafeAreaInsets();

  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Register Card Modal
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [cardUidInput, setCardUidInput] = useState('');
  const [cardLabelInput, setCardLabelInput] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const loadCards = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getCards();
      if (res.ok && res.data) {
        setCards(res.data.cards || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleRegisterSubmit = async () => {
    if (!cardUidInput.trim()) {
      setRegisterError('Card UID is required (e.g. NFC-8472918).');
      return;
    }

    setRegisterError(null);
    setRegistering(true);

    try {
      const res = await registerCard(cardUidInput.trim(), cardLabelInput.trim() || undefined);
      if (res.ok) {
        setCardUidInput('');
        setCardLabelInput('');
        setRegisterModalVisible(false);
        await loadCards(true);
      } else {
        setRegisterError(res.message || 'Unable to register card.');
      }
    } catch {
      setRegisterError('Network failure. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCardAction = async (cardId: number, action: 'activate' | 'deactivate' | 'block' | 'report-lost') => {
    setActionLoadingId(cardId);
    try {
      let res;
      if (action === 'activate') res = await activateCard(cardId);
      else if (action === 'deactivate') res = await deactivateCard(cardId);
      else if (action === 'block') res = await blockCard(cardId);
      else if (action === 'report-lost') res = await reportLostCard(cardId);

      if (res?.ok) {
        await loadCards(true);
      } else {
        Alert.alert('Action Failed', res?.message || 'Could not complete action.');
      }
    } catch {
      Alert.alert('Error', 'Connection error performing card action.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tap &amp; Pay Cards</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRegisterModalVisible(true)}
          style={styles.addCardButton}
        >
          <SymbolView
            name={{ ios: 'plus', android: 'add', web: 'add' }}
            size={20}
            tintColor={Brand.white}
          />
          <Text style={styles.addCardButtonText}>Link Card</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadCards(true)} tintColor={Brand.teal.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Loading registered NFC cards...</Text>
          </View>
        ) : cards.length > 0 ? (
          <View style={styles.cardsContainer}>
            {cards.map((card) => {
              const isActive = card.status === 'active';
              const isBlocked = card.status === 'blocked';
              const isBusy = actionLoadingId === card.id;

              return (
                <View key={card.id} style={styles.cardItem}>
                  {/* Digital Physical Card Design */}
                  <View style={[styles.nfcCardVisual, isActive ? styles.nfcCardActive : styles.nfcCardInactive]}>
                    <View style={styles.cardVisualTop}>
                      <View style={styles.chipGraphic} />
                      <SymbolView
                        name={{ ios: 'wave.3.right', android: 'nfc', web: 'nfc' }}
                        size={28}
                        tintColor={Brand.white}
                      />
                    </View>

                    <Text style={styles.cardVisualNumber}>
                      {card.last_four ? `••••  ••••  ••••  ${card.last_four}` : card.uid}
                    </Text>

                    <View style={styles.cardVisualBottom}>
                      <View>
                        <Text style={styles.cardVisualLabelSmall}>CARD LABEL</Text>
                        <Text style={styles.cardVisualName}>{card.label || 'Tap & Pay Transit'}</Text>
                      </View>
                      <View style={styles.visualBadge}>
                        <Text style={styles.visualBadgeText}>{card.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Card Controls */}
                  <View style={styles.cardControls}>
                    <Pressable
                      onPress={() => router.push('/passenger/qr' as any)}
                      style={[styles.controlBtn, { backgroundColor: 'rgba(20, 184, 166, 0.08)' }]}
                    >
                      <SymbolView
                        name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                        size={18}
                        tintColor={Brand.teal.primary}
                      />
                      <Text style={[styles.controlBtnText, { color: Brand.teal.primary, fontWeight: '700' }]}>
                        Show QR
                      </Text>
                    </Pressable>
                    {isActive ? (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => handleCardAction(card.id, 'deactivate')}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'pause.circle.fill', android: 'pause_circle', web: 'pause_circle' }}
                          size={18}
                          tintColor="#475569"
                        />
                        <Text style={styles.controlBtnText}>Deactivate</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        disabled={isBusy || isBlocked}
                        onPress={() => handleCardAction(card.id, 'activate')}
                        style={[styles.controlBtn, isBlocked && styles.controlBtnDisabled]}
                      >
                        <SymbolView
                          name={{ ios: 'play.circle.fill', android: 'play_circle', web: 'play_circle' }}
                          size={18}
                          tintColor={isBlocked ? '#94A3B8' : '#16A34A'}
                        />
                        <Text style={[styles.controlBtnText, !isBlocked && { color: '#16A34A' }]}>
                          Activate
                        </Text>
                      </Pressable>
                    )}

                    {!isBlocked && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => {
                          Alert.alert(
                            'Block Card',
                            'Are you sure you want to block this card from transit tap and payments?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Block', style: 'destructive', onPress: () => handleCardAction(card.id, 'block') },
                            ],
                          );
                        }}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                          size={18}
                          tintColor="#DC2626"
                        />
                        <Text style={[styles.controlBtnText, { color: '#DC2626' }]}>Block</Text>
                      </Pressable>
                    )}

                    {!isBlocked && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => {
                          Alert.alert(
                            'Report Lost',
                            'Report this card as lost or stolen? It will be immediately revoked from validators.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Report Lost', style: 'destructive', onPress: () => handleCardAction(card.id, 'report-lost') },
                            ],
                          );
                        }}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                          size={18}
                          tintColor="#D97706"
                        />
                        <Text style={[styles.controlBtnText, { color: '#D97706' }]}>Report Lost</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCardBox}>
            <SymbolView
              name={{ ios: 'creditcard', android: 'credit_card', web: 'credit_card' }}
              size={48}
              tintColor={Brand.textSecondary}
            />
            <Text style={styles.emptyTitle}>No Transit Cards Linked</Text>
            <Text style={styles.emptySubtitle}>
              Link an RFID or NFC travel card to board buses without touching cash or paper tickets.
            </Text>
            <PrimaryButton
              title="Link NFC Card Now"
              onPress={() => setRegisterModalVisible(true)}
              style={styles.emptyAction}
            />
          </View>
        )}
      </ScrollView>

      {/* Link / Register Card Modal */}
      <Modal visible={registerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link New Travel Card</Text>
              <Pressable onPress={() => setRegisterModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Card Serial / NFC UID</Text>
                <TextInput
                  style={styles.input}
                  value={cardUidInput}
                  onChangeText={(val) => {
                    setCardUidInput(val);
                    setRegisterError(null);
                  }}
                  placeholder="e.g. 04:A2:3B:18:7C"
                  placeholderTextColor={Brand.textSecondary}
                  autoCapitalize="characters"
                />
                <Text style={styles.fieldHelp}>
                  The unique hardware UID printed on your Tap &amp; Pay card or emitted by NFC.
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Custom Label (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={cardLabelInput}
                  onChangeText={setCardLabelInput}
                  placeholder="e.g. Daily Commute Card"
                  placeholderTextColor={Brand.textSecondary}
                />
              </View>

              {registerError && <Text style={styles.errorText}>{registerError}</Text>}

              <PrimaryButton
                title={registering ? 'Registering...' : 'Register Card'}
                onPress={handleRegisterSubmit}
                disabled={registering}
                style={styles.submitButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Brand.teal.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addCardButtonText: {
    color: Brand.white,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  cardsContainer: {
    gap: Spacing.four,
  },
  cardItem: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: Spacing.three,
  },
  nfcCardVisual: {
    height: 180,
    borderRadius: 16,
    padding: Spacing.four,
    justifyContent: 'space-between',
  },
  nfcCardActive: {
    backgroundColor: '#0F172A',
  },
  nfcCardInactive: {
    backgroundColor: '#475569',
  },
  cardVisualTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipGraphic: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
  },
  cardVisualNumber: {
    fontSize: 20,
    letterSpacing: 2,
    color: Brand.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  cardVisualBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardVisualLabelSmall: {
    fontSize: 9,
    letterSpacing: 1,
    color: '#94A3B8',
    fontWeight: '700',
  },
  cardVisualName: {
    fontSize: 14,
    color: Brand.white,
    fontWeight: '600',
    marginTop: 2,
  },
  visualBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  visualBadgeText: {
    color: Brand.white,
    fontSize: 11,
    fontWeight: '700',
  },
  cardControls: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  controlBtnDisabled: {
    opacity: 0.5,
  },
  controlBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  emptyCardBox: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAction: {
    width: '100%',
    marginTop: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.text,
  },
  fieldHelp: {
    fontSize: 11,
    color: Brand.textSecondary,
  },
  input: {
    backgroundColor: Brand.inputBackground,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 15,
    color: Brand.text,
  },
  errorText: {
    fontSize: 13,
    color: Brand.error,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: Spacing.two,
  },
});

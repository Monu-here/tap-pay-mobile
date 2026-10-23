import {AppText, AppTextInput } from '@/components/typography/app-text';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Monochrome, Spacing } from '@/constants/theme';
import {
  activateCard,
  blockCard,
  deactivateCard,
  getCards,
  registerCard,
  reportLostCard,
  type BlockCardPayload,
  type CardSummary,
} from '@/features/passenger/services/passengerApi';

type ReasonOption = {
  code: BlockCardPayload['reason_code'];
  label: string;
  desc: string;
};

const BLOCK_REASONS: ReasonOption[] = [
  { code: 'lost', label: 'Card Lost', desc: 'Misplaced or can no longer find the card' },
  { code: 'stolen', label: 'Card Stolen', desc: 'Card was taken or stolen by someone else' },
  { code: 'suspicious', label: 'Suspicious Activity', desc: 'Unusual or unauthorized transit charges' },
  { code: 'damaged', label: 'Card Damaged', desc: 'Hardware chip cracked or no longer reading' },
  { code: 'temporary', label: 'Temporarily Block', desc: 'Pause usage while not travelling' },
  { code: 'other', label: 'Other Reason', desc: 'Specify your own reason' },
];

function getReasonLabel(code?: string | null, fallbackReason?: string | null): string {
  if (!code && !fallbackReason) return 'Temporarily Blocked';
  const found = BLOCK_REASONS.find((r) => r.code === code);
  if (found) return found.label;
  if (fallbackReason) return fallbackReason;
  return code ? code.replace(/_/g, ' ').toUpperCase() : 'Blocked';
}

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

  // Block Card Modal with Reason
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [cardToBlock, setCardToBlock] = useState<CardSummary | null>(null);
  const [selectedReasonCode, setSelectedReasonCode] = useState<BlockCardPayload['reason_code']>('temporary');
  const [reasonDetailsInput, setReasonDetailsInput] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);

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
    const frame = requestAnimationFrame(() => {
      void loadCards();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadCards]);

  const handleRegisterSubmit = async () => {
    if (!cardUidInput.trim()) {
      setRegisterError('Card UID is required.');
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

  const handleOpenBlockModal = (card: CardSummary) => {
    setCardToBlock(card);
    setSelectedReasonCode('temporary');
    setReasonDetailsInput('');
    setBlockError(null);
    setBlockModalVisible(true);
  };

  const handleConfirmBlockSubmit = async () => {
    if (!cardToBlock) return;

    if (selectedReasonCode === 'other' && !reasonDetailsInput.trim()) {
      setBlockError('Please provide an explanation for choosing "Other Reason".');
      return;
    }

    setBlockError(null);
    setBlocking(true);

    try {
      const res = await blockCard(cardToBlock.id, {
        reason_code: selectedReasonCode,
        reason_details: reasonDetailsInput.trim() || undefined,
      });

      if (res.ok) {
        setBlockModalVisible(false);
        setCardToBlock(null);
        await loadCards(true);
        Alert.alert('Card Blocked', 'Your card has been blocked from transit taps and payments.');
      } else {
        setBlockError(res.message || 'Could not block card. Please try again.');
      }
    } catch {
      setBlockError('Connection error while contacting server. Please retry.');
    } finally {
      setBlocking(false);
    }
  };

  const handleCardAction = async (cardId: number, action: 'activate' | 'deactivate' | 'report-lost') => {
    setActionLoadingId(cardId);
    try {
      let res;
      if (action === 'activate') res = await activateCard(cardId);
      else if (action === 'deactivate') res = await deactivateCard(cardId);
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
        <AppText style={styles.headerTitle}>Transit Cards</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRegisterModalVisible(true)}
          style={styles.addCardButton}
        >
          <SymbolView
            name={{ ios: 'plus', android: 'add', web: 'add' }}
            size={16}
            tintColor={Monochrome.actionPrimaryText}
          />
          <AppText style={styles.addCardButtonText}>Link Card</AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCards(true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Loading registered transit cards...</AppText>
          </View>
        ) : cards.length > 0 ? (
          <View style={styles.cardsContainer}>
            {cards.map((card) => {
              const isActive = card.status === 'active';
              const isBlocked = card.status === 'blocked';
              const isBusy = actionLoadingId === card.id;
              const displaySerial =
                card.masked_code ||
                (card.last_four ? `•••• •••• •••• ${card.last_four}` : card.card_uid || card.uid || 'TRANSIT CARD');

              return (
                <View key={card.id} style={styles.cardItem}>
                  {/* Digital Physical Card Design */}
                  <View
                    style={[
                      styles.nfcCardVisual,
                      isBlocked
                        ? styles.nfcCardBlocked
                        : isActive
                        ? styles.nfcCardActive
                        : styles.nfcCardInactive,
                    ]}
                  >
                    <View style={styles.cardVisualTop}>
                      <View style={[styles.chipGraphic, isBlocked && styles.chipGraphicBlocked]} />
                      <SymbolView
                        name={{
                          ios: isBlocked ? 'lock.fill' : 'wave.3.right',
                          android: isBlocked ? 'lock' : 'nfc',
                          web: isBlocked ? 'lock' : 'nfc',
                        }}
                        size={24}
                        tintColor={Monochrome.textPrimary}
                      />
                    </View>

                    <AppText style={styles.cardVisualNumber}>{displaySerial}</AppText>

                    <View style={styles.cardVisualBottom}>
                      <View>
                        <AppText style={styles.cardVisualLabelSmall}>CARD LABEL</AppText>
                        <AppText style={styles.cardVisualName}>{card.label || 'Tap & Pay Transit'}</AppText>
                      </View>
                      <View style={[styles.visualBadge, isBlocked && styles.visualBadgeBlocked]}>
                        <AppText style={styles.visualBadgeText}>{card.status.toUpperCase()}</AppText>
                      </View>
                    </View>
                  </View>

                  {/* Blocked Information Banner */}
                  {isBlocked && (
                    <View style={styles.blockedBanner}>
                      <View style={styles.blockedBannerHeader}>
                        <SymbolView
                          name={{ ios: 'lock.slash.fill', android: 'lock', web: 'lock' }}
                          size={16}
                          tintColor={Monochrome.textPrimary}
                        />
                        <AppText style={styles.blockedBannerTitle}>Card Blocked</AppText>
                      </View>
                      <View style={styles.blockedReasonRow}>
                        <AppText style={styles.blockedReasonKey}>Reason:</AppText>
                        <AppText style={styles.blockedReasonVal}>
                          {getReasonLabel(card.blocked_reason_code, card.status_reason)}
                        </AppText>
                      </View>
                      {Boolean(card.blocked_reason_details) && (
                        <View style={styles.blockedDetailsBox}>
                          <AppText style={styles.blockedDetailsText}>&quot;{card.blocked_reason_details}&quot;</AppText>
                        </View>
                      )}
                      {Boolean(card.blocked_at) && (
                        <AppText style={styles.blockedDateText}>
                          Blocked on: {new Date(card.blocked_at!).toLocaleString()}
                        </AppText>
                      )}
                      <AppText style={styles.blockedHelperText}>
                        This card is disabled from transit taps and fare payments. To unblock this card, please contact an authorized transit operator or admin.
                      </AppText>
                    </View>
                  )}

                  {/* Card Controls */}
                  <View style={styles.cardControls}>
                    {!isBlocked && (
                      <Pressable
                        onPress={() => router.push('/passenger/qr' as any)}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                          size={16}
                          tintColor={Monochrome.textPrimary}
                        />
                        <AppText style={styles.controlBtnText}>Show QR</AppText>
                      </Pressable>
                    )}

                    {isActive && !isBlocked && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => handleCardAction(card.id, 'deactivate')}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'pause.circle.fill', android: 'pause_circle', web: 'pause_circle' }}
                          size={16}
                          tintColor={Monochrome.textSecondary}
                        />
                        <AppText style={styles.controlBtnText}>Deactivate</AppText>
                      </Pressable>
                    )}

                    {!isActive && !isBlocked && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => handleCardAction(card.id, 'activate')}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'play.circle.fill', android: 'play_circle', web: 'play_circle' }}
                          size={16}
                          tintColor={Monochrome.textPrimary}
                        />
                        <AppText style={styles.controlBtnText}>Activate</AppText>
                      </Pressable>
                    )}

                    {!isBlocked && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => handleOpenBlockModal(card)}
                        style={styles.controlBtn}
                      >
                        <SymbolView
                          name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                          size={16}
                          tintColor={Monochrome.textSecondary}
                        />
                        <AppText style={styles.controlBtnText}>Block</AppText>
                      </Pressable>
                    )}

                    {!isBlocked && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => {
                          Alert.alert(
                            'Report Lost Card',
                            'Are you sure you want to report this card as lost? It will be marked lost and revoked from validators.',
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
                          size={16}
                          tintColor={Monochrome.textMuted}
                        />
                        <AppText style={styles.controlBtnText}>Report Lost</AppText>
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
              size={40}
              tintColor={Monochrome.textMuted}
            />
            <AppText style={styles.emptyTitle}>No Transit Cards Linked</AppText>
            <AppText style={styles.emptySubtitle}>
              Link an eligible Tap &amp; Pay transit card to your wallet.
            </AppText>
            <PrimaryButton
              title="Link Transit Card"
              onPress={() => setRegisterModalVisible(true)}
              style={styles.emptyAction}
            />
          </View>
        )}
      </ScrollView>

      {/* Block Card Modal with Reason */}
      <Modal visible={blockModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <AppText style={styles.modalTitle}>Block Transit Card</AppText>
                <AppText style={styles.modalSubtitle}>
                  {cardToBlock?.masked_code ||
                    (cardToBlock?.last_four
                      ? `Card ending in ${cardToBlock.last_four}`
                      : cardToBlock?.card_uid || cardToBlock?.uid || 'Selected Card')}
                </AppText>
              </View>
              <Pressable
                disabled={blocking}
                onPress={() => {
                  if (!blocking) {
                    setBlockModalVisible(false);
                    setCardToBlock(null);
                  }
                }}
                hitSlop={8}
              >
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={22}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>

            <ScrollView style={styles.blockModalBody} showsVerticalScrollIndicator={false}>
              <AppText style={styles.reasonSectionLabel}>Select reason for blocking:</AppText>

              <View style={styles.reasonsList}>
                {BLOCK_REASONS.map((reason) => {
                  const isSelected = selectedReasonCode === reason.code;
                  return (
                    <Pressable
                      key={reason.code}
                      disabled={blocking}
                      onPress={() => {
                        setSelectedReasonCode(reason.code);
                        setBlockError(null);
                      }}
                      style={[styles.reasonCard, isSelected && styles.reasonCardSelected]}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.reasonTextWrap}>
                        <AppText style={[styles.reasonLabelText, isSelected && styles.reasonLabelTextSelected]}>
                          {reason.label}
                        </AppText>
                        <AppText style={styles.reasonDescText}>{reason.desc}</AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>
                  {selectedReasonCode === 'other'
                    ? 'Reason Explanation (Required)'
                    : 'Additional Details (Optional)'}
                </AppText>
                <AppTextInput
                  style={[
                    styles.textArea,
                    selectedReasonCode === 'other' && !reasonDetailsInput.trim() && styles.inputWarning,
                  ]}
                  value={reasonDetailsInput}
                  onChangeText={(val) => {
                    setReasonDetailsInput(val);
                    setBlockError(null);
                  }}
                  placeholder={
                    selectedReasonCode === 'other'
                      ? 'Please explain why you are blocking this card...'
                      : 'Provide any additional context or incident details...'
                  }
                  placeholderTextColor={Monochrome.textMuted}
                  multiline
                  numberOfLines={3}
                  editable={!blocking}
                />
              </View>

              {blockError && (
                <View style={styles.errorBanner}>
                  <SymbolView
                    name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                    size={16}
                    tintColor={Monochrome.textPrimary}
                  />
                  <AppText style={styles.errorText}>{blockError}</AppText>
                </View>
              )}

              <View style={styles.blockActions}>
                <Pressable
                  disabled={blocking}
                  onPress={() => {
                    setBlockModalVisible(false);
                    setCardToBlock(null);
                  }}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <AppText style={styles.cancelButtonText}>Cancel</AppText>
                </Pressable>

                <Pressable
                  disabled={blocking}
                  onPress={handleConfirmBlockSubmit}
                  style={[styles.modalButton, styles.confirmBlockButton, blocking && styles.buttonDisabled]}
                >
                  {blocking ? (
                    <ActivityIndicator size="small" color={Monochrome.actionPrimaryText} />
                  ) : (
                    <AppText style={styles.confirmBlockButtonText}>Confirm Block</AppText>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Link / Register Card Modal */}
      <Modal visible={registerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Link New Travel Card</AppText>
              <Pressable
                disabled={registering}
                onPress={() => setRegisterModalVisible(false)}
                hitSlop={8}
              >
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={22}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Card serial / UID</AppText>
                <AppTextInput
                  style={styles.input}
                  value={cardUidInput}
                  onChangeText={(val) => {
                    setCardUidInput(val);
                    setRegisterError(null);
                  }}
                  placeholder="e.g. 04:A2:3B:18:7C"
                  placeholderTextColor={Monochrome.textMuted}
                  autoCapitalize="characters"
                  editable={!registering}
                />
                <AppText style={styles.fieldHelp}>
                  Enter the unique identifier printed on your Tap &amp; Pay transit card.
                </AppText>
              </View>

              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Custom Label (Optional)</AppText>
                <AppTextInput
                  style={styles.input}
                  value={cardLabelInput}
                  onChangeText={setCardLabelInput}
                  placeholder="e.g. Daily Commute Card"
                  placeholderTextColor={Monochrome.textMuted}
                  editable={!registering}
                />
              </View>

              {registerError && <AppText style={styles.errorText}>{registerError}</AppText>}

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
    backgroundColor: Monochrome.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Monochrome.actionPrimary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addCardButtonText: {
    color: Monochrome.actionPrimaryText,
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
    color: Monochrome.textSecondary,
    fontSize: 14,
  },
  cardsContainer: {
    gap: Spacing.four,
  },
  cardItem: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: Spacing.three,
  },
  nfcCardVisual: {
    height: 180,
    borderRadius: 16,
    padding: Spacing.four,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  nfcCardActive: {
    backgroundColor: Monochrome.surfacePrimary,
  },
  nfcCardInactive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  nfcCardBlocked: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1.5,
    borderColor: Monochrome.borderLight,
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
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  chipGraphicBlocked: {
    backgroundColor: Monochrome.surfaceSecondary,
  },
  cardVisualNumber: {
    fontSize: 19,
    letterSpacing: 2,
    color: Monochrome.textPrimary,
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
    color: Monochrome.textMuted,
    fontWeight: '700',
  },
  cardVisualName: {
    fontSize: 14,
    color: Monochrome.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  visualBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  visualBadgeBlocked: {
    backgroundColor: Monochrome.border,
  },
  visualBadgeText: {
    color: Monochrome.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  blockedBanner: {
    backgroundColor: Monochrome.surfaceElevated,
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 6,
  },
  blockedBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockedBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  blockedReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockedReasonKey: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textMuted,
  },
  blockedReasonVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  blockedDetailsBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Monochrome.borderLight,
  },
  blockedDetailsText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    fontStyle: 'italic',
  },
  blockedDateText: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  blockedHelperText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  cardControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  controlBtn: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  controlBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  emptyCardBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Monochrome.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAction: {
    width: '100%',
    marginTop: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Monochrome.surfacePrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Monochrome.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  blockModalBody: {
    gap: Spacing.three,
  },
  reasonSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    marginBottom: 8,
  },
  reasonsList: {
    gap: 8,
    marginBottom: Spacing.three,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Monochrome.border,
  },
  reasonCardSelected: {
    borderColor: Monochrome.textPrimary,
    backgroundColor: Monochrome.surfaceElevated,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Monochrome.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: Monochrome.textPrimary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Monochrome.textPrimary,
  },
  reasonTextWrap: {
    flex: 1,
  },
  reasonLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  reasonLabelTextSelected: {
    color: Monochrome.textPrimary,
    fontWeight: '700',
  },
  reasonDescText: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  field: {
    gap: 6,
    marginBottom: Spacing.three,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  fieldHelp: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  input: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 15,
    color: Monochrome.textPrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  textArea: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    minHeight: 76,
    textAlignVertical: 'top',
    fontSize: 14,
    color: Monochrome.textPrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  inputWarning: {
    borderColor: Monochrome.textPrimary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Monochrome.surfaceElevated,
    padding: 10,
    borderRadius: 10,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Monochrome.textPrimary,
    fontWeight: '500',
  },
  blockActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  confirmBlockButton: {
    backgroundColor: Monochrome.actionPrimary,
  },
  confirmBlockButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.actionPrimaryText,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  form: {
    gap: Spacing.three,
  },
  submitButton: {
    marginTop: Spacing.two,
  },
});

import { AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
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
  issueCard,
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

// NFC card colors are fixed so the card always looks like a physical card.
const CARD = {
  active: '#0B0B0C',
  inactive: '#3F3F46',
  blocked: '#18181B',
  ring: 'rgba(255,255,255,0.07)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.62)',
  textMuted: 'rgba(255,255,255,0.4)',
  chip: '#D4D4D8',
  chipBlocked: '#71717A',
  chipLine: 'rgba(0,0,0,0.28)',
  pill: 'rgba(255,255,255,0.14)',
};

function getReasonLabel(code?: string | null, fallbackReason?: string | null): string {
  if (!code && !fallbackReason) return 'Temporarily Blocked';
  const found = BLOCK_REASONS.find((r) => r.code === code);
  if (found) return found.label;
  if (fallbackReason) return fallbackReason;
  return code ? code.replace(/_/g, ' ').toUpperCase() : 'Blocked';
}

/* ------------------------------------------------------------------ */
/* Keyboard-safe bottom sheet                                          */
/* The body scrolls, the footer is pinned above the keyboard.          */
/* ------------------------------------------------------------------ */
type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  busy?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  busy = false,
  footer,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const closeIfIdle = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={closeIfIdle}
    >
      <KeyboardAvoidingView
        style={styles.sheetRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeIfIdle}>
          <View style={styles.backdrop} />
        </Pressable>

        <View
          style={[
            styles.sheet,
            { maxHeight: height * 0.9, paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <AppText style={styles.modalTitle}>{title}</AppText>
              {Boolean(subtitle) && (
                <AppText style={styles.modalSubtitle} numberOfLines={1}>
                  {subtitle}
                </AppText>
              )}
            </View>
            <Pressable disabled={busy} onPress={closeIfIdle} hitSlop={10}>
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                size={24}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* NFC card visual                                                     */
/* ------------------------------------------------------------------ */
type CardVisualProps = {
  card: CardSummary;
  serial: string;
  isActive: boolean;
  isBlocked: boolean;
};

function CardVisual({ card, serial, isActive, isBlocked }: CardVisualProps) {
  const bg = isBlocked ? CARD.blocked : isActive ? CARD.active : CARD.inactive;
  const dotColor = isBlocked ? '#A1A1AA' : isActive ? '#FFFFFF' : '#D4D4D8';

  return (
    <View style={[styles.nfcCardVisual, { backgroundColor: bg }]}>
      <View style={[styles.ring, styles.ringOne]} />
      <View style={[styles.ring, styles.ringTwo]} />
      <View style={[styles.ring, styles.ringThree]} />

      <View style={styles.cardVisualTop}>
        <View>
          <AppText style={styles.cardBrand}>TAP &amp; PAY</AppText>
          <AppText style={styles.cardType}>TRANSIT CARD</AppText>
        </View>
        <SymbolView
          name={{
            ios: isBlocked ? 'lock.fill' : 'wave.3.right',
            android: isBlocked ? 'lock' : 'nfc',
            web: isBlocked ? 'lock' : 'nfc',
          }}
          size={26}
          tintColor={CARD.textPrimary}
        />
      </View>

      <View style={[styles.chip, isBlocked && styles.chipBlocked]}>
        <View style={styles.chipLineH1} />
        <View style={styles.chipLineH2} />
        <View style={styles.chipLineV} />
      </View>

      <AppText style={[styles.cardVisualNumber, isBlocked && styles.dimText]} numberOfLines={1}>
        {serial}
      </AppText>

      <View style={styles.cardVisualBottom}>
        <View style={styles.cardLabelWrap}>
          <AppText style={styles.cardVisualLabelSmall}>CARD LABEL</AppText>
          <AppText style={styles.cardVisualName} numberOfLines={1}>
            {card.label || 'Tap & Pay Transit'}
          </AppText>
        </View>
        <View style={styles.visualBadge}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <AppText style={styles.visualBadgeText}>
            {card.status === 'inactive'
              ? 'DEACTIVATED'
              : (card.status_label || card.status).toUpperCase()}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Control button                                                      */
/* ------------------------------------------------------------------ */
type ControlButtonProps = {
  label: string;
  ios: string;
  android: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
  style?: StyleProp<ViewStyle>;
};

function ControlButton({ label, ios, android, onPress, disabled, tint, style }: ControlButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.controlBtn, style, disabled && styles.buttonDisabled]}
    >
      <SymbolView
        name={{ ios: ios as any, android: android as any, web: android as any }}
        size={20}
        tintColor={tint || Monochrome.textPrimary}
      />
      <AppText style={styles.controlBtnText}>{label}</AppText>
    </Pressable>
  );
}

export default function CardsScreen() {
  const insets = useSafeAreaInsets();

  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const issueInProgress = useRef(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [manageCardVisible, setManageCardVisible] = useState(false);
  const [cardToManage, setCardToManage] = useState<CardSummary | null>(null);
  const cardActionInProgress = useRef(false);
  const blockInProgress = useRef(false);

  // Issue Card Modal
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
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
        setCards((res.data.cards || []).slice(0, 1));
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
    if (issueInProgress.current) return;
    if (cards.length > 0) {
      setRegisterError('Each passenger can have only one registered transit card.');
      return;
    }

    setRegisterError(null);
    issueInProgress.current = true;
    setRegistering(true);

    try {
      const res = await issueCard();
      if (res.ok) {
        setRegisterModalVisible(false);
        await loadCards(true);
      } else {
        setRegisterError(res.message || 'Unable to register card.');
      }
    } catch {
      setRegisterError('Network failure. Please try again.');
    } finally {
      issueInProgress.current = false;
      setRegistering(false);
    }
  };

  const handleOpenBlockModal = (card: CardSummary) => {
    setManageCardVisible(false);
    setCardToManage(null);
    setCardToBlock(card);
    setSelectedReasonCode('temporary');
    setReasonDetailsInput('');
    setBlockError(null);
    setBlockModalVisible(true);
  };

  const handleCloseBlockModal = () => {
    setBlockModalVisible(false);
    setCardToBlock(null);
  };

  const handleConfirmBlockSubmit = async () => {
    if (!cardToBlock || blockInProgress.current) return;

    if (selectedReasonCode === 'other' && !reasonDetailsInput.trim()) {
      setBlockError('Please provide an explanation for choosing "Other Reason".');
      return;
    }

    setBlockError(null);
    blockInProgress.current = true;
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
      blockInProgress.current = false;
      setBlocking(false);
    }
  };

  const handleCardAction = async (cardId: number, action: 'activate' | 'deactivate' | 'report-lost') => {
    if (cardActionInProgress.current) return;
    cardActionInProgress.current = true;
    setActionLoadingId(cardId);
    try {
      let res;
      if (action === 'activate') res = await activateCard(cardId);
      else if (action === 'deactivate') res = await deactivateCard(cardId);
      else if (action === 'report-lost') res = await reportLostCard(cardId);

      if (res?.ok) {
        setManageCardVisible(false);
        setCardToManage(null);
        await loadCards(true);
        if (action === 'report-lost') {
          Alert.alert('Card Reported Lost', 'Your card has been reported lost and can no longer be used.');
        } else if (action === 'deactivate') {
          Alert.alert('Card Deactivated', 'Your card is deactivated. You can reactivate it later.');
        } else {
          Alert.alert('Card Activated', 'Your card is active and ready to use.');
        }
      } else {
        Alert.alert('Action Failed', res?.message || 'Could not complete action.');
      }
    } catch {
      Alert.alert('Error', 'Connection error performing card action.');
    } finally {
      cardActionInProgress.current = false;
      setActionLoadingId(null);
    }
  };

  const handleReportLostPress = (card: CardSummary) => {
    Alert.alert(
      'Report Lost Card',
      'Report this card as lost? It will be blocked immediately and cannot be reactivated. No replacement will be issued automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report Lost', style: 'destructive', onPress: () => void handleCardAction(card.id, 'report-lost') },
      ],
    );
  };

  const handleDeactivatePress = (card: CardSummary) => {
    Alert.alert(
      'Deactivate Transit Card',
      'This temporarily disables the card. You can reactivate it later from this screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void handleCardAction(card.id, 'deactivate') },
      ],
    );
  };

  const handleActivatePress = (card: CardSummary) => {
    const isBlocked = card.status === 'blocked';
    Alert.alert(
      isBlocked ? 'Unblock Transit Card' : 'Activate Transit Card',
      isBlocked
        ? 'Unblock this card and allow it to be used for transit payments again?'
        : 'Activate this card for transit payments?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Activate',
          onPress: () => void handleCardAction(card.id, 'activate'),
        },
      ],
    );
  };

  const openCardManagement = (card: CardSummary) => {
    setCardToManage(card);
    setManageCardVisible(true);
  };

  const closeCardManagement = () => {
    setManageCardVisible(false);
    setCardToManage(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <AppText style={styles.headerTitle}>Transit Cards</AppText>
          <AppText style={styles.headerSubtitle}>
            {cards.length > 0 ? '1 card registered' : 'No card issued'}
          </AppText>
        </View>
        {!loading && cards.length === 0 ? (
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
            <AppText style={styles.addCardButtonText}>Issue Card</AppText>
          </Pressable>
        ) : null}
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
            {cards.slice(0, 1).map((card) => {
              const isActive = card.status === 'active';
              const isBlocked = card.status === 'blocked';
              const isLost = card.status === 'lost';
              const isBusy = actionLoadingId === card.id;
              const displaySerial =
                card.masked_code ||
                (card.last_four ? `•••• •••• •••• ${card.last_four}` : card.card_uid || card.uid || 'TRANSIT CARD');

              return (
                <View key={card.id} style={styles.cardItem}>
                  <CardVisual
                    card={card}
                    serial={displaySerial}
                    isActive={isActive}
                    isBlocked={isBlocked || isLost}
                  />

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
                        This card is disabled from transit taps and fare payments. Use Manage Card to unblock it if you are authorized.
                      </AppText>
                    </View>
                  )}

                  {isLost && (
                    <View style={styles.blockedBanner}>
                      <View style={styles.blockedBannerHeader}>
                        <SymbolView
                          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                          size={16}
                          tintColor={Monochrome.textPrimary}
                        />
                        <AppText style={styles.blockedBannerTitle}>Card Reported Lost</AppText>
                      </View>
                      <AppText style={styles.blockedHelperText}>
                        This card is permanently restricted and cannot be reactivated. Contact support to discuss next steps.
                      </AppText>
                    </View>
                  )}

                  {card.status === 'inactive' && (
                    <View style={styles.blockedBanner}>
                      <AppText style={styles.blockedBannerTitle}>Card Deactivated</AppText>
                      <AppText style={styles.blockedHelperText}>
                        This card cannot be used for transit payments until it is reactivated.
                      </AppText>
                    </View>
                  )}

                  {!isLost && (
                    <View style={styles.cardControls}>
                      <ControlButton
                        label={isBusy ? 'Updating...' : 'Manage Card'}
                        ios="slider.horizontal.3"
                        android="settings"
                        disabled={isBusy}
                        style={styles.manageCardButton}
                        onPress={() => openCardManagement(card)}
                      />
                    </View>
                  )}

                  {isBusy && (
                    <View style={styles.busyRow}>
                      <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                      <AppText style={styles.busyText}>Updating card...</AppText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCardBox}>
            <View style={styles.emptyIconBox}>
              <SymbolView
                name={{ ios: 'wave.3.right', android: 'nfc', web: 'nfc' }}
                size={30}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.emptyTitle}>No Transit Card</AppText>
            <AppText style={styles.emptySubtitle}>
              Issue a Tap &amp; Pay transit card to your account and activate it to start travelling.
            </AppText>
            <PrimaryButton
              title="Issue Transit Card"
              onPress={() => setRegisterModalVisible(true)}
              style={styles.emptyAction}
            />
          </View>
        )}
      </ScrollView>

      <BottomSheet
        visible={manageCardVisible}
        onClose={closeCardManagement}
        busy={actionLoadingId !== null}
        title="Manage Transit Card"
        subtitle={
          cardToManage?.masked_code ||
          (cardToManage?.last_four
            ? `Card ending in ${cardToManage.last_four}`
            : cardToManage?.card_uid || cardToManage?.uid || 'Selected Card')
        }
      >
        {cardToManage ? (
          <>
            <AppText style={styles.manageCardStatus}>
              Status: {cardToManage.status === 'inactive'
                ? 'Deactivated'
                : cardToManage.status_label || cardToManage.status}
            </AppText>
            <View style={styles.manageActions}>
              {cardToManage.status === 'active' && cardToManage.is_usable !== false ? (
                <ControlButton
                  label="Show QR"
                  ios="qrcode"
                  android="qr_code"
                  style={styles.manageAction}
                  onPress={() => {
                    closeCardManagement();
                    router.push('/passenger/qr' as never);
                  }}
                />
              ) : null}
              {cardToManage.status === 'active' ? (
                <ControlButton
                  label="Deactivate"
                  ios="pause.circle.fill"
                  android="pause_circle"
                  tint={Monochrome.textSecondary}
                  disabled={actionLoadingId === cardToManage.id}
                  style={styles.manageAction}
                  onPress={() => handleDeactivatePress(cardToManage)}
                />
              ) : null}
              {cardToManage.status === 'inactive' || cardToManage.status === 'pending' ? (
                <ControlButton
                  label="Activate"
                  ios="play.circle.fill"
                  android="play_circle"
                  disabled={actionLoadingId === cardToManage.id}
                  style={styles.manageAction}
                  onPress={() => handleActivatePress(cardToManage)}
                />
              ) : null}
              {cardToManage.status === 'blocked' ? (
                <ControlButton
                  label="Unblock"
                  ios="lock.open.fill"
                  android="lock_open"
                  disabled={actionLoadingId === cardToManage.id}
                  style={styles.manageAction}
                  onPress={() => handleActivatePress(cardToManage)}
                />
              ) : null}
              {['active', 'inactive', 'pending'].includes(cardToManage.status) ? (
                <>
                  <ControlButton
                    label="Block"
                    ios="lock.fill"
                    android="lock"
                    tint={Monochrome.textSecondary}
                    disabled={actionLoadingId === cardToManage.id}
                    style={styles.manageAction}
                    onPress={() => handleOpenBlockModal(cardToManage)}
                  />
                  <ControlButton
                    label="Report Lost"
                    ios="exclamationmark.triangle.fill"
                    android="warning"
                    tint={Monochrome.textMuted}
                    disabled={actionLoadingId === cardToManage.id}
                    style={styles.manageAction}
                    onPress={() => handleReportLostPress(cardToManage)}
                  />
                </>
              ) : null}
            </View>
            {cardToManage.status === 'lost' || cardToManage.status === 'expired' ? (
              <AppText style={styles.manageCardNotice}>
                No card actions are available for this status. Contact support if you need help.
              </AppText>
            ) : null}
            {actionLoadingId === cardToManage.id ? (
              <View style={styles.busyRow}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.busyText}>Updating card...</AppText>
              </View>
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      {/* Block Card Sheet */}
      <BottomSheet
        visible={blockModalVisible}
        onClose={handleCloseBlockModal}
        busy={blocking}
        title="Block Transit Card"
        subtitle={
          cardToBlock?.masked_code ||
          (cardToBlock?.last_four
            ? `Card ending in ${cardToBlock.last_four}`
            : cardToBlock?.card_uid || cardToBlock?.uid || 'Selected Card')
        }
        footer={
          <View style={styles.blockActions}>
            <Pressable
              disabled={blocking}
              onPress={handleCloseBlockModal}
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
        }
      >
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
      </BottomSheet>

      {/* Issue Card Sheet */}
      <BottomSheet
        visible={registerModalVisible}
        onClose={() => setRegisterModalVisible(false)}
        busy={registering}
        title="Issue Transit Card"
        footer={
          <PrimaryButton
            title={registering ? 'Issuing...' : 'Issue Card'}
            onPress={handleRegisterSubmit}
            disabled={registering}
          />
        }
      >
        <View style={styles.form}>
          <AppText style={styles.fieldHelp}>
            Issue a Tap &amp; Pay transit card to your account. You can activate it after it appears here.
          </AppText>

          {registerError && (
            <View style={styles.errorBanner}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                size={16}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.errorText}>{registerError}</AppText>
            </View>
          )}
        </View>
      </BottomSheet>
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
  headerSubtitle: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Monochrome.actionPrimary,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
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
    gap: Spacing.three,
  },

  /* ---------- NFC card ---------- */
  nfcCardVisual: {
    minHeight: 210,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD.ring,
  },
  ringOne: { width: 180, height: 180, top: -60, right: -50 },
  ringTwo: { width: 260, height: 260, top: -100, right: -90 },
  ringThree: { width: 340, height: 340, top: -140, right: -130 },
  cardVisualTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBrand: {
    color: CARD.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  cardType: {
    color: CARD.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    marginTop: 3,
  },
  chip: {
    width: 44,
    height: 33,
    borderRadius: 7,
    backgroundColor: CARD.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBlocked: {
    backgroundColor: CARD.chipBlocked,
  },
  chipLineH1: {
    position: 'absolute',
    top: 11,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: CARD.chipLine,
  },
  chipLineH2: {
    position: 'absolute',
    top: 22,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: CARD.chipLine,
  },
  chipLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: CARD.chipLine,
  },
  cardVisualNumber: {
    fontSize: 18,
    letterSpacing: 2,
    color: CARD.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  dimText: {
    color: CARD.textSecondary,
  },
  cardVisualBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  cardLabelWrap: {
    flex: 1,
  },
  cardVisualLabelSmall: {
    fontSize: 9,
    letterSpacing: 1.6,
    color: CARD.textMuted,
    fontWeight: '600',
  },
  cardVisualName: {
    fontSize: 14,
    color: CARD.textPrimary,
    fontWeight: '700',
    marginTop: 3,
  },
  visualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  visualBadgeText: {
    color: CARD.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* ---------- Blocked banner ---------- */
  blockedBanner: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
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
    backgroundColor: Monochrome.surfaceElevated,
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

  /* ---------- Controls ---------- */
  cardControls: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  manageCardButton: {
    flex: 1,
  },
  manageCardStatus: {
    color: Monochrome.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.three,
  },
  manageCardNotice: {
    color: Monochrome.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: Spacing.three,
  },
  manageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  manageAction: {
    flex: 1,
    minWidth: '46%',
  },
  controlBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  controlBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'center',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  busyText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
  },

  /* ---------- Empty state ---------- */
  emptyCardBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 22,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
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

  /* ---------- Bottom sheet ---------- */
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: Monochrome.surfacePrimary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Monochrome.borderLight,
    marginBottom: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    gap: 12,
  },
  modalHeaderText: {
    flex: 1,
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
  sheetScroll: {
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingBottom: Spacing.three,
  },
  sheetFooter: {
    paddingTop: Spacing.two,
  },

  /* ---------- Block reasons ---------- */
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
    borderRadius: 14,
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

  /* ---------- Form ---------- */
  form: {
    gap: Spacing.three,
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
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 50,
    fontSize: 15,
    color: Monochrome.textPrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  textArea: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    minHeight: 80,
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

  /* ---------- Footer buttons ---------- */
  blockActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
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
});
import { AppText, AppTextInput } from '@/components/typography/app-text';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Monochrome, Spacing } from '@/constants/theme';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';
import { submitPassengerFeedback } from '@/features/passenger/services/passengerApi';

const MAX_COMMENT_LENGTH = 1000;
const RATING_LABELS = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];

export default function PassengerFeedbackScreen() {
  const insets = useSafeAreaInsets();
  const { travelUid, busNumber, routeName, fare, ticketNumber } =
    useLocalSearchParams<{
      travelUid: string;
      busNumber?: string;
      routeName?: string;
      fare?: string;
      ticketNumber?: string;
    }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submittingRef = useRef(false);
  const requestRef = useRef({ signature: '', key: createIdempotencyKey() });

  const continueToReceipt = () => {
    if (navigating || submitting) return;
    setNavigating(true);
    router.replace(`/travel/${travelUid}` as never);
  };

  const submit = async () => {
    if (!travelUid || rating < 1 || submittingRef.current || submitted || navigating) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    const normalizedComment = comment.trim();
    const signature = `${rating}\u0000${normalizedComment}`;
    if (requestRef.current.signature !== signature) {
      requestRef.current = { signature, key: createIdempotencyKey() };
    }

    try {
      const result = await submitPassengerFeedback(
        travelUid,
        rating,
        normalizedComment,
        requestRef.current.key,
      );
      if (!result.ok || !result.data) {
        setError(result.message || 'Feedback could not be submitted. You can retry or skip.');
        return;
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : 'Feedback could not be submitted. You can retry or skip.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successBadge}>
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={20}
              tintColor={Monochrome.actionPrimaryText}
            />
          </View>
          <AppText style={styles.eyebrow}>PAYMENT COMPLETE</AppText>
          <AppText style={styles.title}>{submitted ? 'Thank you for riding with us!' : 'How was your ride?'}</AppText>
          <AppText style={styles.subtitle}>Your feedback helps us improve Tap &amp; Pay.</AppText>

          {(routeName || busNumber || fare || ticketNumber) ? (
            <View style={styles.tripSummary}>
              {routeName ? <AppText style={styles.tripRoute}>{routeName}</AppText> : null}
              <AppText style={styles.tripDetails}>
                {[busNumber ? `Bus ${busNumber}` : null, fare, ticketNumber].filter(Boolean).join(' · ')}
              </AppText>
            </View>
          ) : null}

          {submitted ? (
            <View style={styles.submittedCard}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={44}
                tintColor={Monochrome.actionPrimary}
              />
              <AppText style={styles.submittedTitle}>Feedback submitted</AppText>
              <AppText style={styles.subtitle}>Thanks for helping us make every trip better.</AppText>
            </View>
          ) : (
            <>
              <View style={styles.ratingCard}>
                <AppText style={styles.sectionTitle}>Rate your experience</AppText>
                <View style={styles.starsRow}>
                  {RATING_LABELS.map((label, index) => {
                    const value = index + 1;
                    const selected = value <= rating;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`${value} star${value === 1 ? '' : 's'}, ${label}`}
                        accessibilityState={{ selected: rating === value }}
                        onPress={() => {
                          setRating(value);
                          setError(null);
                        }}
                        style={styles.starButton}
                        hitSlop={4}
                      >
                        <SymbolView
                          name={{
                            ios: selected ? 'star.fill' : 'star',
                            android: selected ? 'star' : 'star_outline',
                            web: selected ? 'star' : 'star_outline',
                          }}
                          size={36}
                          tintColor={selected ? Monochrome.actionPrimary : Monochrome.textMuted}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <AppText style={styles.ratingLabel}>
                  {rating > 0 ? RATING_LABELS[rating - 1] : 'Tap a star to rate'}
                </AppText>
              </View>

              <View style={styles.commentCard}>
                <View style={styles.commentHeading}>
                  <AppText style={styles.sectionTitle}>Tell us more</AppText>
                  <AppText style={styles.optionalLabel}>OPTIONAL</AppText>
                </View>
                <AppTextInput
                  accessibilityLabel="Optional travel feedback"
                  value={comment}
                  onChangeText={(value) => {
                    setComment(value.slice(0, MAX_COMMENT_LENGTH));
                    setError(null);
                  }}
                  placeholder="Tell us about your travel experience..."
                  placeholderTextColor={Monochrome.textMuted}
                  maxLength={MAX_COMMENT_LENGTH}
                  multiline
                  textAlignVertical="top"
                  style={styles.commentInput}
                />
                <AppText style={styles.characterCount}>{comment.length}/{MAX_COMMENT_LENGTH}</AppText>
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <SymbolView
                    name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                    size={17}
                    tintColor={Monochrome.textPrimary}
                  />
                  <AppText style={styles.errorText}>{error}</AppText>
                </View>
              ) : null}
            </>
          )}

          <View style={styles.actions}>
            {!submitted ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting || navigating}
                  onPress={continueToReceipt}
                  style={[styles.skipButton, (submitting || navigating) && styles.disabled]}
                >
                  <AppText style={styles.skipText}>Skip</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: rating === 0 || submitting || navigating }}
                  disabled={rating === 0 || submitting || navigating}
                  onPress={() => void submit()}
                  style={[styles.submitButton, (rating === 0 || submitting || navigating) && styles.disabled]}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color={Monochrome.actionPrimaryText} />
                    : <AppText style={styles.submitText}>Submit Feedback</AppText>}
                </Pressable>
              </>
            ) : (
              <Pressable accessibilityRole="button" onPress={continueToReceipt} style={styles.submitButton}>
                <AppText style={styles.submitText}>Continue to Receipt</AppText>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Monochrome.background },
  keyboardAvoiding: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.three,
  },
  successBadge: {
    width: 48,
    height: 48,
    alignSelf: 'center',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.actionPrimary,
  },
  eyebrow: { textAlign: 'center', color: Monochrome.actionPrimary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { textAlign: 'center', color: Monochrome.textPrimary, fontSize: 26, fontWeight: '900' },
  subtitle: { textAlign: 'center', color: Monochrome.textSecondary, fontSize: 14, lineHeight: 21 },
  tripSummary: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  tripRoute: { color: Monochrome.textPrimary, fontWeight: '700', fontSize: 14 },
  tripDetails: { marginTop: 4, color: Monochrome.textMuted, fontSize: 11, textAlign: 'center' },
  ratingCard: {
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
    borderRadius: 16,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  sectionTitle: { color: Monochrome.textPrimary, fontSize: 15, fontWeight: '800' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  starButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { minHeight: 18, color: Monochrome.textSecondary, fontSize: 13, fontWeight: '700' },
  commentCard: {
    padding: Spacing.three,
    borderRadius: 14,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  commentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  optionalLabel: { color: Monochrome.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  commentInput: {
    minHeight: 112,
    padding: Spacing.three,
    borderRadius: 10,
    color: Monochrome.textPrimary,
    backgroundColor: Monochrome.background,
    borderWidth: 1,
    borderColor: Monochrome.border,
    fontSize: 14,
    lineHeight: 20,
  },
  characterCount: { marginTop: Spacing.two, alignSelf: 'flex-end', color: Monochrome.textMuted, fontSize: 11 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  errorText: { flex: 1, color: Monochrome.textPrimary, fontSize: 12, lineHeight: 17 },
  submittedCard: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
    borderRadius: 16,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  submittedTitle: { color: Monochrome.textPrimary, fontSize: 18, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  skipButton: {
    minHeight: 50,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  skipText: { color: Monochrome.textPrimary, fontSize: 14, fontWeight: '700' },
  submitButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    backgroundColor: Monochrome.actionPrimary,
  },
  submitText: { color: Monochrome.actionPrimaryText, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});

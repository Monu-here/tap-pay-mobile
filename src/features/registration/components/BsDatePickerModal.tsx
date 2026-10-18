/**
 * BS (Bikram Sambat) date picker modal.
 *
 * A purpose-built Nepali calendar rather than the native AD picker, so the
 * user genuinely browses BS years, months and days. The grid comes from
 * `getBsMonthCalendar`, which also returns each day's AD equivalent — that
 * is what drives the future-date and range checks without a second lookup.
 *
 * Days outside the displayed month are shown muted and are not selectable;
 * future days are disabled so a date of birth can never be in the future.
 */

import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';

import {
  MAX_AD_DATE,
  MIN_AD_DATE,
  bsWeekdayLabels,
  buildBsMonthCalendar,
  formatBsIso,
  parseBsIso,
  todayAdIso,
  todayBs as todayBsDate,
  type BsDate,
} from '../utils/nepaliDate';

/** BS years offered in the quick year picker — a plausible DOB span. */
const YEAR_PICKER_START = 1990;

/** Everything the BS picker needs while it is open, reset as one unit. */
type PickerSession = {
  /** Date Confirm will commit. */
  draft: BsDate;
  /** Year currently shown in the grid. */
  viewYear: number;
  /** Month currently shown in the grid, 1-based. */
  viewMonth: number;
  showYears: boolean;
};

function makeSession(value: string | null, fallback: BsDate): PickerSession {
  const parsed = parseBsIso(value ?? '') ?? fallback;
  return {
    draft: parsed,
    viewYear: parsed.year,
    viewMonth: parsed.month,
    showYears: false,
  };
}

export type BsDatePickerModalProps = {
  visible: boolean;
  /** Currently selected BS date, `YYYY-MM-DD`. */
  value: string | null;
  onCancel: () => void;
  onConfirm: (bs: BsDate) => void;
};

export function BsDatePickerModal({ visible, value, onCancel, onConfirm }: BsDatePickerModalProps) {
  const insets = useSafeAreaInsets();
  const today = todayAdIso();
  // Today in BS must come from converting the Gregorian date, not from
  // reparsing the AD string as a BS date.
  const todayBs = useMemo(() => todayBsDate(), []);

  const [session, setSession] = useState<PickerSession>(() => makeSession(value, todayBs));
  const [wasVisible, setWasVisible] = useState(visible);

  // React's documented "adjust state when a prop changes" pattern: reset the
  // whole session during render when the modal opens, instead of in an
  // effect, so it always opens on the value that is already selected.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setSession(makeSession(value, todayBs));
  }

  const { draft, viewYear, viewMonth, showYears } = session;

  const calendar = useMemo(() => buildBsMonthCalendar(viewYear, viewMonth), [viewYear, viewMonth]);
  const weekdayLabels = useMemo(() => bsWeekdayLabels(), []);

  const years = useMemo(
    () =>
      Array.from({ length: todayBs.year - YEAR_PICKER_START + 1 }, (_, i) => YEAR_PICKER_START + i),
    [todayBs.year],
  );

  const goToPreviousMonth = () => {
    if (viewMonth === 1) {
      setSession((prev) => ({ ...prev, viewMonth: 12, viewYear: prev.viewYear - 1 }));
    } else {
      setSession((prev) => ({ ...prev, viewMonth: prev.viewMonth - 1 }));
    }
  };

  const goToNextMonth = () => {
    // Never navigate past the current month: everything after it is future.
    if (viewYear === todayBs.year && viewMonth === todayBs.month) return;
    if (viewMonth === 12) {
      setSession((prev) => ({ ...prev, viewMonth: 1, viewYear: prev.viewYear + 1 }));
    } else {
      setSession((prev) => ({ ...prev, viewMonth: prev.viewMonth + 1 }));
    }
  };

  const canGoNext = !(viewYear === todayBs.year && viewMonth === todayBs.month);

  const isDayDisabled = (ad: string) => ad > today || ad > MAX_AD_DATE || ad < MIN_AD_DATE;

  const isSelected = (day: BsDate) =>
    day.year === draft.year && day.month === draft.month && day.day === draft.day;

  const monthLabel = `${calendar.monthName} ${calendar.year}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close date picker" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Text style={styles.title}>Select Date (BS)</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            onPress={onCancel}
            style={styles.closeButton}
          >
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={16}
              tintColor={Brand.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.navRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={goToPreviousMonth}
            hitSlop={8}
            style={styles.navButton}
          >
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor={Brand.text}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setSession((prev) => ({ ...prev, showYears: !prev.showYears }))}
            style={styles.monthLabelWrap}
          >
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <SymbolView
              name={{
                ios: showYears ? 'chevron.up' : 'chevron.down',
                android: showYears ? 'expand_less' : 'expand_more',
                web: showYears ? 'expand_less' : 'expand_more',
              }}
              size={14}
              tintColor={Brand.textSecondary}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={goToNextMonth}
            hitSlop={8}
            disabled={!canGoNext}
            style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
          >
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={canGoNext ? Brand.text : Brand.divider}
            />
          </Pressable>
        </View>

        {showYears ? (
          <ScrollView style={styles.yearList} contentContainerStyle={styles.yearListContent}>
            {[...years].reverse().map((year) => {
              const active = year === viewYear;
              return (
                <Pressable
                  key={year}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() =>
                    setSession((prev) => ({
                      ...prev,
                      viewYear: year,
                      showYears: false,
                      draft: { ...prev.draft, year },
                    }))
                  }
                  style={[styles.yearItem, active && styles.yearItemActive]}
                >
                  <Text style={[styles.yearText, active && styles.yearTextActive]}>{year}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <>
            <View style={styles.weekdayRow}>
              {weekdayLabels.map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {calendar.weeks.flat().map((day, index) => {
                const disabled = day.outside || isDayDisabled(day.ad);
                const selected = isSelected(day);
                return (
                  <Pressable
                    key={`${day.year}-${day.month}-${day.day}-${index}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() =>
                      setSession((prev) => ({
                        ...prev,
                        draft: { year: day.year, month: day.month, day: day.day },
                      }))
                    }
                    style={[
                      styles.dayCell,
                      day.outside && styles.dayOutside,
                      selected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayDisabled]}
                    >
                      {day.day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.selectedPreview}>
              Selected: {formatBsIso(draft)}
            </Text>
          </>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={[styles.actionButton, styles.cancelButton]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onConfirm(draft)}
            style={[styles.actionButton, styles.confirmButton]}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 27, 46, 0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.divider,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  title: {
    color: Brand.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  monthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  monthLabel: {
    color: Brand.text,
    fontSize: 16,
    fontWeight: '700',
  },
  yearList: {
    maxHeight: 260,
  },
  yearListContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  yearItem: {
    width: 72,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
  },
  yearItemActive: {
    backgroundColor: Brand.primary,
  },
  yearText: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '600',
  },
  yearTextActive: {
    color: Brand.white,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.one,
  },
  weekdayLabel: {
    width: CELL,
    textAlign: 'center',
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dayCell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  dayOutside: {
    opacity: 0.3,
  },
  daySelected: {
    backgroundColor: Brand.primary,
  },
  dayText: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: Brand.white,
    fontWeight: '700',
  },
  dayDisabled: {
    color: Brand.textSecondary,
  },
  selectedPreview: {
    color: Brand.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Brand.inputBackground,
  },
  confirmButton: {
    backgroundColor: Brand.primary,
  },
  cancelText: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmText: {
    color: Brand.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
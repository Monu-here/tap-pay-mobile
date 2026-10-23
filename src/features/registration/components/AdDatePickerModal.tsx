import { AppText } from '@/components/typography/app-text';
/**
 * AD (Gregorian) date picker.
 *
 * Uses the Expo-recommended `@react-native-community/datetimepicker`, which
 * renders the platform-native picker on both iOS and Android. The two
 * platforms are handled differently on purpose:
 *
 *  - iOS: a bottom-sheet Modal with an inline picker plus Cancel/Confirm.
 *  - Android: the native Material dialog, rendered bare. It brings its own
 *    surface and buttons and reports `set` / `dismissed` through `onChange`,
 *    so wrapping it in a Modal would only fight it for the backdrop.
 *
 * A draft `Date` is kept locally so cancelling never writes to form state,
 * and `maximumDate` prevents picking a future date of birth.
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';

import { adIsoToDate, dateToAdIso } from '../utils/nepaliDate';

export type AdDatePickerModalProps = {
  visible: boolean;
  /** Currently selected AD date, `YYYY-MM-DD`. */
  value: string | null;
  /** Latest selectable date, `YYYY-MM-DD`. Defaults to today. */
  maximumDate?: string;
  /** Earliest selectable date, `YYYY-MM-DD`. */
  minimumDate?: string;
  onCancel: () => void;
  /** Receives the picked date as `YYYY-MM-DD`. */
  onConfirm: (adIso: string) => void;
};

export function AdDatePickerModal({
  visible,
  value,
  maximumDate,
  minimumDate,
  onCancel,
  onConfirm,
}: AdDatePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Date>(() => adIsoToDate(value ?? ''));
  const [wasVisible, setWasVisible] = useState(visible);

  // React's documented "adjust state when a prop changes" pattern: re-seed
  // the draft during render when the modal opens, rather than in an effect,
  // so it always shows the value that was selected when the picker opened.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(adIsoToDate(value ?? ''));
  }

  const maxDate = adIsoToDate(maximumDate ?? '');
  const minDate = minimumDate ? adIsoToDate(minimumDate) : undefined;

  const handleChange = (_event: { type: string }, date?: Date) => {
    // Android's dialog owns its own confirm/cancel buttons and reports both
    // through `onChange`: `set` means the user picked a date, `dismissed`
    // means they backed out.
    if (Platform.OS !== 'android') return;
    if (_event.type === 'set' && date) {
      onConfirm(dateToAdIso(date));
    } else {
      onCancel();
    }
  };

  // Android: the native picker is a real dialog with its own surface and
  // buttons, so render it bare. Wrapping it in a Modal only competes with it
  // for the backdrop and leaves an empty white sheet behind the dialog.
  if (Platform.OS !== 'ios') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={draft}
        mode="date"
        display="default"
        maximumDate={maxDate}
        minimumDate={minDate}
        accentColor={Brand.primary}
        textColor={Brand.text}
        onChange={handleChange}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close date picker" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <AppText style={styles.title}>Select Date</AppText>
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

        <View style={styles.pickerArea}>
          {/*
            The picker's text colour follows the device theme by default, so a
            phone in dark mode draws white text on this white sheet. The whole
            registration flow is light-only, so force the light variant and
            pin an explicit background and size to match.
          */}
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            maximumDate={maxDate}
            minimumDate={minDate}
            accentColor={Brand.primary}
            textColor={Brand.text}
            themeVariant="light"
            style={styles.picker}
            onChange={(event, date) => {
              if (date) setDraft(date);
            }}
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={[styles.actionButton, styles.cancelButton]}
          >
            <AppText style={styles.cancelText}>Cancel</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onConfirm(dateToAdIso(draft))}
            style={[styles.actionButton, styles.confirmButton]}
          >
            <AppText style={styles.confirmText}>Confirm</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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
    marginBottom: Spacing.three,
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
  pickerArea: {
    alignItems: 'center',
    minHeight: 216,
    justifyContent: 'center',
  },
  picker: {
    alignSelf: 'stretch',
    backgroundColor: Brand.white,
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
import { AppText } from '@/components/typography/app-text';
/**
 * Document image upload component.
 *
 * Wraps `expo-image-picker` so the user can pick an identity document photo
 * from their gallery (or take one with the camera). Shows a placeholder
 * when no image is selected, a preview with remove/replace actions when
 * one is. No network upload happens here — the selected image lives in
 * local form state only.
 */

import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';

import type { DocumentImage } from '../types';

export type DocumentUploadProps = {
  label: string;
  hint?: string;
  value: DocumentImage | null;
  onChange: (image: DocumentImage | null) => void;
  required?: boolean;
};

export function DocumentUpload({
  label,
  hint,
  value,
  onChange,
  required,
}: DocumentUploadProps) {
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>(
    'undetermined',
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mounted) setPermissionStatus(status);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openPicker = async () => {
    if (permissionStatus === 'denied') {
      Alert.alert(
        'Permission denied',
        'Enable gallery access in your device settings to upload a document photo.',
      );
      return;
    }

    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        exif: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pick an image.';
      Alert.alert('Unable to pick image', message);
      return;
    }

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Unable to pick image', 'No image was selected.');
      return;
    }

    onChange({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? undefined,
    });
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.fieldLabel}>{label}</AppText>
        {required && <AppText style={styles.requiredMark}>*</AppText>}
      </View>
      {hint && <AppText style={styles.hint}>{hint}</AppText>}

      {value ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: value.uri }} style={styles.preview} />
          <View style={styles.previewActions}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              style={styles.actionButton}
              onPress={openPicker}
            >
              <AppText style={styles.actionText}>Replace</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={handleRemove}
            >
              <AppText style={styles.actionTextDanger}>Remove</AppText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={openPicker}
          style={styles.placeholder}
        >
          <SymbolView
            name={{ ios: 'photo.fill', android: 'photo', web: 'photo' }}
            size={26}
            tintColor={Brand.teal.primary}
          />
          <AppText style={styles.placeholderText}>Add photo</AppText>
          <AppText style={styles.placeholderHint}>Tap to select from gallery</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  fieldLabel: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '600',
  },
  requiredMark: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: Brand.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  placeholder: {
    height: 120,
    borderRadius: 14,
    backgroundColor: Brand.inputBackground,
    borderWidth: 1.5,
    borderColor: Brand.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  placeholderText: {
    color: Brand.teal.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  placeholderHint: {
    color: Brand.textSecondary,
    fontSize: 12,
  },
  previewContainer: {
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: Brand.inputBackground,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionText: {
    color: Brand.teal.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionTextDanger: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
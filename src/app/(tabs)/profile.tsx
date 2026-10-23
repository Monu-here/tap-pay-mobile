import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Monochrome, Spacing } from '@/constants/theme';
import {
  changePassword,
  destroySession,
  getSessions,
  logout,
  logoutAll,
  type UserSessionItem,
} from '@/features/auth/services/auth';
import { getProfile, updateProfile } from '@/features/passenger/services/passengerApi';
import { getSession } from '@/features/auth/session';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const session = getSession();

  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Profile Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Change Password Modal
  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [profRes, sessRes] = await Promise.all([
        getProfile(),
        getSessions(),
      ]);

      if (profRes.ok && profRes.data) {
        const u = (profRes.data as any).user || profRes.data;
        setProfileData(u);
        setNameInput(u.name || '');
        setPhoneInput(u.phone || '');
      }
      if (sessRes.ok && sessRes.data) {
        setSessions(sessRes.data.sessions || []);
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
      void loadData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadData]);

  const handleSaveProfile = async () => {
    if (!nameInput.trim()) {
      setEditError('Name is required.');
      return;
    }

    setSavingProfile(true);
    setEditError(null);
    try {
      const res = await updateProfile({
        name: nameInput.trim(),
        phone: phoneInput.trim() || undefined,
      });

      if (res.ok) {
        setEditModalVisible(false);
        await loadData(true);
        Alert.alert('Success', 'Profile updated successfully.');
      } else {
        setEditError(res.message || 'Could not update profile.');
      }
    } catch {
      setEditError('Connection failure. Check network.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError('All fields are required.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('New passwords do not match.');
      return;
    }
    if (newPwd.length < 8) {
      setPwdError('Password must be at least 8 characters long.');
      return;
    }

    setChangingPwd(true);
    setPwdError(null);
    setPwdSuccess(null);

    try {
      const res = await changePassword(currentPwd, newPwd, confirmPwd);
      if (res.ok) {
        setPwdSuccess('Password changed successfully.');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
        setTimeout(() => setPwdModalVisible(false), 1500);
      } else {
        setPwdError(res.message || 'Unable to change password.');
      }
    } catch {
      setPwdError('Connection error. Please try again.');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleRevokeSession = async (tokenId: number) => {
    Alert.alert(
      'Revoke Session',
      'Sign out this device from your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Device',
          style: 'destructive',
          onPress: async () => {
            const res = await destroySession(tokenId);
            if (res.ok) {
              await loadData(true);
            } else {
              Alert.alert('Revocation Failed', res.message || 'Could not revoke session.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Tap & Pay?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login' as any);
          },
        },
      ],
    );
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Sign Out Everywhere',
      'Sign out of all devices and active sessions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out All',
          style: 'destructive',
          onPress: async () => {
            await logoutAll();
            router.replace('/login' as any);
          },
        },
      ],
    );
  };

  const name = (profileData?.name as string) || session.user?.name || 'Passenger';
  const email = (profileData?.email as string) || session.user?.email || '';
  const phone = (profileData?.phone as string) || session.user?.phone || 'No phone registered';
  const roleType = (profileData?.type as string) || session.user?.type || 'passenger';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <AppText style={styles.headerTitle}>Account &amp; Security</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditModalVisible(true)}
          style={styles.editBtn}
        >
          <SymbolView
            name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
            size={14}
            tintColor={Monochrome.textPrimary}
          />
          <AppText style={styles.editBtnText}>Edit</AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <AppText style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</AppText>
          </View>
          <View style={styles.profileTextGroup}>
            <AppText style={styles.profileName}>{name}</AppText>
            <AppText style={styles.profileEmail}>{email}</AppText>
            <AppText style={styles.profilePhone}>{phone}</AppText>
            <View style={styles.typeBadge}>
              <AppText style={styles.typeBadgeText}>{roleType.toUpperCase()}</AppText>
            </View>
          </View>
        </View>

        {/* Portal Switching Section if User is Authorized */}
        {(roleType === 'super_admin' || roleType === 'company_admin' || roleType === 'driver') && (
          <View style={styles.section}>
            <AppText style={styles.sectionHeading}>Management Portal</AppText>
            <View style={styles.portalCard}>
              <Pressable
                onPress={() => {
                  if (roleType === 'super_admin') router.push('/portal/admin' as any);
                  else if (roleType === 'company_admin') router.push('/portal/company' as any);
                  else if (roleType === 'driver') router.push('/portal/driver' as any);
                }}
                style={styles.portalRow}
              >
                <View style={styles.portalIcon}>
                  <SymbolView
                    name={{ ios: 'shield.fill', android: 'admin_panel_settings', web: 'admin_panel_settings' }}
                    size={22}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <View style={styles.portalInfo}>
                  <AppText style={styles.portalTitle}>
                    {roleType === 'super_admin' ? 'Super Admin Console' : roleType === 'company_admin' ? 'Company Fleet Portal' : 'Driver Console'}
                  </AppText>
                  <AppText style={styles.portalSubtitle}>Switch workspace</AppText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={16}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>
          </View>
        )}

        {/* Security & Preferences */}
        <View style={styles.section}>
          <AppText style={styles.sectionHeading}>Security &amp; Preferences</AppText>
          <View style={styles.optionsCard}>
            {(roleType === 'passenger' || roleType === 'driver') ? (
              <Pressable onPress={() => router.push('/security/mpin' as any)} style={styles.optionRow}>
                <View style={styles.optionLeft}>
                  <SymbolView
                    name={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }}
                    size={18}
                    tintColor={Monochrome.textPrimary}
                  />
                  <AppText style={styles.optionText}>Security &amp; MPIN</AppText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            ) : null}
            <Pressable onPress={() => setPwdModalVisible(true)} style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.optionText}>Change Password</AppText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>

            <Pressable onPress={() => router.push('/notifications' as any)} style={[styles.optionRow, styles.rowBorder]}>
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.optionText}>Notification Preferences</AppText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/cards' as any)}
              style={[styles.optionRow, styles.rowBorder]}
            >
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.optionText}>My cards</AppText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>

            <Pressable onPress={() => router.push('/travel' as any)} style={[styles.optionRow, styles.rowBorder]}>
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.optionText}>My Travel History</AppText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>

            {roleType === 'passenger' ? (
              <Pressable
                onPress={() => router.push('/portal/concession' as any)}
                style={[styles.optionRow, styles.rowBorder]}
              >
                <View style={styles.optionLeft}>
                  <SymbolView
                    name={{ ios: 'person.text.rectangle', android: 'badge', web: 'badge' }}
                    size={18}
                    tintColor={Monochrome.textPrimary}
                  />
                  <AppText style={styles.optionText}>Fare concession application</AppText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            ) : null}

            <Pressable onPress={() => router.push('/support' as any)} style={[styles.optionRow, styles.rowBorder]}>
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'questionmark.circle.fill', android: 'help_outline', web: 'help_outline' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.optionText}>Help, payments &amp; disputes</AppText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>
          </View>
        </View>

        {/* Active Authorized Sessions */}
        <View style={styles.section}>
          <AppText style={styles.sectionHeading}>Active Sessions ({sessions.length})</AppText>
          <View style={styles.optionsCard}>
            {loading && !refreshing ? (
              <ActivityIndicator size="small" color={Monochrome.textPrimary} style={{ padding: Spacing.four }} />
            ) : sessions.length > 0 ? (
              sessions.map((sess, idx) => (
                <View key={sess.id} style={[styles.sessionRow, idx > 0 && styles.rowBorder]}>
                  <View style={styles.sessionLeft}>
                    <SymbolView
                      name={{
                        ios: sess.is_current ? 'laptopcomputer.and.iphone' : 'iphone',
                        android: sess.is_current ? 'devices' : 'smartphone',
                        web: sess.is_current ? 'devices' : 'smartphone',
                      }}
                      size={20}
                      tintColor={Monochrome.textPrimary}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.sessionTitleRow}>
                        <AppText style={styles.sessionDeviceName}>
                          {sess.name || 'Mobile App / Browser'}
                        </AppText>
                        {sess.is_current ? (
                          <View style={styles.currentBadge}>
                            <AppText style={styles.currentBadgeText}>THIS DEVICE</AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText style={styles.sessionMeta}>
                        {sess.last_used_at ? new Date(sess.last_used_at).toLocaleDateString() : 'Active'}
                      </AppText>
                    </View>
                  </View>
                  {!sess.is_current && (
                    <Pressable
                      onPress={() => handleRevokeSession(sess.id)}
                      style={styles.revokeBtn}
                    >
                      <AppText style={styles.revokeBtnText}>Revoke</AppText>
                    </Pressable>
                  )}
                </View>
              ))
            ) : (
              <AppText style={{ padding: Spacing.four, color: Monochrome.textMuted, fontSize: 13 }}>
                No active remote sessions found.
              </AppText>
            )}
          </View>
        </View>

        {/* Logout Actions */}
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <SymbolView
            name={{ ios: 'arrow.right.square.fill', android: 'logout', web: 'logout' }}
            size={18}
            tintColor={Monochrome.textPrimary}
          />
          <AppText style={styles.logoutButtonText}>Sign Out</AppText>
        </Pressable>

        <Pressable onPress={handleLogoutAll} style={styles.logoutAllButton}>
          <AppText style={styles.logoutAllButtonText}>Sign Out Everywhere</AppText>
        </Pressable>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Edit Account Details</AppText>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={22}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Full Name</AppText>
                <AppTextInput
                  style={styles.input}
                  value={nameInput}
                  onChangeText={(val) => {
                    setNameInput(val);
                    setEditError(null);
                  }}
                  placeholder="Enter full name"
                  placeholderTextColor={Monochrome.textMuted}
                />
              </View>

              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Phone Number</AppText>
                <AppTextInput
                  style={styles.input}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor={Monochrome.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {editError && <AppText style={styles.errorText}>{editError}</AppText>}

              <PrimaryButton
                title={savingProfile ? 'Saving...' : 'Save Profile'}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={styles.modalActionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={pwdModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Change Password</AppText>
              <Pressable onPress={() => setPwdModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={22}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Current Password</AppText>
                <AppTextInput
                  style={styles.input}
                  value={currentPwd}
                  onChangeText={(val) => {
                    setCurrentPwd(val);
                    setPwdError(null);
                  }}
                  placeholder="Enter current password"
                  placeholderTextColor={Monochrome.textMuted}
                  secureTextEntry
                />
              </View>

              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>New Password</AppText>
                <AppTextInput
                  style={styles.input}
                  value={newPwd}
                  onChangeText={(val) => {
                    setNewPwd(val);
                    setPwdError(null);
                  }}
                  placeholder="At least 8 characters"
                  placeholderTextColor={Monochrome.textMuted}
                  secureTextEntry
                />
              </View>

              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Confirm New Password</AppText>
                <AppTextInput
                  style={styles.input}
                  value={confirmPwd}
                  onChangeText={(val) => {
                    setConfirmPwd(val);
                    setPwdError(null);
                  }}
                  placeholder="Repeat new password"
                  placeholderTextColor={Monochrome.textMuted}
                  secureTextEntry
                />
              </View>

              {pwdError && <AppText style={styles.errorText}>{pwdError}</AppText>}
              {pwdSuccess && <AppText style={styles.successText}>{pwdSuccess}</AppText>}

              <PrimaryButton
                title={changingPwd ? 'Updating...' : 'Update Password'}
                onPress={handleChangePassword}
                disabled={changingPwd}
                style={styles.modalActionBtn}
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
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  profileCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  profileTextGroup: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Monochrome.textSecondary,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  portalCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Monochrome.border,
    overflow: 'hidden',
  },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  portalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalInfo: {
    flex: 1,
  },
  portalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  portalSubtitle: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  optionsCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Monochrome.border,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Monochrome.surfaceElevated,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionDeviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  currentBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  sessionMeta: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Monochrome.surfaceElevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  revokeBtnText: {
    fontSize: 11,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  logoutButtonText: {
    color: Monochrome.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutAllButtonText: {
    color: Monochrome.textMuted,
    fontSize: 13,
    fontWeight: '600',
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
    color: Monochrome.textPrimary,
  },
  modalForm: {
    gap: Spacing.three,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textSecondary,
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
  errorText: {
    fontSize: 13,
    color: Monochrome.textPrimary,
    fontWeight: '500',
  },
  successText: {
    fontSize: 13,
    color: Monochrome.textPrimary,
    fontWeight: '600',
  },
  modalActionBtn: {
    marginTop: Spacing.two,
  },
});

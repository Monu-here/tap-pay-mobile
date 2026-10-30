import React, { useCallback, useEffect, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppText, AppTextInput } from '@/components/typography/app-text';
import { Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import {
  changePassword,
  destroySession,
  getSessions,
  logout,
  type UserSessionItem,
} from '@/features/auth/services/auth';
import { getProfile, updateProfile } from '@/features/passenger/services/passengerApi';
import { getSession } from '@/features/auth/session';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
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

  // Devices & Sessions Sheet Modal
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [profRes, sessRes] = await Promise.all([
        getProfile(),
        getSessions(),
      ]);

      if (profRes.ok && profRes.data) {
        const u = ((profRes.data as Record<string, unknown>).user || profRes.data) as Record<string, unknown>;
        setProfileData(u);
        setNameInput((u.name as string) || '');
        setPhoneInput((u.phone as string) || '');
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
      setEditError('Full name is required.');
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
        Alert.alert('Profile Updated', 'Your profile details have been saved.');
      } else {
        setEditError(res.message || 'Could not update profile details.');
      }
    } catch {
      setEditError('Connection failure. Check your network.');
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
        setTimeout(() => {
          setPwdModalVisible(false);
          setPwdSuccess(null);
        }, 1200);
      } else {
        setPwdError(res.message || 'Unable to update password.');
      }
    } catch {
      setPwdError('Connection error. Please try again.');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleRevokeSession = async (tokenId: number) => {
    Alert.alert(
      'Sign Out Device',
      'Revoke access and log out this device from eYatra?',
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
              Alert.alert('Action Failed', res.message || 'Could not revoke session.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of eYatra?',
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

  const name = (profileData?.name as string) || session.user?.name || 'eYatra Commuter';
  const email = (profileData?.email as string) || session.user?.email || '';
  const phone = (profileData?.phone as string) || session.user?.phone || 'No phone added';
  const roleType = (profileData?.type as string) || session.user?.type || 'passenger';

  const avatarInitial = (name.trim().charAt(0) || 'U').toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {/* Branded Header */}
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <AppText style={styles.headerSubtitle}>eYatra Account</AppText>
            <AppText style={styles.headerTitle}>My Profile</AppText>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {loading && !refreshing && (
              <ActivityIndicator size="small" color={Palette.warmCream} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Profile"
              onPress={() => setEditModalVisible(true)}
              style={({ pressed }) => [
                styles.editHeaderBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
            <SymbolView
              name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              size={14}
              tintColor={Palette.warmCream}
            />
            <AppText style={styles.editHeaderText}>Edit</AppText>
          </Pressable>
        </View>
      </View>
    </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(true)}
            tintColor={Palette.crimsonRed}
          />
        }
      >
        {/* User Hero Profile Card */}
        <View
          style={[
            styles.heroProfileCard,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Avatar with crimson ring */}
          <View style={styles.avatarOuterRing}>
            <LinearGradient
              colors={[Palette.crimsonRed, Palette.deepMaroon]}
              style={styles.avatarInner}
            >
              <AppText style={styles.avatarLetter}>{avatarInitial}</AppText>
            </LinearGradient>
          </View>

          {/* User Details */}
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <AppText style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                {name}
              </AppText>
              <View style={styles.roleBadge}>
                <AppText style={styles.roleBadgeText}>
                  {roleType.toUpperCase()}
                </AppText>
              </View>
            </View>

            <View style={styles.userMetaItem}>
              <SymbolView
                name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                size={13}
                tintColor={Palette.slateBlue}
              />
              <AppText style={[styles.userMetaText, { color: theme.textSecondary }]} numberOfLines={1}>
                {email || 'No email attached'}
              </AppText>
            </View>

            <View style={styles.userMetaItem}>
              <SymbolView
                name={{ ios: 'phone.fill', android: 'phone', web: 'phone' }}
                size={13}
                tintColor={Palette.slateBlue}
              />
              <AppText style={[styles.userMetaText, { color: theme.textSecondary }]}>
                {phone}
              </AppText>
            </View>
          </View>
        </View>

        {/* Portal Switching if authorized */}
        {(roleType === 'super_admin' || roleType === 'company_admin' || roleType === 'driver') && (
          <View style={styles.section}>
            <AppText style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              Management Portal
            </AppText>
            <View
              style={[
                styles.optionsGroup,
                {
                  backgroundColor: theme.isDark ? '#002235' : Palette.white,
                  borderColor: theme.border,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  if (roleType === 'super_admin') router.push('/portal/admin' as any);
                  else if (roleType === 'company_admin') router.push('/portal/company' as any);
                  else if (roleType === 'driver') router.push('/portal/driver' as any);
                }}
                style={styles.optionRow}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconBox, { backgroundColor: 'rgba(0, 48, 73, 0.1)' }]}>
                    <SymbolView
                      name={{ ios: 'shield.fill', android: 'admin_panel_settings', web: 'admin_panel_settings' }}
                      size={18}
                      tintColor={Palette.prussianNavy}
                    />
                  </View>
                  <View>
                    <AppText style={[styles.optionTitle, { color: theme.text }]}>
                      {roleType === 'super_admin'
                        ? 'Super Admin Console'
                        : roleType === 'company_admin'
                        ? 'Company Fleet Portal'
                        : 'Driver Trip Console'}
                    </AppText>
                    <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                      Open management workspace
                    </AppText>
                  </View>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={theme.border}
                />
              </Pressable>
            </View>
          </View>
        )}

        {/* Security & Authentication Settings */}
        <View style={styles.section}>
          <AppText style={[styles.sectionHeading, { color: theme.textSecondary }]}>
            Security &amp; Passwords
          </AppText>
          <View
            style={[
              styles.optionsGroup,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                borderColor: theme.border,
              },
            ]}
          >
            {/* MPIN Setting */}
            {(roleType === 'passenger' || roleType === 'driver') && (
              <Pressable
                onPress={() => router.push('/security/mpin' as any)}
                style={[styles.optionRow, styles.divider, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconBox, { backgroundColor: 'rgba(193, 18, 31, 0.1)' }]}>
                    <SymbolView
                      name={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }}
                      size={18}
                      tintColor={Palette.crimsonRed}
                    />
                  </View>
                  <View>
                    <AppText style={[styles.optionTitle, { color: theme.text }]}>
                      Payment Security &amp; MPIN
                    </AppText>
                    <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                      Protect contactless bus payments
                    </AppText>
                  </View>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={theme.border}
                />
              </Pressable>
            )}

            {/* Change Password */}
            <Pressable
              onPress={() => setPwdModalVisible(true)}
              style={[styles.optionRow, styles.divider, { borderBottomColor: theme.borderLight }]}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(102, 155, 188, 0.12)' }]}>
                  <SymbolView
                    name={{ ios: 'key.fill', android: 'vpn_key', web: 'vpn_key' }}
                    size={18}
                    tintColor={Palette.slateBlue}
                  />
                </View>
                <View>
                  <AppText style={[styles.optionTitle, { color: theme.text }]}>
                    Change Password
                  </AppText>
                  <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                    Update your account login password
                  </AppText>
                </View>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={theme.border}
              />
            </Pressable>

            {/* Active Sessions */}
            <Pressable
              onPress={() => setSessionsModalVisible(true)}
              style={styles.optionRow}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(0, 48, 73, 0.08)' }]}>
                  <SymbolView
                    name={{ ios: 'laptopcomputer.and.iphone', android: 'devices', web: 'devices' }}
                    size={18}
                    tintColor={theme.isDark ? Palette.warmCream : Palette.prussianNavy}
                  />
                </View>
                <View>
                  <AppText style={[styles.optionTitle, { color: theme.text }]}>
                    Logged-in Devices
                  </AppText>
                  <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                    {sessions.length > 0 ? `${sessions.length} active sessions` : 'Manage signed-in devices'}
                  </AppText>
                </View>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={theme.border}
              />
            </Pressable>
          </View>
        </View>

        {/* Transit & Concession Services */}
        <View style={styles.section}>
          <AppText style={[styles.sectionHeading, { color: theme.textSecondary }]}>
            Commuter Preferences
          </AppText>
          <View
            style={[
              styles.optionsGroup,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                borderColor: theme.border,
              },
            ]}
          >
            {/* Notifications */}
            <Pressable
              onPress={() => router.push('/notifications' as any)}
              style={[styles.optionRow, styles.divider, { borderBottomColor: theme.borderLight }]}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(233, 185, 110, 0.2)' }]}>
                  <SymbolView
                    name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                    size={18}
                    tintColor="#C27803"
                  />
                </View>
                <View>
                  <AppText style={[styles.optionTitle, { color: theme.text }]}>
                    Notification Settings
                  </AppText>
                  <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                    Fare receipts &amp; ride alerts
                  </AppText>
                </View>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={theme.border}
              />
            </Pressable>

            {/* Student/Senior Concession */}
            {roleType === 'passenger' && (
              <Pressable
                onPress={() => router.push('/portal/concession' as any)}
                style={[styles.optionRow, styles.divider, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconBox, { backgroundColor: 'rgba(27, 138, 90, 0.12)' }]}>
                    <SymbolView
                      name={{ ios: 'person.text.rectangle', android: 'badge', web: 'badge' }}
                      size={18}
                      tintColor="#1B8A5A"
                    />
                  </View>
                  <View>
                    <AppText style={[styles.optionTitle, { color: theme.text }]}>
                      Fare Concession (Student / Senior)
                    </AppText>
                    <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                      Apply for subsidized bus fares
                    </AppText>
                  </View>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={theme.border}
                />
              </Pressable>
            )}

            {/* Help & Support */}
            <Pressable
              onPress={() => router.push('/support' as any)}
              style={styles.optionRow}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(102, 155, 188, 0.12)' }]}>
                  <SymbolView
                    name={{ ios: 'questionmark.circle.fill', android: 'help_outline', web: 'help_outline' }}
                    size={18}
                    tintColor={Palette.slateBlue}
                  />
                </View>
                <View>
                  <AppText style={[styles.optionTitle, { color: theme.text }]}>
                    Help &amp; Support Center
                  </AppText>
                  <AppText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                    Payment disputes &amp; FAQs
                  </AppText>
                </View>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={theme.border}
              />
            </Pressable>
          </View>
        </View>

        {/* Clean Sign Out Action Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign Out of eYatra"
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.signOutButton,
            {
              backgroundColor: theme.isDark ? 'rgba(193, 18, 31, 0.15)' : '#FFF1F2',
              borderColor: Palette.crimsonRed,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <SymbolView
            name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
            size={18}
            tintColor={Palette.crimsonRed}
          />
          <AppText style={styles.signOutText}>Sign Out of eYatra</AppText>
        </Pressable>

        {/* App Version Tag */}
        <View style={styles.versionWrap}>
          <AppText style={[styles.versionText, { color: theme.textMuted }]}>
            eYatra v1.0.0 • Digital Transit Nepal
          </AppText>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <AppText style={[styles.modalTitle, { color: theme.text }]}>
                Edit Account Details
              </AppText>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={theme.textMuted}
                />
              </Pressable>
            </View>

            {editError && (
              <View style={styles.modalAlertError}>
                <AppText style={styles.modalAlertText}>{editError}</AppText>
              </View>
            )}

            <View style={styles.modalField}>
              <AppText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Full Name
              </AppText>
              <AppTextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.isDark ? '#001824' : '#FAF4EB',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={nameInput}
                onChangeText={(val) => {
                  setNameInput(val);
                  setEditError(null);
                }}
                placeholder="Enter full name"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.modalField}>
              <AppText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Mobile Phone
              </AppText>
              <AppTextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.isDark ? '#001824' : '#FAF4EB',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="98XXXXXXXX"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <Pressable
              onPress={() => void handleSaveProfile()}
              disabled={savingProfile}
              style={[
                styles.modalSubmitButton,
                { opacity: savingProfile ? 0.7 : 1 },
              ]}
            >
              <LinearGradient
                colors={[Palette.crimsonRed, Palette.deepMaroon]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalSubmitGradient}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color={Palette.white} />
                ) : (
                  <AppText style={styles.modalSubmitText}>Save Changes</AppText>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={pwdModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <AppText style={[styles.modalTitle, { color: theme.text }]}>
                Change Password
              </AppText>
              <Pressable onPress={() => setPwdModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={theme.textMuted}
                />
              </Pressable>
            </View>

            {pwdError && (
              <View style={styles.modalAlertError}>
                <AppText style={styles.modalAlertText}>{pwdError}</AppText>
              </View>
            )}

            {pwdSuccess && (
              <View style={styles.modalAlertSuccess}>
                <AppText style={styles.modalAlertSuccessText}>{pwdSuccess}</AppText>
              </View>
            )}

            <View style={styles.modalField}>
              <AppText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Current Password
              </AppText>
              <AppTextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.isDark ? '#001824' : '#FAF4EB',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={currentPwd}
                onChangeText={setCurrentPwd}
                placeholder="Enter current password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.modalField}>
              <AppText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                New Password
              </AppText>
              <AppTextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.isDark ? '#001824' : '#FAF4EB',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder="Min. 8 characters"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.modalField}>
              <AppText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Confirm New Password
              </AppText>
              <AppTextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.isDark ? '#001824' : '#FAF4EB',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                placeholder="Re-enter new password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
              />
            </View>

            <Pressable
              onPress={() => void handleChangePassword()}
              disabled={changingPwd}
              style={[
                styles.modalSubmitButton,
                { opacity: changingPwd ? 0.7 : 1 },
              ]}
            >
              <LinearGradient
                colors={[Palette.crimsonRed, Palette.deepMaroon]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalSubmitGradient}
              >
                {changingPwd ? (
                  <ActivityIndicator size="small" color={Palette.white} />
                ) : (
                  <AppText style={styles.modalSubmitText}>Update Password</AppText>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Logged-in Devices Sheet Modal */}
      <Modal visible={sessionsModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                paddingBottom: insets.bottom + 20,
                maxHeight: '80%',
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View>
                <AppText style={[styles.modalTitle, { color: theme.text }]}>
                  Active Devices ({sessions.length})
                </AppText>
                <AppText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  Devices currently authorized on your eYatra account
                </AppText>
              </View>
              <Pressable onPress={() => setSessionsModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={theme.textMuted}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {sessions.length > 0 ? (
                sessions.map((sess) => (
                  <View
                    key={sess.id}
                    style={[
                      styles.deviceSessionCard,
                      {
                        backgroundColor: theme.isDark ? '#001A29' : '#FAF4EB',
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.deviceSessionLeft}>
                      <SymbolView
                        name={{
                          ios: sess.is_current ? 'laptopcomputer.and.iphone' : 'iphone',
                          android: sess.is_current ? 'devices' : 'smartphone',
                          web: sess.is_current ? 'devices' : 'smartphone',
                        }}
                        size={20}
                        tintColor={sess.is_current ? Palette.crimsonRed : theme.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={styles.deviceTitleRow}>
                          <AppText style={[styles.deviceName, { color: theme.text }]} numberOfLines={1}>
                            {sess.name || 'Mobile App / Browser'}
                          </AppText>
                          {sess.is_current && (
                            <View style={styles.currentDeviceBadge}>
                              <AppText style={styles.currentDeviceText}>THIS DEVICE</AppText>
                            </View>
                          )}
                        </View>
                        <AppText style={[styles.deviceMeta, { color: theme.textMuted }]}>
                          Last active: {sess.last_used_at ? new Date(sess.last_used_at).toLocaleDateString() : 'Now'}
                        </AppText>
                      </View>
                    </View>

                    {!sess.is_current && (
                      <Pressable
                        onPress={() => void handleRevokeSession(sess.id)}
                        style={styles.revokeButton}
                      >
                        <AppText style={styles.revokeButtonText}>Sign Out</AppText>
                      </Pressable>
                    )}
                  </View>
                ))
              ) : (
                <AppText style={[styles.noDevicesText, { color: theme.textMuted }]}>
                  No active remote sessions found.
                </AppText>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    color: Palette.slateBlue,
    fontFamily: FontFamilies.medium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: Palette.warmCream,
    fontFamily: FontFamilies.extraBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  editHeaderText: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
    color: Palette.warmCream,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 18,
  },
  heroProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarOuterRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 2.5,
    borderWidth: 2,
    borderColor: Palette.crimsonRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 24,
    color: Palette.white,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userName: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(193, 18, 31, 0.12)',
  },
  roleBadgeText: {
    fontFamily: FontFamilies.bold,
    fontSize: 10,
    color: Palette.crimsonRed,
    letterSpacing: 0.5,
  },
  userMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userMetaText: {
    fontFamily: FontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontFamily: FontFamilies.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  optionsGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divider: {
    borderBottomWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  optionSubtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  signOutText: {
    fontFamily: FontFamilies.bold,
    fontSize: 14,
    color: Palette.crimsonRed,
  },
  versionWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  versionText: {
    fontFamily: FontFamilies.medium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 19,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  modalAlertError: {
    backgroundColor: '#FDF0D5',
    borderColor: Palette.crimsonRed,
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
  },
  modalAlertText: {
    color: Palette.crimsonRed,
    fontFamily: FontFamilies.medium,
    fontSize: 12,
  },
  modalAlertSuccess: {
    backgroundColor: '#E7F6ED',
    borderColor: '#1B8A5A',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
  },
  modalAlertSuccessText: {
    color: '#1B8A5A',
    fontFamily: FontFamilies.bold,
    fontSize: 12,
  },
  modalField: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: FontFamilies.bold,
    fontSize: 12,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  modalSubmitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
  },
  modalSubmitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontFamily: FontFamilies.bold,
    fontSize: 15,
    color: Palette.white,
  },
  deviceSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  deviceSessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceName: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
  },
  currentDeviceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(27, 138, 90, 0.12)',
  },
  currentDeviceText: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 9,
    color: '#1B8A5A',
    letterSpacing: 0.4,
  },
  deviceMeta: {
    fontFamily: FontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  revokeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(193, 18, 31, 0.1)',
  },
  revokeButtonText: {
    fontFamily: FontFamilies.bold,
    fontSize: 11,
    color: Palette.crimsonRed,
  },
  noDevicesText: {
    fontFamily: FontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
});

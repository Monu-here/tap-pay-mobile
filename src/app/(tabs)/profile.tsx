import { StatusBar } from 'expo-status-bar';
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
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';
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
    loadData();
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
      } else {
        setEditError(res.message || 'Unable to update profile.');
      }
    } catch {
      setEditError('Network error updating profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      setPwdError('Current and new password are required.');
      return;
    }
    if (newPwd.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Passwords do not match.');
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
        setPwdError(res.message || 'Incorrect current password or invalid request.');
      }
    } catch {
      setPwdError('Network error changing password.');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleRevokeSession = async (tokenId: number) => {
    try {
      const res = await destroySession(tokenId);
      if (res.ok) {
        await loadData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not revoke session.');
      }
    } catch {
      Alert.alert('Error', 'Connection error revoking session.');
    }
  };

  const handleRevokeAllOther = async () => {
    Alert.alert(
      'Sign Out All Other Devices',
      'This will disconnect all other phones or browsers currently logged into your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Others',
          style: 'destructive',
          onPress: async () => {
            const res = await logoutAll();
            if (res.ok) {
              Alert.alert('Success', `Signed out of ${res.data?.sessions_revoked ?? 0} other sessions.`);
              await loadData(true);
            }
          },
        },
      ],
    );
  };

  const userType = session.user?.type || (profileData as any)?.type;
  const userName = (profileData as any)?.name || session.user?.name || 'Passenger';
  const userEmail = (profileData as any)?.email || session.user?.email || '';
  const userPhone = (profileData as any)?.phone || session.user?.phone || 'Not set';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account &amp; Security</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditModalVisible(true)}
          style={styles.editBtn}
        >
          <SymbolView
            name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
            size={18}
            tintColor={Brand.primary}
          />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={Brand.teal.primary} />
        }
      >
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarLetter}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileTextGroup}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
            <Text style={styles.profilePhone}>{userPhone}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{(userType || 'passenger').toUpperCase()}</Text>
          </View>
        </View>

        {/* Role Portals Section (Only for Admin, Company Admin, or Driver) */}
        {(userType === 'super_admin' || userType === 'company_admin' || userType === 'driver') && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Management Portals</Text>
            <View style={styles.portalCard}>
              {userType === 'super_admin' && (
                <Pressable
                  onPress={() => router.push('/portal/admin' as any)}
                  style={styles.portalRow}
                >
                  <View style={[styles.portalIcon, { backgroundColor: '#EFF6FF' }]}>
                    <SymbolView
                      name={{ ios: 'shield.fill', android: 'security', web: 'security' }}
                      size={22}
                      tintColor="#2563EB"
                    />
                  </View>
                  <View style={styles.portalInfo}>
                    <Text style={styles.portalTitle}>Super-Admin Platform Portal</Text>
                    <Text style={styles.portalSubtitle}>Manage companies, users, audit logs &amp; system</Text>
                  </View>
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={18}
                    tintColor={Brand.textSecondary}
                  />
                </Pressable>
              )}

              {userType === 'company_admin' && (
                <Pressable
                  onPress={() => router.push('/portal/company' as any)}
                  style={styles.portalRow}
                >
                  <View style={[styles.portalIcon, { backgroundColor: '#F0FDF4' }]}>
                    <SymbolView
                      name={{ ios: 'building.2.fill', android: 'domain', web: 'domain' }}
                      size={22}
                      tintColor="#16A34A"
                    />
                  </View>
                  <View style={styles.portalInfo}>
                    <Text style={styles.portalTitle}>Transport Company Portal</Text>
                    <Text style={styles.portalSubtitle}>Fleet buses, drivers, routes, settlements</Text>
                  </View>
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={18}
                    tintColor={Brand.textSecondary}
                  />
                </Pressable>
              )}

              {userType === 'driver' && (
                <Pressable
                  onPress={() => router.push('/portal/driver' as any)}
                  style={styles.portalRow}
                >
                  <View style={[styles.portalIcon, { backgroundColor: '#FEF3C7' }]}>
                    <SymbolView
                      name={{ ios: 'steeringwheel', android: 'drive_eta', web: 'drive_eta' }}
                      size={22}
                      tintColor="#D97706"
                    />
                  </View>
                  <View style={styles.portalInfo}>
                    <Text style={styles.portalTitle}>Driver Shift Console</Text>
                    <Text style={styles.portalSubtitle}>Assigned bus, active trips &amp; location broadcast</Text>
                  </View>
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={18}
                    tintColor={Brand.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Security Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Security &amp; Credentials</Text>
          <View style={styles.optionsCard}>
            <Pressable
              onPress={() => {
                setPwdError(null);
                setPwdSuccess(null);
                setPwdModalVisible(true);
              }}
              style={styles.optionRow}
            >
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'key.fill', android: 'vpn_key', web: 'vpn_key' }}
                  size={20}
                  tintColor={Brand.primary}
                />
                <Text style={styles.optionText}>Change Password</Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={Brand.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={handleRevokeAllOther}
              style={[styles.optionRow, styles.rowBorder]}
            >
              <View style={styles.optionLeft}>
                <SymbolView
                  name={{ ios: 'shield.slash.fill', android: 'security_update_warning', web: 'security_update_warning' }}
                  size={20}
                  tintColor="#D97706"
                />
                <Text style={styles.optionText}>Sign Out All Other Devices</Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={Brand.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* Active Connected Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Active Device Sessions</Text>
          <View style={styles.optionsCard}>
            {sessions.map((sess, idx) => (
              <View key={sess.id} style={[styles.sessionRow, idx > 0 && styles.rowBorder]}>
                <View style={styles.sessionLeft}>
                  <SymbolView
                    name={{
                      ios: sess.is_current ? 'iphone.badge.checkmark' : 'laptopcomputer',
                      android: sess.is_current ? 'phone_iphone' : 'laptop',
                      web: sess.is_current ? 'phone_iphone' : 'laptop',
                    }}
                    size={20}
                    tintColor={sess.is_current ? '#16A34A' : Brand.textSecondary}
                  />
                  <View>
                    <View style={styles.sessionTitleRow}>
                      <Text style={styles.sessionDeviceName}>{sess.name || 'Mobile App'}</Text>
                      {sess.is_current && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>THIS DEVICE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sessionMeta}>
                      Last active: {sess.last_used_at ? new Date(sess.last_used_at).toLocaleDateString() : 'Active now'}
                    </Text>
                  </View>
                </View>

                {!sess.is_current && (
                  <Pressable
                    onPress={() => handleRevokeSession(sess.id)}
                    style={styles.revokeBtn}
                  >
                    <Text style={styles.revokeBtnText}>Revoke</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Sign Out Button */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out of Tap & Pay?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: () => void logout(),
                },
              ],
            );
          }}
          style={styles.logoutButton}
        >
          <SymbolView
            name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
            size={18}
            tintColor="#DC2626"
          />
          <Text style={styles.logoutButtonText}>Sign Out of Tap &amp; Pay</Text>
        </Pressable>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={nameInput}
                  onChangeText={(val) => {
                    setNameInput(val);
                    setEditError(null);
                  }}
                  placeholder="Your Name"
                  placeholderTextColor={Brand.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor={Brand.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              {editError && <Text style={styles.errorText}>{editError}</Text>}

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
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => setPwdModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPwd}
                  onChangeText={(val) => {
                    setCurrentPwd(val);
                    setPwdError(null);
                  }}
                  placeholder="Enter current password"
                  placeholderTextColor={Brand.textSecondary}
                  secureTextEntry
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPwd}
                  onChangeText={(val) => {
                    setNewPwd(val);
                    setPwdError(null);
                  }}
                  placeholder="At least 8 characters"
                  placeholderTextColor={Brand.textSecondary}
                  secureTextEntry
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPwd}
                  onChangeText={(val) => {
                    setConfirmPwd(val);
                    setPwdError(null);
                  }}
                  placeholder="Repeat new password"
                  placeholderTextColor={Brand.textSecondary}
                  secureTextEntry
                />
              </View>

              {pwdError && <Text style={styles.errorText}>{pwdError}</Text>}
              {pwdSuccess && <Text style={styles.successText}>{pwdSuccess}</Text>}

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
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  profileCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.teal.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 26,
    fontWeight: '800',
    color: Brand.white,
  },
  profileTextGroup: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  profileEmail: {
    fontSize: 13,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.textSecondary,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  portalCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  portalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalInfo: {
    flex: 1,
  },
  portalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  portalSubtitle: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  optionsCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    fontSize: 15,
    fontWeight: '600',
    color: Brand.text,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  currentBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  sessionMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  revokeBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
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
  modalForm: {
    gap: Spacing.three,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.text,
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
  successText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '600',
  },
  modalActionBtn: {
    marginTop: Spacing.two,
  },
});

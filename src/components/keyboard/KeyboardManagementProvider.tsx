import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import {
  findNodeHandle,
  Keyboard,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

type InputRegistration = (
  input: React.ElementRef<typeof TextInput>,
  register: boolean,
) => void;

const InputRegistrationContext = createContext<InputRegistration>(() => {});

export function useKeyboardInputRegistration() {
  return useContext(InputRegistrationContext);
}

export function KeyboardManagementProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const inputs = useRef(new Set<React.ElementRef<typeof TextInput>>());
  const keyboardVisible = useRef(false);

  const registerInput = useCallback<InputRegistration>((input, register) => {
    if (register) inputs.current.add(input);
    else inputs.current.delete(input);
  }, []);

  const handleTouchStartCapture = useCallback((event: GestureResponderEvent) => {
    if (!keyboardVisible.current) return;

    const touchedInput = Array.from(inputs.current).some(
      (input) => findNodeHandle(input) === event.nativeEvent.target,
    );
    if (!touchedInput) Keyboard.dismiss();
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisible.current = true;
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisible.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    Keyboard.dismiss();
  }, [pathname]);

  return (
    <InputRegistrationContext.Provider value={registerInput}>
      <View style={styles.container} onTouchStartCapture={handleTouchStartCapture}>
        {children}
      </View>
    </InputRegistrationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

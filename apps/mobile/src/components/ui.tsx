import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "@/lib/theme";

export function Screen({
  title,
  children,
  scroll = true,
  onRefresh,
}: {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const body = (
    <>
      {title ? (
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </>
  );
  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                tintColor={colors.bordeaux}
                onRefresh={async () => {
                  setRefreshing(true);
                  await onRefresh();
                  setRefreshing(false);
                }}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        <View style={s.content}>{body}</View>
      )}
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        variant === "ghost" && s.ghost,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.buttonText, variant === "ghost" && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: space.m }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.stone}
        style={s.input}
        {...props}
      />
    </View>
  );
}

export function Card({
  children,
  onPress,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  label?: string;
}) {
  if (!onPress) return <View style={s.card}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { borderColor: colors.bordeaux }]}
    >
      {children}
    </Pressable>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => (
  <Text style={s.muted}>{children}</Text>
);
export const Strong = ({ children }: { children: ReactNode }) => (
  <Text style={s.strong}>{children}</Text>
);
export const H2 = ({ children }: { children: ReactNode }) => (
  <Text accessibilityRole="header" style={s.h2}>
    {children}
  </Text>
);
export const ErrorText = ({ children }: { children: ReactNode }) =>
  children ? (
    <Text accessibilityRole="alert" style={s.error}>
      {children}
    </Text>
  ) : null;
export const Loading = () => (
  <ActivityIndicator color={colors.bordeaux} style={{ marginTop: space.l }} />
);

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space.m, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: "700", color: colors.ink, marginBottom: space.m },
  h2: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginTop: space.l,
    marginBottom: space.s,
  },
  button: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: space.s,
  },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  buttonText: { color: colors.paper, fontWeight: "700", fontSize: 16 },
  label: { fontWeight: "600", color: colors.ink, marginBottom: 4 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.ink,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: space.m,
    marginBottom: space.s,
    backgroundColor: "#fff",
  },
  muted: { color: colors.stone, fontSize: 14 },
  strong: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  error: { color: colors.bordeaux, fontWeight: "600", marginTop: space.s },
});

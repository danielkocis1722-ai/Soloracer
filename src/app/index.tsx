import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

const actions = [
  { href: "/drive", title: "Drive", subtitle: "Open the live timing screen" },
  { href: "/create-trail", title: "Create Trail", subtitle: "Record a new route with GPS" },
  { href: "/trails", title: "My Trails", subtitle: "Saved routes and future checkpoints" }
] as const;

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SOLO · GPS · RALLY</Text>
        <Text style={styles.title}>Own the route.</Text>
        <Text style={styles.subtitle}>
          Offline-first GPS timing, checkpoint splits and rally-style navigation.
        </Text>
      </View>

      <View style={styles.actions}>
        {actions.map((action) => (
          <Link key={action.href} href={action.href} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardSubtitle}>{action.subtitle}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Text style={styles.footer}>
        Starter build · foreground GPS only
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 24, backgroundColor: colors.background },
  hero: { paddingTop: 28, gap: 10 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 38, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 520 },
  actions: { gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 6
  },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 20 },
  cardSubtitle: { color: colors.muted, fontSize: 14 },
  footer: { marginTop: "auto", color: colors.muted, textAlign: "center", fontSize: 12 }
});

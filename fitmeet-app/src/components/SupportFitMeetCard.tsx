import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import Purchases, {
  PURCHASE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases'

import { revenueCatKeyStatus, SUPPORT_PRODUCT_IDS } from '@/src/lib/revenuecat'
import { palette, spacing } from '@/src/theme'

type Props = {
  title?: string
  subtitle?: string
  onPurchased?: (productId: string) => void
}

const PRODUCT_COPY: Record<string, { title: string; note: string }> = {
  beer_small: { title: 'Small beer', note: 'A small thank-you' },
  beer_medium: { title: 'Round for the team', note: 'Helps a lot' },
  beer_large: { title: 'Legendary beer', note: 'Fuel for future features' },
}

export function SupportFitMeetCard({
  title = 'Buy me a beer',
  subtitle = 'FitMeet stays free. Support future development if you feel like it.',
  onPurchased,
}: Props) {
  const [products, setProducts] = useState<PurchasesStoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [thanksMessage, setThanksMessage] = useState<string | null>(null)

  const revenueCatReady = revenueCatKeyStatus().enabled

  const orderedProducts = useMemo(() => {
    const order = new Map(SUPPORT_PRODUCT_IDS.map((id, index) => [id, index]))
    return [...products].sort((a, b) => (order.get(a.identifier) ?? 99) - (order.get(b.identifier) ?? 99))
  }, [products])

  useEffect(() => {
    let alive = true

    async function load() {
      if (!revenueCatReady) {
        setLoading(false)
        return
      }

      try {
        const found = await Purchases.getProducts([...SUPPORT_PRODUCT_IDS], PURCHASE_TYPE.INAPP)
        if (alive) setProducts(found)
      } catch {
        if (alive) setProducts([])
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [revenueCatReady])

  async function handlePurchase(product: PurchasesStoreProduct) {
    setPurchasingId(product.identifier)
    try {
      await Purchases.purchaseProduct(product.identifier, undefined, PURCHASE_TYPE.INAPP)
      setThanksMessage(`Thanks for supporting FitMeet with ${product.priceString}.`)
      onPurchased?.(product.identifier)
    } catch (error) {
      const purchaseError = error as PurchasesError
      if (
        purchaseError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
        purchaseError?.userCancelled
      ) {
        return
      }
      if (purchaseError?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        Alert.alert('Pending', 'Your purchase is pending confirmation in Google Play.')
        return
      }
      Alert.alert('Purchase failed', purchaseError?.message ?? 'Could not complete the purchase right now.')
    } finally {
      setPurchasingId(null)
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="beer-outline" size={18} color="#f6c65b" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {thanksMessage ? <Text style={styles.success}>{thanksMessage}</Text> : null}

      {!revenueCatReady ? (
        <Text style={styles.hint}>
          Add the RevenueCat Google public API key in app config to enable support purchases.
        </Text>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.hint}>Loading support options...</Text>
        </View>
      ) : orderedProducts.length === 0 ? (
        <Text style={styles.hint}>
          Support products are not available yet. Check that the same product IDs are connected in RevenueCat.
        </Text>
      ) : (
        <View style={styles.options}>
          {orderedProducts.map((product) => {
            const copy = PRODUCT_COPY[product.identifier] ?? { title: product.title, note: product.description }
            const busy = purchasingId === product.identifier
            return (
              <Pressable
                key={product.identifier}
                style={[styles.optionBtn, busy && styles.optionBtnBusy]}
                onPress={() => handlePurchase(product)}
                disabled={busy}
              >
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{copy.title}</Text>
                  <Text style={styles.optionNote}>{copy.note}</Text>
                </View>
                {busy ? (
                  <ActivityIndicator size="small" color="#041109" />
                ) : (
                  <Text style={styles.optionPrice}>{product.priceString}</Text>
                )}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,198,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(246,198,91,0.28)',
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: palette.text, fontSize: 15, fontWeight: '800' },
  subtitle: { color: palette.textDim, fontSize: 13, lineHeight: 18 },
  hint: { color: palette.textDim, fontSize: 13, lineHeight: 18 },
  success: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  options: { gap: 10 },
  optionBtn: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionBtnBusy: { opacity: 0.85 },
  optionText: { flex: 1, gap: 1 },
  optionTitle: { color: '#041109', fontSize: 14, fontWeight: '800' },
  optionNote: { color: 'rgba(4,17,9,0.74)', fontSize: 12, fontWeight: '600' },
  optionPrice: { color: '#041109', fontSize: 14, fontWeight: '900' },
})

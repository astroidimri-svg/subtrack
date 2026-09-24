import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@subtrack_subscriptions_v1";

const COLORS = {
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  border: "#E2E8F0",
  danger: "#DC2626",
  success: "#16A34A"
};

const CATEGORIES = [
  "Streaming",
  "Music",
  "Software",
  "Gaming",
  "Education",
  "Fitness",
  "Cloud",
  "Other"
];

const CYCLES = [
  "Weekly",
  "Monthly",
  "Quarterly",
  "Yearly"
];

function formatMoney(value, currency = "₦") {
  const number = Number(value) || 0;

  return (
    currency +
    number.toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  );
}

function monthlyEquivalent(subscription) {
  const price = Number(subscription.price) || 0;

  switch (subscription.cycle) {
    case "Weekly":
      return (price * 52) / 12;

    case "Quarterly":
      return price / 3;

    case "Yearly":
      return price / 12;

    default:
      return price;
  }
}

function yearlyEquivalent(subscription) {
  return monthlyEquivalent(subscription) * 12;
}

function daysUntil(dateString) {
  if (!dateString) return 9999;

  const target = new Date(dateString + "T12:00:00");

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return Math.ceil(
    (target - today) / 86400000
  );
}

function formatDate(dateString) {
  if (!dateString) return "No date";

  const date = new Date(dateString + "T12:00:00");

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export default function App() {
  const [subscriptions, setSubscriptions] = useState([]);

  const [loaded, setLoaded] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState("All");

  const [name, setName] = useState("");

  const [price, setPrice] = useState("");

  const [currency, setCurrency] = useState("₦");

  const [cycle, setCycle] = useState("Monthly");

  const [category, setCategory] = useState("Streaming");

  const [nextPayment, setNextPayment] = useState("");

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    if (!loaded) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(subscriptions)
    ).catch(() => {});
  }, [subscriptions, loaded]);

  async function loadSubscriptions() {
    try {
      const saved = await AsyncStorage.getItem(
        STORAGE_KEY
      );

      if (saved) {
        setSubscriptions(JSON.parse(saved));
      }
    } catch (error) {
      Alert.alert(
        "Storage error",
        "We could not load your subscriptions."
      );
    } finally {
      setLoaded(true);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setPrice("");
    setCurrency("₦");
    setCycle("Monthly");
    setCategory("Streaming");
    setNextPayment("");
  }

  function openAdd() {
    resetForm();
    setModalVisible(true);
  }

  function openEdit(subscription) {
    setEditingId(subscription.id);
    setName(subscription.name);
    setPrice(String(subscription.price));
    setCurrency(subscription.currency || "₦");
    setCycle(subscription.cycle);
    setCategory(subscription.category);
    setNextPayment(subscription.nextPayment);

    setModalVisible(true);
  }

  function saveSubscription() {
    const cleanName = name.trim();

    const numericPrice = Number(price);

    if (!cleanName) {
      Alert.alert(
        "Missing name",
        "Enter a subscription name."
      );
      return;
    }

    if (
      !price ||
      Number.isNaN(numericPrice) ||
      numericPrice <= 0
    ) {
      Alert.alert(
        "Invalid price",
        "Enter a valid subscription price."
      );
      return;
    }

    if (!validDate(nextPayment)) {
      Alert.alert(
        "Invalid date",
        "Use YYYY-MM-DD, for example 2026-09-30."
      );
      return;
    }

    const subscription = {
      id: editingId || String(Date.now()),
      name: cleanName,
      price: numericPrice,
      currency: currency.trim() || "₦",
      cycle,
      category,
      nextPayment,
      active: true
    };

    if (editingId) {
      setSubscriptions((previous) =>
        previous.map((item) =>
          item.id === editingId
            ? subscription
            : item
        )
      );
    } else {
      setSubscriptions((previous) => [
        subscription,
        ...previous
      ]);
    }

    setModalVisible(false);

    resetForm();
  }

  function deleteSubscription(id) {
    Alert.alert(
      "Delete subscription?",
      "This will remove the subscription from SubTrack.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setSubscriptions((previous) =>
              previous.filter(
                (item) => item.id !== id
              )
            );
          }
        }
      ]
    );
  }

  const activeSubscriptions = subscriptions.filter(
    (item) => item.active
  );

  const monthlyTotal = useMemo(() => {
    return activeSubscriptions.reduce(
      (total, item) =>
        total + monthlyEquivalent(item),
      0
    );
  }, [activeSubscriptions]);

  const yearlyTotal = useMemo(() => {
    return activeSubscriptions.reduce(
      (total, item) =>
        total + yearlyEquivalent(item),
      0
    );
  }, [activeSubscriptions]);

  const upcoming = useMemo(() => {
    return [...activeSubscriptions]
      .sort(
        (a, b) =>
          daysUntil(a.nextPayment) -
          daysUntil(b.nextPayment)
      )
      .slice(0, 3);
  }, [activeSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    return activeSubscriptions
      .filter(
        (item) =>
          filter === "All" ||
          item.category === filter
      )
      .filter((item) =>
        item.name
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort(
        (a, b) =>
          daysUntil(a.nextPayment) -
          daysUntil(b.nextPayment)
      );
  }, [
    activeSubscriptions,
    filter,
    search
  ]);

  const categoryTotals = useMemo(() => {
    const totals = {};

    activeSubscriptions.forEach((item) => {
      if (!totals[item.category]) {
        totals[item.category] = 0;
      }

      totals[item.category] +=
        monthlyEquivalent(item);
    });

    return Object.entries(totals).sort(
      (a, b) => b[1] - a[1]
    );
  }, [activeSubscriptions]);

  function renderSubscription({ item }) {
    const days = daysUntil(
      item.nextPayment
    );

    let dueText;

    if (days < 0) {
      dueText = "Overdue";
    } else if (days === 0) {
      dueText = "Due today";
    } else if (days === 1) {
      dueText = "Tomorrow";
    } else {
      dueText = `In ${days} days`;
    }

    return (
      <Pressable
        style={styles.subscriptionCard}
        onPress={() => openEdit(item)}
      >
        <View style={styles.subscriptionIcon}>
          <Text style={styles.subscriptionIconText}>
            {item.name
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>

        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionName}>
            {item.name}
          </Text>

          <Text style={styles.subscriptionMeta}>
            {item.category} · {item.cycle}
          </Text>

          <Text style={styles.subscriptionDate}>
            {formatDate(item.nextPayment)} ·{" "}
            {dueText}
          </Text>
        </View>

        <View style={styles.subscriptionPrice}>
          <Text style={styles.priceText}>
            {formatMoney(
              item.price,
              item.currency
            )}
          </Text>

          <Text style={styles.priceCycle}>
            /
            {item.cycle === "Yearly"
              ? "yr"
              : item.cycle === "Weekly"
              ? "wk"
              : item.cycle === "Quarterly"
              ? "qtr"
              : "mo"}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>
            SubTrack
          </Text>

          <Text style={styles.subtitle}>
            Subscription Tracker
          </Text>
        </View>

        <Pressable
          style={styles.addHeaderButton}
          onPress={openAdd}
        >
          <Text style={styles.addHeaderText}>
            +
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredSubscriptions}
        keyExtractor={(item) => item.id}
        renderItem={renderSubscription}
        contentContainerStyle={
          styles.listContent
        }
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>
                Monthly spending
              </Text>

              <Text style={styles.heroAmount}>
                {formatMoney(monthlyTotal)}
              </Text>

              <View
                style={styles.heroDivider}
              />

              <View style={styles.heroStats}>
                <View>
                  <Text
                    style={
                      styles.heroStatLabel
                    }
                  >
                    Yearly estimate
                  </Text>

                  <Text
                    style={
                      styles.heroStatValue
                    }
                  >
                    {formatMoney(yearlyTotal)}
                  </Text>
                </View>

                <View>
                  <Text
                    style={
                      styles.heroStatLabel
                    }
                  >
                    Active
                  </Text>

                  <Text
                    style={
                      styles.heroStatValue
                    }
                  >
                    {
                      activeSubscriptions.length
                    }
                  </Text>
                </View>
              </View>
            </View>

            {upcoming.length > 0 && (
              <View style={styles.section}>
                <View
                  style={
                    styles.sectionTitleRow
                  }
                >
                  <Text
                    style={styles.sectionTitle}
                  >
                    Upcoming payments
                  </Text>

                  <Text
                    style={styles.sectionHint}
                  >
                    Next 3
                  </Text>
                </View>

                {upcoming.map((item) => (
                  <Pressable
                    key={item.id}
                    style={
                      styles.upcomingRow
                    }
                    onPress={() =>
                      openEdit(item)
                    }
                  >
                    <View
                      style={
                        styles.upcomingDot
                      }
                    />

                    <View
                      style={
                        styles.upcomingInfo
                      }
                    >
                      <Text
                        style={
                          styles.upcomingName
                        }
                      >
                        {item.name}
                      </Text>

                      <Text
                        style={
                          styles.upcomingDate
                        }
                      >
                        {formatDate(
                          item.nextPayment
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.upcomingPrice
                      }
                    >
                      {formatMoney(
                        item.price,
                        item.currency
                      )}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <View
                style={
                  styles.sectionTitleRow
                }
              >
                <Text
                  style={styles.sectionTitle}
                >
                  Your subscriptions
                </Text>

                <Text
                  style={styles.sectionHint}
                >
                  {activeSubscriptions.length}{" "}
                  total
                </Text>
              </View>

              <TextInput
                style={styles.search}
                placeholder="Search subscriptions"
                placeholderTextColor={
                  COLORS.muted
                }
                value={search}
                onChangeText={setSearch}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
              >
                {[
                  "All",
                  ...CATEGORIES
                ].map((option) => (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setFilter(option)
                    }
                    style={[
                      styles.filterChip,
                      filter === option &&
                        styles.filterChipActive
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        filter === option &&
                          styles.filterTextActive
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {categoryTotals.length >
              0 && (
              <View
                style={styles.statsCard}
              >
                <Text
                  style={styles.statsTitle}
                >
                  Monthly spending by category
                </Text>

                {categoryTotals
                  .slice(0, 5)
                  .map(
                    ([categoryName, total]) => (
                      <View
                        key={categoryName}
                        style={
                          styles.categoryRow
                        }
                      >
                        <Text
                          style={
                            styles.categoryName
                          }
                        >
                          {categoryName}
                        </Text>

                        <Text
                          style={
                            styles.categoryAmount
                          }
                        >
                          {formatMoney(total)}
                        </Text>
                      </View>
                    )
                  )}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              ◷
            </Text>

            <Text style={styles.emptyTitle}>
              No subscriptions yet
            </Text>

            <Text style={styles.emptyText}>
              Add your first subscription to
              start tracking recurring payments
              and spending.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={openAdd}
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Add subscription
              </Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          filteredSubscriptions.length >
          0 ? (
            <View
              style={styles.footerHint}
            >
              <Text
                style={styles.footerText}
              >
                Tap a subscription to edit it.
              </Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View style={styles.modalCard}>
            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                {editingId
                  ? "Edit subscription"
                  : "Add subscription"}
              </Text>

              <Pressable
                onPress={() =>
                  setModalVisible(false)
                }
              >
                <Text
                  style={styles.closeText}
                >
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text
                style={styles.inputLabel}
              >
                Subscription name
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. Netflix"
                placeholderTextColor={
                  COLORS.muted
                }
                value={name}
                onChangeText={setName}
              />

              <Text
                style={styles.inputLabel}
              >
                Price
              </Text>

              <View
                style={
                  styles.priceInputRow
                }
              >
                <TextInput
                  style={[
                    styles.input,
                    styles.currencyInput
                  ]}
                  value={currency}
                  onChangeText={setCurrency}
                  maxLength={3}
                  autoCapitalize="characters"
                />

                <TextInput
                  style={[
                    styles.input,
                    styles.priceField
                  ]}
                  placeholder="0"
                  placeholderTextColor={
                    COLORS.muted
                  }
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <Text
                style={styles.inputLabel}
              >
                Billing cycle
              </Text>

              <View
                style=

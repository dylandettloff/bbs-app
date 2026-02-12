import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import axios from 'axios';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CounselorStack from './src/navigation/CounselorStack';

const API_URL = 'http://localhost:1337';
const Tab = createBottomTabNavigator();

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

/* ---------- helpers ---------- */
function pick(item: any, key: string) {
  return item?.[key] ?? item?.attributes?.[key];
}

function safeList(payload: any): any[] {
  const d = payload?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Invalid date';
  return new Date(ts).toLocaleString();
}

function stripHtml(input?: string) {
  if (!input) return '';
  return String(input)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/div>|<\/p>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function richTextToPlain(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') return stripHtml(input);

  const texts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'object') {
      if (typeof node.text === 'string') texts.push(node.text);
      Object.values(node).forEach(walk);
    }
  };
  walk(input);
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

function absUrl(maybeRelative?: string | null) {
  if (!maybeRelative) return null;
  const s = String(maybeRelative);
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `${API_URL}${s}`;
}

function getPressImageUrls(pressItem: any): string[] {
  const img = pick(pressItem, 'image');
  const data = img?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((m: any) => absUrl(m?.attributes?.url))
    .filter(Boolean) as string[];
}

function isStaffOnlyEvent(ev: any) {
  return pick(ev, 'staffOnly') === true;
}

/* -------------------- Home Tab -------------------- */
function HomeScreen() {
  const [loading, setLoading] = useState(false);
  const [nextEvent, setNextEvent] = useState<any | null>(null);
  const [topPress, setTopPress] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHome = async () => {
    setError(null);
    setLoading(true);

    try {
      const eventsReq = api.get('/api/events', {
        params: {
          sort: 'starts_at:asc',
          'pagination[pageSize]': 200,
        },
      });

      const pressReq = api.get('/api/presses', {
        params: {
          sort: 'postedAt:desc',
          'pagination[pageSize]': 1,
          populate: 'image',
        },
      });

      const [eventsRes, pressRes] = await Promise.all([eventsReq, pressReq]);

      const allEvents = safeList(eventsRes.data);
      const publicEvents = allEvents.filter((e) => !isStaffOnlyEvent(e));

      const now = Date.now();
      const upcoming = publicEvents
        .map((e) => ({ e, ts: Date.parse(pick(e, 'starts_at') || '') }))
        .filter((x) => !Number.isNaN(x.ts) && x.ts >= now)
        .sort((a, b) => a.ts - b.ts)
        .map((x) => x.e);

      const presses = safeList(pressRes.data);

      setNextEvent(upcoming[0] ?? null);
      setTopPress(presses[0] ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pressBody = topPress ? richTextToPlain(pick(topPress, 'body')) : '';
  const pressUrl = topPress ? pick(topPress, 'sourceUrl') : null;
  const pressImages = topPress ? getPressImageUrls(topPress) : [];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>🏠 Home</Text>

        <Pressable
          onPress={loadHome}
          style={{
            marginTop: 12,
            backgroundColor: '#111827',
            padding: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
            Refresh
          </Text>
        </Pressable>

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ marginTop: 10, color: 'red' }}>{error}</Text> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Next Schedule Item</Text>
          {nextEvent ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                {pick(nextEvent, 'title') || 'Untitled event'}
              </Text>
              <Text style={{ marginTop: 6, color: '#6b7280' }}>
                {formatDate(pick(nextEvent, 'starts_at'))}
                {pick(nextEvent, 'ends_at')
                  ? ` → ${formatDate(pick(nextEvent, 'ends_at'))}`
                  : ''}
              </Text>
              {pick(nextEvent, 'location') ? (
                <Text style={{ marginTop: 4, color: '#6b7280' }}>
                  {String(pick(nextEvent, 'location'))}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: '#6b7280' }}>No upcoming public events found.</Text>
          )}
        </View>

        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Top Press Story</Text>
          {topPress ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                {pick(topPress, 'title') || 'Untitled story'}
              </Text>

              {pick(topPress, 'postedAt') ? (
                <Text style={{ marginTop: 4, color: '#6b7280' }}>
                  {formatDate(pick(topPress, 'postedAt'))}
                </Text>
              ) : null}

              {pressImages[0] ? (
                <Image
                  source={{ uri: pressImages[0] }}
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 10,
                    marginTop: 10,
                    backgroundColor: '#e5e7eb',
                  }}
                  resizeMode="cover"
                />
              ) : null}

              {pressBody ? <Text style={{ marginTop: 10 }}>{pressBody}</Text> : null}

              {pressUrl ? (
                <Pressable onPress={() => Linking.openURL(String(pressUrl))} style={{ marginTop: 10 }}>
                  <Text style={{ color: '#1e40af', fontWeight: '700' }}>Open source link ↗</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={{ color: '#6b7280' }}>No press stories found.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Schedule Tab (public only, expandable) -------------------- */
function ScheduleScreen() {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadSchedule = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await api.get('/api/events', {
        params: {
          sort: 'starts_at:asc',
          'pagination[pageSize]': 500,
        },
      });

      const all = safeList(res.data);
      const pub = all.filter((e) => !isStaffOnlyEvent(e));
      setEvents(pub);
    } catch (e: any) {
      setEvents([]);
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>🗓️ Schedule</Text>

        <Pressable
          onPress={loadSchedule}
          style={{
            marginTop: 12,
            backgroundColor: '#111827',
            padding: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
            Refresh
          </Text>
        </Pressable>

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ marginTop: 10, color: 'red' }}>{error}</Text> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
        {events.length === 0 && !loading ? (
          <Text style={{ color: '#6b7280' }}>No public events found.</Text>
        ) : null}

        {events.map((ev: any) => {
          const id = String(ev?.id);
          const isOpen = expandedId === id;

          const title = pick(ev, 'title') || 'Untitled event';
          const starts = pick(ev, 'starts_at');
          const ends = pick(ev, 'ends_at');
          const location = pick(ev, 'location');
          const desc = richTextToPlain(pick(ev, 'description'));

          return (
            <Pressable
              key={id}
              onPress={() => toggle(id)}
              style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700' }}>{title}</Text>
              <Text style={{ marginTop: 4, color: '#6b7280' }}>
                {starts ? formatDate(starts) : 'Invalid date'}
                {ends ? ` → ${formatDate(ends)}` : ''}
                {location ? ` • ${String(location)}` : ''}
              </Text>

              <Text style={{ marginTop: 8, color: '#1e40af', fontWeight: '700' }}>
                {isOpen ? 'Tap to collapse ▲' : 'Tap to expand ▼'}
              </Text>

              {isOpen && desc ? <Text style={{ marginTop: 10 }}>{desc}</Text> : null}
              {isOpen && !desc ? (
                <Text style={{ marginTop: 10, color: '#6b7280' }}>(No description)</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Press Tab (expandable) -------------------- */
function PressScreen() {
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPress = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await api.get('/api/presses', {
        params: {
          sort: 'postedAt:desc',
          'pagination[pageSize]': 100,
          populate: 'image',
        },
      });

      setStories(safeList(res.data));
    } catch (e: any) {
      setStories([]);
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>📰 Press</Text>

        <Pressable
          onPress={loadPress}
          style={{
            marginTop: 12,
            backgroundColor: '#111827',
            padding: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
            Refresh
          </Text>
        </Pressable>

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ marginTop: 10, color: 'red' }}>{error}</Text> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
        {stories.length === 0 && !loading ? (
          <Text style={{ color: '#6b7280' }}>No press items found.</Text>
        ) : null}

        {stories.map((p: any) => {
          const id = String(p?.id);
          const isOpen = expandedId === id;

          const body = richTextToPlain(pick(p, 'body'));
          const url = pick(p, 'sourceUrl');
          const imgs = getPressImageUrls(p);

          return (
            <Pressable
              key={id}
              onPress={() => toggle(id)}
              style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                {pick(p, 'title') || 'Untitled story'}
              </Text>

              {pick(p, 'postedAt') ? (
                <Text style={{ marginTop: 4, color: '#6b7280' }}>
                  {formatDate(pick(p, 'postedAt'))}
                </Text>
              ) : null}

              <Text style={{ marginTop: 8, color: '#1e40af', fontWeight: '700' }}>
                {isOpen ? 'Tap to collapse ▲' : 'Tap to expand ▼'}
              </Text>

              {isOpen ? (
                <>
                  {imgs[0] ? (
                    <Image
                      source={{ uri: imgs[0] }}
                      style={{
                        width: '100%',
                        height: 180,
                        borderRadius: 10,
                        marginTop: 10,
                        backgroundColor: '#e5e7eb',
                      }}
                      resizeMode="cover"
                    />
                  ) : null}

                  {body ? <Text style={{ marginTop: 10 }}>{body}</Text> : null}

                  {url ? (
                    <Pressable onPress={() => Linking.openURL(String(url))} style={{ marginTop: 10 }}>
                      <Text style={{ color: '#1e40af', fontWeight: '700' }}>Open source link ↗</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Counselor Tab (login wrapper) -------------------- */
function CounselorScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyJwtEverywhere = (token: string | null) => {
    (global as any).authToken = token ?? undefined;

    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
      delete axios.defaults.headers.common.Authorization;
      delete axios.defaults.headers.common.authorization;
    }
  };

  useEffect(() => {
    applyJwtEverywhere(jwt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  const login = async () => {
    setError(null);
    try {
      const res = await api.post('/api/auth/local', {
        identifier: email,
        password,
      });

      const token = res.data?.jwt;
      if (!token) throw new Error('Login succeeded but no jwt was returned.');

      applyJwtEverywhere(token);
      setJwt(token);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e.message);
    }
  };

  const signOut = () => {
    setJwt(null);
    setEmail('');
    setPassword('');
    setError(null);
    applyJwtEverywhere(null);
  };

  if (jwt) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>🧑‍🏫 Counselor</Text>
          <Pressable onPress={signOut}>
            <Text style={{ color: '#ef4444', fontWeight: '700' }}>Sign out</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <CounselorStack key={jwt} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>🔐 Counselor</Text>

      <View style={{ marginTop: 14, gap: 10 }}>
        <TextInput
          autoCapitalize="none"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
        />
        <Pressable
          onPress={login}
          style={{ backgroundColor: '#1e40af', padding: 12, borderRadius: 10 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
            Sign in
          </Text>
        </Pressable>

        {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

/* -------------------- App Root -------------------- */
export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Schedule" component={ScheduleScreen} />
        <Tab.Screen name="Press" component={PressScreen} />
        <Tab.Screen name="Counselor" component={CounselorScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

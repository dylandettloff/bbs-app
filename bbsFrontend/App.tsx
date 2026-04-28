import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CounselorStack from './src/navigation/CounselorStack';

const API_URL = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL || 'http://localhost:1337';
const MANUAL_URL = (globalThis as any)?.process?.env?.EXPO_PUBLIC_CITIZEN_MANUAL_URL || null;
const Tab: any = createBottomTabNavigator();
const BRAND_LOGO = require('./assets/badger_boys_state_inc_logo.jpeg');

const COLORS = {
  ink: '#12345C',
  navy: '#004680',
  blue: '#004680',
  sky: '#D6E6F6',
  cream: '#EEF3FA',
  paper: '#FFFFFF',
  line: '#CCD7E6',
  text: '#0E1726',
  muted: '#56657C',
  red: '#B22234',
  white: '#FFFFFF',
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

function pick(item: any, key: string) {
  return item?.[key] ?? item?.attributes?.[key];
}

function safeList(payload: any): any[] {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
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
  const value = String(maybeRelative);
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${API_URL}${value}`;
}

function getPressImageUrls(pressItem: any): string[] {
  const image = pick(pressItem, 'image');
  const data = image?.data;
  if (!Array.isArray(data)) return [];

  return data
    .map((media: any) => absUrl(media?.attributes?.url))
    .filter(Boolean) as string[];
}

function getSingleMediaUrl(media: any): string | null {
  if (!media) return null;

  const direct = media?.url ?? media?.attributes?.url;
  if (typeof direct === 'string' && direct.length > 0) return absUrl(direct);

  const data = media?.data;
  if (!data || Array.isArray(data)) return null;

  const nested = data?.url ?? data?.attributes?.url;
  if (typeof nested === 'string' && nested.length > 0) return absUrl(nested);

  return null;
}

function isStaffOnlyEvent(ev: any) {
  return pick(ev, 'staffOnly') === true;
}

function ScreenFrame({
  children,
  tone = 'paper',
}: {
  children: React.ReactNode;
  tone?: 'paper' | 'ink';
}) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: tone === 'ink' ? COLORS.ink : COLORS.cream,
      }}
    >
      {children}
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  inverse = false,
}: {
  label: string;
  onPress: () => void;
  inverse?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: inverse ? COLORS.paper : COLORS.blue,
        borderRadius: 14,
        borderWidth: inverse ? 1 : 0,
        borderColor: COLORS.line,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          color: inverse ? COLORS.ink : COLORS.white,
          fontWeight: '800',
          textAlign: 'center',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BrandHeader() {
  return (
    <View
      style={{
        backgroundColor: COLORS.blue,
        paddingHorizontal: 18,
        paddingTop: 22,
        paddingBottom: 24,
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
      }}
    >
      <Image
        source={BRAND_LOGO}
        style={{
          width: 270,
          height: 112,
          alignSelf: 'center',
        }}
        resizeMode="contain"
      />
    </View>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.paper,
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.line,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
      }}
    >
      {eyebrow ? (
        <Text
          style={{
            color: COLORS.red,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={{
          color: COLORS.ink,
          fontSize: 20,
          fontWeight: '900',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function StoryCard({
  title,
  subtitle,
  body,
  imageUrl,
  open,
  onPress,
  linkUrl,
}: {
  title: string;
  subtitle?: string;
  body?: string;
  imageUrl?: string | null;
  open: boolean;
  onPress: () => void;
  linkUrl?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: COLORS.paper,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.line,
        marginBottom: 14,
      }}
    >
      <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: COLORS.muted, marginTop: 4, fontSize: 13 }}>{subtitle}</Text>
      ) : null}
      <Text
        style={{
          color: COLORS.blue,
          marginTop: 10,
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        {open ? 'Close story ↑' : 'Read story ↓'}
      </Text>

      {open ? (
        <>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{
                width: '100%',
                height: 210,
                borderRadius: 14,
                marginTop: 12,
                backgroundColor: COLORS.sky,
              }}
              resizeMode="cover"
            />
          ) : null}
          {body ? (
            <Text
              style={{
                marginTop: 12,
                color: COLORS.text,
                lineHeight: 22,
                fontSize: 15,
              }}
            >
              {body}
            </Text>
          ) : null}
          {linkUrl ? (
            <Pressable onPress={() => Linking.openURL(String(linkUrl))} style={{ marginTop: 12 }}>
              <Text style={{ color: COLORS.red, fontWeight: '800' }}>Open source link ↗</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </Pressable>
  );
}

function HomeScreen() {
  const [loading, setLoading] = useState(false);
  const [nextEvent, setNextEvent] = useState<any | null>(null);
  const [topPress, setTopPress] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHome = async () => {
    setError(null);
    setLoading(true);

    try {
      const [eventsRes, pressRes] = await Promise.all([
        api.get('/api/events', {
          params: {
            sort: 'starts_at:asc',
            'pagination[pageSize]': 200,
          },
        }),
        api.get('/api/presses', {
          params: {
            sort: 'postedAt:desc',
            'pagination[pageSize]': 1,
            populate: 'image',
          },
        }),
      ]);

      const allEvents = safeList(eventsRes.data);
      const publicEvents = allEvents.filter((event) => !isStaffOnlyEvent(event));
      const now = Date.now();

      const upcoming = publicEvents
        .map((event) => ({ event, ts: Date.parse(pick(event, 'starts_at') || '') }))
        .filter((item) => !Number.isNaN(item.ts) && item.ts >= now)
        .sort((a, b) => a.ts - b.ts)
        .map((item) => item.event);

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

  const pressImages = topPress ? getPressImageUrls(topPress) : [];
  const pressBody = topPress ? richTextToPlain(pick(topPress, 'body')) : '';

  return (
    <ScreenFrame>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <BrandHeader />

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {loading ? (
            <View style={{ paddingVertical: 14 }}>
              <ActivityIndicator color={COLORS.blue} />
            </View>
          ) : null}

          {error ? (
            <Text style={{ marginBottom: 12, color: COLORS.red, fontWeight: '700' }}>{error}</Text>
          ) : null}

        <SectionCard title="Next Schedule Item">
            {nextEvent ? (
              <>
                <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: '900', lineHeight: 24 }}>
                  {pick(nextEvent, 'title') || 'Untitled event'}
                </Text>
                <Text style={{ marginTop: 8, color: COLORS.muted, lineHeight: 20 }}>
                  {formatDate(pick(nextEvent, 'starts_at'))}
                  {pick(nextEvent, 'ends_at')
                    ? ` → ${formatDate(pick(nextEvent, 'ends_at'))}`
                    : ''}
                </Text>
                {pick(nextEvent, 'location') ? (
                  <Text style={{ marginTop: 6, color: COLORS.blue, fontWeight: '700' }}>
                    {String(pick(nextEvent, 'location'))}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={{ color: COLORS.muted }}>No upcoming public events found.</Text>
            )}
          </SectionCard>

        <SectionCard title="Most Recent News Article">
            {topPress ? (
              <>
                <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: '900', lineHeight: 24 }}>
                  {pick(topPress, 'title') || 'Untitled story'}
                </Text>
                {pick(topPress, 'postedAt') ? (
                  <Text style={{ marginTop: 6, color: COLORS.muted }}>
                    {formatDate(pick(topPress, 'postedAt'))}
                  </Text>
                ) : null}
                {pressImages[0] ? (
                  <Image
                    source={{ uri: pressImages[0] }}
                    style={{
                      width: '100%',
                      height: 190,
                      borderRadius: 14,
                      marginTop: 12,
                      backgroundColor: COLORS.sky,
                    }}
                    resizeMode="cover"
                  />
                ) : null}
                {pressBody ? (
                  <Text style={{ marginTop: 12, color: COLORS.text, lineHeight: 22 }}>
                    {pressBody.length > 220 ? `${pressBody.slice(0, 220).trim()}...` : pressBody}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={{ color: COLORS.muted }}>No press stories found.</Text>
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

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

      const allEvents = safeList(res.data);
      setEvents(allEvents.filter((event) => !isStaffOnlyEvent(event)));
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

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <SectionCard title="Schedule Updates">
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            Official public calendar items and event details.
          </Text>
          <View style={{ marginTop: 12 }}>
            <ActionButton label={loading ? 'Refreshing…' : 'Refresh Schedule'} onPress={loadSchedule} />
          </View>
          {loading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color={COLORS.blue} />
            </View>
          ) : null}
          {error ? (
            <Text style={{ marginTop: 10, color: COLORS.red, fontWeight: '700' }}>{error}</Text>
          ) : null}
        </SectionCard>

        {events.length === 0 && !loading ? (
          <Text style={{ color: COLORS.muted }}>No public events found.</Text>
        ) : null}

        {events.map((event: any) => {
          const id = String(event?.id);
          const isOpen = expandedId === id;
          const title = pick(event, 'title') || 'Untitled event';
          const starts = pick(event, 'starts_at');
          const ends = pick(event, 'ends_at');
          const location = pick(event, 'location');
          const desc = richTextToPlain(pick(event, 'description'));

          return (
            <StoryCard
              key={id}
              title={title}
              subtitle={`${starts ? formatDate(starts) : 'Invalid date'}${
                ends ? ` → ${formatDate(ends)}` : ''
              }${location ? ` • ${String(location)}` : ''}`}
              body={desc || '(No description)'}
              open={isOpen}
              onPress={() => setExpandedId((prev) => (prev === id ? null : id))}
            />
          );
        })}
      </ScrollView>
    </ScreenFrame>
  );
}

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

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View
          style={{
            backgroundColor: COLORS.paper,
            borderColor: COLORS.line,
            borderWidth: 1,
            borderRadius: 22,
            paddingHorizontal: 18,
            paddingVertical: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 5 },
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.ink }} />
            <Text
              style={{
                color: COLORS.ink,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
              }}
            >
              Press Desk
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.ink }} />
          </View>
          <Text
            style={{
              color: COLORS.ink,
              textAlign: 'center',
              fontSize: 34,
              fontWeight: '900',
              letterSpacing: 0.5,
            }}
          >
            Badger Bugle Citizen
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: COLORS.line,
            }}
          >
            <Text
              style={{
                color: COLORS.muted,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              State Edition
            </Text>
            <Text
              style={{
                color: COLORS.muted,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Latest Bulletin
            </Text>
          </View>
          <View style={{ marginTop: 14 }}>
            <ActionButton label={loading ? 'Refreshing…' : 'Refresh Edition'} onPress={loadPress} />
          </View>
          {loading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color={COLORS.blue} />
            </View>
          ) : null}
          {error ? (
            <Text style={{ marginTop: 10, color: COLORS.red, fontWeight: '700' }}>{error}</Text>
          ) : null}
        </View>

        {stories.length === 0 && !loading ? (
          <Text style={{ color: COLORS.muted }}>No press items found.</Text>
        ) : null}

        {stories.map((story: any) => {
          const id = String(story?.id);
          const isOpen = expandedId === id;
          const imageUrl = getPressImageUrls(story)[0] ?? null;
          const body = richTextToPlain(pick(story, 'body'));
          const preview = body.length > 180 ? `${body.slice(0, 180).trim()}...` : body;

          return (
            <Pressable
              key={id}
              onPress={() => setExpandedId((prev) => (prev === id ? null : id))}
              style={{
                backgroundColor: COLORS.paper,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.line,
                paddingVertical: 18,
              }}
            >
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    marginBottom: 12,
                    backgroundColor: COLORS.sky,
                  }}
                  resizeMode="cover"
                />
              ) : null}
              <Text
                style={{
                  color: COLORS.ink,
                  fontSize: 24,
                  fontWeight: '900',
                  lineHeight: 30,
                }}
              >
                {pick(story, 'title') || 'Untitled story'}
              </Text>
              {pick(story, 'postedAt') ? (
                <Text
                  style={{
                    marginTop: 6,
                    color: COLORS.muted,
                    fontSize: 12,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  Staff Report • {formatDate(pick(story, 'postedAt'))}
                </Text>
              ) : null}
              {!isOpen && preview ? (
                <Text
                  style={{
                    marginTop: 12,
                    color: COLORS.text,
                    lineHeight: 23,
                    fontSize: 16,
                  }}
                >
                  {preview}
                </Text>
              ) : null}
              <Text
                style={{
                  color: COLORS.blue,
                  marginTop: 12,
                  fontWeight: '800',
                  letterSpacing: 0.3,
                }}
              >
                {isOpen ? 'Fold article ↑' : 'Open article ↓'}
              </Text>
              {isOpen ? (
                <>
                  {body ? (
                    <Text
                      style={{
                        marginTop: 12,
                        color: COLORS.text,
                        lineHeight: 24,
                        fontSize: 16,
                      }}
                    >
                      {body}
                    </Text>
                  ) : null}
                  {pick(story, 'sourceUrl') ? (
                    <Pressable
                      onPress={() => Linking.openURL(String(pick(story, 'sourceUrl')))}
                      style={{ marginTop: 12 }}
                    >
                      <Text style={{ color: COLORS.red, fontWeight: '800' }}>
                        Open source link ↗
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </ScreenFrame>
  );
}

function ManualScreen() {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('Citizen Manual');
  const [manualSummary, setManualSummary] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(MANUAL_URL);

  const checkManual = async () => {
    setError(null);
    setLoading(true);

    try {
      if (MANUAL_URL) {
        const res = await axios.get(MANUAL_URL, {
          responseType: 'text',
          timeout: 12000,
        });

        if (res.status >= 200 && res.status < 300) {
          setManualUrl(MANUAL_URL);
          setAvailable(true);
          return;
        }
      }

      const res = await api.get('/api/manual-file');

      const manual = res.data?.data ?? null;
      const pdfUrl = absUrl(pick(manual, 'url'));
      const title = pick(manual, 'title');
      const summary = pick(manual, 'summary');

      setManualTitle(title || 'Citizen Manual');
      setManualSummary(summary || null);
      setManualUrl(pdfUrl);

      if (!pdfUrl) {
        setAvailable(false);
        setError('Upload a PDF to the Strapi Media Library.');
        return;
      }

      setAvailable(true);
    } catch (e: any) {
      setAvailable(false);
      setError(e?.response?.data?.error?.message || 'Citizen manual PDF was not found yet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openManual = async () => {
    setError(null);

    try {
      if (!manualUrl) {
        setError('No citizen manual PDF is available yet.');
        return;
      }

      await Linking.openURL(manualUrl);
    } catch (e: any) {
      setError(e?.message || 'Unable to open the citizen manual.');
    }
  };

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <SectionCard title="Citizen Manual" eyebrow="Reference">
          <Text style={{ color: COLORS.text, lineHeight: 22 }}>
            This tab opens the current Badger Boys State citizen manual as a PDF from Strapi.
          </Text>
          <Text style={{ marginTop: 12, color: COLORS.ink, fontWeight: '800', fontSize: 18 }}>
            {manualTitle}
          </Text>
          {manualSummary ? (
            <Text style={{ marginTop: 8, color: COLORS.text, lineHeight: 21 }}>{manualSummary}</Text>
          ) : null}
          <Text
            style={{
              marginTop: 12,
              color: COLORS.muted,
              lineHeight: 20,
              fontSize: 13,
            }}
          >
            Source: {manualUrl || '/api/manual-file'}
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton label="Open Manual PDF" onPress={openManual} />
            <ActionButton
              label={loading ? 'Checking…' : 'Refresh Manual'}
              onPress={checkManual}
              inverse
            />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color={COLORS.blue} />
            </View>
          ) : null}

          {available === true ? (
            <Text style={{ marginTop: 14, color: COLORS.blue, fontWeight: '800' }}>
              Manual is available and ready to open.
            </Text>
          ) : null}

          {available === false ? (
            <Text style={{ marginTop: 14, color: COLORS.red, fontWeight: '700' }}>
              {error || 'Citizen manual PDF was not found yet.'}
            </Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Upload Path">
          <Text style={{ color: COLORS.text, lineHeight: 22 }}>
            Upload the PDF in Strapi using the
            {' '}
            Media Library
            {' '}
            . The app will use the newest PDF whose file name includes
            {' '}
            `manual`
            {' '}
            or
            {' '}
            `citizen`.
          </Text>
          <Text style={{ marginTop: 10, color: COLORS.muted, lineHeight: 20 }}>
            If you want to override Strapi later, you can still set
            {' '}
            `EXPO_PUBLIC_CITIZEN_MANUAL_URL`
            {' '}
            when starting or building the app.
          </Text>
        </SectionCard>
      </ScrollView>
    </ScreenFrame>
  );
}

function CounselorScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyJwtEverywhere = (token: string | null) => {
    (globalThis as any).authToken = token ?? undefined;

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
      <ScreenFrame tone="ink">
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
          <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.white }}>
            Counselor Access
          </Text>
          <Pressable onPress={signOut}>
            <Text style={{ color: '#FFB6C1', fontWeight: '800' }}>Sign out</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.cream }}>
          <CounselorStack key={jwt} />
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame tone="ink">
      <StatusBar barStyle="light-content" />
      <View style={{ padding: 16 }}>
        <View
          style={{
            backgroundColor: COLORS.navy,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: '#1B4279',
          }}
        >
          <Text
            style={{
              color: COLORS.sky,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Staff Portal
          </Text>
          <Text
            style={{
              color: COLORS.white,
              fontSize: 28,
              fontWeight: '900',
              marginTop: 8,
            }}
          >
            Counselor Sign In
          </Text>
          <Text style={{ color: '#C6D3EA', marginTop: 8, lineHeight: 20 }}>
            Secure access to rosters, county assignments, and staff schedule tools.
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            <TextInput
              autoCapitalize="none"
              placeholder="Email"
              placeholderTextColor="#7E93B9"
              value={email}
              onChangeText={setEmail}
              style={{
                backgroundColor: '#081731',
                borderRadius: 12,
                padding: 13,
                color: COLORS.white,
                borderWidth: 1,
                borderColor: '#2B4E84',
              }}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#7E93B9"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={{
                backgroundColor: '#081731',
                borderRadius: 12,
                padding: 13,
                color: COLORS.white,
                borderWidth: 1,
                borderColor: '#2B4E84',
              }}
            />
            <ActionButton label="Sign in" onPress={login} />
            {error ? (
              <Text style={{ color: '#FFB6C1', fontWeight: '700' }}>{error}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </ScreenFrame>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.blue,
          tabBarInactiveTintColor: '#7B8192',
          tabBarStyle: {
            backgroundColor: COLORS.white,
            borderTopColor: COLORS.line,
            height: 78,
            paddingTop: 10,
            paddingBottom: 12,
          },
          tabBarItemStyle: {
            borderRadius: 12,
            marginTop: 4,
          },
          tabBarLabelStyle: {
            fontWeight: '800',
            fontSize: 12,
            letterSpacing: 0.3,
          },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Schedule" component={ScheduleScreen} />
        <Tab.Screen name="Press" component={PressScreen} />
        <Tab.Screen name="Manual" component={ManualScreen} />
        <Tab.Screen name="Counselor" component={CounselorScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

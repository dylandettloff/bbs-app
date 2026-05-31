import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const API_URL = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL || 'http://localhost:1337';
const Tab: any = createBottomTabNavigator();
const BRAND_LOGO = require('./assets/badger_boys_state_inc_logo.jpeg');
const EAS_PROJECT_ID = 'c8aadf84-b565-4fed-b5c1-e6c752978910';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: COLORS.blue,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') return;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });

    await api.post('/api/push/register', {
      token: token.data,
      platform: Platform.OS,
      enabled: true,
    });
  } catch (error) {
    console.warn('Push notification registration failed', error);
  }
}

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

function formatScheduleTime(date: Date) {
  return date
    .toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
    .replace(/\s/g, '')
    .toLowerCase();
}

function formatScheduleRange(startIso?: string, endIso?: string) {
  if (!startIso) return 'Invalid date';

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return 'Invalid date';

  const date = `${start.getMonth() + 1}/${start.getDate()}`;
  const startTime = formatScheduleTime(start);

  if (!endIso) return `${date} ${startTime}`;

  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return `${date} ${startTime}`;

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const endPrefix = sameDay ? '' : `${end.getMonth() + 1}/${end.getDate()} `;

  return `${date} ${startTime} - ${endPrefix}${formatScheduleTime(end)}`;
}

function splitLocation(location?: string | null) {
  const value = String(location || '').trim();
  if (!value) return null;

  const [building, ...addressParts] = value.split(',');
  const address = addressParts.join(',').trim();

  return {
    building: building.trim(),
    address,
    mapsQuery: encodeURIComponent(value),
  };
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
          width: '100%',
          maxWidth: 432,
          height: 179,
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
  children?: React.ReactNode;
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
          marginBottom: children ? 8 : 0,
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
  location,
  body,
  imageUrl,
  open,
  onPress,
  linkUrl,
}: {
  title: string;
  subtitle?: string;
  location?: string | null;
  body?: string;
  imageUrl?: string | null;
  open: boolean;
  onPress: () => void;
  linkUrl?: string | null;
}) {
  const locationParts = splitLocation(location);

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
      {locationParts ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: COLORS.blue, fontWeight: '800' }}>{locationParts.building}</Text>
          {locationParts.address ? (
            <Pressable
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${locationParts.mapsQuery}`)
              }
            >
              <Text style={{ color: COLORS.blue, marginTop: 2, textDecorationLine: 'underline' }}>
                {locationParts.address}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text
        style={{
          color: COLORS.blue,
          marginTop: 10,
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        {open ? 'Close info ↑' : 'See more info ↓'}
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

function HomeScreen({ profile }: { profile?: any }) {
  const [loading, setLoading] = useState(false);
  const [nextEvent, setNextEvent] = useState<any | null>(null);
  const [topPress, setTopPress] = useState<any | null>(null);
  const [pinnedContent, setPinnedContent] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHome = async () => {
    setError(null);
    setLoading(true);

    try {
      const [eventsRes, pressRes, pinnedRes] = await Promise.allSettled([
        api.get('/api/me/schedule'),
        api.get('/api/presses', {
          params: {
            sort: 'postedAt:desc',
            'pagination[pageSize]': 1,
            populate: 'image',
          },
        }),
        api.get('/api/pinned-content'),
      ]);

      const allEvents = eventsRes.status === 'fulfilled' ? safeList(eventsRes.value.data) : [];
      const publicEvents = allEvents.filter((event) => !isStaffOnlyEvent(event));
      const now = Date.now();

      const upcoming = publicEvents
        .map((event) => ({ event, ts: Date.parse(pick(event, 'starts_at') || '') }))
        .filter((item) => !Number.isNaN(item.ts) && item.ts >= now)
        .sort((a, b) => a.ts - b.ts)
        .map((item) => item.event);

      const presses = pressRes.status === 'fulfilled' ? safeList(pressRes.value.data) : [];
      const pinned = pinnedRes.status === 'fulfilled' ? pinnedRes.value.data?.data ?? null : null;
      const pinnedTitle = pinned ? pick(pinned, 'title') : null;
      setNextEvent(upcoming[0] ?? null);
      setTopPress(presses[0] ?? null);
      setPinnedContent(pinnedTitle && pick(pinned, 'active') !== false ? pinned : null);

      const requiredError = eventsRes.status === 'rejected' ? eventsRes.reason : null;
      if (requiredError) throw requiredError;
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
  const pinnedBody = pinnedContent ? richTextToPlain(pick(pinnedContent, 'body')) : '';
  const pinnedButtonLabel = pinnedContent ? pick(pinnedContent, 'buttonLabel') : null;
  const pinnedButtonUrl = pinnedContent ? pick(pinnedContent, 'buttonUrl') : null;
  const assignmentTitle = profile?.student
    ? `City of ${profile.student.city?.name || 'City not assigned'}${
        profile.student.county?.name ? `, ${profile.student.county.name} County` : ''
      }`
    : '';

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

          {assignmentTitle ? <SectionCard title={assignmentTitle} /> : null}

          {pinnedContent ? (
            <SectionCard title={pick(pinnedContent, 'title') || 'Pinned Update'} eyebrow="Pinned">
              <>
                {pinnedBody ? (
                  <Text style={{ marginTop: 12, color: COLORS.text, lineHeight: 22 }}>
                    {pinnedBody}
                  </Text>
                ) : null}
                {pinnedButtonLabel && pinnedButtonUrl ? (
                  <View style={{ marginTop: 16 }}>
                    <ActionButton
                      label={String(pinnedButtonLabel)}
                      onPress={() => Linking.openURL(String(pinnedButtonUrl))}
                    />
                  </View>
                ) : null}
              </>
            </SectionCard>
          ) : null}

          <SectionCard title="Next Schedule Item">
            {nextEvent ? (
              <>
                <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: '900', lineHeight: 24 }}>
                  {pick(nextEvent, 'title') || 'Untitled event'}
                </Text>
                <Text style={{ marginTop: 8, color: COLORS.muted, lineHeight: 20 }}>
                  {formatScheduleRange(pick(nextEvent, 'starts_at'), pick(nextEvent, 'ends_at'))}
                </Text>
                {(() => {
                  const locationParts = splitLocation(pick(nextEvent, 'location'));
                  if (!locationParts) return null;

                  return (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ color: COLORS.blue, fontWeight: '800' }}>
                        {locationParts.building}
                      </Text>
                      {locationParts.address ? (
                        <Pressable
                          onPress={() =>
                            Linking.openURL(
                              `https://www.google.com/maps/search/?api=1&query=${locationParts.mapsQuery}`
                            )
                          }
                        >
                          <Text
                            style={{
                              color: COLORS.blue,
                              marginTop: 2,
                              textDecorationLine: 'underline',
                            }}
                          >
                            {locationParts.address}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })()}
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
      const res = await api.get('/api/me/schedule');
      setEvents(safeList(res.data));
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
              subtitle={formatScheduleRange(starts, ends)}
              location={location ? String(location) : null}
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

function FilesScreen() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await api.get('/api/file-links', {
        params: {
          'sort[0]': 'featured:desc',
          'sort[1]': 'sortOrder:asc',
          'sort[2]': 'title:asc',
          'pagination[pageSize]': 100,
        },
      });
      setFiles(safeList(res.data));
    } catch (e: any) {
      setFiles([]);
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <SectionCard title="Files" eyebrow="Resources">
          <Text style={{ color: COLORS.text, lineHeight: 22 }}>
            Google Drive PDFs and program documents.
          </Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton label={loading ? 'Refreshing...' : 'Refresh Files'} onPress={loadFiles} />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color={COLORS.blue} />
            </View>
          ) : null}

          {error ? (
            <Text style={{ marginTop: 14, color: COLORS.red, fontWeight: '700' }}>
              {error}
            </Text>
          ) : null}
        </SectionCard>

        {files.length === 0 && !loading ? (
          <Text style={{ color: COLORS.muted }}>No files have been posted yet.</Text>
        ) : null}

        {files.map((file: any) => {
          const description = richTextToPlain(pick(file, 'description'));
          const url = String(pick(file, 'url') || '');
          const category = pick(file, 'category');

          return (
            <SectionCard
              key={String(file?.id)}
              title={pick(file, 'title') || 'Untitled file'}
              eyebrow={category ? String(category) : pick(file, 'featured') ? 'Featured' : undefined}
            >
              {description ? (
                <Text style={{ color: COLORS.text, lineHeight: 22 }}>{description}</Text>
              ) : null}
              <View style={{ marginTop: description ? 14 : 4 }}>
                <ActionButton
                  label="Open PDF"
                  onPress={() => {
                    if (url) Linking.openURL(url);
                  }}
                />
              </View>
            </SectionCard>
          );
        })}
      </ScrollView>
    </ScreenFrame>
  );
}

function LoginScreen({
  loading,
  resetLoading,
  error,
  resetMessage,
  onLogin,
  onForgotPassword,
}: {
  loading: boolean;
  resetLoading: boolean;
  error: string | null;
  resetMessage: string | null;
  onLogin: (citizenId: string, password: string) => void;
  onForgotPassword: (citizenId: string) => void;
}) {
  const [citizenId, setCitizenId] = useState('');
  const [password, setPassword] = useState('');

  return (
    <ScreenFrame tone="ink">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 28 }}>
        <Image
          source={BRAND_LOGO}
          style={{
            width: '100%',
            maxWidth: 432,
            height: 179,
            alignSelf: 'center',
            marginBottom: 22,
          }}
          resizeMode="contain"
        />
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
            Badger Boys State
          </Text>
          <Text
            style={{
              color: COLORS.white,
              fontSize: 28,
              fontWeight: '900',
              marginTop: 8,
            }}
          >
            Citizen Sign In
          </Text>
          <Text style={{ color: '#C6D3EA', marginTop: 8, lineHeight: 20 }}>
            Enter your citizen ID and password to view your schedule, files, and updates.
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            <TextInput
              keyboardType="number-pad"
              inputMode="numeric"
              autoCapitalize="none"
              placeholder="Citizen ID"
              placeholderTextColor="#7E93B9"
              value={citizenId}
              onChangeText={(value) => setCitizenId(value.replace(/[^0-9]/g, ''))}
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
            <ActionButton
              label={loading ? 'Signing in...' : 'Sign in'}
              onPress={() => onLogin(citizenId, password)}
            />
            <Pressable
              onPress={() => onForgotPassword(citizenId)}
              disabled={resetLoading}
              style={{ paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ color: COLORS.sky, fontWeight: '800' }}>
                {resetLoading ? 'Sending reset email...' : 'Forgot password?'}
              </Text>
            </Pressable>
            {error ? (
              <Text style={{ color: '#FFB6C1', fontWeight: '700', lineHeight: 20 }}>
                {error}
              </Text>
            ) : null}
            {resetMessage ? (
              <Text style={{ color: '#C6D3EA', fontWeight: '700', lineHeight: 20 }}>
                {resetMessage}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

export default function App() {
  const [jwt, setJwt] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (jwt) {
      registerForPushNotifications();
    }
  }, [jwt]);

  const applyJwt = (token: string | null) => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
      delete axios.defaults.headers.common.Authorization;
      delete axios.defaults.headers.common.authorization;
    }
  };

  const login = async (citizenId: string, password: string) => {
    setAuthError(null);
    setResetMessage(null);

    if (!citizenId || !password) {
      setAuthError('Enter your citizen ID and password.');
      return;
    }

    setAuthLoading(true);

    try {
      const loginRes = await api.post('/api/auth/local', {
        identifier: citizenId,
        password,
      });
      const token = loginRes.data?.jwt;
      if (!token) throw new Error('Login succeeded but no token was returned.');

      applyJwt(token);
      const profileRes = await api.get('/api/me/profile');

      setJwt(token);
      setProfile(profileRes.data?.data ?? null);
    } catch (e: any) {
      applyJwt(null);
      setJwt(null);
      setProfile(null);
      setAuthError(e?.response?.data?.error?.message || e.message || 'Unable to sign in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const requestPasswordReset = async (citizenId: string) => {
    setAuthError(null);
    setResetMessage(null);

    if (!citizenId) {
      setAuthError('Enter your citizen ID first.');
      return;
    }

    setResetLoading(true);

    try {
      await api.post('/api/citizen-auth/forgot-password', {
        citizenId,
      });
      setResetMessage('If that citizen ID exists, a password reset email has been sent.');
    } catch (e: any) {
      setAuthError(e?.response?.data?.error?.message || e.message || 'Unable to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const signOut = () => {
    applyJwt(null);
    setJwt(null);
    setProfile(null);
    setAuthError(null);
  };

  if (!jwt) {
    return (
      <LoginScreen
        loading={authLoading}
        resetLoading={resetLoading}
        error={authError}
        resetMessage={resetMessage}
        onLogin={login}
        onForgotPassword={requestPasswordReset}
      />
    );
  }

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
        <Tab.Screen name="Home">{() => <HomeScreen profile={profile} />}</Tab.Screen>
        <Tab.Screen name="Schedule" component={ScheduleScreen} />
        <Tab.Screen name="Press" component={PressScreen} />
        <Tab.Screen name="Files" component={FilesScreen} />
        <Tab.Screen name="Sign Out">
          {() => (
            <ScreenFrame>
              <View style={{ padding: 16 }}>
                <SectionCard title="Signed In" eyebrow="Account">
                  <Text style={{ color: COLORS.text, lineHeight: 22 }}>
                    {profile?.student?.name || `Citizen ${profile?.student?.id_number || ''}`}
                  </Text>
                  <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
                    {profile?.student?.city?.name || 'City not assigned'}
                    {profile?.student?.county?.name ? `, ${profile.student.county.name} County` : ''}
                    {profile?.student?.party ? ` • ${profile.student.party}` : ''}
                  </Text>
                  <View style={{ marginTop: 16 }}>
                    <ActionButton label="Sign out" onPress={signOut} />
                  </View>
                </SectionCard>
              </View>
            </ScreenFrame>
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

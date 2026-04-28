// src/navigation/CounselorStack.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import axios from 'axios';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const API_URL = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL || 'http://localhost:1337';
const Stack: any = createNativeStackNavigator();
const COLORS = {
  ink: '#12345C',
  navy: '#004680',
  blue: '#004680',
  cream: '#EEF3FA',
  paper: '#FFFFFF',
  line: '#CCD7E6',
  text: '#0E1726',
  muted: '#56657C',
  red: '#B22234',
  white: '#FFFFFF',
  softBlue: '#D7E7FB',
};

const http = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

/** ---------- Helpers ---------- */

function pickField(item: any, key: string) {
  return item?.[key] ?? item?.attributes?.[key];
}

function safeStrapiList(resData: any): any[] {
  if (!resData) return [];
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.data?.data)) return resData.data.data;
  return [];
}

function relList(rel: any): any[] {
  if (!rel) return [];
  if (Array.isArray(rel)) return rel;
  if (Array.isArray(rel?.data)) return rel.data;
  if (Array.isArray(rel?.data?.data)) return rel.data.data;
  return [];
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

function getAuthToken(): string | undefined {
  const g = (globalThis as any).authToken as string | undefined;
  if (g) return g;

  const hdr = (axios.defaults.headers as any)?.common?.Authorization;
  if (typeof hdr === 'string' && hdr.startsWith('Bearer ')) {
    return hdr.replace('Bearer ', '');
  }
  return undefined;
}

function getAuthHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getNextEvent(events: any[]) {
  if (!Array.isArray(events)) return null;
  const now = Date.now();

  const normalized = events
    .map((e) => ({
      id: e?.id,
      title: pickField(e, 'title'),
      starts_at: pickField(e, 'starts_at'),
      location: pickField(e, 'location'),
    }))
    .filter((e) => e.starts_at && !Number.isNaN(Date.parse(e.starts_at)));

  const upcoming = normalized
    .filter((e) => Date.parse(e.starts_at) >= now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  return upcoming[0] ?? null;
}

function studentDisplayName(stu: any) {
  // Your field is exactly "Name"
  return (
    pickField(stu, 'Name') ||
    pickField(stu, 'name') ||
    pickField(stu, 'fullName') ||
    `Student #${stu?.id ?? ''}`
  );
}

/**
 * Strapi media can be:
 * - photo: { url, ... }
 * - photo: { data: { attributes: { url } } }
 * - photo: { data: [ ... ] } (if multiple)
 */
function getMediaUrl(media: any): string | null {
  if (!media) return null;

  // If already flattened by Strapi/config
  const directUrl = media?.url ?? media?.attributes?.url;
  if (typeof directUrl === 'string' && directUrl.length > 0) return absolutizeUrl(directUrl);

  const d = media?.data;
  if (!d) return null;

  // Single media
  if (!Array.isArray(d)) {
    const url = d?.url ?? d?.attributes?.url;
    if (typeof url === 'string' && url.length > 0) return absolutizeUrl(url);
    return null;
  }

  // Multiple media - take first
  const first = d[0];
  const url = first?.url ?? first?.attributes?.url;
  if (typeof url === 'string' && url.length > 0) return absolutizeUrl(url);
  return null;
}

function absolutizeUrl(url: string) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** ---------- UI helpers ---------- */

function SafeAreaContainer({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, paddingTop: 8, backgroundColor: COLORS.cream }}>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.paper,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Text style={{ fontWeight: '800', color: COLORS.ink }}>{label}</Text>
      <Text style={{ marginTop: 4, color: COLORS.text }}>{value}</Text>
    </View>
  );
}

/** ---------- Screens ---------- */

function CounselorHomeScreen({ navigation }: any) {
  const token = getAuthToken();
  const headers = useMemo(() => getAuthHeaders(token), [token]);

  const [loading, setLoading] = useState(false);
  const [counties, setCounties] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const staffEvents = (globalThis as any).staffEvents ?? [];
  const nextEvent = useMemo(() => getNextEvent(staffEvents), [staffEvents]);

  useEffect(() => {
    let mounted = true;

    async function loadRoster() {
      if (!token) return;
      setError(null);
      setLoading(true);

      try {
        const res = await http.get('/api/me/roster', { headers });
        const list = safeStrapiList(res.data);
        if (mounted) setCounties(list);
      } catch (e: any) {
        if (mounted) {
          setCounties([]);
          setError(e?.response?.data?.error?.message || e.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadRoster();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (!token) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: COLORS.cream }}>
        <Text style={{ fontSize: 16, color: COLORS.text }}>
          Not signed in. Go back and sign in on the Counselor tab.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.line,
            backgroundColor: COLORS.paper,
            borderRadius: 20,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontWeight: '800', marginBottom: 8, color: COLORS.ink }}>
            Next Staff Event
          </Text>

          <Pressable
            onPress={() => navigation.navigate('StaffSchedule')}
            style={{ paddingVertical: 10 }}
          >
            {nextEvent ? (
              <>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
                  {nextEvent.title || 'Untitled event'}
                </Text>
                <Text style={{ marginTop: 4, color: COLORS.muted }}>
                  {formatDate(nextEvent.starts_at)}
                  {nextEvent.location ? ` • ${nextEvent.location}` : ''}
                </Text>
                <Text style={{ marginTop: 8, color: COLORS.blue, fontWeight: '800' }}>
                  Open full schedule →
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: COLORS.muted }}>No upcoming staff events.</Text>
                <Text style={{ marginTop: 8, color: COLORS.blue, fontWeight: '800' }}>
                  Open full schedule →
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.line,
            backgroundColor: COLORS.paper,
            borderRadius: 20,
            padding: 16,
          }}
        >
          <Text style={{ fontWeight: '800', marginBottom: 8, color: COLORS.ink }}>
            My Counties
          </Text>

          {loading ? (
            <View style={{ paddingVertical: 10 }}>
              <ActivityIndicator />
            </View>
          ) : null}

          {error ? <Text style={{ color: COLORS.red, marginTop: 6 }}>{error}</Text> : null}

          {!loading && counties.length === 0 ? (
            <Text style={{ color: COLORS.muted }}>No counties assigned to this user.</Text>
          ) : (
            counties.map((c: any) => {
              const countyName =
                pickField(c, 'name') ||
                pickField(c?.county, 'name') ||
                `County #${c?.id}`;
              const countyId = c?.id ?? c?.county?.id ?? null;
              const countyDocumentId = c?.documentId ?? c?.county?.documentId ?? null;

              return (
                <Pressable
                  key={String(countyId ?? countyName)}
                  onPress={() =>
                    navigation.navigate('County', {
                      countyId,
                      countyDocumentId,
                      countyName,
                    })
                  }
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.line,
                  }}
                >
                  <Text style={{ fontSize: 16, color: COLORS.text, fontWeight: '700' }}>
                    {countyName}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
}

function CountyScreen({ route, navigation }: any) {
  const { countyId, countyDocumentId, countyName } = route.params;

  const token = getAuthToken();
  const headers = useMemo(() => getAuthHeaders(token), [token]);

  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCountyCities() {
      if (!token) return;
      setError(null);
      setLoading(true);

      try {
        let list: any[] = [];

        if (countyDocumentId) {
          const resDoc = await http.get('/api/cities', {
            headers,
            params: {
              status: 'published',
              sort: 'name:asc',
              'pagination[pageSize]': 500,
              'filters[county][documentId][$eq]': countyDocumentId,
            },
          });
          list = safeStrapiList(resDoc.data);
        }

        if (list.length === 0 && countyId != null) {
          const resId = await http.get('/api/cities', {
            headers,
            params: {
              status: 'published',
              sort: 'name:asc',
              'pagination[pageSize]': 500,
              'filters[county][id][$eq]': countyId,
            },
          });
          list = safeStrapiList(resId.data);
        }

        if (list.length === 0 && countyName) {
          const resName = await http.get('/api/cities', {
            headers,
            params: {
              status: 'published',
              sort: 'name:asc',
              'pagination[pageSize]': 500,
              'filters[county][name][$eq]': countyName,
            },
          });
          list = safeStrapiList(resName.data);
        }

        if (mounted) setCities(list);
      } catch (e: any) {
        if (mounted) {
          setCities([]);
          setError(e?.response?.data?.error?.message || e.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCountyCities();
    return () => {
      mounted = false;
    };
  }, [countyId, countyDocumentId, countyName, token]);

  return (
    <SafeAreaContainer>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.ink }}>{countyName}</Text>

        {loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ color: COLORS.red }}>{error}</Text> : null}

        {!loading && cities.length === 0 ? (
          <Text style={{ marginTop: 12, color: COLORS.muted }}>
            No cities found for this county yet.
          </Text>
        ) : (
          <FlatList
            style={{ marginTop: 12 }}
            data={cities}
            keyExtractor={(item) => String(item?.id ?? item?.documentId)}
            renderItem={({ item }) => {
              const cityNameLocal =
                pickField(item, 'name') || pickField(item, 'title') || `City #${item?.id}`;

              return (
                <Pressable
                  onPress={() =>
                    navigation.navigate('City', {
                      // IMPORTANT: pass documentId for reliability (Strapi single fetch uses documentId)
                      cityId: item?.id,
                      cityDocumentId: item?.documentId,
                      cityName: cityNameLocal,
                    })
                  }
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.line,
                    backgroundColor: COLORS.paper,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
                    {cityNameLocal}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaContainer>
  );
}

function CityScreen({ route, navigation }: any) {
  const { cityId, cityDocumentId, cityName } = route.params;

  const token = getAuthToken();
  const headers = useMemo(() => getAuthHeaders(token), [token]);

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStudentsFromCity() {
      if (!token) return;
      setError(null);
      setLoading(true);

      try {
        const paramsByDocId = {
          status: 'published',
          sort: 'Name:asc',
          'pagination[pageSize]': 500,
          populate: 'photo',
          ...(cityDocumentId ? { 'filters[city][documentId][$eq]': cityDocumentId } : {}),
        };

        const paramsById = {
          status: 'published',
          sort: 'Name:asc',
          'pagination[pageSize]': 500,
          populate: 'photo',
          ...(cityId != null ? { 'filters[city][id][$eq]': cityId } : {}),
        };

        let list: any[] = [];

        if (cityDocumentId) {
          const resDoc = await http.get('/api/students', { headers, params: paramsByDocId });
          list = safeStrapiList(resDoc.data);
        }

        if (list.length === 0 && cityId != null) {
          const resId = await http.get('/api/students', { headers, params: paramsById });
          list = safeStrapiList(resId.data);
        }

        const sorted = [...list].sort((a, b) =>
          studentDisplayName(a).localeCompare(studentDisplayName(b))
        );

        if (mounted) setStudents(sorted);
      } catch (e: any) {
        if (mounted) {
          setStudents([]);
          setError(e?.response?.data?.error?.message || e.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStudentsFromCity();
    return () => {
      mounted = false;
    };
    // include both params so navigating between cities updates correctly
  }, [cityId, cityDocumentId, token]);

  return (
    <SafeAreaContainer>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.ink }}>{cityName}</Text>

        {loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ color: COLORS.red }}>{error}</Text> : null}

        {!loading && students.length === 0 ? (
          <Text style={{ marginTop: 12, color: COLORS.muted }}>
            No students found for this city yet.
          </Text>
        ) : (
          <FlatList
            style={{ marginTop: 12 }}
            data={students}
            keyExtractor={(item) => String(item?.id ?? item?.documentId)}
            renderItem={({ item }) => {
              const name = studentDisplayName(item);
              const photoUrl = getMediaUrl(pickField(item, 'photo'));

              return (
                <Pressable
                  onPress={() =>
                    navigation.navigate('Student', {
                      student: item,
                      title: name,
                    })
                  }
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.line,
                    backgroundColor: COLORS.paper,
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: COLORS.softBlue,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: COLORS.navy }}>
                        {name?.[0]?.toUpperCase?.() ?? 'S'}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
                      {name}
                    </Text>
                    {pickField(item, 'hometown') ? (
                      <Text style={{ marginTop: 2, color: COLORS.muted }}>
                        {String(pickField(item, 'hometown'))}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={{ color: COLORS.blue, fontWeight: '800' }}>View →</Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaContainer>
  );
}

function StudentScreen({ route }: any) {
  const student = route.params?.student;
  const title = route.params?.title ?? 'Student';

  const Name = pickField(student, 'Name') ?? title;
  const hometown = pickField(student, 'hometown');
  const highschool = pickField(student, 'highschool');
  const id_number = pickField(student, 'id_number');
  const party = pickField(student, 'party');
  const medical_info = pickField(student, 'medical_info');
  const earlyDeparture = pickField(student, 'earlyDeparture');
  const photoUrl = getMediaUrl(pickField(student, 'photo'));

  return (
    <SafeAreaContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.ink }}>{String(Name)}</Text>

        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: 140, height: 140, borderRadius: 18, marginTop: 12 }}
          />
        ) : null}

        <View style={{ marginTop: 12, gap: 10 }}>
          {hometown ? <InfoRow label="Hometown" value={String(hometown)} /> : null}
          {highschool ? <InfoRow label="High School" value={String(highschool)} /> : null}
          {id_number !== undefined && id_number !== null ? (
            <InfoRow label="ID Number" value={String(id_number)} />
          ) : null}
          {party ? <InfoRow label="Party" value={String(party)} /> : null}
          {earlyDeparture ? (
            <InfoRow label="Early Departure" value={formatDate(String(earlyDeparture))} />
          ) : null}

          <View
            style={{
              borderWidth: 1,
              borderColor: COLORS.line,
              borderRadius: 16,
              padding: 14,
              backgroundColor: COLORS.paper,
            }}
          >
            <Text style={{ fontWeight: '800', color: COLORS.ink }}>Medical Info</Text>
            <Text style={{ marginTop: 6, color: COLORS.text }}>
              {medical_info ? String(medical_info) : '—'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
}

function StaffScheduleScreen({ navigation }: any) {
  const token = getAuthToken();
  const headers = useMemo(() => getAuthHeaders(token), [token]);

  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!token) return;
      setError(null);
      setLoading(true);

      try {
        const res = await http.get('/api/events', {
          headers,
          params: {
            status: 'published',
            sort: 'starts_at:asc',
            'pagination[pageSize]': 500,
          },
        });

        const list = safeStrapiList(res.data);

        const sorted = [...list].sort((a, b) => {
          const da = Date.parse(pickField(a, 'starts_at') || '');
          const db = Date.parse(pickField(b, 'starts_at') || '');
          return (Number.isNaN(da) ? 0 : da) - (Number.isNaN(db) ? 0 : db);
        });

        (globalThis as any).staffEvents = sorted;
        if (mounted) setEvents(sorted);
      } catch (e: any) {
        if (mounted) {
          setEvents([]);
          setError(e?.response?.data?.error?.message || e.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <SafeAreaContainer>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.ink }}>Staff Schedule</Text>

        {loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ color: COLORS.red }}>{error}</Text> : null}

        {!loading && events.length === 0 ? (
          <Text style={{ marginTop: 12, color: COLORS.muted }}>No events found.</Text>
        ) : (
          <FlatList
            style={{ marginTop: 12 }}
            data={events}
            keyExtractor={(item) => String(item?.id ?? item?.documentId)}
            renderItem={({ item }) => {
              const title = pickField(item, 'title') || 'Untitled event';
              const starts = pickField(item, 'starts_at');
              const ends = pickField(item, 'ends_at');
              const location = pickField(item, 'location');
              const staffOnly = pickField(item, 'staffOnly') === true;

              return (
                <Pressable
                  onPress={() => navigation.navigate('StaffEventDetail', { event: item })}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.line,
                    backgroundColor: COLORS.paper,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
                    {title}
                  </Text>
                  <Text style={{ marginTop: 4, color: COLORS.muted }}>
                    {starts ? formatDate(starts) : 'Invalid date'}
                    {ends ? ` → ${formatDate(ends)}` : ''}
                    {location ? ` • ${location}` : ''}
                  </Text>
                  <Text style={{ marginTop: 8, color: staffOnly ? COLORS.red : COLORS.muted }}>
                    {staffOnly ? 'Staff-only' : 'Public'}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaContainer>
  );
}

function StaffEventDetailScreen({ route }: any) {
  const event = route.params?.event;

  const title = pickField(event, 'title') || 'Untitled event';
  const starts = pickField(event, 'starts_at');
  const ends = pickField(event, 'ends_at');
  const location = pickField(event, 'location');
  const staffOnly = pickField(event, 'staffOnly') === true;
  const description = pickField(event, 'description');

  return (
    <SafeAreaContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.ink }}>{title}</Text>

        <View style={{ marginTop: 12, gap: 8 }}>
          {starts ? <InfoRow label="Starts" value={formatDate(starts)} /> : null}
          {ends ? <InfoRow label="Ends" value={formatDate(ends)} /> : null}
          {location ? <InfoRow label="Location" value={String(location)} /> : null}
          <InfoRow label="Visibility" value={staffOnly ? 'Staff-only' : 'Public'} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '800', marginBottom: 6, color: COLORS.ink }}>Description</Text>
          <Text style={{ color: COLORS.text }}>
            {description ? JSON.stringify(description, null, 2) : 'No description'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
}

/** ---------- Navigator ---------- */

export default function CounselorStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.blue,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: '800',
        },
        contentStyle: {
          backgroundColor: COLORS.cream,
        },
      }}
    >
      <Stack.Screen
        name="CounselorHome"
        component={CounselorHomeScreen}
        options={{ title: 'Counselor Home' }}
      />
      <Stack.Screen
        name="StaffSchedule"
        component={StaffScheduleScreen}
        options={{ title: 'Staff Schedule' }}
      />
      <Stack.Screen
        name="StaffEventDetail"
        component={StaffEventDetailScreen}
        options={{ title: 'Event' }}
      />
      <Stack.Screen
        name="County"
        component={CountyScreen}
        options={({ route }: any) => ({ title: route.params?.countyName ?? 'County' })}
      />
      <Stack.Screen
        name="City"
        component={CityScreen}
        options={({ route }: any) => ({ title: route.params?.cityName ?? 'City' })}
      />
      <Stack.Screen
        name="Student"
        component={StudentScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? 'Student' })}
      />
    </Stack.Navigator>
  );
}

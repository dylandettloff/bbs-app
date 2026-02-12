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

const API_URL = 'http://localhost:1337';
const Stack = createNativeStackNavigator();

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
  const g = (global as any).authToken as string | undefined;
  if (g) return g;

  const hdr = (axios.defaults.headers as any)?.common?.Authorization;
  if (typeof hdr === 'string' && hdr.startsWith('Bearer ')) {
    return hdr.replace('Bearer ', '');
  }
  return undefined;
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
  return <View style={{ flex: 1, paddingTop: 8 }}>{children}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}>
      <Text style={{ fontWeight: '700' }}>{label}</Text>
      <Text style={{ marginTop: 4 }}>{value}</Text>
    </View>
  );
}

/** ---------- Screens ---------- */

function CounselorHomeScreen({ navigation }: any) {
  const token = getAuthToken();
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [loading, setLoading] = useState(false);
  const [counties, setCounties] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const staffEvents = (global as any).staffEvents ?? [];
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
  }, [token, headers]);

  if (!token) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 16 }}>
          Not signed in. Go back and sign in on the Counselor tab.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Next Staff Event</Text>

          <Pressable
            onPress={() => navigation.navigate('StaffSchedule')}
            style={{ paddingVertical: 10 }}
          >
            {nextEvent ? (
              <>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>
                  {nextEvent.title || 'Untitled event'}
                </Text>
                <Text style={{ marginTop: 4, color: '#6b7280' }}>
                  {formatDate(nextEvent.starts_at)}
                  {nextEvent.location ? ` • ${nextEvent.location}` : ''}
                </Text>
                <Text style={{ marginTop: 8, color: '#2563eb', fontWeight: '700' }}>
                  Open full schedule →
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: '#6b7280' }}>No upcoming staff events.</Text>
                <Text style={{ marginTop: 8, color: '#2563eb', fontWeight: '700' }}>
                  Open full schedule →
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>My Counties</Text>

          {loading ? (
            <View style={{ paddingVertical: 10 }}>
              <ActivityIndicator />
            </View>
          ) : null}

          {error ? <Text style={{ color: 'red', marginTop: 6 }}>{error}</Text> : null}

          {!loading && counties.length === 0 ? (
            <Text style={{ color: '#6b7280' }}>No counties assigned to this user.</Text>
          ) : (
            counties.map((c: any) => {
              const countyName =
                pickField(c, 'name') ||
                pickField(c?.county, 'name') ||
                `County #${c?.id}`;
              const countyId = c?.id ?? c?.county?.id ?? null;

              return (
                <Pressable
                  key={String(countyId ?? countyName)}
                  onPress={() => navigation.navigate('County', { countyId, countyName })}
                  style={{ paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 16 }}>• {countyName}</Text>
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
  const { countyName } = route.params;

  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCountyCities() {
      setError(null);
      setLoading(true);

      try {
        const res = await http.get('/api/counties', {
          headers,
          params: {
            status: 'published',
            'filters[name][$eq]': countyName,
            'pagination[pageSize]': 1,
            'populate[cities]': true,
          },
        });

        const first = res.data?.data?.[0];
        if (!first) throw new Error(`County "${countyName}" not found.`);

        const list = relList(first?.cities ?? first?.attributes?.cities);
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
  }, [countyName, headers]);

  return (
    <SafeAreaContainer>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{countyName}</Text>

        {loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}

        {!loading && cities.length === 0 ? (
          <Text style={{ marginTop: 12, color: '#6b7280' }}>
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
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700' }}>{cityNameLocal}</Text>
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
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStudentsFromCity() {
      setError(null);
      setLoading(true);

      try {
        // Match your Strapi behavior:
        // - list query filtered by documentId or id
        // - populate students and their photo
        const paramsByDocId = {
          status: 'published',
          'pagination[pageSize]': 1,
          'populate[students]': true,
          'populate[students][populate][photo]': true,
          ...(cityDocumentId ? { 'filters[documentId][$eq]': cityDocumentId } : {}),
        };

        const paramsById = {
          status: 'published',
          'pagination[pageSize]': 1,
          'populate[students]': true,
          'populate[students][populate][photo]': true,
          ...(cityId != null ? { 'filters[id][$eq]': cityId } : {}),
        };

        let first: any = null;

        // Try documentId first
        if (cityDocumentId) {
          const resDoc = await http.get('/api/cities', { headers, params: paramsByDocId });
          first = resDoc.data?.data?.[0] ?? null;
        }

        // Fallback to id if needed
        if (!first && cityId != null) {
          const resId = await http.get('/api/cities', { headers, params: paramsById });
          first = resId.data?.data?.[0] ?? null;
        }

        if (!first) {
          throw new Error(
            `City not found. id=${String(cityId)} documentId=${String(cityDocumentId)}`
          );
        }

        const rel = first?.students ?? first?.attributes?.students;
        const list = relList(rel);

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
  }, [cityId, cityDocumentId, headers]);

  return (
    <SafeAreaContainer>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{cityName}</Text>

        {loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}

        {!loading && students.length === 0 ? (
          <Text style={{ marginTop: 12, color: '#6b7280' }}>
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
                    borderRadius: 12,
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
                        backgroundColor: '#e5e7eb',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '700', color: '#374151' }}>
                        {name?.[0]?.toUpperCase?.() ?? 'S'}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700' }}>{name}</Text>
                    {pickField(item, 'hometown') ? (
                      <Text style={{ marginTop: 2, color: '#6b7280' }}>
                        {String(pickField(item, 'hometown'))}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={{ color: '#2563eb', fontWeight: '700' }}>View →</Text>
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
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{String(Name)}</Text>

        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: 140, height: 140, borderRadius: 16, marginTop: 12 }}
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

          <View style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontWeight: '700' }}>Medical Info</Text>
            <Text style={{ marginTop: 6 }}>{medical_info ? String(medical_info) : '—'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
}

function StaffScheduleScreen({ navigation }: any) {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

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

        (global as any).staffEvents = sorted;
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
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Staff Schedule</Text>

        {loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}

        {!loading && events.length === 0 ? (
          <Text style={{ marginTop: 12, color: '#6b7280' }}>No events found.</Text>
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
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700' }}>{title}</Text>
                  <Text style={{ marginTop: 4, color: '#6b7280' }}>
                    {starts ? formatDate(starts) : 'Invalid date'}
                    {ends ? ` → ${formatDate(ends)}` : ''}
                    {location ? ` • ${location}` : ''}
                  </Text>
                  <Text style={{ marginTop: 8, color: staffOnly ? '#ef4444' : '#6b7280' }}>
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
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{title}</Text>

        <View style={{ marginTop: 12, gap: 8 }}>
          {starts ? <InfoRow label="Starts" value={formatDate(starts)} /> : null}
          {ends ? <InfoRow label="Ends" value={formatDate(ends)} /> : null}
          {location ? <InfoRow label="Location" value={String(location)} /> : null}
          <InfoRow label="Visibility" value={staffOnly ? 'Staff-only' : 'Public'} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Description</Text>
          <Text style={{ color: '#111827' }}>
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
    <Stack.Navigator>
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

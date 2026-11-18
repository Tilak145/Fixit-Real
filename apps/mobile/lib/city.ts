import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { CITY_STORAGE_KEY, resolveCity } from './city-choice.ts';
import { listCities } from './fixit.ts';

/**
 * The city the customer is shopping in, remembered on this phone, and the list
 * of cities they can switch to (the owner's open cities, in the owner's order).
 * `city` is null until the choice has been read, so a screen can wait for it.
 */
export function useChosenCity() {
  const cities = useQuery({ queryKey: ['service-cities'], queryFn: listCities, staleTime: 5 * 60_000 });
  const [remembered, setRemembered] = useState<string | null>(null);
  const [read, setRead] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(CITY_STORAGE_KEY)
      .then(value => { if (live) setRemembered(value); })
      .catch(() => {})
      .finally(() => { if (live) setRead(true); });
    return () => { live = false; };
  }, []);

  const options = (cities.data ?? []).filter(city => city.is_active).map(city => city.label);
  const city = read && !cities.isPending ? resolveCity(options, remembered) : null;

  const choose = useCallback((label: string) => {
    setRemembered(label);
    AsyncStorage.setItem(CITY_STORAGE_KEY, label).catch(() => {});
  }, []);

  return { city, options, choose, loading: !read || cities.isPending };
}

import { Redirect } from 'expo-router';

/** FixIt opens on the customer home tab. */
export default function Index() {
  return <Redirect href="/tabs" />;
}

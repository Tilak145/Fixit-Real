import HomePage from '@/components/fixit/home';

// The tab bar pads the bottom safe area, so the page pads only the top.
export default function Tab() {
  return <HomePage edges={['top']} />;
}

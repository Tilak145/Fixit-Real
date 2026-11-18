// Sample content for the example pages in app/examples. It is not the app's
// data: a real screen reads its own storage or the project backend instead.

export type Recipe = { id: string; title: string; minutes: number; kcal: number; tags: string[]; description: string; ingredients: [string, string][] };
export const recipes: Recipe[] = [
  { id: 'green-bowl', title: 'Green goddess bowl', minutes: 25, kcal: 420, tags: ['Vegetarian'], description: 'Crunchy greens, quinoa and a bright herb dressing. Good warm or cold.', ingredients: [['Quinoa', '150 g'], ['Avocado', '1'], ['Baby spinach', '2 cups'], ['Lemon', '1']] },
  { id: 'shakshuka', title: 'Shakshuka', minutes: 30, kcal: 380, tags: ['Breakfast'], description: 'Eggs poached in a spiced tomato and pepper sauce.', ingredients: [['Eggs', '4'], ['Tomatoes', '400 g'], ['Red pepper', '1'], ['Cumin', '1 tsp']] },
  { id: 'miso-ramen', title: 'Miso ramen', minutes: 45, kcal: 610, tags: ['Dinner', 'New'], description: 'A rich miso broth with noodles, greens and a soft egg.', ingredients: [['Ramen noodles', '2 portions'], ['White miso', '3 tbsp'], ['Bok choy', '2'], ['Eggs', '2']] },
  { id: 'croissants', title: 'Almond croissants', minutes: 80, kcal: 340, tags: ['Baking'], description: 'Day-old croissants filled with almond cream and baked again.', ingredients: [['Croissants', '4'], ['Ground almonds', '100 g'], ['Butter', '60 g'], ['Sugar', '60 g']] },
];
export const recipeCategories = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export type Task = { id: string; title: string; detail: string; done: boolean; progress?: number };
export const todayTasks: Task[] = [
  { id: 'walk', title: 'Morning walk', detail: '30 min · done at 7:40', done: true },
  { id: 'read', title: 'Read 20 pages', detail: 'Done at 8:15', done: true },
  { id: 'water', title: 'Drink 8 glasses', detail: '5 of 8 so far', done: false, progress: 62 },
];

export type CalendarEvent = { id: string; day: number; start: string; end: string; title: string; place: string; color: 'chart-1' | 'chart-2' | 'chart-4' };
export const events: CalendarEvent[] = [
  { id: 'standup', day: 15, start: '9:00', end: '9:15', title: 'Team standup', place: 'Video call', color: 'chart-2' },
  { id: 'lunch', day: 15, start: '12:30', end: '13:30', title: 'Lunch with Ana', place: 'Corner Café', color: 'chart-4' },
  { id: 'run', day: 15, start: '18:00', end: '18:45', title: 'Evening run', place: 'Lakeside loop', color: 'chart-1' },
  { id: 'dentist', day: 20, start: '10:00', end: '10:30', title: 'Dentist', place: 'Main St clinic', color: 'chart-2' },
];
export const eventDays = [2, 5, 8, 12, 15, 16, 20];

export const spending = { total: '$1,842.20', change: '8.1%', bars: [40, 62, 48, 75, 55, 30, 92, 66, 44, 58] };
export const spendingByCategory: { label: string; amount: string; share: number; color: 'chart-1' | 'chart-2' | 'chart-3' }[] = [
  { label: 'Groceries', amount: '$612', share: 72, color: 'chart-3' },
  { label: 'Home', amount: '$540', share: 63, color: 'chart-2' },
  { label: 'Transport', amount: '$298', share: 35, color: 'chart-1' },
];

export type Notice = { id: string; title: string; body: string; time: string; unread: boolean; kind: 'reminder' | 'social' | 'system' };
export const notifications: Notice[] = [
  { id: 'n1', title: 'Weekly summary is ready', body: 'You completed 18 of 21 habits this week.', time: '9:41', unread: true, kind: 'system' },
  { id: 'n2', title: 'Ana liked your recipe', body: 'Green goddess bowl', time: '8:02', unread: true, kind: 'social' },
  { id: 'n3', title: 'Time for a short walk', body: 'You have been sitting for 2 hours.', time: 'Yesterday', unread: false, kind: 'reminder' },
  { id: 'n4', title: 'New sign-in', body: 'Pixel 9 · Berlin', time: 'Mon', unread: false, kind: 'system' },
];

export type Conversation = { id: string; name: string; initials: string; last: string; time: string; unread: number };
export const conversations: Conversation[] = [
  { id: 'ana', name: 'Ana Silva', initials: 'AS', last: 'See you at the café tomorrow!', time: '9:12', unread: 2 },
  { id: 'jordan', name: 'Jordan Lee', initials: 'JL', last: 'Sent the photos from Sunday', time: '8:47', unread: 0 },
  { id: 'kai', name: 'Kai Wong', initials: 'KW', last: 'Shall we split the groceries?', time: 'Yesterday', unread: 0 },
  { id: 'mia', name: 'Mia Patel', initials: 'MP', last: 'Thanks for the recipe!', time: 'Tue', unread: 0 },
];
export type Message = { id: string; mine: boolean; text: string; time: string };
export const messages: Message[] = [
  { id: 'm1', mine: false, text: 'Are we still on for tomorrow?', time: '9:02' },
  { id: 'm2', mine: true, text: 'Yes! 12:30 at the Corner Café?', time: '9:05' },
  { id: 'm3', mine: false, text: 'Perfect. I will book a table by the window.', time: '9:10' },
  { id: 'm4', mine: false, text: 'See you at the café tomorrow!', time: '9:12' },
];

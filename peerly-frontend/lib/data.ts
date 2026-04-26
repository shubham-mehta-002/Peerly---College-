import type { Post, Community, Message, Comment } from './types';

export const SAMPLE_POSTS: Post[] = [
  { id: 1, author: 'Aryan Mehta', anon: false, time: '2h ago', content: 'The new library extension hours are a game changer. Finally can stay past 10pm for exams 🙌', upvotes: 47, comments: 12, hasImage: false, trending: true, global: false },
  { id: 2, author: '?', anon: true, time: '4h ago', content: 'Hot take: the canteen food has gotten significantly worse this semester. The dal is basically water now. Anyone else notice this?', upvotes: 134, comments: 38, hasImage: false, trending: true, global: false },
  { id: 3, author: 'Priya Nair', anon: false, time: '6h ago', content: 'Just got my internship offer from Zepto! For anyone prepping for product roles, happy to share notes from my interview prep.', upvotes: 89, comments: 24, hasImage: false, trending: false, global: false },
  { id: 4, author: '?', anon: true, time: '1d ago', content: 'WiFi in Block C hostels is unusable after 11pm. Raised a ticket 3 weeks ago, zero response. This is the third semester in a row.', upvotes: 203, comments: 56, hasImage: false, trending: false, global: false },
  { id: 5, author: 'Kabir Sharma', anon: false, time: '1d ago', content: 'Quick reminder: the cultural fest sponsorship applications close this Friday. Link in bio.', upvotes: 31, comments: 7, hasImage: true, trending: false, global: true },
];

export const SAMPLE_COMMUNITIES: Community[] = [
  { id: 1, name: 'CSE Batch 2022', desc: 'Academic discussions, placement prep, exam notes', members: 187, category: 'Technical', active: true },
  { id: 2, name: 'Coding Club TIET', desc: 'Competitive programming, hackathons, project collabs', members: 143, category: 'Technical', active: false },
  { id: 3, name: 'Culturals Core Team', desc: 'Official fest coordination and volunteer management', members: 68, category: 'Cultural', active: false },
  { id: 4, name: 'Football League', desc: 'Inter-hostel matches, training sessions, tournaments', members: 112, category: 'Sports', active: false },
  { id: 5, name: 'Anonymous Confessions', desc: 'A safe space. All posts are anonymous by default.', members: 198, category: 'Cultural', active: false },
];

export const SAMPLE_MESSAGES: Message[] = [
  { id: 1, author: 'Priya Nair', text: 'Hey everyone, the placement drive for TCS is confirmed for Nov 15th', time: '10:02', mine: false },
  { id: 2, author: 'Rahul Singh', text: 'Is it for all branches or just CS/IT?', time: '10:04', mine: false },
  { id: 3, author: 'You', text: 'The notice said CS, IT and ECE eligible. Min 7.0 CGPA', time: '10:06', mine: true },
  { id: 4, author: 'Priya Nair', text: 'Thanks for checking! Anyone have the registration link?', time: '10:07', mine: false },
  { id: 5, author: 'Aryan Mehta', text: 'Just shared it in the pinned message above ↑', time: '10:09', mine: false },
  { id: 6, author: 'You', text: 'Good luck everyone 🤞', time: '10:11', mine: true },
];

export const SAMPLE_COMMENTS: Comment[] = [
  { id: 1, author: 'Rohit Verma', anon: false, time: '3h ago', text: 'Completely agree. Had dal today — tasted like warm water with a yellow tint.', upvotes: 22, depth: 0 },
  { id: 2, author: '?', anon: true, time: '2h ago', text: 'To be fair, it was decent last week. Maybe a one-off bad day?', upvotes: 4, depth: 1 },
  { id: 3, author: 'Sneha Iyer', anon: false, time: '2h ago', text: 'No it has been consistently bad since August. Someone should escalate to the mess committee.', upvotes: 31, depth: 1 },
  { id: 4, author: 'Aryan Mehta', anon: false, time: '1h ago', text: 'Already raised it. The committee says "vendor issue." Been saying that for 2 months.', upvotes: 18, depth: 2 },
  { id: 5, author: '?', anon: true, time: '45m ago', text: 'I just bring Maggi from my room at this point 💀', upvotes: 67, depth: 0 },
];

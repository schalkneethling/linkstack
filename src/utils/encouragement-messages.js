// -check
/**
 * Friendly librarian-themed encouragement messages
 * When users hit their unread bookmark limit
 */
export const ENCOURAGEMENT_MESSAGES = [
  "Your reading queue is full! 📖 How about checking out one of these before adding more?",
  "The shelves are packed! 📚 Time to read one and make room for this new addition.",
  "Hold that bookmark! 🔖 Your to-read pile is at capacity. Pick one to dive into first.",
  "Queue's full! 📝 Let's finish one of these gems before collecting more treasures.",
  "Reading list maxed out! 🎯 Time to actually read something from your collection.",
  "The stacks are full! 📕 Return one by reading it, then you can add this new find.",
  "Bookmark overload! 🗂️ How about exploring one of your saved reads first?",
];

/**
 * Get a random encouragement message
 */
export function getRandomEncouragementMessage() {
  const index = Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length);
  return ENCOURAGEMENT_MESSAGES[index];
}

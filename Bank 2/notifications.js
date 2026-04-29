const notifs = [];
let nextId = 1;

function push(type, message) {
  notifs.unshift({ id: nextId++, type, message, read: false, time: new Date().toISOString() });
  if (notifs.length > 100) notifs.pop();
}

function getAll() { return [...notifs]; }
function markRead() { notifs.forEach(n => { n.read = true; }); }
function unreadCount() { return notifs.filter(n => !n.read).length; }

module.exports = { push, getAll, markRead, unreadCount };

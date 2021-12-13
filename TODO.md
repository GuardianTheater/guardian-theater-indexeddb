# Flows

- user authenticates with Bungie
- fetch active profile -> characters -> activity history
- fetch and store PGCRs for the past X days (2 months?)
- fetch and store linked names for encountered players

- user authenticates with Twitch
- search all encountered player names, store connections
- check all encountered players for videos in activities at least once
- recheck activities within the past 24 hours if idle

- background
- dump activities from DB older than cutoff
-

# Observables

- [x] Observables for Bungie & Twitch auth state
- [x] bungieAuth -> Active user - getMembershipDataForCurrentUser - always fetch
- [x] bungieAuth + profile[] -> Active characters - getProfile - always
- [x] bungieAuth + character[] -> Active history - getActivityHistory - always, auto refresh
- [x] bungieAuth + activity[] -> PGCRs - getPostGameCarnageReport - only if missing from DB
- [x] bungieAuth + entry[] -> alternative names - getLinkedProfiles - only if missing from DB, add current name if missing
- [ ] twitchAuth + name[] -> get twitch accounts - only if missing or empty
- [ ] twitchAuth + entry[] + name[] + accounts[] -> get videos - only if missing or entry fresher than (last check - 24 hours)

# Protect the King

A top-down LAN party game. Protect your team's king while hunting the other one.

## Host a match

On the designated host machine, install Node.js 22.18+ (22.x) or 24+, then run:

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000` on the host. Players on the same Wi-Fi open one of the `LAN:` URLs printed by the server, such as `http://192.168.1.10:3000`. If they cannot connect, check the host firewall and whether Wi-Fi client isolation is enabled. Keep the server on a trusted LAN; do not port-forward it to the internet.

The first player to join controls the lobby. Both teams must fill before starting. The default is **4v4**, **90 seconds** per round, **first to 3** on a **64×64** board. Choose **Classic** for tile movement or **Smooth** for continuous eight-direction movement. Set **Pickups on board** to 0–40 (14 by default), then choose **Apply settings**. For a smaller test, choose 2 players per team and join from four tabs or devices.

## Play

- Move with **WASD** or the arrow keys. In Smooth, hold two directions to move diagonally. Turns carry momentum, so speed boosts make you slide farther; release the keys to hold your position. Look for gold crowns and armored hunters with team-colored shields. Your own piece has a white ring.
- Players wear **R** or **B** for their team. Bumping another player makes the mover recoil up to one tile or world unit while the blocker holds their ground. Successful strength pushes still shove the blocker instead. Contact between a king and an opposing non-king captures the king immediately.
- Kings can't collect pickups, but **Space** triggers a built-in four-second sprint. It starts ready each round and recharges ten seconds after the boost's scheduled end.
- Set **Teleport pairs** to 0–4 (one by default). Portal locations change each round. Anyone can step onto a numbered portal to travel to its matching endpoint if the exit is clear. Leave the arrival portal before stepping on it to travel back.
- Pickups go into your unlimited queue. **Space** uses the oldest item first. Orange **Strength** lets a non-king push opponents for six seconds, up to two tiles or world units per push. Walls, edges, and other players stop the push. Green **Speed** speeds you up for four seconds. Purple **Slow trap** goes at your feet, slows the first enemy who touches it for three seconds, and expires after 20 seconds if unused. Teammates don't trigger it.
- Collected pickups return after roughly 2.5–6.5 seconds at new random positions with randomly chosen types. The queue resets each round.
- Select **Enable sound** for the procedural soundtrack and game cues; the browser needs that click to start audio.
- When time expires, either nobody scores (**Draw**) or the team with more non-kings within five tiles of the opposing king earns a point (**Proximity**). Equal counts are a draw.
- Captures replay the last three seconds at ¾ speed, highlighting the hunter, king, and contact point. With sound enabled, a rewind cue marks the start and an impact cue marks contact. Use **Skip replay** or **Watch replay** before the host advances. Replays don't autoplay if your device requests reduced motion. Timeouts don't produce a replay.
- The lobby host starts the next round. The wall layout is fixed; opening pickup pairs are mirrored and respawns are independent. A player disconnect returns the match to the lobby.

`npm test` runs the game-rule tests. Re-run `npm run build` and restart the host after changes.
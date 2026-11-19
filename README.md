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

The first player to join controls the lobby. Both teams must fill before starting. The default is **4v4**, **90 seconds** per round, **first to 3** on a **64×64** board; use **Apply settings** to change those values or select the timeout rule. For a smaller test, choose 2 players per team and join from four tabs or devices.

## Play

- Move one tile at a time with **WASD** or the arrow keys. The gold ring marks each team's king. The crown rotates each round; everyone else can guard or hunt.
- Units block one another. Contact between a king and an opposing non-king captures the king immediately. The captor's team earns a point.
- An orange strength pickup lets an attacking non-king push an opposing non-king up to two free tiles for six seconds. Another pickup refreshes the timer. Walls, board edges, and other units stop the push. Green speeds you up; purple slows you down.
- When time expires, either nobody scores (**Draw**) or the team with more non-kings within five tiles of the opposing king earns a point (**Proximity**). Equal counts are a draw.
- The lobby host starts the next round. The prototype uses a fixed wall layout with new mirrored pickup placements every round. A player disconnect returns the match to the lobby.

`npm test` runs the game-rule tests. Re-run `npm run build` and restart the host after changes.
# Game Design and Functional Specification

## 1. Game Overview

This is a multiplayer social deduction game based on:

* Secret roles
* Night actions
* Daytime discussions
* Voting
* Deception
* Investigation
* Team-based objectives

The game is inspired by social deduction games such as *Mafia*, *Werewolf*, and *Town of Salem*, while introducing its own roles, mechanics, interactions, and scenarios.

The core gameplay alternates between:

1. **Night phases**, during which specific roles wake up and perform actions.
2. **Day phases**, during which surviving players discuss what happened, exchange information, accuse other players, and vote.
3. **Execution phases**, during which a player may be sent to the gallows and potentially eliminated.

The main objective is to identify and eliminate opposing players while protecting members of your own team and using role-specific information and abilities.

The game is intended to be multiplayer and remotely accessible.

## 2. Application Concept

The initial version must be able to run on one laptop while allowing other players to connect remotely through a link.

The intended architecture must allow:

* The game server/application to run on one laptop.
* The laptop to host the active game session.
* Other players to connect from their own devices.
* Players to communicate in real time.
* All game state and actions to be synchronized between connected players.

The application should therefore be designed as a real-time multiplayer web application.

## 3. Current Technology Stack

The current project is implemented as a lightweight real-time multiplayer web application using:

* **Node.js** for the backend runtime and game server.
* Node.js built-in **HTTP** APIs for serving the web application and handling server requests.
* Node.js built-in modules such as `fs`, `path`, and `crypto` for static file handling, path resolution, and server-side utilities.
* **WebSockets** through the [`ws`](https://www.npmjs.com/package/ws) package for real-time communication between connected players and the server.
* **Vanilla JavaScript** for the browser client and game interface.
* **HTML** for the application page structure.
* **CSS** for the visual design and responsive layout.
* A modular JavaScript game engine containing separate modules for scenarios, permissions, night resolution, voting, and victory evaluation.
* **Node.js built-in test runner** for automated tests, executed with `node --test`.
* Local image assets under `GameImages/` for role artwork, avatars, and village conditions.

The application currently runs locally with `npm start`, which starts `server.js`. The server uses port `4173` by default and can use the `PORT` environment variable when another port is required.

The current implementation does not use Java, Angular, a database, or Cloudflare as part of the project stack. External access, persistence, and deployment infrastructure may be added later if required.

## 4. Player Entry and Lobby System

### 4.1 Player Entry and Registration

When a player opens the game through the provided link, the player should be able to enter the game using a unique player name.

The name should be visible to the other players in the lobby and during the game.

### 4.2 Main Lobby Page

The main page is the central multiplayer lobby browser. It should allow players to:

* View available lobbies.
* Create a new lobby.
* Join an existing lobby.
* See the current player count for each lobby.
* See whether a lobby is waiting for players or already in progress.

### 4.3 Lobby Creation

A player can create a new lobby. The lobby should have a unique identifier or link that can be shared with other players.

The creator becomes the Host.

### 4.4 Lobby State

After joining a lobby, players should be able to see:

* The other players in the lobby.
* The current number of players.
* The minimum and maximum player requirements.
* Whether the game can be started.
* The Host.

The Host must be able to start the game when the required conditions are met.

### 4.5 Lobby Host

The player who created the lobby is the Host.

The Host is responsible for starting the game. When the Host starts the game, the game verifies that the minimum number of players is present and selects the appropriate scenario.

## 5. Roles and Alignments

Every player receives exactly one secret role when the game starts. A player's role is visible only to that player, except where the rules specifically state that another player knows their identity.

Roles are divided into three main alignments:

| Alignment            | Description                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Townsfolk**        | The good team. Their objective is to identify and eliminate the evil players.                                        |
| **Thieves**          | The main evil team. The Thieves know each other and cooperate during the night.                                      |
| **Independent Evil** | Neutral evil roles that do not belong to the Thieves. They play independently and have their own victory conditions. |

## 6. Role Definitions

### 6.1 Townsfolk Roles

#### Villager

The Villager has no special ability. The Villager participates in:

* Daytime discussions
* Accusations
* Voting
* Execution decisions

**Alignment:** Townsfolk

#### Healer

The Healer performs an action during the night.

Each night, the Healer can select one player to heal. If that player is attacked during the same night, the player survives.

The Healer may select themselves as a target, but can only heal themselves once per game.

**Alignment:** Townsfolk

#### Tavern Keeper

The Tavern Keeper performs an action during the night.

Each night, the Tavern Keeper can select one player. That player's night ability is blocked for the current night.

The Tavern Keeper cannot block the Werewolf's action during an even-numbered night, also called a Full Moon.

**Alignment:** Townsfolk

#### Militia

The Militia performs an investigation during the night by selecting one player.

The result identifies the target's alignment as one of:

* Townsfolk / Good
* Thieves / Evil
* Independent Evil / Neutral Evil

There is one exception:

* If the Militia investigates the **Master Thief**, the result appears as **Townsfolk / Good**.
* If the Militia investigates the normal **Thief**, the result is **Thieves / Evil**.

Therefore, the Master Thief can deceive the Militia.

**Alignment:** Townsfolk

#### Hunter

The Hunter can shoot one player during the night.

The Hunter cannot use the shooting ability during the first night. The Hunter may shoot starting from a later night.

There is a special interaction involving the RedHat:

* If a RedHat exists in the current game and the Hunter is still alive, the RedHat cannot be killed during the night by another player's attack.
* If the Hunter shoots a Townsfolk player during the night, the Hunter commits suicide during the following day and is removed from the game.

**Alignment:** Townsfolk

#### RedHat

The RedHat has a special protection ability.

The RedHat cannot die during the night as long as the Hunter is still alive. This protection applies to attacks from other players during the night.

**Alignment:** Townsfolk

#### Shadow

The Shadow performs its action last during the night.

The Shadow selects one player to investigate and receives information about which players visited the selected player during that night.

The Shadow does not receive:

* The visitors' roles
* The visitors' exact abilities
* The actions they performed
* Their intentions

The Shadow only receives information that a player visited the selected target.

**Example:** If the Shadow investigates Player A and the Thief visited Player A, the result is:

> Thief visited Player A.

The Shadow does not necessarily know that the Thief attacked Player A.

**Alignment:** Townsfolk

### 6.2 Thieves Team

The Thieves team consists of:

* Master Thief
* Thief

They are members of the same team, know each other's identities, and cooperate during the night. Their objective is to eliminate the opposing players.

#### Master Thief

The Master Thief:

* Knows the Thief.
* Works together with the Thief.
* Selects or designates the victim.
* Appears as Townsfolk when investigated by the Militia.

The Master Thief does not initially perform the physical attack.

When both Thieves are alive:

1. The Master Thief selects the victim.
2. The Thief performs the visit and attack.
3. The victim is attacked.

This distinction is important for the Shadow. If the Shadow investigates the victim, the Shadow sees that the Thief visited the victim.

#### Thief

The Thief:

* Knows the Master Thief.
* Works together with the Master Thief.
* Performs the actual attack.
* Appears as Evil when investigated by the Militia.

If the Thief dies or leaves the game, the Master Thief takes over the Thief's visiting and attacking function. From that point onward, the Master Thief selects and personally visits the victim.

### 6.3 Independent Evil Roles

#### Werewolf

The Werewolf is an Independent Evil role and plays alone.

The Werewolf cannot be killed during the night. If another player attempts to kill the Werewolf during the night, the attack has no effect.

The Werewolf becomes active on every even-numbered night, also called a Full Moon. During a Full Moon night, the Werewolf can select one player to kill.

##### Werewolf Visitor Interaction

During an even-numbered night / Full Moon, if another player visits the Werewolf, that visiting player is automatically killed by the Werewolf.

Visiting the Werewolf during a Full Moon is therefore extremely dangerous.

The Tavern Keeper cannot prevent the Werewolf from performing this Full Moon action.

#### Jester

The Jester is an Independent Evil role and plays independently.

The Jester's objective is to be eliminated through the daytime voting process. If the Jester is successfully executed by the daytime vote, the Jester wins the game.

The Jester therefore attempts to convince other players that they are suspicious or evil.

## 7. Game Start

When the Host starts the game:

1. The game verifies that the minimum number of players is present.
2. The appropriate scenario is selected based on the number of players.
3. Roles are assigned to all players.
4. Each player privately sees their role.
5. Players cannot see the roles of other players unless specifically allowed by the rules.
6. A 30-second preparation timer begins.
7. After the timer ends, the first night begins.

## 8. Night Phase

During the night, the game processes roles according to the predefined order.

Each active role receives 40 seconds to perform its action. The player can:

* Select a target.
* Choose not to target anyone.
* Continue without performing an action.

If the player does not make a decision within 40 seconds:

* No action is performed.
* The role goes back to sleep.
* The next role begins its turn.

The game automatically proceeds through the complete night sequence.

### 8.1 Night Action Order

Night actions occur in a fixed sequence:

1. Tavern Keeper
2. Thieves
3. Werewolf, only during a Full Moon
4. Militia
5. Healer
6. Hunter
7. Shadow

The order is important because earlier actions may affect roles that act later. For example, if the Tavern Keeper blocks the Militia, the Militia is unable to investigate when its turn begins.

### 8.2 Tavern Keeper Blocking Behavior

If a player has been blocked by the Tavern Keeper, the blocked player still wakes up when their normal turn begins.

Instead of being able to use their ability, the player sees a clear **BLOCKED** indicator or symbol. The player cannot use their role ability during that night.

The player still receives the normal 40-second action timer and may:

* Wait for the timer to expire.
* Select a Continue/Skip option.

Once the player continues, the game immediately proceeds to the next role in the night sequence. If the timer reaches zero, the game continues automatically.

Being blocked does not:

* Kill the player.
* Reveal the player's role.
* Remove the player from the game.
* Affect future nights.

It only prevents the role's current-night action.

### 8.3 No-Target Option

Every role with an active ability must have a **Do Not Select Anyone** option.

Selecting this option immediately ends that player's turn and allows the next role to act.

### 8.4 Nighttime Chat Restriction

The game chat must be completely blocked during the entire Night Phase.

While the night is active:

* Living players cannot send chat messages.
* Players cannot communicate through the daytime/common chat.
* The chat input is disabled.
* Players may interact only through their individual role/action interface.
* Dead spectators cannot use the living-player chat to influence the game.

The chat remains locked throughout:

* The role action sequence
* Night timers
* Night resolution

The chat becomes available again at the beginning of the Day Phase, after the game announces the night results.

### 8.5 Night Resolution

After all applicable roles complete their actions, the game calculates the results of the night.

The game engine must resolve:

* Attacks
* Healing
* Role blocking
* Werewolf attacks
* Werewolf visitor deaths
* Hunter interactions
* RedHat protection
* Other future role interactions

The results are processed before the Day Phase begins. The night chat remains locked during this resolution process.

## 9. Beginning of Day and Night Results

When the night ends, the game transitions into the Day Phase. Before daytime chat becomes available, the game must announce the results of the previous night.

The game should announce:

* Which players died during the night.
* The revealed roles of the dead players.
* Whether someone was successfully healed during the night.

The game must not reveal hidden information such as:

* Who attacked a player.
* Who healed a player.
* Who visited a player.
* Who blocked a player.
* The identity of the attacker.
* The identity of the Healer, unless a specific role rule explicitly allows that information to be revealed.

Only after these night-result announcements are complete should daytime chat be unlocked.

### 9.1 Healing Announcement

If a player was attacked during the night and successfully healed by the Healer, the game must announce that a healing occurred.

The announcement should be similar to:

> Someone was healed during the night.

The identity of the player must remain secret. The game must not reveal:

* Who was attacked.
* Who was healed.
* Who attacked them.
* Who healed them.

Only the fact that a successful healing occurred should be revealed.

## 10. Day Phase

After the night results have been announced:

* The game unlocks daytime chat.
* All surviving players can communicate.
* A four-minute discussion timer begins.

During the discussion, living players can:

* Talk about the previous night.
* Share information.
* Accuse other players.
* Defend themselves.
* Discuss investigations.
* Discuss suspicious behavior.
* Attempt to identify the Thieves.
* Attempt to identify Independent Evil roles.
* Use the game chat.

The daytime chat remains available throughout the discussion and voting-related daytime interaction where applicable.

### 10.1 Daytime Chat

The living players can communicate using the game chat during the daytime discussion.

The chat should operate in real time and clearly distinguish between living players and dead/spectator players.

Dead players:

* Cannot participate in the chat.
* Must not be able to influence the active game through chat.

The chat state follows this cycle:

```text
NIGHT
  -> Chat Locked
  -> Night Actions
  -> Night Resolution
  -> Night Results Announced
  -> Healing Results Announced
DAY
  -> Chat Unlocked
  -> Discussion
```

## 11. Daytime Voting and Execution

### 11.1 Daytime Vote

Before the four-minute discussion period ends, players must vote. Players can vote for:

* A specific player.
* Nobody.

The player receiving the highest number of votes is sent to the gallows.

### 11.2 Voting Ties

If two or more players receive the same highest number of votes:

* Nobody is sent to the gallows.
* No defense phase occurs.
* No final execution vote occurs.
* The game proceeds directly to the next night.

### 11.3 Gallows Defense

If one player receives the highest number of votes, that player is sent to the gallows and receives one minute to defend themselves.

During this period, they can explain:

* Why they are innocent.
* What information they have.
* What they believe happened.
* Why another player may be evil.

### 11.4 Final Execution Vote

After the one-minute defense period, the remaining eligible living players vote **YES** or **NO**.

If the player receives more YES votes:

* The player is executed.
* Their role is revealed.
* They become a spectator.
* The game proceeds to the next night.

If the player does not receive enough YES votes:

* The player survives.
* The game proceeds to the next night.

An equal number of YES and NO votes saves the nominee. The nominee is executed only when YES votes strictly outnumber NO votes.

## 12. Elimination, Leaving, and Spectators

### 12.1 Death and Role Reveal

Whenever a player is successfully eliminated:

* Their role is revealed.
* They are removed from active gameplay.
* They enter spectator mode.
* They can continue watching the game.

This applies to:

* Night deaths
* Daytime executions
* Hunter suicide
* Leaving or disconnecting from the game

### 12.2 Player Leaving During a Game

If a player leaves the application while a game is in progress:

* The player is immediately considered dead.
* Their role is revealed.
* They are removed from active gameplay.
* They cannot rejoin the current game session.

This prevents players from intentionally disconnecting and reconnecting to gain information or avoid consequences.

### 12.3 Spectator Mode

Dead players remain connected to the game as spectators.

A spectator:

* Can continue watching the game.
* Can see the current game phase.
* Can see the actions and results appropriate for spectators.
* Can see the roles of all players.
* Cannot vote.
* Cannot perform role actions.
* Cannot communicate with living players.
* Cannot write in the active game chat.
* Cannot influence the outcome.

The spectator remains in the game until the session ends.

## 13. Victory Conditions

The game continues through alternating night and day phases until a defined victory condition is reached.

The game must continuously evaluate victory conditions after relevant events, including:

* Night deaths
* Daytime executions
* Player disconnections
* Other role-specific eliminations

The game must support different victory conditions for:

* Townsfolk
* Thieves
* Werewolf
* Jester
* Future roles

### 13.1 Townsfolk Victory

The Townsfolk win when there are no remaining active opposing threats that prevent them from achieving their objective.

Specifically, if all remaining living players are Townsfolk and/or Jester, the Townsfolk win. The presence of a living Jester does not prevent a Townsfolk victory.

**Example:** If the remaining players are Villager, Healer, Militia, and Jester, the game ends with **Townsfolk Victory**. The Jester does not need to be eliminated for the Townsfolk to win.

### 13.2 Thieves Victory
The Thieves win when the number of living Thieves is equal to or greater than the number of all other living players, including Independent Evil roles. At that point, the remaining game state makes it impossible for the Townsfolk to eliminate the Thieves before they achieve their objective.

### 13.3 Werewolf Victory

The Werewolf is an Independent Evil role with an individual victory condition.

The Werewolf wins when at least one Werewolf is alive and no Townsfolk or Thieves remain. A living Jester does not prevent this victory. The Werewolf does not cooperate with the Thieves.

### 13.4 Jester Victory

The Jester wins if successfully eliminated through the daytime execution process.

The Jester's victory condition is independent of the Townsfolk and Thieves victory conditions. The interaction between a Jester victory and other simultaneous victory conditions must be formally defined in the final rules specification.

If the Jester is executed by the daytime final vote, the Jester victory takes precedence over any team victory caused by that execution.

### 13.5 Empty Game Result

If all players are dead or disconnected, the result is a **Draw**.

## 14. Fixed Scenarios by Player Count

The initial version supports predefined role configurations for 4–11 players. Each player count has a specific role configuration.

| Players | Role configuration                                                                                            |
| ------: | ------------------------------------------------------------------------------------------------------------- |
|       4 | 2 Villagers, 1 Thief, 1 Healer                                                                                |
|       5 | 2 Villagers, 1 Thief, 1 Healer, 1 Jester                                                                      |
|       6 | 2 Villagers, 1 Healer, 1 Militia, 1 Master Thief, 1 Thief                                                     |
|       7 | 2 Villagers, 1 Healer, 1 Militia, 1 Master Thief, 1 Thief, 1 Werewolf                                         |
|       8 | 2 Villagers, 1 Healer, 1 Militia, 1 Master Thief, 1 Thief, 1 Werewolf, 1 Tavern Keeper                       |
|       9 | 2 Villagers, 1 Healer, 1 Militia, 1 Master Thief, 1 Thief, 1 Werewolf, 1 Tavern Keeper, 1 Jester             |
|      10 | 2 Villagers, 1 Healer, 1 Militia, 1 Master Thief, 1 Thief, 1 Werewolf, 1 Shadow, 1 Jester, 1 Tavern Keeper    |
|      11 | 3 Villagers, 1 Healer, 1 Militia, 1 Master Thief, 1 Thief, 1 Werewolf, 1 Shadow, 1 Jester, 1 Tavern Keeper    |

## 15. Scenario Configuration System

Role scenarios must be implemented through a dedicated Scenario Configuration System. Role distributions must not be hard-coded directly into the core game engine.

Each scenario should define at minimum:

* Scenario ID
* Required player count
* Roles
* Quantity of each role
* Role alignments
* Available abilities
* Night action order
* Special rules
* Victory conditions

When the Host starts the game, the server selects the appropriate scenario based on the number of players.

### 15.1 Future Scenarios

The system must support future scenarios for larger player counts, including potential scenarios for:

* 12 players
* 13 players
* 14 players
* 15 players
* 16 or more players

It should also support:

* Alternative role distributions
* Custom scenarios
* Special game modes
* Event scenarios
* Experimental scenarios

Adding a new scenario should not require rewriting the core game engine.

## 16. Future Roles and Role Definition System

The game must be designed so new roles can be added in the future.

New roles may introduce:

* New night actions
* New daytime actions
* New investigation systems
* New attack systems
* New defensive abilities
* New forms of deception
* New team alignments
* New victory conditions
* New role interactions

The architecture should therefore use a modular role system.

Every role should have a structured definition containing information such as:

* Role ID
* Role name
* Description
* Team/alignment
* Role icon
* Role artwork
* Whether it acts during the night
* Night action priority
* Action timer
* Targeting rules
* Self-targeting rules
* Whether it can be blocked
* Whether it can be killed
* Investigation result
* Special interactions
* Victory condition

This information should be separated from the core game engine whenever possible.

## 17. Interaction and Rules Engine

Because many roles interact with one another, the game should use a centralized interaction and rules system.

Examples include:

| Interaction                           | Result                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Tavern Keeper -> Militia              | The Militia is blocked and cannot investigate.                                             |
| Thief -> Player A; Healer -> Player A | Player A survives. The day announcement states that someone was healed during the night.   |
| Hunter -> Werewolf                    | The Werewolf survives because it cannot be killed during the night.                        |
| Player -> Werewolf during Full Moon   | The player is killed by the Werewolf.                                                      |
| Master Thief + Thief                  | The Master Thief selects the victim, while the Thief performs the actual visit and attack. |

The game engine should resolve these interactions according to a clearly defined priority system.

## 18. Data-Driven Game Design

The game should be designed as a data-driven multiplayer game.

Game rules, role configurations, scenarios, timers, and role properties should be separated from the underlying networking and UI systems. This makes the game easier to maintain and expand.

For example, changing the Healer self-heal limit from 1 to 2 should ideally be a configuration or rule change rather than requiring a rewrite of the entire game system.45. Interaction / Rules Engine

## 19. Expandability

The architecture must allow the game to expand without requiring a complete rewrite.

Future additions may include:

* More players
* New roles
* New teams
* New scenarios
* New maps
* New villages
* New avatars
* New role artwork
* New abilities
* New victory conditions
* New game modes
* Custom games
* Special events
* Additional languages
* Additional UI themes

The core game engine should remain independent from these additions.

## 20. Core Game Loop

The fundamental game loop is:

```text
Lobby
  -> Role Assignment
  -> 30-Second Preparation
  -> Night
  -> Chat Locked
  -> Tavern Keeper
  -> Thieves
  -> Werewolf (Full Moon only)
  -> Militia
  -> Healer
  -> Hunter
  -> Shadow
  -> Night Resolution
  -> Night Death / Healing Results
  -> Roles of Dead Players Revealed
  -> Healing Announcement
  -> Chat Unlocked
  -> 4-Minute Discussion
  -> Daytime Vote
  -> Gallows / No Gallows
  -> 1-Minute Defense
  -> Final YES / NO Vote
  -> Executed or Saved
  -> Victory Check
  -> Next Night
  -> Repeat Until Victory
```

## 21. Design Philosophy

The game should emphasize:

* Social interaction
* Deception
* Deduction
* Information management
* Team cooperation
* Bluffing
* Strategic role usage
* Risk management
* Hidden information
* Replayability

The technical architecture should support the game design without limiting future expansion.

The initial release should focus on creating a stable, reliable multiplayer experience with the predefined 4–11 player scenarios while keeping the architecture flexible enough to support substantially more content in future versions.
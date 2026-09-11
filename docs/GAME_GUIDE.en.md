# vibrotato Game Guide

*open-vibrotato project · version 2.3.1 "Starform Crossing"*

## What this game is

vibrotato is a **single-file, offline action-survival game** with no server, no account, and no network
requirement. Save `vibrotato.html` locally and double-click it — that's the whole game. No installer,
no download progress bar, no third-party runtime.

A run starts with **one single Tier I weapon**. Over 20 waves you dodge and grind, pulling weapons,
cores and modifiers from randomized drops, and constantly trading credits against battlefield resources
to assemble a build that only exists for this one run. A run ends when you clear the final wave or die.
No two runs play out the same way — that's the core appeal of the build-survival ("bullet heaven") genre.

## Core gameplay loop

1. **Move to dodge, weapons auto-target and fire** — the only thing you actively manage is positioning;
   attacking itself is automatic.
2. **Shop between waves**: spend credits on weapons, items and cores, or dismantle gear you don't need
   for salvage.
3. **Merge and target**: two weapons that share the same name, mod and level can be merged into the next
   tier, up to Tier IV (the terminal, endgame form). You can also "target" a weapon you like to raise the
   odds the shop keeps offering the same upgrade path.
4. **Assemble cores**: cores aren't passive stat sticks — they're conditional mechanic rewrites. Example:
   "below 40% HP, attack speed +60%" or "every third slash fires two extra crossing echoes." You can equip
   at most two cores per run; swapping in a third requires an explicit replacement, never a silent override.
5. **Next wave, harder**: enemy count, HP, speed and elite odds all scale with both the wave number and
   the danger level you selected.

Clearing all 20 waves ends the run as "district liberated." Dying instead shows a death log replaying the
last 8 seconds of damage sources, so you can figure out what to change next run.

## 12 characters, 12 different starting angles

Characters aren't reskins — each one is a deliberate "grants X, restricts Y" build direction:

| Character | Codename | Identity | Core mechanic |
|---|---|---|---|
| SP-01 Street | THE ORIGINAL | Free-form | No extra rules — any weapon can carry the run |
| Lone Wolf | LONE WOLF | Less is more | All weapon damage +60%, but hard-capped at 3 slots |
| Gunner | BULLET CHEF | Rapid fire | Attack speed +40%, range +20%, can't equip melee |
| Armor | IRON POTATO | Armored counter | HP +60, armor +15, at the cost of move speed and pickup range |
| Gambler | LOADED DICE | Luck-driven | Luck +50%, but one weapon is randomly swapped each wave |
| Engineer | HIVE MAKER | Mechanical legion | Engineering-tagged weapon damage +65%, everything else heavily nerfed |
| Vampire | RED COVENANT | Sustain on contact | Lifesteal +8%, but normal HP regen is locked to zero |
| Scavenger | SCRAP SAINT | Loot economy | Material gain +30%, pickup range +100%, starts with 0 credits |
| Blade Dancer | BLADE DANCER | Interlaced blades | Blade-only loadout; dash makes your blades ready to strike instantly |
| Deadeye | DEADEYE | Piercing crit | Precision-only loadout; damage and crit chance both scale up |
| Triune | TRIUNE | Ice/fire/lightning fusion | Elemental-only loadout; lets ice, fire and lightning coexist to trigger cores |
| Demolition | DEMOLITION | Crowd-clearing blasts | Explosive-only loadout; blast radius and damage both scale up |

Each character steers you toward a different build path — start with SP-01 Street to learn the systems,
then try the restriction-based characters once you're comfortable.

## Weapon system

- **20 weapon families**, spanning pulse rifles, gatling guns, shotguns, rail snipers, flame, cryo,
  lightning, acid, gravity, singularity, melee blades, orbiting blades, sensor mines, drones and more,
  across ranged / melee / deployable / elemental categories.
- **5 rarity tiers** — shop weighting shifts toward higher rarity as waves progress (near-zero high-rarity
  weight at wave 1, noticeably higher by wave 15).
- **Merge progression**: two weapons that match on name, mod and level can be merged up a tier, capping
  at Tier IV — the terminal form, which can no longer be merged further.
- **Independent melee anchor points** (this version's headline feature): when a character wields multiple
  copies of the same melee weapon, each one gets its own floating anchor point, evenly split across 360°
  by blade count. Blades no longer bunch into a single overlapping weapon when mixed with guns or when the
  character turns — 2, 4, 6 and 8 blades all read as distinct, independently swinging weapons.

## The Core system

Cores are where the strategic depth lives. Each one has an explicit **trigger condition, mechanical
effect, and cost** — for example:

- **Redline Reactor** (low-HP berserker): at ≤40% HP, attack speed +60% and melee damage +35%, at the
  cost of −10 max HP and −40% healing effectiveness.
- **Prism Sheath** (interlaced echoes): every third swing of a fast blade fires two extra echoes at 70%
  damage each, at the cost of −10% global damage.
- **Sovereign Hive** (mechanical legion): summons drone allies once you're running 3+ engineering-tagged
  weapons, at the cost of −30% damage on non-engineering weapons.
- **Triune Furnace** (elemental fusion): detonates a fusion explosion when ice, fire and lightning are all
  active on the same enemy, at the cost of reduced damage and armor.

You can equip at most two cores per run, which pushes you to weigh condition-versus-payoff trade-offs
instead of just stacking flat numbers.

## Danger levels and difficulty curve

Unlocked danger levels (Danger 0–5) scale enemy HP, count, move speed and elite odds together. Clearing
a run unlocks the next tier, so you ramp difficulty at your own pace instead of being forced into the
hardest setting from the start.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Move — weapons auto-target and fire |
| Space / Shift | Dash, with brief invulnerability |
| Q | EMP burst — clears enemy projectiles and knocks back nearby enemies |
| C / Tab | Open the build and stats panel |
| E | Loot inventory — install or scrap picked-up items |
| F / top-right button | Toggle fullscreen |
| Esc | Pause / close panel |
| M | Mute |
| Mobile: left stick + right-side skill buttons | Two-thumb movement and skills |

## Who this is for

If you like the "auto-combat plus build-drafting" rhythm of games in the Vampire Survivors mold, but want
stronger weapon feedback (especially the visual clarity of multi-blade melee) and a Core system with real
conditional identity rather than flat stat bonuses, vibrotato is a 15–30 minute run: no install, no login,
no network, and always ready to start over.

For build instructions, technical details and test results, see the root [README.md](../README.md) and
[CHANGELOG.md](../CHANGELOG.md).

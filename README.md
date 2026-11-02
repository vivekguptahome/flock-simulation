# 🐟 School of Fish — Emergent Flocking Simulation

An interactive biological flocking simulation based on Craig Reynolds' Boids and Iain Couzin's collective animal behavior models, featuring procedural spine kinematics, fluid flow fields, dynamic ecosystems, and live sensory tuning.

---

## 🚀 How to Run

Simply **double-click** [`index.html`](file:///c:/Users/vivek/Documents/Test1/index.html) in your file manager to open it in any web browser (Chrome, Edge, Firefox, Brave, Safari). No installation, build step, or server required!

---

## 🧬 Biological Attributes Modeled

### 1. Couzin Three-Tier Sensory Zones
- **Zone of Repulsion (ZOR - Inner Ring)**: Collision avoidance. If another fish enters this intimate personal radius, repulsion overrides all other steering forces to prevent physical overlap.
- **Zone of Orientation (ZOO - Middle Ring)**: Alignment. The fish matches its heading and velocity with neighbors in this zone.
- **Zone of Attraction (ZOA - Outer Ring)**: Cohesion. The fish is gently drawn toward the center of mass of neighbors in this perimeter to prevent stragglers from becoming lost.

### 2. Rear Blind Spot ($60^\circ - 90^\circ$)
- Fish have eyes on the sides of their head and cannot see directly behind their tails.
- Excluding fish in the rear blind spot eliminates telepathic backward reactions, enabling authentic **swirling mills (torus vortices)** and **flowing streams**.

### 3. Locomotion & Burst Physics
- **Cruise & Burst Speeds**: Fish cruise gently to conserve energy but trigger rapid acceleration bursts when startled by predators or when rushing toward food pellets.
- **Water Drag & Damping**: Natural momentum coasting when steering forces subside.
- **Turn Agility Limits**: Anatomical turning radius limits prevent artificial, instantaneous pivots.

### 4. Procedural Segmented Spine Animation
- Each fish has a 5-segment skeletal chain that bends organically into turns.
- Tail-beat oscillation frequency dynamically scales with swim velocity.
- Tapered aerodynamic body contours with pectoral fins, caudal fin, and ambient drop shadows.

### 5. Dynamic Ecosystem & Interactive Stimuli
- **Predator (Shark)**: Features autonomous hunting AI and patrol loops. When it strikes, the school performs textbook anti-predator maneuvers like the **fountain effect** (splitting around the predator and reforming behind it) and **flash expansion**.
- **Food Pellets**: Sinking bait with aroma radius that triggers hungry foraging swarms.
- **Fluid Flow Field**: Ambient ocean currents and swirling vortices with obstacle deflection.

---

## 🎛 Controls & HUD

- **Mouse / Touch**:
  - `🟡 Sprinkle Food`: Click or drag on the water to spawn food pellets.
  - `🦈 Steer Shark`: Directly guide the apex predator with your cursor to test school evasion.
- **Presets**:
  - `Calm Lagoon`: Peaceful, shimmering school drifting with ambient currents.
  - `Swirling Torus`: Couzin vortex mill where the school locks into a self-perpetuating donut ring.
  - `Shark Attack`: Active predator strikes provoking dramatic evasions.
  - `Feeding Frenzy`: Distributed food pellets causing competitive cluster swarms.
- **Debug Overlays**:
  - Toggle **Show Sensory Zones** to see the 3 Couzin rings and rear blind spot on the lead fish.
  - Toggle **Show Current Vectors** to inspect the underlying ocean flow field.

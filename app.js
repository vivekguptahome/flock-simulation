/**
 * School of Fish / Boids Simulation — Minimalist Toroidal Edition
 * Features:
 * - Toroidal screen wrapping (seamless boundary wrapping with periodic distance math)
 * - Minimalist aesthetic: sleek geometric boid silhouettes, clean obstacles, muted monochrome/slate palette
 * - Couzin 3-tier zones (Repulsion, Orientation, Attraction) + rear blind spot
 */
(() => {
  // ==========================================
  // 1. Vector Math & Toroidal Utilities
  // ==========================================
  class Vec2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    set(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }

    copy() {
      return new Vec2(this.x, this.y);
    }

    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }

    sub(v) {
      this.x -= v.x;
      this.y -= v.y;
      return this;
    }

    mult(n) {
      this.x *= n;
      this.y *= n;
      return this;
    }

    div(n) {
      if (n !== 0) {
        this.x /= n;
        this.y /= n;
      }
      return this;
    }

    magSq() {
      return this.x * this.x + this.y * this.y;
    }

    mag() {
      return Math.hypot(this.x, this.y);
    }

    heading() {
      return Math.atan2(this.y, this.x);
    }

    normalize() {
      const m = this.mag();
      if (m > 0.00001) this.div(m);
      return this;
    }

    limit(max) {
      const mSq = this.magSq();
      if (mSq > max * max) this.normalize().mult(max);
      return this;
    }

    setMag(len) {
      return this.normalize().mult(len);
    }

    rotate(angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const newX = this.x * cos - this.y * sin;
      const newY = this.x * sin + this.y * cos;
      this.x = newX;
      this.y = newY;
      return this;
    }

    static fromAngle(angle, length = 1) {
      return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    static sub(v1, v2) {
      return new Vec2(v1.x - v2.x, v1.y - v2.y);
    }

    /**
     * Minimum image displacement on a 2D torus of size (w, h)
     */
    static toroidalDelta(target, origin, w, h) {
      let dx = target.x - origin.x;
      let dy = target.y - origin.y;
      if (dx > w * 0.5) dx -= w;
      else if (dx < -w * 0.5) dx += w;
      if (dy > h * 0.5) dy -= h;
      else if (dy < -h * 0.5) dy += h;
      return new Vec2(dx, dy);
    }
  }

  // ==========================================
  // 2. Minimalist Obstacles
  // ==========================================
  class Obstacle {
    constructor(x, y, radius) {
      this.pos = new Vec2(x, y);
      this.radius = radius;
      this.cushion = radius * 1.5;
    }

    draw(ctx, showDebug = false) {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);

      // Clean, understated circular barrier
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner subtle anchor dot
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();

      if (showDebug) {
        ctx.beginPath();
        ctx.arc(0, 0, this.cushion, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  // ==========================================
  // 3. Minimalist Food Pellet
  // ==========================================
  class FoodPellet {
    constructor(x, y) {
      this.pos = new Vec2(x, y);
      this.vel = new Vec2((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
      this.radius = 2.5;
      this.life = 1.0;
      this.decayRate = 0.0005;
    }

    update(w, h) {
      this.pos.add(this.vel);
      // Toroidal wrap for food
      if (this.pos.x < 0) this.pos.x += w;
      else if (this.pos.x > w) this.pos.x -= w;
      if (this.pos.y < 0) this.pos.y += h;
      else if (this.pos.y > h) this.pos.y -= h;
      this.life -= this.decayRate;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(226, 232, 240, ${0.8 * this.life})`;
      ctx.fill();
    }
  }

  // ==========================================
  // 4. Minimalist Boid Entity
  // ==========================================
  class Boid {
    constructor(x, y, config) {
      this.pos = new Vec2(x, y);
      const startAngle = Math.random() * Math.PI * 2;
      this.vel = Vec2.fromAngle(startAngle, config.cruiseSpeed);
      this.acc = new Vec2(0, 0);

      this.traitNoise = 0.92 + Math.random() * 0.16;
      this.scale = 0.88 + Math.random() * 0.24;
      this.mass = this.scale;
      this.personalCruiseSpeed = config.cruiseSpeed * this.traitNoise;
      this.personalMaxSpeed = config.maxSpeed * this.traitNoise;
      this.turnAgility = config.maxForce / this.mass;

      this.burstTimer = 0;
      this.isPanicking = false;

      // Subtle muted shade: clean monochrome/silver with slight brightness variation
      const lightness = 65 + Math.random() * 25;
      this.color = `rgba(220, 226, 235, ${0.45 + (lightness / 100) * 0.4})`;
      this.accentColor = `rgba(241, 245, 249, 0.95)`;
    }

    applyForce(force) {
      const f = force.copy().div(this.mass);
      this.acc.add(f);
    }

    flock(neighbors, config, w, h) {
      let repulseForce = new Vec2(0, 0);
      let orientForce = new Vec2(0, 0);
      let attractForce = new Vec2(0, 0);

      let repulseCount = 0;
      let orientCount = 0;
      let attractCount = 0;

      const heading = this.vel.heading();
      const halfBlind = (config.blindAngle * Math.PI / 180) * 0.5;

      const rRepSq = (config.repulseRadius * this.scale) ** 2;
      const rOriSq = (config.orientRadius * this.scale) ** 2;
      const rAttSq = (config.attractRadius * this.scale) ** 2;

      for (let i = 0; i < neighbors.length; i++) {
        const other = neighbors[i];
        if (other === this) continue;

        // Toroidal displacement vector
        const toOther = Vec2.toroidalDelta(other.pos, this.pos, w, h);
        const dSq = toOther.magSq();
        if (dSq > rAttSq) continue;

        const angleToOther = toOther.heading();
        let diffAngle = angleToOther - heading;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;

        const inBlindSpot = Math.abs(diffAngle) > (Math.PI - halfBlind);

        if (dSq < rRepSq) {
          const d = Math.sqrt(dSq) || 0.001;
          const diff = toOther.copy().mult(-1).div(d * d);
          repulseForce.add(diff);
          repulseCount++;
        } else if (dSq < rOriSq && !inBlindSpot) {
          orientForce.add(other.vel);
          orientCount++;
        } else if (!inBlindSpot) {
          attractForce.add(toOther);
          attractCount++;
        }
      }

      if (repulseCount > 0) {
        repulseForce.div(repulseCount);
        repulseForce.setMag(this.personalMaxSpeed);
        const steer = Vec2.sub(repulseForce, this.vel).limit(this.turnAgility * 1.6);
        this.applyForce(steer.mult(config.weightRepulsion));
        return;
      }

      if (orientCount > 0) {
        orientForce.div(orientCount);
        orientForce.setMag(this.personalCruiseSpeed);
        const steer = Vec2.sub(orientForce, this.vel).limit(this.turnAgility);
        this.applyForce(steer.mult(config.weightOrientation));
      }

      if (attractCount > 0) {
        attractForce.div(attractCount);
        const desired = attractForce.setMag(this.personalCruiseSpeed);
        const steer = Vec2.sub(desired, this.vel).limit(this.turnAgility * 0.9);
        this.applyForce(steer.mult(config.weightAttraction));
      }
    }

    handleObstacles(obstacles, w, h) {
      for (const obs of obstacles) {
        const toObs = Vec2.toroidalDelta(obs.pos, this.pos, w, h);
        const d = toObs.mag();
        if (d < obs.cushion) {
          const away = toObs.mult(-1).setMag(this.personalMaxSpeed);
          const intensity = (1 - d / obs.cushion);
          away.mult(intensity * 2.0);
          const steer = Vec2.sub(away, this.vel).limit(this.turnAgility * 2.2);
          this.applyForce(steer);
        }
      }
    }

    seekFood(foodPellets, w, h) {
      let closest = null;
      let closestDistSq = Infinity;
      const maxScentDistSq = 140 * 140;

      for (const food of foodPellets) {
        if (food.life <= 0) continue;
        const delta = Vec2.toroidalDelta(food.pos, this.pos, w, h);
        const dSq = delta.magSq();
        if (dSq < maxScentDistSq && dSq < closestDistSq) {
          closestDistSq = dSq;
          closest = { food, delta };
        }
      }

      if (closest) {
        const d = Math.sqrt(closestDistSq);
        if (d < 8 * this.scale) {
          closest.food.life -= 0.6;
          this.burstTimer = 15;
        }
        const desired = closest.delta.copy().setMag(this.personalCruiseSpeed * 1.3);
        const steer = Vec2.sub(desired, this.vel).limit(this.turnAgility * 1.2);
        this.applyForce(steer.mult(1.3));
      }
    }

    evadePredator(predator, w, h) {
      if (!predator || !predator.active) {
        this.isPanicking = false;
        return;
      }

      const toPred = Vec2.toroidalDelta(predator.pos, this.pos, w, h);
      const d = toPred.mag();

      if (d < predator.threatRadius) {
        this.isPanicking = true;
        this.burstTimer = 22;

        const panicFlee = toPred.mult(-1);
        const predHeading = predator.vel.heading();
        const myBearing = Math.atan2(-toPred.y, -toPred.x);
        let sideAngle = myBearing - predHeading;
        while (sideAngle > Math.PI) sideAngle -= Math.PI * 2;
        while (sideAngle < -Math.PI) sideAngle += Math.PI * 2;

        panicFlee.rotate(sideAngle >= 0 ? 0.75 : -0.75);
        panicFlee.setMag(this.personalMaxSpeed * 1.4);

        const steer = Vec2.sub(panicFlee, this.vel).limit(this.turnAgility * 2.6);
        this.applyForce(steer.mult(2.4));
      } else {
        this.isPanicking = false;
      }
    }

    update(w, h) {
      this.vel.add(this.acc);

      let targetTopSpeed = this.personalCruiseSpeed;
      if (this.burstTimer > 0) {
        this.burstTimer--;
        targetTopSpeed = this.personalMaxSpeed;
      }

      const speed = this.vel.mag();
      if (speed > targetTopSpeed) {
        this.vel.mult(0.96);
      } else if (speed < this.personalCruiseSpeed * 0.7) {
        this.vel.setMag(this.personalCruiseSpeed * 0.7);
      }

      this.pos.add(this.vel);
      this.acc.set(0, 0);

      // ==========================================
      // Toroidal Screen Wrapping
      // ==========================================
      if (this.pos.x < 0) this.pos.x += w;
      else if (this.pos.x >= w) this.pos.x -= w;

      if (this.pos.y < 0) this.pos.y += h;
      else if (this.pos.y >= h) this.pos.y -= h;
    }

    /**
     * Minimalist Geometric Silhouette: Sleek tapered boid triangle
     */
    draw(ctx, showDebug = false) {
      const angle = this.vel.heading();
      const s = this.scale;
      const len = 10 * s;
      const width = 4.2 * s;

      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(angle);

      // Sleek minimal triangle boid
      ctx.beginPath();
      ctx.moveTo(len, 0);               // Nose
      ctx.lineTo(-len * 0.65, -width);  // Left wing
      ctx.lineTo(-len * 0.35, 0);       // Inner notch
      ctx.lineTo(-len * 0.65, width);   // Right wing
      ctx.closePath();

      ctx.fillStyle = this.isPanicking ? '#ffffff' : this.color;
      ctx.fill();

      // Subtle center spine line
      ctx.beginPath();
      ctx.moveTo(len * 0.8, 0);
      ctx.lineTo(-len * 0.3, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // Minimalist Debug Overlays
      if (showDebug) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 24 * s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 60 * s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 125 * s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.stroke();
      }
    }
  }

  // ==========================================
  // 5. Minimalist Predator Entity
  // ==========================================
  class Predator {
    constructor(x, y) {
      this.pos = new Vec2(x, y);
      this.vel = new Vec2(1.5, 0);
      this.acc = new Vec2(0, 0);
      this.active = false;
      this.threatRadius = 140;
      this.maxCruiseSpeed = 2.4;
      this.maxStrikeSpeed = 4.4;
      this.maxForce = 0.12;

      this.followMouse = false;
      this.mousePos = new Vec2(x, y);
    }

    applyForce(force) {
      this.acc.add(force);
    }

    update(school, w, h, obstacles) {
      if (!this.active) return;

      if (this.followMouse) {
        const desired = Vec2.toroidalDelta(this.mousePos, this.pos, w, h);
        if (desired.mag() > 10) {
          desired.setMag(this.maxStrikeSpeed);
          const steer = Vec2.sub(desired, this.vel).limit(this.maxForce * 2);
          this.applyForce(steer);
        }
      } else {
        // Hunt closest boid toroidally
        let closest = null;
        let closestDistSq = Infinity;
        for (let i = 0; i < school.length; i += 3) {
          const delta = Vec2.toroidalDelta(school[i].pos, this.pos, w, h);
          const dSq = delta.magSq();
          if (dSq < closestDistSq) {
            closestDistSq = dSq;
            closest = delta;
          }
        }

        if (closest) {
          const desired = closest.copy().setMag(this.maxCruiseSpeed);
          const steer = Vec2.sub(desired, this.vel).limit(this.maxForce);
          this.applyForce(steer);
        }
      }

      this.vel.add(this.acc);
      this.vel.limit(this.followMouse ? this.maxStrikeSpeed : this.maxCruiseSpeed);
      this.pos.add(this.vel);
      this.acc.set(0, 0);

      // Toroidal wrap
      if (this.pos.x < 0) this.pos.x += w;
      else if (this.pos.x >= w) this.pos.x -= w;
      if (this.pos.y < 0) this.pos.y += h;
      else if (this.pos.y >= h) this.pos.y -= h;
    }

    draw(ctx, showDebug = false) {
      if (!this.active) return;
      const angle = this.vel.heading();

      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(angle);

      // Sleek, minimal dark wedge
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -7);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 7);
      ctx.closePath();
      ctx.fillStyle = '#f43f5e';
      ctx.fill();

      ctx.restore();

      if (showDebug) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.threatRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.18)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ==========================================
  // 6. Simulation Engine (Toroidal)
  // ==========================================
  class Simulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.width = canvas.width;
      this.height = canvas.height;

      this.config = {
        fishCount: 180,
        repulseRadius: 24,
        orientRadius: 65,
        attractRadius: 130,
        blindAngle: 75,
        weightRepulsion: 1.8,
        weightOrientation: 1.1,
        weightAttraction: 0.9,
        cruiseSpeed: 2.2,
        maxSpeed: 4.4,
        maxForce: 0.16,
        obstacleCount: 3,
      };

      this.boids = [];
      this.obstacles = [];
      this.foodPellets = [];
      this.predator = new Predator(this.width * 0.2, this.height * 0.2);

      this.mousePos = new Vec2(this.width * 0.5, this.height * 0.5);
      this.mouseMode = 'food';
      this.isMouseDown = false;
      this.showDebug = false;

      this.polarization = 0;
      this.fps = 60;
      this.frameCount = 0;
      this.fpsTimer = performance.now();

      this.initObstacles();
      this.initBoids();
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      this.canvas.width = width;
      this.canvas.height = height;
      this.initObstacles();
    }

    initObstacles() {
      this.obstacles = [];
      const count = this.config.obstacleCount;
      for (let i = 0; i < count; i++) {
        const x = this.width * (0.2 + (i / count) * 0.6);
        const y = this.height * (0.25 + (i % 2) * 0.5);
        this.obstacles.push(new Obstacle(x, y, 32 + (i % 2) * 16));
      }
    }

    initBoids() {
      this.boids = [];
      for (let i = 0; i < this.config.fishCount; i++) {
        this.boids.push(new Boid(Math.random() * this.width, Math.random() * this.height, this.config));
      }
    }

    setBoidCount(count) {
      this.config.fishCount = count;
      while (this.boids.length < count) {
        this.boids.push(new Boid(Math.random() * this.width, Math.random() * this.height, this.config));
      }
      if (this.boids.length > count) {
        this.boids.length = count;
      }
    }

    applyPreset(name) {
      switch (name) {
        case 'calm':
          this.config.repulseRadius = 24;
          this.config.orientRadius = 65;
          this.config.attractRadius = 130;
          this.config.weightRepulsion = 1.8;
          this.config.weightOrientation = 1.1;
          this.config.weightAttraction = 0.9;
          this.config.cruiseSpeed = 2.2;
          this.predator.active = false;
          break;
        case 'vortex':
          this.config.repulseRadius = 22;
          this.config.orientRadius = 75;
          this.config.attractRadius = 160;
          this.config.weightRepulsion = 1.5;
          this.config.weightOrientation = 1.6;
          this.config.weightAttraction = 1.3;
          this.config.cruiseSpeed = 2.7;
          this.predator.active = false;
          break;
        case 'shark':
          this.config.repulseRadius = 26;
          this.config.orientRadius = 65;
          this.config.attractRadius = 135;
          this.config.weightRepulsion = 2.0;
          this.config.weightOrientation = 1.2;
          this.config.weightAttraction = 0.8;
          this.config.cruiseSpeed = 2.4;
          this.predator.active = true;
          this.predator.followMouse = false;
          break;
        case 'feeding':
          this.config.repulseRadius = 20;
          this.config.orientRadius = 45;
          this.config.attractRadius = 150;
          this.config.weightRepulsion = 1.4;
          this.config.weightOrientation = 0.7;
          this.config.weightAttraction = 1.5;
          this.config.cruiseSpeed = 2.8;
          this.predator.active = false;
          for (let i = 0; i < 6; i++) {
            this.dropFood(Math.random() * this.width, Math.random() * this.height);
          }
          break;
      }
    }

    dropFood(x, y) {
      for (let i = 0; i < 3; i++) {
        this.foodPellets.push(new FoodPellet(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14));
      }
    }

    step() {
      const w = this.width;
      const h = this.height;

      // Update food
      for (let i = this.foodPellets.length - 1; i >= 0; i--) {
        const food = this.foodPellets[i];
        food.update(w, h);
        if (food.life <= 0) this.foodPellets.splice(i, 1);
      }

      // Update predator
      if (this.predator.active) {
        if (this.mouseMode === 'predator' && this.isMouseDown) {
          this.predator.followMouse = true;
          this.predator.mousePos = this.mousePos.copy();
        } else {
          this.predator.followMouse = false;
        }
        this.predator.update(this.boids, w, h, this.obstacles);
      }

      // Update boids
      let sumVel = new Vec2(0, 0);
      for (let i = 0; i < this.boids.length; i++) {
        const boid = this.boids[i];
        boid.flock(this.boids, this.config, w, h);
        boid.handleObstacles(this.obstacles, w, h);
        boid.seekFood(this.foodPellets, w, h);
        boid.evadePredator(this.predator, w, h);
        boid.update(w, h);

        sumVel.add(boid.vel.copy().normalize());
      }

      this.polarization = this.boids.length > 0 ? (sumVel.mag() / this.boids.length) : 0;

      // FPS
      this.frameCount++;
      const now = performance.now();
      if (now - this.fpsTimer >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
        this.frameCount = 0;
        this.fpsTimer = now;
      }
    }

    draw() {
      const ctx = this.ctx;

      // Clean, elegant deep matte background
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, this.width, this.height);

      // Minimalist Obstacles
      for (const obs of this.obstacles) {
        obs.draw(ctx, this.showDebug);
      }

      // Food pellets
      for (const food of this.foodPellets) {
        food.draw(ctx);
      }

      // Boids
      for (let i = 0; i < this.boids.length; i++) {
        this.boids[i].draw(ctx, i === 0 && this.showDebug);
      }

      // Predator
      if (this.predator.active) {
        this.predator.draw(ctx, this.showDebug);
      }
    }
  }

  // ==========================================
  // 7. UI Controls Setup
  // ==========================================
  function setupUI(simulation) {
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        simulation.applyPreset(btn.dataset.preset);
        syncSliders(simulation);
      });
    });

    function bind(id, key, valId, format = (v) => v, cb = null) {
      const slider = document.getElementById(id);
      const label = document.getElementById(valId);
      if (!slider || !label) return;
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        label.textContent = format(val);
        if (key) simulation.config[key] = val;
        if (cb) cb(val);
      });
    }

    bind('slider-repulse', 'repulseRadius', 'val-repulse', (v) => `${v}px`);
    bind('slider-orient', 'orientRadius', 'val-orient', (v) => `${v}px`);
    bind('slider-attract', 'attractRadius', 'val-attract', (v) => `${v}px`);
    bind('slider-blind', 'blindAngle', 'val-blind', (v) => `${v}°`);
    bind('slider-weight-repulse', 'weightRepulsion', 'val-weight-repulse', (v) => v.toFixed(1));
    bind('slider-weight-orient', 'weightOrientation', 'val-weight-orient', (v) => v.toFixed(1));
    bind('slider-weight-attract', 'weightAttraction', 'val-weight-attract', (v) => v.toFixed(1));
    bind('slider-speed', 'cruiseSpeed', 'val-speed', (v) => v.toFixed(1));
    bind('slider-count', null, 'val-count', (v) => `${v}`, (v) => simulation.setBoidCount(parseInt(v, 10)));

    const tDebug = document.getElementById('toggle-debug');
    if (tDebug) tDebug.addEventListener('change', (e) => simulation.showDebug = e.target.checked);

    const tPred = document.getElementById('toggle-predator');
    if (tPred) tPred.addEventListener('change', (e) => simulation.predator.active = e.target.checked);

    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        simulation.mouseMode = btn.dataset.tool;
      });
    });

    const canvas = simulation.canvas;
    function updateMouse(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      simulation.mousePos.x = clientX - rect.left;
      simulation.mousePos.y = clientY - rect.top;
    }

    function handleMouse(e) {
      updateMouse(e);
      if (simulation.mouseMode === 'food') {
        simulation.dropFood(simulation.mousePos.x, simulation.mousePos.y);
      } else if (simulation.mouseMode === 'predator') {
        simulation.predator.active = true;
        simulation.predator.mousePos = simulation.mousePos.copy();
        if (tPred) tPred.checked = true;
      }
    }

    canvas.addEventListener('mousedown', (e) => { simulation.isMouseDown = true; handleMouse(e); });
    window.addEventListener('mouseup', () => { simulation.isMouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      updateMouse(e);
      if (simulation.isMouseDown && simulation.mouseMode === 'food' && Math.random() < 0.3) {
        simulation.dropFood(simulation.mousePos.x, simulation.mousePos.y);
      }
    });

    canvas.addEventListener('touchstart', (e) => { simulation.isMouseDown = true; handleMouse(e); }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      updateMouse(e);
      if (simulation.isMouseDown && simulation.mouseMode === 'food' && Math.random() < 0.3) {
        simulation.dropFood(simulation.mousePos.x, simulation.mousePos.y);
      }
    }, { passive: true });
    window.addEventListener('touchend', () => { simulation.isMouseDown = false; });

    const togglePanelBtn = document.getElementById('toggle-panel-btn');
    const panel = document.getElementById('hud-panel');
    if (togglePanelBtn && panel) {
      togglePanelBtn.addEventListener('click', () => {
        panel.classList.toggle('minimized');
        togglePanelBtn.textContent = panel.classList.contains('minimized') ? '⚙ Controls' : '✕ Close';
      });
    }

    setInterval(() => {
      const fpsElem = document.getElementById('stat-fps');
      if (fpsElem) fpsElem.textContent = simulation.fps;
      const countElem = document.getElementById('stat-count');
      if (countElem) countElem.textContent = simulation.boids.length;
      const polarElem = document.getElementById('stat-polar');
      if (polarElem) polarElem.textContent = (simulation.polarization * 100).toFixed(0) + '%';
    }, 250);
  }

  function syncSliders(simulation) {
    const set = (id, val, text) => {
      const slider = document.getElementById(id);
      if (slider) slider.value = val;
      const disp = document.getElementById(`val-${id.replace('slider-', '')}`);
      if (disp) disp.textContent = text;
    };
    set('slider-repulse', simulation.config.repulseRadius, `${simulation.config.repulseRadius}px`);
    set('slider-orient', simulation.config.orientRadius, `${simulation.config.orientRadius}px`);
    set('slider-attract', simulation.config.attractRadius, `${simulation.config.attractRadius}px`);
    set('slider-blind', simulation.config.blindAngle, `${simulation.config.blindAngle}°`);
    set('slider-weight-repulse', simulation.config.weightRepulsion, simulation.config.weightRepulsion.toFixed(1));
    set('slider-weight-orient', simulation.config.weightOrientation, simulation.config.weightOrientation.toFixed(1));
    set('slider-weight-attract', simulation.config.weightAttraction, simulation.config.weightAttraction.toFixed(1));
    set('slider-speed', simulation.config.cruiseSpeed, simulation.config.cruiseSpeed.toFixed(1));
    const tPred = document.getElementById('toggle-predator');
    if (tPred) tPred.checked = simulation.predator.active;
  }

  // ==========================================
  // 8. Initialization
  // ==========================================
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sim-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const sim = new Simulation(canvas);
    setupUI(sim);

    window.addEventListener('resize', () => {
      sim.resize(window.innerWidth, window.innerHeight);
    });

    function loop() {
      sim.step();
      sim.draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();

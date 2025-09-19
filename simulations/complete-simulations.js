// File: simulations/complete-simulations.js
// Complete physics simulations that integrate with the existing engine

// Pendulum Simulation
class PendulumSimulation extends MatterSimulation {
    constructor(canvas, ctx, tui, Matter) {
        super(canvas, ctx, tui, Matter);
        this.parameters = {
            length: { label: 'Pendulum Length', value: 150, min: 50, max: 250, step: 10, unit: 'px' },
            mass: { label: 'Bob Mass', value: 10, min: 5, max: 30, step: 2, unit: 'kg' },
            damping: { label: 'Air Resistance', value: 0, min: 0, max: 0.05, step: 0.005, unit: '' },
            angle: { label: 'Initial Angle', value: 30, min: 5, max: 85, step: 5, unit: '°' }
        };

        this.bob = null;
        this.constraint = null;
        this.trail = [];
        this.energyHistory = [];
        this.time = 0;
    }

    setupWorld() {
        this.world.gravity.scale = 0.001;

        const centerX = this.canvas.width / 2;
        const centerY = 100;

        // Create anchor point
        const anchor = this.Matter.Bodies.circle(centerX, centerY, 5, {
            isStatic: true,
            render: { fillStyle: '#fff' }
        });

        // Calculate initial position from angle
        const angleRad = this.parameters.angle.value * Math.PI / 180;
        const bobX = centerX + this.parameters.length.value * Math.sin(angleRad);
        const bobY = centerY + this.parameters.length.value * Math.cos(angleRad);

        // Create pendulum bob
        this.bob = this.Matter.Bodies.circle(
            bobX,
            bobY,
            this.parameters.mass.value,
            {
                mass: this.parameters.mass.value / 10,
                frictionAir: this.parameters.damping.value,
                render: {
                    fillStyle: '#FF6B6B',
                    strokeStyle: '#FF4444',
                    lineWidth: 2
                }
            }
        );

        // Create constraint (rod)
        this.constraint = this.Matter.Constraint.create({
            bodyA: anchor,
            bodyB: this.bob,
            length: this.parameters.length.value,
            stiffness: 1,
            render: {
                strokeStyle: '#888',
                lineWidth: 2
            }
        });

        this.Matter.World.add(this.world, [anchor, this.bob, this.constraint]);

        this.trail = [];
        this.energyHistory = [];
        this.time = 0;
    }

    update() {
        super.update();
        this.time += 1/60;

        // Track trail for visualization
        if (this.bob) {
            this.trail.push({
                x: this.bob.position.x,
                y: this.bob.position.y,
                time: this.time
            });

            // Keep trail length manageable
            if (this.trail.length > 100) {
                this.trail.shift();
            }

            // Track energy
            const v = Math.sqrt(this.bob.velocity.x ** 2 + this.bob.velocity.y ** 2);
            const h = (this.canvas.height/2 + 100 - this.bob.position.y) / 100;
            const ke = 0.5 * this.parameters.mass.value * v * v / 100;
            const pe = this.parameters.mass.value * 9.81 * h;

            this.energyHistory.push({
                time: this.time,
                ke: ke,
                pe: pe,
                total: ke + pe
            });

            if (this.energyHistory.length > 200) {
                this.energyHistory.shift();
            }
        }
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw reference lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 100);
        this.ctx.lineTo(this.canvas.width / 2, 350);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw trail with gradient
        if (this.trail.length > 1) {
            for (let i = 1; i < this.trail.length; i++) {
                const alpha = i / this.trail.length;
                this.ctx.strokeStyle = `rgba(100, 200, 255, ${alpha * 0.5})`;
                this.ctx.lineWidth = 1 + alpha;
                this.ctx.beginPath();
                this.ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
                this.ctx.lineTo(this.trail[i].x, this.trail[i].y);
                this.ctx.stroke();
            }
        }

        // Draw angle arc
        if (this.bob) {
            const centerX = this.canvas.width / 2;
            const centerY = 100;
            const angle = Math.atan2(this.bob.position.x - centerX, this.bob.position.y - centerY);

            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 40, Math.PI/2, Math.PI/2 + angle, angle < 0);
            this.ctx.stroke();

            // Show angle value
            this.ctx.fillStyle = '#ffff64';
            this.ctx.font = '12px monospace';
            this.ctx.fillText(`θ = ${(angle * 180 / Math.PI).toFixed(1)}°`, centerX + 50, centerY + 10);
        }

        // Let Matter.js render the pendulum
        super.draw();
    }

    updateTUI() {
        const v = Math.sqrt(this.bob.velocity.x ** 2 + this.bob.velocity.y ** 2);
        const h = (this.canvas.height/2 + 100 - this.bob.position.y) / 100;
        const ke = 0.5 * this.parameters.mass.value * v * v / 100;
        const pe = this.parameters.mass.value * 9.81 * h;
        const total = ke + pe;

        const maxE = this.parameters.mass.value * 9.81 * this.parameters.length.value / 100 * 2;
        const keBar = '█'.repeat(Math.min(25, Math.round(ke / maxE * 25)));
        const peBar = '█'.repeat(Math.min(25, Math.round(pe / maxE * 25)));
        const teBar = '█'.repeat(Math.min(25, Math.round(total / maxE * 25)));

        // Calculate period
        const L = this.parameters.length.value / 100; // Convert to meters
        const theoreticalPeriod = 2 * Math.PI * Math.sqrt(L / 9.81);

        this.tui.innerHTML = `
<span class="tui-header">---[ SIMPLE PENDULUM ]---</span>

Parameters:
  Length: ${this.parameters.length.value} px (${L.toFixed(2)} m)
  Mass: ${this.parameters.mass.value} kg
  Damping: ${this.parameters.damping.value}
  
Motion @ t = ${this.time.toFixed(2)}s:
  Angular Velocity: ${(this.bob.angularVelocity * 180 / Math.PI).toFixed(2)} °/s
  Speed: ${v.toFixed(2)} px/s

Energy Analysis:
<span class="tui-energy-ke">  KE: ${ke.toFixed(2)} J [${keBar.padEnd(25, '░')}]</span>
<span class="tui-energy-pe">  PE: ${pe.toFixed(2)} J [${peBar.padEnd(25, '░')}]</span>
<span class="tui-energy-total">  Total: ${total.toFixed(2)} J [${teBar.padEnd(25, '░')}]</span>

<span class="tui-formula">T = 2π√(L/g) = ${theoreticalPeriod.toFixed(2)} s</span>
<span class="tui-label">Controls: [SPACE] Pause | [R] Reset</span>`;
    }

    onParameterChange(key, value) {
        // Reset simulation when parameters change
        if (key === 'length' || key === 'mass' || key === 'angle') {
            this.reset();
        } else if (key === 'damping' && this.bob) {
            this.bob.frictionAir = value;
        }
    }
}

// Spring System Simulation
class SpringSystemSimulation extends MatterSimulation {
    constructor(canvas, ctx, tui, Matter) {
        super(canvas, ctx, tui, Matter);
        this.parameters = {
            stiffness: { label: 'Spring Constant', value: 0.02, min: 0.005, max: 0.1, step: 0.005, unit: 'k' },
            damping: { label: 'Damping', value: 0.01, min: 0, max: 0.05, step: 0.005, unit: 'b' },
            masses: { label: 'Number of Masses', value: 5, min: 3, max: 8, step: 1, unit: '' },
            amplitude: { label: 'Initial Displacement', value: 50, min: 10, max: 100, step: 10, unit: 'px' }
        };

        this.bodies = [];
        this.springs = [];
        this.time = 0;
        this.waveHistory = [];
    }

    setupWorld() {
        this.world.gravity.scale = 0;

        const spacing = this.canvas.width / (this.parameters.masses.value + 1);
        const centerY = this.canvas.height / 2;

        this.bodies = [];
        this.springs = [];

        // Create fixed anchor points at ends
        const leftAnchor = this.Matter.Bodies.circle(50, centerY, 8, {
            isStatic: true,
            render: { fillStyle: '#fff' }
        });

        const rightAnchor = this.Matter.Bodies.circle(this.canvas.width - 50, centerY, 8, {
            isStatic: true,
            render: { fillStyle: '#fff' }
        });

        // Create masses
        for (let i = 0; i < this.parameters.masses.value; i++) {
            const x = spacing * (i + 1);
            const y = centerY;

            // Initial displacement pattern (standing wave)
            const displacement = this.parameters.amplitude.value * Math.sin(Math.PI * (i + 1) / (this.parameters.masses.value + 1));

            const body = this.Matter.Bodies.circle(x, y + displacement, 12, {
                mass: 1,
                frictionAir: this.parameters.damping.value,
                render: {
                    fillStyle: `hsl(${220 + i * 20}, 70%, 60%)`,
                    strokeStyle: `hsl(${220 + i * 20}, 70%, 40%)`,
                    lineWidth: 2
                }
            });

            this.bodies.push(body);
        }

        // Connect first mass to left anchor
        if (this.bodies.length > 0) {
            const leftSpring = this.Matter.Constraint.create({
                bodyA: leftAnchor,
                bodyB: this.bodies[0],
                stiffness: this.parameters.stiffness.value,
                damping: this.parameters.damping.value,
                render: {
                    strokeStyle: '#666',
                    lineWidth: 2
                }
            });
            this.springs.push(leftSpring);
        }

        // Create springs between adjacent masses
        for (let i = 0; i < this.bodies.length - 1; i++) {
            const spring = this.Matter.Constraint.create({
                bodyA: this.bodies[i],
                bodyB: this.bodies[i + 1],
                stiffness: this.parameters.stiffness.value,
                damping: this.parameters.damping.value,
                render: {
                    strokeStyle: '#666',
                    lineWidth: 2
                }
            });
            this.springs.push(spring);
        }

        // Connect last mass to right anchor
        if (this.bodies.length > 0) {
            const rightSpring = this.Matter.Constraint.create({
                bodyA: this.bodies[this.bodies.length - 1],
                bodyB: rightAnchor,
                stiffness: this.parameters.stiffness.value,
                damping: this.parameters.damping.value,
                render: {
                    strokeStyle: '#666',
                    lineWidth: 2
                }
            });
            this.springs.push(rightSpring);
        }

        // Add everything to world
        this.Matter.World.add(this.world, [
            leftAnchor,
            rightAnchor,
            ...this.bodies,
            ...this.springs
        ]);

        this.time = 0;
        this.waveHistory = [];
    }

    update() {
        super.update();
        this.time += 1/60;

        // Record wave shape for history
        const waveShape = this.bodies.map(body => ({
            x: body.position.x,
            y: body.position.y
        }));

        this.waveHistory.push({
            time: this.time,
            shape: waveShape
        });

        if (this.waveHistory.length > 50) {
            this.waveHistory.shift();
        }
    }

    draw() {
        // Semi-transparent background for trails
        this.ctx.fillStyle = 'rgba(26, 26, 26, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw equilibrium line
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw wave history (ghosting effect)
        this.waveHistory.forEach((record, idx) => {
            const alpha = idx / this.waveHistory.length * 0.3;
            this.ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();

            record.shape.forEach((point, i) => {
                if (i === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            });

            this.ctx.stroke();
        });

        // Draw current wave shape
        this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        // Add anchor points to the wave
        this.ctx.moveTo(50, this.canvas.height / 2);
        this.bodies.forEach((body, i) => {
            this.ctx.lineTo(body.position.x, body.position.y);
        });
        this.ctx.lineTo(this.canvas.width - 50, this.canvas.height / 2);

        this.ctx.stroke();

        // Render bodies and constraints
        super.draw();
    }

    updateTUI() {
        // Calculate total energy
        let totalKE = 0;
        let totalPE = 0;
        const centerY = this.canvas.height / 2;
        const k = this.parameters.stiffness.value * 1000; // Scale for display

        this.bodies.forEach((body, i) => {
            const v = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
            totalKE += 0.5 * body.mass * v * v;

            // Spring potential energy (displacement from equilibrium)
            const displacement = body.position.y - centerY;
            totalPE += 0.5 * k * displacement * displacement / 10000;
        });

        const totalE = totalKE + totalPE;
        const maxE = 50;

        const keBar = '█'.repeat(Math.min(20, Math.round(totalKE / maxE * 20)));
        const peBar = '█'.repeat(Math.min(20, Math.round(totalPE / maxE * 20)));
        const teBar = '█'.repeat(Math.min(20, Math.round(totalE / maxE * 20)));

        // Calculate approximate frequency
        const omega = Math.sqrt(k / 1); // Assuming unit mass
        const frequency = omega / (2 * Math.PI);

        this.tui.innerHTML = `
<span class="tui-header">---[ COUPLED SPRING SYSTEM ]---</span>

Configuration:
  Masses: ${this.parameters.masses.value}
  Spring Constant: ${this.parameters.stiffness.value.toFixed(3)}
  Damping: ${this.parameters.damping.value.toFixed(3)}
  
Wave Properties @ t = ${this.time.toFixed(2)}s:
  Natural Frequency: ~${frequency.toFixed(2)} Hz
  Wavelength: ${(this.canvas.width / 2).toFixed(0)} px

Energy Distribution:
<span class="tui-energy-ke">  KE: ${totalKE.toFixed(2)} J [${keBar.padEnd(20, '░')}]</span>
<span class="tui-energy-pe">  PE: ${totalPE.toFixed(2)} J [${peBar.padEnd(20, '░')}]</span>
<span class="tui-energy-total">  Total: ${totalE.toFixed(2)} J [${teBar.padEnd(20, '░')}]</span>

<span class="tui-formula">ω = √(k/m) = ${omega.toFixed(2)} rad/s</span>
<span class="tui-label">Controls: [SPACE] Pause | [R] Reset</span>`;
    }

    onParameterChange(key, value) {
        if (key === 'masses' || key === 'amplitude') {
            this.reset();
        } else if (key === 'stiffness') {
            this.springs.forEach(spring => {
                spring.stiffness = value;
            });
        } else if (key === 'damping') {
            this.bodies.forEach(body => {
                body.frictionAir = value;
            });
        }
    }
}

// Orbital Mechanics Simulation
class OrbitalSimulation extends MatterSimulation {
    constructor(canvas, ctx, tui, Matter) {
        super(canvas, ctx, tui, Matter);
        this.parameters = {
            centralMass: { label: 'Central Mass', value: 100, min: 50, max: 200, step: 10, unit: 'M☉' },
            satelliteMass: { label: 'Satellite Mass', value: 1, min: 0.5, max: 5, step: 0.5, unit: 'M🜨' },
            velocity: { label: 'Initial Velocity', value: 3, min: 1, max: 6, step: 0.2, unit: 'v₀' },
            eccentricity: { label: 'Eccentricity', value: 0.5, min: 0, max: 0.9, step: 0.1, unit: 'e' }
        };

        this.sun = null;
        this.planet = null;
        this.trail = [];
        this.orbitalData = {
            perihelion: Infinity,
            aphelion: 0,
            period: 0,
            lastAngle: 0,
            orbits: 0
        };
    }

    setupWorld() {
        // Disable default gravity
        this.world.gravity.scale = 0;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Create central body (sun)
        this.sun = this.Matter.Bodies.circle(centerX, centerY, 20, {
            isStatic: true,
            render: {
                fillStyle: '#FDB813',
                strokeStyle: '#FFC837',
                lineWidth: 3
            }
        });

        // Calculate initial orbital parameters
        const r0 = 150; // Initial distance
        const v0 = this.parameters.velocity.value;

        // Create satellite (planet)
        this.planet = this.Matter.Bodies.circle(
            centerX + r0,
            centerY,
            8,
            {
                mass: this.parameters.satelliteMass.value,
                frictionAir: 0,
                render: {
                    fillStyle: '#4A90E2',
                    strokeStyle: '#2E7CD6',
                    lineWidth: 2
                }
            }
        );

        // Set initial velocity (perpendicular to radius)
        this.Matter.Body.setVelocity(this.planet, { x: 0, y: -v0 });

        this.Matter.World.add(this.world, [this.sun, this.planet]);

        this.trail = [];
        this.orbitalData = {
            perihelion: Infinity,
            aphelion: 0,
            period: 0,
            lastAngle: 0,
            orbits: 0,
            startTime: Date.now()
        };
    }

    update() {
        // Apply custom gravity
        if (this.sun && this.planet) {
            const dx = this.sun.position.x - this.planet.position.x;
            const dy = this.sun.position.y - this.planet.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Newton's law of gravitation (scaled for simulation)
            const G = 0.5; // Gravitational constant (adjusted for visualization)
            const force = G * this.parameters.centralMass.value * this.parameters.satelliteMass.value / (distance * distance);

            const fx = force * dx / distance;
            const fy = force * dy / distance;

            this.Matter.Body.applyForce(this.planet, this.planet.position, { x: fx, y: fy });
        }

        super.update();

        // Track orbital path
        if (this.planet) {
            const dx = this.planet.position.x - this.sun.position.x;
            const dy = this.planet.position.y - this.sun.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            this.trail.push({
                x: this.planet.position.x,
                y: this.planet.position.y,
                distance: distance
            });

            if (this.trail.length > 500) {
                this.trail.shift();
            }

            // Update orbital data
            this.orbitalData.perihelion = Math.min(this.orbitalData.perihelion, distance);
            this.orbitalData.aphelion = Math.max(this.orbitalData.aphelion, distance);

            // Track complete orbits
            const angle = Math.atan2(dy, dx);
            if (this.orbitalData.lastAngle < 0 && angle >= 0) {
                this.orbitalData.orbits++;
                const currentTime = Date.now();
                this.orbitalData.period = (currentTime - this.orbitalData.startTime) / 1000 / this.orbitalData.orbits;
            }
            this.orbitalData.lastAngle = angle;
        }
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw star field
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 50; i++) {
            const x = (i * 73) % this.canvas.width;
            const y = (i * 37) % this.canvas.height;
            this.ctx.fillRect(x, y, 1, 1);
        }

        // Draw orbital trail
        if (this.trail.length > 1) {
            // Color gradient based on distance (blue = close, red = far)
            for (let i = 1; i < this.trail.length; i++) {
                const alpha = i / this.trail.length;
                const normalized = (this.trail[i].distance - this.orbitalData.perihelion) /
                    (this.orbitalData.aphelion - this.orbitalData.perihelion);
                const hue = 240 - normalized * 60; // Blue to cyan to green

                this.ctx.strokeStyle = `hsla(${hue}, 70%, 50%, ${alpha * 0.8})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
                this.ctx.lineTo(this.trail[i].x, this.trail[i].y);
                this.ctx.stroke();
            }
        }

        // Draw perihelion and aphelion markers
        if (this.orbitalData.orbits > 0) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;

            // Perihelion (closest)
            this.ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, this.orbitalData.perihelion, 0, Math.PI * 2);
            this.ctx.stroke();

            // Aphelion (farthest)
            this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, this.orbitalData.aphelion, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Draw velocity vector
        if (this.planet) {
            const scale = 20;
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(this.planet.position.x, this.planet.position.y);
            this.ctx.lineTo(
                this.planet.position.x + this.planet.velocity.x * scale,
                this.planet.position.y + this.planet.velocity.y * scale
            );
            this.ctx.stroke();

            // Arrow head
            const angle = Math.atan2(this.planet.velocity.y, this.planet.velocity.x);
            const headLength = 8;
            this.ctx.beginPath();
            this.ctx.moveTo(
                this.planet.position.x + this.planet.velocity.x * scale,
                this.planet.position.y + this.planet.velocity.y * scale
            );
            this.ctx.lineTo(
                this.planet.position.x + this.planet.velocity.x * scale - headLength * Math.cos(angle - Math.PI/6),
                this.planet.position.y + this.planet.velocity.y * scale - headLength * Math.sin(angle - Math.PI/6)
            );
            this.ctx.moveTo(
                this.planet.position.x + this.planet.velocity.x * scale,
                this.planet.position.y + this.planet.velocity.y * scale
            );
            this.ctx.lineTo(
                this.planet.position.x + this.planet.velocity.x * scale - headLength * Math.cos(angle + Math.PI/6),
                this.planet.position.y + this.planet.velocity.y * scale - headLength * Math.sin(angle + Math.PI/6)
            );
            this.ctx.stroke();
        }

        // Render bodies
        super.draw();
    }

    updateTUI() {
        const dx = this.planet.position.x - this.sun.position.x;
        const dy = this.planet.position.y - this.sun.position.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        const v = Math.sqrt(this.planet.velocity.x ** 2 + this.planet.velocity.y ** 2);

        // Calculate orbital energy
        const G = 0.5;
        const M = this.parameters.centralMass.value;
        const m = this.parameters.satelliteMass.value;

        const ke = 0.5 * m * v * v;
        const pe = -G * M * m / r;
        const totalE = ke + pe;

        // Calculate angular momentum
        const L = m * r * v * Math.sin(Math.atan2(this.planet.velocity.y, this.planet.velocity.x) - Math.atan2(dy, dx));

        // Calculate eccentricity from orbital parameters
        const a = (this.orbitalData.aphelion + this.orbitalData.perihelion) / 2;
        const e = (this.orbitalData.aphelion - this.orbitalData.perihelion) / (this.orbitalData.aphelion + this.orbitalData.perihelion);

        // Energy bars
        const maxE = Math.abs(pe) * 2;
        const keBar = '█'.repeat(Math.min(20, Math.round(ke / maxE * 20)));
        const peBar = '█'.repeat(Math.min(20, Math.round(Math.abs(pe) / maxE * 20)));

        this.tui.innerHTML = `
<span class="tui-header">---[ ORBITAL MECHANICS ]---</span>

System Configuration:
  Central Mass: ${this.parameters.centralMass.value} M☉
  Satellite Mass: ${this.parameters.satelliteMass.value} M🜨
  
Orbital Parameters:
  Distance: ${r.toFixed(1)} px
  Velocity: ${v.toFixed(2)} px/s
  Angular Momentum: ${Math.abs(L).toFixed(2)} L₀
  
Orbital Characteristics:
  Perihelion: ${this.orbitalData.perihelion.toFixed(1)} px
  Aphelion: ${this.orbitalData.aphelion.toFixed(1)} px
  Eccentricity: ${e.toFixed(3)}
  Period: ${this.orbitalData.period.toFixed(2)} s
  Orbits: ${this.orbitalData.orbits}

Energy:
<span class="tui-energy-ke">  KE: ${ke.toFixed(2)} E₀ [${keBar.padEnd(20, '░')}]</span>
<span class="tui-energy-pe">  PE: ${pe.toFixed(2)} E₀ [${peBar.padEnd(20, '░')}]</span>
<span class="tui-energy-total">  Total: ${totalE.toFixed(2)} E₀</span>

<span class="tui-formula">Kepler's 3rd: T² ∝ a³</span>
<span class="tui-label">Controls: [SPACE] Pause | [R] Reset</span>`;
    }

    onParameterChange(key, value) {
        // Reset when orbital parameters change
        this.reset();
    }
}

// Export all simulations for use with the engine
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PendulumSimulation,
        SpringSystemSimulation,
        OrbitalSimulation,
        ProjectileSimulation,
        CollisionSimulation
    };
}
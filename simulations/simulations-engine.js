// File: simulations/simulation-engine-enhanced.js
// Enhanced Physics Simulation Engine using Matter.js

export class PhysicsSimulationEngine {
    constructor() {
        this.canvas = document.getElementById('main-sim-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.tui = document.getElementById('tui-display');
        this.currentSimulation = null;
        this.animationId = null;
        this.isRunning = false;

        // Load Matter.js dynamically
        this.loadMatterJS().then(() => {
            this.Matter = window.Matter;
            this.init();
        });
    }

    async loadMatterJS() {
        return new Promise((resolve, reject) => {
            if (window.Matter) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    init() {
        console.log('Physics Engine initialized with Matter.js');
        this.setupEventListeners();
        this.resizeCanvas();

        // Register available simulations
        this.simulations = {
            'projectile-2d': ProjectileSimulation,
            'collision-1d': CollisionSimulation,
            'pendulum': PendulumSimulation,
            'springs': SpringSystemSimulation,
            'orbital': OrbitalSimulation
        };
    }

    setupEventListeners() {
        const loadBtn = document.getElementById('load-simulation');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const select = document.getElementById('simulation-select');
                if (select && select.value) {
                    this.loadSimulation(select.value);
                }
            });
        }

        const playBtn = document.getElementById('play-pause');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlayPause());
        }

        const resetBtn = document.getElementById('reset-sim');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this.currentSimulation) {
                    this.currentSimulation.reset();
                }
            });
        }

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = 400;
    }

    async loadSimulation(simId) {
        if (this.currentSimulation) {
            this.currentSimulation.cleanup();
        }

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const SimClass = this.simulations[simId];
        if (SimClass) {
            this.currentSimulation = new SimClass(this.canvas, this.ctx, this.tui, this.Matter);
            this.currentSimulation.init();
            this.setupParameterPanel();
            this.isRunning = true;
            this.animate();
        }
    }

    setupParameterPanel() {
        const panel = document.getElementById('parameter-panel');
        const controls = document.getElementById('parameter-controls');

        if (!panel || !controls || !this.currentSimulation.parameters) return;

        controls.innerHTML = '';

        Object.entries(this.currentSimulation.parameters).forEach(([key, param]) => {
            const control = document.createElement('div');
            control.className = 'param-control';

            control.innerHTML = `
                <label>${param.label}:</label>
                <input type="range" 
                       min="${param.min}" 
                       max="${param.max}" 
                       step="${param.step}" 
                       value="${param.value}">
                <span class="param-value">${param.value} ${param.unit}</span>
            `;

            const slider = control.querySelector('input');
            const valueDisplay = control.querySelector('.param-value');

            slider.addEventListener('input', (e) => {
                param.value = parseFloat(e.target.value);
                valueDisplay.textContent = `${param.value} ${param.unit}`;
                if (this.currentSimulation.onParameterChange) {
                    this.currentSimulation.onParameterChange(key, param.value);
                }
            });

            controls.appendChild(control);
        });

        panel.style.display = 'block';
    }

    animate() {
        if (this.isRunning && this.currentSimulation) {
            this.currentSimulation.update();
            this.currentSimulation.draw();
            this.currentSimulation.updateTUI();
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    togglePlayPause() {
        this.isRunning = !this.isRunning;
        const btn = document.getElementById('play-pause');
        if (btn) {
            btn.textContent = this.isRunning ? '⏸ Pause' : '▶ Play';
        }
        if (this.isRunning) {
            this.animate();
        }
    }

    handleKeyboard(e) {
        if (!this.currentSimulation) return;

        switch(e.key.toLowerCase()) {
            case ' ':
                this.togglePlayPause();
                e.preventDefault();
                break;
            case 'r':
                this.currentSimulation.reset();
                break;
        }
    }
}

// Base class for Matter.js simulations
class MatterSimulation {
    constructor(canvas, ctx, tui, Matter) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.tui = tui;
        this.Matter = Matter;
        this.parameters = {};

        // Matter.js setup
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        this.render = Matter.Render.create({
            canvas: canvas,
            engine: this.engine,
            options: {
                width: canvas.width,
                height: canvas.height,
                wireframes: false,
                background: 'transparent'
            }
        });
    }

    init() {
        this.setupWorld();
        this.reset();
    }

    setupWorld() {
        // Override in subclasses
    }

    reset() {
        Matter.World.clear(this.world);
        Matter.Engine.clear(this.engine);
        this.setupWorld();
    }

    update() {
        Matter.Engine.update(this.engine, 1000 / 60);
    }

    draw() {
        // Custom drawing on top of Matter.js rendering
        Matter.Render.world(this.render);
    }

    updateTUI() {
        // Override in subclasses
    }

    cleanup() {
        Matter.World.clear(this.world);
        Matter.Engine.clear(this.engine);
    }
}

// Projectile Motion using Matter.js
class ProjectileSimulation extends MatterSimulation {
    constructor(canvas, ctx, tui, Matter) {
        super(canvas, ctx, tui, Matter);
        this.parameters = {
            velocity: { label: 'Launch Velocity', value: 20, min: 10, max: 40, step: 2, unit: 'm/s' },
            angle: { label: 'Launch Angle', value: 45, min: 15, max: 75, step: 5, unit: '°' },
            gravity: { label: 'Gravity Scale', value: 1, min: 0.1, max: 2, step: 0.1, unit: 'g' }
        };

        this.projectile = null;
        this.trail = [];
        this.stats = { maxHeight: 0, range: 0, flightTime: 0 };
    }

    setupWorld() {
        // Set gravity
        this.world.gravity.scale = 0.001 * this.parameters.gravity.value;

        // Create ground
        const ground = this.Matter.Bodies.rectangle(
            this.canvas.width / 2,
            this.canvas.height - 20,
            this.canvas.width,
            40,
            { isStatic: true, render: { fillStyle: '#666' } }
        );

        // Create projectile
        const angleRad = this.parameters.angle.value * Math.PI / 180;
        const vx = this.parameters.velocity.value * Math.cos(angleRad) * 0.5;
        const vy = -this.parameters.velocity.value * Math.sin(angleRad) * 0.5;

        this.projectile = this.Matter.Bodies.circle(50, this.canvas.height - 100, 10, {
            restitution: 0.8,
            render: { fillStyle: '#f44336' }
        });

        this.Matter.Body.setVelocity(this.projectile, { x: vx, y: vy });
        this.Matter.World.add(this.world, [ground, this.projectile]);

        this.trail = [];
        this.startTime = Date.now();
    }

    update() {
        super.update();

        // Track trail
        if (this.projectile) {
            this.trail.push({
                x: this.projectile.position.x,
                y: this.projectile.position.y
            });

            if (this.trail.length > 200) this.trail.shift();

            // Update stats
            const height = this.canvas.height - this.projectile.position.y;
            this.stats.maxHeight = Math.max(this.stats.maxHeight, height);
            this.stats.range = this.projectile.position.x - 50;
            this.stats.flightTime = (Date.now() - this.startTime) / 1000;
        }
    }

    draw() {
        // Clear and draw background
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw trail
        if (this.trail.length > 1) {
            this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.trail.forEach((point, i) => {
                if (i === 0) this.ctx.moveTo(point.x, point.y);
                else this.ctx.lineTo(point.x, point.y);
            });
            this.ctx.stroke();
        }

        // Let Matter.js render the bodies
        super.draw();
    }

    updateTUI() {
        const ke = 0.5 * (this.projectile.velocity.x ** 2 + this.projectile.velocity.y ** 2);
        const pe = (this.canvas.height - this.projectile.position.y) * 0.01;
        const total = ke + pe;

        const keBar = '█'.repeat(Math.min(30, Math.round(ke / 5)));
        const peBar = '█'.repeat(Math.min(30, Math.round(pe / 5)));

        this.tui.innerHTML = `
<span class="tui-header">---[ PROJECTILE MOTION ]---</span>

Launch Parameters:
  Velocity: ${this.parameters.velocity.value} m/s @ ${this.parameters.angle.value}°
  
Flight Statistics:
  Max Height: ${this.stats.maxHeight.toFixed(1)} px
  Range: ${this.stats.range.toFixed(1)} px
  Time: ${this.stats.flightTime.toFixed(2)} s

Energy:
<span class="tui-energy-ke">  KE: ${ke.toFixed(1)} [${keBar.padEnd(30, '░')}]</span>
<span class="tui-energy-pe">  PE: ${pe.toFixed(1)} [${peBar.padEnd(30, '░')}]</span>

<span class="tui-label">Controls: [SPACE] Pause | [R] Reset</span>`;
    }
}

// Collision Simulation
class CollisionSimulation extends MatterSimulation {
    constructor(canvas, ctx, tui, Matter) {
        super(canvas, ctx, tui, Matter);
        this.parameters = {
            mass1: { label: 'Mass 1', value: 1, min: 0.5, max: 5, step: 0.5, unit: 'kg' },
            mass2: { label: 'Mass 2', value: 2, min: 0.5, max: 5, step: 0.5, unit: 'kg' },
            velocity1: { label: 'Velocity 1', value: 5, min: -10, max: 10, step: 1, unit: 'm/s' },
            restitution: { label: 'Elasticity', value: 1, min: 0, max: 1, step: 0.1, unit: '' }
        };

        this.box1 = null;
        this.box2 = null;
    }

    setupWorld() {
        this.world.gravity.scale = 0;

        // Create walls
        const walls = [
            this.Matter.Bodies.rectangle(this.canvas.width/2, -25, this.canvas.width, 50, { isStatic: true }),
            this.Matter.Bodies.rectangle(this.canvas.width/2, this.canvas.height + 25, this.canvas.width, 50, { isStatic: true }),
            this.Matter.Bodies.rectangle(-25, this.canvas.height/2, 50, this.canvas.height, { isStatic: true }),
            this.Matter.Bodies.rectangle(this.canvas.width + 25, this.canvas.height/2, 50, this.canvas.height, { isStatic: true })
        ];

        // Create boxes
        const size1 = 30 * Math.sqrt(this.parameters.mass1.value);
        const size2 = 30 * Math.sqrt(this.parameters.mass2.value);

        this.box1 = this.Matter.Bodies.rectangle(100, this.canvas.height/2, size1, size1, {
            restitution: this.parameters.restitution.value,
            render: { fillStyle: '#4CAF50' }
        });

        this.box2 = this.Matter.Bodies.rectangle(this.canvas.width - 100, this.canvas.height/2, size2, size2, {
            restitution: this.parameters.restitution.value,
            render: { fillStyle: '#2196F3' }
        });

        this.Matter.Body.setVelocity(this.box1, { x: this.parameters.velocity1.value, y: 0 });
        this.Matter.Body.setVelocity(this.box2, { x: -2, y: 0 });

        this.Matter.World.add(this.world, [...walls, this.box1, this.box2]);
    }

    updateTUI() {
        const p1 = this.parameters.mass1.value * this.box1.velocity.x;
        const p2 = this.parameters.mass2.value * this.box2.velocity.x;
        const totalP = p1 + p2;

        const ke1 = 0.5 * this.parameters.mass1.value * (this.box1.velocity.x ** 2 + this.box1.velocity.y ** 2);
        const ke2 = 0.5 * this.parameters.mass2.value * (this.box2.velocity.x ** 2 + this.box2.velocity.y ** 2);
        const totalKE = ke1 + ke2;

        this.tui.innerHTML = `
<span class="tui-header">---[ COLLISION DYNAMICS ]---</span>

Box 1 (Green):
  Momentum: ${p1.toFixed(2)} kg⋅m/s
  Kinetic Energy: ${ke1.toFixed(2)} J
  
Box 2 (Blue):
  Momentum: ${p2.toFixed(2)} kg⋅m/s
  Kinetic Energy: ${ke2.toFixed(2)} J

System Totals:
  Total Momentum: ${totalP.toFixed(2)} kg⋅m/s
  Total KE: ${totalKE.toFixed(2)} J
  
Collision Type: ${this.parameters.restitution.value === 1 ? 'Elastic' :
            this.parameters.restitution.value === 0 ? 'Perfectly Inelastic' :
                'Partially Elastic'}

<span class="tui-label">Controls: [SPACE] Pause | [R] Reset</span>`;
    }
}
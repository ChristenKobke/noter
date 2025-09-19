/**
 * Modular Physics Simulation System
 * File structure and implementation guide
 */

/*
FOLDER STRUCTURE:
/physics-app/
├── chapters/
│   └── simulations.html (main chapter file)
├── simulations/
│   ├── manifest.json (list of available simulations)
│   ├── kinematics/
│   │   ├── motion-1d.js
│   │   ├── projectile-2d.js
│   │   └── circular-motion.js
│   ├── dynamics/
│   │   ├── forces.js
│   │   ├── momentum-collision.js
│   │   └── friction-incline.js
│   ├── oscillations/
│   │   ├── simple-harmonic.js
│   │   ├── pendulum.js
│   │   └── damped-oscillations.js
│   ├── rotational/
│   │   ├── torque-angular.js
│   │   └── rolling-motion.js
│   ├── waves/
│   │   ├── standing-waves.js
│   │   └── interference.js
│   └── electromagnetism/
│       ├── electric-field.js
│       └── magnetic-field.js
*/

// ===========================================================================
// File: simulations/manifest.json
// ===========================================================================
const SIMULATION_MANIFEST = {
    "categories": [
        {
            "name": "Kinematics",
            "id": "kinematics",
            "simulations": [
                {
                    "id": "motion-1d",
                    "name": "1D Motion",
                    "file": "kinematics/motion-1d.js",
                    "description": "Position, velocity, and acceleration in one dimension"
                },
                {
                    "id": "projectile-2d",
                    "name": "Projectile Motion",
                    "file": "kinematics/projectile-2d.js",
                    "description": "2D motion under gravity"
                },
                {
                    "id": "circular-motion",
                    "name": "Circular Motion",
                    "file": "kinematics/circular-motion.js",
                    "description": "Uniform circular motion and centripetal acceleration"
                }
            ]
        },
        {
            "name": "Dynamics",
            "id": "dynamics",
            "simulations": [
                {
                    "id": "forces",
                    "name": "Force & Acceleration",
                    "file": "dynamics/forces.js",
                    "description": "Newton's second law visualization"
                },
                {
                    "id": "momentum-collision",
                    "name": "Momentum & Collisions",
                    "file": "dynamics/momentum-collision.js",
                    "description": "Elastic and inelastic collisions"
                }
            ]
        },
        {
            "name": "Oscillations",
            "id": "oscillations",
            "simulations": [
                {
                    "id": "simple-harmonic",
                    "name": "Simple Harmonic Motion",
                    "file": "oscillations/simple-harmonic.js",
                    "description": "Spring-mass oscillator with energy tracking"
                }
            ]
        }
    ]
};

// ===========================================================================
// File: simulations/base-simulation.js
// Base class that all simulations inherit from
// ===========================================================================
export class BaseSimulation {
    constructor(canvas, ctx, tui) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.tui = tui;
        this.time = 0;
        this.dt = 1/60;
        this.parameters = {};
        this.state = {};
        this.selectedParam = 0;
    }

    // Required methods for all simulations
    init() {
        this.setupParameters();
        this.reset();
    }

    setupParameters() {
        // Override in subclass to define parameters
    }

    reset() {
        this.time = 0;
        this.resetState();
    }

    resetState() {
        // Override to reset simulation-specific state
    }

    update() {
        this.time += this.dt;
        this.updatePhysics();
    }

    updatePhysics() {
        // Override for physics calculations
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSimulation();
    }

    drawSimulation() {
        // Override for visualization
    }

    updateTUI() {
        // Override for text interface update
    }

    handleInput(key) {
        // Handle keyboard input
        switch(key) {
            case 'w':
                this.selectedParam = Math.max(0, this.selectedParam - 1);
                break;
            case 's':
                const paramKeys = Object.keys(this.parameters);
                this.selectedParam = Math.min(paramKeys.length - 1, this.selectedParam + 1);
                break;
            case 'a':
            case 'd':
                this.adjustParameter(key === 'a' ? -1 : 1);
                break;
        }
    }

    adjustParameter(direction) {
        const paramKeys = Object.keys(this.parameters);
        const paramKey = paramKeys[this.selectedParam];
        const param = this.parameters[paramKey];

        const newValue = param.value + direction * param.step;
        param.value = Math.max(param.min, Math.min(param.max, newValue));

        if (this.onParameterChange) {
            this.onParameterChange(paramKey, param.value);
        }
    }

    // Utility methods
    drawEnergyBar(label, value, maxValue, color, y) {
        const barWidth = 300;
        const barHeight = 20;
        const x = 50;

        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, barWidth, barHeight);

        // Energy bar
        const fillWidth = (value / maxValue) * barWidth;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, fillWidth, barHeight);

        // Label
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(label + ': ' + value.toFixed(1) + ' J', x + barWidth + 10, y + 15);
    }

    formatTUIEnergy(label, value, maxValue, color) {
        const barLength = 30;
        const filled = Math.round((value / maxValue) * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        return `<span class="${color}">${label}: ${value.toFixed(1).padStart(6)} J [${bar}]</span>`;
    }
}

// ===========================================================================
// File: simulations/oscillations/simple-harmonic.js
// Example simulation module
// ===========================================================================
export default class SimpleHarmonicMotion extends BaseSimulation {
    setupParameters() {
        this.parameters = {
            mass: {
                label: 'Mass',
                value: 1,
                min: 0.1,
                max: 5,
                step: 0.1,
                unit: 'kg'
            },
            k: {
                label: 'Spring Constant',
                value: 100,
                min: 10,
                max: 500,
                step: 10,
                unit: 'N/m'
            },
            damping: {
                label: 'Damping',
                value: 0.5,
                min: 0,
                max: 5,
                step: 0.1,
                unit: 'Ns/m'
            },
            x0: {
                label: 'Initial Position',
                value: 4,
                min: 0,
                max: 10,
                step: 0.5,
                unit: 'm'
            }
        };
    }

    resetState() {
        this.state = {
            x: this.parameters.x0.value,
            v: 0,
            trail: []
        };
        this.maxEnergy = 0.5 * this.parameters.k.value * this.parameters.x0.value ** 2;
    }

    updatePhysics() {
        const { mass, k, damping, x0 } = this.parameters;

        // Analytical solution for damped harmonic oscillator
        const omega0 = Math.sqrt(k.value / mass.value);
        const gamma = damping.value / (2 * mass.value);
        const omega_d = Math.sqrt(Math.max(0, omega0*omega0 - gamma*gamma));

        const A = x0.value;
        const t = this.time;

        this.state.x = A * Math.exp(-gamma * t) * Math.cos(omega_d * t);
        this.state.v = -A * Math.exp(-gamma * t) * (gamma * Math.cos(omega_d * t) + omega_d * Math.sin(omega_d * t));

        // Add to trail for visualization
        this.state.trail.push({x: this.state.x, t: this.time});
        if (this.state.trail.length > 200) this.state.trail.shift();
    }

    drawSimulation() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const scale = 30;

        // Draw equilibrium line
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(50, cy);
        this.ctx.lineTo(this.canvas.width - 50, cy);
        this.ctx.stroke();

        // Draw spring
        const springX = cx + this.state.x * scale;
        this.ctx.strokeStyle = '#9cdcfe';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(100, cy);

        const numCoils = 20;
        for (let i = 1; i < numCoils; i++) {
            const x = 100 + (springX - 100) * i/numCoils;
            const y = cy + (i % 2 ? 10 : -10);
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(springX, cy);
        this.ctx.stroke();

        // Draw mass
        this.ctx.fillStyle = '#569cd6';
        this.ctx.fillRect(springX - 20, cy - 20, 40, 40);

        // Draw trail
        if (this.state.trail.length > 1) {
            this.ctx.strokeStyle = 'rgba(150, 150, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.state.trail.forEach((point, i) => {
                const x = cx + point.x * scale;
                const y = 50 + (this.time - point.t) * 20;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();
        }
    }

    updateTUI() {
        const { mass, k, damping } = this.parameters;
        const omega0 = Math.sqrt(k.value / mass.value);
        const period = 2 * Math.PI / omega0;
        const frequency = 1 / period;

        // Energy calculations
        const ke = 0.5 * mass.value * this.state.v * this.state.v;
        const pe = 0.5 * k.value * this.state.x * this.state.x;
        const total = ke + pe;

        // Generate energy bars
        const keBar = this.formatTUIEnergy('KE', ke, this.maxEnergy, 'tui-energy-ke');
        const peBar = this.formatTUIEnergy('PE', pe, this.maxEnergy, 'tui-energy-pe');
        const totalBar = this.formatTUIEnergy('Total', total, this.maxEnergy, 'tui-energy-total');

        // Parameter display with selection indicator
        const paramLines = Object.entries(this.parameters).map(([key, param], index) => {
            const isSelected = index === this.selectedParam;
            const indicator = isSelected ? '>' : ' ';
            const value = `${param.value.toFixed(1)} ${param.unit}`.padStart(12);
            const line = `${indicator} ${param.label.padEnd(20, '.')}: ${value}`;
            return isSelected ? `<span class="tui-selected">${line}</span>` : line;
        }).join('\n');

        this.tui.innerHTML = `
<span class="tui-header">---[ SIMPLE HARMONIC MOTION ]---</span>

<span class="tui-label">Parameters (use W/S to select, A/D to adjust):</span>
${paramLines}

<span class="tui-formula">System Properties:</span>
  Natural Frequency ω₀ = √(k/m) = ${omega0.toFixed(2)} rad/s
  Period T = 2π/ω₀ = ${period.toFixed(2)} s
  Frequency f = 1/T = ${frequency.toFixed(2)} Hz

<span class="tui-label">State @ t = ${this.time.toFixed(2)}s:</span>
  Position x = ${this.state.x.toFixed(3).padStart(8)} m
  Velocity v = ${this.state.v.toFixed(3).padStart(8)} m/s
  Force F = -kx = ${(-k.value * this.state.x).toFixed(2).padStart(8)} N

<span class="tui-label">Energy Analysis:</span>
${keBar}
${peBar}
${totalBar}

<span class="tui-label">Controls: [SPACE] Pause | [R] Reset | [W/S] Select | [A/D] Adjust</span>`;
    }
}

// ===========================================================================
// File: simulations/dynamics/momentum-collision.js
// Another example simulation
// ===========================================================================
export default class MomentumCollision extends BaseSimulation {
    setupParameters() {
        this.parameters = {
            m1: { label: 'Mass 1', value: 5, min: 1, max: 20, step: 1, unit: 'kg' },
            v1: { label: 'Velocity 1', value: 10, min: -20, max: 20, step: 1, unit: 'm/s' },
            m2: { label: 'Mass 2', value: 10, min: 1, max: 20, step: 1, unit: 'kg' },
            v2: { label: 'Velocity 2', value: -5, min: -20, max: 20, step: 1, unit: 'm/s' },
            elastic: { label: 'Collision Type', value: 1, min: 0, max: 1, step: 1, unit: '' }
        };
    }

    resetState() {
        this.state = {
            x1: -200,
            x2: 200,
            v1: this.parameters.v1.value,
            v2: this.parameters.v2.value,
            hasCollided: false,
            collisionTime: 0
        };
    }

    updatePhysics() {
        const { m1, m2, elastic } = this.parameters;

        // Update positions
        this.state.x1 += this.state.v1 * this.dt * 10;
        this.state.x2 += this.state.v2 * this.dt * 10;

        // Check for collision
        const distance = Math.abs(this.state.x2 - this.state.x1);
        const minDistance = 40; // Size of blocks

        if (distance < minDistance && !this.state.hasCollided) {
            this.state.hasCollided = true;
            this.state.collisionTime = this.time;

            const v1i = this.state.v1;
            const v2i = this.state.v2;

            if (elastic.value === 1) {
                // Elastic collision
                this.state.v1 = ((m1.value - m2.value) * v1i + 2 * m2.value * v2i) / (m1.value + m2.value);
                this.state.v2 = ((m2.value - m1.value) * v2i + 2 * m1.value * v1i) / (m1.value + m2.value);
            } else {
                // Inelastic collision
                const vf = (m1.value * v1i + m2.value * v2i) / (m1.value + m2.value);
                this.state.v1 = vf;
                this.state.v2 = vf;
            }
        }

        // Reset if blocks go off screen
        if (Math.abs(this.state.x1) > 400 || Math.abs(this.state.x2) > 400) {
            this.resetState();
        }
    }

    drawSimulation() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // Draw track
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(50, cy);
        this.ctx.lineTo(this.canvas.width - 50, cy);
        this.ctx.stroke();

        // Draw block 1
        const x1Pos = cx + this.state.x1;
        const size1 = 20 + Math.log(this.parameters.m1.value) * 5;
        this.ctx.fillStyle = '#569cd6';
        this.ctx.fillRect(x1Pos - size1/2, cy - size1/2, size1, size1);

        // Draw block 2
        const x2Pos = cx + this.state.x2;
        const size2 = 20 + Math.log(this.parameters.m2.value) * 5;
        this.ctx.fillStyle = '#b5cea8';
        this.ctx.fillRect(x2Pos - size2/2, cy - size2/2, size2, size2);

        // Draw velocity vectors
        this.ctx.strokeStyle = '#f44336';
        this.ctx.lineWidth = 3;

        // V1 arrow
        this.drawArrow(x1Pos, cy - 40, x1Pos + this.state.v1 * 3, cy - 40);

        // V2 arrow
        this.drawArrow(x2Pos, cy - 40, x2Pos + this.state.v2 * 3, cy - 40);

        // Collision indicator
        if (this.state.hasCollided && this.time - this.state.collisionTime < 0.5) {
            this.ctx.strokeStyle = '#ffeb3b';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc((x1Pos + x2Pos) / 2, cy, 30, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
    }

    drawArrow(fromX, fromY, toX, toY) {
        const headlen = 10;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);

        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI/6), toY - headlen * Math.sin(angle - Math.PI/6));
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI/6), toY - headlen * Math.sin(angle + Math.PI/6));
        this.ctx.stroke();
    }

    updateTUI() {
        const { m1, m2, v1, v2, elastic } = this.parameters;

        // Calculate momentum and energy
        const p1 = m1.value * this.state.v1;
        const p2 = m2.value * this.state.v2;
        const totalP = p1 + p2;

        const ke1 = 0.5 * m1.value * this.state.v1 * this.state.v1;
        const ke2 = 0.5 * m2.value * this.state.v2 * this.state.v2;
        const totalKE = ke1 + ke2;

        const initialKE = 0.5 * m1.value * v1.value * v1.value + 0.5 * m2.value * v2.value * v2.value;

        // ASCII visualization
        const trackWidth = 60;
        const pos1 = Math.round((this.state.x1 + 400) / 800 * trackWidth);
        const pos2 = Math.round((this.state.x2 + 400) / 800 * trackWidth);

        let track = Array(trackWidth).fill('─');
        if (pos1 >= 0 && pos1 < trackWidth) track[pos1] = '1';
        if (pos2 >= 0 && pos2 < trackWidth) track[pos2] = '2';
        if (Math.abs(pos1 - pos2) <= 1 && this.state.hasCollided) {
            track[Math.min(pos1, pos2)] = 'X';
        }

        const trackStr = '[' + track.join('') + ']';

        this.tui.innerHTML = `
<span class="tui-header">---[ MOMENTUM & COLLISIONS ]---</span>

<span class="tui-label">Setup (${elastic.value === 1 ? 'ELASTIC' : 'INELASTIC'} collision):</span>
  Block 1: m₁ = ${m1.value.toFixed(0).padStart(3)} kg, v₁ᵢ = ${v1.value.toFixed(0).padStart(4)} m/s
  Block 2: m₂ = ${m2.value.toFixed(0).padStart(3)} kg, v₂ᵢ = ${v2.value.toFixed(0).padStart(4)} m/s

<span class="tui-label">Track View:</span>
  ${trackStr}

<span class="tui-label">Current State @ t = ${this.time.toFixed(2)}s:</span>
  Block 1: v₁ = ${this.state.v1.toFixed(1).padStart(6)} m/s, p₁ = ${p1.toFixed(1).padStart(7)} kg⋅m/s
  Block 2: v₂ = ${this.state.v2.toFixed(1).padStart(6)} m/s, p₂ = ${p2.toFixed(1).padStart(7)} kg⋅m/s

<span class="tui-formula">Conservation Laws:</span>
  Total Momentum: ${totalP.toFixed(1).padStart(7)} kg⋅m/s (conserved)
  Total KE: ${totalKE.toFixed(1).padStart(7)} J (${elastic.value === 1 ? 'conserved' : 'lost: ' + (initialKE - totalKE).toFixed(1) + ' J'})

<span class="tui-label">Status: ${this.state.hasCollided ? '<span class="tui-warning">COLLISION OCCURRED</span>' : 'Approaching...'}</span>

<span class="tui-label">Controls: [SPACE] Pause | [R] Reset | [E] Toggle Elastic/Inelastic</span>`;
    }
}
"use strict";

/* =========================================================================
   webgl.js: a tiny raw-WebGL toolkit shared by every page (no libraries).

   - ShaderCanvas: draws one full-screen fragment shader on a <canvas>.
     Handles device pixel ratio, resizing, pausing when the tab is hidden
     or the canvas is off-screen, and prefers-reduced-motion.
   - Backdrop: the animated iridescent background behind every page.
     It can fire a ripple (pulse) and a glitch from page events.
   ========================================================================= */

const WebGLKit = (() => {
    const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const VERTEX_SHADER = `
        attribute vec2 aPos;
        void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    // Shared GLSL helpers: hash, value noise and fractal noise.
    const NOISE_GLSL = `
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
            float value = 0.0;
            float amp = 0.5;
            mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
            for (int i = 0; i < 5; i++) {
                value += amp * noise(p);
                p = rot * p;
                amp *= 0.5;
            }
            return value;
        }
    `;

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${log}`);
        }
        return shader;
    }

    class ShaderCanvas {
        /**
         * @param {HTMLCanvasElement} canvas
         * @param {string} fragmentSource  GLSL ES 1.0 fragment shader
         * @param {object} options
         *   resolution     render scale relative to CSS pixels (0.5 = half res)
         *   maxPixelRatio  cap for devicePixelRatio
         *   onFrame(gl, shaderCanvas, time)  set uniforms before each draw
         */
        constructor(canvas, fragmentSource, { resolution = 1, maxPixelRatio = 2, onFrame = null } = {}) {
            const gl = canvas.getContext("webgl", {
                alpha: false,
                antialias: false,
                depth: false,
                stencil: false,
                powerPreference: "high-performance",
            });
            if (!gl) {
                throw new Error("WebGL is not supported in this browser");
            }

            const program = gl.createProgram();
            gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
            gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
            }
            gl.useProgram(program);

            // One oversized triangle covers the whole viewport.
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const position = gl.getAttribLocation(program, "aPos");
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

            this.gl = gl;
            this.canvas = canvas;
            this.program = program;
            this.resolution = resolution;
            this.maxPixelRatio = maxPixelRatio;
            this.onFrame = onFrame;
            this.locations = new Map();
            this.startTime = performance.now();
            this.wanted = false;      // play() was called
            this.running = false;     // the animation loop is active
            this.visible = true;      // canvas is in the viewport
            this.pendingFrame = 0;
            this.loop = this.loop.bind(this);

            this.resize();
            if ("ResizeObserver" in window) {
                new ResizeObserver(() => this.resize()).observe(canvas);
            } else {
                window.addEventListener("resize", () => this.resize());
            }
            if ("IntersectionObserver" in window) {
                new IntersectionObserver(([entry]) => {
                    this.visible = entry.isIntersecting;
                    this.sync();
                }).observe(canvas);
            }
            document.addEventListener("visibilitychange", () => this.sync());
            canvas.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                this.wanted = false;
                this.sync();
            });
        }

        static get reducedMotion() {
            return REDUCED_MOTION;
        }

        /** Seconds since start; frozen when the user prefers reduced motion. */
        get time() {
            return REDUCED_MOTION ? 8 : (performance.now() - this.startTime) / 1000;
        }

        uniform(name) {
            if (!this.locations.has(name)) {
                this.locations.set(name, this.gl.getUniformLocation(this.program, name));
            }
            return this.locations.get(name);
        }

        resize() {
            const ratio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) * this.resolution;
            const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
            const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width;
                this.canvas.height = height;
                this.gl.viewport(0, 0, width, height);
            }
            this.invalidate();
        }

        draw() {
            const { gl } = this;
            const time = this.time;
            gl.uniform2f(this.uniform("uRes"), this.canvas.width, this.canvas.height);
            gl.uniform1f(this.uniform("uTime"), time);
            if (this.onFrame) {
                this.onFrame(gl, this, time);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        loop() {
            if (!this.running) {
                return;
            }
            this.draw();
            requestAnimationFrame(this.loop);
        }

        /** Draw a single frame soon (used when the loop is paused). */
        invalidate() {
            if (this.running || this.pendingFrame) {
                return;
            }
            this.pendingFrame = requestAnimationFrame(() => {
                this.pendingFrame = 0;
                this.draw();
            });
        }

        sync() {
            const shouldRun = this.wanted && this.visible && !document.hidden && !REDUCED_MOTION;
            if (shouldRun && !this.running) {
                this.running = true;
                requestAnimationFrame(this.loop);
            } else if (!shouldRun) {
                this.running = false;
                this.invalidate();
            }
        }

        play() {
            this.wanted = true;
            this.sync();
        }
    }

    // ---------------------------------------------------------------------
    // Backdrop: domain-warped fractal noise mapped to an iridescent palette,
    // with topographic contour lines, a cursor light, a ripple and a glitch.
    // ---------------------------------------------------------------------

    const BACKDROP_SHADER = `
        precision highp float;
        uniform vec2 uRes;
        uniform float uTime;
        uniform vec2 uMouse;      // 0..1, y up
        uniform float uScroll;    // page scroll in viewport heights
        uniform float uPulse;     // 1 -> 0 after an event
        uniform vec2 uPulseAt;    // 0..1, y up
        uniform vec3 uPulseColor;
        uniform float uGlitch;    // 1 -> 0 after an error
        ${NOISE_GLSL}

        vec3 palette(float t) {
            return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / uRes;
            float aspect = uRes.x / uRes.y;
            vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

            // Glitch: shift random horizontal bands sideways.
            if (uGlitch > 0.0) {
                float band = floor(uv.y * 28.0);
                float on = step(0.55, hash(vec2(band, floor(uTime * 24.0))));
                p.x += (hash(vec2(band, 7.0)) - 0.5) * 0.35 * uGlitch * on;
            }

            vec2 mouse = (uMouse - 0.5) * vec2(aspect, 1.0);
            float t = uTime * 0.05;
            p.y -= uScroll * 0.35;

            vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)),
                          fbm(p * 1.3 + vec2(5.2, 1.3) - t));
            vec2 r = vec2(fbm(p * 1.5 + 3.0 * q + vec2(1.7, 9.2) + 0.6 * t + mouse * 0.35),
                          fbm(p * 1.5 + 3.0 * q + vec2(8.3, 2.8) - 0.4 * t));
            float f = fbm(p * 1.1 + 2.6 * r);

            vec3 iri = palette(f * 1.4 + r.y * 0.6 + t * 0.6 + 0.55);
            float cloud = smoothstep(0.28, 0.78, f);
            cloud *= cloud;

            // Contour lines give the clouds a holographic, topographic look.
            float iso = abs(fract(f * 6.0) - 0.5);
            float contour = smoothstep(0.05, 0.0, iso) * smoothstep(0.3, 0.6, f);

            vec3 col = vec3(0.014, 0.015, 0.03);
            col += iri * cloud * 0.95;
            col += iri * contour * (0.02 + cloud * 0.35);

            // Soft light that follows the cursor.
            float md = length(p - mouse);
            col += vec3(0.30, 0.45, 0.85) * exp(-md * md * 5.0) * 0.07;

            // Ripple from the last event.
            vec2 at = (uPulseAt - 0.5) * vec2(aspect, 1.0);
            float pd = length((uv - 0.5) * vec2(aspect, 1.0) - at);
            float radius = (1.0 - uPulse) * 2.4;
            float ring = exp(-pow((pd - radius) * 9.0, 2.0)) * uPulse;
            col += uPulseColor * (ring * 0.9 + exp(-pd * 3.0) * uPulse * 0.18);

            // Red scan bands while glitching.
            col += vec3(1.0, 0.12, 0.22) * uGlitch * 0.3
                 * step(0.86, hash(vec2(floor(uv.y * 70.0), floor(uTime * 30.0))));

            // Vignette and film grain.
            vec2 v = uv - 0.5;
            col *= 1.0 - dot(v, v) * 1.3;
            col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.03;

            gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
    `;

    const PULSE_SECONDS = 1.8;
    const GLITCH_SECONDS = 0.7;

    function createBackdrop(canvas) {
        const state = {
            mouse: [0.5, 0.6],
            target: [0.5, 0.6],
            scroll: 0,
            pulseAt: [0.5, 0.5],
            pulseColor: [0.37, 0.95, 1.0],
            pulseStart: -100,
            glitchStart: -100,
        };

        const shader = new ShaderCanvas(canvas, BACKDROP_SHADER, {
            resolution: 0.5,
            maxPixelRatio: 1.5,
            onFrame(gl, sc, time) {
                state.mouse[0] += (state.target[0] - state.mouse[0]) * 0.04;
                state.mouse[1] += (state.target[1] - state.mouse[1]) * 0.04;
                const scrollTarget = window.scrollY / Math.max(1, window.innerHeight);
                state.scroll += (scrollTarget - state.scroll) * (REDUCED_MOTION ? 1 : 0.08);

                const pulse = Math.max(0, 1 - (time - state.pulseStart) / PULSE_SECONDS);
                const glitch = Math.max(0, 1 - (time - state.glitchStart) / GLITCH_SECONDS);

                gl.uniform2f(sc.uniform("uMouse"), state.mouse[0], state.mouse[1]);
                gl.uniform1f(sc.uniform("uScroll"), state.scroll);
                gl.uniform1f(sc.uniform("uPulse"), pulse * pulse);
                gl.uniform2f(sc.uniform("uPulseAt"), state.pulseAt[0], state.pulseAt[1]);
                gl.uniform3fv(sc.uniform("uPulseColor"), state.pulseColor);
                gl.uniform1f(sc.uniform("uGlitch"), glitch);
            },
        });

        window.addEventListener("pointermove", (event) => {
            state.target = [event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight];
        }, { passive: true });
        window.addEventListener("scroll", () => shader.invalidate(), { passive: true });

        shader.play();

        return {
            /** Ripple from a viewport point (CSS px), in an RGB 0..1 color. */
            pulse(color, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
                if (REDUCED_MOTION) {
                    return;
                }
                state.pulseColor = color;
                state.pulseAt = [clientX / window.innerWidth, 1 - clientY / window.innerHeight];
                state.pulseStart = shader.time;
            },
            glitch() {
                if (REDUCED_MOTION) {
                    return;
                }
                state.glitchStart = shader.time;
            },
        };
    }

    const noopBackdrop = { pulse() {}, glitch() {} };

    /** Start the page backdrop and mark <html> with gl-on / gl-off. */
    function boot() {
        const root = document.documentElement;
        const canvas = document.querySelector("canvas.backdrop");
        const statuses = document.querySelectorAll("[data-gl-status]");
        try {
            const backdrop = createBackdrop(canvas);
            root.classList.add("gl-on");
            statuses.forEach((el) => { el.textContent = "WebGL live"; });
            return backdrop;
        } catch (error) {
            console.warn(error);
            root.classList.add("gl-off");
            statuses.forEach((el) => { el.textContent = "WebGL off"; });
            return noopBackdrop;
        }
    }

    return { ShaderCanvas, NOISE_GLSL, boot };
})();

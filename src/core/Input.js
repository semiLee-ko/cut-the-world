export class Input {
    constructor() {
        this.joystick = { x: 0, y: 0, active: false };
        this.keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.maxRadius = 50;

        this.setupTouchEvents();
        this.setupMouseEvents();
        this.setupKeyboardEvents();
    }

    setupTouchEvents() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;

        canvas.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            this.startPos = { x: touch.clientX, y: touch.clientY };
            this.joystick.active = true;
            this.showJoystick(touch.clientX, touch.clientY);
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.cancelable) e.preventDefault();
            if (!this.joystick.active) return;

            const touch = e.touches[0];
            this.currentPos = { x: touch.clientX, y: touch.clientY };
            this.handleJoystickMove(this.currentPos.x, this.currentPos.y);
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (e.cancelable) e.preventDefault();
            this.joystick = { x: 0, y: 0, active: false };
            this.hideJoystick();
        });
    }

    setupMouseEvents() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;

        let isMouseDown = false;

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isMouseDown = true;
            this.startPos = { x: e.clientX, y: e.clientY };
            this.joystick.active = true;
            this.showJoystick(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            e.preventDefault();

            this.currentPos = { x: e.clientX, y: e.clientY };
            this.handleJoystickMove(this.currentPos.x, this.currentPos.y);
        });

        window.addEventListener('mouseup', (e) => {
            if (!isMouseDown) return;
            e.preventDefault();
            isMouseDown = false;
            this.joystick = { x: 0, y: 0, active: false };
            this.hideJoystick();
        });
    }

    setupKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = false;
            }
        });
    }

    handleJoystickMove(clientX, clientY) {
        let dx = clientX - this.startPos.x;
        let dy = clientY - this.startPos.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        // Dynamic Joystick: If finger goes beyond maxRadius, move the center
        if (distance > this.maxRadius) {
            const angle = Math.atan2(dy, dx);
            // Calculate where the center SHOULD be to make distance == maxRadius
            // New Center = Current Finger - (Vector of length maxRadius pointing to finger)
            const newStartX = clientX - Math.cos(angle) * this.maxRadius;
            const newStartY = clientY - Math.sin(angle) * this.maxRadius;

            this.startPos = { x: newStartX, y: newStartY };
            this.showJoystick(newStartX, newStartY); // Update visual base position

            // Recalculate dx, dy, distance based on new center (distance will be maxRadius)
            dx = clientX - this.startPos.x;
            dy = clientY - this.startPos.y;
            distance = this.maxRadius;
        }

        const angle = Math.atan2(dy, dx);
        const cappedDistance = Math.min(distance, this.maxRadius);

        this.joystick.x = Math.cos(angle) * (cappedDistance / this.maxRadius);
        this.joystick.y = Math.sin(angle) * (cappedDistance / this.maxRadius);

        this.updateJoystickUI(cappedDistance, angle);
    }

    updateJoystickUI(distance, angle) {
        const knob = document.getElementById('joystick-knob');
        if (!knob) return;

        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;

        knob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }

    showJoystick(x, y) {
        const container = document.getElementById('joystick-container');
        if (!container) return;

        container.style.left = x + 'px';
        container.style.top = y + 'px';
        container.style.display = 'block';
    }

    hideJoystick() {
        const container = document.getElementById('joystick-container');
        const knob = document.getElementById('joystick-knob');

        if (container) container.style.display = 'none';
        if (knob) knob.style.transform = 'translate(-50%, -50%)';
    }

    getVector() {
        if (this.joystick.active) {
            return { x: this.joystick.x, y: this.joystick.y };
        }

        let x = 0;
        let y = 0;
        if (this.keys.ArrowLeft || this.keys.a) x -= 1;
        if (this.keys.ArrowRight || this.keys.d) x += 1;
        if (this.keys.ArrowUp || this.keys.w) y -= 1;
        if (this.keys.ArrowDown || this.keys.s) y += 1;

        if (x !== 0 || y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }

        return { x, y };
    }
}

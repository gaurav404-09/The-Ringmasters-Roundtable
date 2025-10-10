import React, { useRef, useEffect } from 'react';

const Particles = ({
  particleCount = 150,
  particleColors = ['#ffffff'],
  speed = 0.5,
  particleBaseSize = 1.5,
  moveParticlesOnHover = true,
}) => {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: null, y: null, radius: 150 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particlesArray = [];

    const handleMouseMove = (event) => {
      mouse.current.x = event.clientX;
      mouse.current.y = event.clientY;
    };
    if (moveParticlesOnHover) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    
    class Particle {
      constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
      update() {
        if (moveParticlesOnHover && mouse.current.x != null) {
            let dx = mouse.current.x - this.x;
            let dy = mouse.current.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.current.radius) {
                this.x -= dx / 15;
                this.y -= dy / 15;
            }
        }
        this.x += this.directionX;
        this.y += this.directionY;

        if (this.x > canvas.width + 5) this.x = -5;
        if (this.x < -5) this.x = canvas.width + 5;
        if (this.y > canvas.height + 5) this.y = -5;
        if (this.y < -5) this.y = canvas.height + 5;

        this.draw();
      }
    }

    const init = () => {
      particlesArray = [];
      for (let i = 0; i < particleCount; i++) {
        let size = (Math.random() * 2) + particleBaseSize;
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        let directionX = (Math.random() * speed) - (speed / 2);
        let directionY = (Math.random() * speed) - (speed / 2);
        let color = particleColors[Math.floor(Math.random() * particleColors.length)];
        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
      }
    };

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
      }
    };

    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        init();
    }
    window.addEventListener('resize', handleResize);
    
    init();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [particleCount, particleColors, speed, particleBaseSize, moveParticlesOnHover]);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: -1 }} />;
};

export default Particles;

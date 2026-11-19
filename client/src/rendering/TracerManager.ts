import * as THREE from 'three';

interface ActiveTracer {
  mesh: THREE.Line;
  life: number;
  maxLife: number;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class TracerManager {
  private scene: THREE.Scene;
  private tracers: ActiveTracer[] = [];
  private particles: ImpactParticle[] = [];

  private tracerMaterial: THREE.LineBasicMaterial;
  private particleGeo: THREE.BoxGeometry;
  private sparkMat: THREE.MeshBasicMaterial;
  private bloodMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.95,
      linewidth: 2
    });

    this.particleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this.bloodMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
  }

  public addTracer(origin: THREE.Vector3, target: THREE.Vector3, isHit: boolean): void {
    const points = [origin.clone(), target.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    const mat = this.tracerMaterial.clone();
    if (isHit) {
      mat.color.setHex(0xff1744); // Red tracer if enemy was struck
    }

    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.tracers.push({
      mesh: line,
      life: 0.12, // 120ms duration
      maxLife: 0.12
    });

    // Spawn 3D voxel debris / blood particles at hit location
    this.spawnImpactParticles(target, isHit);
  }

  private spawnImpactParticles(pos: THREE.Vector3, isHit: boolean): void {
    const count = isHit ? 8 : 6;
    const material = isHit ? this.bloodMat : this.sparkMat;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, material);
      mesh.position.copy(pos);

      const speed = isHit ? 3.5 : 5.0;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 1.2,
        (Math.random() - 0.5) * speed
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        rotSpeed,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  public update(dt: number): void {
    // 1. Update & fade bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const alpha = Math.max(0, t.life / t.maxLife);
      (t.mesh.material as THREE.LineBasicMaterial).opacity = alpha;

      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 2. Update physical voxel debris
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 22.0 * dt; // High-velocity gravity on debris
      p.mesh.position.addScaledVector(p.vel, dt);

      // Spin rotation
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;
      p.mesh.rotation.z += p.rotSpeed.z * dt;

      // Shrink scale toward end of life
      const scale = Math.max(0.01, p.life / p.maxLife);
      p.mesh.scale.setScalar(scale);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const t of this.tracers) {
      this.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    }
    this.tracers = [];

    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }
}

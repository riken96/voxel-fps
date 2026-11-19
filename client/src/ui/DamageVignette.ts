export class DamageVignette {
  private element: HTMLElement;
  private flashIntensity = 0;
  private isLowHp = false;
  private pulseTimer = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'damage-vignette';
    this.element.style.position = 'absolute';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '280';
    this.element.style.transition = 'opacity 0.08s ease-out';
    this.element.style.opacity = '0';
    this.element.style.boxShadow = 'inset 0 0 100px rgba(255, 23, 68, 0.9)';

    parent.appendChild(this.element);
  }

  public triggerDamageFlash(): void {
    this.flashIntensity = 1.0;
  }

  public update(health: number, dt: number): void {
    this.isLowHp = health > 0 && health <= 30;

    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 3.5);
    }

    let targetOpacity = this.flashIntensity * 0.75;

    if (this.isLowHp) {
      this.pulseTimer += dt * 4.5;
      const pulse = (Math.sin(this.pulseTimer) + 1.0) * 0.5; // [0..1]
      targetOpacity = Math.max(targetOpacity, 0.35 + pulse * 0.45);
    }

    this.element.style.opacity = targetOpacity.toFixed(3);
  }
}
